/**
 * Trailing-note data model. Kept as a plain array mutated from note events
 * and consumed by the canvas render loop - no React state involved, so a
 * flurry of notes never causes re-renders.
 */

export interface Trail {
  midi: number;
  /** performance.now()/1000 when the key went down. */
  start: number;
  /** Set when the key is released; null while still held. */
  end: number | null;
  color: string;
  /** True for notes played by other people in the room. */
  remote: boolean;
}

export const TRAIL_SPEED = 160; // px per second upward

const trails: Trail[] = [];
const activeByKey = new Map<string, Trail>();

const now = () => performance.now() / 1000;

export function trailStart(midi: number, owner: string, color: string, remote: boolean): void {
  const key = `${owner}:${midi}`;
  // Guard against duplicate note-on without a matching note-off.
  trailEnd(midi, owner);
  const trail: Trail = { midi, start: now(), end: null, color, remote };
  trails.push(trail);
  activeByKey.set(key, trail);
}

export function trailEnd(midi: number, owner: string): void {
  const key = `${owner}:${midi}`;
  const trail = activeByKey.get(key);
  if (trail) {
    trail.end = now();
    activeByKey.delete(key);
  }
}

export function endAllFrom(owner: string): void {
  const t = now();
  for (const [key, trail] of activeByKey) {
    if (key.startsWith(owner + ":")) {
      trail.end = t;
      activeByKey.delete(key);
    }
  }
}

/** Live view for the canvas loop; prunes trails that scrolled off-screen. */
export function getTrails(viewportHeight: number): readonly Trail[] {
  const t = now();
  for (let i = trails.length - 1; i >= 0; i--) {
    const trail = trails[i]!;
    if (trail.end === null) continue;
    const bottomY = viewportHeight - (t - trail.end) * TRAIL_SPEED;
    if (bottomY < -20) trails.splice(i, 1);
  }
  return trails;
}

export function clearTrails(): void {
  trails.length = 0;
  activeByKey.clear();
}
