import { useEffect, useRef, useState } from "react";
import type { SongPlayMode } from "@pianojam/shared";
import { SONG_LIMITS } from "@pianojam/shared";
import { useDisplayStore } from "../../state/displayStore";
import { useIsAdmin } from "../../state/roomStore";
import { useSongStore } from "../../state/songStore";
import { toast } from "../../state/toastStore";
import { getSocket } from "../../lib/socket";
import { BUNDLED_SONGS, parseMidiBuffer } from "../../song/bundled";
import { currentPositionSec, exitWaitMode, startWaitMode } from "../../song/engine";

function formatTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Admin: the song picker, kept out of the main panel behind "Change song"
 * so the panel stays uncluttered. The loaded song is highlighted.
 */
function SongPicker({ onClose, showBack }: { onClose: () => void; showBack: boolean }) {
  const song = useSongStore((s) => s.song);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (buffer: ArrayBuffer, fallbackTitle: string, busyKey: string) => {
    setBusy(busyKey);
    try {
      const parsed = await parseMidiBuffer(buffer, fallbackTitle);
      if (!parsed) {
        toast.error(
          `Couldn't read that as a playable MIDI song (up to ${SONG_LIMITS.maxNotes} notes).`,
        );
        return;
      }
      getSocket().emit("song:load", parsed, (res) => {
        if (!res.ok) toast.error(res.error);
        else onClose();
      });
    } finally {
      setBusy(null);
    }
  };

  const loadBundled = async (id: string) => {
    const bundled = BUNDLED_SONGS.find((s) => s.id === id);
    if (!bundled || busy) return;
    try {
      const res = await fetch(bundled.url);
      if (!res.ok) throw new Error();
      await load(await res.arrayBuffer(), bundled.title, id);
    } catch {
      setBusy(null);
      toast.error("Couldn't fetch that sample song.");
    }
  };

  const loadFile = async (file: File) => {
    if (busy) return;
    const fallback = file.name.replace(/\.(mid|midi)$/i, "");
    await load(await file.arrayBuffer(), fallback, "upload");
  };

  return (
    <div className="song-picker">
      <div className="row-between">
        <span className="mode-picker-label">Pick a song for the room</span>
        {showBack && (
          <button className="btn ghost small" onClick={onClose}>
            Back
          </button>
        )}
      </div>
      {BUNDLED_SONGS.map((s) => {
        const selected = song?.title === s.title;
        return (
          <button
            key={s.id}
            className={`list-item${selected ? " selected" : ""}`}
            disabled={busy !== null}
            onClick={() => void loadBundled(s.id)}
          >
            🎼 {s.title}
            {busy === s.id ? (
              <span className="spinner list-item-spinner" />
            ) : (
              selected && <span className="song-loaded-badge">Loaded</span>
            )}
          </button>
        );
      })}
      <input
        ref={fileRef}
        type="file"
        accept=".mid,.midi"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void loadFile(file);
        }}
      />
      <button
        className="btn ghost"
        disabled={busy !== null}
        onClick={() => fileRef.current?.click()}
      >
        📂 Upload a .mid file{busy === "upload" && <span className="spinner" />}
      </button>
      <div className="hint">Loading a song replaces the current one for everyone.</div>
    </div>
  );
}

