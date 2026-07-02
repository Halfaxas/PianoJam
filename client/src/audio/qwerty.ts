import { pressKey, releaseKey, setPedal } from "./player";
import { ensureAudioStarted } from "./engine";
import { useAudioStore } from "../state/audioStore";

/**
 * Computer-keyboard playing: each letter plays its note (c -> C, d -> D ...)
 * and Shift plays the sharp (Shift+c -> C#). E and B have no sharp, so
 * Shift plays the natural. Number keys 0-8 switch the octave the letters
 * play in (4 = middle, the default); notes outside the 88-key range stay
 * silent. Space bar acts as the sustain pedal.
 */

const NOTE_OFFSET: Record<string, number> = {
  c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11,
};

const SHARPABLE = new Set(["c", "d", "f", "g", "a"]);

/**
 * Physical key -> the midi it struck. Releasing Shift before the letter
 * must still release the sharp that was pressed, so releases are looked up
 * by e.code instead of re-deriving the note from the current modifiers.
 */
const downByCode = new Map<string, number>();

function midiFor(e: KeyboardEvent): number | undefined {
  const letter = e.code.startsWith("Key") ? e.code.slice(3).toLowerCase() : "";
  const offset = NOTE_OFFSET[letter];
  if (offset === undefined) return undefined;
  const octave = useAudioStore.getState().qwertyOctave;
  const midi = 12 * (octave + 1) + offset;
  return e.shiftKey && SHARPABLE.has(letter) ? midi + 1 : midi;
}

/** Digit0-Digit8 (top row or numpad) -> octave, or null for other keys. */
function octaveFor(code: string): number | null {
  const match = /^(?:Digit|Numpad)([0-8])$/.exec(code);
  return match ? Number(match[1]) : null;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
  if (e.code === "Space") {
    e.preventDefault();
    setPedal(true);
    return;
  }
  const octave = octaveFor(e.code);
  if (octave !== null) {
    useAudioStore.getState().set({ qwertyOctave: octave });
    return;
  }
  const midi = midiFor(e);
  if (midi !== undefined && !downByCode.has(e.code)) {
    downByCode.set(e.code, midi);
    void ensureAudioStarted().catch(() => {});
    pressKey(midi);
  }
}

function onKeyUp(e: KeyboardEvent): void {
  if (isTypingTarget(e.target)) return;
  if (e.code === "Space") {
    setPedal(false);
    return;
  }
  const midi = downByCode.get(e.code);
  if (midi !== undefined) {
    downByCode.delete(e.code);
    releaseKey(midi);
  }
}

export function attachQwerty(): () => void {
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  };
}
