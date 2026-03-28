import { useEffect, useRef, useState } from "react";
import type { ChordEvent, ChordFunction } from "../types";

interface Props {
  chords: ChordEvent[];
  currentTime: number;
  subscribe: (cb: (time: number) => void) => () => void;
}

const FUNCTION_COLORS: Record<ChordFunction, string> = {
  tonic: "text-emerald-400 bg-emerald-900/30 border-emerald-700/50",
  subdominant: "text-amber-400 bg-amber-900/30 border-amber-700/50",
  dominant: "text-red-400 bg-red-900/30 border-red-700/50",
  secondary: "text-purple-400 bg-purple-900/30 border-purple-700/50",
  borrowed: "text-cyan-400 bg-cyan-900/30 border-cyan-700/50",
  other: "text-slate-400 bg-slate-700/30 border-slate-600/50",
};

const FUNCTION_LABELS: Record<ChordFunction, string> = {
  tonic: "Tonic",
  subdominant: "Subdominant",
  dominant: "Dominant",
  secondary: "Secondary",
  borrowed: "Borrowed",
  other: "Other",
};

export function ActiveChord({ chords, currentTime, subscribe }: Props) {
  const [active, setActive] = useState<ChordEvent | null>(null);
  const chordsRef = useRef(chords);
  const lastChordRef = useRef<string | null>(null);

  useEffect(() => { chordsRef.current = chords; }, [chords]);

  // Set initial active chord
  useEffect(() => {
    const found = chords.find(
      (c) => currentTime >= c.start_time && currentTime < c.end_time
    ) ?? null;
    setActive(found);
    lastChordRef.current = found?.name ?? null;
  }, [chords]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to time updates, throttled — only update state when chord changes
  useEffect(() => {
    const unsub = subscribe((t) => {
      const found = chordsRef.current.find(
        (c) => t >= c.start_time && t < c.end_time
      ) ?? null;
      const name = found?.name ?? null;
      if (name !== lastChordRef.current) {
        lastChordRef.current = name;
        setActive(found);
      }
    });
    return unsub;
  }, [subscribe]);

  if (!active) {
    return (
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <div className="text-sm text-slate-500 text-center">No chord playing</div>
      </div>
    );
  }

  const funcColor = FUNCTION_COLORS[active.function];
  const funcLabel = FUNCTION_LABELS[active.function];

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold text-white">{active.name}</span>
          {active.roman_numeral && (
            <span className="text-xl font-semibold text-slate-400">{active.roman_numeral}</span>
          )}
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium border ${funcColor}`}>
          {funcLabel}
        </span>
      </div>

      {active.notes.length > 0 && (
        <div className="flex gap-2 mt-3">
          {active.notes.map((note, i) => (
            <span key={i} className="text-sm text-slate-300">
              {note}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
