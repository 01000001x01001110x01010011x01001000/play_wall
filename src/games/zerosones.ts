import type { GameModule, NetSession, PlayMode } from "../types";

/**
 * Zeros & Ones — a bigger sibling of tic-tac-toe.
 * 6x6 board, player 1 places "1", player 2 places "0".
 * First to get 4 of their symbol in a row (any direction) wins.
 */

const SIZE = 6;
const NEED = 4;

type Mark = "1" | "0";
type Cell = Mark | null;

const DIRS = [
  [0, 1], // →
  [1, 0], // ↓
  [1, 1], // ↘
  [1, -1], // ↙
];

function idx(r: number, c: number): number {
  return r * SIZE + c;
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

function winner(board: Cell[]): { mark: Mark; line: number[] } | null {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const mark = board[idx(r, c)];
      if (!mark) continue;
      for (const [dr, dc] of DIRS) {
        const line = [idx(r, c)];
        let rr = r + dr;
        let cc = c + dc;
        while (line.length < NEED && inBounds(rr, cc) && board[idx(rr, cc)] === mark) {
          line.push(idx(rr, cc));
          rr += dr;
          cc += dc;
        }
        if (line.length === NEED) return { mark, line };
      }
    }
  }
  return null;
}

function isFull(board: Cell[]): boolean {
  return board.every((c) => c !== null);
}

/**
 * Heuristic AI (full minimax is too slow on 36 cells):
 * 1. take a winning move,
 * 2. block the opponent's winning move,
 * 3. otherwise pick the empty cell that scores best by counting how many
 *    open NEED-length windows through it favor the AI, with a center bias.
 */
function aiMove(board: Cell[], ai: Mark, human: Mark): number {
  const empties: number[] = [];
  for (let i = 0; i < board.length; i++) if (!board[i]) empties.push(i);

  for (const mark of [ai, human]) {
    for (const i of empties) {
      board[i] = mark;
      const w = winner(board);
      board[i] = null;
      if (w) return i;
    }
  }

  let best = -Infinity;
  let move = empties[0];
  for (const i of empties) {
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    let score = -(Math.abs(r - (SIZE - 1) / 2) + Math.abs(c - (SIZE - 1) / 2));
    for (const [dr, dc] of DIRS) {
      // every NEED-length window that passes through (r, c)
      for (let offset = -(NEED - 1); offset <= 0; offset++) {
        let mine = 0;
        let theirs = 0;
        let valid = true;
        for (let k = 0; k < NEED; k++) {
          const rr = r + (offset + k) * dr;
          const cc = c + (offset + k) * dc;
          if (!inBounds(rr, cc)) {
            valid = false;
            break;
          }
          const cell = board[idx(rr, cc)];
          if (cell === ai) mine++;
          else if (cell === human) theirs++;
        }
        if (!valid) continue;
        if (theirs === 0) score += [0, 1, 4, 12][mine] ?? 0;
        if (mine === 0) score += [0, 1, 3, 9][theirs] ?? 0; // value blocking too
      }
    }
    if (score > best) {
      best = score;
      move = i;
    }
  }
  return move;
}

function mount(root: HTMLElement, mode: PlayMode, net?: NetSession): () => void {
  let board: Cell[] = Array(SIZE * SIZE).fill(null);
  let turn: Mark = "1";
  let over = false;
  let opponentLeft = false;
  let aiTimer: number | undefined;
  /** Which mark this client plays in online mode. */
  const myMark: Mark = net?.playerIndex === 1 ? "0" : "1";

  const status = document.createElement("p");
  status.className = "status-line";

  const grid = document.createElement("div");
  grid.className = "board small-cells";
  grid.style.gridTemplateColumns = `repeat(${SIZE}, auto)`;

  const cells: HTMLButtonElement[] = [];
  for (let i = 0; i < SIZE * SIZE; i++) {
    const btn = document.createElement("button");
    btn.className = "cell";
    btn.addEventListener("click", () => onCellClick(i));
    cells.push(btn);
    grid.appendChild(btn);
  }

  const restart = document.createElement("button");
  restart.className = "action-btn";
  restart.textContent = "Restart";
  restart.addEventListener("click", () => reset());

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = "Get four in a row — across, down, or diagonal.";

  root.append(status, grid, restart, hint);

  function onCellClick(i: number) {
    if (over || board[i]) return;
    if (mode === "ai" && turn !== "1") return;
    if (mode === "online" && turn !== myMark) return;
    applyMove(i);
  }

  /** Single entry point for every move, local or remote. */
  function applyMove(i: number, remote = false) {
    if (mode === "online" && !remote) net!.send({ kind: "move", data: i });
    board[i] = turn;
    turn = turn === "1" ? "0" : "1";
    render();
    if (!over && mode === "ai" && turn === "0") {
      aiTimer = window.setTimeout(() => applyMove(aiMove(board, "0", "1")), 350);
    }
  }

  if (mode === "online" && net) {
    net.onMessage((msg) => {
      if (msg.kind === "move") applyMove(msg.data as number, true);
      else if (msg.kind === "restart") reset(true);
    });
    net.onPeerLeave(() => {
      opponentLeft = true;
      render();
    });
  }

  function render() {
    const w = winner(board);
    over = !!w || isFull(board) || opponentLeft;

    for (let i = 0; i < board.length; i++) {
      const c = cells[i];
      c.textContent = board[i] ?? "";
      c.disabled = over || !!board[i];
      c.classList.toggle("p1", board[i] === "1");
      c.classList.toggle("p2", board[i] === "0");
      c.classList.toggle("win", !!w && w.line.includes(i));
    }

    status.className = "status-line";
    if (opponentLeft) {
      status.textContent = "Your opponent left the room.";
      status.classList.add("bad");
    } else if (w) {
      if (mode === "ai" || mode === "online") {
        const mine = w.mark === (mode === "ai" ? "1" : myMark);
        status.textContent = mine
          ? "You win! 🎉"
          : mode === "ai"
            ? "Computer wins."
            : "Your friend wins.";
        status.classList.add(mine ? "good" : "bad");
      } else {
        status.textContent = `Player ${w.mark} wins! 🎉`;
        status.classList.add("good");
      }
    } else if (isFull(board)) {
      status.textContent = "It's a draw.";
    } else if (mode === "ai") {
      status.textContent = turn === "1" ? "Your turn (1)" : "Computer is thinking…";
    } else if (mode === "online") {
      status.textContent = turn === myMark ? `Your turn (${myMark})` : "Waiting for your friend…";
    } else {
      status.textContent = `Player ${turn} to move`;
    }
  }

  function reset(remote = false) {
    if (mode === "online" && !remote && net) net.send({ kind: "restart" });
    clearTimeout(aiTimer);
    board = Array(SIZE * SIZE).fill(null);
    turn = "1";
    over = false;
    render();
  }

  render();
  return () => clearTimeout(aiTimer);
}

export const zerosones: GameModule = {
  id: "zerosones",
  name: "Zeros & Ones",
  tagline: "Four in a row on a 6×6 board. 1s vs 0s.",
  icon: "🔢",
  modes: ["online", "ai", "local"],
  mount,
};
