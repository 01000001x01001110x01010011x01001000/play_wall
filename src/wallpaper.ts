import {
  formatDuration,
  getStats,
  totalPlays,
  totalTimeMs,
  type Stats,
} from "./stats";
import { getSettings, type WallpaperSettings } from "./settings";

/**
 * Renders the static infographic wallpaper onto a canvas. Everything scales
 * off the canvas height, so the same layout renders crisply at any resolution
 * — a small preview in the app and a full-screen export use identical code.
 */

export interface RenderOptions {
  width: number;
  height: number;
  stats?: Stats;
  settings?: WallpaperSettings;
  /** Snapshot time for the clock; defaults to now. */
  now?: Date;
}

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function renderWallpaper(canvas: HTMLCanvasElement, opts: RenderOptions) {
  const { width: W, height: H } = opts;
  const stats = opts.stats ?? getStats();
  const settings = opts.settings ?? getSettings();
  const now = opts.now ?? new Date();

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const s = H / 1600; // scale factor: design is tuned at 1600px tall
  const margin = W * 0.07;
  const accent = settings.accent;

  // ---- background: deep gradient + accent glow ----
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#10131c");
  bg.addColorStop(1, "#080a10");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.78, H * 0.12, 0, W * 0.78, H * 0.12, W * 0.5);
  glow.addColorStop(0, hexAlpha(accent, 0.22));
  glow.addColorStop(1, hexAlpha(accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ---- brand ----
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = accent;
  ctx.font = `700 ${44 * s}px "Avenir Next", "Segoe UI", system-ui, sans-serif`;
  ctx.fillText("▶", margin, margin + 36 * s);
  ctx.fillStyle = "#e8ecf4";
  ctx.fillText("PlayWall", margin + 60 * s, margin + 36 * s);

  // ---- clock + date ----
  let cursorY = H * 0.30;
  if (settings.showClock) {
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    ctx.fillStyle = "#f4f6fb";
    ctx.font = `200 ${220 * s}px "Avenir Next", "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(`${hh}:${mm}`, margin, cursorY);

    const dateStr = now.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    ctx.fillStyle = "#8b94a7";
    ctx.font = `500 ${46 * s}px "Avenir Next", "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(`${greeting(now.getHours())} · ${dateStr}`, margin + 6 * s, cursorY + 64 * s);
    cursorY += 150 * s;
  }

  // ---- quote ----
  if (settings.showQuote && settings.quote.trim()) {
    ctx.fillStyle = "#c7cedd";
    ctx.font = `italic 300 ${64 * s}px "Avenir Next", Georgia, serif`;
    const lines = wrapText(ctx, `"${settings.quote.trim()}"`, W - margin * 2);
    for (const line of lines) {
      cursorY += 86 * s;
      ctx.fillText(line, margin, cursorY);
    }
  }

  // ---- stat cards ----
  if (settings.showStats) {
    const snake = stats.perGame["snake"];
    const cards: Array<{ label: string; value: string }> = [
      { label: "Last played", value: stats.lastGameName ?? "—" },
      { label: "Matches", value: String(totalPlays(stats)) },
      { label: "Time played", value: formatDuration(totalTimeMs(stats)) },
      { label: "Snake best", value: snake ? String(snake.best) : "—" },
    ];

    const gap = 28 * s;
    const cardH = 200 * s;
    const cardW = (W - margin * 2 - gap * (cards.length - 1)) / cards.length;
    const cardY = H - margin - cardH;

    cards.forEach((card, i) => {
      const x = margin + i * (cardW + gap);
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      roundRect(ctx, x, cardY, cardW, cardH, 28 * s);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1.5 * s;
      ctx.stroke();

      ctx.fillStyle = "#8b94a7";
      ctx.font = `600 ${30 * s}px "Avenir Next", "Segoe UI", system-ui, sans-serif`;
      ctx.fillText(card.label.toUpperCase(), x + 32 * s, cardY + 58 * s);

      ctx.fillStyle = "#f4f6fb";
      ctx.font = `600 ${64 * s}px "Avenir Next", "Segoe UI", system-ui, sans-serif`;
      const value = fitText(ctx, card.value, cardW - 64 * s, 64 * s, s);
      ctx.font = `600 ${value.size}px "Avenir Next", "Segoe UI", system-ui, sans-serif`;
      ctx.fillText(value.text, x + 32 * s, cardY + 140 * s);
    });

    // play hint above the cards
    ctx.fillStyle = hexAlpha(accent, 0.9);
    ctx.font = `600 ${34 * s}px "Avenir Next", "Segoe UI", system-ui, sans-serif`;
    ctx.fillText("▶  Click the PlayWall icon to play", margin, cardY - 44 * s);
  }
}

/** Render at the real display resolution and return a base64 PNG (no prefix). */
export function exportWallpaperPng(): { base64: string; width: number; height: number } {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(window.screen.width * dpr);
  const height = Math.round(window.screen.height * dpr);
  const canvas = document.createElement("canvas");
  renderWallpaper(canvas, { width, height });
  const dataUrl = canvas.toDataURL("image/png");
  return { base64: dataUrl.split(",")[1], width, height };
}

// ---- small canvas helpers ----

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3); // cap at 3 lines
}

/** Shrink a value's font until it fits the card width. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  baseSize: number,
  s: number,
): { text: string; size: number } {
  let size = baseSize;
  while (size > 28 * s) {
    ctx.font = `600 ${size}px "Avenir Next", "Segoe UI", system-ui, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4 * s;
  }
  return { text, size };
}

function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
