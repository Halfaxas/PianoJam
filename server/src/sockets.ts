import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  Player,
  ServerToClientEvents,
} from "@pianojam/shared";
import { isValidAvatar, isValidMidi, randomAvatar, ROOM_LIMITS } from "@pianojam/shared";
import { RoomManager } from "./rooms";

interface SocketData {
  roomId: string | null;
  player: Player | null;
}

type IoServer = Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

const rooms = new RoomManager();

const KNOWN_INSTRUMENTS = new Set([
  "piano", "salamander", "harp", "organ", "harmonium", "violin", "cello",
  "contrabass", "guitar-acoustic", "guitar-electric", "guitar-nylon",
  "bass-electric", "flute", "clarinet", "saxophone", "bassoon", "trumpet",
  "trombone", "french-horn", "tuba", "xylophone",
]);

function sanitizeNickname(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const nickname = raw.trim().replace(/\s+/g, " ");
  if (
    nickname.length < ROOM_LIMITS.nicknameMin ||
    nickname.length > ROOM_LIMITS.nicknameMax
  ) {
    return null;
  }
  return nickname;
}

export function setupSockets(io: IoServer): void {
  io.on("connection", (socket: IoSocket) => {
    socket.data.roomId = null;
    socket.data.player = null;

    const broadcastPlayers = (roomId: string) => {
      const room = rooms.get(roomId);
      if (room) io.to(roomId).emit("room:players", [...room.players.values()]);
    };

    const leaveCurrentRoom = () => {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      socket.leave(roomId);
      socket.data.roomId = null;
      socket.data.player = null;
      const room = rooms.leave(roomId, socket.id);
      if (room) broadcastPlayers(roomId);
    };

    socket.on("room:create", (input, ack) => {
      if (typeof ack !== "function") return;
      const result = rooms.create({
        name: String(input?.name ?? ""),
        maxPlayers: Number(input?.maxPlayers),
        chatEnabled: Boolean(input?.chatEnabled),
        soundMode: input?.soundMode === "orchestra" ? "orchestra" : "admin",
      });
      if (typeof result === "string") return ack({ ok: false, error: result });
      ack({
        ok: true,
        data: { room: rooms.summarize(result), adminToken: result.adminToken },
      });
    });

    socket.on("room:list", (ack) => {
      if (typeof ack === "function") ack(rooms.list());
    });

    socket.on("room:join", (input, ack) => {
      if (typeof ack !== "function") return;
      const nickname = sanitizeNickname(input?.nickname);
      if (!nickname) {
        return ack({
          ok: false,
          error: `Nickname must be ${ROOM_LIMITS.nicknameMin}-${ROOM_LIMITS.nicknameMax} characters.`,
          code: "INVALID",
        });
      }
      const avatar = isValidAvatar(input?.avatar) ? input.avatar : randomAvatar();

      leaveCurrentRoom();
      const result = rooms.join(
        String(input?.roomId ?? ""),
        socket.id,
        { nickname, avatar },
        typeof input?.adminToken === "string" ? input.adminToken : undefined,
      );
      if (!result.ok) {
        return ack({ ok: false, error: result.error, code: result.code });
      }

      const { room } = result;
      const player = "player" in result ? result.player : null;
      if (!player) return ack({ ok: false, error: "Join failed.", code: "INVALID" });

      socket.join(room.id);
      socket.data.roomId = room.id;
      socket.data.player = player;
      ack({
        ok: true,
        data: {
          room: rooms.summarize(room),
          players: [...room.players.values()],
          self: player,
        },
      });
      broadcastPlayers(room.id);
    });

    socket.on("room:leave", leaveCurrentRoom);

    socket.on("instrument:set", (instrumentId) => {
      const roomId = socket.data.roomId;
      if (!roomId || typeof instrumentId !== "string" || !KNOWN_INSTRUMENTS.has(instrumentId)) {
        return;
      }
      const change = rooms.setInstrument(roomId, socket.id, instrumentId);
      if (!change) return;
      if (change.scope === "room") {
        io.to(roomId).emit("room:instrument", { instrumentId });
      }
      broadcastPlayers(roomId);
    });

    socket.on("metronome:start", ({ bpm } = {} as never) => {
      const roomId = socket.data.roomId;
      const player = socket.data.player;
      if (!roomId || !player?.isAdmin) return;
      const clamped = Math.min(208, Math.max(40, Math.round(Number(bpm) || 120)));
      socket.to(roomId).emit("metronome:start", { bpm: clamped, from: player.name });
    });

    socket.on("note:on", ({ midi, velocity } = {} as never) => {
      const roomId = socket.data.roomId;
      const player = socket.data.player;
      if (!roomId || !player || !isValidMidi(midi)) return;
      const v = Math.min(1, Math.max(0, Number(velocity) || 0));
      socket.to(roomId).emit("peer:note:on", { midi, velocity: v, from: player.name });
    });

    socket.on("note:off", ({ midi } = {} as never) => {
      const roomId = socket.data.roomId;
      const player = socket.data.player;
      if (!roomId || !player || !isValidMidi(midi)) return;
      socket.to(roomId).emit("peer:note:off", { midi, from: player.name });
    });

    socket.on("pedal", ({ down } = {} as never) => {
      const roomId = socket.data.roomId;
      const player = socket.data.player;
      if (!roomId || !player) return;
      socket.to(roomId).emit("peer:pedal", { down: Boolean(down), from: player.name });
    });

    socket.on("chat:send", (text) => {
      const roomId = socket.data.roomId;
      const player = socket.data.player;
      if (!roomId || !player || typeof text !== "string") return;
      const room = rooms.get(roomId);
      if (!room?.settings.chatEnabled) return;
      const trimmed = text.trim().slice(0, ROOM_LIMITS.chatMessageMax);
      if (!trimmed) return;
      io.to(roomId).emit("chat:message", {
        from: player.name,
        text: trimmed,
        ts: Date.now(),
      });
    });

    socket.on("disconnect", leaveCurrentRoom);
  });
}
