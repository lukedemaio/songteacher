"""Music theory analysis using music21: key detection, chord analysis, roman numerals."""

import logging
from pathlib import Path

import music21
from music21 import chord as m21chord, key as m21key, roman as m21roman

from app.models.schemas import (
    ChordEvent, ChordFunction, NoteEvent, SongSection,
    TheoryAnnotation,
)

logger = logging.getLogger(__name__)


def _detect_key(stream: music21.stream.Stream) -> tuple[str, str, float]:
    """Detect key, mode, and confidence from a music21 stream."""
    analysis = stream.analyze("key")
    key_name = analysis.tonic.name
    mode = analysis.mode
    confidence = round(analysis.correlationCoefficient, 3)
    return key_name, mode, confidence


def _get_chord_function(rn: m21roman.RomanNumeral, key_obj: m21key.Key) -> ChordFunction:
    """Classify chord function based on roman numeral."""
    degree = rn.scaleDegree
    if degree == 1:
        return ChordFunction.tonic
    elif degree in (4, 2):
        return ChordFunction.subdominant
    elif degree in (5, 7):
        return ChordFunction.dominant
    elif rn.secondaryRomanNumeral is not None:
        return ChordFunction.secondary
    else:
        return ChordFunction.other


def _estimate_tempo(stream: music21.stream.Stream) -> float:
    """Estimate tempo from the stream, default to 120 BPM."""
    tempos = stream.flatten().getElementsByClass(music21.tempo.MetronomeMark)
    if tempos:
        return round(tempos[0].number, 1)
    return 120.0


def _estimate_time_signature(stream: music21.stream.Stream) -> str:
    """Get time signature from the stream."""
    time_sigs = stream.flatten().getElementsByClass(music21.meter.TimeSignature)
    if time_sigs:
        ts = time_sigs[0]
        return f"{ts.numerator}/{ts.denominator}"
    return "4/4"


def _chordify_and_analyze(
    stream: music21.stream.Stream,
    key_obj: m21key.Key,
    duration: float,
) -> list[ChordEvent]:
    """Extract chords from stream using music21's chordify."""
    chords: list[ChordEvent] = []

    try:
        chordified = stream.chordify()
    except Exception as e:
        logger.warning("Chordify failed: %s", e)
        return chords

    for element in chordified.recurse().getElementsByClass(m21chord.Chord):
        offset = float(element.offset)
        chord_duration = float(element.quarterLength)
        # Convert quarterLength to seconds (approximate using tempo)
        # This is a rough estimate; precise timing comes from the MIDI
        end_time = offset + chord_duration

        # Get chord name
        chord_name = element.pitchedCommonName
        if not chord_name:
            chord_name = " ".join(p.name for p in element.pitches)

        # Roman numeral analysis
        roman_str = ""
        func = ChordFunction.other
        try:
            rn = m21roman.romanNumeralFromChord(element, key_obj)
            roman_str = rn.romanNumeral
            if rn.figuresWritten:
                roman_str += rn.figuresWritten
            func = _get_chord_function(rn, key_obj)
        except Exception:
            pass

        pitch_names = [p.name for p in element.pitches]

        chords.append(ChordEvent(
            name=chord_name,
            roman_numeral=roman_str,
            function=func,
            start_time=round(offset, 3),
            end_time=round(end_time, 3),
            notes=pitch_names,
        ))

    return chords


