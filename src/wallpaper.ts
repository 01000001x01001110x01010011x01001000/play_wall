import { dailyQuote } from "./quotes";
import {
  formatDuration,
  getStats,
  totalPlays,
  totalTimeMs,
  type Stats,
} from "./stats";
import { getSettings, type WallpaperSettings } from "./settings";

/**
 * Renders the wallpaper onto a canvas. Two looks:
 *  - "motivation": a big bold uppercase line on black (the default), like a
 *    motivational poster; the quote rotates daily.
 *  - "infographic": clock, date, quote, and play-stat cards.
 * Everything scales off the canvas height, so the same code renders a small
 * in-app preview and a full-resolution export.
 */

export interface RenderOptions {
  width: number;
  height: number;
  stats?: Stats;
  settings?: WallpaperSettings;
  /** Snapshot time (clock + daily quote); defaults to now. */
  now?: Date;
}

export function renderWallpaper(canvas: HTMLCanvasElement, opts: RenderOptions) {
  const { width: W, height: H } = opts;
  const settings = opts.settings ?? getSettings();
  const now = opts.now ?? new Date();

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const quote = settings.autoDaily ? dailyQuote(now) : settings.quote;

  if (settings.style === "motivation") {
    renderMotivation(ctx, W, H, quote);
  } else {
    renderInfographic(ctx, W, H, settings, opts.stats ?? getStats(), now, quote);
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

// ============================ motivation ============================

function renderMotivation(ctx: CanvasRenderingContext2D, W: number, H: number, quote: string) {
  // deep black background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);

  // drop sentence punctuation so stacked words read cleanly (LESS / TALK / MORE / DO)
  const words = quote.trim().replace(/[.,!?]/g, "").toUpperCase().split(/\s+/);
  // ≤4 words → one word per line (the stacked poster look); else group by 3
  const lines: string[] = [];
  if (words.length <= 4) {
    lines.push(...words);
  } else {
    for (let i = 0; i < words.length; i += 3) lines.push(words.slice(i, i + 3).join(" "));
  }

  const maxW = W * 0.66;
  const maxH = H * 0.74;
  const font = (size: number) =>
    `800 ${size}px "Impact", "Haettenschweiler", "Arial Narrow", "Oswald", sans-serif`;

  // shrink the type until the whole block fits
  let size = H * 0.24;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (; size > 12; size -= 2) {
    ctx.font = font(size);
    const lineH = size * 1.04;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (widest <= maxW && lineH * lines.length <= maxH) break;
  }

  ctx.font = font(size);
  try {
    // tighten the letters slightly for the condensed poster feel
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${-size * 0.01}px`;
  } catch {
    /* letterSpacing unsupported — fine */
  }

  const lineH = size * 1.04;
  let y = H / 2 - (lineH * (lines.length - 1)) / 2;
  ctx.fillStyle = "#d7d7d7";
  for (const line of lines) {
    ctx.fillText(line, W / 2, y);
    y += lineH;
  }

  try {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
  } catch {
    /* ignore */
  }

  applyGrain(ctx, W, H);
}

/** A faint film-grain overlay for the worn, printed look. */
function applyGrain(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const tileSize = 160;
  const tile = document.createElement("canvas");
  tile.width = tileSize;
  tile.height = tileSize;
  const tctx = tile.getContext("2d")!;
  const img = tctx.createImageData(tileSize, tileSize);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (120 + Math.random() * 135) | 0;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);

  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;
  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ============================ infographic ============================

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

function renderInfographic(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  settings: WallpaperSettings,
  stats: Stats,
  now: Date,
  quote: string,
) {
  const s = H / 1600;
  const margin = W * 0.07;
  const accent = settings.accent;

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

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = accent;
  ctx.font = `700 ${44 * s}px "Avenir Next", "Segoe UI", system-ui, sans-serif`;
  ctx.fillText("▶", margin, margin + 36 * s);
  ctx.fillStyle = "#e8ecf4";
  ctx.fillText("PlayWall", margin + 60 * s, margin + 36 * s);

  let cursorY = H * 0.3;
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

  if (quote.trim()) {
    ctx.fillStyle = "#c7cedd";
    ctx.font = `italic 300 ${64 * s}px "Avenir Next", Georgia, serif`;
    const lines = wrapText(ctx, `"${quote.trim()}"`, W - margin * 2);
    for (const line of lines) {
      cursorY += 86 * s;
      ctx.fillText(line, margin, cursorY);
    }
  }

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
      const value = fitText(ctx, card.value, cardW - 64 * s, 64 * s, s);
      ctx.font = `600 ${value.size}px "Avenir Next", "Segoe UI", system-ui, sans-serif`;
      ctx.fillText(value.text, x + 32 * s, cardY + 140 * s);
    });

    ctx.fillStyle = hexAlpha(accent, 0.9);
    ctx.font = `600 ${34 * s}px "Avenir Next", "Segoe UI", system-ui, sans-serif`;
    ctx.fillText("▶  Click the PlayWall icon to play", margin, cardY - 44 * s);
  }
}

// ---- shared canvas helpers ----

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
  return lines.slice(0, 3);
}

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
