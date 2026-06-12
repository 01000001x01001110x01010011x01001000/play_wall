import { joinRoom, selfId } from "trystero";
import type { NetMsg, NetSession } from "./types";

/**
 * P2P networking via Trystero: peers that join the same room code find each
 * other through public signaling (no server of ours), then game messages
 * flow directly between them over a WebRTC data channel.
 */

const APP_ID = "playwall-v1";

/** Unambiguous room codes: no 0/O, 1/I/L lookalikes. */
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRoomCode(): string {
  return Array.from(
    { length: 6 },
    () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
  ).join("");
}

export interface PendingConnection {
  /** Resolves when an opponent joins. Never resolves after cancel(). */
  session: Promise<NetSession>;
  cancel(): void;
}

export function connect(roomCode: string): PendingConnection {
  const room = joinRoom({ appId: APP_ID }, roomCode);
  const action = room.makeAction<NetMsg>("msg");

  let opponent: string | null = null;
  let cancelled = false;
  const msgHandlers: Array<(msg: NetMsg) => void> = [];
  const leaveHandlers: Array<() => void> = [];

  action.onMessage = (msg, ctx) => {
    if (ctx.peerId === opponent) msgHandlers.forEach((h) => h(msg));
  };
  room.onPeerLeave = (peerId) => {
    if (peerId === opponent) leaveHandlers.forEach((h) => h());
  };

  const session = new Promise<NetSession>((resolve) => {
    room.onPeerJoin = (peerId) => {
      // lock onto the first opponent; ignore anyone else who wanders in
      if (cancelled || opponent) return;
      opponent = peerId;
      resolve({
        // both ends compare the same two ids, so they always agree on roles
        playerIndex: selfId < peerId ? 0 : 1,
        send: (msg) => void action.send(msg, { target: opponent }),
        onMessage: (cb) => msgHandlers.push(cb),
        onPeerLeave: (cb) => leaveHandlers.push(cb),
        leave: () => void room.leave(),
      });
    };
  });

  return {
    session,
    cancel: () => {
      cancelled = true;
      void room.leave();
    },
  };
}
