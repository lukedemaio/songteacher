"""Tests for theory reference endpoints."""
from app.routers.theory import _major_scale, _note_index, _note_name


def test_note_index():
    assert _note_index("C") == 0
    assert _note_index("D") == 2
    assert _note_index("E") == 4
    assert _note_index("F") == 5
    assert _note_index("G") == 7
    assert _note_index("A") == 9
    assert _note_index("B") == 11


def test_note_index_sharps():
    assert _note_index("C#") == 1
    assert _note_index("F#") == 6


def test_note_index_flats():
    assert _note_index("Db") == 1
    assert _note_index("Bb") == 10
    assert _note_index("Eb") == 3


def test_note_name():
    assert _note_name(0) == "C"
    assert _note_name(7) == "G"
    assert _note_name(12) == "C"  # wraps


def test_note_name_flats():
    assert _note_name(1, use_flats=True) == "Db"
    assert _note_name(1, use_flats=False) == "C#"


def test_major_scale_c():
    scale = _major_scale("C")
    assert scale == ["C", "D", "E", "F", "G", "A", "B"]


def test_major_scale_g():
    scale = _major_scale("G")
    assert scale == ["G", "A", "B", "C", "D", "E", "F#"]


def test_major_scale_f():
    # F major uses flats
    scale = _major_scale("F")
    assert scale == ["F", "G", "A", "Bb", "C", "D", "E"]
