import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@pianojam/shared";
import { useRoomStore } from "../state/roomStore";
import { toast } from "../state/toastStore";
import {
  remoteNoteOn,
  remoteNoteOff,
  remotePedal,
  remotePlayerGone,
} from "../audio/player";
import { ensureSampler, loadMyInstrument } from "../audio/engine";
import { startMetronome, useMetronomeStore } from "../audio/metronome";
import { useUiStore } from "../state/uiStore";
import { localMuteOf } from "../state/localMuteStore";
import { useReactionStore } from "../state/reactionStore";
import { useSongStore } from "../state/songStore";
import { applyPlayback, applySongLoaded } from "../song/engine";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (socket) return socket;

  socket = io();

  socket.on("room:players", (players) => {
    const store = useRoomStore.getState();
    // Clean up sound/visuals for anyone who left.
    const names = new Set(players.map((p) => p.name));
    for (const prev of store.players) {
      if (!names.has(prev.name)) remotePlayerGone(prev.name);
    }
    store.setPlayers(players);
    // Preload everyone's instrument so their first note is heard.
    for (const p of players) void ensureSampler(p.instrumentId);
  });

  socket.on("room:instrument", ({ instrumentId }) => {
    useRoomStore.getState().setRoomInstrument(instrumentId);
    void loadMyInstrument(instrumentId);
  });

  socket.on("metronome:start", ({ bpm, from }) => {
    useMetronomeStore.getState().setBpm(bpm);
    void startMetronome();
    // Bring the metronome into view so the start is visible, not just audible.
    useUiStore.getState().setOpenPanel("metronome");
    toast.info(`${from} started the metronome at ${bpm} BPM. You can stop it anytime.`);
  });

  socket.on("room:update", (room) => {
    const store = useRoomStore.getState();
    if (store.status !== "joined") return;
    const modeChanged = store.room?.soundMode !== room.soundMode;
    const visibilityChanged = store.room?.visibility !== room.visibility;
    store.setRoom(room);
    if (modeChanged) {
      toast.info(
        room.soundMode === "orchestra"
          ? "The admin switched the room to orchestra: pick your own instrument."
          : "The admin switched the room to solo instrument: everyone plays the admin's sound pack.",
      );
    }
    if (visibilityChanged) {
      toast.info(
        room.visibility === "public"
          ? "The admin made this room public: anyone can join."
          : room.visibility === "private"
            ? "The admin made this room private: joining now needs the invite link."
            : "The admin hid this room: it is invite-link-only and unlisted.",
      );
    }
  });

  socket.on("room:invite", ({ inviteToken }) => {
    useRoomStore.getState().setInviteToken(inviteToken);
  });

  socket.on("reaction", ({ from, reaction }) => {
    // Reactions are chatter: respect the local chat mute.
    if (localMuteOf(from).chat) return;
    useReactionStore.getState().add(from, reaction);
  });

  socket.on("song:loaded", ({ song, from }) => {
    applySongLoaded(song, from);
    if (from !== useRoomStore.getState().self?.name) {
      toast.info(`${from} loaded "${song.title}" for the room.`);
    }
  });

  socket.on("song:playback", (playback) => {
    const prev = useSongStore.getState().playback;
    applyPlayback(playback);
    if (playback.state === "playing" && prev?.state !== "playing") {
      toast.info(
        playback.mode === "keepup"
          ? "Keep up! Play the falling notes as they reach the keyboard."
          : "Song playback started. Feel free to play along.",
      );
    }
  });

  socket.on("song:score", ({ from, score }) => {
    useSongStore.getState().setScore(from, score);
  });

  socket.on("room:kicked", ({ reason }) => {
    useRoomStore.getState().setError(reason);
  });

  socket.on("room:muted", ({ chat, notes }) => {
    if (chat && notes) toast.info("The admin muted your chat and playing for the room.");
    else if (chat) toast.info("The admin muted you in chat.");
    else if (notes) toast.info("The admin muted your playing for the room.");
    else toast.success("The admin unmuted you.");
  });

  socket.on("peer:note:on", ({ midi, velocity, from }) => remoteNoteOn(midi, velocity, from));
  socket.on("peer:note:off", ({ midi, from }) => remoteNoteOff(midi, from));
  socket.on("peer:pedal", ({ down, from }) => remotePedal(down, from));

  socket.on("chat:message", (message) => {
    // Locally muted senders' messages are kept (so unmuting restores the
    // conversation) but hidden by the chat panel and never counted unread.
    const muted = localMuteOf(message.from).chat;
    useRoomStore.getState().addMessage(message, !muted);
  });

  return socket;
}
