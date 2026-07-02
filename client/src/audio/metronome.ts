import * as Tone from "tone";
import { create } from "zustand";
import { ensureAudioStarted } from "./engine";

export const METRONOME_MIN_BPM = 40;
export const METRONOME_MAX_BPM = 208;
const BEATS_PER_BAR = 4;

interface MetronomeState {
  bpm: number;
  running: boolean;
  /** 0-based beat within the bar, for the visual pulse. */
  beat: number;
  setBpm: (bpm: number) => void;
  setRunning: (running: boolean) => void;
}

export const useMetronomeStore = create<MetronomeState>((set) => ({
  bpm: 120,
  running: false,
  beat: 0,
  setBpm: (bpm) =>
    set({ bpm: Math.min(METRONOME_MAX_BPM, Math.max(METRONOME_MIN_BPM, Math.round(bpm))) }),
  setRunning: (running) => set({ running }),
}));

/**
 * Sample-accurate tick scheduling: a coarse setInterval keeps a rolling
 * lookahead window filled with precisely-timed buffer playback, so UI jank
 * never makes the metronome stutter.
 */

let buffers: { hi: AudioBuffer; lo: AudioBuffer } | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let nextTickTime = 0;
let beatIndex = 0;

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.12;

async function loadBuffers(ctx: AudioContext): Promise<{ hi: AudioBuffer; lo: AudioBuffer }> {
  if (buffers) return buffers;
  const load = async (url: string) => {
    const res = await fetch(url);
    return ctx.decodeAudioData(await res.arrayBuffer());
  };
  const [hi, lo] = await Promise.all([
    load("/res/samples/metronome/Perc_Clackhead_hi.wav"),
    load("/res/samples/metronome/Perc_Clackhead_lo.wav"),
  ]);
  buffers = { hi, lo };
  return buffers;
}

function scheduleTicks(ctx: AudioContext): void {
  if (!buffers) return;
  while (nextTickTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
    const accent = beatIndex % BEATS_PER_BAR === 0;
    const source = ctx.createBufferSource();
    source.buffer = accent ? buffers.hi : buffers.lo;
    const gain = ctx.createGain();
    gain.gain.value = accent ? 1 : 0.7;
    source.connect(gain).connect(ctx.destination);
    source.start(nextTickTime);

    const beatForUi = beatIndex % BEATS_PER_BAR;
    const delayMs = Math.max(0, (nextTickTime - ctx.currentTime) * 1000);
    setTimeout(() => {
      if (useMetronomeStore.getState().running) {
        useMetronomeStore.setState({ beat: beatForUi });
      }
    }, delayMs);

    beatIndex += 1;
    // Read BPM each tick so slider changes take effect immediately.
    nextTickTime += 60 / useMetronomeStore.getState().bpm;
  }
}

export async function startMetronome(): Promise<void> {
  await ensureAudioStarted();
  const ctx = Tone.getContext().rawContext as AudioContext;
  await loadBuffers(ctx);
  if (timer) return;
  beatIndex = 0;
  nextTickTime = ctx.currentTime + 0.05;
  useMetronomeStore.getState().setRunning(true);
  scheduleTicks(ctx);
  timer = setInterval(() => scheduleTicks(ctx), LOOKAHEAD_MS);
}

export function stopMetronome(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  useMetronomeStore.setState({ running: false, beat: 0 });
}
