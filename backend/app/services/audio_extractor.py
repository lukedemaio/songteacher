"""Download audio from YouTube and convert to WAV using yt-dlp + ffmpeg."""

import asyncio
import logging
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


def _download_audio(youtube_url: str, job_id: str) -> tuple[Path, str]:
    """Synchronous download using yt-dlp Python API."""
    import yt_dlp

    settings.ensure_dirs()
    wav_path = settings.audio_dir / f"{job_id}.wav"

    info = {"title": "Unknown"}

    def _progress_hook(d: dict) -> None:
        if d.get("status") == "finished":
            logger.info("Download finished, converting...")

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": str(settings.audio_dir / f"{job_id}.%(ext)s"),
        "noplaylist": True,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "wav",
            "preferredquality": "0",
        }],
        "progress_hooks": [_progress_hook],
        "quiet": True,
        "no_warnings": True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(youtube_url, download=True)

    title = info.get("title", "Unknown")

    # yt-dlp should have created the wav file
    if not wav_path.exists():
        # Try to find whatever was created and convert
        candidates = list(settings.audio_dir.glob(f"{job_id}.*"))
        candidates = [c for c in candidates if c.suffix != ".wav"]
        if not candidates:
            raise RuntimeError("No audio file found after download")
        source = candidates[0]
        logger.info("Converting %s to WAV", source.name)
        import subprocess
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", str(source), "-ar", "22050", "-ac", "1", str(wav_path)],
            capture_output=True, text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg conversion failed: {result.stderr[:500]}")
        source.unlink(missing_ok=True)
    else:
        # Resample to mono 22050Hz for Basic Pitch
        tmp_path = settings.audio_dir / f"{job_id}_tmp.wav"
        import subprocess
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", str(wav_path), "-ar", "22050", "-ac", "1", str(tmp_path)],
            capture_output=True, text=True,
        )
        if result.returncode == 0:
            tmp_path.replace(wav_path)
        else:
            tmp_path.unlink(missing_ok=True)

    logger.info("Audio extracted: %s (%.1f MB)", wav_path, wav_path.stat().st_size / 1e6)
    return wav_path, title


async def extract_audio(youtube_url: str, job_id: str) -> tuple[Path, str]:
    """Download YouTube audio and convert to WAV.

    Returns (wav_path, video_title).
    """
    logger.info("Downloading audio: %s", youtube_url)
    return await asyncio.to_thread(_download_audio, youtube_url, job_id)
