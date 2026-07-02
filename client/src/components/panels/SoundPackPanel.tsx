import { INSTRUMENTS } from "../../audio/instruments";
import { ensureAudioStarted, loadMyInstrument } from "../../audio/engine";
import { useAudioStore } from "../../state/audioStore";
import { useIsAdmin, useRoomStore } from "../../state/roomStore";
import { getSocket } from "../../lib/socket";

export function SoundPackPanel() {
  const instrumentId = useAudioStore((s) => s.instrumentId);
  const loading = useAudioStore((s) => s.instrumentLoading);
  const soundMode = useRoomStore((s) => s.room?.soundMode ?? "orchestra");
  const isAdmin = useIsAdmin();
  const locked = soundMode === "admin" && !isAdmin;

  const pick = async (id: string) => {
    if (locked) return;
    await ensureAudioStarted();
    void loadMyInstrument(id);
    getSocket().emit("instrument:set", id);
  };

  return (
    <div className="soundpack-panel">
      <div className="hint">
        {soundMode === "admin"
          ? locked
            ? "Only the room admin can change the sound pack. It applies to everyone."
            : "You are the admin: the sound pack you pick applies to everyone in the room."
          : "Orchestra room: everyone picks their own instrument."}
      </div>
      <div className="soundpack-list">
        {INSTRUMENTS.map((inst) => (
          <button
            key={inst.id}
            disabled={locked}
            className={`list-item${inst.id === instrumentId ? " selected" : ""}`}
            onClick={() => void pick(inst.id)}
          >
            {inst.label}
            {loading && inst.id === instrumentId && (
              <span className="spinner list-item-spinner" title="Loading samples" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
