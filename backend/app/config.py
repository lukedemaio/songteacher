from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    audio_dir: Path = Path("/tmp/songteacher/audio")
    midi_dir: Path = Path("/tmp/songteacher/midi")
    stems_dir: Path = Path("/tmp/songteacher/stems")
    max_duration_seconds: int = 600  # 10 min max
    basic_pitch_model: str = "basic_pitch"

    model_config = {"env_prefix": "ST_"}

    def ensure_dirs(self) -> None:
        self.audio_dir.mkdir(parents=True, exist_ok=True)
        self.midi_dir.mkdir(parents=True, exist_ok=True)
        self.stems_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
