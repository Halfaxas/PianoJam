/**
 * Typed Socket.IO contract shared by client and server.
 */

import type { SongControl, SongData, SongPlayback, SongScore } from "./song";

/**
 * Who controls the sound packs in a room. Exclusive or:
 * - "admin": the room admin picks one sound pack for everyone.
 * - "orchestra": every player picks their own instrument.
 */
export type SoundMode = "admin" | "orchestra";

/**
 * Who can find and enter a room:
 * - "public": listed in the room browser, joinable by anyone.
 * - "private": listed in the room browser, but joining needs the invite link.
 * - "hidden": invite link only, never listed in the room browser.
 */
export type RoomVisibility = "public" | "private" | "hidden";

export function isValidVisibility(v: unknown): v is RoomVisibility {
  return v === "public" || v === "private" || v === "hidden";
}

export interface RoomSettings {
  name: string;
  maxPlayers: number;
  chatEnabled: boolean;
  soundMode: SoundMode;
  visibility: RoomVisibility;
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

export type JoinErrorCode =
  | "NICKNAME_TAKEN"
  | "ROOM_FULL"
  | "NOT_FOUND"
  | "INVALID"
  | "INVITE_INVALID";

export type Ack<T> = (
  res: { ok: true; data: T } | { ok: false; error: string; code?: JoinErrorCode },
) => void;

export interface CreateRoomInput {
  name: string;
  maxPlayers: number;
  chatEnabled: boolean;
  soundMode: SoundMode;
  visibility: RoomVisibility;
}

export interface CreatedRoom {
  room: RoomSummary;
  /** Presenting this token when joining claims room admin. */
  adminToken: string;
  /** Grants entry to the room while it is private or hidden. */
  inviteToken: string;
}

export interface JoinRoomInput {
  roomId: string;
  nickname: string;
  avatar: string;
  adminToken?: string;
  inviteToken?: string;
}

/** The room's current Song Mode state, sent to players when they join. */
export interface RoomSongState {
  data: SongData;
  playback: SongPlayback;
  /** Latest reported Keep Up score per player name. */
  scores: Record<string, SongScore>;
}

export interface JoinedRoom {
  room: RoomSummary;
  players: Player[];
  self: Player;
  /** Current invite token, so any member's Share button can build the link. */
  inviteToken: string;
  song: RoomSongState | null;
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
  /** Admin only: change who can find and enter the room. */
  "room:setVisibility": (visibility: RoomVisibility) => void;
  /** Admin only: mint a new invite token; old invite links stop working. */
  "room:regenerateInvite": (ack: Ack<{ inviteToken: string }>) => void;
  /** Send a quick emoji reaction to the room (rate limited server-side). */
  "reaction:send": (reaction: ReactionId) => void;
  /** Admin only: load a song (parsed client-side) for the whole room. */
  "song:load": (song: SongData, ack: Ack<null>) => void;
  /** Admin only: control the room-wide song playback. */
  "song:control": (control: SongControl) => void;
  /** Report your own Keep Up score so the room's leaderboard stays live. */
  "song:score": (score: SongScore) => void;
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
  /** The invite token changed (regenerated by the admin). */
  "room:invite": (payload: { inviteToken: string }) => void;
  /** Someone in the room (possibly you) sent a quick reaction. */
  reaction: (payload: { from: string; reaction: ReactionId }) => void;
  /** The admin loaded a song for the room. */
  "song:loaded": (payload: { song: SongData; from: string }) => void;
  /** The room-wide playback state changed (position is as of receipt). */
  "song:playback": (playback: SongPlayback) => void;
  /** A player's live Keep Up score (senders don't receive their own). */
  "song:score": (payload: { from: string; score: SongScore }) => void;
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
  "whale", "turtle", "dragon", "wolf", "dolphin",
] as const;

export type AvatarId = (typeof AVATARS)[number];

export function isValidAvatar(avatar: unknown): avatar is AvatarId {
  return typeof avatar === "string" && (AVATARS as readonly string[]).includes(avatar);
}

export function randomAvatar(): AvatarId {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)]!;
}

export const DEFAULT_ROOM_INSTRUMENT = "piano";

/** The fixed set of quick reactions. Not user-customizable. */
export const REACTIONS = ["👏", "🔥", "😂", "❤️", "👍"] as const;

export type ReactionId = (typeof REACTIONS)[number];

export function isValidReaction(reaction: unknown): reaction is ReactionId {
  return typeof reaction === "string" && (REACTIONS as readonly string[]).includes(reaction);
}

/** Minimum time between reactions per player, enforced server-side. */
export const REACTION_COOLDOWN_MS = 1500;
