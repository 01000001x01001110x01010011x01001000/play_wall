import { recordScore } from "../stats";
import type { GameModule, PlayMode } from "../types";

const COLS = 20;
const ROWS = 20;
const CELL = 22; // px
const BASE_SPEED_MS = 140; // time per step at score 0
const MIN_SPEED_MS = 60;
const HISCORE_KEY = "playwall.snake.hiscore";

type Point = { x: number; y: number };

function mount(root: HTMLElement, _mode: PlayMode): () => void {
  const status = document.createElement("p");
  status.className = "status-line";

  const stats = document.createElement("div");
  stats.className = "snake-stats";
  const scoreEl = document.createElement("div");
  const hiscoreEl = document.createElement("div");
  stats.append(scoreEl, hiscoreEl);

  const canvas = document.createElement("canvas");
  canvas.className = "snake-canvas";
  canvas.width = COLS * CELL;
  canvas.height = ROWS * CELL;
  const ctx = canvas.getContext("2d")!;

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = "Arrow keys or WASD to steer · Space to pause · Enter to restart";

  root.append(status, stats, canvas, hint);

  let snake: Point[];
  let dir: Point;
  let nextDir: Point;
  let food: Point;
  let score: number;
  let hiscore = Number(localStorage.getItem(HISCORE_KEY) ?? 0);
  let dead: boolean;
  let paused = false;
  let awaitingStart = true; // don't move until the player presses a key
  let lastStep = 0;
  let rafId = 0;

  function reset() {
    snake = [
      { x: 5, y: 10 },
      { x: 4, y: 10 },
      { x: 3, y: 10 },
    ];
    dir = { x: 1, y: 0 };
    nextDir = dir;
    score = 0;
    dead = false;
    paused = false;
    awaitingStart = true;
    placeFood();
    updateText();
  }

  function placeFood() {
    do {
      food = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (snake.some((s) => s.x === food.x && s.y === food.y));
  }

  function speedMs(): number {
    return Math.max(MIN_SPEED_MS, BASE_SPEED_MS - score * 4);
  }

  function step() {
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    const hitWall = head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS;
    const hitSelf = snake.some((s) => s.x === head.x && s.y === head.y);
    if (hitWall || hitSelf) {
      dead = true;
      if (score > hiscore) {
        hiscore = score;
        localStorage.setItem(HISCORE_KEY, String(hiscore));
      }
      recordScore("snake", "Snake", score);
      updateText();
      return;
    }

    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score++;
      placeFood();
      updateText();
    } else {
      snake.pop();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // food
    ctx.fillStyle = "#ff5470";
    ctx.beginPath();
    ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2 - 3, 0, Math.PI * 2);
    ctx.fill();

    // snake — head brighter than tail
    snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? "#7fb0ff" : "#4f8cff";
      ctx.beginPath();
      ctx.roundRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2, 5);
      ctx.fill();
    });
  }

  function loop(now: number) {
    rafId = requestAnimationFrame(loop);
    if (dead || paused || awaitingStart) return;
    if (now - lastStep >= speedMs()) {
      lastStep = now;
      step();
      draw();
    }
  }

  function updateText() {
    scoreEl.innerHTML = `<span>Score</span> ${score}`;
    hiscoreEl.innerHTML = `<span>Best</span> ${hiscore}`;
    status.className = "status-line";
    if (dead) {
      status.textContent = "Game over — press Enter to play again";
      status.classList.add("bad");
    } else if (awaitingStart) {
      status.textContent = "Press an arrow key to start";
    } else if (paused) {
      status.textContent = "Paused";
    } else {
      status.textContent = "";
    }
  }

  function onKey(e: KeyboardEvent) {
    const turns: Record<string, Point> = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      w: { x: 0, y: -1 },
      s: { x: 0, y: 1 },
      a: { x: -1, y: 0 },
      d: { x: 1, y: 0 },
    };
    const turn = turns[e.key];
    if (turn) {
      e.preventDefault();
      // forbid reversing into yourself
      if (turn.x !== -dir.x || turn.y !== -dir.y) nextDir = turn;
      if (awaitingStart && !dead) {
        awaitingStart = false;
        lastStep = performance.now();
        updateText();
      }
    } else if (e.key === " ") {
      e.preventDefault();
      if (!dead && !awaitingStart) {
        paused = !paused;
        updateText();
      }
    } else if (e.key === "Enter" && dead) {
      reset();
      draw();
    }
  }

  window.addEventListener("keydown", onKey);
  reset();
  draw();
  rafId = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener("keydown", onKey);
  };
}

export const snake: GameModule = {
  id: "snake",
  name: "Snake",
  tagline: "Eat, grow, don't crash. Speeds up as you score.",
  icon: "🐍",
  modes: ["solo"],
  mount,
};
