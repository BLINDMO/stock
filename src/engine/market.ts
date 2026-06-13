import type { AssetDef, AssetState, Candle } from './types';
import { RNG, hashSeed } from './rng';

// ---------------------------------------------------------------------------
// The market simulation.
//
// Prices follow a factor model: a broad-market factor drives correlated moves,
// each instrument adds beta-weighted exposure plus its own idiosyncratic noise,
// and volatility itself wanders (clustering) with occasional jumps for "news".
// There is no target outcome — only a stochastic process the trader acts within.
// ---------------------------------------------------------------------------

const MINUTE = 60;
const MAX_MIN_BARS = 2200; // ~5.6 trading days of 1m bars
const MAX_DAILY_BARS = 2600; // ~10 years of daily bars

// Annualization. Stocks use the trading-session calendar, crypto the full year.
const STOCK_MIN_PER_YEAR = 252 * 390;
const CRYPTO_MIN_PER_YEAR = 365 * 1440;

// Stock session in UTC (approx US cash session, DST ignored): 14:30–21:00.
const SESSION_OPEN = 14 * 60 + 30;
const SESSION_CLOSE = 21 * 60;

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1D' | '1W';

export interface EngineSnapshot {
  seed: number;
  now: number;
  rngState: number;
  eqVol: number;
  cryptoVol: number;
  lastYear?: number;
  assets: {
    symbol: string;
    price: number;
    prevClose: number;
    dayOpen: number;
    yearOpen: number;
    lastSession: string;
    dailyBars: Candle[];
  }[];
}

interface TimeFields {
  dow: number;
  minOfDay: number;
  date: string;
  year: number;
}

function fields(epochSec: number): TimeFields {
  const d = new Date(epochSec * 1000);
  const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
  return {
    dow: d.getUTCDay(),
    minOfDay: d.getUTCHours() * 60 + d.getUTCMinutes(),
    date,
    year: d.getUTCFullYear(),
  };
}

function stockOpen(f: TimeFields): boolean {
  return f.dow >= 1 && f.dow <= 5 && f.minOfDay >= SESSION_OPEN && f.minOfDay < SESSION_CLOSE;
}

export class MarketEngine {
  rng: RNG;
  now: number;
  assets = new Map<string, AssetState>();
  private defs = new Map<string, AssetDef>();

  // Time-varying factor volatilities (annualized) — mean-reverting regimes.
  private eqVol = 0.16;
  private cryptoVol = 0.7;
  private volMult: number;
  private driftMult: number;

  constructor(seed: number, defs: AssetDef[], startNow: number, volMult = 1, driftMult = 1) {
    this.rng = new RNG(seed);
    this.now = startNow;
    this.volMult = volMult;
    this.driftMult = driftMult;
    for (const def of defs) {
      this.defs.set(def.symbol, def);
      const f = fields(startNow);
      this.assets.set(def.symbol, {
        symbol: def.symbol,
        price: def.seedPrice,
        prevClose: def.seedPrice,
        bars: [],
        dailyBars: [],
        dayOpen: def.seedPrice,
        yearOpen: def.seedPrice,
        dayAccum: null,
        baseVol: Math.max(50, def.supply / 50000),
        lastSession: f.date,
      });
    }
  }

  def(symbol: string): AssetDef | undefined {
    return this.defs.get(symbol);
  }

  setRisk(volMult: number, driftMult: number): void {
    this.volMult = volMult;
    this.driftMult = driftMult;
  }

  price(symbol: string): number {
    return this.assets.get(symbol)?.price ?? 0;
  }

  /**
   * Build deep history before play begins: coarse daily bars reaching back
   * `days`, then fine 1-minute bars for the most recent couple of sessions, so
   * every chart already looks like an established, liquid market.
   */
  backfill(days: number): void {
    const target = this.now;
    // Rewind to the start of history and replay forward deterministically.
    this.now = target - days * 86400;
    // Coarse daily replay up to ~2 days before target.
    const dailyUntil = target - 2 * 86400;
    let guard = 0;
    while (this.now < dailyUntil && guard++ < days + 10) {
      this.dailyStep();
      this.now += 86400;
    }
    // Fine minute replay for the recent window up to "now".
    guard = 0;
    while (this.now < target && guard++ < 3 * 1440 + 10) {
      this.minuteStep();
      this.now += MINUTE;
    }
    this.now = target;
  }

