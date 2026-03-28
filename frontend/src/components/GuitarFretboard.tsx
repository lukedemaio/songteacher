import type { GuitarTabChord } from "../types";

interface Props {
  chords: GuitarTabChord[];
  currentTime: number;
}

const STRING_NAMES = ["E", "A", "D", "G", "B", "e"];
const NUM_FRETS = 5;
const FRET_WIDTH = 48;
const STRING_SPACING = 24;
const TOP_PADDING = 30;
const LEFT_PADDING = 20;

export function GuitarFretboard({ chords, currentTime }: Props) {
  // Find the active chord
  const activeChord = chords.find(
    (c) => currentTime >= c.start_time && currentTime < c.end_time
  );

  if (!activeChord) {
    return (
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wide">Chord Shape</h3>
        <div className="text-slate-500 text-sm py-8 text-center">No chord at current position</div>
      </div>
    );
  }

  // Determine fret range to display
  const playedFrets = activeChord.frets.filter((f) => f > 0);
  const minFret = playedFrets.length > 0 ? Math.min(...playedFrets) : 0;
  const startFret = minFret <= 3 ? 0 : minFret - 1;

  const svgWidth = LEFT_PADDING + NUM_FRETS * FRET_WIDTH + 20;
  const svgHeight = TOP_PADDING + 5 * STRING_SPACING + 30;

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <h3 className="text-sm font-medium text-slate-400 mb-1 uppercase tracking-wide">Chord Shape</h3>
      <div className="text-center text-lg font-semibold text-white mb-2">{activeChord.name}</div>
      <svg width="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        {/* Nut (if at position 0) */}
        {startFret === 0 && (
          <line
            x1={LEFT_PADDING}
            y1={TOP_PADDING}
            x2={LEFT_PADDING}
            y2={TOP_PADDING + 5 * STRING_SPACING}
            stroke="#e2e8f0"
            strokeWidth={4}
          />
        )}

        {/* Fret lines */}
        {Array.from({ length: NUM_FRETS + 1 }, (_, i) => (
          <line
            key={`fret-${i}`}
            x1={LEFT_PADDING + i * FRET_WIDTH}
            y1={TOP_PADDING}
            x2={LEFT_PADDING + i * FRET_WIDTH}
            y2={TOP_PADDING + 5 * STRING_SPACING}
            stroke="#475569"
            strokeWidth={i === 0 && startFret > 0 ? 2 : 1}
          />
        ))}

        {/* Fret numbers */}
        {Array.from({ length: NUM_FRETS }, (_, i) => (
          <text
            key={`fn-${i}`}
            x={LEFT_PADDING + i * FRET_WIDTH + FRET_WIDTH / 2}
            y={TOP_PADDING - 10}
            textAnchor="middle"
            fontSize={10}
            fill="#64748b"
          >
            {startFret + i + 1}
          </text>
        ))}

        {/* String lines */}
        {STRING_NAMES.map((name, i) => {
          const y = TOP_PADDING + i * STRING_SPACING;
          return (
            <g key={name}>
              <line
                x1={LEFT_PADDING}
                y1={y}
                x2={LEFT_PADDING + NUM_FRETS * FRET_WIDTH}
                y2={y}
                stroke="#64748b"
                strokeWidth={1 + i * 0.3}
              />
            </g>
          );
        })}

        {/* Finger positions */}
        {activeChord.frets.map((fret, stringIdx) => {
          // frets array is [E, A, D, G, B, e] (low to high)
          const y = TOP_PADDING + stringIdx * STRING_SPACING;

          if (fret === -1) {
            // Muted string
            return (
              <text
                key={`m-${stringIdx}`}
                x={LEFT_PADDING - 12}
                y={y + 4}
                textAnchor="middle"
                fontSize={12}
                fill="#ef4444"
                fontWeight="bold"
              >
                X
              </text>
            );
          }

          if (fret === 0) {
            // Open string
            return (
              <circle
                key={`o-${stringIdx}`}
                cx={LEFT_PADDING - 12}
                cy={y}
                r={6}
                fill="none"
                stroke="#10b981"
                strokeWidth={1.5}
              />
            );
          }

          // Fretted note
          const displayFret = fret - startFret;
          const x = LEFT_PADDING + (displayFret - 0.5) * FRET_WIDTH;

          return (
            <circle
              key={`f-${stringIdx}`}
              cx={x}
              cy={y}
              r={8}
              fill="#6366f1"
              stroke="#818cf8"
              strokeWidth={1.5}
            />
          );
        })}
      </svg>
    </div>
  );
}
