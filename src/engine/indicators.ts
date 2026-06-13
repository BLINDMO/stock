import type { Candle } from './types';

export interface LinePoint {
  time: number;
  value: number;
}

export function sma(bars: Candle[], period: number): LinePoint[] {
  const out: LinePoint[] = [];
  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i].close;
    if (i >= period) sum -= bars[i - period].close;
    if (i >= period - 1) out.push({ time: bars[i].time, value: sum / period });
  }
  return out;
}

export function ema(bars: Candle[], period: number): LinePoint[] {
  const out: LinePoint[] = [];
  if (bars.length === 0) return out;
  const k = 2 / (period + 1);
  let prev = bars[0].close;
  for (let i = 0; i < bars.length; i++) {
    prev = i === 0 ? bars[i].close : bars[i].close * k + prev * (1 - k);
    if (i >= period - 1) out.push({ time: bars[i].time, value: prev });
  }
  return out;
}

function emaSeries(values: number[], period: number): number[] {
  const out: number[] = [];
  const k = 2 / (period + 1);
  let prev = values[0] ?? 0;
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[i] : values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function rsi(bars: Candle[], period = 14): LinePoint[] {
  const out: LinePoint[] = [];
  if (bars.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = bars[i].close - bars[i - 1].close;
    if (ch >= 0) gain += ch;
    else loss -= ch;
  }
  gain /= period;
  loss /= period;
  out.push({ time: bars[period].time, value: 100 - 100 / (1 + gain / (loss || 1e-9)) });
  for (let i = period + 1; i < bars.length; i++) {
    const ch = bars[i].close - bars[i - 1].close;
    const g = ch > 0 ? ch : 0;
    const l = ch < 0 ? -ch : 0;
    gain = (gain * (period - 1) + g) / period;
    loss = (loss * (period - 1) + l) / period;
    out.push({ time: bars[i].time, value: 100 - 100 / (1 + gain / (loss || 1e-9)) });
  }
  return out;
}

export interface MacdResult {
  macd: LinePoint[];
  signal: LinePoint[];
  hist: LinePoint[];
}

export function macd(bars: Candle[], fast = 12, slow = 26, sig = 9): MacdResult {
  if (bars.length < slow) return { macd: [], signal: [], hist: [] };
  const closes = bars.map((b) => b.close);
  const ef = emaSeries(closes, fast);
  const es = emaSeries(closes, slow);
  const macdLine = closes.map((_, i) => ef[i] - es[i]);
  const signalLine = emaSeries(macdLine, sig);
  const macdPts: LinePoint[] = [];
  const sigPts: LinePoint[] = [];
  const histPts: LinePoint[] = [];
  for (let i = slow - 1; i < bars.length; i++) {
    macdPts.push({ time: bars[i].time, value: macdLine[i] });
    sigPts.push({ time: bars[i].time, value: signalLine[i] });
    histPts.push({ time: bars[i].time, value: macdLine[i] - signalLine[i] });
  }
  return { macd: macdPts, signal: sigPts, hist: histPts };
}

export interface BollingerResult {
  upper: LinePoint[];
  middle: LinePoint[];
  lower: LinePoint[];
}

export function bollinger(bars: Candle[], period = 20, mult = 2): BollingerResult {
  const upper: LinePoint[] = [];
  const middle: LinePoint[] = [];
  const lower: LinePoint[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += bars[j].close;
    const mean = sum / period;
    let varc = 0;
    for (let j = i - period + 1; j <= i; j++) varc += (bars[j].close - mean) ** 2;
    const sd = Math.sqrt(varc / period);
    middle.push({ time: bars[i].time, value: mean });
    upper.push({ time: bars[i].time, value: mean + mult * sd });
    lower.push({ time: bars[i].time, value: mean - mult * sd });
  }
  return { upper, middle, lower };
}

export function vwap(bars: Candle[]): LinePoint[] {
  // Session VWAP — resets at each UTC day boundary.
  const out: LinePoint[] = [];
  let cumPV = 0;
  let cumV = 0;
  let day = -1;
  for (const b of bars) {
    const d = Math.floor(b.time / 86400);
    if (d !== day) {
      day = d;
      cumPV = 0;
      cumV = 0;
    }
    const typical = (b.high + b.low + b.close) / 3;
    cumPV += typical * b.volume;
    cumV += b.volume;
    out.push({ time: b.time, value: cumV > 0 ? cumPV / cumV : typical });
  }
  return out;
}

/** Annualized realized volatility from recent log returns — feeds option IV. */
export function realizedVol(bars: Candle[], lookback = 120, perYear = 98280): number {
  const n = Math.min(lookback, bars.length - 1);
  if (n < 5) return 0.3;
  const rets: number[] = [];
  for (let i = bars.length - n; i < bars.length; i++) {
    rets.push(Math.log(bars[i].close / bars[i - 1].close));
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const varc = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
  return Math.sqrt(varc * perYear);
}
