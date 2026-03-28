interface Props {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLoaded: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
}

export function PlaybackControls({ isPlaying, currentTime, duration, isLoaded, onTogglePlay, onSeek }: Props) {
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSeek(Number(e.target.value));
  };

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-center gap-4">
      <button
        onClick={onTogglePlay}
        disabled={!isLoaded}
        className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 flex items-center justify-center text-white transition-colors shrink-0"
      >
        {isPlaying ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
      </button>

      <div className="text-sm text-slate-400 font-mono w-24 shrink-0">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>

      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.1}
        value={currentTime}
        onChange={handleSeek}
        disabled={!isLoaded}
        className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
      />
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
