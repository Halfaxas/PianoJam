import { create } from "zustand";

/**
 * Live keyboard feedback for Song Mode practice (Wait mode): each held key
 * gets a verdict so the on-screen keyboard can light it green or red. The
 * song engine recomputes the map every tick; setKeys diffs before writing
 * so keys only re-render when their verdict actually changes.
 */

export type PracticeKeyState = "correct" | "wrong" | "overheld";

interface PracticeKeysState {
  keys: ReadonlyMap<number, PracticeKeyState>;
  setKeys: (next: Map<number, PracticeKeyState>) => void;
  clear: () => void;
}

export const usePracticeKeys = create<PracticeKeysState>((set, get) => ({
  keys: new Map(),

  setKeys: (next) => {
    const prev = get().keys;
    if (prev.size === next.size) {
      let same = true;
      for (const [midi, state] of next) {
        if (prev.get(midi) !== state) {
          same = false;
          break;
        }
      }
      if (same) return;
    }
    set({ keys: next });
  },

  clear: () => {
    if (get().keys.size > 0) set({ keys: new Map() });
  },
}));

export function usePracticeKeyState(midi: number): PracticeKeyState | null {
  return usePracticeKeys((s) => s.keys.get(midi) ?? null);
}
