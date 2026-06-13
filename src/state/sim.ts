import { MarketEngine } from '../engine/market';
import { realizedVol } from '../engine/indicators';
import {
  CONTRACT_MULTIPLIER,
  RISK_FREE_RATE,
  valuePortfolio,
  type Valuation,
} from '../engine/portfolio';
import { blackScholes, smileIv } from '../engine/options';
import type { OptionPosition } from '../engine/types';

type Listener = () => void;

const STOCK_MIN_PER_YEAR = 252 * 390;
const CRYPTO_MIN_PER_YEAR = 365 * 1440;

/**
 * Owns the live engine and the animation loop. Kept outside React so the
 * 60fps price flow never forces component re-renders it doesn't need; views
 * subscribe explicitly to the cadence they care about.
 */
class SimController {
  engine: MarketEngine | null = null;
  private listeners = new Set<Listener>();
  private raf = 0;
  private lastTs = 0;
  private acc = 0; // leftover sim-seconds not yet applied
  private valuation: Valuation | null = null;
  private ivCache = new Map<string, { iv: number; at: number }>();

  // Wired up by the store to avoid a hard import cycle at module load.
  hooks: {
    getPortfolio: () => import('../engine/types').Portfolio;
    getSpeed: () => number;
    onRollover: (now: number) => void;
    onEquityPoint: (time: number, value: number) => void;
  } | null = null;

  setEngine(engine: MarketEngine) {
    this.engine = engine;
    this.ivCache.clear();
    this.recompute();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  start() {
    if (this.raf) return;
    this.lastTs = performance.now();
    const loop = (ts: number) => {
      this.frame(ts);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private lastDay = '';
  private equityClock = 0;

  private frame(ts: number) {
    const eng = this.engine;
    if (!eng || !this.hooks) return;
    let dt = (ts - this.lastTs) / 1000;
    this.lastTs = ts;
    if (dt > 0.25) dt = 0.25; // ignore long stalls (tab was hidden)

    const speed = this.hooks.getSpeed(); // sim minutes per real second
    if (speed <= 0) {
      this.emit();
      return;
    }
    this.acc += dt * speed * 60; // sim seconds to advance
    const targetNow = eng.now + this.acc;
    const before = eng.now;
    eng.advanceTo(targetNow, 600);
    this.acc = Math.max(0, targetNow - eng.now);

    if (eng.now !== before) {
      // Day rollover → let the store reset day/year P/L baselines.
      const day = new Date(eng.now * 1000).toISOString().slice(0, 10);
      if (day !== this.lastDay) {
        this.lastDay = day;
        this.hooks.onRollover(eng.now);
      }
      // Sample the equity curve a few times per simulated hour.
      this.equityClock += eng.now - before;
      if (this.equityClock >= 900) {
        this.equityClock = 0;
        this.recompute();
        if (this.valuation) this.hooks.onEquityPoint(eng.now, this.valuation.equity);
      }
    }
    this.recompute();
    this.emit();
  }

  /** Current implied vol estimate for an underlying (regime-aware, cached). */
  ivFor(symbol: string): number {
    const eng = this.engine;
    if (!eng) return 0.3;
    const cached = this.ivCache.get(symbol);
    if (cached && eng.now - cached.at < 600) return cached.iv;
    const def = eng.def(symbol);
    const bars = eng.assets.get(symbol)?.bars ?? [];
    const perYear = def?.class === 'crypto' ? CRYPTO_MIN_PER_YEAR : STOCK_MIN_PER_YEAR;
    const rv = realizedVol(bars, 180, perYear);
    const base = def ? def.vol : 0.3;
    const iv = Math.max(0.05, 0.55 * base + 0.45 * rv);
    this.ivCache.set(symbol, { iv, at: eng.now });
    return iv;
  }

  optionPrice(pos: OptionPosition): number {
    const eng = this.engine;
    if (!eng) return pos.avgPremium;
    const spot = eng.price(pos.ref.symbol);
    const t = Math.max(0, (pos.ref.expiry - eng.now) / (365 * 86400));
    const iv = smileIv(this.ivFor(pos.ref.symbol), spot, pos.ref.strike, t);
    return blackScholes({ spot, strike: pos.ref.strike, t, r: RISK_FREE_RATE, vol: iv, type: pos.ref.type }).price;
  }

  recompute() {
    const eng = this.engine;
    if (!eng || !this.hooks) return;
    const pf = this.hooks.getPortfolio();
    this.valuation = valuePortfolio(
      pf,
      (sym) => eng.price(sym),
      (pos) => this.optionPrice(pos),
    );
  }

  getValuation(): Valuation | null {
    if (!this.valuation) this.recompute();
    return this.valuation;
  }
}

export const sim = new SimController();
export { CONTRACT_MULTIPLIER };

if (typeof window !== 'undefined') {
  (window as unknown as { __orion: SimController }).__orion = sim;
}
