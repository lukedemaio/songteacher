"""Music theory analysis using music21: key detection, chord analysis, roman numerals."""

import logging
from pathlib import Path

import music21
from music21 import chord as m21chord, key as m21key, roman as m21roman

from app.models.schemas import (
    ChordEvent, ChordFunction, ChordSummary, NoteEvent, SongSection,
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


def _enharmonic_equal(a: str, b: str) -> bool:
    """Compare note names accounting for enharmonic equivalence (C# == D-, etc.)."""
    try:
        pa = music21.pitch.Pitch(a)
        pb = music21.pitch.Pitch(b)
        return pa.midi == pb.midi
    except Exception:
        return a == b


def _get_scale_notes(key_name: str, mode: str) -> list[str]:
    """Get the note names in the key's scale."""
    try:
        k = m21key.Key(key_name, mode)
        scale = k.getScale()
        pitches = scale.getPitches()
        # Return unique note names (without octave), exclude the repeated tonic at top
        seen: set[str] = set()
        result: list[str] = []
        for p in pitches:
            name = p.name
            if name not in seen:
                seen.add(name)
                result.append(name)
        return result[:7]  # 7 unique scale degrees
    except Exception as e:
        logger.warning("Failed to get scale notes: %s", e)
        return []


def _build_chord_summary(
    chords: list[ChordEvent],
    key_name: str,
    mode: str,
    scale_notes: list[str],
) -> list[ChordSummary]:
    """Deduplicate chords by name, count occurrences, map tones to scale degrees."""
    counts: dict[str, int] = {}
    first_seen: dict[str, ChordEvent] = {}

    for c in chords:
        if c.name not in counts:
            counts[c.name] = 0
            first_seen[c.name] = c
        counts[c.name] += 1

    summaries: list[ChordSummary] = []
    for name, count in counts.items():
        chord = first_seen[name]
        # Map each chord tone to its scale degree
        scale_degrees: list[str] = []
        for note_name in chord.notes:
            matched = False
            for i, sn in enumerate(scale_notes):
                if _enharmonic_equal(note_name, sn):
                    scale_degrees.append(str(i + 1))
                    matched = True
                    break
            if not matched:
                scale_degrees.append("?")

        summaries.append(ChordSummary(
            name=name,
            roman_numeral=chord.roman_numeral,
            function=chord.function,
            notes=chord.notes,
            scale_degrees=scale_degrees,
            count=count,
        ))

    # Sort by frequency descending
    summaries.sort(key=lambda s: s.count, reverse=True)
    return summaries


def _detect_common_progressions(chords: list[ChordEvent]) -> list[str]:
    """Detect repeated roman numeral patterns using a sliding window."""
    romans = [c.roman_numeral for c in chords if c.roman_numeral]
    if len(romans) < 3:
        return []

    pattern_counts: dict[str, int] = {}

    for window_size in (3, 4):
        for i in range(len(romans) - window_size + 1):
            pattern = " - ".join(romans[i : i + window_size])
            pattern_counts[pattern] = pattern_counts.get(pattern, 0) + 1

    # Filter patterns appearing 2+ times, sort by frequency
    repeated = [(p, c) for p, c in pattern_counts.items() if c >= 2]
    repeated.sort(key=lambda x: x[1], reverse=True)

    return [p for p, _ in repeated[:5]]


def analyze_midi(
    midi_path: Path,
    notes: list[NoteEvent],
    duration: float,
) -> tuple[str, float, str, float, str, list[ChordEvent], list[TheoryAnnotation], list[SongSection], list[str], list[ChordSummary], list[str]]:
    """Full music theory analysis of a MIDI file.

    Returns (key, key_confidence, mode, tempo, time_signature, chords, annotations, sections,
             scale_notes, chord_summary, common_progressions).
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

    # New v2 analysis
    scale_notes = _get_scale_notes(key_name, mode)
    chord_summary = _build_chord_summary(chords, key_name, mode, scale_notes)
    common_progressions = _detect_common_progressions(chords)

    logger.info("Analysis: key=%s %s (%.2f), tempo=%.0f, %d chords, %d annotations",
                key_name, mode, confidence, tempo, len(chords), len(annotations))

    return key_name, confidence, mode, tempo, time_sig, chords, annotations, sections, scale_notes, chord_summary, common_progressions