  /** Advance simulation to `targetNow`, capped at `maxBars` minute steps. */
  advanceTo(targetNow: number, maxBars: number): boolean {
    let changed = false;
    let made = 0;
    while (this.now + MINUTE <= targetNow && made < maxBars) {
      this.minuteStep();
      this.now += MINUTE;
      made++;
      changed = true;
    }
    // If we hit the cap, snap clock forward so wall-time doesn't run away.
    if (made >= maxBars && this.now + MINUTE <= targetNow) {
      // keep the remaining time for next frame by not skipping
    }
    return changed;
  }

  // --- regime evolution -----------------------------------------------------

  private evolveRegimes(dtYears: number): void {
    // Ornstein–Uhlenbeck-style mean reversion on log-vol with shocks.
    const revert = (v: number, mean: number, speed: number, shockStd: number) => {
      const ln = Math.log(v);
      const next = ln + speed * (Math.log(mean) - ln) * dtYears + shockStd * this.rng.normal(0, Math.sqrt(dtYears));
      return Math.min(Math.max(Math.exp(next), 0.06), 2.5);
    };
    this.eqVol = revert(this.eqVol, 0.16, 4, 1.4);
    this.cryptoVol = revert(this.cryptoVol, 0.7, 3, 1.6);
  }

  // --- minute step ----------------------------------------------------------

  private minuteStep(): void {
    const f = fields(this.now);
    const stocksLive = stockOpen(f);
    const dtStock = 1 / STOCK_MIN_PER_YEAR;
    const dtCrypto = 1 / CRYPTO_MIN_PER_YEAR;

    this.evolveRegimes(dtCrypto);

    // Factor returns for this minute.
    const eqFactor = stocksLive
      ? this.rng.normal(0.02 * dtStock, this.eqVol * this.volMult * Math.sqrt(dtStock))
      : 0;
    // Crypto factor carries a touch of the equity factor (risk-on/off spillover).
    const cryptoFactor =
      this.rng.normal(0.05 * dtCrypto, this.cryptoVol * this.volMult * Math.sqrt(dtCrypto)) +
      0.25 * eqFactor;

    for (const def of this.defs.values()) {
      const st = this.assets.get(def.symbol)!;
      const isStock = def.class === 'stock';
      if (isStock && !stocksLive) {
        // Market closed: no trading. (Gaps appear at next open.)
        continue;
      }
      const dt = isStock ? dtStock : dtCrypto;
      const factor = isStock ? eqFactor : cryptoFactor;
      const idioStd = def.vol * this.volMult * Math.sqrt(dt);
      let ret = def.drift * this.driftMult * dt + def.beta * factor + this.rng.normal(0, idioStd);

      // Rare jumps (earnings, headlines): ~0.05% of minutes, fat-tailed.
      if (this.rng.next() < 0.0005) {
        ret += this.rng.normal(0, def.vol * 0.6) * (this.rng.next() < 0.5 ? 1 : -1) * 0.15;
      }

      const open = st.price;
      let close = open * Math.exp(ret);
      if (close <= 0) close = open * 0.5;

      // Intrabar wick from a few sub-ticks for a realistic high/low.
      const wick = Math.abs(ret) + idioStd * 1.2;
      const hi = Math.max(open, close) * (1 + Math.abs(this.rng.normal(0, wick * 0.6)));
      const lo = Math.min(open, close) * (1 - Math.abs(this.rng.normal(0, wick * 0.6)));

      // Volume: U-shaped intraday for stocks, activity-scaled by move size.
      let vScale = 1 + Math.abs(ret) / (idioStd + 1e-9) * 0.4;
      if (isStock) {
        const x = (f.minOfDay - SESSION_OPEN) / (SESSION_CLOSE - SESSION_OPEN);
        vScale *= 0.6 + 1.6 * (Math.pow(x - 0.5, 2) * 2.2 + 0.25);
      }
      const volume = Math.max(1, st.baseVol * vScale * this.rng.range(0.7, 1.3));

      const bar: Candle = {
        time: this.now,
        open: round(open),
        high: round(hi),
        low: round(lo),
        close: round(close),
        volume: Math.round(volume),
      };
      st.price = bar.close;
      this.pushMinute(st, bar);
      this.accumDay(st, bar, f);
    }

    this.rolloverDates(f);
  }

