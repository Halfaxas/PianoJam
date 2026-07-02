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
    toast.info(`${from} started the metronome at ${bpm} BPM. You can stop it anytime.`);
  });

  socket.on("peer:note:on", ({ midi, velocity, from }) => remoteNoteOn(midi, velocity, from));
  socket.on("peer:note:off", ({ midi, from }) => remoteNoteOff(midi, from));
  socket.on("peer:pedal", ({ down, from }) => remotePedal(down, from));

  socket.on("chat:message", (message) => {
    useRoomStore.getState().addMessage(message);
  });

  return socket;
}
