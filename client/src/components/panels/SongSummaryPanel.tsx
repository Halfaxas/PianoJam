import { useSongStore } from "../../state/songStore";
import { useRoomStore } from "../../state/roomStore";

/**
 * End-of-song Keep Up results: everyone's final accuracy, ranked. Reads the
 * live score map so stragglers' last reports still land while it is open.
 */
export function SongSummaryPanel() {
  const scores = useSongStore((s) => s.scores);
  const song = useSongStore((s) => s.song);
  const players = useRoomStore((s) => s.players);
  const selfName = useRoomStore((s) => s.self?.name);

  const rows = Object.entries(scores).sort(
    (a, b) => b[1].accuracy - a[1].accuracy || b[1].bestStreak - a[1].bestStreak,
  );

  return (
    <div className="song-summary">
      {song && <div className="hint center-text">{song.title}</div>}
      {rows.length === 0 && <div className="hint">No scores were recorded.</div>}
      {rows.map(([name, score], i) => {
        const avatar = players.find((p) => p.name === name)?.avatar;
        return (
          <div key={name} className={`summary-row${name === selfName ? " mine" : ""}`}>
            <span className={`summary-rank${i < 3 ? ` rank-${i + 1}` : ""}`}>{i + 1}</span>
            {avatar && <img className="player-avatar" src={`/avatars/${avatar}.svg`} alt="" />}
            <span className="summary-name">{name}</span>
            <span className="summary-detail">
              {score.hit} hit · {score.early + score.late} near · {score.miss} miss · best ×
              {score.bestStreak}
            </span>
            <b className="summary-accuracy">{score.accuracy}%</b>
          </div>
        );
      })}
    </div>
  );
}
