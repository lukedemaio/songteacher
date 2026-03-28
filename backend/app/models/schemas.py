from __future__ import annotations

from enum import Enum
from pydantic import BaseModel, Field


# --- Enums ---

class JobStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class PipelineStage(str, Enum):
    downloading = "downloading"
    transcribing = "transcribing"
    analyzing = "analyzing"
    generating_tabs = "generating_tabs"
    done = "done"


class ChordFunction(str, Enum):
    tonic = "tonic"
    subdominant = "subdominant"
    dominant = "dominant"
    secondary = "secondary"
    borrowed = "borrowed"
    other = "other"


# --- Request ---

class AnalyzeRequest(BaseModel):
    youtube_url: str


# --- Data models ---

class NoteEvent(BaseModel):
    pitch: int = Field(description="MIDI pitch (0-127)")
    start_time: float = Field(description="Start time in seconds")
    end_time: float = Field(description="End time in seconds")
    velocity: int = Field(default=100, description="MIDI velocity (0-127)")
    name: str = Field(default="", description="Note name like C4, D#5")


class ChordEvent(BaseModel):
    name: str = Field(description="Chord name like Am, G7, Cmaj7")
    roman_numeral: str = Field(default="", description="Roman numeral like vi, V7, I")
    function: ChordFunction = ChordFunction.other
    start_time: float
    end_time: float
    notes: list[str] = Field(default_factory=list, description="Pitch classes in chord")


class GuitarTabNote(BaseModel):
    string: int = Field(description="Guitar string 1-6 (1=high E)")
    fret: int = Field(description="Fret number (0=open)")
    start_time: float
    end_time: float
    pitch: int = Field(description="MIDI pitch")


class GuitarTabChord(BaseModel):
    name: str
    frets: list[int] = Field(description="6 fret numbers, -1 = muted, 0 = open")
    start_time: float
    end_time: float


class TheoryAnnotation(BaseModel):
    time: float = Field(description="Time position in seconds")
    title: str
    description: str
    category: str = Field(default="general", description="e.g. modulation, cadence, borrowed_chord")
    detail: str = Field(default="", description="Extended explanation for drill-down")


class SongSection(BaseModel):
    name: str = Field(description="e.g. Intro, Verse, Chorus")
    start_time: float
    end_time: float


class SongAnalysis(BaseModel):
    title: str = ""
    duration: float = 0.0
    key: str = ""
    key_confidence: float = 0.0
    mode: str = ""
    tempo: float = 120.0
    time_signature: str = "4/4"
    notes: list[NoteEvent] = Field(default_factory=list)
    chords: list[ChordEvent] = Field(default_factory=list)
    guitar_tab_notes: list[GuitarTabNote] = Field(default_factory=list)
    guitar_tab_chords: list[GuitarTabChord] = Field(default_factory=list)
    theory_annotations: list[TheoryAnnotation] = Field(default_factory=list)
    sections: list[SongSection] = Field(default_factory=list)


# --- Job ---

class Job(BaseModel):
    id: str
    status: JobStatus = JobStatus.pending
    stage: PipelineStage = PipelineStage.downloading
    progress: float = 0.0
    result: SongAnalysis | None = None
    error: str | None = None
    audio_path: str | None = None


# --- API responses ---

class AnalyzeResponse(BaseModel):
    job_id: str
    status: JobStatus


class JobStatusResponse(BaseModel):
    id: str
    status: JobStatus
    stage: PipelineStage
    progress: float
    result: SongAnalysis | None = None
    error: str | None = None


# --- Theory reference ---

class ModeInfo(BaseModel):
    name: str
    scale_degrees: list[str]
    intervals: list[str]
    character: str
    example_songs: list[str] = Field(default_factory=list)


class SecondaryDominant(BaseModel):
    target: str
    chord: str
    roman: str
    description: str
