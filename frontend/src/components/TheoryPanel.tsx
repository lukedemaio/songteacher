import { useRef, useEffect } from "react";
import type { TheoryAnnotation } from "../types";

interface Props {
  annotations: TheoryAnnotation[];
  currentTime: number;
  onSeek: (time: number) => void;
  onDrilldown: (annotation: TheoryAnnotation) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  key: "border-emerald-500 bg-emerald-500/10",
  cadence: "border-amber-500 bg-amber-500/10",
  secondary_dominant: "border-purple-500 bg-purple-500/10",
  borrowed_chord: "border-pink-500 bg-pink-500/10",
  general: "border-slate-500 bg-slate-500/10",
};

export function TheoryPanel({ annotations, currentTime, onSeek, onDrilldown }: Props) {
  const activeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find the most recent annotation at or before current time
  const activeIndex = findActiveIndex(annotations, currentTime);

  // Auto-scroll to active annotation
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [activeIndex]);

  if (!annotations.length) return null;

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <h3 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wide">
        Theory Annotations
      </h3>
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
                        onDrilldown(ann);
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
