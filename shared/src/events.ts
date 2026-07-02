/**
 * Typed Socket.IO contract shared by client and server.
 */

/**
 * Who controls the sound packs in a room. Exclusive or:
 * - "admin": the room admin picks one sound pack for everyone.
 * - "orchestra": every player picks their own instrument.
 */
export type SoundMode = "admin" | "orchestra";

export interface RoomSettings {
  name: string;
  maxPlayers: number;
  chatEnabled: boolean;
  soundMode: SoundMode;
}

export interface RoomSummary extends RoomSettings {
  id: string;
  playerCount: number;
  /** Current room-wide instrument (meaningful in "admin" sound mode). */
  instrumentId: string;
}

export interface Player {
  /** Socket-scoped unique id. */
  id: string;
  /** Nickname chosen when joining; unique within a room. */
  name: string;
  /** Avatar id from AVATARS. */
  avatar: string;
  /** Instrument this player currently plays. */
  instrumentId: string;
  isAdmin: boolean;
  /** Muted by the admin: chat messages are dropped by the server. */
  mutedChat: boolean;
  /** Muted by the admin: notes/pedal are not relayed to the room. */
  mutedNotes: boolean;
}

export interface ChatMessage {
  from: string;
  text: string;
  /** Unix ms timestamp (server clock). */
  ts: number;
}

export interface NoteOnPayload {
  midi: number;
  /** 0..1 */
  velocity: number;
}

export interface NoteOffPayload {
  midi: number;
}

export interface PedalPayload {
  down: boolean;
}

export type JoinErrorCode = "NICKNAME_TAKEN" | "ROOM_FULL" | "NOT_FOUND" | "INVALID";

export type Ack<T> = (
  res: { ok: true; data: T } | { ok: false; error: string; code?: JoinErrorCode },
) => void;

export interface CreateRoomInput {
  name: string;
  maxPlayers: number;
  chatEnabled: boolean;
  soundMode: SoundMode;
}

export interface CreatedRoom {
  room: RoomSummary;
  /** Presenting this token when joining claims room admin. */
  adminToken: string;
}

export interface JoinRoomInput {
  roomId: string;
  nickname: string;
  avatar: string;
  adminToken?: string;
}

export interface JoinedRoom {
  room: RoomSummary;
  players: Player[];
  self: Player;
}

export interface ClientToServerEvents {
  "room:create": (input: CreateRoomInput, ack: Ack<CreatedRoom>) => void;
  "room:join": (input: JoinRoomInput, ack: Ack<JoinedRoom>) => void;
  "room:leave": () => void;
  "room:list": (ack: (rooms: RoomSummary[]) => void) => void;
  "note:on": (payload: NoteOnPayload) => void;
  "note:off": (payload: NoteOffPayload) => void;
  pedal: (payload: PedalPayload) => void;
  "chat:send": (text: string) => void;
  /** Admin mode: admin sets the room instrument. Orchestra: sets your own. */
  "instrument:set": (instrumentId: string) => void;
  /** Admin only: start the metronome for everyone in the room. */
  "metronome:start": (payload: { bpm: number }) => void;
  /** Admin only: remove a player from the room. */
  "room:kick": (playerId: string) => void;
  /** Admin only: mute or unmute a player's chat and/or playing. */
  "room:mute": (payload: { playerId: string; chat: boolean; notes: boolean }) => void;
  /** Admin only: switch the room's sound mode. */
  "room:setMode": (mode: SoundMode) => void;
}

export interface ServerToClientEvents {
  "room:players": (players: Player[]) => void;
  /** Room-wide instrument changed (admin sound mode). */
  "room:instrument": (payload: { instrumentId: string }) => void;
  "peer:note:on": (payload: NoteOnPayload & { from: string }) => void;
  "peer:note:off": (payload: NoteOffPayload & { from: string }) => void;
  "peer:pedal": (payload: PedalPayload & { from: string }) => void;
  "chat:message": (message: ChatMessage) => void;
  /** The admin started a synchronized metronome. */
  "metronome:start": (payload: { bpm: number; from: string }) => void;
  /** Room settings changed (e.g. the admin switched the sound mode). */
  "room:update": (room: RoomSummary) => void;
  /** You were removed from the room by the admin. */
  "room:kicked": (payload: { reason: string }) => void;
  /** Your mute state changed (sent only to the affected player). */
  "room:muted": (payload: { chat: boolean; notes: boolean }) => void;
}

export const ROOM_LIMITS = {
  nameMax: 30,
  minPlayers: 1,
  maxPlayers: 10,
  chatMessageMax: 500,
  nicknameMin: 2,
  nicknameMax: 20,
} as const;

/** Avatar ids; each maps to /avatars/<id>.svg (Twemoji, CC-BY 4.0). */
export const AVATARS = [
  "fox", "dog", "cat", "mouse", "hamster", "rabbit", "bear", "panda",
  "koala", "tiger", "lion", "cow", "pig", "frog", "monkey", "chick",
  "penguin", "duck", "owl", "unicorn", "bee", "butterfly", "octopus",
  "whale", "turtle", "dragon",
] as const;

export type AvatarId = (typeof AVATARS)[number];

export function isValidAvatar(avatar: unknown): avatar is AvatarId {
  return typeof avatar === "string" && (AVATARS as readonly string[]).includes(avatar);
}

export function randomAvatar(): AvatarId {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)]!;
}

export const DEFAULT_ROOM_INSTRUMENT = "piano";
