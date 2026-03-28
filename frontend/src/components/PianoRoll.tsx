import { useCallback, useEffect, useRef } from "react";
import type { NoteEvent } from "../types";
import { renderPianoRoll } from "../lib/pianoRollRenderer";

interface Props {
  notes: NoteEvent[];
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

const TIME_SCALE = 80;
const PIANO_KEY_WIDTH = 40;

export function PianoRoll({ notes, currentTime, duration, onSeek }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const getScrollOffset = useCallback(() => {
    // Auto-scroll to keep cursor roughly 1/3 from left
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const viewDuration = (canvas.clientWidth - PIANO_KEY_WIDTH) / TIME_SCALE;
    return Math.max(0, currentTime - viewDuration * 0.33);
  }, [currentTime]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const scrollOffset = getScrollOffset();
    renderPianoRoll(ctx, notes, currentTime, rect.width, rect.height, scrollOffset);
  }, [notes, currentTime, getScrollOffset]);

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(() => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const scrollOffset = getScrollOffset();
      renderPianoRoll(ctx, notes, currentTime, rect.width, rect.height, scrollOffset);
    });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, [notes, currentTime, getScrollOffset]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    if (x < PIANO_KEY_WIDTH) return;

    const scrollOffset = getScrollOffset();
    const time = scrollOffset + (x - PIANO_KEY_WIDTH) / TIME_SCALE;
    onSeek(Math.max(0, Math.min(time, duration)));
  };

  return (
    <div ref={containerRef} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <h3 className="text-sm font-medium text-slate-400 p-4 pb-0 uppercase tracking-wide">Piano Roll</h3>
      <canvas
        ref={canvasRef}
        className="w-full cursor-crosshair"
        style={{ height: "280px" }}
        onClick={handleClick}
      />
    </div>
  );
}
