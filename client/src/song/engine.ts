import type { RoomSongState, SongData, SongPlayback, SongScore } from "@pianojam/shared";
import { MIDI_MAX, MIDI_MIN, SONG_GRADE_WINDOWS } from "@pianojam/shared";
import * as audio from "../audio/engine";
import { useAudioStore } from "../state/audioStore";
import { usePracticeKeys, type PracticeKeyState } from "../state/practiceKeys";
import { useRoomStore } from "../state/roomStore";
import { useSongStore } from "../state/songStore";
import { toast } from "../state/toastStore";
import { getSocket } from "../lib/socket";

/**
 * The Song Mode core, outside React. It anchors the server's playback
 * snapshots to performance.now() and derives the live position locally, so
 * every client advances smoothly between (rare) server updates.
 *
 * Three concerns share the one loaded song:
 * - Play mode: trigger the song's notes through the audio engine.
 * - Keep Up: grade the local player's presses against the shared timeline.
 * - Wait mode: a purely local practice session whose playhead only advances
 *   while the player holds the right notes for their written lengths
 *   (solo only, blocked during shared sessions).
 */

const SONG_OWNER = "song";
const TICK_MS = 30;
/** Notes we fall behind by more than this (hidden tab) stay silent. */
const CATCH_UP_SEC = 0.35;
/** How long a grade flash stays visible on the canvas. */
export const FLASH_SEC = 0.5;

export type GradeKind = "hit" | "early" | "late" | "miss";

export interface GradeFlash {
  midi: number;
  /** performance.now()/1000 when graded. */
  at: number;
  kind: GradeKind;
}

/** Per-note grade codes for the canvas (indexes match song.notes). */
export const GRADE = { none: 0, hit: 1, early: 2, late: 3, miss: 4 } as const;

/** Per-note practice codes for the canvas (indexes match song.notes). */
export const WAIT_STATE = { pending: 0, required: 1, held: 2, done: 3 } as const;

/** A song note the practice playhead has reached but not fully left behind. */
interface WaitOpenNote {
  /** Index into song.notes. */
  idx: number;
  /** The transposed midi the player actually has to press. */
  key: number;
  /** Song position where the hold requirement ends (the lenient tail starts). */
  gateEnd: number;
  /** Song position where the note ends. */
  end: number;
  /** True once this note has been held at least once (counted as correct). */
  engaged: boolean;
  /** Wall-clock ms when the playhead crossed `end`; drives overhold red. */
  endedAtWall: number | null;
}

interface WaitSession {
  pos: number;
  transpose: number;
  correct: number;
  wrong: number;
  lastTickAt: number;
  /** Per-note WAIT_STATE codes, aligned with song.notes (for the canvas). */
  states: Uint8Array;
  /** First song note the playhead has not reached yet. */
  scanIdx: number;
  open: WaitOpenNote[];
  /** Press bookkeeping so repeated notes need a fresh key-down each time. */
  pressSeq: number;
  lastPress: Map<number, number>;
  consumed: Map<number, number>;
}

export interface SongView {
  notes: SongData["notes"];
  pos: number;
  rate: number;
  transpose: number;
  /** Set during Keep Up: per-note grade codes for tinting. */
  grades: Uint8Array | null;
  /** Set during Wait mode: per-note practice codes (WAIT_STATE). */
  waitStates: Uint8Array | null;
}

let song: SongData | null = null;
let playback: SongPlayback | null = null;
/** Local anchor: song position `anchorPos` was current at `anchorAt` ms. */
let anchorPos = 0;
let anchorAt = 0;
let ended = false;

// Play-mode audio: next note to trigger and what is currently sounding.
let audioIdx = 0;
let sounding: { midi: number; end: number }[] = [];

// Keep Up grading.
let grades: Uint8Array | null = null;
let sweepIdx = 0;
let tally = { hit: 0, early: 0, late: 0, miss: 0, streak: 0, bestStreak: 0 };
let scoreDirty = false;
let lastScoreSentAt = 0;

let wait: WaitSession | null = null;
const heldMidis = new Set<number>();

