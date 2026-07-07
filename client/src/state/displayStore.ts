import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Per-client display preferences (persisted). Purely visual: nothing in
 * here is shared with the room.
 */
interface DisplayState {
  /** Draw note names (C, F#, ...) on falling song notes and rising trails. */
  noteLabels: boolean;
  setNoteLabels: (on: boolean) => void;
}

export const useDisplayStore = create<DisplayState>()(
  persist(
    (set) => ({
      noteLabels: false,
      setNoteLabels: (noteLabels) => set({ noteLabels }),
    }),
    { name: "pianojam-display" },
  ),
);
