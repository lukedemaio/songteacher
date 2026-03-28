"""Map MIDI notes to guitar fretboard positions using cost-minimized position selection."""

import logging
from app.models.schemas import ChordEvent, GuitarTabChord, GuitarTabNote, NoteEvent

logger = logging.getLogger(__name__)

# Standard tuning: string 1 (high E) to string 6 (low E)
# MIDI note numbers for open strings
OPEN_STRINGS = [64, 59, 55, 50, 45, 40]  # E4, B3, G3, D3, A2, E2
STRING_NAMES = ["e", "B", "G", "D", "A", "E"]
MAX_FRET = 22


def _pitch_to_fret_options(pitch: int) -> list[tuple[int, int]]:
    """Return all (string, fret) options for a MIDI pitch on guitar.

    String numbers are 1-indexed (1=high E, 6=low E).
    """
    options = []
    for string_idx, open_pitch in enumerate(OPEN_STRINGS):
        fret = pitch - open_pitch
        if 0 <= fret <= MAX_FRET:
            options.append((string_idx + 1, fret))
    return options


def _position_cost(
    string: int, fret: int, prev_fret: int | None, used_strings: set[int] | None = None
) -> float:
    """Cost function for fret position selection.

    Prefers: lower frets, minimal hand movement, middle strings, adjacent strings.
    """
    cost = 0.0

    # Prefer lower positions (open strings and low frets)
    cost += fret * 0.5

    # Penalize extreme frets
    if fret > 12:
        cost += (fret - 12) * 1.5

    # Minimize hand movement from previous note
    if prev_fret is not None and prev_fret >= 0:
        cost += abs(fret - prev_fret) * 2.0

    # Slight preference for middle strings (easier to play)
    if string in (2, 3, 4):
        cost -= 0.5

    # Penalize string gaps (for simultaneous notes / chords)
    if used_strings:
        min_dist = min(abs(string - s) for s in used_strings)
        if min_dist > 2:
            cost += (min_dist - 2) * 3.0

    return cost


def notes_to_tab(notes: list[NoteEvent]) -> list[GuitarTabNote]:
    """Map note events to guitar tablature positions.

    Uses a greedy cost-minimized algorithm to choose playable positions.
    Groups simultaneous notes (within 50ms) and places them on adjacent strings.
    """
    tab_notes: list[GuitarTabNote] = []
    prev_fret: int | None = None

    # Group simultaneous notes (same start_time within 50ms)
    groups: list[list[NoteEvent]] = []
    current_group: list[NoteEvent] = []

    for note in notes:
        if current_group and abs(note.start_time - current_group[0].start_time) > 0.05:
            groups.append(current_group)
            current_group = [note]
        else:
            current_group.append(note)
    if current_group:
        groups.append(current_group)

    for group in groups:
        if len(group) == 1:
            # Single note — use simple cost
            note = group[0]
            options = _pitch_to_fret_options(note.pitch)
            if not options:
                continue
            best = min(options, key=lambda sf: _position_cost(sf[0], sf[1], prev_fret))
            string, fret = best
            tab_notes.append(GuitarTabNote(
                string=string, fret=fret,
                start_time=note.start_time, end_time=note.end_time,
                pitch=note.pitch,
            ))
            prev_fret = fret
        else:
            # Multiple simultaneous notes — try to place on adjacent strings
            used_strings: set[int] = set()
            group_notes = []

            # Sort by pitch (low to high) so bass notes get low strings
            sorted_group = sorted(group, key=lambda n: n.pitch)
            for note in sorted_group:
                options = _pitch_to_fret_options(note.pitch)
                if not options:
                    continue
                # Filter out already-used strings
                available = [(s, f) for s, f in options if s not in used_strings]
                if not available:
                    available = options  # fallback
                best = min(
                    available,
                    key=lambda sf: _position_cost(sf[0], sf[1], prev_fret, used_strings),
                )
                string, fret = best
                used_strings.add(string)
                group_notes.append((note, string, fret))

            for note, string, fret in group_notes:
                tab_notes.append(GuitarTabNote(
                    string=string, fret=fret,
                    start_time=note.start_time, end_time=note.end_time,
                    pitch=note.pitch,
                ))
            if group_notes:
                prev_fret = group_notes[-1][2]

    logger.info("Generated %d tab notes from %d input notes", len(tab_notes), len(notes))
    return tab_notes


