# PlayWall

A desktop wallpaper app with built-in mini games — play solo, against the
computer, or (coming soon) with a friend over the internet via a shared room
link. Targets Windows and macOS.

## Roadmap

- [x] **Phase 1 — Games** (this code): Tic-Tac-Toe, Zeros & Ones, Snake, and
      Mini Chess (6×6 Los Alamos variant) playable in the browser.
- [x] **Phase 2 — Online play**: WebRTC peer-to-peer rooms via
      [Trystero](https://github.com/dmotz/trystero), shareable room links,
      no server required.
- [x] **Phase 3 — Desktop app**: Tauri 2 shell with a tray icon and a
      borderless popup game window.
- [~] **Phase 4 — Wallpaper layer**: infographic wallpaper renderer (clock,
      quote, play stats) with a settings/preview screen, a Rust command that
      sets it as the desktop wallpaper (**macOS done**; Windows pending), and a
      proximity-reveal desktop play icon (a transparent always-on-top window
      that stays submerged until the cursor nears it, then rises and opens the
      games). Remaining: embed the icon at true desktop level (below other
      windows) via native macOS window-level code.
- [ ] **Phase 5 — Polish**: desktop-level icon embedding, themes, launch at
      startup, Windows wallpaper glue.

## Development

```sh
npm install
npm run dev          # web version at http://localhost:5173
npm run build        # typecheck + production build into dist/
npm run tauri dev    # desktop app (requires Rust: https://rustup.rs)
npm run tauri build  # installable desktop bundle
```

> Note: `time` is pinned to 0.3.47 in src-tauri/Cargo.lock — 0.3.48 breaks
> the build with E0119 trait-conflict errors in `cookie`/`tauri-utils`.
> Don't `cargo update` it until those crates ship fixed releases.

## Code layout

- `src/main.ts` — hub screen, mode picker, game mounting/cleanup
- `src/types.ts` — the `GameModule` contract every game implements
- `src/games/` — one self-contained file per game

Turn-based games route every move through a single `applyMove()` function so
that phase 2 can feed remote moves through the same path.
