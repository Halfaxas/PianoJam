import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAudioStore } from "../state/audioStore";
import { useIsAdmin, useRoomStore } from "../state/roomStore";
import { useUiStore, type PanelId } from "../state/uiStore";
import { startRecording, stopRecording } from "../audio/recorder";
import { getInstrument } from "../audio/instruments";
import { toast } from "../state/toastStore";

interface Props {
  chatVisible: boolean;
  toggleChat: () => void;
  onRecordingReady: (blob: Blob) => void;
}

function RecordingClock({ startedAt }: { startedAt: number }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = Math.floor((Date.now() - startedAt) / 1000);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return (
    <span className="rec-clock">
      {mm}:{ss}
    </span>
  );
}

export function TopBar({ chatVisible, toggleChat, onRecordingReady }: Props) {
  const navigate = useNavigate();
  const room = useRoomStore((s) => s.room);
  const playerCount = useRoomStore((s) => s.players.length);
  const unread = useRoomStore((s) => s.unread);
  const isAdmin = useIsAdmin();
  const openPanel = useUiStore((s) => s.openPanel);
  const setOpenPanel = useUiStore((s) => s.setOpenPanel);
  const instrumentId = useAudioStore((s) => s.instrumentId);
  const instrumentLoading = useAudioStore((s) => s.instrumentLoading);
  const midiDevices = useAudioStore((s) => s.midiDevices);
  const qwertyOctave = useAudioStore((s) => s.qwertyOctave);
  const pedalDown = useAudioStore((s) => s.pedalDown);
  const recording = useAudioStore((s) => s.recording);
  const recordingStartedAt = useAudioStore((s) => s.recordingStartedAt);

  const roomFull = room !== null && playerCount >= room.maxPlayers;

  const toggle = (panel: Exclude<PanelId, null>) =>
    setOpenPanel(openPanel === panel ? null : panel);

  const onRecordClick = async () => {
    try {
      if (!recording) {
        await startRecording();
        toast.info("Recording started.");
      } else {
        onRecordingReady(await stopRecording());
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Recording failed.");
    }
  };

  const shareRoom = async () => {
    if (!room) return;
    // Non-public rooms are invite-link-only, so the link must carry the token.
    const { inviteToken } = useRoomStore.getState();
    const invite =
      room.visibility !== "public" && inviteToken ? `?invite=${inviteToken}` : "";
    const url = `${window.location.origin}/room/${room.id}${invite}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Room link copied. Send it to a friend!");
    } catch {
      toast.error(`Couldn't copy automatically. The link is: ${url}`);
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="btn ghost" onClick={() => navigate("/")}>
          ← Leave
        </button>
        <div className="room-title">
          <span className="room-name">{room?.name ?? "..."}</span>
          {room && (
            <span className="room-id">
              #{room.id} · {room.soundMode === "orchestra" ? "orchestra" : "solo instrument"}
            </span>
          )}
        </div>
      </div>

      <div className="topbar-center">
        <button className="btn ghost" onClick={() => toggle("sound")}>
          🎹 {getInstrument(instrumentId).label}
          {instrumentLoading && <span className="spinner" />}
        </button>
        <button className="btn ghost" onClick={() => toggle("metronome")}>
          Metronome
        </button>
        <button className="btn ghost" onClick={() => toggle("song")}>
          🎵 Song
        </button>
        <button className="btn ghost" onClick={() => toggle("theme")}>
          Colors
        </button>
        {isAdmin && (
          <button className="btn ghost" onClick={() => toggle("settings")}>
            ⚙ Settings
          </button>
        )}
        <button
          className={`btn ${recording ? "danger" : "ghost"}`}
          onClick={onRecordClick}
          title={recording ? "Stop and save recording" : "Record audio"}
        >
          <span className={`rec-dot${recording ? " live" : ""}`} />
          {recording && recordingStartedAt ? <RecordingClock startedAt={recordingStartedAt} /> : "Record"}
        </button>
      </div>

      <div className="topbar-right">
        <span
          className="tooltip-wrap"
          data-tip={
            roomFull
              ? "The room is full, no one else can join right now"
              : "Copy an invite link to this room"
          }
        >
          <button className="btn ghost" onClick={shareRoom} disabled={roomFull}>
            🔗 Share
          </button>
        </span>
        <span
          className="status-chip"
          title={`Letter keys play octave ${qwertyOctave} (C${qwertyOctave}-B${qwertyOctave}). Press 0-8 to switch, Shift for sharps.`}
        >
          OCT {qwertyOctave}
        </span>
        <span
          className={`status-chip${midiDevices.length > 0 ? " ok" : ""}`}
          title={
            midiDevices.length > 0
              ? `MIDI connected: ${midiDevices.join(", ")}`
              : "No MIDI device detected (Chrome, Edge, Opera and Safari only)"
          }
        >
          MIDI
        </span>
        {pedalDown && <span className="status-chip ok">Pedal</span>}
        {room?.chatEnabled && (
          <button className={`btn ${chatVisible ? "primary" : "ghost"}`} onClick={toggleChat}>
            Chat{unread > 0 && <span className="badge">{unread}</span>}
          </button>
        )}
      </div>
    </header>
  );
}
