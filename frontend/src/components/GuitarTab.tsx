import { useEffect, useRef, useCallback } from "react";
import type { GuitarTabNote } from "../types";

interface Props {
  tabNotes: GuitarTabNote[];
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  subscribe: (cb: (time: number) => void) => () => void;
  emptyMessage?: string;
}

const STRING_NAMES = ["e", "B", "G", "D", "A", "E"];
const LINE_SPACING = 20;
const TIME_SCALE = 60; // px per second
const LEFT_MARGIN = 30;
const VIEW_WINDOW = 10; // seconds visible
const CANVAS_HEIGHT = 160;

export function GuitarTab({ tabNotes, currentTime, duration, onSeek, subscribe, emptyMessage }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(currentTime);
  const notesRef = useRef(tabNotes);

  useEffect(() => { notesRef.current = tabNotes; }, [tabNotes]);
  useEffect(() => { timeRef.current = currentTime; }, [currentTime]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.getBoundingClientRect().width;
    const h = CANVAS_HEIGHT;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, w, h);

    const t = timeRef.current;
    const notes = notesRef.current;
    const viewStart = Math.max(0, t - VIEW_WINDOW * 0.25);

    // String lines + labels
    for (let i = 0; i < STRING_NAMES.length; i++) {
      const y = 20 + i * LINE_SPACING;
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(LEFT_MARGIN, y);
      ctx.lineTo(w - 10, y);
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.font = "11px monospace";
      ctx.textAlign = "left";
      ctx.fillText(STRING_NAMES[i], 4, y + 4);
    }

    // Fret numbers
    const viewEnd = viewStart + VIEW_WINDOW;
    for (const note of notes) {
      if (note.end_time < viewStart || note.start_time > viewEnd) continue;

      const x = LEFT_MARGIN + (note.start_time - viewStart) * TIME_SCALE;
      const y = 20 + (note.string - 1) * LINE_SPACING;
      const isActive = t >= note.start_time && t <= note.end_time;

      // Background rect
      ctx.fillStyle = isActive ? "#6366f1" : "#1e293b";
      ctx.beginPath();
      ctx.roundRect(x - 7, y - 9, 14, 18, 3);
      ctx.fill();

      // Fret text
      ctx.fillStyle = isActive ? "#fff" : "#94a3b8";
      ctx.font = `${isActive ? "bold " : ""}12px monospace`;
      ctx.textAlign = "center";
      ctx.fillText(String(note.fret), x, y + 4);
    }

    // Cursor
    const cursorX = LEFT_MARGIN + (t - viewStart) * TIME_SCALE;
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 2]);
    ctx.beginPath();
    ctx.moveTo(cursorX, 8);
    ctx.lineTo(cursorX, h - 8);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }, []);

  // Subscribe to playback time
  useEffect(() => {
    const unsub = subscribe((t) => {
      timeRef.current = t;
      draw();
    });
    return unsub;
  }, [subscribe, draw]);

  // Initial draw + resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = CANVAS_HEIGHT * dpr;
      draw();
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  // Redraw on notes change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    draw();
  }, [tabNotes, draw]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < LEFT_MARGIN) return;
    const viewStart = Math.max(0, timeRef.current - VIEW_WINDOW * 0.25);
    const time = viewStart + (x - LEFT_MARGIN) / TIME_SCALE;
    onSeek(Math.max(0, Math.min(time, duration)));
  };

  if (!tabNotes.length) {
    if (emptyMessage) {
      return (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 overflow-hidden">
          <h3 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wide">Guitar Tab</h3>
          <div className="flex items-center justify-center text-slate-500 py-8">
            {emptyMessage}
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 overflow-hidden">
      <h3 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wide">Guitar Tab</h3>
      <canvas
        ref={canvasRef}
        className="w-full cursor-crosshair"
        style={{ height: `${CANVAS_HEIGHT}px` }}
        onClick={handleClick}
      />
    </div>
  );
}
