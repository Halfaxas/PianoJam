import { create } from "zustand";

export type PanelId = "sound" | "metronome" | "theme" | "settings" | null;

/**
 * Which room-page panel is open. Lives in a store (not component state) so
 * non-React code can open panels too, e.g. showing the metronome when the
 * admin starts it for everyone.
 */
interface UiState {
  openPanel: PanelId;
  setOpenPanel: (panel: PanelId) => void;
}

export const useUiStore = create<UiState>((set) => ({
  openPanel: null,
  setOpenPanel: (openPanel) => set({ openPanel }),
}));
