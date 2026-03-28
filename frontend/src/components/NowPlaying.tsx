import { useEffect, useRef, useState } from "react";
import type { ChordEvent, ChordFunction, SongSection } from "../types";

interface Props {
  chords: ChordEvent[];
  sections: SongSection[];
  commonProgressions: string[];
  currentTime: number;
  subscribe: (cb: (time: number) => void) => () => void;
}

const FUNCTION_LABELS: Record<ChordFunction, string> = {
  tonic: "tonic",
  subdominant: "subdominant",
  dominant: "dominant",
  secondary: "secondary dominant",
  borrowed: "borrowed chord",
  other: "",
};

const FUNCTION_SHORT: Record<ChordFunction, string> = {
  tonic: "I",
  subdominant: "IV",
  dominant: "V",
  secondary: "sec. dom.",
  borrowed: "borrowed",
  other: "",
};

function getChordExplanation(current: ChordEvent, next: ChordEvent | null): string {
  const funcLabel = FUNCTION_LABELS[current.function];
  const rn = current.roman_numeral || "";

  if (!next) {
    if (funcLabel) return `${rn} — ${funcLabel}`;
    return rn;
  }

  const nextRn = next.roman_numeral || "";
  const nextFunc = FUNCTION_LABELS[next.function];

  // Specific movement descriptions
  if (current.function === "dominant" && next.function === "tonic") {
    return `${rn} → ${nextRn} — dominant to tonic, strong resolution`;
  }
  if (current.function === "subdominant" && next.function === "dominant") {
    return `${rn} → ${nextRn} — subdominant to dominant, building tension`;
  }
  if (current.function === "subdominant" && next.function === "tonic") {
    return `${rn} → ${nextRn} — plagal motion (${FUNCTION_SHORT.subdominant} → ${FUNCTION_SHORT.tonic})`;
  }
  if (current.function === "tonic" && next.function === "subdominant") {
    return `${rn} → ${nextRn} — tonic to subdominant, softer contrast`;
  }
  if (current.function === "tonic" && next.function === "dominant") {
    return `${rn} → ${nextRn} — tonic to dominant, creating tension`;
  }
  if (current.function === "secondary") {
    return `${rn} → ${nextRn} — secondary dominant, creates tension toward ${next.name}`;
  }
  if (current.function === "borrowed") {
    return `${rn} → ${nextRn} — borrowed chord adds color`;
  }

  // Generic
  if (funcLabel && nextFunc) {
    return `${rn} → ${nextRn} — ${funcLabel} to ${nextFunc}`;
  }
  if (rn && nextRn) {
    return `${rn} → ${nextRn}`;
  }
  return "";
}

function findProgressionMatch(
  chords: ChordEvent[],
  currentIdx: number,
  commonProgressions: string[]
): string | null {
  if (!commonProgressions.length || currentIdx < 0) return null;

  // Check windows of 3-4 chords around current position
  for (const prog of commonProgressions) {
    const progChords = prog.split(/\s*[→–-]\s*|\s+/).filter(Boolean);
    const windowSize = progChords.length;
    if (windowSize < 2) continue;

    // Check if current position is within a matching window
    for (let start = Math.max(0, currentIdx - windowSize + 1); start <= currentIdx; start++) {
      if (start + windowSize > chords.length) continue;
      const window = chords.slice(start, start + windowSize);
      const match = window.every((c, i) => {
        const rn = c.roman_numeral?.replace(/\s/g, "") || "";
        return rn === progChords[i];
      });
      if (match) return prog;
    }
  }
  return null;
}

interface NowPlayingState {
  sectionName: string;
  currentChord: string;
  nextChord: string;
  explanation: string;
  progressionMatch: string | null;
}

export function NowPlaying({ chords, sections, commonProgressions, currentTime, subscribe }: Props) {
  const chordsRef = useRef(chords);
  const sectionsRef = useRef(sections);
  const progsRef = useRef(commonProgressions);

  useEffect(() => { chordsRef.current = chords; }, [chords]);
  useEffect(() => { sectionsRef.current = sections; }, [sections]);
  useEffect(() => { progsRef.current = commonProgressions; }, [commonProgressions]);

  const [state, setState] = useState<NowPlayingState>({
    sectionName: "",
    currentChord: "",
    nextChord: "",
    explanation: "",
    progressionMatch: null,
  });

  const lastChordNameRef = useRef<string | null>(null);

  // Compute initial state
  useEffect(() => {
    update(currentTime);
  }, [chords, sections]); // eslint-disable-line react-hooks/exhaustive-deps

  function update(t: number) {
    const cs = chordsRef.current;
    const sec = sectionsRef.current;

    const section = sec.find((s) => t >= s.start_time && t < s.end_time);
    const chordIdx = cs.findIndex((c) => t >= c.start_time && t < c.end_time);
    const current = chordIdx >= 0 ? cs[chordIdx] : null;
    const next = chordIdx >= 0 && chordIdx + 1 < cs.length ? cs[chordIdx + 1] : null;

    const chordName = current?.name ?? null;
    if (chordName === lastChordNameRef.current && section?.name === state.sectionName) return;
    lastChordNameRef.current = chordName;

    const explanation = current ? getChordExplanation(current, next) : "";
    const progressionMatch = current
      ? findProgressionMatch(cs, chordIdx, progsRef.current)
      : null;

    setState({
      sectionName: section?.name ?? "",
      currentChord: current?.name ?? "",
      nextChord: next?.name ?? "",
      explanation,
      progressionMatch,
    });
  }

  // Subscribe for updates — only re-render when chord changes
  useEffect(() => {
    const unsub = subscribe((t) => update(t));
    return unsub;
  }, [subscribe]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!chords.length) return null;

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Section label */}
        {state.sectionName && (
          <div className="px-3 py-1 bg-indigo-900/40 border border-indigo-700/50 rounded-full text-sm font-medium text-indigo-300">
            {state.sectionName}
          </div>
        )}

        {/* Current → Next chord with explanation */}
        <div className="flex-1 min-w-0">
          {state.currentChord ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl font-bold text-white">{state.currentChord}</span>
              {state.nextChord && (
                <>
                  <span className="text-slate-500">→</span>
                  <span className="text-lg font-semibold text-slate-400">{state.nextChord}</span>
                </>
              )}
              {state.explanation && (
                <span className="text-sm text-slate-500 truncate">
                  — {state.explanation.split(" — ").pop()}
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm text-slate-500">Waiting for chord...</span>
          )}
        </div>

        {/* Progression match */}
        {state.progressionMatch && (
          <div className="shrink-0 px-3 py-1 bg-slate-700/50 rounded-lg text-xs text-slate-400 font-mono">
            {state.progressionMatch}
          </div>
        )}
      </div>
    </div>
  );
}
