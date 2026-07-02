import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ThemeColors {
  background: string;
  whiteTrail: string;
  blackTrail: string;
}

export const DEFAULT_THEME: ThemeColors = {
  background: "#0d1117",
  whiteTrail: "#6ee7ff",
  blackTrail: "#a78bfa",
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
