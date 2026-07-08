import { useMemo, useState } from "react";
import { useRoomStore } from "../state/roomStore";
import { useActiveNotes } from "../state/activeNotes";
import { useLocalMuteStore, type LocalMute } from "../state/localMuteStore";
import { useReactionStore } from "../state/reactionStore";
import { useSongStore } from "../state/songStore";
import { getInstrument } from "../audio/instruments";
import { Icon, type IconName } from "./Icon";

/**
 * Always-visible roster on the stage: who is in the room (avatar +
 * nickname), which instrument they play right now, who is the admin, and a
 * pulse while they are playing. Every other player's entry has a menu with
 * local-only mutes (sound / notes / chat) that never affect anyone else.
 */

const MUTE_OPTIONS: { kind: keyof LocalMute; icon: IconName; label: string; title: string }[] = [
  { kind: "audio", icon: "volume", label: "Sound", title: "Play their notes out loud" },
  { kind: "notes", icon: "music", label: "Notes", title: "Show their falling notes" },
  { kind: "chat", icon: "chat", label: "Chat", title: "Show their chat messages" },
];

function MuteMenu({ name }: { name: string }) {
  const mute = useLocalMuteStore((s) => s.mutes.get(name));
  const toggle = useLocalMuteStore((s) => s.toggle);

  return (
    <div className="mute-menu">
      {MUTE_OPTIONS.map(({ kind, icon, label, title }) => {
        const active = mute?.[kind] ?? false;
        return (
          <button
            key={kind}
            className={`btn ghost small${active ? " active" : ""}`}
            aria-pressed={active}
            title={active ? `Muted for you. Click to ${title.toLowerCase()} again` : title}
            onClick={() => toggle(name, kind)}
          >
            <Icon name={icon} size={13} /> {label}
          </button>
        );
      })}
      <span className="mute-menu-hint">Only affects what you hear and see.</span>
    </div>
  );
}

export function PlayerStrip() {
  const players = useRoomStore((s) => s.players);
  const self = useRoomStore((s) => s.self);
  const holders = useActiveNotes((s) => s.holders);
  const mutes = useLocalMuteStore((s) => s.mutes);
  const setAll = useLocalMuteStore((s) => s.setAll);
  const reactions = useReactionStore((s) => s.reactions);
  // Live Keep Up leaderboard: everyone sees everyone's accuracy and streak.
  const songScores = useSongStore((s) => s.scores);
  const keepUpLive = useSongStore(
    (s) => s.playback?.mode === "keepup" && s.playback.state !== "stopped",
  );
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const playingOwners = useMemo(() => {
    const owners = new Set<string>();
    for (const set of holders.values()) {
      for (const owner of set) owners.add(owner);
    }
    return owners;
  }, [holders]);

  const others = players.filter((p) => p.id !== self?.id);
  const allOthersQuiet =
    others.length > 0 &&
    others.every((p) => {
      const m = mutes.get(p.name);
      return m?.audio && m?.notes;
    });

  return (
    <div className="player-strip">
      {players.map((p) => {
        const isSelf = self?.id === p.id;
        const playing = playingOwners.has(isSelf ? "local" : p.name);
        const mute = mutes.get(p.name);
        const mutedAny = !isSelf && (mute?.audio || mute?.notes || mute?.chat);
        const myReactions = reactions.filter((r) => r.from === p.name);
        const score = keepUpLive ? songScores[p.name] : undefined;
        return (
          <div key={p.id} className="player-chip-wrap">
            {myReactions.map((r) => (
              <span key={r.id} className="floating-reaction" style={{ left: `${r.x}%` }}>
                {r.reaction}
              </span>
            ))}
            <div className={`player-chip${playing ? " playing" : ""}`}>
              <img className="player-avatar" src={`/avatars/${p.avatar}.svg`} alt="" />
              <div className="player-chip-text">
                <span className="player-chip-name">
                  {p.isAdmin && (
                    <span className="crown" role="img" aria-label="Room admin" title="Room admin">
                      <Icon name="crown" size={13} />
                    </span>
                  )}
                  {p.name}
                  {isSelf && <span className="tag">you</span>}
                  {mutedAny && (
                    <span
                      className="local-mute-mark"
                      role="img"
                      aria-label="Muted for you only"
                      title="Muted for you only"
                    >
                      <Icon name="volume-off" size={12} />
                    </span>
                  )}
                </span>
                <span className="player-chip-instrument">
                  {getInstrument(p.instrumentId).label}
                </span>
              </div>
              {score && (
                <span
                  className="score-chip"
                  title={`Keep up: ${score.hit} hit, ${score.miss} missed, best streak ${score.bestStreak}`}
                >
                  {score.accuracy}%
                  {score.streak >= 3 && (
                    <>
                      <Icon name="flame" size={11} /> {score.streak}
                    </>
                  )}
                </span>
              )}
              {!isSelf && (
                <button
                  className="icon-btn chip-menu-btn"
                  aria-label={`Mute options for ${p.name}`}
                  aria-expanded={menuFor === p.name}
                  title="Mute for me only"
                  onClick={() => setMenuFor(menuFor === p.name ? null : p.name)}
                >
                  <Icon name="more" size={14} />
                </button>
              )}
            </div>
            {menuFor === p.name && !isSelf && <MuteMenu name={p.name} />}
          </div>
        );
      })}
      {others.length > 0 && (
        <button
          className="btn ghost small strip-mute-all"
          title={
            allOthersQuiet
              ? "Hear and see everyone again"
              : "Silence and hide everyone else's notes (chat stays on)"
          }
          onClick={() =>
            setAll(
              others.map((p) => p.name),
              allOthersQuiet ? { audio: false, notes: false } : { audio: true, notes: true },
            )
          }
        >
          <Icon name={allOthersQuiet ? "volume" : "volume-off"} size={13} />{" "}
          {allOthersQuiet ? "Unmute others" : "Mute others"}
        </button>
      )}
    </div>
  );
}
