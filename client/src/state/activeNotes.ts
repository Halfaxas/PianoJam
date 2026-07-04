import { create } from "zustand";

/**
 * Currently sounding keys. A key can be held simultaneously by the local
 * player and remote peers, so each midi maps to the set of holders and a
 * key stays lit until everyone releases it.
 */
interface ActiveNotesState {
  holders: Map<number, Set<string>>;
  press: (midi: number, owner: string) => void;
  release: (midi: number, owner: string) => void;
  clear: () => void;
}

export const useActiveNotes = create<ActiveNotesState>((set) => ({
  holders: new Map(),

  press: (midi, owner) =>
    set((state) => {
      const holders = new Map(state.holders);
      const owners = new Set(holders.get(midi) ?? []);
      owners.add(owner);
      holders.set(midi, owners);
      return { holders };
    }),

  release: (midi, owner) =>
    set((state) => {
      const owners = state.holders.get(midi);
      if (!owners?.has(owner)) return state;
      const holders = new Map(state.holders);
      const next = new Set(owners);
      next.delete(owner);
      if (next.size === 0) holders.delete(midi);
      else holders.set(midi, next);
      return { holders };
    }),

  clear: () => set({ holders: new Map() }),
}));

export function useIsNoteActive(midi: number): boolean {
  return useActiveNotes((s) => s.holders.has(midi));
}
