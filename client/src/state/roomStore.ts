import { create } from "zustand";
import type { ChatMessage, Player, RoomSummary } from "@pianojam/shared";

type RoomStatus = "idle" | "joined" | "error";

interface RoomState {
  status: RoomStatus;
  room: RoomSummary | null;
  players: Player[];
  self: Player | null;
  /** Current invite token for this room (any member can share the link). */
  inviteToken: string | null;
  error: string | null;
  messages: ChatMessage[];
  chatOpen: boolean;
  unread: number;
  setJoined: (
    room: RoomSummary,
    players: Player[],
    self: Player,
    inviteToken: string,
  ) => void;
  setError: (error: string) => void;
  setRoom: (room: RoomSummary) => void;
  setPlayers: (players: Player[]) => void;
  setRoomInstrument: (instrumentId: string) => void;
  setInviteToken: (inviteToken: string) => void;
  addMessage: (message: ChatMessage, countUnread?: boolean) => void;
  setChatOpen: (open: boolean) => void;
  leave: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  status: "idle",
  room: null,
  players: [],
  self: null,
  inviteToken: null,
  error: null,
  messages: [],
  chatOpen: false,
  unread: 0,

  setJoined: (room, players, self, inviteToken) =>
    set({
      status: "joined",
      room,
      players,
      self,
      inviteToken,
      error: null,
      messages: [
        {
          from: "PianoJam",
          text: `Welcome to ${room.name}! Everyone in this room hears what you play.`,
          ts: Date.now(),
        },
      ],
      unread: 0,
    }),
  setError: (error) => set({ status: "error", error }),
  setRoom: (room) => set({ room }),
  // Keep `self` in sync: admin promotion or instrument changes arrive here.
  setPlayers: (players) =>
    set((s) => ({
      players,
      self: s.self ? (players.find((p) => p.id === s.self!.id) ?? s.self) : s.self,
    })),
  setRoomInstrument: (instrumentId) =>
    set((s) => ({ room: s.room ? { ...s.room, instrumentId } : s.room })),
  setInviteToken: (inviteToken) => set({ inviteToken }),
  // countUnread=false keeps locally muted senders from raising the badge.
  addMessage: (message, countUnread = true) =>
    set((s) => ({
      messages: [...s.messages.slice(-199), message],
      unread: s.chatOpen ? 0 : countUnread ? s.unread + 1 : s.unread,
    })),
  setChatOpen: (open) => set((s) => ({ chatOpen: open, unread: open ? 0 : s.unread })),
  leave: () =>
    set({
      status: "idle",
      room: null,
      players: [],
      self: null,
      inviteToken: null,
      error: null,
      messages: [],
      chatOpen: false,
      unread: 0,
    }),
}));

export function useIsAdmin(): boolean {
  return useRoomStore((s) => s.self?.isAdmin ?? false);
}
