import * as Tone from "tone";
import { midiToName } from "@pianojam/shared";
import { getInstrument } from "./instruments";
import { useAudioStore } from "../state/audioStore";

/**
 * All sound synthesis lives here, outside React, so pressing a key never
 * waits on a render. One sampler is kept per instrument so that in
 * orchestra rooms every player is heard with their own instrument. All
 * samplers route through a master gain that also feeds the recorder.
 */

let master: Tone.Gain | null = null;
let recorder: Tone.Recorder | null = null;

const samplers = new Map<string, Tone.Sampler>();
const samplerLoads = new Map<string, Promise<Tone.Sampler | null>>();

/** owner:midi -> instrument the note was struck with. */
const voices = new Map<string, string>();

/** Per-owner sustain state ("local" or a peer name). */
const sustain = new Map<string, { down: boolean; held: Map<number, string> }>();

function sustainFor(owner: string) {
  let s = sustain.get(owner);
  if (!s) {
    s = { down: false, held: new Map() };
    sustain.set(owner, s);
  }
  return s;
}

export function getMaster(): Tone.Gain {
  if (!master) {
    master = new Tone.Gain(1).toDestination();
  }
  return master;
}

export function getRecorder(): Tone.Recorder {
  if (!recorder) {
    recorder = new Tone.Recorder();
    getMaster().connect(recorder);
  }
  return recorder;
}

/** Must be called from a user gesture to unlock the AudioContext. */
export async function ensureAudioStarted(): Promise<void> {
  if (Tone.getContext().state !== "running") {
    await Tone.start();
  }
  if (!useAudioStore.getState().audioReady) {
    useAudioStore.getState().set({ audioReady: true });
  }
}

/** Loads an instrument's sampler once; concurrent calls share the load. */
export function ensureSampler(id: string): Promise<Tone.Sampler | null> {
  const existing = samplers.get(id);
  if (existing) return Promise.resolve(existing);
  const inFlight = samplerLoads.get(id);
  if (inFlight) return inFlight;

  const def = getInstrument(id);
  const load = new Promise<Tone.Sampler | null>((resolve) => {
    const sampler: Tone.Sampler = new Tone.Sampler({
      urls: def.urls,
      baseUrl: def.baseUrl,
      release: def.release,
      onload: () => {
        samplers.set(id, sampler);
        samplerLoads.delete(id);
        resolve(sampler);
      },
      onerror: () => {
        samplerLoads.delete(id);
        sampler.dispose();
        resolve(null);
      },
    }).connect(getMaster());
  });
  samplerLoads.set(id, load);
  return load;
}

/** Switches the local player's instrument (and shows loading state). */
export async function loadMyInstrument(id: string): Promise<void> {
  const def = getInstrument(id);
  const store = useAudioStore.getState();
  store.set({ instrumentId: def.id, instrumentLoading: !samplers.has(def.id) });
  await ensureSampler(def.id);
  if (useAudioStore.getState().instrumentId === def.id) {
    useAudioStore.getState().set({ instrumentLoading: false });
  }
}

export function setVolume(volume: number): void {
  useAudioStore.getState().set({ volume });
  getMaster().gain.rampTo(volume, 0.05);
}

export function noteOn(midi: number, velocity: number, owner: string, instrumentId: string): void {
  const sampler = samplers.get(instrumentId);
  if (!sampler) {
    // Not loaded yet: start loading so the next notes are heard.
    void ensureSampler(instrumentId);
    return;
  }
  const name = midiToName(midi);
  const s = sustainFor(owner);
  // Re-striking a sustained note: release the old ringing voice first.
  const heldWith = s.held.get(midi);
  if (heldWith !== undefined) {
    s.held.delete(midi);
    samplers.get(heldWith)?.triggerRelease(name);
  }
  voices.set(`${owner}:${midi}`, instrumentId);
  sampler.triggerAttack(name, Tone.now(), Math.max(0.05, velocity));
}

export function noteOff(midi: number, owner: string): void {
  const key = `${owner}:${midi}`;
  const instrumentId = voices.get(key);
  if (instrumentId === undefined) return;
  voices.delete(key);
  const s = sustainFor(owner);
  if (s.down) {
    s.held.set(midi, instrumentId);
    return;
  }
  samplers.get(instrumentId)?.triggerRelease(midiToName(midi));
}

export function setPedal(down: boolean, owner: string): void {
  const s = sustainFor(owner);
  s.down = down;
  if (!down) {
    for (const [midi, instrumentId] of s.held) {
      samplers.get(instrumentId)?.triggerRelease(midiToName(midi));
    }
    s.held.clear();
  }
  if (owner === "local") {
    useAudioStore.getState().set({ pedalDown: down });
  }
}

/** Silence and forget everything a player was holding (e.g. they left). */
export function releaseAllFor(owner: string): void {
  const s = sustain.get(owner);
  if (s) {
    for (const [midi, instrumentId] of s.held) {
      samplers.get(instrumentId)?.triggerRelease(midiToName(midi));
    }
  }
  sustain.delete(owner);
  for (const [key, instrumentId] of voices) {
    if (key.startsWith(owner + ":")) {
      const midi = Number(key.slice(owner.length + 1));
      samplers.get(instrumentId)?.triggerRelease(midiToName(midi));
      voices.delete(key);
    }
  }
}
