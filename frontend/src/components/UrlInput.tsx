import { useState } from "react";

interface Props {
  onSubmit: (url: string) => void;
  loading: boolean;
}

export function UrlInput({ onSubmit, loading }: Props) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) onSubmit(url.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 w-full max-w-2xl mx-auto">
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste a YouTube URL..."
        className="flex-1 px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        disabled={loading}
      />
      <button
        type="submit"
        disabled={loading || !url.trim()}
        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-lg transition-colors"
      >
        {loading ? "Analyzing..." : "Analyze"}
      </button>
    </form>
  );
}
