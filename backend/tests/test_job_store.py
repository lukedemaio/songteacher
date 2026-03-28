"""Tests for the in-memory job store."""
from app.core.job_store import JobStore
from app.models.schemas import JobStatus, PipelineStage


def test_create_job():
    store = JobStore()
    job = store.create("https://youtube.com/watch?v=test")
    assert job.id
    assert len(job.id) == 12
    assert job.status == JobStatus.pending


def test_get_job():
    store = JobStore()
    job = store.create("https://youtube.com/watch?v=test")
    retrieved = store.get(job.id)
    assert retrieved is not None
    assert retrieved.id == job.id


def test_get_nonexistent_job():
    store = JobStore()
    assert store.get("nonexistent") is None


def test_update_job():
    store = JobStore()
    job = store.create("https://youtube.com/watch?v=test")
    updated = store.update(job.id, status=JobStatus.processing, stage=PipelineStage.transcribing, progress=0.5)
    assert updated is not None
    assert updated.status == JobStatus.processing
    assert updated.stage == PipelineStage.transcribing
    assert updated.progress == 0.5


def test_update_nonexistent_job():
    store = JobStore()
    assert store.update("nonexistent", status=JobStatus.completed) is None


def test_list_all():
    store = JobStore()
    store.create("url1")
    store.create("url2")
    store.create("url3")
    jobs = store.list_all()
    assert len(jobs) == 3


def test_unique_ids():
    store = JobStore()
    ids = set()
    for _ in range(100):
        job = store.create("url")
        ids.add(job.id)
    assert len(ids) == 100
