import type { SongAnalysis, ChordFunction } from "../types";

interface Props {
  analysis: SongAnalysis;
}

const FUNCTION_DOT_COLORS: Record<ChordFunction, string> = {
  tonic: "bg-emerald-400",
  subdominant: "bg-amber-400",
  dominant: "bg-red-400",
  secondary: "bg-purple-400",
  borrowed: "bg-cyan-400",
  other: "bg-slate-400",
};

export function QuickReference({ analysis }: Props) {
  const { scale_notes, common_progressions, chord_summary } = analysis;

  if (!scale_notes?.length && !chord_summary?.length && !common_progressions?.length) {
    return null;
  }

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-5">
      <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Quick Reference</h3>

      {/* Scale */}
      {scale_notes && scale_notes.length > 0 && (
        <div>
          <div className="text-xs text-slate-500 mb-2">
            {analysis.key} {analysis.mode} scale
          </div>
          <div className="flex flex-wrap gap-2">
            {scale_notes.map((note) => (
              <span
                key={note}
                className="px-3 py-1 bg-indigo-900/40 border border-indigo-700/50 rounded-full text-sm font-medium text-indigo-300"
              >
                {note}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Common Progressions */}
      {common_progressions && common_progressions.length > 0 && (
        <div>
          <div className="text-xs text-slate-500 mb-2">Common Progressions</div>
          <div className="space-y-1.5">
            {common_progressions.slice(0, 3).map((prog, i) => (
              <div
                key={i}
                className="text-sm text-slate-300 bg-slate-900 rounded-lg px-3 py-2 font-mono"
              >
                {prog}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chord Grid */}
      {chord_summary && chord_summary.length > 0 && (
        <div>
          <div className="text-xs text-slate-500 mb-2">Chords Used</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {chord_summary.map((cs) => (
              <div
                key={cs.name}
                className="bg-slate-900 rounded-lg p-3 text-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${FUNCTION_DOT_COLORS[cs.function]}`}
                  />
                  <span className="text-white font-semibold truncate">{cs.name}</span>
                  {cs.roman_numeral && (
                    <span className="text-slate-500 text-xs ml-auto shrink-0">{cs.roman_numeral}</span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {cs.notes.join(", ")}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {cs.count}x
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
