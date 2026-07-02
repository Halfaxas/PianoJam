import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Keyboard } from "../components/Keyboard";
import { NoteCanvas } from "../components/NoteCanvas";
import { NoteChordDisplay } from "../components/NoteChordDisplay";
import { PlayerStrip } from "../components/PlayerStrip";
import { JoinDialog } from "../components/JoinDialog";
import { TopBar, type PanelId } from "../components/TopBar";
import { Modal } from "../components/Modal";
import { MetronomePanel } from "../components/panels/MetronomePanel";
import { SoundPackPanel } from "../components/panels/SoundPackPanel";
import { ThemePanel } from "../components/panels/ThemePanel";
import { ChatPanel } from "../components/panels/ChatPanel";
import { SaveRecordingPanel } from "../components/panels/SaveRecordingPanel";
import { getSocket } from "../lib/socket";
import { useRoomStore } from "../state/roomStore";
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
  const background = useThemeStore((s) => s.background);
  const audioReady = useAudioStore((s) => s.audioReady);

  const [openPanel, setOpenPanel] = useState<PanelId>(null);
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
    <div className="room-page" style={{ background }} onPointerDown={unlockAudio}>
      <TopBar
        openPanel={openPanel}
        setOpenPanel={setOpenPanel}
        chatVisible={chatVisible}
        toggleChat={() => setChatVisible((v) => !v)}
        onRecordingReady={(blob) => setPendingRecording(blob)}
      />

      <main className="stage">
        <NoteCanvas />
        <PlayerStrip />
        <NoteChordDisplay />
        {!audioReady && status === "joined" && (
          <div className="audio-hint">🔊 Click, tap or play a key to enable sound</div>
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
      {pendingRecording && (
        <Modal title="Save recording" onClose={() => setPendingRecording(null)} width={360}>
          <SaveRecordingPanel blob={pendingRecording} onDone={() => setPendingRecording(null)} />
        </Modal>
      )}
    </div>
  );
}
