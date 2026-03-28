"""Transcribe WAV audio to MIDI notes using Spotify Basic Pitch."""

import logging
from pathlib import Path

import numpy as np
import pretty_midi

from app.config import settings
from app.models.schemas import NoteEvent

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
