import { create } from "zustand";
import { releaseAllFor } from "../audio/engine";
import { endAllFrom } from "../audio/trails";

/**
 * Per-player mutes that exist only on this device. They change what the
 * local player hears and sees, never what the muted player can do, and are
 * completely separate from the admin's server-enforced moderation mutes.
 * Keyed by player name (the id peer note/chat events carry).
 */
export interface LocalMute {
  /** Don't play this player's notes out loud. */
  audio: boolean;
  /** Don't show this player's falling note trails. */
  notes: boolean;
  /** Hide this player's chat messages. */
  chat: boolean;
}

const NONE: LocalMute = { audio: false, notes: false, chat: false };

interface LocalMuteState {
  mutes: Map<string, LocalMute>;
  toggle: (name: string, kind: keyof LocalMute) => void;
  /** The quick "mute all others" button: audio + notes, chat untouched. */
  setAll: (names: string[], mute: { audio: boolean; notes: boolean }) => void;
  reset: () => void;
}

/** Cut off anything of theirs that is currently sounding or on screen. */
function silenceNow(name: string, mute: LocalMute): void {
  if (mute.audio) releaseAllFor(name);
  if (mute.notes) endAllFrom(name);
}

export const useLocalMuteStore = create<LocalMuteState>((set, get) => ({
  mutes: new Map(),

  toggle: (name, kind) => {
    const mutes = new Map(get().mutes);
    const next = { ...(mutes.get(name) ?? NONE) };
    next[kind] = !next[kind];
    mutes.set(name, next);
    set({ mutes });
    silenceNow(name, { ...NONE, [kind]: next[kind] });
  },

  setAll: (names, mute) => {
    const mutes = new Map(get().mutes);
    for (const name of names) {
      const next = { ...(mutes.get(name) ?? NONE), audio: mute.audio, notes: mute.notes };
      mutes.set(name, next);
      silenceNow(name, { ...NONE, ...mute });
    }
    set({ mutes });
  },

  reset: () => set({ mutes: new Map() }),
}));

/** Non-React read for the hot note/chat paths. */
export function localMuteOf(name: string): LocalMute {
  return useLocalMuteStore.getState().mutes.get(name) ?? NONE;
}
