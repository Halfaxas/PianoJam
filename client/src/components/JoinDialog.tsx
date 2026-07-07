import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AVATARS, randomAvatar, ROOM_LIMITS } from "@pianojam/shared";
import { getSocket } from "../lib/socket";
import { randomNickname } from "../lib/names";
import { useRoomStore } from "../state/roomStore";
import { getAdminToken, useProfileStore } from "../state/profileStore";
import { applyServerSongState } from "../song/engine";

interface Props {
  roomId: string;
}

/**
 * Shown before entering a room: pick a nickname and an avatar. A random
 * avatar is preselected on every join, so joining is a single click, and
 * "Surprise me" generates a nickname. If the nickname is already used in
 * the room, the server rejects and we prompt for another.
 */
export function JoinDialog({ roomId }: Props) {
  const profile = useProfileStore();
  const [searchParams] = useSearchParams();
  const [nickname, setNickname] = useState(profile.nickname);
  const [avatar, setAvatar] = useState(randomAvatar());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const join = (e: React.FormEvent) => {
    e.preventDefault();
    const name = nickname.trim();
    if (name.length < ROOM_LIMITS.nicknameMin) {
      setError(`Nickname must be at least ${ROOM_LIMITS.nicknameMin} characters.`);
      return;
    }
    setBusy(true);
    setError(null);
    profile.setNickname(name);
    profile.setAvatar(avatar);
    getSocket().emit(
      "room:join",
      {
        roomId,
        nickname: name,
        avatar,
        adminToken: getAdminToken(roomId),
        inviteToken: searchParams.get("invite") ?? undefined,
      },
      (res) => {
        if (res.ok) {
          useRoomStore
            .getState()
            .setJoined(res.data.room, res.data.players, res.data.self, res.data.inviteToken);
          applyServerSongState(res.data.song);
          return;
        }
        if (res.code === "NICKNAME_TAKEN" || res.code === "INVALID") {
          // Stay in the dialog and let them pick another name.
          setError(res.error);
          setBusy(false);
        } else {
          useRoomStore.getState().setError(res.error);
        }
      },
    );
  };

  return (
    <div className="join-backdrop">
      <form className="card join-dialog" onSubmit={join}>
        <h2>Joining room</h2>
        <p className="hint">Pick a nickname and an avatar for this session.</p>

        <div className="avatar-header">
          <span>Nickname</span>
          <button
            type="button"
            className="btn ghost"
            onClick={() => setNickname(randomNickname())}
          >
            Surprise me
          </button>
        </div>
        <label className="join-nickname">
          <input
            value={nickname}
            maxLength={ROOM_LIMITS.nicknameMax}
            placeholder="e.g. NimbleFingers"
            onChange={(e) => setNickname(e.target.value)}
            autoFocus
          />
        </label>
        {error && <div className="join-error">{error}</div>}

        <div className="avatar-header">
          <span>Avatar</span>
        </div>
        <div className="avatar-grid">
          {AVATARS.map((id) => (
            <button
              type="button"
              key={id}
              className={`avatar-option${avatar === id ? " selected" : ""}`}
              onClick={() => setAvatar(id)}
              title={id}
            >
              <img src={`/avatars/${id}.svg`} alt={id} />
            </button>
          ))}
        </div>

        <button className="btn primary full" disabled={busy || !nickname.trim()}>
          {busy ? "Joining..." : "Join room"}
        </button>
      </form>
    </div>
  );
}
