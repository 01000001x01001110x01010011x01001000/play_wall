import type { GameModule, NetSession, PlayMode } from "../types";

type Mark = "X" | "O";
type Cell = Mark | null;

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function winner(board: Cell[]): { mark: Mark; line: number[] } | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { mark: board[a], line };
    }
  }
  return null;
}

function isFull(board: Cell[]): boolean {
  return board.every((c) => c !== null);
}

/**
 * Minimax over the full game tree (max 9 plies, tiny). Returns the score for
 * `player` with the convention: win = +10 - depth, loss = depth - 10, draw = 0.
 * Depth-adjusting makes the AI prefer fast wins and slow losses.
 */
function minimax(board: Cell[], current: Mark, player: Mark, depth: number): number {
  const w = winner(board);
  if (w) return w.mark === player ? 10 - depth : depth - 10;
  if (isFull(board)) return 0;

  const scores: number[] = [];
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue;
    board[i] = current;
    scores.push(minimax(board, current === "X" ? "O" : "X", player, depth + 1));
    board[i] = null;
  }
  return current === player ? Math.max(...scores) : Math.min(...scores);
}

function bestMove(board: Cell[], ai: Mark): number {
  let best = -Infinity;
  let move = -1;
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue;
    board[i] = ai;
    const score = minimax(board, ai === "X" ? "O" : "X", ai, 0);
    board[i] = null;
    if (score > best) {
      best = score;
      move = i;
    }
  }
  return move;
}

function mount(root: HTMLElement, mode: PlayMode, net?: NetSession): () => void {
  let board: Cell[] = Array(9).fill(null);
  let turn: Mark = "X";
  let over = false;
  let opponentLeft = false;
  let aiTimer: number | undefined;
  /** Which mark this client plays in online mode. */
  const myMark: Mark = net?.playerIndex === 1 ? "O" : "X";

  const status = document.createElement("p");
  status.className = "status-line";

  const grid = document.createElement("div");
  grid.className = "board";
  grid.style.gridTemplateColumns = "repeat(3, auto)";

  const cells: HTMLButtonElement[] = [];
  for (let i = 0; i < 9; i++) {
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

  root.append(status, grid, restart);

  function onCellClick(i: number) {
    if (over || board[i]) return;
    // In AI mode the human is always X; ignore clicks during the AI's turn.
    if (mode === "ai" && turn !== "X") return;
    if (mode === "online" && turn !== myMark) return;
    applyMove(i);
  }

  /** Single entry point for every move, local or remote. */
  function applyMove(i: number, remote = false) {
    if (mode === "online" && !remote) net!.send({ kind: "move", data: i });
    board[i] = turn;
    turn = turn === "X" ? "O" : "X";
    render();
    if (!over && mode === "ai" && turn === "O") {
      aiTimer = window.setTimeout(() => applyMove(bestMove(board, "O")), 350);
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

    for (let i = 0; i < 9; i++) {
      const c = cells[i];
      c.textContent = board[i] ?? "";
      c.disabled = over || !!board[i];
      c.classList.toggle("p1", board[i] === "X");
      c.classList.toggle("p2", board[i] === "O");
      c.classList.toggle("win", !!w && w.line.includes(i));
    }

    status.className = "status-line";
    if (opponentLeft) {
      status.textContent = "Your opponent left the room.";
      status.classList.add("bad");
    } else if (w) {
      if (mode === "ai" || mode === "online") {
        const mine = w.mark === (mode === "ai" ? "X" : myMark);
        status.textContent = mine
          ? "You win! 🎉"
          : mode === "ai"
            ? "Computer wins."
            : "Your friend wins.";
        status.classList.add(mine ? "good" : "bad");
      } else {
        status.textContent = `${w.mark} wins! 🎉`;
        status.classList.add("good");
      }
    } else if (isFull(board)) {
      status.textContent = "It's a draw.";
    } else if (mode === "ai") {
      status.textContent = turn === "X" ? "Your turn (X)" : "Computer is thinking…";
    } else if (mode === "online") {
      status.textContent = turn === myMark ? `Your turn (${myMark})` : "Waiting for your friend…";
    } else {
      status.textContent = `${turn} to move`;
    }
  }

  function reset(remote = false) {
    if (mode === "online" && !remote && net) net.send({ kind: "restart" });
    clearTimeout(aiTimer);
    board = Array(9).fill(null);
    turn = "X";
    over = false;
    render();
  }

  render();
  return () => clearTimeout(aiTimer);
}

export const tictactoe: GameModule = {
  id: "tictactoe",
  name: "Tic-Tac-Toe",
  tagline: "The classic. Beat an unbeatable computer, or a friend.",
  icon: "⭕",
  modes: ["online", "ai", "local"],
  mount,
};