  // Coarse one-bar-per-day step for deep backfill.
  private dailyStep(): void {
    const f = fields(this.now);
    if (f.dow === 0 || f.dow === 6) return; // skip weekends for the daily series
    const dtStock = 1 / 252;
    const dtCrypto = 1 / 365;
    this.evolveRegimes(dtStock);
    const eqFactor = this.rng.normal(0.02 * dtStock, this.eqVol * this.volMult * Math.sqrt(dtStock));
    const cryptoFactor =
      this.rng.normal(0.05 * dtCrypto, this.cryptoVol * this.volMult * Math.sqrt(dtCrypto)) +
      0.25 * eqFactor;

    for (const def of this.defs.values()) {
      const st = this.assets.get(def.symbol)!;
      const isStock = def.class === 'stock';
      const dt = isStock ? dtStock : dtCrypto;
      const factor = isStock ? eqFactor : cryptoFactor;
      const idioStd = def.vol * this.volMult * Math.sqrt(dt);
      let ret = def.drift * this.driftMult * dt + def.beta * factor + this.rng.normal(0, idioStd);
      if (this.rng.next() < 0.02) ret += this.rng.normal(0, def.vol * 0.1) * (this.rng.next() < 0.5 ? 1 : -1);
      const open = st.price;
      let close = open * Math.exp(ret);
      if (close <= 0) close = open * 0.5;
      const hi = Math.max(open, close) * (1 + Math.abs(this.rng.normal(0, idioStd)));
      const lo = Math.min(open, close) * (1 - Math.abs(this.rng.normal(0, idioStd)));
      st.price = round(close);
      const bar: Candle = {
        time: dayStart(this.now),
        open: round(open),
        high: round(hi),
        low: round(lo),
        close: round(close),
        volume: Math.round(st.baseVol * 390 * this.rng.range(0.6, 1.4)),
      };
      st.dailyBars.push(bar);
      if (st.dailyBars.length > MAX_DAILY_BARS) st.dailyBars.shift();
      st.dayOpen = bar.open;
    }
  }

  private pushMinute(st: AssetState, bar: Candle): void {
    st.bars.push(bar);
    if (st.bars.length > MAX_MIN_BARS) st.bars.shift();
  }

  private accumDay(st: AssetState, bar: Candle, f: TimeFields): void {
    if (!st.dayAccum || st.dayAccum.date !== f.date) {
      // Finalize previous day's candle.
      if (st.dayAccum) {
        st.dailyBars.push({
          time: dayStartFromDate(st.dayAccum.date),
          open: st.dayAccum.open,
          high: st.dayAccum.high,
          low: st.dayAccum.low,
          close: st.prevCloseForDay ?? bar.open,
          volume: Math.round(st.dayAccum.volume),
        });
        if (st.dailyBars.length > MAX_DAILY_BARS) st.dailyBars.shift();
      }
      st.dayAccum = { date: f.date, open: bar.open, high: bar.high, low: bar.low, volume: bar.volume };
    } else {
      st.dayAccum.high = Math.max(st.dayAccum.high, bar.high);
      st.dayAccum.low = Math.min(st.dayAccum.low, bar.low);
      st.dayAccum.volume += bar.volume;
    }
    st.prevCloseForDay = bar.close;
  }

  private rolloverDates(f: TimeFields): void {
    for (const st of this.assets.values()) {
      if (st.lastSession !== f.date) {
        st.prevClose = st.price;
        st.dayOpen = st.price;
        st.lastSession = f.date;
      }
    }
    // Year rollover for YTD-style references.
    const y = f.year;
    if (this._lastYear === undefined) this._lastYear = y;
    if (y !== this._lastYear) {
      for (const st of this.assets.values()) st.yearOpen = st.price;
      this._lastYear = y;
    }
  }
  private _lastYear?: number;

  // --- persistence & cosmetic history --------------------------------------

  snapshot(): EngineSnapshot {
    return {
      seed: this.rng.state, // current rng position (seed field reused as state)
      now: this.now,
      rngState: this.rng.state,
      eqVol: this.eqVol,
      cryptoVol: this.cryptoVol,
      lastYear: this._lastYear,
      assets: [...this.assets.values()].map((s) => ({
        symbol: s.symbol,
        price: s.price,
        prevClose: s.prevClose,
        dayOpen: s.dayOpen,
        yearOpen: s.yearOpen,
        lastSession: s.lastSession,
        dailyBars: s.dailyBars.slice(-320),
      })),
    };
  }

