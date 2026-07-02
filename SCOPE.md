# PianoJam — Project Scope

## Purpose

PianoJam is a web-based collaborative piano application designed to help musicians and learners visualize and record their piano playing in real-time with other users. The project addresses a gap in existing tools: while applications like Synthesia and Piano Crumbs offer isolated playing or learning features, PianoJam uniquely combines a beautiful visual experience (animated note trails, customizable colors, low-latency synthesis), cross-platform accessibility (browser-based, no installation), online multiplayer capability, and audio recording — all with support for both virtual keyboard and MIDI hardware input.

**Target audience:** Beginner to intermediate pianists, music learners, and anyone interested in collaborative online music creation.

---

## In Scope (Implemented Features)

### Core Piano Playing
- **88-key virtual piano keyboard** with mouse/touch input (full grand piano range, A0–C8, MIDI numbers 21–108)
- **MIDI hardware instrument support** via Web MIDI API (Chrome 43+, Edge 79+, Opera 30+; **Firefox not supported** due to API limitation)
- **Real-time polyphonic sound synthesis** using Tone.js with multiple instrument sound packs
- **Trailing-notes visual effect** — animated color trails that follow played notes up the screen
- **Note and chord display** — real-time on-screen indication of currently pressed note(s) and any recognized chord

### Multiplayer & Rooms
- **Real-time collaborative rooms** powered by Socket.io
- **Room creation and management** — generate unique room IDs, set player capacity limits, optional per-room chat toggle
- **Room persistence** — rooms remain active while players are connected; guest access without login
- **Player list** — view who is currently playing in the room (logged-in users shown with username, guests with ID)
- **Cross-player note synchronization** — hear and see other players' notes in real-time

### Audio & Sound
- **21 built-in sound packs** including piano (×2), violin, cello, clarinet, guitar, harp, organ, and more
- **Adjustable metronome** with tempo range 40–208 BPM for practice alignment
- **Audio recording and export** — record a session and download as a local `.wav` file
- **Volume control** via keyboard velocity (when using MIDI devices; constant on mouse/touch input)

### User Features
- **Guest access** — play immediately without registration
- **User registration & login** with username, email, password (bcrypt-hashed, stored in MongoDB)
- **Persistent login state** via browser localStorage (survives page reload)
- **Profile preservation** — logged-in users display their username in rooms and chat

### Customization
- **Theme customization** — customize background color and note trail colors via color picker
- **Settings persistence** — theme choices stored in Redux state (reset available)

### Communication
- **In-room text chat** (toggleable per room during creation)
- **Real-time chat synchronization** via Socket.io across all players in a room
- **User identification in chat** — messages labeled with username (if logged in) or guest ID

---

## Out of Scope (Explicitly Not Implemented)

Based on the thesis "Future Directions" chapter, the following features are **intentionally deferred** and are not part of the current release:

- **User profile pages** — no personal user profiles or customization beyond login credentials
- **Friends/social features** — no friend lists, follow functionality, or user-to-user messaging
- **Server-side recording storage** — audio recordings are downloaded locally only; no "Your Recordings" library or cloud storage
- **MIDI file export** — only audio recording is supported; MIDI recording (`.mid` export) is not implemented
- **Password-protected / private rooms** — all rooms are open to any player who knows or discovers the room ID
- **Additional sound packs beyond the current 21** — no plan for third-party sound pack installation
- **Sheet music display / MusicXML rendering** — `opensheetmusicdisplay` is a dependency in `package.json` but is unused; sheet music rendering was not implemented
- **Redux store normalization** — further performance optimization work is deferred
- **Comprehensive test coverage** — project uses default Create React App test setup; no additional test suite

---

## Known Constraints

### Browser & Platform
- **MIDI support limited to Chromium-based browsers** (Chrome, Edge, Opera) and Safari/newer versions; Firefox does not support Web MIDI API
- **Cross-platform accessibility:** Works on Windows, macOS, Linux (any OS with a modern browser)
- **No native desktop or mobile apps** — web-only at this time

### Technical
- **Single-threaded Node.js server** — suitable for current load; not optimized for extreme scale
- **Real-time latency depends on network and browser performance** — not suitable for professional recording; intended for learning and casual play
- **No built-in user activity logging or analytics**

### Testing & Quality
- **No automated test suite** beyond Create React App defaults — manual testing required
- **No continuous integration pipeline** — builds and deployment are manual

---

## Non-Goals (Intentionally Out of Scope)

Per a comparison with similar tools in the thesis, the following are **not objectives** of PianoJam:

- **Learning tool with pedagogical features** — unlike Synthesia, this is not a learn-to-play app with hand/fingering guidance or difficulty progression
- **MIDI composition editor** — unlike Piano Crumbs, users cannot edit notes in a timeline or export standard notation
- **Installation-based desktop app** — explicitly designed to be web-first (avoiding installation friction)
- **Subscription or premium monetization model** — this is a free, open-source educational/personal project

---

## Roadmap Notes

Features listed in the thesis as "Future Directions" (e.g., profile pages, server-side recordings, MIDI export) remain candidates for future development but are not committed priorities. Community contributions or a future major release may address these.

For the current scope and constraints, see [README.md](./README.md) for setup, feature walkthrough, and API documentation.
