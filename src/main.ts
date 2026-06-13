import "./style.css";
import { games } from "./games";
import { connect, generateRoomCode } from "./net";
import { recordTime } from "./stats";
import { ACCENT_PRESETS, getSettings, saveSettings, type WallpaperSettings } from "./settings";
import { exportWallpaperPng, renderWallpaper } from "./wallpaper";
import { MODE_LABELS, type GameModule, type PlayMode } from "./types";

const app = document.querySelector<HTMLDivElement>("#app")!;

/** Cleanup function of the currently mounted screen, if any. */
let activeCleanup: (() => void) | null = null;

function clearScreen() {
  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }
  app.innerHTML = "";
}

function showHub() {
  clearScreen();
  if (location.hash) history.replaceState(null, "", location.pathname);

  const header = document.createElement("div");
  header.className = "hub-header";
  const title = document.createElement("span");
  title.className = "hub-title";
  title.textContent = "PlayWall";
  const wallpaperBtn = document.createElement("button");
  wallpaperBtn.className = "back-btn hub-wallpaper-btn";
  wallpaperBtn.textContent = "🖼 Wallpaper";
  wallpaperBtn.addEventListener("click", showWallpaper);
  header.append(title, wallpaperBtn);
  app.appendChild(header);

  const sub = document.createElement("p");
  sub.className = "hub-sub";
  sub.textContent = "Pick a game — solo, on one screen, or online with a room link.";
  app.appendChild(sub);

  const grid = document.createElement("div");
  grid.className = "card-grid";
  for (const game of games) {
    const card = document.createElement("button");
    card.className = "game-card";
    card.innerHTML = `
      <span class="icon">${game.icon}</span>
      <span class="name">${game.name}</span><br/>
      <span class="tagline">${game.tagline}</span>`;
    card.addEventListener("click", () => {
      if (game.modes.length === 1) {
        showGame(game, game.modes[0]);
      } else {
        showModePicker(game);
      }
    });
    grid.appendChild(card);
  }
  app.appendChild(grid);
}

function showModePicker(game: GameModule) {
  clearScreen();
  app.appendChild(gameHeader(game.name, showHub));

  const list = document.createElement("div");
  list.className = "mode-list";
  for (const mode of game.modes) {
    const { title, detail } = MODE_LABELS[mode];
    const btn = document.createElement("button");
    btn.className = "mode-btn";
    btn.innerHTML = `${title}<small>${detail}</small>`;
    btn.addEventListener("click", () => {
      if (mode === "online") {
        showOnlineRoom(game, generateRoomCode());
      } else {
        showGame(game, mode);
      }
    });
    list.appendChild(btn);
  }
  app.appendChild(list);
}

function showGame(game: GameModule, mode: PlayMode) {
  clearScreen();
  app.appendChild(
    gameHeader(game.name, () => {
      if (game.modes.length > 1) showModePicker(game);
      else showHub();
    }),
  );

  const stage = document.createElement("div");
  stage.className = "game-stage";
  app.appendChild(stage);

  const start = Date.now();
  const cleanup = game.mount(stage, mode);
  activeCleanup = () => {
    cleanup();
    recordTime(game.id, game.name, Date.now() - start);
  };
}

/**
 * Online flow: both players land here — the creator via the mode picker, the
 * friend via the shared link. Everyone joins the room; when two peers meet,
 * the game starts.
 */
function showOnlineRoom(game: GameModule, code: string) {
  clearScreen();
  const hash = `#room=${code}&game=${game.id}`;
  history.replaceState(null, "", hash);

  app.appendChild(gameHeader(`${game.name} — online`, showHub));

  const stage = document.createElement("div");
  stage.className = "game-stage";
  app.appendChild(stage);

  const link = `${location.origin}${location.pathname}${hash}`;

  const waiting = document.createElement("div");
  waiting.className = "room-box";
  waiting.innerHTML = `
    <p class="status-line">Waiting for a friend to join…</p>
    <p class="hint">Room code: <b>${code}</b> — send them this link:</p>`;

  const linkRow = document.createElement("div");
  linkRow.className = "link-row";
  const linkInput = document.createElement("input");
  linkInput.value = link;
  linkInput.readOnly = true;
  linkInput.addEventListener("focus", () => linkInput.select());
  const copyBtn = document.createElement("button");
  copyBtn.className = "action-btn";
  copyBtn.textContent = "Copy link";
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(link);
      copyBtn.textContent = "Copied!";
    } catch {
      linkInput.select();
      copyBtn.textContent = "Press ⌘C / Ctrl+C";
    }
    setTimeout(() => (copyBtn.textContent = "Copy link"), 1500);
  });
  linkRow.append(linkInput, copyBtn);
  waiting.appendChild(linkRow);
  stage.appendChild(waiting);

  const pending = connect(code);
  activeCleanup = () => pending.cancel();

  void pending.session.then((net) => {
    waiting.remove();

    const youAre = document.createElement("p");
    youAre.className = "hint";
    youAre.textContent =
      net.playerIndex === 0
        ? "Connected! You move first."
        : "Connected! Your friend moves first.";
    stage.appendChild(youAre);

    const start = Date.now();
    const gameCleanup = game.mount(stage, "online", net);
    activeCleanup = () => {
      gameCleanup();
      net.leave();
      recordTime(game.id, game.name, Date.now() - start);
    };
  });
}

