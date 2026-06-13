import type { OptionType } from './types';

// Black–Scholes pricing with Greeks, plus a simple volatility smile so the
// option chain behaves like a real one (OTM wings priced richer than ATM).

const SQRT2PI = Math.sqrt(2 * Math.PI);

function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / SQRT2PI;
}

// Abramowitz–Stegun approximation of the standard normal CDF.
function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  let p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (x > 0) p = 1 - p;
  return p;
}

export interface Greeks {
  price: number;
  delta: number;
  gamma: number;
  theta: number; // per day
  vega: number; // per 1 vol point (0.01)
  iv: number;
}

export interface BSInput {
  spot: number;
  strike: number;
  /** Time to expiry in years. */
  t: number;
  /** Risk-free rate. */
  r: number;
  /** Volatility (annualized). */
  vol: number;
  type: OptionType;
}

export function blackScholes({ spot, strike, t, r, vol, type }: BSInput): Greeks {
  if (t <= 0 || vol <= 0) {
    const intrinsic = type === 'call' ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
    return {
      price: intrinsic,
      delta: type === 'call' ? (spot > strike ? 1 : 0) : spot < strike ? -1 : 0,
      gamma: 0,
      theta: 0,
      vega: 0,
      iv: vol,
    };
  }
  const sqrtT = Math.sqrt(t);
  const d1 = (Math.log(spot / strike) + (r + 0.5 * vol * vol) * t) / (vol * sqrtT);
  const d2 = d1 - vol * sqrtT;
  const nd1 = normCdf(d1);
  const nd2 = normCdf(d2);
  const disc = Math.exp(-r * t);
  let price: number;
  let delta: number;
  if (type === 'call') {
    price = spot * nd1 - strike * disc * nd2;
    delta = nd1;
  } else {
    price = strike * disc * normCdf(-d2) - spot * normCdf(-d1);
    delta = nd1 - 1;
  }
  const gamma = normPdf(d1) / (spot * vol * sqrtT);
  const vega = (spot * normPdf(d1) * sqrtT) / 100;
  const thetaYr =
    type === 'call'
      ? -(spot * normPdf(d1) * vol) / (2 * sqrtT) - r * strike * disc * nd2
      : -(spot * normPdf(d1) * vol) / (2 * sqrtT) + r * strike * disc * normCdf(-d2);
  return { price: Math.max(0, price), delta, gamma, theta: thetaYr / 365, vega, iv: vol };
}

/** Volatility smile: lift IV as the strike moves away from the money. */
export function smileIv(baseVol: number, spot: number, strike: number, t: number): number {
  const m = Math.log(strike / spot) / (baseVol * Math.sqrt(Math.max(t, 1 / 365)));
  const skew = -0.06 * m; // mild downside skew
  const curve = 0.08 * m * m;
  return Math.max(0.05, baseVol * (1 + skew + curve));
}

export interface ExpiryInfo {
  expiry: number; // epoch seconds at expiry close
  label: string;
  days: number;
}

/** Generate a ladder of expirations (weeklies then monthlies) from `now`. */
export function buildExpiries(now: number): ExpiryInfo[] {
  const out: ExpiryInfo[] = [];
  const dayOffsets = [7, 14, 21, 30, 45, 60, 90, 120, 180, 270, 365];
  for (const off of dayOffsets) {
    // Expiry at 21:00 UTC (session close) `off` days out.
    const base = Math.floor((now + off * 86400) / 86400) * 86400 + 21 * 3600;
    const days = Math.max(1, Math.round((base - now) / 86400));
    out.push({ expiry: base, days, label: labelFor(base) });
  }
  return out;
}

function labelFor(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit', timeZone: 'UTC' });
}

/** Strike ladder centered on spot, spacing scaled to price magnitude. */
export function buildStrikes(spot: number, count = 11): number[] {
  const step = strikeStep(spot);
  const atm = Math.round(spot / step) * step;
  const out: number[] = [];
  const half = Math.floor(count / 2);
  for (let i = -half; i <= half; i++) {
    const k = atm + i * step;
    if (k > 0) out.push(round(k, step));
  }
  return out;
}

function strikeStep(spot: number): number {
  if (spot >= 2000) return 50;
  if (spot >= 500) return 10;
  if (spot >= 100) return 5;
  if (spot >= 25) return 2.5;
  if (spot >= 5) return 1;
  if (spot >= 1) return 0.5;
  if (spot >= 0.1) return 0.05;
  return Math.max(0.000001, spot / 20);
}

function round(n: number, step: number): number {
  const dp = step < 1 ? Math.max(0, Math.ceil(-Math.log10(step))) : 2;
  return Math.round(n * 10 ** dp) / 10 ** dp;
}

export { strikeStep };
