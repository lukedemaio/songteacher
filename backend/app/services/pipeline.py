"""Orchestrates the full analysis pipeline: download → stems → transcribe → analyze → tabs."""

import asyncio
import logging
import traceback
from pathlib import Path

from app.core.job_store import job_store
from app.models.schemas import (
    Instrument, Job, JobStatus, NoteEvent, PipelineStage, SongAnalysis, StemInfo,
)
from app.services.audio_extractor import extract_audio
from app.services.transcriber import transcribe_audio, transcribe_stem
from app.services.stem_separator import separate_stems, TRANSCRIBABLE_STEMS
from app.services.analyzer import analyze_midi
from app.services.guitar_tab import notes_to_tab, chords_to_tab

logger = logging.getLogger(__name__)

# All stem types that Demucs produces
_ALL_STEMS = [
    Instrument.vocals, Instrument.drums, Instrument.bass,
    Instrument.guitar, Instrument.piano, Instrument.other,
]


async def run_pipeline(job_id: str, youtube_url: str) -> None:
    """Run the full analysis pipeline for a job."""
    job = job_store.get(job_id)
    if not job:
        return

    try:
        # Stage 1: Download audio (0-15%)
        job_store.update(job_id, status=JobStatus.processing, stage=PipelineStage.downloading, progress=0.05)
        wav_path, title = await extract_audio(youtube_url, job_id)
        job_store.update(job_id, progress=0.15, audio_path=str(wav_path))

        # Stage 2: Separate stems (15-40%)
        job_store.update(job_id, stage=PipelineStage.separating_stems, progress=0.15)
        stems_dir = await asyncio.to_thread(separate_stems, wav_path, job_id)
        job_store.update(job_id, progress=0.40, stems_dir=str(stems_dir))

        # Stage 3: Transcribe (40-55%)
        job_store.update(job_id, stage=PipelineStage.transcribing, progress=0.40)

        # 3a: Transcribe full mix for analyzer (key/chord detection works best on full mix)
        notes, midi_path, duration = await asyncio.to_thread(
            transcribe_audio, wav_path, job_id
        )
        job_store.update(job_id, progress=0.45)

        # 3b: Transcribe each melodic stem
        per_instrument_notes: dict[Instrument, list[NoteEvent]] = {}
        stem_infos: list[StemInfo] = []

        for i, instrument in enumerate(_ALL_STEMS):
            stem_wav = stems_dir / f"{instrument.value}.wav"
            audio_available = stem_wav.exists()

            if instrument in TRANSCRIBABLE_STEMS and audio_available:
                try:
                    stem_notes, _ = await asyncio.to_thread(
                        transcribe_stem, stem_wav, job_id, instrument
                    )
                    per_instrument_notes[instrument] = stem_notes
                except Exception as e:
                    logger.warning("Failed to transcribe stem %s: %s", instrument.value, e)
                    per_instrument_notes[instrument] = []
            else:
                per_instrument_notes[instrument] = []

            stem_notes_list = per_instrument_notes.get(instrument, [])
            stem_infos.append(StemInfo(
                instrument=instrument,
                has_notes=len(stem_notes_list) > 0,
                note_count=len(stem_notes_list),
                audio_available=audio_available,
            ))

            progress = 0.45 + (i + 1) / len(_ALL_STEMS) * 0.10
            job_store.update(job_id, progress=round(progress, 2))

        # Add full_mix stem info
        stem_infos.append(StemInfo(
            instrument=Instrument.full_mix,
            has_notes=len(notes) > 0,
            note_count=len(notes),
            audio_available=True,
        ))

        job_store.update(job_id, progress=0.55)

        # Stage 4: Music theory analysis (55-80%) — uses full-mix MIDI
        job_store.update(job_id, stage=PipelineStage.analyzing, progress=0.55)
        key, key_confidence, mode, tempo, time_sig, chords, annotations, sections, scale_notes, chord_summary, common_progressions = (
            await asyncio.to_thread(analyze_midi, midi_path, notes, duration)
        )
        job_store.update(job_id, progress=0.80)

        # Stage 5: Guitar tabs (80-95%) — prefer guitar stem notes
        job_store.update(job_id, stage=PipelineStage.generating_tabs, progress=0.80)
        guitar_stem_notes = per_instrument_notes.get(Instrument.guitar, [])
        tab_source_notes = guitar_stem_notes if guitar_stem_notes else notes
        guitar_tab_notes = await asyncio.to_thread(notes_to_tab, tab_source_notes)
        guitar_tab_chords = await asyncio.to_thread(chords_to_tab, chords)
        job_store.update(job_id, progress=0.95)

        # Stage 6: Assemble result
        result = SongAnalysis(
            title=title,
            duration=duration,
            key=key,
            key_confidence=key_confidence,
            mode=mode,
            tempo=tempo,
            time_signature=time_sig,
            notes=notes,
            chords=chords,
            guitar_tab_notes=guitar_tab_notes,
            guitar_tab_chords=guitar_tab_chords,
            theory_annotations=annotations,
            sections=sections,
            scale_notes=scale_notes,
            chord_summary=chord_summary,
            common_progressions=common_progressions,
            stems=stem_infos,
            piano_notes=per_instrument_notes.get(Instrument.piano, []),
            guitar_notes=per_instrument_notes.get(Instrument.guitar, []),
            bass_notes=per_instrument_notes.get(Instrument.bass, []),
            other_notes=per_instrument_notes.get(Instrument.other, []),
        )

        job_store.update(
            job_id,
            status=JobStatus.completed,
            stage=PipelineStage.done,
            progress=1.0,
            result=result,
        )
        logger.info("Pipeline completed for job %s: %s", job_id, title)

    except Exception as e:
        logger.error("Pipeline failed for job %s: %s\n%s", job_id, e, traceback.format_exc())
        job_store.update(
            job_id,
            status=JobStatus.failed,
            error=str(e),
        )
