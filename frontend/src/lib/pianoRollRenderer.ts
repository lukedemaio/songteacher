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
const PIANO_KEY_HEIGHT = 40;

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

  const noteAreaHeight = h - PIANO_KEY_HEIGHT;
  const pitchWidth = w / PITCH_RANGE;

  // Viewport: time flows top-to-bottom
  const viewStart = scrollOffset;
  const viewDuration = noteAreaHeight / TIME_SCALE;
  const viewEnd = viewStart + viewDuration;

  // Draw vertical grid lines (per pitch)
  for (let p = PITCH_MIN; p <= PITCH_MAX; p++) {
    const x = ((p - PITCH_MIN) / PITCH_RANGE) * w;
    // Highlight octave lines (C notes)
    if (p % 12 === 0) {
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
    } else {
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 0.5;
    }
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, noteAreaHeight);
    ctx.stroke();
  }

  // Draw notes (only visible ones for performance)
  for (const note of notes) {
    if (note.end_time < viewStart || note.start_time > viewEnd) continue;
    if (note.pitch < PITCH_MIN || note.pitch > PITCH_MAX) continue;

    const x = ((note.pitch - PITCH_MIN) / PITCH_RANGE) * w;
    const yStart = (note.start_time - viewStart) * TIME_SCALE;
    const yEnd = (note.end_time - viewStart) * TIME_SCALE;
    const noteHeight = Math.max(yEnd - yStart, 2);

    const isActive = currentTime >= note.start_time && currentTime <= note.end_time;

    ctx.fillStyle = isActive ? ACTIVE_NOTE_COLOR : NOTE_COLOR;
    ctx.globalAlpha = isActive ? 1.0 : 0.7 + (note.velocity / 127) * 0.3;

    const radius = Math.min(2, noteHeight / 2, pitchWidth / 2);
    roundRect(ctx, x, yStart, Math.max(pitchWidth - 1, 2), noteHeight, radius);
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

  // Draw cursor (horizontal line)
  const cursorY = (currentTime - viewStart) * TIME_SCALE;
  if (cursorY >= 0 && cursorY <= noteAreaHeight) {
    ctx.strokeStyle = CURSOR_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, cursorY);
    ctx.lineTo(w, cursorY);
    ctx.stroke();
  }

  // Draw piano keys at bottom (horizontal bar)
  for (let p = PITCH_MIN; p <= PITCH_MAX; p++) {
    const x = ((p - PITCH_MIN) / PITCH_RANGE) * w;
    const noteInOctave = p % 12;
    const isBlack = BLACK_KEYS.has(noteInOctave);

    ctx.fillStyle = isBlack ? "#1e293b" : "#334155";
    ctx.fillRect(x, noteAreaHeight, pitchWidth - 0.5, PIANO_KEY_HEIGHT - 1);

    // C labels
    if (noteInOctave === 0) {
      const octave = Math.floor(p / 12) - 1;
      ctx.fillStyle = "#94a3b8";
      ctx.font = "9px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(`C${octave}`, x + pitchWidth / 2, noteAreaHeight + PIANO_KEY_HEIGHT * 0.65);
      ctx.textAlign = "start";
    }
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
