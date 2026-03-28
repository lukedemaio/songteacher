import { useCallback, useEffect, useRef, useState } from "react";
import { getJobStatus, startAnalysis } from "../api/client";
import type { JobStatusResponse } from "../types";

export function useAnalysisJob() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const submit = useCallback(
    async (youtubeUrl: string) => {
      setError(null);
      setJob(null);
      setLoading(true);
      stopPolling();

      try {
        const res = await startAnalysis(youtubeUrl);
        setJobId(res.job_id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to start analysis");
        setLoading(false);
      }
    },
    [stopPolling]
  );

  // Poll when we have a jobId
  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      try {
        const status = await getJobStatus(jobId);
        setJob(status);

        if (status.status === "completed" || status.status === "failed") {
          stopPolling();
          setLoading(false);
          if (status.error) setError(status.error);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Polling failed");
        stopPolling();
        setLoading(false);
      }
    };

    // Immediate first poll
    poll();
    intervalRef.current = setInterval(poll, 1000);

    return stopPolling;
  }, [jobId, stopPolling]);

  return { submit, job, jobId, loading, error };
}
