"""Tests for Pydantic schemas."""
from app.models.schemas import (
    AnalyzeRequest, ChordEvent, ChordFunction, GuitarTabChord, GuitarTabNote,
    Job, JobStatus, NoteEvent, PipelineStage, SongAnalysis, TheoryAnnotation,
)


def test_note_event():
    note = NoteEvent(pitch=60, start_time=0.0, end_time=0.5, velocity=80, name="C4")
    assert note.pitch == 60
    assert note.name == "C4"


def test_chord_event():
    chord = ChordEvent(
        name="Am", roman_numeral="vi", function=ChordFunction.tonic,
        start_time=0.0, end_time=2.0, notes=["A", "C", "E"],
    )
    assert chord.function == ChordFunction.tonic
    assert len(chord.notes) == 3


def test_song_analysis_defaults():
    analysis = SongAnalysis()
    assert analysis.notes == []
    assert analysis.chords == []
    assert analysis.tempo == 120.0
    assert analysis.time_signature == "4/4"


def test_song_analysis_full():
    analysis = SongAnalysis(
        title="Test Song", duration=180.0, key="C", key_confidence=0.9,
        mode="major", tempo=120.0, time_signature="4/4",
        notes=[NoteEvent(pitch=60, start_time=0.0, end_time=0.5)],
        chords=[ChordEvent(name="C", start_time=0.0, end_time=2.0)],
    )
    assert analysis.title == "Test Song"
    assert len(analysis.notes) == 1


def test_job_defaults():
    job = Job(id="abc123")
    assert job.status == JobStatus.pending
    assert job.stage == PipelineStage.downloading
    assert job.result is None


def test_analyze_request():
    req = AnalyzeRequest(youtube_url="https://youtube.com/watch?v=test")
    assert "youtube.com" in req.youtube_url


def test_guitar_tab_note():
    tab = GuitarTabNote(string=1, fret=5, start_time=0.0, end_time=0.5, pitch=69)
    assert tab.string == 1
    assert tab.fret == 5


def test_guitar_tab_chord():
    chord = GuitarTabChord(name="Am", frets=[-1, 0, 2, 2, 1, 0], start_time=0.0, end_time=2.0)
    assert len(chord.frets) == 6
    assert chord.frets[0] == -1  # muted E string
