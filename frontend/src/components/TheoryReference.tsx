import { useRef, useEffect, useState } from "react";
import type { TheoryAnnotation } from "../types";

interface Props {
  annotations: TheoryAnnotation[];
  currentTime: number;
  songKey: string;
  onSeek: (time: number) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  key: "border-emerald-500 bg-emerald-500/10",
  cadence: "border-amber-500 bg-amber-500/10",
  secondary_dominant: "border-purple-500 bg-purple-500/10",
  borrowed_chord: "border-pink-500 bg-pink-500/10",
  general: "border-slate-500 bg-slate-500/10",
};

export function TheoryReference({ annotations, currentTime, songKey, onSeek }: Props) {
  const activeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [drilldownAnnotation, setDrilldownAnnotation] = useState<TheoryAnnotation | null>(null);

  const activeIndex = findActiveIndex(annotations, currentTime);

  useEffect(() => {
    if (isOpen && activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [activeIndex, isOpen]);

  if (!annotations.length) return null;

  return (
    <>
      <div className="bg-slate-800 rounded-xl border border-slate-700">
        {/* Collapsible header */}
        <button
          className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-700/30 transition-colors rounded-xl"
          onClick={() => setIsOpen(!isOpen)}
        >
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide">
            Theory Reference
          </h3>
          <svg
            className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Collapsible content */}
        {isOpen && (
          <div className="px-4 pb-4">
            <div ref={containerRef} className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {annotations.map((ann, i) => {
                const isActive = i === activeIndex;
                const colors = CATEGORY_COLORS[ann.category] || CATEGORY_COLORS.general;

                return (
                  <div
                    key={i}
                    ref={isActive ? activeRef : undefined}
                    className={`border-l-4 rounded-r-lg p-3 cursor-pointer transition-all ${colors} ${
                      isActive ? "opacity-100 ring-1 ring-white/10" : "opacity-60 hover:opacity-80"
                    }`}
                    onClick={() => onSeek(ann.time)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-white text-sm">{ann.title}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{ann.description}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-500 font-mono">
                          {formatTime(ann.time)}
                        </span>
                        {ann.detail && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDrilldownAnnotation(ann);
                            }}
                            className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                          >
                            More
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Drilldown modal — managed internally */}
      {drilldownAnnotation && (
        <DrilldownModal
          annotation={drilldownAnnotation}
          songKey={songKey}
          onClose={() => setDrilldownAnnotation(null)}
        />
      )}
    </>
  );
}

// Inline drilldown — reuses TheoryDrilldown logic but self-contained
import { getModes, getSecondaryDominants } from "../api/client";
import type { ModeInfo, SecondaryDominant } from "../types";

function DrilldownModal({ annotation, songKey, onClose }: {
  annotation: TheoryAnnotation;
  songKey: string;
  onClose: () => void;
}) {
  const [modes, setModes] = useState<ModeInfo[]>([]);
  const [secondaryDominants, setSecondaryDominants] = useState<SecondaryDominant[]>([]);
  const [activeTab, setActiveTab] = useState<"detail" | "modes" | "dominants" | "voiceleading">("detail");

  useEffect(() => {
    getModes().then(setModes).catch(() => {});
    if (songKey) {
      getSecondaryDominants(songKey).then(setSecondaryDominants).catch(() => {});
    }
  }, [songKey]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">{annotation.title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex border-b border-slate-700">
          {(["detail", "modes", "dominants", "voiceleading"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "text-indigo-400 border-b-2 border-indigo-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab === "detail" ? "Detail" : tab === "modes" ? "Modes" : tab === "dominants" ? "Secondary Dominants" : "Voice Leading"}
            </button>
          ))}
        </div>

        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {activeTab === "detail" && (
            <div className="space-y-3">
              <p className="text-slate-300 leading-relaxed">{annotation.description}</p>
              {annotation.detail && (
                <div className="bg-slate-900 rounded-lg p-4 mt-3">
                  <p className="text-slate-400 leading-relaxed text-sm">{annotation.detail}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "modes" && (
            <div className="space-y-3">
              <p className="text-slate-400 text-sm mb-4">
                The seven modes of the major scale, each starting on a different degree:
              </p>
              {modes.map((mode) => (
                <div key={mode.name} className="bg-slate-900 rounded-lg p-3">
                  <div className="font-semibold text-white text-sm">{mode.name}</div>
                  <div className="text-xs text-slate-500 mt-1 font-mono">
                    {mode.scale_degrees.join(" – ")}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Intervals: {mode.intervals.join(" ")}
                  </div>
                  <div className="text-sm text-indigo-400 mt-1">{mode.character}</div>
                  {mode.example_songs.length > 0 && (
                    <div className="text-xs text-slate-600 mt-1">
                      Examples: {mode.example_songs.join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === "dominants" && (
            <div className="space-y-3">
              <p className="text-slate-400 text-sm mb-4">
                Secondary dominants in the key of {songKey}:
              </p>
              {secondaryDominants.map((sd) => (
                <div key={sd.roman} className="bg-slate-900 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-purple-400 font-mono">{sd.roman}</span>
                    <span className="text-white font-semibold">{sd.chord}</span>
                    <span className="text-slate-500 text-sm">→ {sd.target}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{sd.description}</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "voiceleading" && (
            <div className="space-y-3">
              <div className="bg-slate-900 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-2">Voice Leading Principles</h4>
                <ul className="text-sm text-slate-400 space-y-2 list-disc list-inside">
                  <li><strong className="text-slate-300">Minimal motion:</strong> Each voice moves to the nearest available note in the next chord.</li>
                  <li><strong className="text-slate-300">Common tones:</strong> Notes shared between consecutive chords should be held (not re-attacked).</li>
                  <li><strong className="text-slate-300">Contrary motion:</strong> When the bass moves up, upper voices tend to move down, and vice versa.</li>
                  <li><strong className="text-slate-300">Leading tone resolution:</strong> The 7th scale degree (leading tone) resolves upward to the tonic.</li>
                  <li><strong className="text-slate-300">Avoid parallel fifths/octaves:</strong> Two voices moving in parallel perfect fifths or octaves weakens independence of voices.</li>
                </ul>
              </div>
              <div className="bg-slate-900 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-2">In This Song</h4>
                <p className="text-sm text-slate-400">
                  In the key of {songKey}, the leading tone is the note a half step below the tonic.
                  Listen for how it resolves upward in dominant-to-tonic (V→I) cadences.
                  The smoothest chord changes in this song will have shared tones between consecutive chords.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function findActiveIndex(annotations: TheoryAnnotation[], time: number): number {
  let best = -1;
  for (let i = 0; i < annotations.length; i++) {
    if (annotations[i].time <= time) {
      best = i;
    } else {
      break;
    }
  }
  return best;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
