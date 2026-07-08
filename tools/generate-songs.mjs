/**
 * Generates the bundled Song Mode sample MIDI files in
 * client/public/res/samples/../songs. Run from the repo root:
 *
 *   node tools/generate-songs.mjs
 *
 * The tunes are public-domain classics encoded by hand as note/beat
 * sequences and written out as standard format-0 MIDI files.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "client",
  "public",
  "res",
  "songs",
);

const TPQ = 480;
/** Fraction of the written duration a note actually sounds (articulation). */
const GATE = 0.92;

const PITCH_BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function noteToMidi(name) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note name: ${name}`);
  const acc = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + PITCH_BASE[m[1]] + acc;
}

function vlq(n) {
  const bytes = [n & 0x7f];
  n >>= 7;
  while (n > 0) {
    bytes.unshift((n & 0x7f) | 0x80);
    n >>= 7;
  }
  return bytes;
}

/**
 * A voice is a sequence of [note, beats] steps played back to back, where
 * note is a name, an array of names (chord), or null (rest). Returns
 * absolute events {midi, start, dur, vel}.
 */
function voice(steps, { vel = 96, start = 0 } = {}) {
  const out = [];
  let at = start;
  for (const [note, beats] of steps) {
    if (note !== null) {
      for (const name of Array.isArray(note) ? note : [note]) {
        out.push({ midi: noteToMidi(name), start: at, dur: beats * GATE, vel });
      }
    }
    at += beats;
  }
  return out;
}

function buildMidi(bpm, notes) {
  const events = [];
  for (const n of notes) {
    events.push({ tick: Math.round(n.start * TPQ), bytes: [0x90, n.midi, n.vel] });
    events.push({ tick: Math.round((n.start + n.dur) * TPQ), bytes: [0x80, n.midi, 0x40] });
  }
  // Note-offs (0x80) sort before note-ons (0x90) on the same tick, so a
  // repeated note is released before it is struck again.
  events.sort((a, b) => a.tick - b.tick || a.bytes[0] - b.bytes[0]);

  const track = [];
  const usPerQuarter = Math.round(60_000_000 / bpm);
  track.push(...vlq(0), 0xff, 0x51, 0x03,
    (usPerQuarter >> 16) & 0xff, (usPerQuarter >> 8) & 0xff, usPerQuarter & 0xff);
  let last = 0;
  for (const e of events) {
    track.push(...vlq(e.tick - last), ...e.bytes);
    last = e.tick;
  }
  track.push(...vlq(0), 0xff, 0x2f, 0x00);

  const header = [
    0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (TPQ >> 8) & 0xff, TPQ & 0xff,
    0x4d, 0x54, 0x72, 0x6b,
    (track.length >> 24) & 0xff, (track.length >> 16) & 0xff,
    (track.length >> 8) & 0xff, track.length & 0xff,
  ];
  return Buffer.from([...header, ...track]);
}

/* ------------------------------ tunes ------------------------------ */

function twinkle() {
  const melody = [];
  const A = [
    ["C4", 1], ["C4", 1], ["G4", 1], ["G4", 1],
    ["A4", 1], ["A4", 1], ["G4", 2],
    ["F4", 1], ["F4", 1], ["E4", 1], ["E4", 1],
    ["D4", 1], ["D4", 1], ["C4", 2],
  ];
  const B = [
    ["G4", 1], ["G4", 1], ["F4", 1], ["F4", 1],
    ["E4", 1], ["E4", 1], ["D4", 2],
  ];
  melody.push(...A, ...B, ...B, ...A);

  const bassA = [
    ["C3", 2], ["C3", 2], ["F3", 2], ["C3", 2],
    ["F3", 2], ["C3", 2], ["G3", 2], ["C3", 2],
  ];
  const bassB = [["C3", 2], ["G3", 2], ["C3", 2], ["G3", 2]];
  const bass = [...bassA, ...bassB, ...bassB, ...bassA];

  return buildMidi(100, [
    ...voice(melody, { vel: 96 }),
    ...voice(bass, { vel: 72 }),
  ]);
}

function odeToJoy() {
  const A = (ending) => [
    ["E4", 1], ["E4", 1], ["F4", 1], ["G4", 1],
    ["G4", 1], ["F4", 1], ["E4", 1], ["D4", 1],
    ["C4", 1], ["C4", 1], ["D4", 1], ["E4", 1],
    ...ending,
  ];
  const endA = [["E4", 1.5], ["D4", 0.5], ["D4", 2]];
  const endB = [["D4", 1.5], ["C4", 0.5], ["C4", 2]];
  const bridge = [
    ["D4", 1], ["D4", 1], ["E4", 1], ["C4", 1],
    ["D4", 1], ["E4", 0.5], ["F4", 0.5], ["E4", 1], ["C4", 1],
    ["D4", 1], ["E4", 0.5], ["F4", 0.5], ["E4", 1], ["D4", 1],
    ["C4", 1], ["D4", 1], ["G3", 2],
  ];
  const melody = [...A(endA), ...A(endB), ...bridge, ...A(endB)];

  const bassMain = [["C3", 4], ["G2", 4], ["C3", 4], ["G2", 2], ["C3", 2]];
  const bassBridge = [["G2", 4], ["C3", 4], ["G2", 4], ["C3", 2], ["G2", 2]];
  const bass = [...bassMain, ...bassMain, ...bassBridge, ...bassMain];

  return buildMidi(110, [
    ...voice(melody, { vel: 96 }),
    ...voice(bass, { vel: 68 }),
  ]);
}

function furElise() {
  const e = 0.5; // eighth note
  const phrase = (ending) => [
    ["E5", e], ["D#5", e],
    ["E5", e], ["D#5", e], ["E5", e], ["B4", e], ["D5", e], ["C5", e],
    ["A4", e], [null, e], ["C4", e], ["E4", e], ["A4", e],
    ["B4", e], [null, e], ["E4", e], ["G#4", e], ["B4", e],
    ...ending,
  ];
  const endFirst = [["C5", e], [null, e], ["E4", e], ["E5", e], ["D#5", e]];
  const endLast = [["C5", e], [null, e], ["E4", e], ["C5", e], ["B4", e], ["A4", 2]];
  const melody = [...phrase(endFirst), ...phrase(endLast)];
  return buildMidi(75, voice(melody, { vel: 92 }));
}

function canonInD() {
  const bassRound = [
    ["D3", 2], ["A2", 2], ["B2", 2], ["F#2", 2],
    ["G2", 2], ["D3", 2], ["G2", 2], ["A2", 2],
  ];
  const melodyA = [
    ["F#5", 1], ["E5", 1], ["D5", 1], ["C#5", 1],
    ["B4", 1], ["A4", 1], ["B4", 1], ["C#5", 1],
    ["D5", 1], ["C#5", 1], ["B4", 1], ["A4", 1],
    ["G4", 1], ["F#4", 1], ["G4", 1], ["E4", 1],
  ];
  const melodyB = [
    ["D4", 1], ["F#4", 1], ["A4", 1], ["G4", 1],
    ["F#4", 1], ["D4", 1], ["F#4", 1], ["E4", 1],
    ["D4", 1], ["B3", 1], ["D4", 1], ["A4", 1],
    ["G4", 1], ["B4", 1], ["A4", 1], ["G4", 1],
  ];
  const roundBeats = 16;
  const notes = [
    ...voice(bassRound, { vel: 72, start: 0 }),
    ...voice(bassRound, { vel: 72, start: roundBeats }),
    ...voice(melodyA, { vel: 96, start: roundBeats }),
    ...voice(bassRound, { vel: 72, start: roundBeats * 2 }),
    ...voice(melodyB, { vel: 96, start: roundBeats * 2 }),
    ...voice(bassRound, { vel: 72, start: roundBeats * 3 }),
    ...voice(melodyA, { vel: 96, start: roundBeats * 3 }),
    ...voice([[["D3", "A3", "D4", "F#4"], 4]], { vel: 88, start: roundBeats * 4 }),
  ];
  return buildMidi(66, notes);
}

/* ------------------------------ output ------------------------------ */

const songs = {
  "twinkle.mid": twinkle(),
  "ode-to-joy.mid": odeToJoy(),
  "fur-elise.mid": furElise(),
  "canon-in-d.mid": canonInD(),
};

mkdirSync(OUT_DIR, { recursive: true });
for (const [file, data] of Object.entries(songs)) {
  writeFileSync(path.join(OUT_DIR, file), data);
  console.log(`wrote ${file} (${data.length} bytes)`);
}
