import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Keyboard } from "../components/Keyboard";
import { NoteCanvas } from "../components/NoteCanvas";
import { NoteChordDisplay } from "../components/NoteChordDisplay";
import { PlayerStrip } from "../components/PlayerStrip";
import { ReactionBar } from "../components/ReactionBar";
import { SongHud } from "../components/SongHud";
import { JoinDialog } from "../components/JoinDialog";
import { TopBar } from "../components/TopBar";
import { Modal } from "../components/Modal";
import { Icon } from "../components/Icon";
import { MetronomePanel } from "../components/panels/MetronomePanel";
import { SoundPackPanel } from "../components/panels/SoundPackPanel";
import { ThemePanel } from "../components/panels/ThemePanel";
import { RoomSettingsPanel } from "../components/panels/RoomSettingsPanel";
import { ChatPanel } from "../components/panels/ChatPanel";
import { SaveRecordingPanel } from "../components/panels/SaveRecordingPanel";
import { SongPanel } from "../components/panels/SongPanel";
import { SongSummaryPanel } from "../components/panels/SongSummaryPanel";
import { getSocket } from "../lib/socket";
import { useIsAdmin, useRoomStore } from "../state/roomStore";
import { useUiStore } from "../state/uiStore";
import { useLocalMuteStore } from "../state/localMuteStore";
import { useReactionStore } from "../state/reactionStore";
import { useSongStore } from "../state/songStore";
import { resetSongEngine } from "../song/engine";
import { useThemeStore } from "../state/themeStore";
import { useAudioStore } from "../state/audioStore";
import { attachQwerty } from "../audio/qwerty";
import { initMidi } from "../audio/midi";
import { ensureAudioStarted, loadMyInstrument } from "../audio/engine";
import { releaseAllLocal } from "../audio/player";
import { clearTrails } from "../audio/trails";
import { stopMetronome } from "../audio/metronome";

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const status = useRoomStore((s) => s.status);
  const error = useRoomStore((s) => s.error);
  const roomName = useRoomStore((s) => s.room?.name);
  const background = useThemeStore((s) => s.background);
  const audioReady = useAudioStore((s) => s.audioReady);

  const isAdmin = useIsAdmin();
  const openPanel = useUiStore((s) => s.openPanel);
  const setOpenPanel = useUiStore((s) => s.setOpenPanel);
  const summaryOpen = useSongStore((s) => s.summaryOpen);
  const setSummaryOpen = useSongStore((s) => s.setSummaryOpen);
  const [chatVisible, setChatVisible] = useState(false);
  const [pendingRecording, setPendingRecording] = useState<Blob | null>(null);

  // Leave and silence everything on the way out. Joining happens through
  // the JoinDialog (nickname + avatar), not automatically.
  useEffect(() => {
    return () => {
      getSocket().emit("room:leave");
      releaseAllLocal();
      clearTrails();
      stopMetronome();
      useRoomStore.getState().leave();
      useLocalMuteStore.getState().reset();
      useReactionStore.getState().clear();
      resetSongEngine();
      useUiStore.getState().setOpenPanel(null);
    };
  }, [roomId]);

  // Input sources + sample preloading (starts downloading before the
  // AudioContext is even unlocked).
  useEffect(() => {
    const detach = attachQwerty();
    void initMidi();
    void loadMyInstrument(useAudioStore.getState().instrumentId);
    return detach;
  }, []);

  // Keep the invite token in the address bar for non-public rooms, so a
  // refresh (or copying the URL) keeps working even after the admin
  // regenerates the invite link.
  const [searchParams, setSearchParams] = useSearchParams();
  const inviteToken = useRoomStore((s) => s.inviteToken);
  const visibility = useRoomStore((s) => s.room?.visibility);
  useEffect(() => {
    if (status !== "joined" || !inviteToken || visibility === "public") return;
    if (searchParams.get("invite") !== inviteToken) {
      const next = new URLSearchParams(searchParams);
      next.set("invite", inviteToken);
      setSearchParams(next, { replace: true });
    }
  }, [status, inviteToken, visibility, searchParams, setSearchParams]);

  // In admin-sound rooms, adopt the room's instrument on join.
  const roomInstrument = useRoomStore((s) =>
    s.room?.soundMode === "admin" ? s.room.instrumentId : null,
  );
  useEffect(() => {
    if (status === "joined" && roomInstrument) {
      void loadMyInstrument(roomInstrument);
    }
  }, [status, roomInstrument]);

  const unlockAudio = useCallback(() => {
    void ensureAudioStarted().catch(() => {});
  }, []);

  if (!roomId) return null;

  if (status === "error") {
    return (
      <div className="page-center" style={{ background }}>
        <div className="card">
          <h2>Can't join this room</h2>
          <p className="hint">{error}</p>
          <Link className="btn primary" to="/">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="room-page"
      style={{ background, "--scroll-thumb": background } as React.CSSProperties}
      onPointerDown={unlockAudio}
    >
      <h1 className="sr-only">{roomName ?? "PianoJam room"}</h1>
      <TopBar
        chatVisible={chatVisible}
        toggleChat={() => setChatVisible((v) => !v)}
        onRecordingReady={(blob) => setPendingRecording(blob)}
      />

      <main className={`stage${chatVisible ? " chat-open" : ""}`}>
        <NoteCanvas />
        <PlayerStrip />
        <NoteChordDisplay />
        <SongHud />
        {status === "joined" && <ReactionBar />}
        {!audioReady && status === "joined" && (
          <div className="audio-hint">
            <Icon name="volume" /> Click, tap or play a key to enable sound
          </div>
        )}
        {chatVisible && (
          <aside className="chat-drawer">
            <ChatPanel />
          </aside>
        )}
      </main>

      <Keyboard />

      {status !== "joined" && <JoinDialog roomId={roomId} />}

      {openPanel === "sound" && (
        <Modal title="Sound packs" onClose={() => setOpenPanel(null)}>
          <SoundPackPanel />
        </Modal>
      )}
      {openPanel === "metronome" && (
        <Modal title="Metronome" onClose={() => setOpenPanel(null)} width={340}>
          <MetronomePanel />
        </Modal>
      )}
      {openPanel === "theme" && (
        <Modal title="Customize colors" onClose={() => setOpenPanel(null)} width={340}>
          <ThemePanel />
        </Modal>
      )}
      {openPanel === "settings" && isAdmin && (
        <Modal title="Room settings" onClose={() => setOpenPanel(null)}>
          <RoomSettingsPanel />
        </Modal>
      )}
      {openPanel === "song" && (
        <Modal title="Song mode" onClose={() => setOpenPanel(null)}>
          <SongPanel />
        </Modal>
      )}
      {summaryOpen && (
        <Modal title="Keep up results" onClose={() => setSummaryOpen(false)} width={380}>
          <SongSummaryPanel />
        </Modal>
      )}
      {pendingRecording && (
        <Modal title="Save recording" onClose={() => setPendingRecording(null)} width={360}>
          <SaveRecordingPanel blob={pendingRecording} onDone={() => setPendingRecording(null)} />
        </Modal>
      )}
    </div>
  );
}
