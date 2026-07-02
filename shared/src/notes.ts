/**
 * The 88 keys of a grand piano: A0 (MIDI 21) to C8 (MIDI 108).
 */

export type KeyColor = "white" | "black";

export interface NoteInfo {
  midi: number;
  /** Scientific pitch name, e.g. "C#4" */
  name: string;
  color: KeyColor;
}

const PITCH_CLASSES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
] as const;

const BLACK_PITCH_CLASSES = new Set(["C#", "D#", "F#", "G#", "A#"]);

export const MIDI_MIN = 21;
export const MIDI_MAX = 108;

export function midiToName(midi: number): string {
  const pc = PITCH_CLASSES[midi % 12]!;
  const octave = Math.floor(midi / 12) - 1;
  return `${pc}${octave}`;
}

export const NOTES: readonly NoteInfo[] = Array.from(
  { length: MIDI_MAX - MIDI_MIN + 1 },
  (_, i) => {
    const midi = MIDI_MIN + i;
    const pc = PITCH_CLASSES[midi % 12]!;
    return {
      midi,
      name: midiToName(midi),
      color: BLACK_PITCH_CLASSES.has(pc) ? "black" : ("white" as KeyColor),
    };
  },
);

export function isValidMidi(midi: unknown): midi is number {
  return (
    typeof midi === "number" &&
    Number.isInteger(midi) &&
    midi >= MIDI_MIN &&
    midi <= MIDI_MAX
  );
}

export interface KeyLayout extends NoteInfo {
  /** Left edge as a percentage of full keyboard width. */
  left: number;
  /** Width as a percentage of full keyboard width. */
  width: number;
}

/**
 * Horizontal layout of all 88 keys in percentages, so keyboard and note
 * trails share the exact same geometry at any screen size.
 */
export function computeKeyLayout(): KeyLayout[] {
  const whiteCount = NOTES.filter((n) => n.color === "white").length; // 52
  const whiteWidth = 100 / whiteCount;
  const blackWidth = whiteWidth * 0.62;

  let whiteIndex = 0;
  return NOTES.map((note) => {
    if (note.color === "white") {
      const left = whiteIndex * whiteWidth;
      whiteIndex += 1;
      return { ...note, left, width: whiteWidth };
    }
    // Black key sits across the boundary between the previous white key
    // and the next one.
    const boundary = whiteIndex * whiteWidth;
    return { ...note, left: boundary - blackWidth / 2, width: blackWidth };
  });
}