  static restore(
    snap: EngineSnapshot,
    defs: AssetDef[],
    volMult: number,
    driftMult: number,
  ): MarketEngine {
    const eng = new MarketEngine(0, defs, snap.now, volMult, driftMult);
    eng.rng.state = snap.rngState;
    eng.now = snap.now;
    eng.eqVol = snap.eqVol;
    eng.cryptoVol = snap.cryptoVol;
    eng._lastYear = snap.lastYear;
    for (const a of snap.assets) {
      const st = eng.assets.get(a.symbol);
      if (!st) continue;
      st.price = a.price;
      st.prevClose = a.prevClose;
      st.dayOpen = a.dayOpen;
      st.yearOpen = a.yearOpen;
      st.lastSession = a.lastSession;
      st.dailyBars = a.dailyBars;
    }
    eng.synthRecentMinutes(420);
    return eng;
  }

  /**
   * Rebuild a plausible recent 1-minute window for every asset (used after a
   * reload, where storing every intraday bar would be wasteful). Uses a
   * throwaway RNG so the live forward sequence is never disturbed.
   */
  synthRecentMinutes(count: number): void {
    const tmp = new RNG(hashSeed('synth:' + this.now));
    for (const def of this.defs.values()) {
      const st = this.assets.get(def.symbol)!;
      const dt = def.class === 'stock' ? 1 / STOCK_MIN_PER_YEAR : 1 / CRYPTO_MIN_PER_YEAR;
      const std = def.vol * this.volMult * Math.sqrt(dt);
      // Walk backward from the current price to synthesize closes.
      const closes: number[] = new Array(count);
      let p = st.price;
      for (let i = count - 1; i >= 0; i--) {
        closes[i] = p;
        p = p / Math.exp(tmp.normal(0, std));
      }
      const bars: Candle[] = [];
      for (let i = 0; i < count; i++) {
        const open = i === 0 ? closes[0] / Math.exp(tmp.normal(0, std)) : closes[i - 1];
        const close = closes[i];
        const wick = std * 1.5;
        bars.push({
          time: this.now - (count - i) * MINUTE,
          open: round(open),
          high: round(Math.max(open, close) * (1 + Math.abs(tmp.normal(0, wick)))),
          low: round(Math.min(open, close) * (1 - Math.abs(tmp.normal(0, wick)))),
          close: round(close),
          volume: Math.round(st.baseVol * tmp.range(0.7, 1.3)),
        });
      }
      st.bars = bars;
    }
  }

  // --- chart data -----------------------------------------------------------

  getBars(symbol: string, tf: Timeframe): Candle[] {
    const st = this.assets.get(symbol);
    if (!st) return [];
    if (tf === '1D' || tf === '1W') {
      const daily = st.dailyBars;
      if (tf === '1D') return daily;
      return aggregate(daily, 7 * 86400); // weekly buckets
    }
    const mins: Record<string, number> = { '1m': 1, '5m': 5, '15m': 15, '1h': 60, '4h': 240 };
    const span = mins[tf] * MINUTE;
    if (tf === '1m') return st.bars;
    return aggregate(st.bars, span);
  }
}

// Extra runtime field declared loosely to avoid widening the persisted type.
declare module './types' {
  interface AssetState {
    prevCloseForDay?: number;
  }
}

function aggregate(bars: Candle[], spanSec: number): Candle[] {
  if (bars.length === 0) return [];
  const out: Candle[] = [];
  let cur: Candle | null = null;
  let bucket = -1;
  for (const b of bars) {
    const bk = Math.floor(b.time / spanSec);
    if (bk !== bucket) {
      if (cur) out.push(cur);
      bucket = bk;
      cur = { time: bk * spanSec, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume };
    } else if (cur) {
      cur.high = Math.max(cur.high, b.high);
      cur.low = Math.min(cur.low, b.low);
      cur.close = b.close;
      cur.volume += b.volume;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function dayStart(epochSec: number): number {
  return Math.floor(epochSec / 86400) * 86400;
}
function dayStartFromDate(date: string): number {
  return Math.floor(Date.parse(date + 'T00:00:00Z') / 1000);
}
function round(n: number): number {
  if (n >= 1000) return Math.round(n * 100) / 100;
  if (n >= 1) return Math.round(n * 1000) / 1000;
  return Math.round(n * 1e8) / 1e8;
}
