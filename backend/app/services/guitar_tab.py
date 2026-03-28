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


def _position_cost(string: int, fret: int, prev_fret: int | None) -> float:
    """Cost function for fret position selection.

    Prefers: lower frets, minimal hand movement, middle strings.
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

    return cost


def notes_to_tab(notes: list[NoteEvent]) -> list[GuitarTabNote]:
    """Map note events to guitar tablature positions.

    Uses a greedy cost-minimized algorithm to choose playable positions.
    """
    tab_notes: list[GuitarTabNote] = []
    prev_fret: int | None = None

    for note in notes:
        options = _pitch_to_fret_options(note.pitch)
        if not options:
            continue

        # Choose lowest-cost position
        best = min(options, key=lambda sf: _position_cost(sf[0], sf[1], prev_fret))
        string, fret = best

        tab_notes.append(GuitarTabNote(
            string=string,
            fret=fret,
            start_time=note.start_time,
            end_time=note.end_time,
            pitch=note.pitch,
        ))
        prev_fret = fret

    logger.info("Generated %d tab notes from %d input notes", len(tab_notes), len(notes))
    return tab_notes


# Common chord voicings: name -> frets for strings [E A D G B e] (-1 = muted)
CHORD_VOICINGS: dict[str, list[int]] = {
    "C": [-1, 3, 2, 0, 1, 0],
    "D": [-1, -1, 0, 2, 3, 2],
    "E": [0, 2, 2, 1, 0, 0],
    "F": [1, 3, 3, 2, 1, 1],
    "G": [3, 2, 0, 0, 0, 3],
    "A": [-1, 0, 2, 2, 2, 0],
    "B": [-1, 2, 4, 4, 4, 2],
    "Am": [-1, 0, 2, 2, 1, 0],
    "Bm": [-1, 2, 4, 4, 3, 2],
    "Cm": [-1, 3, 5, 5, 4, 3],
    "Dm": [-1, -1, 0, 2, 3, 1],
    "Em": [0, 2, 2, 0, 0, 0],
    "Fm": [1, 3, 3, 1, 1, 1],
    "Gm": [3, 5, 5, 3, 3, 3],
    "C7": [-1, 3, 2, 3, 1, 0],
    "D7": [-1, -1, 0, 2, 1, 2],
    "E7": [0, 2, 0, 1, 0, 0],
    "G7": [3, 2, 0, 0, 0, 1],
    "A7": [-1, 0, 2, 0, 2, 0],
    "B7": [-1, 2, 1, 2, 0, 2],
    "Am7": [-1, 0, 2, 0, 1, 0],
    "Dm7": [-1, -1, 0, 2, 1, 1],
    "Em7": [0, 2, 0, 0, 0, 0],
    "Cmaj7": [-1, 3, 2, 0, 0, 0],
    "Fmaj7": [-1, -1, 3, 2, 1, 0],
}


def _simplify_chord_name(name: str) -> str:
    """Try to simplify a music21 chord name to a common guitar chord name."""
    # music21 gives names like "C-major triad" — extract root and quality
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

    simplified = root + quality
    return simplified


def chords_to_tab(chords: list[ChordEvent]) -> list[GuitarTabChord]:
    """Map chord events to guitar chord voicings."""
    tab_chords: list[GuitarTabChord] = []

    for chord in chords:
        simplified = _simplify_chord_name(chord.name)
        frets = CHORD_VOICINGS.get(simplified)

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
