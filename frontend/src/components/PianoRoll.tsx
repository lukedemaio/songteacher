import { useEffect, useRef } from "react";
import type { NoteEvent } from "../types";
import { renderPianoRoll, TIME_SCALE, PIANO_KEY_HEIGHT, CURSOR_FRACTION } from "../lib/pianoRollRenderer";

interface Props {
  notes: NoteEvent[];
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  emptyMessage?: string;
}

export function PianoRoll({ notes, currentTime, duration, onSeek, emptyMessage }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    renderPianoRoll(ctx, notes, currentTime, rect.width, rect.height, 0);
  }, [notes, currentTime]);

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
      renderPianoRoll(ctx, notes, currentTime, rect.width, rect.height, 0);
    });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, [notes, currentTime]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;

    // Ignore clicks in bottom piano key area
    const noteAreaHeight = rect.height - PIANO_KEY_HEIGHT;
    if (y > noteAreaHeight) return;

    // Inverted Y: y = cursorYPos - (time - currentTime) * TIME_SCALE
    // Solving for time: time = currentTime - (y - cursorYPos) / TIME_SCALE
    const cursorYPos = noteAreaHeight * CURSOR_FRACTION;
    const time = currentTime - (y - cursorYPos) / TIME_SCALE;
    onSeek(Math.max(0, Math.min(time, duration)));
  };

  if (!notes.length && emptyMessage) {
    return (
      <div ref={containerRef} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <h3 className="text-sm font-medium text-slate-400 p-4 pb-0 uppercase tracking-wide">Piano Roll</h3>
        <div className="flex items-center justify-center text-slate-500" style={{ height: "500px" }}>
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <h3 className="text-sm font-medium text-slate-400 p-4 pb-0 uppercase tracking-wide">Piano Roll</h3>
      <canvas
        ref={canvasRef}
        className="w-full cursor-crosshair"
        style={{ height: "500px" }}
        onClick={handleClick}
      />
    </div>
  );
}
