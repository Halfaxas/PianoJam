import { create } from "zustand";
import { persist } from "zustand/middleware";
import { randomAvatar } from "@pianojam/shared";

/**
 * The local player's identity: a nickname and an avatar, chosen when
 * joining a room and remembered for next time.
 */
interface ProfileState {
  nickname: string;
  avatar: string;
  setNickname: (nickname: string) => void;
  setAvatar: (avatar: string) => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      nickname: "",
      avatar: randomAvatar(),
      setNickname: (nickname) => set({ nickname }),
      setAvatar: (avatar) => set({ avatar }),
    }),
    { name: "pianojam-profile" },
  ),
);

const ADMIN_TOKEN_PREFIX = "pianojam-admin-";

/** Admin tokens survive a refresh but not a closed tab. */
export function saveAdminToken(roomId: string, token: string): void {
  sessionStorage.setItem(ADMIN_TOKEN_PREFIX + roomId, token);
}

export function getAdminToken(roomId: string): string | undefined {
  return sessionStorage.getItem(ADMIN_TOKEN_PREFIX + roomId) ?? undefined;
}
