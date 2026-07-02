import { create } from "zustand";
import { DEFAULT_INSTRUMENT_ID } from "../audio/instruments";

interface AudioState {
  instrumentId: string;
  /** True while a sound pack's samples are downloading. */
  instrumentLoading: boolean;
  /** True once the AudioContext has been unlocked by a user gesture. */
  audioReady: boolean;
  /** Octave the computer-keyboard letters play in (number keys switch it). */
  qwertyOctave: number;
  midiSupported: boolean;
  midiDevices: string[];
  pedalDown: boolean;
  recording: boolean;
  recordingStartedAt: number | null;
  volume: number;
  set: (partial: Partial<AudioState>) => void;
}

export const useAudioStore = create<AudioState>((set) => ({
  instrumentId: DEFAULT_INSTRUMENT_ID,
  instrumentLoading: false,
  audioReady: false,
  qwertyOctave: 4,
  midiSupported: false,
  midiDevices: [],
  pedalDown: false,
  recording: false,
  recordingStartedAt: null,
  volume: 1,
  set: (partial) => set(partial),
}));
