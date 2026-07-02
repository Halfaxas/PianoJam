import { useMemo } from "react";
import { useRoomStore } from "../state/roomStore";
import { useActiveNotes } from "../state/activeNotes";
import { getInstrument } from "../audio/instruments";

/**
 * Always-visible roster on the stage: who is in the room (avatar +
 * nickname), which instrument they play right now, who is the admin, and a
 * pulse while they are playing.
 */
export function PlayerStrip() {
  const players = useRoomStore((s) => s.players);
  const self = useRoomStore((s) => s.self);
  const holders = useActiveNotes((s) => s.holders);

  const playingOwners = useMemo(() => {
    const owners = new Set<string>();
    for (const set of holders.values()) {
      for (const owner of set) owners.add(owner);
    }
    return owners;
  }, [holders]);

  return (
    <div className="player-strip">
      {players.map((p) => {
        const isSelf = self?.id === p.id;
        const playing = playingOwners.has(isSelf ? "local" : p.name);
        return (
          <div key={p.id} className={`player-chip${playing ? " playing" : ""}`}>
            <img className="player-avatar" src={`/avatars/${p.avatar}.svg`} alt="" />
            <div className="player-chip-text">
              <span className="player-chip-name">
                {p.isAdmin && (
                  <span className="crown" title="Room admin">
                    👑
                  </span>
                )}
                {p.name}
                {isSelf && <span className="tag">you</span>}
              </span>
              <span className="player-chip-instrument">
                {getInstrument(p.instrumentId).label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
