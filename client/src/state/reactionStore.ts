import { create } from "zustand";
import type { ReactionId } from "@pianojam/shared";

/**
 * Reactions currently floating on screen. Each one lives for a moment near
 * the sender's roster chip and then disappears; nothing is kept.
 */
export interface FloatingReaction {
  id: number;
  from: string;
  reaction: ReactionId;
  /** Horizontal jitter (percent) so stacked reactions don't overlap. */
  x: number;
}

const LIFETIME_MS = 2600;

interface ReactionState {
  reactions: FloatingReaction[];
  add: (from: string, reaction: ReactionId) => void;
  clear: () => void;
}

let nextId = 1;

export const useReactionStore = create<ReactionState>((set) => ({
  reactions: [],
  add: (from, reaction) => {
    const id = nextId++;
    set((s) => ({
      reactions: [...s.reactions, { id, from, reaction, x: 10 + Math.random() * 60 }],
    }));
    setTimeout(() => {
      set((s) => ({ reactions: s.reactions.filter((r) => r.id !== id) }));
    }, LIFETIME_MS);
  },
  clear: () => set({ reactions: [] }),
}));
