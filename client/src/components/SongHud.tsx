import { useRoomStore } from "../state/roomStore";
import { useSongStore } from "../state/songStore";

/**
 * Floating live score card at the top of the stage. Shows the solo practice
 * tally while Wait mode runs, and the player's own Keep Up score during a
 * shared graded session. Hidden otherwise.
 */
export function SongHud() {
  const solo = useSongStore((s) => s.solo);
  const playback = useSongStore((s) => s.playback);
  const selfName = useRoomStore((s) => s.self?.name);
  const score = useSongStore((s) => (selfName ? s.scores[selfName] : undefined));

  if (solo.active) {
    return (
      <div className="song-hud" role="status">
        <span className="song-hud-title">🎯 Practice</span>
        <span className="song-hud-acc">{solo.accuracy}%</span>
        <div className="song-hud-stats">
          <span className="song-hud-good">✔ {solo.correct}</span>
          <span className="song-hud-bad">✘ {solo.wrong}</span>
        </div>
      </div>
    );
  }

  const keepUpLive =
    playback !== null && playback.state !== "stopped" && playback.mode === "keepup";
  if (!keepUpLive || !score) return null;
  return (
    <div className="song-hud" role="status">
      <span className="song-hud-title">🏁 Keep up</span>
      <span className="song-hud-acc">{score.accuracy}%</span>
      <div className="song-hud-stats">
        <span className="song-hud-good">✔ {score.hit}</span>
        <span className="song-hud-mid">◐ {score.early + score.late}</span>
        <span className="song-hud-bad">✘ {score.miss}</span>
        {score.streak > 1 && <span className="song-hud-streak">🔥 {score.streak}</span>}
      </div>
    </div>
  );
}