/**
 * The wallpaper screen: a live preview of the infographic plus controls to
 * edit the quote, toggle widgets, and pick an accent. Inside Tauri it can set
 * the image as the real desktop wallpaper; in the browser it downloads a PNG.
 */
function showWallpaper() {
  clearScreen();
  app.appendChild(gameHeader("Wallpaper", showHub));

  const settings = getSettings();

  const wrap = document.createElement("div");
  wrap.className = "wallpaper-screen";

  // --- live preview (rendered at the screen's aspect ratio) ---
  const aspect = window.screen.width / window.screen.height || 16 / 10;
  const preview = document.createElement("canvas");
  preview.className = "wallpaper-preview";
  const rerender = () =>
    renderWallpaper(preview, { width: 1200, height: Math.round(1200 / aspect), settings });
  rerender();
  wrap.appendChild(preview);

  // --- controls ---
  const controls = document.createElement("div");
  controls.className = "wallpaper-controls";

  const update = (patch: Partial<WallpaperSettings>) => {
    Object.assign(settings, patch);
    saveSettings(settings);
    rerender();
  };

  // quote
  const quoteLabel = document.createElement("label");
  quoteLabel.className = "ctrl-row";
  quoteLabel.innerHTML = "<span>Your quote</span>";
  const quoteInput = document.createElement("input");
  quoteInput.type = "text";
  quoteInput.maxLength = 80;
  quoteInput.value = settings.quote;
  quoteInput.addEventListener("input", () => update({ quote: quoteInput.value }));
  quoteLabel.appendChild(quoteInput);
  controls.appendChild(quoteLabel);

  // widget toggles
  const toggles: Array<[keyof WallpaperSettings, string]> = [
    ["showClock", "Clock & date"],
    ["showQuote", "Quote"],
    ["showStats", "Play stats"],
  ];
  const toggleRow = document.createElement("div");
  toggleRow.className = "ctrl-row";
  toggleRow.innerHTML = "<span>Show</span>";
  const toggleBox = document.createElement("div");
  toggleBox.className = "toggle-box";
  for (const [key, label] of toggles) {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.textContent = label;
    btn.classList.toggle("on", settings[key] as boolean);
    btn.addEventListener("click", () => {
      const next = !(settings[key] as boolean);
      update({ [key]: next } as Partial<WallpaperSettings>);
      btn.classList.toggle("on", next);
    });
    toggleBox.appendChild(btn);
  }
  toggleRow.appendChild(toggleBox);
  controls.appendChild(toggleRow);

  // accent
  const accentRow = document.createElement("div");
  accentRow.className = "ctrl-row";
  accentRow.innerHTML = "<span>Accent</span>";
  const swatches = document.createElement("div");
  swatches.className = "swatches";
  for (const preset of ACCENT_PRESETS) {
    const sw = document.createElement("button");
    sw.className = "swatch";
    sw.style.background = preset.value;
    sw.title = preset.name;
    sw.classList.toggle("on", settings.accent === preset.value);
    sw.addEventListener("click", () => {
      update({ accent: preset.value });
      swatches.querySelectorAll(".swatch").forEach((e) => e.classList.remove("on"));
      sw.classList.add("on");
    });
    swatches.appendChild(sw);
  }
  accentRow.appendChild(swatches);
  controls.appendChild(accentRow);

  // actions
  const actions = document.createElement("div");
  actions.className = "wallpaper-actions";
  const status = document.createElement("p");
  status.className = "hint";

  if (window.__TAURI__) {
    const setBtn = document.createElement("button");
    setBtn.className = "action-btn";
    setBtn.textContent = "Set as desktop wallpaper";
    setBtn.addEventListener("click", async () => {
      setBtn.disabled = true;
      status.textContent = "Generating wallpaper…";
      try {
        const { base64 } = exportWallpaperPng();
        await window.__TAURI__!.core.invoke("set_wallpaper", { pngBase64: base64 });
        status.textContent = "Done — your desktop wallpaper is updated. 🎉";
      } catch (err) {
        status.textContent = `Couldn't set wallpaper: ${err}`;
      } finally {
        setBtn.disabled = false;
      }
    });
    actions.appendChild(setBtn);
  }

  const dlBtn = document.createElement("button");
  dlBtn.className = window.__TAURI__ ? "back-btn" : "action-btn";
  dlBtn.textContent = "Download image";
  dlBtn.addEventListener("click", () => {
    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement("canvas");
    renderWallpaper(canvas, {
      width: Math.round(window.screen.width * dpr),
      height: Math.round(window.screen.height * dpr),
      settings,
    });
    const link = document.createElement("a");
    link.download = "playwall-wallpaper.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    status.textContent = "Saved a PNG you can set as your wallpaper manually.";
  });
  actions.appendChild(dlBtn);

  controls.append(actions, status);
  wrap.appendChild(controls);
  app.appendChild(wrap);
}

