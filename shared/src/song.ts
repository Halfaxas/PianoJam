import { MIDI_MAX, MIDI_MIN } from "./notes";

/**
 * Song Mode data model. A song is one merged stream of notes (v1 does not
 * split MIDI tracks); the admin's client parses the file and every client
 * receives the same normalized note list, so rendering and grading are
 * deterministic across the room.
 */

export interface SongNote {
  midi: number;
  /** Seconds from the start of the song. */
  time: number;
  /** Seconds the note is held. */
  duration: number;
  /** 0..1 */
  velocity: number;
}

export interface SongData {
  title: string;
  /** Seconds until the last note ends. */
  durationSec: number;
  /** Sorted by time, then midi. */
  notes: SongNote[];
}

/**
 * How the room experiences the loaded song:
 * - "play": pure playback, the song sounds and renders for everyone.
 * - "keepup": the song advances on its own; every player is graded
 *   individually against the shared timeline (the song does not sound,
 *   the players supply the notes).
 */
export type SongPlayMode = "play" | "keepup";

export type SongPlayState = "playing" | "paused" | "stopped";

export interface SongPlayback {
  mode: SongPlayMode;
  state: SongPlayState;
  /** Song position in seconds at the moment this snapshot was made. */
  positionSec: number;
  /** Playback speed multiplier (0.5..1.5). */
  rate: number;
  /** Semitones added to every song note (-12..12). */
  transpose: number;
}

export type SongControl =
  | { type: "play"; mode: SongPlayMode }
  | { type: "pause" }
  | { type: "stop" }
  | { type: "seek"; positionSec: number }
  | { type: "rate"; rate: number }
  | { type: "transpose"; semitones: number };

/** A player's running Keep Up tally, shared with the room. */
export interface SongScore {
  hit: number;
  early: number;
  late: number;
  /** Expected notes that were never played plus stray wrong presses. */
  miss: number;
  streak: number;
  bestStreak: number;
  /** 0..100 */
  accuracy: number;
}

export const SONG_LIMITS = {
  titleMax: 60,
  maxNotes: 10_000,
  maxDurationSec: 1800,
  maxNoteDurationSec: 30,
  minRate: 0.5,
  maxRate: 1.5,
  maxTranspose: 12,
  /** Seconds of silence before the first note when starting from stopped. */
  leadInSec: 1.5,
} as const;

/** Grading windows in real (wall clock) seconds around a note's moment. */
export const SONG_GRADE_WINDOWS = {
  /** Within this: a clean hit. */
  hitSec: 0.15,
  /** Within this but outside hitSec: graded early or late. */
  nearSec: 0.4,
} as const;

export function idleSongPlayback(): SongPlayback {
  return { mode: "play", state: "stopped", positionSec: 0, rate: 1, transpose: 0 };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Validates and normalizes an untrusted SongData payload. Returns null when
 * the shape is unusable; otherwise a clean copy (sorted, clamped, rounded).
 */
export function sanitizeSongData(raw: unknown): SongData | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { title, notes } = raw as { title?: unknown; notes?: unknown };
  if (!Array.isArray(notes) || notes.length === 0 || notes.length > SONG_LIMITS.maxNotes) {
    return null;
  }

  const clean: SongNote[] = [];
  for (const note of notes) {
    if (typeof note !== "object" || note === null) return null;
    const { midi, time, duration, velocity } = note as Record<string, unknown>;
    if (
      typeof midi !== "number" ||
      !Number.isInteger(midi) ||
      midi < MIDI_MIN ||
      midi > MIDI_MAX ||
      typeof time !== "number" ||
      !Number.isFinite(time) ||
      time < 0 ||
      time > SONG_LIMITS.maxDurationSec ||
      typeof duration !== "number" ||
      !Number.isFinite(duration)
    ) {
      return null;
    }
    const v = typeof velocity === "number" && Number.isFinite(velocity) ? velocity : 0.8;
    clean.push({
      midi,
      time: round3(time),
      duration: round3(Math.min(SONG_LIMITS.maxNoteDurationSec, Math.max(0.05, duration))),
      velocity: Math.round(Math.min(1, Math.max(0.05, v)) * 100) / 100,
    });
  }

  clean.sort((a, b) => a.time - b.time || a.midi - b.midi);
  const durationSec = round3(clean.reduce((end, n) => Math.max(end, n.time + n.duration), 0));
  const cleanTitle =
    typeof title === "string" && title.trim()
      ? title.trim().slice(0, SONG_LIMITS.titleMax)
      : "Untitled song";
  return { title: cleanTitle, durationSec, notes: clean };
}

const asCount = (n: unknown) =>
  typeof n === "number" && Number.isFinite(n)
    ? Math.min(1_000_000, Math.max(0, Math.round(n)))
    : 0;

/** Validates an untrusted SongScore payload. */
export function sanitizeSongScore(raw: unknown): SongScore | null {
  if (typeof raw !== "object" || raw === null) return null;
  const s = raw as Record<string, unknown>;
  const accuracy =
    typeof s.accuracy === "number" && Number.isFinite(s.accuracy)
      ? Math.min(100, Math.max(0, Math.round(s.accuracy * 10) / 10))
      : 0;
  return {
    hit: asCount(s.hit),
    early: asCount(s.early),
    late: asCount(s.late),
    miss: asCount(s.miss),
    streak: asCount(s.streak),
    bestStreak: asCount(s.bestStreak),
    accuracy,
  };
}
