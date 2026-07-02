import { useMemo } from "react";
import { Chord } from "tonal";
import { midiToName } from "@pianojam/shared";
import { useActiveNotes } from "../state/activeNotes";

/**
 * Shows the currently pressed note, or the recognised chord when three or
 * more notes sound together.
 */
export function NoteChordDisplay() {
  const holders = useActiveNotes((s) => s.holders);

  const { note, chord } = useMemo(() => {
    const midis = [...holders.keys()].sort((a, b) => a - b);
    if (midis.length === 0) return { note: null, chord: null };
    const names = midis.map(midiToName);
    if (midis.length === 1) return { note: names[0]!, chord: null };
    const detected = Chord.detect(names);
    return { note: names.join(" "), chord: detected[0] ?? null };
  }, [holders]);

  if (!note) return null;
  return (
    <div className="note-display">
      <span className="note-names">{note}</span>
      {chord && <span className="chord-name">{chord}</span>}
    </div>
  );
}