def _generate_theory_annotations(
    chords: list[ChordEvent],
    key_name: str,
    mode: str,
) -> list[TheoryAnnotation]:
    """Generate time-synced theory explanations from chord analysis."""
    annotations: list[TheoryAnnotation] = []

    # Key annotation at the start
    annotations.append(TheoryAnnotation(
        time=0.0,
        title=f"Key: {key_name} {mode}",
        description=f"This song is in {key_name} {mode}. "
                    f"{'Major keys have a bright, happy sound.' if mode == 'major' else 'Minor keys have a darker, more somber sound.'}",
        category="key",
        detail=f"The {mode} scale starting on {key_name} contains the notes used in this song's melody and harmony. "
               f"Understanding the key helps predict which chords are likely to appear.",
    ))

    for i, chord in enumerate(chords):
        # Annotate secondary dominants
        if chord.function == ChordFunction.secondary:
            annotations.append(TheoryAnnotation(
                time=chord.start_time,
                title=f"Secondary Dominant: {chord.name}",
                description=f"{chord.roman_numeral} — a chord borrowed from a related key to create tension toward the next chord.",
                category="secondary_dominant",
                detail=f"Secondary dominants temporarily tonicize a chord other than I. "
                       f"Here, {chord.name} acts as a V of the following chord, "
                       f"creating a momentary key change that adds color and forward motion.",
            ))

        # Annotate borrowed chords
        if chord.function == ChordFunction.borrowed:
            annotations.append(TheoryAnnotation(
                time=chord.start_time,
                title=f"Borrowed Chord: {chord.name}",
                description=f"{chord.roman_numeral} — borrowed from the parallel {'minor' if mode == 'major' else 'major'} key.",
                category="borrowed_chord",
                detail=f"Modal interchange (borrowing chords from a parallel key) adds harmonic color. "
                       f"This {chord.name} chord wouldn't naturally occur in {key_name} {mode}.",
            ))

        # Detect cadences (V → I or iv → I)
        if i > 0:
            prev = chords[i - 1]
            if prev.function == ChordFunction.dominant and chord.function == ChordFunction.tonic:
                annotations.append(TheoryAnnotation(
                    time=prev.start_time,
                    title="Authentic Cadence (V → I)",
                    description=f"{prev.roman_numeral} → {chord.roman_numeral}: The strongest resolution in tonal music.",
                    category="cadence",
                    detail="An authentic cadence (V → I) creates the strongest sense of resolution. "
                           "The dominant chord contains the leading tone, which has a strong pull toward the tonic. "
                           "This is the most common way to end phrases and sections.",
                ))
            elif prev.function == ChordFunction.subdominant and chord.function == ChordFunction.tonic:
                annotations.append(TheoryAnnotation(
                    time=prev.start_time,
                    title="Plagal Cadence (IV → I)",
                    description=f"{prev.roman_numeral} → {chord.roman_numeral}: The 'Amen' cadence — a softer resolution.",
                    category="cadence",
                    detail="A plagal cadence (IV → I) provides a gentler resolution than the authentic cadence. "
                           "Often called the 'Amen cadence' because of its use in hymns.",
                ))

    return annotations


def _generate_sections(chords: list[ChordEvent], duration: float) -> list[SongSection]:
    """Generate rough section estimates based on chord pattern repetition."""
    if not chords or duration == 0:
        return [SongSection(name="Full Song", start_time=0, end_time=duration)]

    # Simple heuristic: divide into ~30s sections
    sections: list[SongSection] = []
    section_length = 30.0
    section_names = ["Intro", "Verse", "Chorus", "Verse", "Chorus", "Bridge", "Chorus", "Outro"]
    num_sections = max(1, int(duration / section_length))

    for i in range(min(num_sections, len(section_names))):
        start = i * section_length
        end = min((i + 1) * section_length, duration)
        sections.append(SongSection(
            name=section_names[i] if i < len(section_names) else f"Section {i+1}",
            start_time=round(start, 2),
            end_time=round(end, 2),
        ))

    return sections


def analyze_midi(
    midi_path: Path,
    notes: list[NoteEvent],
    duration: float,
) -> tuple[str, float, str, float, str, list[ChordEvent], list[TheoryAnnotation], list[SongSection]]:
    """Full music theory analysis of a MIDI file.

    Returns (key, key_confidence, mode, tempo, time_signature, chords, annotations, sections).
    """
    logger.info("Analyzing: %s", midi_path)

    stream = music21.converter.parse(str(midi_path))

    # Key detection
    key_name, mode, confidence = _detect_key(stream)
    key_obj = m21key.Key(key_name, mode)

    # Tempo and time signature
    tempo = _estimate_tempo(stream)
    time_sig = _estimate_time_signature(stream)

    # Chord analysis
    chords = _chordify_and_analyze(stream, key_obj, duration)

    # Convert chord times from quarter-note offsets to seconds
    # Use tempo to approximate: seconds = (quarterLength / tempo) * 60
    seconds_per_quarter = 60.0 / tempo if tempo > 0 else 0.5
    for c in chords:
        c.start_time = round(c.start_time * seconds_per_quarter, 3)
        c.end_time = round(c.end_time * seconds_per_quarter, 3)

    # Theory annotations
    annotations = _generate_theory_annotations(chords, key_name, mode)

    # Sections
    sections = _generate_sections(chords, duration)

    logger.info("Analysis: key=%s %s (%.2f), tempo=%.0f, %d chords, %d annotations",
                key_name, mode, confidence, tempo, len(chords), len(annotations))

    return key_name, confidence, mode, tempo, time_sig, chords, annotations, sections
