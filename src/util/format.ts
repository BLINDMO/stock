export function money(n: number, opts: { sign?: boolean; compact?: boolean } = {}): string {
  const sign = opts.sign && n > 0 ? '+' : '';
  if (opts.compact && Math.abs(n) >= 1000) {
    return sign + '$' + compact(n);
  }
  const abs = Math.abs(n);
  const dp = abs >= 1000 ? 2 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 8;
  return (
    (n < 0 ? '-' : sign) +
    '$' +
    Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dp >= 2 ? 2 : dp, maximumFractionDigits: dp })
  );
}

export function price(n: number): string {
  const abs = Math.abs(n);
  const dp = abs >= 1000 ? 2 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 8;
  return n.toLocaleString('en-US', { minimumFractionDigits: Math.min(dp, 2), maximumFractionDigits: dp });
}

export function pct(n: number, sign = true): string {
  const s = sign && n > 0 ? '+' : '';
  return s + n.toFixed(2) + '%';
}

export function compact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e12) return sign + (abs / 1e12).toFixed(2) + 'T';
  if (abs >= 1e9) return sign + (abs / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return sign + (abs / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return sign + (abs / 1e3).toFixed(2) + 'K';
  return sign + abs.toFixed(2);
}

export function qty(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString('en-US');
  return n.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

export function clock(epochSec: number): string {
  return new Date(epochSec * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });
}

export function timeOfDay(epochSec: number): string {
  return new Date(epochSec * 1000).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });
}
