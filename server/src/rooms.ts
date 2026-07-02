import crypto from "node:crypto";
import type { Player, RoomSettings, RoomSummary, SoundMode } from "@pianojam/shared";
import { DEFAULT_ROOM_INSTRUMENT, ROOM_LIMITS } from "@pianojam/shared";

export interface Room {
  id: string;
  settings: RoomSettings;
  /** Current room-wide instrument (admin sound mode). */
  instrumentId: string;
  /** Secret returned to the creator; presenting it on join claims admin. */
  adminToken: string;
  /** socket.id -> player */
  players: Map<string, Player>;
  /** Pending deletion while the room sits empty. */
  deleteTimer: NodeJS.Timeout | null;
}

/**
 * How long an empty room survives. Covers the gap between creating a room
 * and joining it, page refreshes, and React StrictMode's double-mount in
 * dev (join, leave, join), all of which would otherwise hit a room that
 * was deleted the instant it became empty.
 */
const EMPTY_ROOM_TTL_MS = 60_000;

const ADJECTIVES = [
  "Mellow", "Electric", "Velvet", "Golden", "Midnight", "Cosmic", "Smooth",
  "Wild", "Gentle", "Roaring", "Dreamy", "Funky", "Silent", "Radiant",
  "Stormy", "Lucid", "Vintage", "Neon", "Crimson", "Azure",
];

