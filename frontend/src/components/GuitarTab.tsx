import type { GuitarTabNote } from "../types";

interface Props {
  tabNotes: GuitarTabNote[];
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  emptyMessage?: string;
}

const STRING_NAMES = ["e", "B", "G", "D", "A", "E"];
const LINE_SPACING = 20;
const TIME_SCALE = 60; // px per second
const LEFT_MARGIN = 30;
const VIEW_WINDOW = 10; // seconds visible

export function GuitarTab({ tabNotes, currentTime, duration, onSeek, emptyMessage }: Props) {
  if (!tabNotes.length) {
    if (emptyMessage) {
      return (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 overflow-hidden">
          <h3 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wide">Guitar Tab</h3>
          <div className="flex items-center justify-center text-slate-500 py-8">
            {emptyMessage}
          </div>
        </div>
      );
    }
    return null;
  }

  // Show a window around current time
  const viewStart = Math.max(0, currentTime - VIEW_WINDOW * 0.25);
  const viewEnd = viewStart + VIEW_WINDOW;

  const visibleNotes = tabNotes.filter(
    (n) => n.end_time >= viewStart && n.start_time <= viewEnd
  );

  const svgWidth = VIEW_WINDOW * TIME_SCALE + LEFT_MARGIN + 20;
  const svgHeight = 6 * LINE_SPACING + 30;

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < LEFT_MARGIN) return;
    const time = viewStart + (x - LEFT_MARGIN) / TIME_SCALE;
    onSeek(Math.max(0, Math.min(time, duration)));
  };

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 overflow-hidden">
      <h3 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wide">Guitar Tab</h3>
      <svg
        width="100%"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="cursor-crosshair"
        onClick={handleClick}
      >
        {/* String lines */}
        {STRING_NAMES.map((name, i) => {
          const y = 20 + i * LINE_SPACING;
          return (
            <g key={name}>
              <line
                x1={LEFT_MARGIN}
                y1={y}
                x2={svgWidth - 10}
                y2={y}
                stroke="#475569"
                strokeWidth={1}
              />
              <text x={4} y={y + 4} fontSize={11} fill="#64748b" fontFamily="monospace">
                {name}
              </text>
            </g>
          );
        })}

        {/* Fret numbers */}
        {visibleNotes.map((note, i) => {
          const x = LEFT_MARGIN + (note.start_time - viewStart) * TIME_SCALE;
          const y = 20 + (note.string - 1) * LINE_SPACING;
          const isActive =
            currentTime >= note.start_time && currentTime <= note.end_time;

          return (
            <g key={`${i}-${note.start_time}-${note.string}`}>
              {/* Background rectangle for readability */}
              <rect
                x={x - 7}
                y={y - 9}
                width={14}
                height={18}
                rx={3}
                fill={isActive ? "#6366f1" : "#1e293b"}
              />
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                fontSize={12}
                fontWeight={isActive ? "bold" : "normal"}
                fill={isActive ? "#fff" : "#94a3b8"}
                fontFamily="monospace"
              >
                {note.fret}
              </text>
            </g>
          );
        })}

        {/* Cursor */}
        {(() => {
          const cursorX = LEFT_MARGIN + (currentTime - viewStart) * TIME_SCALE;
          return (
            <line
              x1={cursorX}
              y1={8}
              x2={cursorX}
              y2={svgHeight - 8}
              stroke="#ef4444"
              strokeWidth={1.5}
              strokeDasharray="4 2"
            />
          );
        })()}
      </svg>
    </div>
  );
}
