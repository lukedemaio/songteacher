"""Separate audio into instrument stems using Meta's Demucs."""

import logging
import shutil
import subprocess
from pathlib import Path

from app.config import settings
from app.models.schemas import Instrument

logger = logging.getLogger(__name__)

# Stems that contain melodic content worth transcribing
TRANSCRIBABLE_STEMS = {Instrument.bass, Instrument.guitar, Instrument.piano, Instrument.other}

# Map Demucs output directory names to our Instrument enum
_DEMUCS_STEM_MAP = {
    "vocals": Instrument.vocals,
    "drums": Instrument.drums,
    "bass": Instrument.bass,
    "guitar": Instrument.guitar,
    "piano": Instrument.piano,
    "other": Instrument.other,
}


def separate_stems(wav_path: Path, job_id: str) -> Path:
    """Run Demucs 6-stem separation on the audio file.

    Returns the directory containing separated stem WAV files.
    """
    settings.ensure_dirs()
    job_stems_dir = settings.stems_dir / job_id
    job_stems_dir.mkdir(parents=True, exist_ok=True)

    # Run Demucs via subprocess to isolate torch memory usage
    logger.info("Running Demucs stem separation on %s", wav_path)
    demucs_out = settings.stems_dir / f"{job_id}_raw"

    result = subprocess.run(
        [
            "python", "-m", "demucs",
            "-n", "htdemucs_6s",
            "--out", str(demucs_out),
            str(wav_path),
        ],
        capture_output=True,
        text=True,
        timeout=600,  # 10 minute timeout
    )

    if result.returncode != 0:
        logger.error("Demucs failed: %s", result.stderr)
        raise RuntimeError(f"Demucs stem separation failed: {result.stderr[-500:]}")

    # Find the Demucs output directory (htdemucs_6s/<filename_without_ext>/)
    demucs_model_dir = demucs_out / "htdemucs_6s"
    stem_dirs = list(demucs_model_dir.iterdir()) if demucs_model_dir.exists() else []
    if not stem_dirs:
        raise RuntimeError("Demucs produced no output")
    raw_stem_dir = stem_dirs[0]

    # Resample each stem to mono 22050Hz (Basic Pitch requirement) and move to final location
    for stem_file in raw_stem_dir.glob("*.wav"):
        stem_name = stem_file.stem  # e.g. "vocals", "drums", "bass", etc.
        instrument = _DEMUCS_STEM_MAP.get(stem_name)
        if instrument is None:
            logger.warning("Unknown Demucs stem: %s", stem_name)
            continue

        output_path = job_stems_dir / f"{instrument.value}.wav"
        _resample_mono(stem_file, output_path)
        logger.info("Saved stem: %s", output_path)

    # Copy original mix as full_mix.wav
    full_mix_path = job_stems_dir / "full_mix.wav"
    _resample_mono(wav_path, full_mix_path)

    # Clean up raw Demucs output
    shutil.rmtree(demucs_out, ignore_errors=True)

    logger.info("Stem separation complete for job %s", job_id)
    return job_stems_dir


def _resample_mono(input_path: Path, output_path: Path) -> None:
    """Resample audio to mono 22050Hz WAV using ffmpeg."""
    result = subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", str(input_path),
            "-ac", "1",
            "-ar", "22050",
            str(output_path),
        ],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg resample failed: {result.stderr[-300:]}")
