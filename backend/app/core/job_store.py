"""In-memory job store. Swappable to Redis or DB later."""

from __future__ import annotations

import uuid
from typing import Any

from app.models.schemas import Job, JobStatus


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}

    def create(self, youtube_url: str) -> Job:
        job_id = uuid.uuid4().hex[:12]
        job = Job(id=job_id)
        self._jobs[job_id] = job
        return job

    def get(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)

    def update(self, job_id: str, **kwargs: Any) -> Job | None:
        job = self._jobs.get(job_id)
        if not job:
            return None
        for key, value in kwargs.items():
            if hasattr(job, key):
                setattr(job, key, value)
        return job

    def list_all(self) -> list[Job]:
        return list(self._jobs.values())


# Singleton
job_store = JobStore()
