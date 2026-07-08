import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { RoomSummary, RoomVisibility, SoundMode } from "@pianojam/shared";
import { ROOM_LIMITS } from "@pianojam/shared";
import { getSocket } from "../lib/socket";
import { saveAdminToken } from "../state/profileStore";
import { toast } from "../state/toastStore";
import { Icon } from "../components/Icon";

function Logo() {
  return (
    <div className="logo">
      <span className="logo-keys">
        <i /><i /><i /><i />
      </span>
      Piano<b>Jam</b>
    </div>
  );
}

const VISIBILITY_OPTIONS: { id: RoomVisibility; label: string; hint: string }[] = [
  { id: "public", label: "Public", hint: "Listed in the room browser, anyone can join." },
  { id: "private", label: "Private", hint: "Listed, but joining needs your invite link." },
  { id: "hidden", label: "Hidden", hint: "Not listed anywhere; invite link only." },
];

function CreateRoomCard() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [soundMode, setSoundMode] = useState<SoundMode>("admin");
  const [visibility, setVisibility] = useState<RoomVisibility>("public");
  const [busy, setBusy] = useState(false);

  const create = () => {
    setBusy(true);
    getSocket().emit(
      "room:create",
      { name: name.trim(), maxPlayers, chatEnabled, soundMode, visibility },
      (res) => {
        setBusy(false);
        if (res.ok) {
          saveAdminToken(res.data.room.id, res.data.adminToken);
          // Carry the invite in the URL so joining and sharing work
          // right away for non-public rooms.
          navigate(
            res.data.room.visibility === "public"
              ? `/room/${res.data.room.id}`
              : `/room/${res.data.room.id}?invite=${res.data.inviteToken}`,
          );
        } else {
          toast.error(res.error);
        }
      },
    );
  };

  return (
    <section className="card">
      <h2>Create a room</h2>
      <div className="form">
        <label>
          <span>
            Room name <span className="hint-inline">(optional)</span>
          </span>
          <input
            value={name}
            maxLength={ROOM_LIMITS.nameMax}
            placeholder="e.g. Late night jam"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Max players: {maxPlayers}
          <input
            type="range"
            min={ROOM_LIMITS.minPlayers}
            max={ROOM_LIMITS.maxPlayers}
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
          />
        </label>

        <div className="mode-picker">
          <span className="mode-picker-label">Sound packs</span>
          <label className={`mode-option${soundMode === "admin" ? " selected" : ""}`}>
            <input
              type="radio"
              name="soundMode"
              checked={soundMode === "admin"}
              onChange={() => setSoundMode("admin")}
            />
            <span>
              <b>Solo instrument</b>
              <small>You pick one sound pack and everyone plays with it.</small>
            </span>
          </label>
          <label className={`mode-option${soundMode === "orchestra" ? " selected" : ""}`}>
            <input
              type="radio"
              name="soundMode"
              checked={soundMode === "orchestra"}
              onChange={() => setSoundMode("orchestra")}
            />
            <span>
              <b>Orchestra</b>
              <small>Everyone picks their own instrument and plays it together.</small>
            </span>
          </label>
        </div>

        <div className="mode-picker">
          <span className="mode-picker-label">Visibility</span>
          <div className="segmented">
            {VISIBILITY_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.id}
                className={`segment${visibility === option.id ? " selected" : ""}`}
                aria-pressed={visibility === option.id}
                onClick={() => setVisibility(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="hint">
            {VISIBILITY_OPTIONS.find((option) => option.id === visibility)!.hint}
          </div>
        </div>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={chatEnabled}
            onChange={(e) => setChatEnabled(e.target.checked)}
          />
          Enable chat
        </label>
        <button className="btn primary full" onClick={create} disabled={busy}>
          {busy ? "Creating…" : "Create room"}
          {busy && <span className="spinner" />}
        </button>
      </div>
    </section>
  );
}

function JoinRoomCard() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null);
  const [joinId, setJoinId] = useState("");

  const refresh = useCallback(() => {
    getSocket().emit("room:list", (list) => setRooms(list));
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <section className="card">
      <div className="row-between">
        <h2>Join a room</h2>
        <button className="icon-btn" onClick={refresh} title="Refresh list" aria-label="Refresh list">
          <Icon name="refresh" size={14} />
        </button>
      </div>
      <div className="room-list">
        {rooms === null && <div className="hint">Loading rooms…</div>}
        {rooms?.length === 0 && (
          <div className="hint">No rooms are live right now. Create the first one.</div>
        )}
        {rooms?.map((room) => {
          const full = room.playerCount >= room.maxPlayers;
          const inviteOnly = room.visibility !== "public";
          return (
            <div key={room.id} className="room-row">
              <div className="room-row-info">
                <span className="room-name">
                  {inviteOnly && (
                    <span className="lock" title="Joining needs an invite link">
                      <Icon name="lock" size={12} />
                    </span>
                  )}{" "}
                  {room.name}
                </span>
                <span className="room-meta">
                  #{room.id} · {room.playerCount}/{room.maxPlayers} players ·{" "}
                  {room.soundMode === "orchestra" ? "orchestra" : "solo instrument"}
                  {room.chatEnabled ? " · chat" : ""}
                  {inviteOnly ? " · invite only" : ""}
                </span>
              </div>
              <button
                className="btn ghost"
                disabled={full || inviteOnly}
                title={inviteOnly ? "Ask someone in the room for an invite link" : undefined}
                onClick={() => navigate(`/room/${room.id}`)}
              >
                {full ? "Full" : inviteOnly ? "Invite only" : "Join"}
              </button>
            </div>
          );
        })}
      </div>
      <div className="join-by-id">
        <input
          value={joinId}
          placeholder="…or enter a room ID"
          aria-label="Room ID"
          onChange={(e) => setJoinId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && joinId.trim() && navigate(`/room/${joinId.trim()}`)}
        />
        <button
          className="btn ghost"
          disabled={!joinId.trim()}
          onClick={() => navigate(`/room/${joinId.trim()}`)}
        >
          Go
        </button>
      </div>
    </section>
  );
}

export function HomePage() {
  return (
    <div className="home-page">
      <nav className="navbar">
        <Logo />
      </nav>

      <header className="hero">
        <h1>
          Play piano <em>together</em>.
        </h1>
        <p>
          Real-time collaborative rooms, 21 instrument sound packs, MIDI keyboard support,
          falling-note visuals, a metronome and one-click audio recording, right in your
          browser. No account needed.
        </p>
      </header>

      <div className="home-cards">
        <CreateRoomCard />
        <JoinRoomCard />
      </div>

      <footer className="home-footer">
        MIDI input works in Chrome, Edge, Opera and Safari. Pick a nickname and avatar when
        you join a room.
      </footer>
    </div>
  );
}
