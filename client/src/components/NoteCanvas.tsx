import { useEffect, useRef } from "react";
import { computeKeyLayout, type SongNote } from "@pianojam/shared";
import { getTrails, TRAIL_SPEED } from "../audio/trails";
import { useDisplayStore } from "../state/displayStore";
import {
  FLASH_SEC,
  getGradeFlashes,
  getSongView,
  GRADE,
  WAIT_STATE,
  type GradeKind,
  type SongView,
} from "../song/engine";

const LAYOUT = computeKeyLayout();
const LAYOUT_BY_MIDI = new Map(LAYOUT.map((k) => [k.midi, k]));
/** Pitch-class labels ("C", "F#") for the optional on-note names. */
const NOTE_LABELS = new Map(LAYOUT.map((k) => [k.midi, k.name.replace(/-?\d+$/, "")]));

/** Song Mode colors (theme-independent so they never clash with trails). */
const SONG_NOTE_COLOR = "#f5c04a";
const SONG_NOTE_BLACK_COLOR = "#e8931f";
const GRADE_COLORS: Record<GradeKind, string> = {
  hit: "#4ade80",
  early: "#fbbf24",
  late: "#fbbf24",
  miss: "#f87171",
};
/** Practice (Wait mode): the note to play pulses blue, a correct hold turns
    green, finished notes fade out. */
const WAIT_REQUIRED_COLOR = "#38bdf8";
const WAIT_REQUIRED_EDGE = "#e0f2fe";
const WAIT_HELD_COLOR = "#4ade80";
const WAIT_HELD_EDGE = "#bbf7d0";

/**
 * Draws the trailing notes (rising from the keyboard) and Song Mode's
 * falling notes (dropping toward it) on a single canvas inside one
 * requestAnimationFrame loop. No React re-renders happen while playing -
 * the loop pulls its data straight from the shared mutable models.
 */
