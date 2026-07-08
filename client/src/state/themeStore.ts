import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ThemeColors {
  background: string;
  whiteTrail: string;
  blackTrail: string;
}

// Defaults mirror the app's brass accent (--accent) and a deeper sibling
// for black keys; users can repaint them freely in the Colors panel.
export const DEFAULT_THEME: ThemeColors = {
  background: "#131110",
  whiteTrail: "#dfa94d",
  blackTrail: "#c96f45",
};

interface ThemeState extends ThemeColors {
  setColor: (key: keyof ThemeColors, value: string) => void;
  reset: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      ...DEFAULT_THEME,
      setColor: (key, value) => set({ [key]: value }),
      reset: () => set({ ...DEFAULT_THEME }),
    }),
    { name: "pianojam-theme" },
  ),
);
