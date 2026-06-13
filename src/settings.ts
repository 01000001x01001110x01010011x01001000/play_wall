/**
 * User preferences for the wallpaper infographic, persisted in localStorage.
 */

const KEY = "playwall.settings.v1";

export interface WallpaperSettings {
  /** Personal quote shown on the wallpaper. */
  quote: string;
  showClock: boolean;
  showQuote: boolean;
  showStats: boolean;
  /** Accent color (hex) used for highlights and the glow. */
  accent: string;
}

export const ACCENT_PRESETS = [
  { name: "Blue", value: "#4f8cff" },
  { name: "Violet", value: "#9b6bff" },
  { name: "Green", value: "#3ddc84" },
  { name: "Amber", value: "#ffb454" },
  { name: "Pink", value: "#ff5e8a" },
];

const DEFAULTS: WallpaperSettings = {
  quote: "One more game.",
  showClock: true,
  showQuote: true,
  showStats: true,
  accent: "#4f8cff",
};

export function getSettings(): WallpaperSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<WallpaperSettings>) };
  } catch {
    /* fall through to defaults */
  }
  return { ...DEFAULTS };
}

export function saveSettings(settings: WallpaperSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}
