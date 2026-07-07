import { create } from "zustand";
import type { SongData, SongPlayback, SongScore } from "@pianojam/shared";

/**
 * React-facing Song Mode state. The timing-critical work (audio scheduling,
 * grading, the falling-note view) lives outside React in song/engine.ts;
 * this store holds what panels and the roster render.
 */

export interface SoloState {
  active: boolean;
  correct: number;
  wrong: number;
  /** 0..100, of the current run. */
  accuracy: number;
  /** Accuracy of the last finished run, shown until the next one. */
  lastAccuracy: number | null;
}

const IDLE_SOLO: SoloState = {
  active: false,
  correct: 0,
  wrong: 0,
  accuracy: 100,
  lastAccuracy: null,
};

interface SongStoreState {
  song: SongData | null;
  loadedBy: string | null;
  /** Latest room-wide playback snapshot (position is stale; ask the engine). */
  playback: SongPlayback | null;
  /** Live Keep Up scores by player name (includes self). */
  scores: Record<string, SongScore>;
  solo: SoloState;
  /** The end-of-song Keep Up results dialog. */
  summaryOpen: boolean;
  setSong: (song: SongData, loadedBy: string) => void;
  setPlayback: (playback: SongPlayback) => void;
  setScore: (name: string, score: SongScore) => void;
  /** Merges a batch of scores (used with the room state on join). */
  mergeScores: (scores: Record<string, SongScore>) => void;
  clearScores: () => void;
  setSolo: (partial: Partial<SoloState>) => void;
  setSummaryOpen: (open: boolean) => void;
  reset: () => void;
}

export const useSongStore = create<SongStoreState>((set) => ({
  song: null,
  loadedBy: null,
  playback: null,
  scores: {},
  solo: IDLE_SOLO,
  summaryOpen: false,

  setSong: (song, loadedBy) =>
    set({ song, loadedBy, scores: {}, summaryOpen: false, solo: IDLE_SOLO }),
  setPlayback: (playback) => set({ playback }),
  setScore: (name, score) => set((s) => ({ scores: { ...s.scores, [name]: score } })),
  mergeScores: (scores) => set((s) => ({ scores: { ...s.scores, ...scores } })),
  clearScores: () => set({ scores: {} }),
  setSolo: (partial) => set((s) => ({ solo: { ...s.solo, ...partial } })),
  setSummaryOpen: (summaryOpen) => set({ summaryOpen }),
  reset: () =>
    set({
      song: null,
      loadedBy: null,
      playback: null,
      scores: {},
      solo: IDLE_SOLO,
      summaryOpen: false,
    }),
}));
