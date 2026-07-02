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
    store.setRoom(room);
    if (modeChanged) {
      toast.info(
        room.soundMode === "orchestra"
          ? "The admin switched the room to orchestra: pick your own instrument."
          : "The admin switched the room to solo instrument: everyone plays the admin's sound pack.",
      );
    }
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
    useRoomStore.getState().addMessage(message);
  });

  return socket;
}
