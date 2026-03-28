"""Tests for guitar tab generation."""
from app.models.schemas import ChordEvent, ChordFunction, NoteEvent
from app.services.guitar_tab import (
    CHORD_VOICINGS, _pitch_to_fret_options, _simplify_chord_name,
    chords_to_tab, notes_to_tab,
)


def test_pitch_to_fret_options_middle_c():
    # MIDI 60 = C4, should be playable on guitar
    options = _pitch_to_fret_options(60)
    assert len(options) > 0
    # All should be valid string/fret combos
    for string, fret in options:
        assert 1 <= string <= 6
        assert 0 <= fret <= 22


def test_pitch_to_fret_options_open_e():
    # MIDI 40 = E2 = open low E string
    options = _pitch_to_fret_options(40)
    assert (6, 0) in options  # string 6, fret 0


def test_pitch_to_fret_options_too_low():
    # MIDI 30 is below guitar range
    options = _pitch_to_fret_options(30)
    assert len(options) == 0


def test_pitch_to_fret_options_too_high():
    # MIDI 100 is above standard guitar range
    options = _pitch_to_fret_options(100)
    assert len(options) == 0


def test_notes_to_tab_basic():
    notes = [
        NoteEvent(pitch=60, start_time=0.0, end_time=0.5, name="C4"),
        NoteEvent(pitch=62, start_time=0.5, end_time=1.0, name="D4"),
        NoteEvent(pitch=64, start_time=1.0, end_time=1.5, name="E4"),
    ]
    tab = notes_to_tab(notes)
    assert len(tab) == 3
    for t in tab:
        assert 1 <= t.string <= 6
        assert t.fret >= 0


def test_notes_to_tab_empty():
    assert notes_to_tab([]) == []


def test_notes_to_tab_preserves_timing():
    notes = [NoteEvent(pitch=64, start_time=1.5, end_time=2.0, name="E4")]
    tab = notes_to_tab(notes)
    assert tab[0].start_time == 1.5
    assert tab[0].end_time == 2.0


def test_simplify_chord_name_direct():
    assert _simplify_chord_name("Am") == "Am"
    assert _simplify_chord_name("G") == "G"
    assert _simplify_chord_name("C7") == "C7"


def test_simplify_chord_name_music21_format():
    result = _simplify_chord_name("A minor triad")
    assert result == "Am"

    result = _simplify_chord_name("C major triad")
    assert result == "C"

    result = _simplify_chord_name("G dominant seventh chord")
    assert result == "G7"


def test_chords_to_tab():
    chords = [
        ChordEvent(name="Am", start_time=0.0, end_time=2.0, function=ChordFunction.tonic),
        ChordEvent(name="G", start_time=2.0, end_time=4.0, function=ChordFunction.other),
    ]
    tab = chords_to_tab(chords)
    assert len(tab) == 2
    assert tab[0].name == "Am"
    assert tab[0].frets == CHORD_VOICINGS["Am"]
    assert tab[1].name == "G"


def test_chords_to_tab_preserves_timing():
    chords = [ChordEvent(name="C", start_time=5.0, end_time=7.0)]
    tab = chords_to_tab(chords)
    assert tab[0].start_time == 5.0
    assert tab[0].end_time == 7.0
