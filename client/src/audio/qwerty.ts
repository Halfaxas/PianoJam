import { pressKey, releaseKey, setPedal } from "./player";
import { ensureAudioStarted } from "./engine";

/**
 * Computer-keyboard playing: two octaves centred on middle C, in the layout
 * most virtual pianos use. Space bar acts as the sustain pedal.
 *
 *   Q2W3ER5T6Y7U I9O0P  -> C5 .. E6
 *   ZSXDCVGBHNJM ,L.;/  -> C4 .. E5
 */

const KEY_TO_MIDI: Record<string, number> = {
  z: 60, s: 61, x: 62, d: 63, c: 64, v: 65, g: 66, b: 67, h: 68, n: 69,
  j: 70, m: 71, ",": 72, l: 73, ".": 74, ";": 75, "/": 76,
  q: 72, "2": 73, w: 74, "3": 75, e: 76, r: 77, "5": 78, t: 79, "6": 80,
  y: 81, "7": 82, u: 83, i: 84, "9": 85, o: 86, "0": 87, p: 88,
};

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
  const midi = KEY_TO_MIDI[e.key.toLowerCase()];
  if (midi !== undefined) {
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
  const midi = KEY_TO_MIDI[e.key.toLowerCase()];
  if (midi !== undefined) releaseKey(midi);
}

export function attachQwerty(): () => void {
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  };
}
