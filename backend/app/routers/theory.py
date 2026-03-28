"""Music theory reference endpoints."""

from fastapi import APIRouter, HTTPException

from app.models.schemas import ModeInfo, SecondaryDominant

router = APIRouter(prefix="/api/theory", tags=["theory"])

MODES: list[ModeInfo] = [
    ModeInfo(
        name="Ionian (Major)",
        scale_degrees=["1", "2", "3", "4", "5", "6", "7"],
        intervals=["W", "W", "H", "W", "W", "W", "H"],
        character="Bright, happy, resolved",
        example_songs=["Let It Be - Beatles", "Shake It Off - Taylor Swift"],
    ),
    ModeInfo(
        name="Dorian",
        scale_degrees=["1", "2", "b3", "4", "5", "6", "b7"],
        intervals=["W", "H", "W", "W", "W", "H", "W"],
        character="Minor but with a bright 6th — jazzy, soulful",
        example_songs=["So What - Miles Davis", "Oye Como Va - Santana"],
    ),
    ModeInfo(
        name="Phrygian",
        scale_degrees=["1", "b2", "b3", "4", "5", "b6", "b7"],
        intervals=["H", "W", "W", "W", "H", "W", "W"],
        character="Dark, exotic, Spanish/flamenco flavor",
        example_songs=["White Rabbit - Jefferson Airplane"],
    ),
    ModeInfo(
        name="Lydian",
        scale_degrees=["1", "2", "3", "#4", "5", "6", "7"],
        intervals=["W", "W", "W", "H", "W", "W", "H"],
        character="Dreamy, floating, ethereal",
        example_songs=["Flying in a Blue Dream - Joe Satriani"],
    ),
    ModeInfo(
        name="Mixolydian",
        scale_degrees=["1", "2", "3", "4", "5", "6", "b7"],
        intervals=["W", "W", "H", "W", "W", "H", "W"],
        character="Major but with a bluesy b7 — rock, folk",
        example_songs=["Sweet Child O' Mine - Guns N' Roses", "Norwegian Wood - Beatles"],
    ),
    ModeInfo(
        name="Aeolian (Natural Minor)",
        scale_degrees=["1", "2", "b3", "4", "5", "b6", "b7"],
        intervals=["W", "H", "W", "W", "H", "W", "W"],
        character="Sad, dark, introspective",
        example_songs=["Stairway to Heaven - Led Zeppelin", "Losing My Religion - R.E.M."],
    ),
    ModeInfo(
        name="Locrian",
        scale_degrees=["1", "b2", "b3", "4", "b5", "b6", "b7"],
        intervals=["H", "W", "W", "H", "W", "W", "W"],
        character="Unstable, dissonant, tense — rarely used as a tonal center",
        example_songs=["Army of Me - Bjork (partial)"],
    ),
]

# Note names for building scales
CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
CHROMATIC_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

# Major scale intervals in semitones
MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11]


def _note_index(note: str) -> int:
    """Get chromatic index for a note name."""
    note = note.strip()
    if note in CHROMATIC:
        return CHROMATIC.index(note)
    if note in CHROMATIC_FLAT:
        return CHROMATIC_FLAT.index(note)
    # Handle enharmonics
    if note == "Cb":
        return 11
    if note == "B#":
        return 0
    if note == "E#":
        return 5
    if note == "Fb":
        return 4
    raise ValueError(f"Unknown note: {note}")


def _note_name(index: int, use_flats: bool = False) -> str:
    chromatic = CHROMATIC_FLAT if use_flats else CHROMATIC
    return chromatic[index % 12]


def _major_scale(root: str) -> list[str]:
    use_flats = "b" in root or root in ("F",)
    root_idx = _note_index(root)
    return [_note_name(root_idx + i, use_flats) for i in MAJOR_INTERVALS]


@router.get("/modes", response_model=list[ModeInfo])
async def get_modes():
    """Return reference data for all 7 modes."""
    return MODES


@router.get("/secondary-dominants/{key}", response_model=list[SecondaryDominant])
async def get_secondary_dominants(key: str):
    """Return all secondary dominants for a given key."""
    try:
        root_idx = _note_index(key)
    except ValueError:
        raise HTTPException(400, f"Invalid key: {key}")

    use_flats = "b" in key or key in ("F",)
    scale = _major_scale(key)

    # Diatonic chords in major: I ii iii IV V vi vii°
    diatonic_numerals = ["I", "ii", "iii", "IV", "V", "vi", "vii°"]
    diatonic_qualities = ["", "m", "m", "", "", "m", "dim"]

    dominants: list[SecondaryDominant] = []

    # Secondary dominant = V/x for each diatonic chord except I
    for i in range(1, 7):  # ii through vii
        target_root = scale[i]
        target_name = f"{target_root}{diatonic_qualities[i]}"

        # V of target = a major chord whose root is a P5 above target
        v_root_idx = (_note_index(target_root) + 7) % 12  # P5 above
        v_root = _note_name(v_root_idx, use_flats)

        dominants.append(SecondaryDominant(
            target=target_name,
            chord=f"{v_root}7",
            roman=f"V7/{diatonic_numerals[i]}",
            description=f"The dominant seventh of {target_name} ({diatonic_numerals[i]}). "
                        f"Resolves to {target_name} by creating a temporary tonicization.",
        ))

    return dominants
