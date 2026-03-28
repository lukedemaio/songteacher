"""Download audio from YouTube and convert to WAV using yt-dlp + ffmpeg."""

import asyncio
import logging
import subprocess
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


async def extract_audio(youtube_url: str, job_id: str) -> tuple[Path, str]:
    """Download YouTube audio and convert to WAV.

    Returns (wav_path, video_title).
    """
    settings.ensure_dirs()
    output_template = str(settings.audio_dir / f"{job_id}.%(ext)s")
    wav_path = settings.audio_dir / f"{job_id}.wav"

    # Download best audio with yt-dlp
    yt_cmd = [
        "yt-dlp",
        "--no-playlist",
        "--extract-audio",
        "--audio-format", "wav",
        "--audio-quality", "0",
        "--max-downloads", "1",
        "--max-filesize", "100M",
        "--output", output_template,
        "--print", "title",
        "--no-warnings",
        youtube_url,
    ]

    logger.info("Downloading audio: %s", youtube_url)
    proc = await asyncio.create_subprocess_exec(
        *yt_cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        error_msg = stderr.decode().strip()
        raise RuntimeError(f"yt-dlp failed: {error_msg}")

    title = stdout.decode().strip().split("\n")[0]

    # If yt-dlp didn't output wav directly, convert with ffmpeg
    if not wav_path.exists():
        # Find whatever file yt-dlp created
        candidates = list(settings.audio_dir.glob(f"{job_id}.*"))
        if not candidates:
            raise RuntimeError("No audio file found after download")
        source = candidates[0]
        ffmpeg_cmd = [
            "ffmpeg", "-y", "-i", str(source),
            "-ar", "22050", "-ac", "1",
            str(wav_path),
        ]
        ffproc = await asyncio.create_subprocess_exec(
            *ffmpeg_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await ffproc.communicate()
        if ffproc.returncode != 0:
            raise RuntimeError("ffmpeg conversion failed")
        # Clean up source if different from wav
        if source != wav_path:
            source.unlink(missing_ok=True)
    else:
        # Ensure mono 22050Hz for Basic Pitch
        tmp_path = settings.audio_dir / f"{job_id}_tmp.wav"
        ffmpeg_cmd = [
            "ffmpeg", "-y", "-i", str(wav_path),
            "-ar", "22050", "-ac", "1",
            str(tmp_path),
        ]
        ffproc = await asyncio.create_subprocess_exec(
            *ffmpeg_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await ffproc.communicate()
        if ffproc.returncode == 0:
            tmp_path.replace(wav_path)
        else:
            tmp_path.unlink(missing_ok=True)

    logger.info("Audio extracted: %s (%.1f MB)", wav_path, wav_path.stat().st_size / 1e6)
    return wav_path, title
