import crypto from "node:crypto";
import type {
  Player,
  RoomSettings,
  RoomSummary,
  RoomVisibility,
  SongControl,
  SongData,
  SongPlayback,
  SongPlayMode,
  SongScore,
  SoundMode,
} from "@pianojam/shared";
import {
  DEFAULT_ROOM_INSTRUMENT,
  idleSongPlayback,
  ROOM_LIMITS,
  SONG_LIMITS,
} from "@pianojam/shared";

export interface Room {
  id: string;
  settings: RoomSettings;
  /** Current room-wide instrument (admin sound mode). */
  instrumentId: string;
  /** Secret returned to the creator; presenting it on join claims admin. */
  adminToken: string;
  /** Grants entry while the room is private or hidden. */
  inviteToken: string;
  /** socket.id -> player */
  players: Map<string, Player>;
  /** Pending deletion while the room sits empty. */
  deleteTimer: NodeJS.Timeout | null;
  /** Currently loaded song (one per room; loading replaces it). */
  song: SongData | null;
  /**
   * Room-wide playback. positionSec is the position at updatedAtMs; while
   * playing, the live position advances at `rate` song-seconds per second.
   */
  songPlayback: SongPlayback;
  songUpdatedAtMs: number;
  /** Latest Keep Up score per player name, kept for late joiners. */
  songScores: Map<string, SongScore>;
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
  | {
      ok: false;
      error: string;
      code: "NICKNAME_TAKEN" | "ROOM_FULL" | "NOT_FOUND" | "INVITE_INVALID";
    };

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
    visibility: RoomVisibility;
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
        visibility: input.visibility,
      },
      instrumentId: DEFAULT_ROOM_INSTRUMENT,
      adminToken: crypto.randomBytes(16).toString("hex"),
      // Generated for every room regardless of visibility, so a public
      // room can turn private later without changing the join flow.
      inviteToken: crypto.randomBytes(16).toString("hex"),
      players: new Map(),
      deleteTimer: null,
      song: null,
      songPlayback: idleSongPlayback(),
      songUpdatedAtMs: Date.now(),
      songScores: new Map(),
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
    inviteToken: string | undefined,
  ): JoinResult | { ok: true; room: Room; player: Player } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return {
        ok: false,
        error: "Room not found. It may have closed when everyone left.",
        code: "NOT_FOUND",
      };
    }
    // Private/hidden rooms need the invite link. The admin token also grants
    // entry so the room's creator is never locked out of their own room.
    if (
      room.settings.visibility !== "public" &&
      inviteToken !== room.inviteToken &&
      adminToken !== room.adminToken
    ) {
      return {
        ok: false,
        error:
          "This room is invite-only. Ask someone in the room for a fresh invite link.",
        code: "INVITE_INVALID",
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

  /** Admin changes who can find and enter the room. */
  setVisibility(roomId: string, adminId: string, visibility: RoomVisibility): Room | null {
    const room = this.rooms.get(roomId);
    const admin = room?.players.get(adminId);
    if (!room || !admin?.isAdmin || room.settings.visibility === visibility) return null;
    room.settings.visibility = visibility;
    return room;
  }

  /**
   * Admin mints a new invite token. Previously shared links stop working;
   * players already in the room are unaffected.
   */
  regenerateInvite(roomId: string, adminId: string): string | null {
    const room = this.rooms.get(roomId);
    const admin = room?.players.get(adminId);
    if (!room || !admin?.isAdmin) return null;
    room.inviteToken = crypto.randomBytes(16).toString("hex");
    return room.inviteToken;
  }

  /**
   * The live playback snapshot. While playing, the position advances with
   * the wall clock; a song that ran past its end settles into "stopped"
   * (scores are kept until the next load or start).
   */
  songPlaybackNow(room: Room): SongPlayback {
    const pb = room.songPlayback;
    if (pb.state === "playing" && room.song) {
      const position =
        pb.positionSec + ((Date.now() - room.songUpdatedAtMs) / 1000) * pb.rate;
      if (position >= room.song.durationSec + 1) {
        room.songPlayback = { ...pb, state: "stopped", positionSec: 0 };
        room.songUpdatedAtMs = Date.now();
      } else {
        return { ...pb, positionSec: position };
      }
    }
    return { ...room.songPlayback };
  }

  /** Admin loads a (already sanitized) song, replacing the current one. */
  loadSong(roomId: string, adminId: string, song: SongData): Room | null {
    const room = this.rooms.get(roomId);
    const admin = room?.players.get(adminId);
    if (!room || !admin?.isAdmin) return null;
    room.song = song;
    room.songPlayback = idleSongPlayback();
    room.songUpdatedAtMs = Date.now();
    room.songScores.clear();
    return room;
  }

  /** Admin transport controls; returns the room or null when not allowed. */
  controlSong(roomId: string, adminId: string, control: SongControl): Room | null {
    const room = this.rooms.get(roomId);
    const admin = room?.players.get(adminId);
    if (!room || !admin?.isAdmin || !room.song) return null;

    const pb = this.songPlaybackNow(room);
    const apply = (next: Partial<SongPlayback>) => {
      room.songPlayback = { ...pb, ...next };
      room.songUpdatedAtMs = Date.now();
    };

    switch (control.type) {
      case "play": {
        if (pb.state === "playing") return null;
        if (pb.state === "stopped") {
          // A fresh start: adopt the requested mode and begin before the
          // first note. A resume keeps the mode the session started with.
          const mode: SongPlayMode = control.mode === "keepup" ? "keepup" : "play";
          if (mode === "keepup") room.songScores.clear();
          apply({ mode, state: "playing", positionSec: -SONG_LIMITS.leadInSec });
        } else {
          apply({ state: "playing" });
        }
        return room;
      }
      case "pause":
        if (pb.state !== "playing") return null;
        apply({ state: "paused" });
        return room;
      case "stop":
        if (pb.state === "stopped") return null;
        apply({ state: "stopped", positionSec: 0 });
        return room;
      case "seek": {
        if (pb.state === "stopped") return null;
        const position = Number(control.positionSec);
        if (!Number.isFinite(position)) return null;
        apply({ positionSec: Math.min(room.song.durationSec, Math.max(0, position)) });
        return room;
      }
      case "rate": {
        const rate = Number(control.rate);
        if (!Number.isFinite(rate)) return null;
        apply({
          rate:
            Math.round(
              Math.min(SONG_LIMITS.maxRate, Math.max(SONG_LIMITS.minRate, rate)) * 100,
            ) / 100,
        });
        return room;
      }
      case "transpose": {
        const semitones = Math.round(Number(control.semitones));
        if (!Number.isFinite(semitones)) return null;
        apply({
          transpose: Math.min(
            SONG_LIMITS.maxTranspose,
            Math.max(-SONG_LIMITS.maxTranspose, semitones),
          ),
        });
        return room;
      }
      default:
        return null;
    }
  }

  /** Stores a player's reported Keep Up score (only during a Keep Up song). */
  setSongScore(roomId: string, playerId: string, score: SongScore): Player | null {
    const room = this.rooms.get(roomId);
    const player = room?.players.get(playerId);
    if (!room || !player || !room.song || room.songPlayback.mode !== "keepup") return null;
    room.songScores.set(player.name, score);
    return player;
  }

  list(): RoomSummary[] {
    return [...this.rooms.values()]
      .filter((room) => room.settings.visibility !== "hidden")
      .map((room) => this.summarize(room));
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
