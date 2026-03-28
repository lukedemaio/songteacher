import type { NoteEvent } from "../types";

const TIME_SCALE = 80; // pixels per second
const PITCH_MIN = 21; // A0
const PITCH_MAX = 108; // C8
const PITCH_RANGE = PITCH_MAX - PITCH_MIN;
const BG_COLOR = "#0f172a";
const GRID_COLOR = "#1e293b";
const NOTE_COLOR = "#6366f1";
const ACTIVE_NOTE_COLOR = "#818cf8";
const CURSOR_COLOR = "#ef4444";
const PIANO_KEY_WIDTH = 40;

// Black keys in an octave
const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

export function renderPianoRoll(
  ctx: CanvasRenderingContext2D,
  notes: NoteEvent[],
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number,
  scrollOffset: number
) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvasWidth;
  const h = canvasHeight;

  ctx.clearRect(0, 0, w * dpr, h * dpr);
  ctx.save();
  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, w, h);

  const noteAreaWidth = w - PIANO_KEY_WIDTH;
  const pitchHeight = h / PITCH_RANGE;

  // Viewport: center on current time
  const viewStart = scrollOffset;
  const viewDuration = noteAreaWidth / TIME_SCALE;
  const viewEnd = viewStart + viewDuration;

  // Draw horizontal grid lines (per pitch)
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 0.5;
  for (let p = PITCH_MIN; p <= PITCH_MAX; p++) {
    const y = h - ((p - PITCH_MIN) / PITCH_RANGE) * h;
    // Highlight octave lines
    if (p % 12 === 0) {
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
    } else {
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 0.5;
    }
    ctx.beginPath();
    ctx.moveTo(PIANO_KEY_WIDTH, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Draw piano keys on left
  for (let p = PITCH_MIN; p <= PITCH_MAX; p++) {
    const y = h - ((p - PITCH_MIN + 1) / PITCH_RANGE) * h;
    const noteInOctave = p % 12;
    const isBlack = BLACK_KEYS.has(noteInOctave);

    ctx.fillStyle = isBlack ? "#1e293b" : "#334155";
    ctx.fillRect(0, y, PIANO_KEY_WIDTH - 1, pitchHeight);

    // C labels
    if (noteInOctave === 0) {
      const octave = Math.floor(p / 12) - 1;
      ctx.fillStyle = "#94a3b8";
      ctx.font = "9px system-ui";
      ctx.fillText(`C${octave}`, 4, y + pitchHeight * 0.75);
    }
  }

  // Draw notes (only visible ones for performance)
  for (const note of notes) {
    if (note.end_time < viewStart || note.start_time > viewEnd) continue;
    if (note.pitch < PITCH_MIN || note.pitch > PITCH_MAX) continue;

    const x = PIANO_KEY_WIDTH + (note.start_time - viewStart) * TIME_SCALE;
    const noteWidth = Math.max((note.end_time - note.start_time) * TIME_SCALE, 2);
    const y = h - ((note.pitch - PITCH_MIN + 1) / PITCH_RANGE) * h;

    const isActive = currentTime >= note.start_time && currentTime <= note.end_time;

    ctx.fillStyle = isActive ? ACTIVE_NOTE_COLOR : NOTE_COLOR;
    ctx.globalAlpha = isActive ? 1.0 : 0.7 + (note.velocity / 127) * 0.3;

    const radius = Math.min(2, noteWidth / 2, pitchHeight / 2);
    roundRect(ctx, x, y, noteWidth, Math.max(pitchHeight - 1, 2), radius);
    ctx.fill();

    // Glow effect for active notes
    if (isActive) {
      ctx.shadowColor = ACTIVE_NOTE_COLOR;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = 1.0;
  }

  // Draw cursor
  const cursorX = PIANO_KEY_WIDTH + (currentTime - viewStart) * TIME_SCALE;
  if (cursorX >= PIANO_KEY_WIDTH && cursorX <= w) {
    ctx.strokeStyle = CURSOR_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cursorX, 0);
    ctx.lineTo(cursorX, h);
    ctx.stroke();
  }

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
