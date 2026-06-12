/**
 * Shared contracts for every game in the hub.
 *
 * A game is a self-contained module: the hub gives it a DOM container and a
 * play mode, and the game returns a cleanup function. In phase 2 (online
 * play) a third mode will be added where moves travel over a MoveChannel
 * instead of being applied directly — games should route turn-based moves
 * through a single applyMove() function now to make that swap easy.
 */

export type PlayMode = "solo" | "local" | "ai" | "online";

/** Messages exchanged between the two players of an online game. */
export type NetMsg =
  | { kind: "move"; data: number | { from: number; to: number } }
  | { kind: "restart" };

/** A live connection to the one opponent in a room (see net.ts). */
export interface NetSession {
  /** 0 plays first (X / 1 / White), 1 plays second. Same on both ends. */
  playerIndex: 0 | 1;
  send(msg: NetMsg): void;
  onMessage(cb: (msg: NetMsg) => void): void;
  onPeerLeave(cb: () => void): void;
  leave(): void;
}

export interface GameModule {
  id: string;
  name: string;
  tagline: string;
  /** Emoji shown on the hub card. */
  icon: string;
  /** Modes this game supports; hub shows a picker when there is more than one. */
  modes: PlayMode[];
  /** Render the game into root. Returns a cleanup function. */
  mount(root: HTMLElement, mode: PlayMode, net?: NetSession): () => void;
}

export const MODE_LABELS: Record<PlayMode, { title: string; detail: string }> = {
  solo: { title: "Single player", detail: "Just you and the game" },
  local: { title: "Two players, one screen", detail: "Take turns on this computer" },
  ai: { title: "Play vs computer", detail: "You go first" },
  online: { title: "Play online", detail: "Share a room link with a friend" },
};
