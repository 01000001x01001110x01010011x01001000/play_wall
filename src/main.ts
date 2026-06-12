import "./style.css";
import { games } from "./games";
import { connect, generateRoomCode } from "./net";
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
  header.innerHTML = `<span class="hub-title">PlayWall</span>`;
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
  activeCleanup = game.mount(stage, mode);
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

    const gameCleanup = game.mount(stage, "online", net);
    activeCleanup = () => {
      gameCleanup();
      net.leave();
    };
  });
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

route();
