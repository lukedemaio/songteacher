import type { PipelineStage } from "../types";

const STAGE_LABELS: Record<PipelineStage, string> = {
  downloading: "Downloading audio...",
  transcribing: "Transcribing notes (this may take a minute)...",
  analyzing: "Analyzing music theory...",
  generating_tabs: "Generating guitar tabs...",
  done: "Complete!",
};

interface Props {
  stage: PipelineStage;
  progress: number;
}

export function LoadingProgress({ stage, progress }: Props) {
  const pct = Math.round(progress * 100);

  return (
    <div className="w-full max-w-md mx-auto mt-8">
      <div className="flex justify-between text-sm text-slate-400 mb-2">
        <span>{STAGE_LABELS[stage]}</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
