"""Job management endpoints: create analysis, get status, stream audio."""

import asyncio
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.core.job_store import job_store
from app.models.schemas import AnalyzeRequest, AnalyzeResponse, Instrument, JobStatus, JobStatusResponse
from app.services.pipeline import run_pipeline

router = APIRouter(prefix="/api", tags=["jobs"])


@router.post("/analyze", response_model=AnalyzeResponse)
async def create_analysis(request: AnalyzeRequest):
    """Start a new song analysis job."""
    url = request.youtube_url.strip()
    if not url:
        raise HTTPException(400, "youtube_url is required")

    # Basic URL validation
    if not any(domain in url for domain in ["youtube.com", "youtu.be", "music.youtube.com"]):
        raise HTTPException(400, "Invalid YouTube URL")

    job = job_store.create(url)

    # Launch pipeline in background
    asyncio.create_task(run_pipeline(job.id, url))

    return AnalyzeResponse(job_id=job.id, status=job.status)


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """Get the current status of an analysis job."""
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    return JobStatusResponse(
        id=job.id,
        status=job.status,
        stage=job.stage,
        progress=job.progress,
        result=job.result,
        error=job.error,
    )


@router.get("/jobs/{job_id}/audio")
async def get_job_audio(job_id: str):
    """Stream the extracted audio file for playback."""
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    if not job.audio_path:
        raise HTTPException(404, "Audio not yet available")

    audio_path = Path(job.audio_path)
    if not audio_path.exists():
        raise HTTPException(404, "Audio file not found")

    return FileResponse(
        audio_path,
        media_type="audio/wav",
        filename=f"{job_id}.wav",
    )


@router.get("/jobs/{job_id}/audio/{stem}")
async def get_stem_audio(job_id: str, stem: str):
    """Stream a separated instrument stem audio file."""
    # Validate stem name
    try:
        instrument = Instrument(stem)
    except ValueError:
        raise HTTPException(400, f"Invalid stem: {stem}")

    job = job_store.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    if not job.stems_dir:
        raise HTTPException(404, "Stems not yet available")

    stem_path = Path(job.stems_dir) / f"{instrument.value}.wav"
    if not stem_path.exists():
        raise HTTPException(404, f"Stem audio not found: {stem}")

    return FileResponse(
        stem_path,
        media_type="audio/wav",
        filename=f"{job_id}_{instrument.value}.wav",
    )