export function NoteCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let raf = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    /** First index with note.time >= t (song notes are sorted by time). */
    const lowerBound = (notes: readonly SongNote[], t: number): number => {
      let lo = 0;
      let hi = notes.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (notes[mid]!.time < t) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    };

    /** Pitch-class name drawn near a note's leading edge, if it fits. */
    const drawLabel = (
      midi: number,
      x: number,
      w: number,
      top: number,
      bottom: number,
      alpha: number,
    ) => {
      const label = NOTE_LABELS.get(midi);
      if (!label || w < 10) return;
      const size = Math.max(8, Math.min(11, w * 0.55));
      const y = Math.min(bottom, height) - 5;
      if (y - size < top) return;
      ctx.globalAlpha = Math.min(1, alpha + 0.15);
      ctx.fillStyle = "rgba(8, 12, 18, 0.78)";
      ctx.font = `600 ${size}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(label, x + w / 2, y);
    };

    const drawSong = (nowSec: number, view: SongView | null, labels: boolean) => {
      if (view) {
        // Screen distance reflects real time until impact, so tempo
        // changes stretch the note field accordingly.
        const pxPerSec = TRAIL_SPEED / view.rate;
        const lookahead = height / pxPerSec + 1;
        const notes = view.notes;
        const pulse = 0.55 + 0.45 * Math.sin(nowSec * 6);

        // Start early enough to catch long notes still crossing the line.
        for (let i = lowerBound(notes, view.pos - 32); i < notes.length; i++) {
          const note = notes[i]!;
          if (note.time > view.pos + lookahead) break;
          const midi = note.midi + view.transpose;
          const key = LAYOUT_BY_MIDI.get(midi);
          if (!key) continue;

          const bottom = height - (note.time - view.pos) * pxPerSec;
          const length = Math.max(8, (note.duration / view.rate) * TRAIL_SPEED);
          const top = bottom - length;
          if (bottom < 0 || top > height) continue;

          let color =
            key.color === "black" ? SONG_NOTE_BLACK_COLOR : SONG_NOTE_COLOR;
          let alpha = 0.85;
          let edge: string | null = null;
          let edgeAlpha = 0;
          if (view.waitStates) {
            // Practice: the playhead paints each note's live state.
            const ws = view.waitStates[i]!;
            if (ws === WAIT_STATE.done) {
              color = WAIT_HELD_COLOR;
              alpha = 0.22;
            } else if (ws === WAIT_STATE.held) {
              color = WAIT_HELD_COLOR;
              alpha = 0.95;
              edge = WAIT_HELD_EDGE;
              edgeAlpha = 0.9;
            } else if (ws === WAIT_STATE.required) {
              color = WAIT_REQUIRED_COLOR;
              alpha = 0.5 + 0.35 * pulse;
              edge = WAIT_REQUIRED_EDGE;
              edgeAlpha = pulse;
            } else {
              alpha = 0.55; // upcoming notes recede so the live ones pop
            }
          } else {
            const grade = view.grades?.[i] ?? GRADE.none;
            if (grade === GRADE.hit) color = GRADE_COLORS.hit;
            else if (grade === GRADE.early || grade === GRADE.late) color = GRADE_COLORS.early;
            else if (grade === GRADE.miss) {
              color = GRADE_COLORS.miss;
              alpha = 0.5;
            }
          }

          const x = (key.left / 100) * width;
          const w = (key.width / 100) * width;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = color;
          roundRect(ctx, x + w * 0.12, top, w * 0.76, length, Math.min(5, w * 0.3));
          ctx.fill();

          if (edge) {
            ctx.globalAlpha = edgeAlpha;
            ctx.strokeStyle = edge;
            ctx.lineWidth = 2;
            roundRect(ctx, x + w * 0.12, top, w * 0.76, length, Math.min(5, w * 0.3));
            ctx.stroke();
          }

          if (labels) drawLabel(midi, x, w, top, bottom, alpha);
        }
      }

      // Hit/miss feedback flashes above the keyboard line.
      for (const f of getGradeFlashes()) {
        const key = LAYOUT_BY_MIDI.get(f.midi);
        if (!key) continue;
        const life = 1 - (nowSec - f.at) / FLASH_SEC;
        if (life <= 0) continue;
        const x = (key.left / 100) * width;
        const w = (key.width / 100) * width;
        ctx.globalAlpha = 0.55 * life;
        ctx.fillStyle = GRADE_COLORS[f.kind];
        roundRect(ctx, x + w * 0.06, height - 26, w * 0.88, 26, 5);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const draw = () => {
      raf = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, width, height);
      const now = performance.now() / 1000;

      const view = getSongView();
      const labels = useDisplayStore.getState().noteLabels;
      drawSong(now, view, labels);

      // Any active song session hides the rising trails: they visually
      // clash with the falling notes. getTrails still runs so finished
      // trails keep getting pruned.
      const trails = getTrails(height);
      if (view) {
        ctx.globalAlpha = 1;
        return;
      }
      for (const trail of trails) {
        const key = LAYOUT_BY_MIDI.get(trail.midi);
        if (!key) continue;

        const x = (key.left / 100) * width;
        const w = (key.width / 100) * width;
        const risen = trail.end === null ? 0 : (now - trail.end) * TRAIL_SPEED;
        const heldFor = (trail.end ?? now) - trail.start;
        const trailHeight = Math.max(6, heldFor * TRAIL_SPEED);
        const bottom = height - risen;
        const top = bottom - trailHeight;
        if (bottom < 0 || top > height) continue;

        const alpha = trail.remote ? 0.55 : 0.9;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = trail.color;
        roundRect(ctx, x + w * 0.08, top, w * 0.84, trailHeight, Math.min(6, w * 0.3));
        ctx.fill();

        if (labels) drawLabel(trail.midi, x, w, top, bottom, alpha);
      }
      ctx.globalAlpha = 1;
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="note-canvas" />;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