const GENRES = [
  "Jazz", "Blues", "Sonata", "Waltz", "Nocturne", "Prelude", "Etude",
  "Ballad", "Groove", "Rhapsody", "Serenade", "Fugue", "Tango", "Bossa",
  "Swing", "Ragtime", "Minuet", "Concerto", "Lullaby", "Overture",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export type JoinResult =
  | { ok: true; room: Room }
  | { ok: false; error: string; code: "NICKNAME_TAKEN" | "ROOM_FULL" | "NOT_FOUND" };

export class RoomManager {
  private rooms = new Map<string, Room>();

  generateId(): string {
    for (let attempt = 0; attempt < 50; attempt++) {
      const id =
        pick(ADJECTIVES) +
        pick(GENRES) +
        (attempt < 10 ? "" : String(Math.floor(Math.random() * 100)));
      if (!this.rooms.has(id)) return id;
    }
    return `Room${Date.now().toString(36)}`;
  }

  create(input: {
    name: string;
    maxPlayers: number;
    chatEnabled: boolean;
    soundMode: SoundMode;
  }): Room | string {
    const name = String(input.name ?? "").trim().slice(0, ROOM_LIMITS.nameMax);
    const maxPlayers = Math.floor(Number(input.maxPlayers));
    if (
      !Number.isFinite(maxPlayers) ||
      maxPlayers < ROOM_LIMITS.minPlayers ||
      maxPlayers > ROOM_LIMITS.maxPlayers
    ) {
      return `Max players must be between ${ROOM_LIMITS.minPlayers} and ${ROOM_LIMITS.maxPlayers}.`;
    }
    const soundMode: SoundMode = input.soundMode === "orchestra" ? "orchestra" : "admin";
    const id = this.generateId();
    const room: Room = {
      id,
      settings: {
        name: name || id,
        maxPlayers,
        chatEnabled: Boolean(input.chatEnabled),
        soundMode,
      },
      instrumentId: DEFAULT_ROOM_INSTRUMENT,
      adminToken: crypto.randomBytes(16).toString("hex"),
      players: new Map(),
      deleteTimer: null,
    };
    this.rooms.set(id, room);
    this.scheduleDeletion(room);
    return room;
  }

  private scheduleDeletion(room: Room): void {
    if (room.deleteTimer) clearTimeout(room.deleteTimer);
    room.deleteTimer = setTimeout(() => {
      if (room.players.size === 0) this.rooms.delete(room.id);
    }, EMPTY_ROOM_TTL_MS);
    room.deleteTimer.unref?.();
  }

  get(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  join(
    roomId: string,
    socketId: string,
    profile: { nickname: string; avatar: string },
    adminToken: string | undefined,
  ): JoinResult | { ok: true; room: Room; player: Player } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return {
        ok: false,
        error: "Room not found. It may have closed when everyone left.",
        code: "NOT_FOUND",
      };
    }
    if (room.players.size >= room.settings.maxPlayers) {
      return { ok: false, error: "This room is full.", code: "ROOM_FULL" };
    }
    const taken = [...room.players.values()].some(
      (p) => p.name.toLowerCase() === profile.nickname.toLowerCase(),
    );
    if (taken) {
      return {
        ok: false,
        error: `The nickname "${profile.nickname}" is already used in this room. Pick another one.`,
        code: "NICKNAME_TAKEN",
      };
    }

    const hasAdmin = [...room.players.values()].some((p) => p.isAdmin);
    const isAdmin = !hasAdmin && adminToken === room.adminToken;
    const player: Player = {
      id: socketId,
      name: profile.nickname,
      avatar: profile.avatar,
      instrumentId:
        room.settings.soundMode === "admin" ? room.instrumentId : DEFAULT_ROOM_INSTRUMENT,
      isAdmin,
      mutedChat: false,
      mutedNotes: false,
    };

    if (room.deleteTimer) {
      clearTimeout(room.deleteTimer);
      room.deleteTimer = null;
    }
    room.players.set(socketId, player);
    return { ok: true, room, player };
  }

  /**
   * Removes the player. Promotes the longest-present player to admin if the
   * admin left; an empty room is deleted after a grace period.
   */
  leave(roomId: string, playerId: string): Room | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    const leaving = room.players.get(playerId);
    room.players.delete(playerId);
    if (room.players.size === 0) {
      this.scheduleDeletion(room);
      return undefined;
    }
    if (leaving?.isAdmin) {
      const next = room.players.values().next().value;
      if (next) next.isAdmin = true;
    }
    return room;
  }

  /**
   * Applies an instrument change according to the room's sound mode.
   * Returns what changed, or null when the request is not allowed.
   */
  setInstrument(
    roomId: string,
    playerId: string,
    instrumentId: string,
  ): { scope: "room" | "player"; room: Room } | null {
    const room = this.rooms.get(roomId);
    const player = room?.players.get(playerId);
    if (!room || !player) return null;

    if (room.settings.soundMode === "admin") {
      if (!player.isAdmin) return null;
      room.instrumentId = instrumentId;
      for (const p of room.players.values()) p.instrumentId = instrumentId;
      return { scope: "room", room };
    }

    player.instrumentId = instrumentId;
    return { scope: "player", room };
  }

  /**
   * Admin kicks another player. Returns the kicked player, or null when the
   * request is not allowed (not admin, unknown target, or self-kick).
   */
  kick(roomId: string, adminId: string, targetId: string): Player | null {
    const room = this.rooms.get(roomId);
    const admin = room?.players.get(adminId);
    const target = room?.players.get(targetId);
    if (!room || !admin?.isAdmin || !target || targetId === adminId) return null;
    room.players.delete(targetId);
    if (room.players.size === 0) this.scheduleDeletion(room);
    return target;
  }

  /** Admin mutes/unmutes a player's chat and/or playing. */
  setMute(
    roomId: string,
    adminId: string,
    targetId: string,
    mute: { chat: boolean; notes: boolean },
  ): Player | null {
    const room = this.rooms.get(roomId);
    const admin = room?.players.get(adminId);
    const target = room?.players.get(targetId);
    if (!room || !admin?.isAdmin || !target || targetId === adminId) return null;
    target.mutedChat = mute.chat;
    target.mutedNotes = mute.notes;
    return target;
  }

  /**
   * Admin switches the room's sound mode. Leaving orchestra mode forces
   * every player onto the instrument the admin has selected at that moment.
   * Returns whether an instrument change must be broadcast.
   */
  setMode(
    roomId: string,
    adminId: string,
    mode: SoundMode,
  ): { room: Room; instrumentForced: boolean } | null {
    const room = this.rooms.get(roomId);
    const admin = room?.players.get(adminId);
    if (!room || !admin?.isAdmin || room.settings.soundMode === mode) return null;
    room.settings.soundMode = mode;
    if (mode === "admin") {
      room.instrumentId = admin.instrumentId;
      for (const p of room.players.values()) p.instrumentId = admin.instrumentId;
      return { room, instrumentForced: true };
    }
    return { room, instrumentForced: false };
  }

  list(): RoomSummary[] {
    return [...this.rooms.values()].map((room) => this.summarize(room));
  }

  summarize(room: Room): RoomSummary {
    return {
      id: room.id,
      ...room.settings,
      instrumentId: room.instrumentId,
      playerCount: room.players.size,
    };
  }
}
