"""Orchestrates the full analysis pipeline: download → transcribe → analyze → tabs."""

import asyncio
import logging
import traceback

from app.core.job_store import job_store
from app.models.schemas import Job, JobStatus, PipelineStage, SongAnalysis
from app.services.audio_extractor import extract_audio
from app.services.transcriber import transcribe_audio
from app.services.analyzer import analyze_midi
from app.services.guitar_tab import notes_to_tab, chords_to_tab

logger = logging.getLogger(__name__)


async def run_pipeline(job_id: str, youtube_url: str) -> None:
    """Run the full analysis pipeline for a job."""
    job = job_store.get(job_id)
    if not job:
        return

    try:
        # Stage 1: Download audio
        job_store.update(job_id, status=JobStatus.processing, stage=PipelineStage.downloading, progress=0.1)
        wav_path, title = await extract_audio(youtube_url, job_id)
        job_store.update(job_id, progress=0.25, audio_path=str(wav_path))

        # Stage 2: Transcribe to MIDI
        job_store.update(job_id, stage=PipelineStage.transcribing, progress=0.3)
        notes, midi_path, duration = await asyncio.to_thread(
            transcribe_audio, wav_path, job_id
        )
        job_store.update(job_id, progress=0.55)

        # Stage 3: Music theory analysis
        job_store.update(job_id, stage=PipelineStage.analyzing, progress=0.6)
        key, key_confidence, mode, tempo, time_sig, chords, annotations, sections, scale_notes, chord_summary, common_progressions = (
            await asyncio.to_thread(analyze_midi, midi_path, notes, duration)
        )
        job_store.update(job_id, progress=0.8)

        # Stage 4: Guitar tabs
        job_store.update(job_id, stage=PipelineStage.generating_tabs, progress=0.85)
        guitar_tab_notes = await asyncio.to_thread(notes_to_tab, notes)
        guitar_tab_chords = await asyncio.to_thread(chords_to_tab, chords)
        job_store.update(job_id, progress=0.95)

        # Assemble result
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
