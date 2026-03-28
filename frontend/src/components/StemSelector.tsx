import type { Instrument, StemInfo } from "../types";

interface Props {
  stems: StemInfo[];
  activeStem: Instrument;
  onStemChange: (stem: Instrument) => void;
}

const STEM_LABELS: Record<Instrument, string> = {
  full_mix: "Full Mix",
  vocals: "Vocals",
  drums: "Drums",
  bass: "Bass",
  guitar: "Guitar",
  piano: "Piano",
  other: "Other",
};

const STEM_ORDER: Instrument[] = [
  "full_mix",
  "vocals",
  "drums",
  "bass",
  "guitar",
  "piano",
  "other",
];

export function StemSelector({ stems, activeStem, onStemChange }: Props) {
  if (!stems.length) return null;

  const stemMap = new Map(stems.map((s) => [s.instrument, s]));

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <h3 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wide">
        Instrument Stems
      </h3>
      <div className="flex flex-wrap gap-2">
        {STEM_ORDER.map((instrument) => {
          const info = stemMap.get(instrument);
          if (!info?.audio_available) return null;

          const isActive = activeStem === instrument;
          return (
            <button
              key={instrument}
              onClick={() => onStemChange(instrument)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {STEM_LABELS[instrument]}
              {info.note_count > 0 && (
                <span className="ml-1.5 text-xs opacity-60">
                  {info.note_count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
