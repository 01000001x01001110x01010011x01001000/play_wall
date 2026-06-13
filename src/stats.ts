/**
 * Play stats, persisted in localStorage. These feed the wallpaper infographic
 * (last game played, matches, wins, time played) so the static wallpaper shows
 * real activity. Everything is local to this machine — no accounts, no sync.
 */

const KEY = "playwall.stats.v1";

/** Result of one finished game, from the local player's point of view. */
export type Outcome = "win" | "loss" | "draw" | "done";

export interface GameStat {
  plays: number;
  wins: number;
  losses: number;
  draws: number;
  /** Best score, for score-based games like snake. */
  best: number;
  /** Total time spent in this game, milliseconds. */
  totalMs: number;
  /** Last time this game was played, epoch ms. */
  lastPlayed: number;
}

export interface Stats {
  perGame: Record<string, GameStat>;
  /** id + name of the most recently played game. */
  lastGameId: string | null;
  lastGameName: string | null;
}

function emptyGameStat(): GameStat {
  return { plays: 0, wins: 0, losses: 0, draws: 0, best: 0, totalMs: 0, lastPlayed: 0 };
}

export function getStats(): Stats {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Stats;
  } catch {
    /* corrupt or unavailable — fall through to defaults */
  }
  return { perGame: {}, lastGameId: null, lastGameName: null };
}

function save(stats: Stats) {
  try {
    localStorage.setItem(KEY, JSON.stringify(stats));
  } catch {
    /* private mode / quota — stats are non-critical, ignore */
  }
}

function ensure(stats: Stats, gameId: string, gameName: string): GameStat {
  if (!stats.perGame[gameId]) stats.perGame[gameId] = emptyGameStat();
  stats.lastGameId = gameId;
  stats.lastGameName = gameName;
  return stats.perGame[gameId];
}

/** Record one finished match. Call exactly once per game-over. */
export function recordResult(gameId: string, gameName: string, outcome: Outcome) {
  const stats = getStats();
  const g = ensure(stats, gameId, gameName);
  g.plays++;
  if (outcome === "win") g.wins++;
  else if (outcome === "loss") g.losses++;
  else if (outcome === "draw") g.draws++;
  g.lastPlayed = Date.now();
  save(stats);
}

/** Record a score for score-based games (keeps the best). */
export function recordScore(gameId: string, gameName: string, score: number) {
  const stats = getStats();
  const g = ensure(stats, gameId, gameName);
  if (score > g.best) g.best = score;
  g.lastPlayed = Date.now();
  save(stats);
}

/** Add elapsed time to a game's total. Called by main.ts on screen exit. */
export function recordTime(gameId: string, gameName: string, ms: number) {
  if (ms < 1000) return; // ignore quick in-and-out
  const stats = getStats();
  const g = ensure(stats, gameId, gameName);
  g.totalMs += ms;
  save(stats);
}

/** Sum of plays across all games. */
export function totalPlays(stats: Stats): number {
  return Object.values(stats.perGame).reduce((n, g) => n + g.plays, 0);
}

/** Sum of time across all games, milliseconds. */
export function totalTimeMs(stats: Stats): number {
  return Object.values(stats.perGame).reduce((n, g) => n + g.totalMs, 0);
}

/** "2h 14m", "37m", "—" — compact human duration. */
export function formatDuration(ms: number): string {
  if (ms < 60_000) return ms < 1000 ? "—" : `${Math.round(ms / 1000)}s`;
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}
