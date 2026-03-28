"""Tests for API endpoints using httpx TestClient."""
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_get_modes(client):
    resp = await client.get("/api/theory/modes")
    assert resp.status_code == 200
    modes = resp.json()
    assert len(modes) == 7
    assert modes[0]["name"] == "Ionian (Major)"


@pytest.mark.asyncio
async def test_secondary_dominants_c(client):
    resp = await client.get("/api/theory/secondary-dominants/C")
    assert resp.status_code == 200
    dominants = resp.json()
    assert len(dominants) == 6
    v_of_v = next(d for d in dominants if d["roman"] == "V7/V")
    assert v_of_v["chord"] == "D7"
    assert v_of_v["target"] == "G"


@pytest.mark.asyncio
async def test_secondary_dominants_invalid_key(client):
    resp = await client.get("/api/theory/secondary-dominants/X")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_analyze_invalid_url(client):
    resp = await client.post("/api/analyze", json={"youtube_url": "not-a-url"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_analyze_empty_url(client):
    resp = await client.post("/api/analyze", json={"youtube_url": ""})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_analyze_creates_job(client):
    with patch("app.routers.jobs.run_pipeline", new_callable=AsyncMock):
        resp = await client.post("/api/analyze", json={"youtube_url": "https://youtube.com/watch?v=test"})
    assert resp.status_code == 200
    data = resp.json()
    assert "job_id" in data
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_get_job_status(client):
    with patch("app.routers.jobs.run_pipeline", new_callable=AsyncMock):
        resp = await client.post("/api/analyze", json={"youtube_url": "https://youtube.com/watch?v=test"})
    job_id = resp.json()["job_id"]

    resp = await client.get(f"/api/jobs/{job_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == job_id


@pytest.mark.asyncio
async def test_get_nonexistent_job(client):
    resp = await client.get("/api/jobs/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_audio_no_job(client):
    resp = await client.get("/api/jobs/nonexistent/audio")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_audio_not_ready(client):
    with patch("app.routers.jobs.run_pipeline", new_callable=AsyncMock):
        resp = await client.post("/api/analyze", json={"youtube_url": "https://youtube.com/watch?v=test"})
    job_id = resp.json()["job_id"]
    resp = await client.get(f"/api/jobs/{job_id}/audio")
    assert resp.status_code == 404
