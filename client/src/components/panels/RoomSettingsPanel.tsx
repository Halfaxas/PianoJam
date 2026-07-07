import type { RoomVisibility, SoundMode } from "@pianojam/shared";
import { useRoomStore } from "../../state/roomStore";
import { getSocket } from "../../lib/socket";
import { getInstrument } from "../../audio/instruments";
import { toast } from "../../state/toastStore";

const VISIBILITY_OPTIONS: { id: RoomVisibility; label: string; hint: string }[] = [
  { id: "public", label: "Public", hint: "Listed in the room browser, anyone can join." },
  { id: "private", label: "Private", hint: "Listed, but joining needs the invite link." },
  { id: "hidden", label: "Hidden", hint: "Not listed anywhere; invite link only." },
];

/**
 * Admin-only room controls: switch the sound mode, change visibility,
 * regenerate the invite link, mute players (chat and/or playing) and kick
 * players. Leaving orchestra mode forces everyone onto the admin's current
 * instrument (the server handles that).
 */
export function RoomSettingsPanel() {
  const room = useRoomStore((s) => s.room);
  const players = useRoomStore((s) => s.players);
  const self = useRoomStore((s) => s.self);
  if (!room) return null;

  const others = players.filter((p) => p.id !== self?.id);

  const setMode = (mode: SoundMode) => {
    if (mode !== room.soundMode) getSocket().emit("room:setMode", mode);
  };

  const setVisibility = (visibility: RoomVisibility) => {
    if (visibility !== room.visibility) getSocket().emit("room:setVisibility", visibility);
  };

  const regenerateInvite = () => {
    getSocket().emit("room:regenerateInvite", (res) => {
      if (res.ok) {
        toast.success("New invite link created. Links shared before now no longer work.");
      } else {
        toast.error(res.error);
      }
    });
  };

  const setMute = (playerId: string, chat: boolean, notes: boolean) => {
    getSocket().emit("room:mute", { playerId, chat, notes });
  };

  return (
    <div className="room-settings">
      <div className="mode-picker">
        <span className="mode-picker-label">Room type</span>
        <label className={`mode-option${room.soundMode === "admin" ? " selected" : ""}`}>
          <input
            type="radio"
            name="roomMode"
            checked={room.soundMode === "admin"}
            onChange={() => setMode("admin")}
          />
          <span>
            <b>Solo instrument</b>
            <small>You pick one sound pack and everyone plays with it.</small>
          </span>
        </label>
        <label className={`mode-option${room.soundMode === "orchestra" ? " selected" : ""}`}>
          <input
            type="radio"
            name="roomMode"
            checked={room.soundMode === "orchestra"}
            onChange={() => setMode("orchestra")}
          />
          <span>
            <b>Orchestra</b>
            <small>Everyone picks their own instrument and plays it together.</small>
          </span>
        </label>
        {room.soundMode === "orchestra" && (
          <div className="hint">
            Switching to solo instrument moves everyone to your current sound pack.
          </div>
        )}
      </div>

      <div className="mode-picker">
        <span className="mode-picker-label">Visibility</span>
        <div className="segmented">
          {VISIBILITY_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.id}
              className={`segment${room.visibility === option.id ? " selected" : ""}`}
              onClick={() => setVisibility(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="hint">
          {VISIBILITY_OPTIONS.find((option) => option.id === room.visibility)!.hint}
        </div>
        <div className="row-between">
          <span className="hint">
            Regenerating makes previously shared invite links stop working.
          </span>
          <button className="btn ghost small" onClick={regenerateInvite}>
            ↻ New invite link
          </button>
        </div>
      </div>

      <div className="mode-picker-label">Players</div>
      {others.length === 0 && <div className="hint">No other players in the room yet.</div>}
      <div className="player-list">
        {others.map((p) => (
          <div key={p.id} className="settings-player">
            <img className="player-avatar" src={`/avatars/${p.avatar}.svg`} alt="" />
            <div className="settings-player-text">
              <span className="player-chip-name">{p.name}</span>
              <span className="player-chip-instrument">
                {getInstrument(p.instrumentId).label}
              </span>
            </div>
            <button
              className={`btn ghost small${p.mutedChat ? " active" : ""}`}
              title={p.mutedChat ? "Unmute chat" : "Mute chat"}
              onClick={() => setMute(p.id, !p.mutedChat, p.mutedNotes)}
            >
              {p.mutedChat ? "💬🚫" : "💬"}
            </button>
            <button
              className={`btn ghost small${p.mutedNotes ? " active" : ""}`}
              title={p.mutedNotes ? "Unmute playing" : "Mute playing"}
              onClick={() => setMute(p.id, p.mutedChat, !p.mutedNotes)}
            >
              {p.mutedNotes ? "🎹🚫" : "🎹"}
            </button>
            <button
              className="btn danger small"
              title="Kick from the room"
              onClick={() => getSocket().emit("room:kick", p.id)}
            >
              Kick
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
