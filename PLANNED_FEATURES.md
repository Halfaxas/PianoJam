# PianoJam - Planned Features

This document specifies four new features to build, as behavior and rules rather than
implementation steps. Build in the order listed (A, B, C are independent and small; D is
the larger, dependent effort). Where a decision was already made below, follow it exactly
rather than re-deriving an alternative.

---

## A. Private & Hidden Rooms

- Rooms gain a visibility state: **public**, **private**, or **hidden**.
- **Public**: current behavior, listed in the room browser, joinable by anyone.
- **Private**: not joinable without a valid invite link; still listed in the room browser
  (players can see it exists but need the link to get in).
- **Hidden**: implies private (invite-link-only) **and** never appears in the room browser
  at all.
- Visibility is chosen at room creation and can be changed later, but **only by the
  admin**, from the room settings panel.
- Every room gets an invite token, separate from the existing admin token, generated at
  creation regardless of visibility (so switching a public room to private later doesn't
  require a new join flow to be invented).
- The Share button's copied link includes the invite token whenever the room isn't public.
- The admin can regenerate the invite token from room settings. Regenerating immediately
  invalidates previously shared links; players already in the room are unaffected, but
  anyone trying to join with the old link is rejected.
- Joining a private or hidden room without a valid token is rejected the same way a full
  room or taken nickname is today (a clear rejection reason, not a silent failure).

---

## B. Per-Player Local Mute (client-only, not server-enforced)

- Any player can mute any other player, independently, for themselves only. This never
  touches the server and never affects what the muted player can do - it only changes what
  the muter perceives.
- This is distinct from the existing admin moderation mute (which is server-enforced and
  affects everyone). Keep the two clearly separate in the UI so a player doesn't confuse
  "I muted them for myself" with "the admin muted them for the room."
- Muting is per-category, per-player:
  - **Audio mute** - don't play that player's notes.
  - **Visual/notes mute** - don't show that player's key highlights or falling trails.
  - **Chat mute** - hide that player's chat messages.
- Each player gets a menu on every other player's roster entry to toggle these three
  independently.
- A quick "mute all others" button applies **audio + notes mute** to everyone else, leaving
  chat untouched by default (so you can practice without hearing or seeing someone else's
  notes, but keep talking to them). Players can still fine-tune any individual afterward.
- This pairs directly with Song Mode: a player can jam or practice at the same time as
  friends without their audio/visual noise, while chat coordination stays open.

---

## C. Reactions / Emotes

- A small fixed set of quick reactions (a handful of emoji - e.g. clap, fire, laugh, heart,
  thumbs up). Not user-customizable.
- Triggered with one click/tap from a compact picker near the keyboard or chat.
- Broadcasts to everyone in the room and renders as a brief floating animation near the
  sender's entry in the player roster, then disappears - no persistent history, no chat log
  entry.
- Rate-limit sending per player (a short cooldown) so it can't be spammed; enforce this
  server-side the same way chat/note muting is already enforced.

---

## D. Song Mode

Song Mode lets the room's admin load a MIDI file that everyone in the room experiences
together, either as playback or as practice.

### General rules

- **Only the room admin can ingest (upload or pick) a song.** No other player can load one.
- A room holds **one active song at a time**. Loading a new one replaces the current one
  for everyone.
- Ship a small handful of bundled sample songs the admin can pick from, in addition to
  uploading a custom `.mid` file. Both go through the same loading flow.
- **v1 treats a MIDI file as a single merged stream of notes** - do not split by
  track/channel into separate melody/backing parts, and do not let the admin pick which
  track is "the real one." Every note in the file is part of the one target sequence,
  whether the file has one track or several.
- No per-player custom songs. Everyone in the room is always working from the same loaded
  song. Do not build any path that lets an individual player load their own file instead.
- Nothing about a song persists past the room's lifetime - no history, no saved scores
  across sessions, consistent with rooms being fully in-memory and ephemeral today.

### Play Mode

- Pure playback: the song's notes play and render as falling notes toward the keyboard, in
  sync for everyone in the room.
- No grading, no pass/fail, no gating. Anyone can play along freely on top of it if they
  want, same as playing over someone else's live notes today.
- Admin controls playback: play, pause, stop, seek, tempo adjustment (roughly 50-150%
  speed), and transpose (semitones up/down). These controls affect the whole room.

### Practice Mode - Keep Up (room-wide)

- The song advances on its own fixed timeline regardless of what anyone plays - it does not
  wait for anyone.
- Every player in the room can practice **at the same time**, all measured against that one
  shared timeline.
- Each player's presses are graded individually against the expected notes: hit, miss,
  early, late. One player's mistakes never affect another player's grading or the song's
  progression.
- Give live per-player feedback (e.g., a hit/miss flash on the falling note) and a running
  accuracy/streak per player.

### Practice Mode - Wait For Correct Notes (solo only)

- The song only advances when the *individual practicing player* plays the correct
  note(s). It is not on a clock - there is no time pressure.
- Chords (multiple simultaneous notes expected) require all of them to be held before
  advancing.
- This mode is **solo only**: it cannot run at the same time as a room-wide Keep Up
  session. A player either practices Wait-mode on their own pace, independent of the rest
  of the room, or the room is doing a shared Keep Up / Play session - never both for the
  same player at the same time.
- Any player can start a personal Wait-mode pass over the currently loaded song whenever
  they want (as long as they're not currently in a shared session), without needing the
  admin to do anything special.

### Scoring & Leaderboard

- Practice accuracy (Keep Up in particular, since it's the mode where players are
  compared against one shared timeline) is **visible to the whole room**, not private -
  players see each other's live accuracy/streak, making it competitive.
- Show a simple live leaderboard (e.g., in the player roster) during a shared Keep Up
  session, and a final summary when the song ends.
- Solo Wait-mode practice can still track and show its own accuracy to the practicing
  player, but it's not part of the room-wide competitive leaderboard since it's not a
  shared, timed session.

---

## Explicitly Out of Scope for This Round

- **Split-keyboard duet mode** (assigning key ranges/tracks to different players) -
  considered and dropped in favor of keeping Song Mode simple.
- **Per-player individually loaded songs** - dropped in favor of one shared song per room.
- **Track/channel selection within a MIDI file** - dropped for v1; revisit only if the
  merged-stream approach proves too limiting in practice.
- **Persistent scores or song history across sessions** - stays consistent with the rest of
  the app being fully ephemeral/in-memory.
