"""Transcribe WAV audio to MIDI notes using Spotify Basic Pitch."""

import logging
from pathlib import Path

import numpy as np
import pretty_midi

from app.config import settings
from app.models.schemas import Instrument, NoteEvent

logger = logging.getLogger(__name__)

# Pitch name lookup
_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def midi_pitch_to_name(pitch: int) -> str:
    octave = (pitch // 12) - 1
    note = _NOTE_NAMES[pitch % 12]
    return f"{note}{octave}"


def transcribe_audio(wav_path: Path, job_id: str) -> tuple[list[NoteEvent], Path, float]:
    """Transcribe WAV to note events using Basic Pitch.

    Returns (note_events, midi_path, duration).
    """
    from basic_pitch.inference import predict

    logger.info("Transcribing: %s", wav_path)

    # Run Basic Pitch inference
    model_output, midi_data, note_events = predict(
        str(wav_path),
        onset_threshold=0.5,
        frame_threshold=0.3,
        minimum_note_length=58,  # ms
        minimum_frequency=65.0,  # C2
        maximum_frequency=2100.0,  # C7
    )

    # Save MIDI file
    settings.ensure_dirs()
    midi_path = settings.midi_dir / f"{job_id}.mid"
    midi_data.write(str(midi_path))

    # Convert to our NoteEvent format
    notes: list[NoteEvent] = []
    for instrument in midi_data.instruments:
        for note in instrument.notes:
            notes.append(NoteEvent(
                pitch=note.pitch,
                start_time=round(note.start, 3),
                end_time=round(note.end, 3),
                velocity=note.velocity,
                name=midi_pitch_to_name(note.pitch),
            ))

    # Sort by start time
    notes.sort(key=lambda n: (n.start_time, n.pitch))

    duration = midi_data.get_end_time()
    logger.info("Transcribed %d notes, duration %.1fs", len(notes), duration)
    return notes, midi_path, duration


# Instrument-specific frequency ranges for better transcription accuracy
_INSTRUMENT_FREQ_RANGES: dict[Instrument, tuple[float, float]] = {
    Instrument.bass: (30.0, 1000.0),      # C1 to ~B4
    Instrument.guitar: (65.0, 2100.0),     # C2 to C7 (default)
    Instrument.piano: (27.5, 4200.0),      # A0 to C8
    Instrument.other: (65.0, 2100.0),      # default range
}


_INSTRUMENT_THRESHOLDS: dict[Instrument, dict] = {
    Instrument.bass: {
        "onset_threshold": 0.6,
        "frame_threshold": 0.3,
        "minimum_note_length": 100,
    },
    Instrument.guitar: {
        "onset_threshold": 0.5,
        "frame_threshold": 0.25,
        "minimum_note_length": 50,
    },
    Instrument.piano: {
        "onset_threshold": 0.5,
        "frame_threshold": 0.3,
        "minimum_note_length": 58,
    },
}


def transcribe_stem(
    wav_path: Path, job_id: str, instrument: Instrument
) -> tuple[list[NoteEvent], Path]:
    """Transcribe a single instrument stem to note events.

    Uses instrument-specific frequency ranges and thresholds for better accuracy.
    Returns (note_events, midi_path).
    """
    from basic_pitch.inference import predict

    min_freq, max_freq = _INSTRUMENT_FREQ_RANGES.get(instrument, (65.0, 2100.0))
    thresholds = _INSTRUMENT_THRESHOLDS.get(instrument, {})
    onset_threshold = thresholds.get("onset_threshold", 0.5)
    frame_threshold = thresholds.get("frame_threshold", 0.3)
    min_note_length = thresholds.get("minimum_note_length", 58)

    logger.info("Transcribing stem %s: %s (freq range %.0f-%.0fHz, onset=%.2f, frame=%.2f, min_note=%dms)",
                instrument.value, wav_path, min_freq, max_freq,
                onset_threshold, frame_threshold, min_note_length)

    model_output, midi_data, note_events = predict(
        str(wav_path),
        onset_threshold=onset_threshold,
        frame_threshold=frame_threshold,
        minimum_note_length=min_note_length,
        minimum_frequency=min_freq,
        maximum_frequency=max_freq,
    )

    # Save per-stem MIDI
    settings.ensure_dirs()
    midi_path = settings.midi_dir / f"{job_id}_{instrument.value}.mid"
    midi_data.write(str(midi_path))

    # Convert to NoteEvent with instrument tag
    notes: list[NoteEvent] = []
    for inst in midi_data.instruments:
        for note in inst.notes:
            notes.append(NoteEvent(
                pitch=note.pitch,
                start_time=round(note.start, 3),
                end_time=round(note.end, 3),
                velocity=note.velocity,
                name=midi_pitch_to_name(note.pitch),
                instrument=instrument,
            ))

    notes.sort(key=lambda n: (n.start_time, n.pitch))
    logger.info("Transcribed %d notes for stem %s", len(notes), instrument.value)
    return notes, midi_path
