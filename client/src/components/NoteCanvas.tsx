import { useEffect, useRef } from "react";
import { computeKeyLayout } from "@pianojam/shared";
import { getTrails, TRAIL_SPEED } from "../audio/trails";

const LAYOUT = computeKeyLayout();
const LAYOUT_BY_MIDI = new Map(LAYOUT.map((k) => [k.midi, k]));

/**
 * Draws the trailing notes on a single canvas inside one
 * requestAnimationFrame loop. No React re-renders happen while playing -
 * the loop pulls trail data straight from the shared mutable model.
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

    const draw = () => {
      raf = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, width, height);
      const now = performance.now() / 1000;

      for (const trail of getTrails(height)) {
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

        ctx.globalAlpha = trail.remote ? 0.55 : 0.9;
        ctx.fillStyle = trail.color;
        roundRect(ctx, x + w * 0.08, top, w * 0.84, trailHeight, Math.min(6, w * 0.3));
        ctx.fill();
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
