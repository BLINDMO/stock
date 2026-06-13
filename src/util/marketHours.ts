// US equity cash session in UTC (DST ignored): Mon–Fri 14:30–21:00.
const OPEN_MIN = 14 * 60 + 30;
const CLOSE_MIN = 21 * 60;

export function isStockOpen(epochSec: number): boolean {
  const d = new Date(epochSec * 1000);
  const dow = d.getUTCDay();
  const m = d.getUTCHours() * 60 + d.getUTCMinutes();
  return dow >= 1 && dow <= 5 && m >= OPEN_MIN && m < CLOSE_MIN;
}

/** Epoch seconds of the next session open at/after `epochSec`. */
export function nextStockOpen(epochSec: number): number {
  const d = new Date(epochSec * 1000);
  for (let i = 0; i < 8; i++) {
    const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + i, 14, 30, 0));
    const dow = day.getUTCDay();
    if (dow >= 1 && dow <= 5 && day.getTime() / 1000 > epochSec) {
      return Math.floor(day.getTime() / 1000);
    }
  }
  return epochSec;
}

export function nextOpenLabel(epochSec: number): string {
  const open = nextStockOpen(epochSec);
  const d = new Date(open * 1000);
  return d.toLocaleString('en-US', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }) + ' UTC';
}
