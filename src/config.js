// Everything tunable lives here.

export const CURRENCY = "Yap++ Bucks";
export const SYMBOL = "YB";

export const STARTING_WALLET = 10;

export const DAILY_AMOUNT = 25;
export const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const WORK_MIN = 1;
export const WORK_MAX = 5;
export const WORK_COOLDOWN_MS = 60 * 60 * 1000;

export const LEADERBOARD_SIZE = 10;

// 1 Yap++ Buck = 1,000,000 USD
export const USD_PER_YB = 1_000_000;

export function fmt(n) {
  return `${n.toLocaleString("en-US")} ${SYMBOL}`;
}

export function fmtDuration(ms) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s && !h) parts.push(`${s}s`);
  return parts.join(" ") || "0s";
}
