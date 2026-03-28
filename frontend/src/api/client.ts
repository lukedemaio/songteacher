import type { AnalyzeResponse, JobStatusResponse, ModeInfo, SecondaryDominant } from "../types";

const BASE = "/api";

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

export function startAnalysis(youtubeUrl: string): Promise<AnalyzeResponse> {
  return fetchJSON<AnalyzeResponse>(`${BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ youtube_url: youtubeUrl }),
  });
}

export function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  return fetchJSON<JobStatusResponse>(`${BASE}/jobs/${jobId}`);
}

export function getAudioUrl(jobId: string): string {
  return `${BASE}/jobs/${jobId}/audio`;
}

export function getStemAudioUrl(jobId: string, stem: string): string {
  return `${BASE}/jobs/${jobId}/audio/${stem}`;
}

export function getModes(): Promise<ModeInfo[]> {
  return fetchJSON<ModeInfo[]>(`${BASE}/theory/modes`);
}

export function getSecondaryDominants(key: string): Promise<SecondaryDominant[]> {
  return fetchJSON<SecondaryDominant[]>(`${BASE}/theory/secondary-dominants/${encodeURIComponent(key)}`);
}
