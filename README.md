# PianoJam

Play piano together, in the browser. PianoJam gives you real-time collaborative rooms with an
88-key piano, MIDI hardware support, falling-note visuals, 21 instrument sound packs, chord
detection, a metronome, in-room chat and one-click audio recording to WAV.

> Rewritten from the ground up in 2026 (originally a 2022 Bachelor's thesis project).
> See [SCOPE.md](./SCOPE.md) for the feature scope.

## Features

- **88-key piano**: play with mouse/touch (with glissando), your computer keyboard
  (`Z`-`M` and `Q`-`P` rows, `Space` = sustain pedal), or a **MIDI keyboard** with full
  velocity and sustain-pedal support
- **Multiplayer rooms**: create a room (player limit, optional chat), share the ID or URL,
  and everyone hears and sees each other's notes in real time
- **Nicknames & avatars**: no accounts; pick a nickname and a cute animal avatar when you
  join (nicknames are unique per room, avatars are Twemoji icons)
- **Room admin**: the creator is the admin (crown in the player list, survives a page
  refresh) and can start a **synchronized metronome** on every player's device; anyone can
  stop their own copy afterwards
- **Two sound modes per room** (chosen at creation, mutually exclusive):
  - *Admin controlled*: the admin picks one sound pack and it applies to everyone
  - *Orchestra*: every player picks their own instrument, and you hear each player with
    theirs
- **Player strip**: always-visible roster with avatar, nickname, current instrument and a
  glow while someone plays
- **21 sound packs**: two pianos, strings, guitars, winds, brass, organ, harp, xylophone...
- **Falling-note trails** rendered on a canvas at 60 fps, with customizable colors
- **Note & chord display** with live chord recognition
- **Metronome**: 40-208 BPM with accented downbeats and sample-accurate scheduling
- **Recording**: capture your session and download it as a `.wav`

MIDI input works in Chrome, Edge, Opera and Safari (Firefox does not implement the Web MIDI API).

## Tech stack

| Layer     | Tech |
|-----------|------|
| Client    | React 19 + TypeScript + Vite, Zustand, Tone.js, tonal, Socket.IO client |
| Server    | Node.js + TypeScript, Express 5, Socket.IO |
| Monorepo  | npm workspaces: `client`, `server`, `shared` (typed socket contracts + note math) |

No database and no external services: rooms, players and admin rights live in server memory.

## Getting started

Requires **Node.js 20+**.

```bash
npm install
npm run dev
```

- Client (Vite dev server): http://localhost:3000
- Server (API + Socket.IO): http://localhost:5000 (the client proxies `/api` and `/socket.io` to it)

Open http://localhost:3000, create a room, and play. Open the same room URL in a second
tab (pick a different nickname) to hear the multiplayer sync.

## Production

The app is deployed as two pieces, both free:

- **Client** → [Cloudflare Pages](https://pages.cloudflare.com) (static `client/dist`; a root
  `wrangler.jsonc` configures the asset directory + SPA fallback for Cloudflare's unified
  Workers & Pages "Import a repository" flow, which no longer shows separate build/output
  fields when it finds one)
- **Server** → [Render](https://render.com) free web service (Express + Socket.IO needs a
  long-running process, which Cloudflare's free tier doesn't offer; see `render.yaml`)

```bash
npm run build    # builds client/dist
npm start        # serves API + Socket.IO on :5000 (and the built client, for local/single-host use)
```

Environment variables:

- Server: `PORT` (default `5000`), `CLIENT_ORIGIN` — comma-separated list of allowed client
  origins in production, e.g. `https://pianojam.pages.dev` (see `server/.env.example`).
- Client: `VITE_SERVER_URL` — the server's URL, e.g. `https://pianojam-server.onrender.com`.
  Leave unset for local dev or any single-origin deploy (see `client/.env.example`).

Deployment notes:

- The server still serves the built client itself if `client/dist` exists (single-host mode
  still works for a VPS or any other Node host), but the Cloudflare/Render split runs them as
  separate origins, hence `CLIENT_ORIGIN` / `VITE_SERVER_URL`.
- WebSockets must be allowed by your proxy/host (Socket.IO falls back to polling otherwise).
- Rooms are intentionally ephemeral: they live in server memory and close about a minute
  after the last player leaves.
- Render's free tier spins the server down after inactivity; the first connection after a
  quiet period takes ~30-50s to wake it back up.

## Project structure

```
shared/src/        Typed Socket.IO event contracts, note tables, keyboard geometry, avatars
server/src/
  index.ts         Express + Socket.IO bootstrap, static client serving
  rooms.ts         In-memory room manager (friendly IDs, capacity, admin, sound modes)
  sockets.ts       Socket handlers: join (nickname/avatar), note & pedal relay, chat,
                   instrument changes, admin metronome
client/src/
  audio/           Tone.js multi-sampler engine, instruments, MIDI, QWERTY input,
                   recorder, metronome, trails
  components/      Keyboard, NoteCanvas, JoinDialog, PlayerStrip, TopBar, panels
  pages/           HomePage (rooms browser), RoomPage (the piano)
  state/           Zustand stores (profile, room, theme, active notes, toasts)
  lib/             Socket singleton
client/public/res/samples/   Instrument samples (mp3/ogg/wav per note)
client/public/avatars/       Avatar icons (Twemoji, CC-BY 4.0)
```

## Architecture notes

- **No lag by design**: key presses go straight from input event to the Tone.js sampler and
  the socket, without touching React. Note trails are drawn by a single canvas
  `requestAnimationFrame` loop from a plain mutable array; each piano key subscribes only to
  its own active flag, so a keypress re-renders at most two DOM nodes.
- **One sampler per instrument**: in orchestra rooms each remote player is synthesized with
  their own instrument; packs load on demand and are cached.
- **One socket contract**: `shared/src/events.ts` types every event on both sides, so the
  compiler catches client/server drift.
- **Admin rights**: `room:create` returns a secret admin token; presenting it on join claims
  the crown. It is kept in `sessionStorage`, so a refresh keeps you admin. If the admin
  leaves, the longest-present player is promoted.

## Credits

Avatar icons are [Twemoji](https://github.com/twitter/twemoji) (CC-BY 4.0). Instrument
samples via [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments); the
Salamander grand piano streams from the Tone.js CDN.