# Common chord voicings: name -> frets for strings [E A D G B e] (-1 = muted)
CHORD_VOICINGS: dict[str, list[int]] = {
    # ── Major ──
    "C":  [-1, 3, 2, 0, 1, 0],
    "D":  [-1, -1, 0, 2, 3, 2],
    "E":  [0, 2, 2, 1, 0, 0],
    "F":  [1, 3, 3, 2, 1, 1],
    "G":  [3, 2, 0, 0, 0, 3],
    "A":  [-1, 0, 2, 2, 2, 0],
    "B":  [-1, 2, 4, 4, 4, 2],
    # Sharp/flat major
    "C#": [-1, 4, 3, 1, 2, 1],
    "Db": [-1, 4, 3, 1, 2, 1],
    "Eb": [-1, -1, 1, 3, 4, 3],
    "D#": [-1, -1, 1, 3, 4, 3],
    "F#": [2, 4, 4, 3, 2, 2],
    "Gb": [2, 4, 4, 3, 2, 2],
    "Ab": [4, 6, 6, 5, 4, 4],
    "G#": [4, 6, 6, 5, 4, 4],
    "Bb": [-1, 1, 3, 3, 3, 1],
    "A#": [-1, 1, 3, 3, 3, 1],

    # ── Minor ──
    "Am":  [-1, 0, 2, 2, 1, 0],
    "Bm":  [-1, 2, 4, 4, 3, 2],
    "Cm":  [-1, 3, 5, 5, 4, 3],
    "Dm":  [-1, -1, 0, 2, 3, 1],
    "Em":  [0, 2, 2, 0, 0, 0],
    "Fm":  [1, 3, 3, 1, 1, 1],
    "Gm":  [3, 5, 5, 3, 3, 3],
    # Sharp/flat minor
    "C#m": [-1, 4, 6, 6, 5, 4],
    "Dbm": [-1, 4, 6, 6, 5, 4],
    "Ebm": [-1, -1, 1, 3, 4, 2],
    "D#m": [-1, -1, 1, 3, 4, 2],
    "F#m": [2, 4, 4, 2, 2, 2],
    "Gbm": [2, 4, 4, 2, 2, 2],
    "G#m": [4, 6, 6, 4, 4, 4],
    "Abm": [4, 6, 6, 4, 4, 4],
    "Bbm": [-1, 1, 3, 3, 2, 1],
    "A#m": [-1, 1, 3, 3, 2, 1],

    # ── Dominant 7th ──
    "C7":  [-1, 3, 2, 3, 1, 0],
    "D7":  [-1, -1, 0, 2, 1, 2],
    "E7":  [0, 2, 0, 1, 0, 0],
    "F7":  [1, 3, 1, 2, 1, 1],
    "G7":  [3, 2, 0, 0, 0, 1],
    "A7":  [-1, 0, 2, 0, 2, 0],
    "B7":  [-1, 2, 1, 2, 0, 2],
    "Bb7": [-1, 1, 3, 1, 3, 1],
    "Eb7": [-1, -1, 1, 3, 2, 3],
    "F#7": [2, 4, 2, 3, 2, 2],
    "Ab7": [4, 6, 4, 5, 4, 4],

    # ── Minor 7th ──
    "Am7":  [-1, 0, 2, 0, 1, 0],
    "Bm7":  [-1, 2, 0, 2, 3, 2],
    "Cm7":  [-1, 3, 5, 3, 4, 3],
    "Dm7":  [-1, -1, 0, 2, 1, 1],
    "Em7":  [0, 2, 0, 0, 0, 0],
    "F#m7": [2, 4, 2, 2, 2, 2],
    "G#m7": [4, 6, 4, 4, 4, 4],
    "Bbm7": [-1, 1, 3, 1, 2, 1],
    "C#m7": [-1, 4, 6, 4, 5, 4],

    # ── Major 7th ──
    "Cmaj7":  [-1, 3, 2, 0, 0, 0],
    "Dmaj7":  [-1, -1, 0, 2, 2, 2],
    "Emaj7":  [0, 2, 1, 1, 0, 0],
    "Fmaj7":  [-1, -1, 3, 2, 1, 0],
    "Gmaj7":  [3, 2, 0, 0, 0, 2],
    "Amaj7":  [-1, 0, 2, 1, 2, 0],
    "Bbmaj7": [-1, 1, 3, 2, 3, 1],

    # ── Sus chords ──
    "Dsus2": [-1, -1, 0, 2, 3, 0],
    "Dsus4": [-1, -1, 0, 2, 3, 3],
    "Asus2": [-1, 0, 2, 2, 0, 0],
    "Asus4": [-1, 0, 2, 2, 3, 0],
    "Esus4": [0, 2, 2, 2, 0, 0],
    "Csus4": [-1, 3, 3, 0, 1, 1],

    # ── Add9 chords ──
    "Cadd9": [-1, 3, 2, 0, 3, 0],
    "Eadd9": [0, 2, 2, 1, 0, 2],
    "Gadd9": [3, 0, 0, 0, 0, 3],

    # ── Power chords ──
    "C5": [-1, 3, 5, -1, -1, -1],
    "D5": [-1, -1, 0, 2, -1, -1],
    "E5": [0, 2, 2, -1, -1, -1],
    "F5": [1, 3, 3, -1, -1, -1],
    "G5": [3, 5, 5, -1, -1, -1],
    "A5": [-1, 0, 2, -1, -1, -1],
    "B5": [-1, 2, 4, -1, -1, -1],

    # ── Slash chords (common inversions) ──
    "C/G":  [3, 3, 2, 0, 1, 0],
    "D/F#": [2, 0, 0, 2, 3, 2],
    "Am/E": [0, 0, 2, 2, 1, 0],
    "G/B":  [-1, 2, 0, 0, 0, 3],
    "Am/G": [3, 0, 2, 2, 1, 0],

    # ── Diminished ──
    "Bdim":  [-1, 2, 3, 4, 3, -1],
    "C#dim": [-1, 4, 5, 3, 5, -1],
    "Ddim":  [-1, -1, 0, 1, 3, 1],
}


