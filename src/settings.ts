/**
 * User preferences for the wallpaper, persisted in localStorage.
 */

const KEY = "playwall.settings.v1";

export type WallpaperStyle = "motivation" | "infographic";

export interface WallpaperSettings {
  /** Which wallpaper look to render. */
  style: WallpaperStyle;
  /**
   * When true, the quote rotates daily and the app sets the wallpaper
   * automatically each day. When false, the user's own `quote` is used and
   * the wallpaper is only set manually.
   */
  autoDaily: boolean;
  /** Personal quote, used when autoDaily is off. */
  quote: string;
  // Infographic-only widgets:
  showClock: boolean;
  showStats: boolean;
  /** Accent color (hex) for the infographic style's highlights and glow. */
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
  style: "motivation",
  autoDaily: true,
  quote: "Do hard things",
  showClock: true,
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
