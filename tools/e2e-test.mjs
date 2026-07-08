/**
 * End-to-end exercise of the new server features against a running server:
 *
 *   PORT=5199 npm start          (in another terminal)
 *   node tools/e2e-test.mjs
 *
 * Covers: private/hidden rooms + invite tokens (A), reactions + rate limit
 * (C), song load/control/score relay (D). Feature B is client-only.
 */

import { io } from "socket.io-client";

const URL = process.env.URL ?? "http://localhost:5199";
let failures = 0;

function check(name, cond, extra = "") {
  const ok = Boolean(cond);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && extra ? ` (${extra})` : ""}`);
  if (!ok) failures += 1;
}

const connect = () =>
  new Promise((resolve, reject) => {
    const s = io(URL, { transports: ["websocket"] });
    s.on("connect", () => resolve(s));
    s.on("connect_error", reject);
  });

const emitAck = (socket, event, ...args) =>
  new Promise((resolve) => socket.emit(event, ...args, resolve));

const once = (socket, event, timeoutMs = 1500) =>
  new Promise((resolve) => {
    const t = setTimeout(() => resolve(undefined), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(t);
      resolve(payload);
    });
  });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const admin = await connect();
const guest = await connect();

/* ------------------------- A: private rooms ------------------------- */

const created = await emitAck(admin, "room:create", {
  name: "E2E Private",
  maxPlayers: 5,
  chatEnabled: true,
  soundMode: "admin",
  visibility: "private",
});
check("create private room", created.ok && created.data.inviteToken?.length === 32);
const roomId = created.data.room.id;
const inviteToken = created.data.inviteToken;

const joinNoInvite = await emitAck(guest, "room:join", {
  roomId,
  nickname: "Guest",
  avatar: "fox",
});
check(
  "join private room without invite rejected",
  !joinNoInvite.ok && joinNoInvite.code === "INVITE_INVALID",
  JSON.stringify(joinNoInvite),
);

const adminJoin = await emitAck(admin, "room:join", {
  roomId,
  nickname: "Admin",
  avatar: "owl",
  adminToken: created.data.adminToken,
});
check(
  "creator joins own private room via admin token",
  adminJoin.ok && adminJoin.data.self.isAdmin && adminJoin.data.inviteToken === inviteToken,
);

const guestJoin = await emitAck(guest, "room:join", {
  roomId,
  nickname: "Guest",
  avatar: "fox",
  inviteToken,
});
check("guest joins with invite link", guestJoin.ok && guestJoin.data.song === null);

let rooms = await new Promise((r) => admin.emit("room:list", r));
check(
  "private room is listed with visibility",
  rooms.some((r) => r.id === roomId && r.visibility === "private"),
);

const guestInvitePromise = once(guest, "room:invite");
const regen = await emitAck(admin, "room:regenerateInvite");
const guestInvite = await guestInvitePromise;
check(
  "regenerated invite broadcast to members",
  regen.ok && regen.data.inviteToken !== inviteToken &&
    guestInvite?.inviteToken === regen.data.inviteToken,
);

const third = await connect();
const oldLinkJoin = await emitAck(third, "room:join", {
  roomId,
  nickname: "Sneaky",
  avatar: "cat",
  inviteToken, // the old, now invalid token
});
check("old invite link rejected after regenerate", !oldLinkJoin.ok && oldLinkJoin.code === "INVITE_INVALID");
const newLinkJoin = await emitAck(third, "room:join", {
  roomId,
  nickname: "Third",
  avatar: "cat",
  inviteToken: regen.data.inviteToken,
});
check("new invite link works", newLinkJoin.ok);

const guestRegen = await emitAck(guest, "room:regenerateInvite");
check("non-admin cannot regenerate invite", !guestRegen.ok);

admin.emit("room:setVisibility", "hidden");
const update = await once(guest, "room:update");
check("visibility change broadcast", update?.visibility === "hidden");
rooms = await new Promise((r) => admin.emit("room:list", r));
check("hidden room not listed", !rooms.some((r) => r.id === roomId));

guest.emit("room:setVisibility", "public");
await wait(150);
rooms = await new Promise((r) => admin.emit("room:list", r));
check("non-admin cannot change visibility", !rooms.some((r) => r.id === roomId));

/* --------------------------- C: reactions --------------------------- */

const reactionSeen = once(guest, "reaction");
const selfReactionSeen = once(admin, "reaction");
admin.emit("reaction:send", "🔥");
const r1 = await reactionSeen;
const r2 = await selfReactionSeen;
check("reaction broadcast to room", r1?.from === "Admin" && r1?.reaction === "🔥");
check("sender sees own reaction", r2?.reaction === "🔥");

const spam = once(guest, "reaction", 500);
admin.emit("reaction:send", "👏"); // within the cooldown window
check("reaction spam dropped by cooldown", (await spam) === undefined);

const badReaction = once(guest, "reaction", 500);
await wait(1600);
admin.emit("reaction:send", "🖕");
check("unknown reaction rejected", (await badReaction) === undefined);

/* --------------------------- D: song mode --------------------------- */

const notes = [];
for (let i = 0; i < 8; i++) {
  notes.push({ midi: 60 + i, time: i * 0.5, duration: 0.4, velocity: 0.8 });
}
const song = { title: "E2E Scale", durationSec: 4, notes };

const guestNotAdminLoad = await emitAck(guest, "song:load", song);
check("non-admin cannot load a song", !guestNotAdminLoad.ok);

const loadedSeen = once(guest, "song:loaded");
const playbackSeen = once(guest, "song:playback");
const loadAck = await emitAck(admin, "song:load", song);
const loaded = await loadedSeen;
const playback0 = await playbackSeen;
check(
  "song load broadcast",
  loadAck.ok && loaded?.song.title === "E2E Scale" && loaded?.song.notes.length === 8 &&
    playback0?.state === "stopped",
);

const badLoad = await emitAck(admin, "song:load", { title: "x", notes: [{ midi: 999, time: 0, duration: 1, velocity: 1 }] });
check("invalid song rejected", !badLoad.ok);

const playSeen = once(guest, "song:playback");
admin.emit("song:control", { type: "play", mode: "keepup" });
const playing = await playSeen;
check(
  "keep up session started with lead-in",
  playing?.state === "playing" && playing?.mode === "keepup" && playing?.positionSec === -1.5,
);

// Guest reports a score; the admin should receive it (sender excluded).
const scoreSeen = once(admin, "song:score");
guest.emit("song:score", { hit: 3, early: 1, late: 0, miss: 1, streak: 2, bestStreak: 3, accuracy: 70 });
const score = await scoreSeen;
check("score relayed to others", score?.from === "Guest" && score?.score.accuracy === 70);

// Late joiner receives the full song state including scores.
const late = await connect();
const lateJoin = await emitAck(late, "room:join", {
  roomId,
  nickname: "Late",
  avatar: "bee",
  inviteToken: regen.data.inviteToken,
});
check(
  "late joiner gets song, live position and scores",
  lateJoin.ok &&
    lateJoin.data.song?.data.title === "E2E Scale" &&
    lateJoin.data.song?.playback.state === "playing" &&
    lateJoin.data.song?.playback.positionSec > -1.5 &&
    lateJoin.data.song?.scores.Guest?.accuracy === 70,
  JSON.stringify(lateJoin.data?.song?.playback),
);

const rateSeen = once(guest, "song:playback");
admin.emit("song:control", { type: "rate", rate: 4 }); // out of range: clamps
const rated = await rateSeen;
check("rate clamped to 150%", rated?.rate === 1.5);

const pauseSeen = once(guest, "song:playback");
admin.emit("song:control", { type: "pause" });
const paused = await pauseSeen;
check("pause keeps position", paused?.state === "paused");

const seekSeen = once(guest, "song:playback");
admin.emit("song:control", { type: "seek", positionSec: 2 });
const sought = await seekSeen;
check("seek while paused", sought?.positionSec === 2 && sought?.state === "paused");

const stopSeen = once(guest, "song:playback");
guest.emit("song:control", { type: "stop" }); // not admin: ignored
admin.emit("song:control", { type: "stop" });
const stopped = await stopSeen;
check("stop resets position (admin only)", stopped?.state === "stopped" && stopped?.positionSec === 0);

// After stop, keepup scores no longer accepted (mode stays keepup though -
// they are accepted; instead verify a fresh play clears them server-side).
const playAgain = once(late, "song:playback");
admin.emit("song:control", { type: "play", mode: "keepup" });
await playAgain;
const late2 = await connect();
const late2Join = await emitAck(late2, "room:join", {
  roomId,
  nickname: "Later",
  avatar: "cow",
  inviteToken: regen.data.inviteToken,
});
check(
  "fresh keep up start clears the room scores",
  late2Join.ok && Object.keys(late2Join.data.song?.scores ?? {}).length === 0,
  JSON.stringify(late2Join.data?.song?.scores),
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
for (const s of [admin, guest, third, late, late2]) s.close();
process.exit(failures === 0 ? 0 : 1);
