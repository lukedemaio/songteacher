import type { SongAnalysis } from "../types";

interface Props {
  analysis: SongAnalysis;
}

export function SongInfo({ analysis }: Props) {
  const confidence = Math.round(analysis.key_confidence * 100);

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h2 className="text-xl font-semibold text-white mb-4 truncate">{analysis.title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <InfoCard label="Key" value={`${analysis.key} ${analysis.mode}`} sub={`${confidence}% confidence`} />
        <InfoCard label="Tempo" value={`${Math.round(analysis.tempo)} BPM`} />
        <InfoCard label="Time Sig" value={analysis.time_signature} />
        <InfoCard label="Duration" value={formatTime(analysis.duration)} />
      </div>
    </div>
  );
}

function InfoCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-900 rounded-lg p-3">
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="text-lg font-semibold text-white mt-1">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
