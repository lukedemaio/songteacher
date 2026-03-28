import { useEffect, useRef, useMemo } from "react";
import type { ChordEvent, ChordFunction, ChordSummary, GuitarTabChord } from "../types";

interface Props {
  chords: ChordEvent[];
  chordSummary: ChordSummary[];
  guitarTabChords: GuitarTabChord[];
  currentTime: number;
  onSeek: (time: number) => void;
  subscribe: (cb: (time: number) => void) => () => void;
}

const FUNCTION_BORDER_COLORS: Record<ChordFunction, string> = {
  tonic: "border-l-emerald-500",
  subdominant: "border-l-amber-500",
  dominant: "border-l-red-500",
  secondary: "border-l-purple-500",
  borrowed: "border-l-cyan-500",
  other: "border-l-slate-500",
};

const FUNCTION_RING_COLORS: Record<ChordFunction, string> = {
  tonic: "ring-emerald-500/50",
  subdominant: "ring-amber-500/50",
  dominant: "ring-red-500/50",
  secondary: "ring-purple-500/50",
  borrowed: "ring-cyan-500/50",
  other: "ring-slate-500/50",
};

// Mini fretboard diagram dimensions
const FB_W = 80;
const FB_H = 70;
const FB_FRETS = 4;
const FB_STRINGS = 6;
const FB_LEFT = 12;
const FB_TOP = 14;
const FB_RIGHT = 6;
const FB_BOTTOM = 6;
const FB_FRET_H = (FB_H - FB_TOP - FB_BOTTOM) / FB_FRETS;
const FB_STRING_W = (FB_W - FB_LEFT - FB_RIGHT) / (FB_STRINGS - 1);

function MiniFretboard({ frets }: { frets: number[] }) {
  const playedFrets = frets.filter((f) => f > 0);
  const minFret = playedFrets.length > 0 ? Math.min(...playedFrets) : 0;
  const startFret = minFret <= 3 ? 0 : minFret - 1;

  return (
    <svg width={FB_W} height={FB_H} viewBox={`0 0 ${FB_W} ${FB_H}`} className="shrink-0">
      {/* Nut */}
      {startFret === 0 && (
        <line
          x1={FB_LEFT} y1={FB_TOP}
          x2={FB_LEFT + (FB_STRINGS - 1) * FB_STRING_W} y2={FB_TOP}
          stroke="#e2e8f0" strokeWidth={3}
        />
      )}

      {/* Fret position label */}
      {startFret > 0 && (
        <text x={2} y={FB_TOP + FB_FRET_H / 2 + 3} fontSize={7} fill="#64748b">
          {startFret + 1}
        </text>
      )}

      {/* Fret lines */}
      {Array.from({ length: FB_FRETS + 1 }, (_, i) => (
        <line
          key={i}
          x1={FB_LEFT} y1={FB_TOP + i * FB_FRET_H}
          x2={FB_LEFT + (FB_STRINGS - 1) * FB_STRING_W} y2={FB_TOP + i * FB_FRET_H}
          stroke="#475569" strokeWidth={i === 0 && startFret > 0 ? 1.5 : 0.5}
        />
      ))}

      {/* String lines */}
      {Array.from({ length: FB_STRINGS }, (_, i) => (
        <line
          key={i}
          x1={FB_LEFT + i * FB_STRING_W} y1={FB_TOP}
          x2={FB_LEFT + i * FB_STRING_W} y2={FB_TOP + FB_FRETS * FB_FRET_H}
          stroke="#64748b" strokeWidth={0.5 + i * 0.15}
        />
      ))}

      {/* Finger dots */}
      {frets.map((fret, stringIdx) => {
        const x = FB_LEFT + stringIdx * FB_STRING_W;

        if (fret === -1) {
          return (
            <text key={stringIdx} x={x} y={FB_TOP - 4} textAnchor="middle" fontSize={7} fill="#ef4444" fontWeight="bold">
              X
            </text>
          );
        }
        if (fret === 0) {
          return (
            <circle key={stringIdx} cx={x} cy={FB_TOP - 5} r={2.5} fill="none" stroke="#10b981" strokeWidth={1} />
          );
        }

        const displayFret = fret - startFret;
        const y = FB_TOP + (displayFret - 0.5) * FB_FRET_H;
        return (
          <circle key={stringIdx} cx={x} cy={y} r={3.5} fill="#6366f1" stroke="#818cf8" strokeWidth={0.5} />
        );
      })}
    </svg>
  );
}

export function SongChords({ chords, chordSummary, guitarTabChords, onSeek, subscribe }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const activeNameRef = useRef<string | null>(null);

  // Build chord cards ordered by first appearance
  const chordCards = useMemo(() => {
    const seen = new Set<string>();
    const cards: Array<{
      name: string;
      romanNumeral: string;
      func: ChordFunction;
      frets: number[];
      firstTime: number;
    }> = [];

    for (const chord of chords) {
      if (seen.has(chord.name)) continue;
      seen.add(chord.name);

      const tabChord = guitarTabChords.find((tc) => tc.name === chord.name);
      const summaryEntry = chordSummary.find((cs) => cs.name === chord.name);

      cards.push({
        name: chord.name,
        romanNumeral: chord.roman_numeral || summaryEntry?.roman_numeral || "",
        func: summaryEntry?.function ?? chord.function,
        frets: tabChord?.frets ?? [-1, -1, -1, -1, -1, -1],
        firstTime: chord.start_time,
      });
    }

    return cards;
  }, [chords, chordSummary, guitarTabChords]);

  // Subscribe for highlight updates (only when chord changes)
  useEffect(() => {
    const unsub = subscribe((t) => {
      const active = chords.find((c) => t >= c.start_time && t < c.end_time);
      const name = active?.name ?? null;
      if (name === activeNameRef.current) return;

      // Remove highlight from previous
      if (activeNameRef.current) {
        const prev = cardRefs.current.get(activeNameRef.current);
        if (prev) {
          prev.classList.remove("ring-2", ...Object.values(FUNCTION_RING_COLORS));
        }
      }

      // Add highlight to current
      activeNameRef.current = name;
      if (name) {
        const card = cardRefs.current.get(name);
        if (card) {
          const func = chordCards.find((c) => c.name === name)?.func ?? "other";
          card.classList.add("ring-2", FUNCTION_RING_COLORS[func]);
          card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
        }
      }
    });
    return unsub;
  }, [subscribe, chords, chordCards]);

  if (!chordCards.length) return null;

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <h3 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wide">Song Chords</h3>
      <div
        ref={containerRef}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-600"
      >
        {chordCards.map((card) => (
          <div
            key={card.name}
            ref={(el) => { if (el) cardRefs.current.set(card.name, el); }}
            className={`shrink-0 bg-slate-900 rounded-lg p-3 border-l-4 cursor-pointer transition-all hover:bg-slate-800 ${FUNCTION_BORDER_COLORS[card.func]}`}
            onClick={() => onSeek(card.firstTime)}
            title={`Seek to first ${card.name}`}
          >
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-lg font-bold text-white">{card.name}</span>
              {card.romanNumeral && (
                <span className="text-xs text-slate-500">{card.romanNumeral}</span>
              )}
            </div>
            <MiniFretboard frets={card.frets} />
          </div>
        ))}
      </div>
    </div>
  );
}
