import type { ChordEvent } from "../types";

interface Props {
  chords: ChordEvent[];
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

const FUNCTION_COLORS: Record<string, string> = {
  tonic: "bg-emerald-700 border-emerald-500",
  subdominant: "bg-amber-700 border-amber-500",
  dominant: "bg-red-700 border-red-500",
  secondary: "bg-purple-700 border-purple-500",
  borrowed: "bg-pink-700 border-pink-500",
  other: "bg-slate-700 border-slate-500",
};

export function ChordTimeline({ chords, currentTime, duration, onSeek }: Props) {
  if (!chords.length || duration === 0) return null;

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <h3 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wide">Chord Progression</h3>
      <div className="relative h-14 bg-slate-900 rounded-lg overflow-hidden">
        {chords.map((chord, i) => {
          const left = (chord.start_time / duration) * 100;
          const width = Math.max(((chord.end_time - chord.start_time) / duration) * 100, 0.5);
          const isActive = currentTime >= chord.start_time && currentTime < chord.end_time;
          const colors = FUNCTION_COLORS[chord.function] || FUNCTION_COLORS.other;

          return (
            <div
              key={i}
              className={`absolute top-0 h-full border-r cursor-pointer flex items-center justify-center transition-opacity ${colors} ${
                isActive ? "opacity-100 ring-2 ring-white/30 z-10" : "opacity-70 hover:opacity-90"
              }`}
              style={{ left: `${left}%`, width: `${width}%` }}
              onClick={() => onSeek(chord.start_time)}
              title={`${chord.name} (${chord.roman_numeral || "?"})`}
            >
              {width > 4 && (
                <div className="text-xs text-white truncate px-1">
                  <div className="font-semibold">{chord.roman_numeral || chord.name}</div>
                </div>
              )}
            </div>
          );
        })}

        {/* Playback cursor */}
        <div
          className="absolute top-0 h-full w-0.5 bg-white z-20 pointer-events-none"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        />
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-2 text-xs text-slate-500">
        <span><span className="inline-block w-3 h-3 rounded bg-emerald-700 mr-1 align-middle" /> Tonic</span>
        <span><span className="inline-block w-3 h-3 rounded bg-amber-700 mr-1 align-middle" /> Subdominant</span>
        <span><span className="inline-block w-3 h-3 rounded bg-red-700 mr-1 align-middle" /> Dominant</span>
        <span><span className="inline-block w-3 h-3 rounded bg-purple-700 mr-1 align-middle" /> Secondary</span>
      </div>
    </div>
  );
}
