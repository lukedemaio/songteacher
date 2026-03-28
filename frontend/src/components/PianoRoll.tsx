import { useEffect, useRef, useCallback } from "react";
import type { NoteEvent } from "../types";
import { renderPianoRoll, TIME_SCALE, PIANO_KEY_HEIGHT, CURSOR_FRACTION } from "../lib/pianoRollRenderer";

interface Props {
  notes: NoteEvent[];
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  subscribe: (cb: (time: number) => void) => () => void;
  emptyMessage?: string;
}

export function PianoRoll({ notes, currentTime, duration, onSeek, subscribe, emptyMessage }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef(currentTime);
  const notesRef = useRef(notes);

  // Keep refs in sync with props
  useEffect(() => { notesRef.current = notes; }, [notes]);
  useEffect(() => { timeRef.current = currentTime; }, [currentTime]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    renderPianoRoll(ctx, notesRef.current, timeRef.current, rect.width, rect.height, 0);
  }, []);

  // Subscribe to playback time — drives the render loop without React re-renders
  useEffect(() => {
    const unsub = subscribe((t) => {
      timeRef.current = t;
      draw();
    });
    return unsub;
  }, [subscribe, draw]);

  // Initial draw + resize handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      draw();
    };

    handleResize();

    const observer = new ResizeObserver(handleResize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  // Redraw when notes change (new song / stem switch)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    draw();
  }, [notes, draw]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;

    const noteAreaHeight = rect.height - PIANO_KEY_HEIGHT;
    if (y > noteAreaHeight) return;

    const cursorYPos = noteAreaHeight * CURSOR_FRACTION;
    const time = timeRef.current - (y - cursorYPos) / TIME_SCALE;
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