function gameHeader(title: string, onBack: () => void): HTMLElement {
  const header = document.createElement("div");
  header.className = "game-header";

  const back = document.createElement("button");
  back.className = "back-btn";
  back.textContent = "← Back";
  back.addEventListener("click", onBack);

  const h2 = document.createElement("h2");
  h2.textContent = title;

  header.append(back, h2);
  return header;
}

/**
 * Inside the Tauri shell the window is frameless, so we render our own
 * titlebar: a drag region plus pin / minimize / close buttons.
 */
function mountTitlebar() {
  const tauri = window.__TAURI__;
  if (!tauri) return;
  const win = tauri.window.getCurrentWindow();

  const bar = document.createElement("div");
  bar.className = "titlebar";
  bar.setAttribute("data-tauri-drag-region", "");

  const title = document.createElement("span");
  title.className = "titlebar-name";
  title.setAttribute("data-tauri-drag-region", "");
  title.textContent = "PlayWall";

  const buttons = document.createElement("div");
  buttons.className = "titlebar-buttons";

  let pinned = false;
  const pin = document.createElement("button");
  pin.title = "Keep window on top";
  pin.textContent = "📌";
  pin.addEventListener("click", () => {
    pinned = !pinned;
    void win.setAlwaysOnTop(pinned);
    pin.classList.toggle("active", pinned);
  });

  const minimize = document.createElement("button");
  minimize.title = "Minimize";
  minimize.textContent = "—";
  minimize.addEventListener("click", () => void win.minimize());

  const close = document.createElement("button");
  close.title = "Hide to tray";
  close.textContent = "✕";
  close.addEventListener("click", () => void win.close());

  buttons.append(pin, minimize, close);
  bar.append(title, buttons);
  document.body.prepend(bar);
  document.body.classList.add("in-tauri");
}

/**
 * The desktop play icon. This page is loaded in its own tiny transparent
 * always-on-top Tauri window (label "icon"). The icon sits submerged — faint
 * and shrunk — and rises (brightens, scales up, gains a shadow) when the
 * cursor moves into the window. Clicking it opens the main game window.
 */
function renderIcon() {
  document.body.classList.add("icon-mode");
  app.innerHTML = "";

  // a transparent sensing area filling the window so the icon reacts as soon
  // as the cursor gets near it, not only when directly over the button
  const sense = document.createElement("div");
  sense.className = "icon-sense";

  const btn = document.createElement("button");
  btn.className = "floating-play";
  btn.textContent = "▶";
  btn.title = "Play games";
  btn.style.background = `linear-gradient(135deg, ${getSettings().accent}, #9b6bff)`;
  btn.addEventListener("click", () => {
    void window.__TAURI__?.core.invoke("show_main");
  });

  sense.appendChild(btn);
  app.appendChild(sense);
}

/** Entry: a #room=…&game=… link goes straight into the room. */
function route() {
  const match = location.hash.match(/room=([A-Z0-9]+)&game=(\w+)/i);
  if (match) {
    const game = games.find((g) => g.id === match[2]);
    if (game && game.modes.includes("online")) {
      showOnlineRoom(game, match[1].toUpperCase());
      return;
    }
  }
  showHub();
}

if (location.hash.includes("icon")) {
  renderIcon();
} else {
  mountTitlebar();
  route();
}
