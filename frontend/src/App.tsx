import { useCallback, useEffect, useMemo, useState } from "react";
import { getAudioUrl, getStemAudioUrl } from "./api/client";
import { useAnalysisJob } from "./hooks/useAnalysisJob";
import { usePlayback } from "./hooks/usePlayback";
import { UrlInput } from "./components/UrlInput";
import { LoadingProgress } from "./components/LoadingProgress";
import { SongInfo } from "./components/SongInfo";
import { PlaybackControls } from "./components/PlaybackControls";
import { StemSelector } from "./components/StemSelector";
import { ChordTimeline } from "./components/ChordTimeline";
import { PianoRoll } from "./components/PianoRoll";
import { GuitarTab } from "./components/GuitarTab";
import { GuitarFretboard } from "./components/GuitarFretboard";
import { TheoryPanel } from "./components/TheoryPanel";
import { TheoryDrilldown } from "./components/TheoryDrilldown";
import { QuickReference } from "./components/QuickReference";
import { ActiveChord } from "./components/ActiveChord";
import type { Instrument, TheoryAnnotation } from "./types";

function App() {
  const { submit, job, jobId, loading, error } = useAnalysisJob();
  const playback = usePlayback();
  const [drilldownAnnotation, setDrilldownAnnotation] = useState<TheoryAnnotation | null>(null);
  const [activeStem, setActiveStem] = useState<Instrument>("full_mix");

  const analysis = job?.result ?? null;
  const isProcessing = loading && job?.status !== "completed";

  // Load audio when job completes
  useEffect(() => {
    if (job?.status === "completed" && jobId) {
      playback.loadAudio(getAudioUrl(jobId));
    }
  }, [job?.status, jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSeek = useCallback(
    (time: number) => playback.seek(time),
    [playback]
  );

  const handleStemChange = useCallback(
    (stem: Instrument) => {
      if (!jobId) return;
      setActiveStem(stem);
      const url = stem === "full_mix"
        ? getAudioUrl(jobId)
        : getStemAudioUrl(jobId, stem);
      playback.loadStemAudio(url);
    },
    [jobId, playback]
  );

  const pianoRollNotes = useMemo(() => {
    if (!analysis) return [];
    switch (activeStem) {
      case "piano": return analysis.piano_notes;
      case "guitar": return analysis.guitar_notes;
      case "bass": return analysis.bass_notes;
      case "other": return analysis.other_notes;
      default: return analysis.notes;
    }
  }, [analysis, activeStem]);

  const pianoRollEmptyMessage = activeStem !== "full_mix"
    ? `No ${activeStem} notes detected`
    : undefined;

  const guitarTabEmptyMessage = analysis && !analysis.guitar_tab_notes.length
    ? "No guitar notes detected"
    : undefined;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4">
        <h1 className="text-2xl font-bold text-white">
          Song<span className="text-indigo-400">Teacher</span>
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Paste a YouTube URL to get an interactive music theory breakdown
        </p>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* URL Input */}
        <UrlInput onSubmit={submit} loading={loading} />

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {isProcessing && job && (
          <LoadingProgress stage={job.stage} progress={job.progress} />
        )}

        {/* Results */}
        {analysis && (
          <div className="space-y-4">
            {/* Song info (with inline scale notes) */}
            <SongInfo analysis={analysis} />

            {/* Quick reference */}
            <QuickReference analysis={analysis} />

            {/* Playback controls (with speed selector) */}
            <PlaybackControls
              isPlaying={playback.isPlaying}
              currentTime={playback.currentTime}
              duration={playback.duration || analysis.duration}
              isLoaded={playback.isLoaded}
              playbackRate={playback.playbackRate}
              onTogglePlay={playback.togglePlay}
              onSeek={handleSeek}
              onPlaybackRateChange={playback.setPlaybackRate}
            />

            {/* Stem selector */}
            {analysis.stems.length > 0 && (
              <StemSelector
                stems={analysis.stems}
                activeStem={activeStem}
                onStemChange={handleStemChange}
              />
            )}

            {/* Active chord display */}
            <ActiveChord
              chords={analysis.chords}
              currentTime={playback.currentTime}
              subscribe={playback.subscribe}
            />

            {/* Chord timeline */}
            <ChordTimeline
              chords={analysis.chords}
              currentTime={playback.currentTime}
              duration={playback.duration || analysis.duration}
              onSeek={handleSeek}
              subscribe={playback.subscribe}
            />

            {/* Piano roll (vertical) */}
            <PianoRoll
              notes={pianoRollNotes}
              currentTime={playback.currentTime}
              duration={playback.duration || analysis.duration}
              onSeek={handleSeek}
              subscribe={playback.subscribe}
              emptyMessage={pianoRollEmptyMessage}
            />

            {/* Guitar section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <GuitarTab
                  tabNotes={analysis.guitar_tab_notes}
                  currentTime={playback.currentTime}
                  duration={playback.duration || analysis.duration}
                  onSeek={handleSeek}
                  subscribe={playback.subscribe}
                  emptyMessage={guitarTabEmptyMessage}
                />
              </div>
              <div>
                <GuitarFretboard
                  chords={analysis.guitar_tab_chords}
                  currentTime={playback.currentTime}
                />
              </div>
            </div>

            {/* Theory panel */}
            <TheoryPanel
              annotations={analysis.theory_annotations}
              currentTime={playback.currentTime}
              onSeek={handleSeek}
              onDrilldown={setDrilldownAnnotation}
            />
          </div>
        )}

        {/* Theory drilldown modal */}
        {drilldownAnnotation && analysis && (
          <TheoryDrilldown
            annotation={drilldownAnnotation}
            songKey={analysis.key}
            onClose={() => setDrilldownAnnotation(null)}
          />
        )}
      </main>
    </div>
  );
}

export default App;
