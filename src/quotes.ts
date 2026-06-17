/**
 * Short, punchy motivational lines for the wallpaper. Kept deliberately terse
 * so they read well in big bold type (the "DO HARD THINGS" look). One is
 * chosen per calendar day, deterministically, so the wallpaper changes daily
 * but stays the same all day and matches on every render.
 */

export const QUOTES: string[] = [
  "Do hard things",
  "Discipline equals freedom",
  "Start before you're ready",
  "Be stronger than your excuses",
  "Dream big. Work harder",
  "One more rep",
  "Earn it",
  "Stay hungry",
  "No shortcuts",
  "Outwork yesterday",
  "Show up anyway",
  "Make it happen",
  "Win the morning",
  "Pain is temporary",
  "Keep going",
  "Prove it to yourself",
  "Done beats perfect",
  "Embrace the grind",
  "Trust the process",
  "Hard work pays off",
  "Focus on the work",
  "Be relentless",
  "Fall down. Get up",
  "Master the basics",
  "Less talk. More do",
  "Stay the course",
  "Choose discipline",
  "Build it daily",
  "Fear less. Do more",
  "Become unstoppable",
  "Your only limit is you",
  "Small steps. Big change",
  "Get comfortable being uncomfortable",
  "Consistency beats intensity",
  "Action cures fear",
  "Today, not someday",
];

/** Day-of-year (0-based, local time). */
function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

export function dailyQuoteIndex(date: Date = new Date()): number {
  return dayOfYear(date) % QUOTES.length;
}

export function dailyQuote(date: Date = new Date()): string {
  return QUOTES[dailyQuoteIndex(date)];
}
