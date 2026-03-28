"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import jobs, theory

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure directories exist and preload models
    settings.ensure_dirs()
    logger.info("SongTeacher backend starting up")
    logger.info("Audio dir: %s", settings.audio_dir)

    # Preload Basic Pitch model in background to avoid first-request latency
    try:
        import basic_pitch  # noqa: F401
        logger.info("Basic Pitch model loaded")
    except ImportError:
        logger.warning("Basic Pitch not installed — transcription will fail")

    yield

    logger.info("SongTeacher backend shutting down")


app = FastAPI(
    title="SongTeacher",
    description="YouTube to Music Theory analysis API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs.router)
app.include_router(theory.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
