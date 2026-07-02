import { MIDI_MAX, MIDI_MIN, midiToName } from "@pianojam/shared";

export interface InstrumentDef {
  id: string;
  label: string;
  baseUrl: string;
  urls: Record<string, string>;
  /** Release tail in seconds applied to the sampler. */
  release: number;
}

const LOCAL_BASE = "/res/samples/";

/**
 * "C#4" -> "Cs4.mp3" (the naming convention of the bundled sample files).
 * Every note list below was generated from the files actually on disk in
 * client/public/res/samples - do not add names without adding files.
 */
function urlsFor(names: string[]): Record<string, string> {
  return Object.fromEntries(names.map((n) => [n, n.replace("#", "s") + ".mp3"]));
}

function local(id: string, label: string, names: string[], release = 0.6): InstrumentDef {
  return { id, label, baseUrl: LOCAL_BASE + id + "/", urls: urlsFor(names), release };
}

/**
 * The bundled piano pack has every semitone sampled; loading every other
 * one (44 files) keeps the initial download light while the sampler
 * pitch-shifts at most one semitone.
 */
const PIANO_NAMES: string[] = [];
for (let midi = MIDI_MIN; midi <= MIDI_MAX; midi += 2) PIANO_NAMES.push(midiToName(midi));

export const INSTRUMENTS: InstrumentDef[] = [
  local("piano", "Piano", PIANO_NAMES, 1),
  {
    id: "salamander",
    label: "Grand Piano (Salamander)",
    baseUrl: "https://tonejs.github.io/audio/salamander/",
    urls: urlsFor([
      "A0", "C1", "D#1", "F#1", "A1", "C2", "D#2", "F#2", "A2", "C3", "D#3",
      "F#3", "A3", "C4", "D#4", "F#4", "A4", "C5", "D#5", "F#5", "A5", "C6",
      "D#6", "F#6", "A6", "C7", "D#7", "F#7", "A7", "C8",
    ]),
    release: 1,
  },
  local("harp", "Harp", ["A2", "A4", "A6", "B1", "B3", "B5", "B6", "C3", "C5", "D2", "D4", "D6", "D7", "E1", "E3", "E5", "F2", "F4", "F6", "F7", "G1", "G3", "G5"], 1),
  local("organ", "Organ", ["A1", "A2", "A3", "A4", "A5", "C1", "C2", "C3", "C4", "C5", "C6", "D#1", "D#2", "D#3", "D#4", "D#5", "F#1", "F#2", "F#3", "F#4", "F#5"], 0.8),
  local("harmonium", "Harmonium", ["A2", "A3", "A4", "A#2", "A#3", "A#4", "B2", "B3", "B4", "C2", "C3", "C4", "C5", "C#2", "C#3", "C#4", "C#5", "D2", "D3", "D4", "D5", "D#2", "D#3", "D#4", "E2", "E3", "E4", "F2", "F3", "F4", "F#2", "F#3", "G2", "G3", "G4", "G#2", "G#3", "G#4"], 0.8),
  local("violin", "Violin", ["A3", "A4", "A5", "A6", "C4", "C5", "C6", "C7", "E4", "E5", "E6", "G3", "G4", "G5", "G6"], 1.2),
  local("cello", "Cello", ["A2", "A3", "A4", "A#2", "A#3", "B2", "B3", "B4", "C2", "C3", "C4", "C5", "C#3", "C#4", "D2", "D3", "D4", "D#2", "D#3", "D#4", "E2", "E3", "E4", "F2", "F3", "F4", "F#3", "F#4", "G2", "G3", "G4", "G#2", "G#3", "G#4"], 1.2),
  local("contrabass", "Contrabass", ["A2", "A#1", "B3", "C2", "C#3", "D2", "E2", "E3", "F#1", "F#2", "G1", "G#2", "G#3"], 1.2),
  local("guitar-acoustic", "Acoustic Guitar", ["A2", "A3", "A4", "A#2", "A#3", "A#4", "B2", "B3", "B4", "C3", "C4", "C5", "C#3", "C#4", "C#5", "D2", "D3", "D4", "D5", "D#2", "D#3", "D#4", "E2", "E3", "E4", "F2", "F3", "F4", "F#2", "F#3", "F#4", "G2", "G3", "G4", "G#2", "G#3", "G#4"], 0.8),
  local("guitar-electric", "Electric Guitar", ["A2", "A3", "A4", "A5", "C3", "C4", "C5", "C6", "C#2", "D#3", "D#4", "D#5", "E2", "F#2", "F#3", "F#4", "F#5"], 0.8),
  local("guitar-nylon", "Nylon Guitar", ["A2", "A3", "A4", "A5", "A#5", "B1", "B2", "B3", "B4", "C#3", "C#4", "C#5", "D2", "D3", "D5", "D#4", "E2", "E3", "E4", "E5", "F#2", "F#3", "F#4", "F#5", "G3", "G5", "G#2", "G#4", "G#5"], 0.8),
  local("bass-electric", "Electric Bass", ["A#1", "A#2", "A#3", "A#4", "C#1", "C#2", "C#3", "C#4", "C#5", "E1", "E2", "E3", "E4", "G1", "G2", "G3", "G4"], 0.8),
  local("flute", "Flute", ["A4", "A5", "A6", "C4", "C5", "C6", "C7", "E4", "E5", "E6"], 0.8),
  local("clarinet", "Clarinet", ["A#3", "A#4", "A#5", "D3", "D4", "D5", "D6", "F3", "F4", "F5", "F#6"], 0.8),
  local("saxophone", "Saxophone", ["A4", "A5", "A#3", "A#4", "B3", "B4", "C4", "C5", "C#3", "C#4", "C#5", "D3", "D4", "D5", "D#3", "D#4", "D#5", "E3", "E4", "E5", "F3", "F4", "F5", "F#3", "F#4", "F#5", "G3", "G4", "G5", "G#3", "G#4", "G#5"], 0.8),
  local("bassoon", "Bassoon", ["A2", "A3", "A4", "C3", "C4", "C5", "E4", "G2", "G3", "G4"], 0.8),
  local("trumpet", "Trumpet", ["A3", "A5", "A#4", "C4", "C6", "D5", "D#4", "F3", "F4", "F5", "G4"], 0.8),
  local("trombone", "Trombone", ["A#1", "A#2", "A#3", "C3", "C4", "C#2", "C#4", "D3", "D4", "D#2", "D#3", "D#4", "F2", "F3", "F4", "G#2", "G#3"], 0.8),
  local("french-horn", "French Horn", ["A1", "A3", "C2", "C4", "D3", "D5", "D#2", "F3", "F5", "G2"], 0.8),
  local("tuba", "Tuba", ["A#1", "A#2", "A#3", "D3", "D4", "D#2", "F1", "F2", "F3"], 0.8),
  local("xylophone", "Xylophone", ["C5", "C6", "C7", "C8", "G4", "G5", "G6", "G7"], 1),
];

export const DEFAULT_INSTRUMENT_ID = "piano";

export function getInstrument(id: string): InstrumentDef {
  return INSTRUMENTS.find((i) => i.id === id) ?? INSTRUMENTS[0]!;
}
