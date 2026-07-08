import { memo, useCallback, useRef } from "react";
import { computeKeyLayout } from "@pianojam/shared";
import { pressKey, releaseKey } from "../audio/player";
import { ensureAudioStarted } from "../audio/engine";
import { useIsNoteActive } from "../state/activeNotes";
import { usePracticeKeyState } from "../state/practiceKeys";
import { useThemeStore } from "../state/themeStore";

const LAYOUT = computeKeyLayout();
const WHITE_KEYS = LAYOUT.filter((k) => k.color === "white");
const BLACK_KEYS = LAYOUT.filter((k) => k.color === "black");
const POINTER_VELOCITY = 0.8;

interface KeyProps {
  midi: number;
  left: number;
  width: number;
  label?: string;
}

/**
 * Each key subscribes only to its own active flag, so a keypress re-renders
 * exactly the keys whose state changed - never all 88.
 */
const PianoKey = memo(function PianoKey({
  midi,
  left,
  width,
  label,
  black,
}: KeyProps & { black: boolean }) {
  const active = useIsNoteActive(midi);
  // During practice the verdict color (green/red) replaces the theme tint.
  const practice = usePracticeKeyState(midi);
  const activeColor = useThemeStore((s) => (black ? s.blackTrail : s.whiteTrail));

  return (
    <div
      data-midi={midi}
      className={`piano-key ${black ? "black" : "white"}${active ? " active" : ""}${
        practice ? ` practice-${practice}` : ""
      }`}
      style={{
        left: `${left}%`,
        width: `${width}%`,
        ...(active && !practice ? { background: activeColor } : undefined),
      }}
    >
      {label && <span className="key-label">{label}</span>}
    </div>
  );
});

export function Keyboard() {
  // pointerId -> midi currently held by that pointer (enables glissando).
  const pointerNotes = useRef(new Map<number, number>());

  const noteFromPoint = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const midi = el?.dataset?.midi;
    return midi ? Number(midi) : null;
  };

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const midi = noteFromPoint(e.clientX, e.clientY);
    if (midi === null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    void ensureAudioStarted().catch(() => {});
    pointerNotes.current.set(e.pointerId, midi);
    pressKey(midi, POINTER_VELOCITY);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const held = pointerNotes.current.get(e.pointerId);
    if (held === undefined) return;
    const midi = noteFromPoint(e.clientX, e.clientY);
    if (midi !== null && midi !== held) {
      releaseKey(held);
      pointerNotes.current.set(e.pointerId, midi);
      pressKey(midi, POINTER_VELOCITY);
    }
  }, []);

  const endPointer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const held = pointerNotes.current.get(e.pointerId);
    if (held !== undefined) {
      releaseKey(held);
      pointerNotes.current.delete(e.pointerId);
    }
  }, []);

  return (
    <div
      className="keyboard"
      role="group"
      aria-label="Piano keyboard. Play with your mouse, touch, a MIDI device, or your computer keys — press 0-8 to pick the octave, hold Shift for sharps."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      {WHITE_KEYS.map((k) => (
        <PianoKey
          key={k.midi}
          midi={k.midi}
          left={k.left}
          width={k.width}
          black={false}
          label={k.name.startsWith("C") && !k.name.includes("#") ? k.name : undefined}
        />
      ))}
      {BLACK_KEYS.map((k) => (
        <PianoKey key={k.midi} midi={k.midi} left={k.left} width={k.width} black />
      ))}
    </div>
  );
}