def _simplify_chord_name(name: str) -> str:
    """Try to simplify a music21 chord name to a common guitar chord name."""
    name = name.strip()

    # Direct match first
    if name in CHORD_VOICINGS:
        return name

    # Try parsing common patterns
    parts = name.lower().split()
    if not parts:
        return name

    root = ""
    quality = ""

    # Extract root (first part, capitalize)
    for word in parts:
        if word[0] in "abcdefg":
            root = word[0].upper()
            if len(word) > 1 and word[1] in "#b-":
                if word[1] == "-":
                    root += "b"
                else:
                    root += word[1]
            break

    if not root:
        return name

    # Determine quality
    name_lower = name.lower()
    if "minor" in name_lower and "seventh" in name_lower:
        quality = "m7"
    elif "major" in name_lower and "seventh" in name_lower:
        quality = "maj7"
    elif "dominant" in name_lower or ("seventh" in name_lower and "minor" not in name_lower and "major" not in name_lower):
        quality = "7"
    elif "minor" in name_lower:
        quality = "m"
    elif "diminished" in name_lower:
        quality = "dim"
    elif "augmented" in name_lower:
        quality = "aug"
    elif "suspended fourth" in name_lower or "sus4" in name_lower:
        quality = "sus4"
    elif "suspended second" in name_lower or "sus2" in name_lower:
        quality = "sus2"
    elif "power" in name_lower:
        quality = "5"

    simplified = root + quality
    return simplified


def chords_to_tab(chords: list[ChordEvent]) -> list[GuitarTabChord]:
    """Map chord events to guitar chord voicings."""
    tab_chords: list[GuitarTabChord] = []

    for chord in chords:
        simplified = _simplify_chord_name(chord.name)
        frets = CHORD_VOICINGS.get(simplified)

        if frets is None:
            # Try enharmonic equivalents
            enharmonic_map = {
                "C#": "Db", "Db": "C#",
                "D#": "Eb", "Eb": "D#",
                "F#": "Gb", "Gb": "F#",
                "G#": "Ab", "Ab": "G#",
                "A#": "Bb", "Bb": "A#",
            }
            # Extract root and quality
            root = simplified[0]
            rest = simplified[1:]
            if rest and rest[0] in "#b":
                root += rest[0]
                rest = rest[1:]
            alt_root = enharmonic_map.get(root)
            if alt_root:
                frets = CHORD_VOICINGS.get(alt_root + rest)

        if frets is None:
            # Try just the root
            root = simplified[0]
            if len(simplified) > 1 and simplified[1] in "#b":
                root = simplified[:2]
            frets = CHORD_VOICINGS.get(root, [-1, -1, -1, -1, -1, -1])

        tab_chords.append(GuitarTabChord(
            name=simplified,
            frets=frets,
            start_time=chord.start_time,
            end_time=chord.end_time,
        ))

    logger.info("Generated %d tab chords", len(tab_chords))
    return tab_chords
