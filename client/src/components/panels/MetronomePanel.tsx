import {
  METRONOME_MAX_BPM,
  METRONOME_MIN_BPM,
  startMetronome,
  stopMetronome,
  useMetronomeStore,
} from "../../audio/metronome";
import { useIsAdmin } from "../../state/roomStore";
import { getSocket } from "../../lib/socket";
import { toast } from "../../state/toastStore";
import { Icon } from "../Icon";

export function MetronomePanel() {
  const { bpm, running, beat, setBpm } = useMetronomeStore();
  const isAdmin = useIsAdmin();

  const startForEveryone = () => {
    getSocket().emit("metronome:start", { bpm });
    void startMetronome();
    toast.success(`Metronome started for the whole room at ${bpm} BPM.`);
  };

  return (
    <div className="metronome">
      <div className="metronome-beats">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`beat-dot${running && beat === i ? " on" : ""}${i === 0 ? " accent" : ""}`}
          />
        ))}
      </div>
      <div className="metronome-bpm">
        <span className="bpm-value">{bpm}</span>
        <span className="bpm-label">BPM</span>
      </div>
      <input
        type="range"
        min={METRONOME_MIN_BPM}
        max={METRONOME_MAX_BPM}
        value={bpm}
        onChange={(e) => setBpm(Number(e.target.value))}
        aria-label="Tempo"
      />
      <div className="row-between">
        <button className="btn ghost" aria-label="Slow down by 1 BPM" onClick={() => setBpm(bpm - 1)}>−1</button>
        <button
          className={`btn ${running ? "danger" : "primary"}`}
          onClick={() => (running ? stopMetronome() : void startMetronome())}
        >
          {running ? "Stop" : "Start"}
        </button>
        <button className="btn ghost" aria-label="Speed up by 1 BPM" onClick={() => setBpm(bpm + 1)}>+1</button>
      </div>
      {isAdmin && (
        <button className="btn ghost full" onClick={startForEveryone}>
          <Icon name="crown" size={14} /> Start for everyone
        </button>
      )}
      {isAdmin && (
        <div className="hint center-text">
          Starts the metronome on every player's device to coordinate the room. Anyone can
          stop their own.
        </div>
      )}
    </div>
  );
}