/** Admin: room-wide transport (play/pause/stop, seek, tempo, transpose). */
function Transport() {
  const song = useSongStore((s) => s.song);
  const playback = useSongStore((s) => s.playback);
  const [modeChoice, setModeChoice] = useState<SongPlayMode>("play");
  const [pos, setPos] = useState(0);
  const [ratePct, setRatePct] = useState(Math.round((playback?.rate ?? 1) * 100));
  const dragging = useRef(false);

  // Follow the live position while not dragging the seek slider.
  useEffect(() => {
    const t = setInterval(() => {
      if (!dragging.current) setPos(currentPositionSec());
    }, 200);
    return () => clearInterval(t);
  }, []);

  // Track rate changes made elsewhere (e.g. an earlier session).
  useEffect(() => {
    setRatePct(Math.round((playback?.rate ?? 1) * 100));
  }, [playback?.rate]);

  if (!song) return null;
  const state = playback?.state ?? "stopped";
  const transpose = playback?.transpose ?? 0;

  return (
    <div className="song-transport">
      <span className="mode-picker-label">Room session (you control everyone's view)</span>
      {state === "stopped" ? (
        <div className="segmented">
          <button
            className={`segment${modeChoice === "play" ? " selected" : ""}`}
            onClick={() => setModeChoice("play")}
            title="The song plays by itself; everyone can play along"
          >
            ▶ Playback
          </button>
          <button
            className={`segment${modeChoice === "keepup" ? " selected" : ""}`}
            onClick={() => setModeChoice("keepup")}
            title="The song is silent and everyone is graded on playing it"
          >
            🏁 Keep up
          </button>
        </div>
      ) : (
        <div className="hint">
          {playback?.mode === "keepup"
            ? "Keep up session: everyone is graded against the song."
            : "Playback session: the song plays for everyone."}
        </div>
      )}
      <div className="transport-buttons">
        {state !== "playing" ? (
          <button
            className="btn primary"
            onClick={() => getSocket().emit("song:control", { type: "play", mode: modeChoice })}
          >
            ▶ {state === "paused" ? "Resume" : "Start"}
          </button>
        ) : (
          <button
            className="btn ghost"
            onClick={() => getSocket().emit("song:control", { type: "pause" })}
          >
            ⏸ Pause
          </button>
        )}
        <button
          className="btn ghost"
          disabled={state === "stopped"}
          onClick={() => getSocket().emit("song:control", { type: "stop" })}
        >
          ⏹ Stop
        </button>
        <span className="song-time">
          {formatTime(pos)} / {formatTime(song.durationSec)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={Math.ceil(song.durationSec)}
        step={0.1}
        value={Math.min(Math.max(pos, 0), song.durationSec)}
        disabled={state === "stopped"}
        onChange={(e) => {
          dragging.current = true;
          setPos(Number(e.target.value));
        }}
        onPointerUp={(e) => {
          dragging.current = false;
          getSocket().emit("song:control", {
            type: "seek",
            positionSec: Number((e.target as HTMLInputElement).value),
          });
        }}
        title="Seek"
      />
      <label>
        Tempo: {ratePct}%
        <input
          type="range"
          min={SONG_LIMITS.minRate * 100}
          max={SONG_LIMITS.maxRate * 100}
          step={5}
          value={ratePct}
          onChange={(e) => setRatePct(Number(e.target.value))}
          onPointerUp={() =>
            getSocket().emit("song:control", { type: "rate", rate: ratePct / 100 })
          }
        />
      </label>
      <div className="row-between">
        <span className="mode-picker-label">
          Transpose: {transpose > 0 ? `+${transpose}` : transpose} st
        </span>
        <span>
          <button
            className="btn ghost small"
            disabled={transpose <= -SONG_LIMITS.maxTranspose}
            onClick={() =>
              getSocket().emit("song:control", { type: "transpose", semitones: transpose - 1 })
            }
          >
            −
          </button>{" "}
          <button
            className="btn ghost small"
            disabled={transpose >= SONG_LIMITS.maxTranspose}
            onClick={() =>
              getSocket().emit("song:control", { type: "transpose", semitones: transpose + 1 })
            }
          >
            +
          </button>
        </span>
      </div>
    </div>
  );
}

/** Any player: solo Wait-mode practice over the loaded song. */
function SoloSection() {
  const song = useSongStore((s) => s.song);
  const playback = useSongStore((s) => s.playback);
  const solo = useSongStore((s) => s.solo);
  if (!song) return null;

  const sharedActive = playback !== null && playback.state !== "stopped";

  if (solo.active) {
    return (
      <div className="song-solo">
        <span className="mode-picker-label">Solo practice</span>
        <div className="solo-stats">
          <span>✔ {solo.correct}</span>
          <span>✘ {solo.wrong}</span>
          <b>{solo.accuracy}%</b>
        </div>
        <div className="hint">
          Your live score also floats over the stage. The song moves only while you hold
          the right keys, for each note's full written length.
        </div>
        <button className="btn ghost" onClick={() => exitWaitMode()}>
          Stop practicing
        </button>
      </div>
    );
  }

  return (
    <div className="song-solo">
      <span className="mode-picker-label">Solo practice (wait for correct notes)</span>
      <div className="hint">
        Practice at your own pace: the song only advances while you hold the right notes
        for as long as they are written. No timer, no room-wide score.
        {solo.lastAccuracy !== null && ` Last run: ${solo.lastAccuracy}%.`}
      </div>
      <span
        className="tooltip-wrap block"
        data-tip={
          sharedActive
            ? "Available once the room session is stopped"
            : "Only you advance the song; others aren't affected"
        }
      >
        <button
          className="btn primary full"
          disabled={sharedActive}
          onClick={() => {
            if (!startWaitMode()) toast.error("Solo practice isn't available right now.");
          }}
        >
          🎯 Practice on my own
        </button>
      </span>
    </div>
  );
}

/** Per-client display toggles; nothing here affects other players. */
function DisplaySection() {
  const noteLabels = useDisplayStore((s) => s.noteLabels);
  const setNoteLabels = useDisplayStore((s) => s.setNoteLabels);
  return (
    <div className="song-display">
      <span className="mode-picker-label">Display (only affects you)</span>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={noteLabels}
          onChange={(e) => setNoteLabels(e.target.checked)}
        />
        Show note names on falling notes
      </label>
    </div>
  );
}

export function SongPanel() {
  const isAdmin = useIsAdmin();
  const song = useSongStore((s) => s.song);
  const loadedBy = useSongStore((s) => s.loadedBy);
  const [pickerOpen, setPickerOpen] = useState(false);

  // The picker takes over the panel; with no song yet it is the only view
  // that makes sense for the admin.
  if (isAdmin && (pickerOpen || !song)) {
    return (
      <div className="song-panel">
        <SongPicker onClose={() => setPickerOpen(false)} showBack={song !== null} />
      </div>
    );
  }

  return (
    <div className="song-panel">
      {song ? (
        <div className="song-current">
          <div className="song-current-info">
            <span className="song-title">🎵 {song.title}</span>
            <span className="hint">
              {formatTime(song.durationSec)} · {song.notes.length} notes
              {loadedBy ? ` · loaded by ${loadedBy}` : ""}
            </span>
          </div>
          {isAdmin && (
            <button className="btn ghost small" onClick={() => setPickerOpen(true)}>
              Change song
            </button>
          )}
        </div>
      ) : (
        <div className="hint">No song loaded yet. The room admin can load one.</div>
      )}

      {isAdmin && <Transport />}
      <SoloSection />
      <DisplaySection />
      {!isAdmin && song && (
        <div className="hint">Only the room admin can load songs and control playback.</div>
      )}
    </div>
  );
}
