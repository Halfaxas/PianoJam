import { isValidMidi, NOTES } from "@pianojam/shared";
import * as engine from "./engine";
import { trailStart, trailEnd, endAllFrom } from "./trails";
import { useActiveNotes } from "../state/activeNotes";
import { useRoomStore } from "../state/roomStore";
import { useThemeStore } from "../state/themeStore";
import { useAudioStore } from "../state/audioStore";
import { localMuteOf } from "../state/localMuteStore";
import { songLocalPress, songLocalRelease, songVisualsActive } from "../song/engine";
import { getSocket } from "../lib/socket";

/**
 * Single entry point for every key press/release, whether it comes from the
 * pointer, the computer keyboard, a MIDI device or a remote peer. Fans out
 * to: synthesis, key highlighting, note trails and the socket broadcast.
 */

const LOCAL = "local";
const noteColorByMidi = new Map(NOTES.map((n) => [n.midi, n.color]));

function trailColor(midi: number): string {
  const theme = useThemeStore.getState();
  return noteColorByMidi.get(midi) === "black" ? theme.blackTrail : theme.whiteTrail;
}

function inRoom(): boolean {
  return useRoomStore.getState().status === "joined";
}

/** The instrument a peer currently plays, from the live player list. */
function peerInstrument(name: string): string {
  const state = useRoomStore.getState();
  const player = state.players.find((p) => p.name === name);
  return player?.instrumentId ?? state.room?.instrumentId ?? "piano";
}

const locallyDown = new Set<number>();

export function pressKey(midi: number, velocity = 0.8): void {
  if (!isValidMidi(midi) || locallyDown.has(midi)) return;
  locallyDown.add(midi);
  engine.noteOn(midi, velocity, LOCAL, useAudioStore.getState().instrumentId);
  useActiveNotes.getState().press(midi, LOCAL);
  // No rising trails while song notes are falling: they visually clash.
  if (!songVisualsActive()) trailStart(midi, LOCAL, trailColor(midi), false);
  songLocalPress(midi);
  if (inRoom()) getSocket().emit("note:on", { midi, velocity });
}

export function releaseKey(midi: number): void {
  if (!locallyDown.delete(midi)) return;
  engine.noteOff(midi, LOCAL);
  useActiveNotes.getState().release(midi, LOCAL);
  trailEnd(midi, LOCAL);
  songLocalRelease(midi);
  if (inRoom()) getSocket().emit("note:off", { midi });
}

export function releaseAllLocal(): void {
  for (const midi of [...locallyDown]) releaseKey(midi);
}

export function setPedal(down: boolean): void {
  engine.setPedal(down, LOCAL);
  if (inRoom()) getSocket().emit("pedal", { down });
}

export function remoteNoteOn(midi: number, velocity: number, from: string): void {
  if (!isValidMidi(midi)) return;
  // Local-only mutes: skip sound and/or visuals for this peer, on this
  // device only (the admin's room-wide mutes are enforced server-side).
  const mute = localMuteOf(from);
  if (!mute.audio) engine.noteOn(midi, velocity, from, peerInstrument(from));
  // Peer trails are also hidden while song notes are falling.
  if (!mute.notes && !songVisualsActive()) trailStart(midi, from, trailColor(midi), true);
}

export function remoteNoteOff(midi: number, from: string): void {
  if (!isValidMidi(midi)) return;
  engine.noteOff(midi, from);
  trailEnd(midi, from);
}

export function remotePedal(down: boolean, from: string): void {
  if (localMuteOf(from).audio) return;
  engine.setPedal(down, from);
}

/** Called when a peer disconnects so nothing is left ringing or lit. */
export function remotePlayerGone(name: string): void {
  engine.releaseAllFor(name);
  endAllFrom(name);
}
