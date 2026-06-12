import type { GameModule, NetSession, PlayMode } from "../types";

/**
 * Mini Chess — the Los Alamos 6×6 variant.
 * Like chess but: no bishops, no castling, no en passant, pawns never move
 * two squares, and pawns promote to queen only. Win by checkmate.
 */

const SIZE = 6;

type Color = "w" | "b";
type PType = "k" | "q" | "r" | "n" | "p";
interface Piece {
  t: PType;
  c: Color;
}
type Board = (Piece | null)[];

const GLYPHS: Record<Color, Record<PType, string>> = {
  w: { k: "♔", q: "♕", r: "♖", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", n: "♞", p: "♟" },
};

const KNIGHT_JUMPS = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];
const ROOK_RAYS = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
];
const ALL_RAYS = [
  ...ROOK_RAYS,
  [-1, -1], [-1, 1], [1, -1], [1, 1],
];

function idx(r: number, c: number): number {
  return r * SIZE + c;
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

function startBoard(): Board {
  const board: Board = Array(SIZE * SIZE).fill(null);
  const back: PType[] = ["r", "n", "q", "k", "n", "r"];
  for (let c = 0; c < SIZE; c++) {
    board[idx(0, c)] = { t: back[c], c: "b" };
    board[idx(1, c)] = { t: "p", c: "b" };
    board[idx(SIZE - 2, c)] = { t: "p", c: "w" };
    board[idx(SIZE - 1, c)] = { t: back[c], c: "w" };
  }
  return board;
}

/**
 * Squares a piece could move to, ignoring whether the move leaves its own
 * king in check. `capturesOnly` limits pawns to their diagonal attacks —
 * that variant is what check detection needs.
 */
function pseudoMoves(board: Board, from: number, capturesOnly = false): number[] {
  const piece = board[from];
  if (!piece) return [];
  const r = Math.floor(from / SIZE);
  const c = from % SIZE;
  const moves: number[] = [];

  const tryAdd = (rr: number, cc: number): boolean => {
    // returns true if the ray may continue past this square
    if (!inBounds(rr, cc)) return false;
    const target = board[idx(rr, cc)];
    if (!target) {
      moves.push(idx(rr, cc));
      return true;
    }
    if (target.c !== piece.c) moves.push(idx(rr, cc));
    return false;
  };

  switch (piece.t) {
    case "p": {
      const dr = piece.c === "w" ? -1 : 1;
      if (!capturesOnly && inBounds(r + dr, c) && !board[idx(r + dr, c)]) {
        moves.push(idx(r + dr, c));
      }
      for (const dc of [-1, 1]) {
        if (!inBounds(r + dr, c + dc)) continue;
        const to = idx(r + dr, c + dc);
        const target = board[to];
        if (capturesOnly) {
          // attack detection: the diagonal is threatened even when empty
          if (!target || target.c !== piece.c) moves.push(to);
        } else if (target && target.c !== piece.c) {
          moves.push(to);
        }
      }
      break;
    }
    case "n":
      for (const [dr, dc] of KNIGHT_JUMPS) tryAdd(r + dr, c + dc);
      break;
    case "k":
      for (const [dr, dc] of ALL_RAYS) tryAdd(r + dr, c + dc);
      break;
    case "r":
    case "q": {
      const rays = piece.t === "r" ? ROOK_RAYS : ALL_RAYS;
      for (const [dr, dc] of rays) {
        let rr = r + dr;
        let cc = c + dc;
        while (tryAdd(rr, cc)) {
          rr += dr;
          cc += dc;
        }
      }
      break;
    }
  }
  return moves;
}

function isAttacked(board: Board, sq: number, by: Color): boolean {
  for (let i = 0; i < board.length; i++) {
    const piece = board[i];
    if (piece && piece.c === by && pseudoMoves(board, i, true).includes(sq)) {
      return true;
    }
  }
  return false;
}

function kingSquare(board: Board, color: Color): number {
  return board.findIndex((p) => p?.t === "k" && p.c === color);
}

function applyMoveTo(board: Board, from: number, to: number): Board {
  const next = board.slice();
  const piece = next[from]!;
  next[to] = piece;
  next[from] = null;
  // pawn promotion (queen only in Los Alamos)
  const toRow = Math.floor(to / SIZE);
  if (piece.t === "p" && (toRow === 0 || toRow === SIZE - 1)) {
    next[to] = { t: "q", c: piece.c };
  }
  return next;
}

function legalMoves(board: Board, from: number): number[] {
  const piece = board[from];
  if (!piece) return [];
  return pseudoMoves(board, from).filter((to) => {
    const after = applyMoveTo(board, from, to);
    return !isAttacked(after, kingSquare(after, piece.c), piece.c === "w" ? "b" : "w");
  });
}

function hasAnyLegalMove(board: Board, color: Color): boolean {
  for (let i = 0; i < board.length; i++) {
    if (board[i]?.c === color && legalMoves(board, i).length > 0) return true;
  }
  return false;
}

function mount(root: HTMLElement, mode: PlayMode, net?: NetSession): () => void {
  let board = startBoard();
  let turn: Color = "w";
  let selected: number | null = null;
  let targets: number[] = [];
  let over = false;
  let opponentLeft = false;
  /** Which color this client plays in online mode. */
  const myColor: Color = net?.playerIndex === 1 ? "b" : "w";

  const status = document.createElement("p");
  status.className = "status-line";

  const grid = document.createElement("div");
  grid.className = "chess-board";

  const squares: HTMLButtonElement[] = [];
  for (let i = 0; i < SIZE * SIZE; i++) {
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    const btn = document.createElement("button");
    btn.className = `chess-sq ${(r + c) % 2 === 0 ? "light" : "dark"}`;
    btn.addEventListener("click", () => onSquareClick(i));
    squares.push(btn);
    grid.appendChild(btn);
  }

  const restart = document.createElement("button");
  restart.className = "action-btn";
  restart.textContent = "Restart";
  restart.addEventListener("click", () => reset());

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = "6×6 chess: no bishops, no castling, pawns move one square and promote to queen.";

  root.append(status, grid, restart, hint);

  function onSquareClick(i: number) {
    if (over) return;
    if (mode === "online" && turn !== myColor) return;
    const piece = board[i];

    if (selected !== null && targets.includes(i)) {
      applyMove(selected, i);
      return;
    }
    if (piece && piece.c === turn) {
      selected = i;
      targets = legalMoves(board, i);
    } else {
      selected = null;
      targets = [];
    }
    render();
  }

  /** Single entry point for every move, local or remote. */
  function applyMove(from: number, to: number, remote = false) {
    if (mode === "online" && !remote) net!.send({ kind: "move", data: { from, to } });
    board = applyMoveTo(board, from, to);
    turn = turn === "w" ? "b" : "w";
    selected = null;
    targets = [];
    render();
  }

  if (mode === "online" && net) {
    net.onMessage((msg) => {
      if (msg.kind === "move") {
        const { from, to } = msg.data as { from: number; to: number };
        applyMove(from, to, true);
      } else if (msg.kind === "restart") {
        reset(true);
      }
    });
    net.onPeerLeave(() => {
      opponentLeft = true;
      render();
    });
  }

  function render() {
    for (let i = 0; i < board.length; i++) {
      const sq = squares[i];
      const piece = board[i];
      sq.innerHTML = piece
        ? `<span class="pc-${piece.c}">${GLYPHS[piece.c][piece.t]}</span>`
        : "";
      sq.classList.toggle("selected", selected === i);
      sq.classList.toggle("target", targets.includes(i) && !piece);
      sq.classList.toggle("capture", targets.includes(i) && !!piece);
    }

    const inCheck = isAttacked(board, kingSquare(board, turn), turn === "w" ? "b" : "w");
    const canMove = hasAnyLegalMove(board, turn);
    over = !canMove || opponentLeft;

    const name = turn === "w" ? "White" : "Black";
    const mineToMove = turn === myColor;
    status.className = "status-line";
    if (opponentLeft) {
      status.textContent = "Your opponent left the room.";
      status.classList.add("bad");
    } else if (!canMove && inCheck) {
      if (mode === "online") {
        status.textContent = mineToMove ? "Checkmate — your friend wins." : "Checkmate — you win! 🎉";
        status.classList.add(mineToMove ? "bad" : "good");
      } else {
        status.textContent = `Checkmate — ${turn === "w" ? "Black" : "White"} wins! 🎉`;
        status.classList.add("good");
      }
    } else if (!canMove) {
      status.textContent = "Stalemate — it's a draw.";
    } else if (inCheck) {
      status.textContent =
        mode === "online"
          ? mineToMove
            ? "Your move — you're in check!"
            : "Your friend is in check"
          : `${name} to move — check!`;
      status.classList.add(mode !== "online" || mineToMove ? "bad" : "good");
    } else if (mode === "online") {
      status.textContent = mineToMove
        ? `Your move (${myColor === "w" ? "White" : "Black"})`
        : "Waiting for your friend…";
    } else {
      status.textContent = `${name} to move`;
    }
  }

  function reset(remote = false) {
    if (mode === "online" && !remote && net) net.send({ kind: "restart" });
    board = startBoard();
    turn = "w";
    selected = null;
    targets = [];
    over = false;
    render();
  }

  render();
  return () => {};
}

export const minichess: GameModule = {
  id: "minichess",
  name: "Mini Chess",
  tagline: "Real chess on a 6×6 board. Quick games, full checkmate rules.",
  icon: "♞",
  modes: ["online", "local"],
  mount,
};