let flashes: GradeFlash[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

const nowMs = () => performance.now();

function sharedPos(at = nowMs()): number {
  if (!playback) return 0;
  if (playback.state !== "playing") return anchorPos;
  return anchorPos + ((at - anchorAt) / 1000) * playback.rate;
}

/** Live position for UI (seek slider). */
export function currentPositionSec(): number {
  return wait ? wait.pos : sharedPos();
}

function flash(midi: number, kind: GradeKind): void {
  if (midi < MIDI_MIN || midi > MIDI_MAX) return;
  flashes.push({ midi, at: nowMs() / 1000, kind });
}

export function getGradeFlashes(): readonly GradeFlash[] {
  const cutoff = nowMs() / 1000 - FLASH_SEC;
  if (flashes.length && flashes[0]!.at < cutoff) {
    flashes = flashes.filter((f) => f.at >= cutoff);
  }
  return flashes;
}

/** First index with note.time >= t (notes are sorted by time). */
function lowerBound(notes: SongData["notes"], t: number): number {
  let lo = 0;
  let hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid]!.time < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function releaseSongVoices(): void {
  audio.releaseAllFor(SONG_OWNER);
  sounding = [];
}

function ensureTicking(): void {
  if (timer) return;
  timer = setInterval(tick, TICK_MS);
}

function stopTickingIfIdle(): void {
  if (timer && !wait && playback?.state !== "playing") {
    clearInterval(timer);
    timer = null;
  }
}

/* ----------------------------- lifecycle ---------------------------- */

export function applySongLoaded(data: SongData, from: string): void {
  song = data;
  ended = false;
  grades = null;
  releaseSongVoices();
  audioIdx = 0;
  if (wait) exitWaitMode();
  useSongStore.getState().setSong(data, from);
}

export function applyPlayback(pb: SongPlayback): void {
  const prev = playback;
  const prevPos = sharedPos();
  playback = pb;
  anchorPos = pb.positionSec;
  anchorAt = nowMs();
  // A fresh session adopts its rate instantly; mid-session changes ease in.
  if (!prev || prev.state === "stopped") snapVisualRate(pb.rate);

  // Solo Wait mode never runs at the same time as a shared session.
  if (pb.state === "playing" && wait) {
    exitWaitMode();
    toast.info("The admin started a room session, so your solo practice ended.");
  }

  if (pb.state === "playing") {
    ended = false;
    const freshStart = !prev || prev.state === "stopped" || prev.mode !== pb.mode;
    if (pb.mode === "keepup" && freshStart) resetGrading(pb.positionSec);
    ensureTicking();
  }

  // Re-aim the audio pointer; cut ringing voices when the sound would be
  // wrong (pause/stop, a transpose change, or an audible position jump).
  if (song) audioIdx = lowerBound(song.notes, pb.positionSec);
  const jumped = Math.abs(pb.positionSec - prevPos) > 0.3;
  if (pb.state !== "playing" || jumped || (prev && prev.transpose !== pb.transpose)) {
    releaseSongVoices();
  }
  // A seek must not turn every skipped (or replayed) note into a miss:
  // grading simply resumes from the new position.
  if (jumped && grades && song) {
    sweepIdx = lowerBound(song.notes, pb.positionSec);
  }

  useSongStore.getState().setPlayback(pb);
  stopTickingIfIdle();
}

/** Applies the song state received when joining a room. */
export function applyServerSongState(state: RoomSongState | null): void {
  if (!state) return;
  applySongLoaded(state.data, "");
  // After applyPlayback: a running Keep Up session resets the local grading
  // (clearing the score map), so the room's known scores merge in last.
  applyPlayback(state.playback);
  useSongStore.getState().mergeScores(state.scores);
}

/** Full teardown when leaving the room. */
export function resetSongEngine(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  releaseSongVoices();
  song = null;
  playback = null;
  wait = null;
  grades = null;
  ended = false;
  flashes = [];
  heldMidis.clear();
  usePracticeKeys.getState().clear();
  useSongStore.getState().reset();
}

/* ---------------------------- keep up ------------------------------- */

function resetGrading(fromPos: number): void {
  if (!song) return;
  grades = new Uint8Array(song.notes.length);
  // Start grading at the session's position: someone who joins mid-song is
  // only measured from that point on, not blamed for everything before it.
  sweepIdx = lowerBound(song.notes, fromPos);
  tally = { hit: 0, early: 0, late: 0, miss: 0, streak: 0, bestStreak: 0 };
  scoreDirty = false;
  lastScoreSentAt = 0;
  flashes = [];
  const store = useSongStore.getState();
  store.clearScores();
  store.setSummaryOpen(false);
  publishScore(false);
}

function currentScore(): SongScore {
  const graded = tally.hit + tally.early + tally.late + tally.miss;
  const points = tally.hit + 0.5 * (tally.early + tally.late);
  return {
    hit: tally.hit,
    early: tally.early,
    late: tally.late,
    miss: tally.miss,
    streak: tally.streak,
    bestStreak: tally.bestStreak,
    accuracy: graded === 0 ? 100 : Math.round((points / graded) * 1000) / 10,
  };
}

/** Updates the local leaderboard immediately; optionally tells the room. */
function publishScore(send: boolean): void {
  const score = currentScore();
  const selfName = useRoomStore.getState().self?.name;
  if (selfName) useSongStore.getState().setScore(selfName, score);
  if (send) {
    getSocket().emit("song:score", score);
    lastScoreSentAt = nowMs();
    scoreDirty = false;
  }
}

function gradePress(midi: number, pos: number): void {
  if (!song || !grades || !playback) return;
  const nearSong = SONG_GRADE_WINDOWS.nearSec * playback.rate;
  const notes = song.notes;

  // Nearest ungraded expected note of this pitch within the near window.
  let best = -1;
  let bestDt = Infinity;
  for (let i = lowerBound(notes, pos - nearSong); i < notes.length; i++) {
    const note = notes[i]!;
    if (note.time > pos + nearSong) break;
    if (grades[i] !== GRADE.none || note.midi + playback.transpose !== midi) continue;
    const dt = Math.abs(note.time - pos);
    if (dt < bestDt) {
      bestDt = dt;
      best = i;
    }
  }

  if (best === -1) {
    // A stray press with no expected note nearby counts against you,
    // otherwise mashing every key would win.
    tally.miss += 1;
    tally.streak = 0;
    flash(midi, "miss");
  } else {
    const dtReal = (pos - notes[best]!.time) / playback.rate;
    if (Math.abs(dtReal) <= SONG_GRADE_WINDOWS.hitSec) {
      grades[best] = GRADE.hit;
      tally.hit += 1;
      tally.streak += 1;
      tally.bestStreak = Math.max(tally.bestStreak, tally.streak);
      flash(midi, "hit");
    } else if (dtReal < 0) {
      grades[best] = GRADE.early;
      tally.early += 1;
      flash(midi, "early");
    } else {
      grades[best] = GRADE.late;
      tally.late += 1;
      flash(midi, "late");
    }
  }
  scoreDirty = true;
  publishScore(false);
}

function sweepMisses(pos: number): void {
  if (!song || !grades || !playback) return;
  const nearSong = SONG_GRADE_WINDOWS.nearSec * playback.rate;
  const notes = song.notes;
  let missedNow = false;
  while (sweepIdx < notes.length && notes[sweepIdx]!.time < pos - nearSong) {
    if (grades[sweepIdx] === GRADE.none) {
      grades[sweepIdx] = GRADE.miss;
      tally.miss += 1;
      tally.streak = 0;
      flash(notes[sweepIdx]!.midi + playback.transpose, "miss");
      scoreDirty = true;
      missedNow = true;
    }
    sweepIdx += 1;
  }
  if (missedNow) publishScore(false);
}

/* --------------------------- local input ---------------------------- */

/** Every local key press flows through here (from audio/player.ts). */
export function songLocalPress(midi: number): void {
  heldMidis.add(midi);
  if (wait) {
    waitPress(midi);
    return;
  }
  if (playback?.state === "playing" && playback.mode === "keepup" && grades) {
    gradePress(midi, sharedPos());
  }
}

export function songLocalRelease(midi: number): void {
  heldMidis.delete(midi);
  // Releasing can freeze the playhead or change key verdicts; reflect it now.
  if (wait) tickWait(nowMs());
}

/* ---------------------------- wait mode ----------------------------- */

/**
 * Wait mode is a hold-gated playhead. The position advances in real time
 * only while every note it is currently inside of is held down, and it can
 * never cross a note's onset unless that key is already pressed, so the
 * song freezes at each new note or chord until the player supplies it.
 * Releasing early freezes mid-note; pressing again resumes from there. The
 * last WAIT_LENIENCY fraction of every note is forgiven so slightly short
 * holds never stall a run.
 */

/** Fraction at the end of a note that may go unheld and still count. */
const WAIT_LENIENCY = 0.1;
/** Wall seconds a key may outlive its note before it is flagged as overheld. */
const WAIT_OVERHOLD_GRACE_SEC = 0.2;
/** Presses this many song seconds ahead of the playhead are anticipation, not mistakes. */
const WAIT_LOOKAHEAD_SEC = 0.35;
/** Falling-note lead-in before the first note when a run starts. */
const WAIT_LEAD_IN_SEC = 1.2;
/** Cap on one tick's advance so a hidden tab can't leap over notes. */
const WAIT_MAX_STEP_SEC = 0.25;

function canStartWaitMode(): boolean {
  return song !== null && (!playback || playback.state === "stopped") && !wait;
}

/** True while a solo Wait-mode practice run is active. */
export function isPracticing(): boolean {
  return wait !== null;
}

const waitPlayable = (key: number) => key >= MIDI_MIN && key <= MIDI_MAX;

/**
 * A held key only counts with a fresh press: once a note completes, its
 * press is spent, so a repeated note of the same pitch needs its own
 * key-down instead of being carried by one long hold.
 */
function waitArmed(w: WaitSession, key: number): boolean {
  return heldMidis.has(key) && w.lastPress.get(key) !== w.consumed.get(key);
}

export function startWaitMode(): boolean {
  if (!canStartWaitMode() || !song) return false;
  const transpose = playback?.transpose ?? 0;
  // A song whose every note transposes off the keyboard can't be practiced.
  if (!song.notes.some((n) => waitPlayable(n.midi + transpose))) return false;
  wait = {
    pos: song.notes[0]!.time - WAIT_LEAD_IN_SEC,
    transpose,
    correct: 0,
    wrong: 0,
    lastTickAt: nowMs(),
    states: new Uint8Array(song.notes.length),
    scanIdx: 0,
    open: [],
    pressSeq: 0,
    lastPress: new Map(),
    consumed: new Map(),
  };
  snapVisualRate(1);
  useSongStore.getState().setSolo({ active: true, correct: 0, wrong: 0, accuracy: 100 });
  ensureTicking();
  return true;
}

export function exitWaitMode(): void {
  if (!wait) return;
  wait = null;
  usePracticeKeys.getState().clear();
  useSongStore.getState().setSolo({ active: false });
  stopTickingIfIdle();
}

function finishWait(w: WaitSession): void {
  const accuracy = waitAccuracy(w);
  wait = null;
  usePracticeKeys.getState().clear();
  useSongStore.getState().setSolo({
    active: false,
    correct: w.correct,
    wrong: w.wrong,
    accuracy,
    lastAccuracy: accuracy,
  });
  toast.success(`Practice run complete: ${accuracy}% accuracy. Nice work!`);
  stopTickingIfIdle();
}

function waitAccuracy(w: WaitSession): number {
  const total = w.correct + w.wrong;
  return total === 0 ? 100 : Math.round((w.correct / total) * 1000) / 10;
}

/** Does this key belong to a note arriving within the anticipation window? */
function waitUpcomingSoon(w: WaitSession, key: number): boolean {
  const notes = song?.notes ?? [];
  for (let i = w.scanIdx; i < notes.length; i++) {
    const note = notes[i]!;
    if (note.time > w.pos + WAIT_LOOKAHEAD_SEC) return false;
    if (note.midi + w.transpose === key) return true;
  }
  return false;
}

/** A press is a mistake only if no note wants this key now or very soon. */
function waitMatchesExpected(w: WaitSession, key: number): boolean {
  for (const o of w.open) {
    if (o.key === key && w.pos < o.end) return true;
  }
  return waitUpcomingSoon(w, key);
}

function waitPress(midi: number): void {
  if (!wait) return;
  wait.pressSeq += 1;
  wait.lastPress.set(midi, wait.pressSeq);
  if (!waitMatchesExpected(wait, midi)) {
    wait.wrong += 1;
    flash(midi, "miss");
  }
  // Re-evaluate immediately so feedback doesn't wait for the next tick.
  tickWait(nowMs());
}

/** Verdict for one held key, shown on the on-screen keyboard. */
function waitKeyState(w: WaitSession, key: number, at: number): PracticeKeyState {
  let inTail = false;
  let overheld = false;
  let stale = false;
  for (const o of w.open) {
    if (o.key !== key) continue;
    if (w.pos < o.gateEnd) {
      if (waitArmed(w, key)) return "correct";
      // Right pitch, but this hold was spent on the previous note of the
      // same pitch: it must be released and struck again.
      stale = true;
    } else if (w.pos < o.end) {
      inTail = true;
    } else if (o.endedAtWall !== null && at - o.endedAtWall >= WAIT_OVERHOLD_GRACE_SEC * 1000) {
      overheld = true;
    } else {
      // Just past the note's end, still inside the release grace.
      inTail = true;
    }
  }
  if (inTail) return "correct";
  if (waitArmed(w, key) && waitUpcomingSoon(w, key)) return "correct";
  if (stale || overheld) return "overheld";
  return "wrong";
}

function tickWait(at: number): void {
  const w = wait;
  if (!w || !song) return;
  const notes = song.notes;
  const dt = Math.min(WAIT_MAX_STEP_SEC, Math.max(0, (at - w.lastTickAt) / 1000));
  w.lastTickAt = at;

  // 1. Every open note still inside its required span must be held with a
  //    fresh press; otherwise the playhead freezes where it is.
  let frozen = false;
  for (const o of w.open) {
    if (w.pos >= o.gateEnd) continue;
    if (waitArmed(w, o.key)) {
      if (!o.engaged) {
        o.engaged = true;
        w.correct += 1;
        flash(o.key, "hit");
      }
      w.states[o.idx] = WAIT_STATE.held;
    } else {
      w.states[o.idx] = WAIT_STATE.required;
      frozen = true;
    }
  }

  // 2. Advance, clamping exactly at the first onset whose key isn't down
  //    yet. Notes crossed on the way open up and start gating.
  if (!frozen && dt > 0) {
    let target = w.pos + dt;
    while (w.scanIdx < notes.length) {
      const note = notes[w.scanIdx]!;
      if (note.time > target) break;
      const key = note.midi + w.transpose;
      if (!waitPlayable(key)) {
        // Transposed off the keyboard: nothing to play, never blocks.
        w.states[w.scanIdx] = WAIT_STATE.done;
        w.scanIdx += 1;
        continue;
      }
      if (!waitArmed(w, key)) target = Math.max(w.pos, note.time);
      const o: WaitOpenNote = {
        idx: w.scanIdx,
        key,
        gateEnd: note.time + note.duration * (1 - WAIT_LENIENCY),
        end: note.time + note.duration,
        engaged: false,
        endedAtWall: null,
      };
      if (waitArmed(w, key)) {
        o.engaged = true;
        w.correct += 1;
        flash(key, "hit");
        w.states[o.idx] = WAIT_STATE.held;
      } else {
        w.states[o.idx] = WAIT_STATE.required;
      }
      w.open.push(o);
      w.scanIdx += 1;
    }
    w.pos = target;
  }

  // 3. Completions and overhold bookkeeping.
  for (let i = w.open.length - 1; i >= 0; i--) {
    const o = w.open[i]!;
    if (w.pos < o.gateEnd) continue;
    if (w.states[o.idx] !== WAIT_STATE.done) {
      w.states[o.idx] = WAIT_STATE.done;
      // The press that carried this note is spent (see waitArmed).
      const id = w.lastPress.get(o.key);
      if (id !== undefined) w.consumed.set(o.key, id);
    }
    if (w.pos >= o.end) {
      if (!heldMidis.has(o.key)) {
        w.open.splice(i, 1);
      } else if (o.endedAtWall === null) {
        o.endedAtWall = at;
      }
    }
  }

  // 4. Live key verdicts for the on-screen keyboard.
  const keyStates = new Map<number, PracticeKeyState>();
  for (const key of heldMidis) keyStates.set(key, waitKeyState(w, key, at));
  usePracticeKeys.getState().setKeys(keyStates);

  // 5. Stats and the end of the run.
  const solo = useSongStore.getState().solo;
  if (solo.correct !== w.correct || solo.wrong !== w.wrong) {
    useSongStore
      .getState()
      .setSolo({ correct: w.correct, wrong: w.wrong, accuracy: waitAccuracy(w) });
  }
  if (w.scanIdx >= notes.length && w.pos >= song.durationSec) finishWait(w);
}

/* ------------------------------ ticking ------------------------------ */

function tickAudio(pos: number): void {
  if (!song || !playback) return;
  const notes = song.notes;
  while (audioIdx < notes.length && notes[audioIdx]!.time <= pos) {
    const note = notes[audioIdx]!;
    audioIdx += 1;
    // After a long stall (hidden tab) skip what we missed instead of
    // firing a burst of stale notes.
    if (pos - note.time > CATCH_UP_SEC) continue;
    const midi = note.midi + playback.transpose;
    if (midi < MIDI_MIN || midi > MIDI_MAX) continue;
    audio.noteOn(midi, note.velocity, SONG_OWNER, useAudioStore.getState().instrumentId);
    sounding.push({ midi, end: note.time + note.duration });
  }
  for (let i = sounding.length - 1; i >= 0; i--) {
    if (sounding[i]!.end <= pos) {
      audio.noteOff(sounding[i]!.midi, SONG_OWNER);
      sounding.splice(i, 1);
    }
  }
}

function onSongEnded(): void {
  if (!song || !playback) return;
  ended = true;
  releaseSongVoices();
  const wasKeepUp = playback.mode === "keepup";
  if (wasKeepUp) {
    publishScore(true);
    useSongStore.getState().setSummaryOpen(true);
  }
  // The server settles into "stopped" lazily; mirror it locally so the
  // transport UI resets without waiting for another broadcast.
  applyPlayback({ ...playback, state: "stopped", positionSec: 0 });
}

function tick(): void {
  const at = nowMs();
  if (wait) tickWait(at);

  if (song && playback?.state === "playing") {
    const pos = sharedPos(at);
    if (playback.mode === "play") tickAudio(pos);
    else sweepMisses(pos);

    if (playback.mode === "keepup" && scoreDirty && at - lastScoreSentAt > 500) {
      publishScore(true);
    }
    if (!ended && pos >= song.durationSec + 0.5) onSongEnded();
  }
}

/* ------------------------------- view ------------------------------- */

/** True whenever the canvas is showing falling song notes. */
export function songVisualsActive(): boolean {
  return wait !== null || (song !== null && playback !== null && playback.state !== "stopped");
}

/**
 * The rate the canvas renders with eases toward the real playback rate, so
 * a tempo change re-spaces the falling notes smoothly instead of snapping
 * them to new positions. Audio and grading always use the real rate; a note
 * exactly at the keyboard line is unaffected either way.
 */
let visualRate = 1;
let visualRateAt = 0;

function snapVisualRate(target: number): void {
  visualRate = target;
  visualRateAt = nowMs();
}

function smoothedVisualRate(target: number): number {
  const at = nowMs();
  const dt = Math.min(0.25, Math.max(0, (at - visualRateAt) / 1000));
  visualRateAt = at;
  visualRate += (target - visualRate) * Math.min(1, dt * 5);
  if (Math.abs(target - visualRate) < 0.002) visualRate = target;
  return visualRate;
}

/** What the canvas needs this frame, or null when nothing is on. */
export function getSongView(): SongView | null {
  if (!song) return null;
  if (wait) {
    return {
      notes: song.notes,
      pos: wait.pos,
      rate: 1,
      transpose: wait.transpose,
      grades: null,
      waitStates: wait.states,
    };
  }
  if (playback && playback.state !== "stopped") {
    return {
      notes: song.notes,
      pos: sharedPos(),
      rate: smoothedVisualRate(playback.rate),
      transpose: playback.transpose,
      grades: playback.mode === "keepup" ? grades : null,
      waitStates: null,
    };
  }
  return null;
}
