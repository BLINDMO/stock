import { create } from 'zustand';
import { MarketEngine, type Timeframe } from '../engine/market';
import { assetsForClasses, ASSET_MAP } from '../engine/assets';
import { hashSeed } from '../engine/rng';
import {
  applyOptionFill,
  applyStockFill,
  CONTRACT_MULTIPLIER,
  findStock,
} from '../engine/portfolio';
import type {
  HudConfig,
  LinkedBank,
  OptionContractRef,
  Portfolio,
  RiskProfile,
  Settings,
  Trade,
  WorldMeta,
} from '../engine/types';
import { sim } from './sim';
import { clearGame, loadGame, saveGame } from './persistence';
import { money } from '../util/format';
import { isStockOpen } from '../util/marketHours';

export const RISK_PROFILES: Record<RiskProfile['key'], RiskProfile> = {
  conservative: { key: 'conservative', label: 'Steady', volMult: 0.7, driftMult: 1.05 },
  balanced: { key: 'balanced', label: 'Balanced', volMult: 1.0, driftMult: 1.0 },
  aggressive: { key: 'aggressive', label: 'High Octane', volMult: 1.5, driftMult: 0.95 },
};

export const SPEED_PRESETS = [
  { label: 'Live', value: 1 },
  { label: '5×', value: 5 },
  { label: '30×', value: 30 },
  { label: '2h/s', value: 120 },
  { label: '12h/s', value: 720 },
];

export interface OnboardingConfig {
  trader: string;
  startingCash: number;
  risk: RiskProfile['key'];
  theme: Settings['theme'];
  enabledClasses: { stock: boolean; crypto: boolean };
  commissionFree: boolean;
  defaultTimeframe: Timeframe;
}

export const ALL_INDICATORS = ['MA20', 'MA50', 'EMA9', 'BOLL', 'VWAP', 'VOL', 'RSI', 'MACD'] as const;
export type IndicatorKey = (typeof ALL_INDICATORS)[number];

function defaultHud(): HudConfig {
  return {
    show: true,
    position: 'tr',
    balance: true,
    openTrades: true,
    optionsHeld: true,
    dayPnl: true,
    ytdPnl: true,
    buyingPower: true,
  };
}

function defaultSettings(cfg: OnboardingConfig): Settings {
  return {
    trader: cfg.trader || 'Trader',
    theme: cfg.theme,
    risk: cfg.risk,
    commissionPerTrade: cfg.commissionFree ? 0 : 4.95,
    optionCommission: cfg.commissionFree ? 0 : 0.65,
    spreadBps: 4,
    hud: defaultHud(),
    enabledClasses: cfg.enabledClasses,
    defaultTimeframe: cfg.defaultTimeframe,
    speed: 5,
    linkedBank: null,
  };
}

interface AppState {
  phase: 'onboarding' | 'trading';
  meta: WorldMeta | null;
  settings: Settings;
  portfolio: Portfolio;
  symbol: string;
  timeframe: Timeframe;
  indicators: IndicatorKey[];
  tick: number; // bumped on structural changes (trades, settings) to refresh React
  toast: string | null;

  startWorld: (cfg: OnboardingConfig) => void;
  resume: () => boolean;
  restart: () => void;
  setSettings: (patch: Partial<Settings>) => void;
  setHud: (patch: Partial<HudConfig>) => void;
  setSpeed: (v: number) => void;
  setSymbol: (s: string) => void;
  setTimeframe: (t: Timeframe) => void;
  toggleIndicator: (k: IndicatorKey) => void;
  placeStockOrder: (symbol: string, side: 'buy' | 'sell', qty: number) => string | null;
  tradeOption: (ref: OptionContractRef, side: 'buy' | 'sell', qty: number) => string | null;
  closeOption: (id: string) => void;
  deposit: (amount: number) => string | null;
  withdraw: (amount: number, bank: LinkedBank) => string | null;
  showToast: (msg: string) => void;
  saveNow: () => void;
}

function freshPortfolio(startingCash: number, now: number): Portfolio {
  return {
    cash: startingCash,
    startingCash,
    netDeposits: startingCash,
    stocks: [],
    options: [],
    trades: [],
    realizedPnl: 0,
    dayStartEquity: startingCash,
    daySession: new Date(now * 1000).toISOString().slice(0, 10),
    yearStartEquity: startingCash,
    yearSession: new Date(now * 1000).getUTCFullYear(),
    equityCurve: [{ time: now, value: startingCash }],
  };
}

function nowEpoch(): number {
  return Math.floor(Date.now() / 1000);
}

function mkTrade(t: Omit<Trade, 'id'>): Trade {
  return { ...t, id: Math.random().toString(36).slice(2, 10) };
}

export const useStore = create<AppState>((set, get) => {
  // Wire the simulation controller to this store.
  sim.hooks = {
    getPortfolio: () => get().portfolio,
    getSpeed: () => (get().phase === 'trading' ? get().settings.speed : 0),
    onRollover: (now: number) => {
      const eng = sim.engine;
      if (!eng) return;
      settleExpiredOptions(get, set);
      const pf = get().portfolio;
      const val = sim.getValuation();
      const equity = val ? val.equity : pf.cash;
      const day = new Date(now * 1000).toISOString().slice(0, 10);
      const year = new Date(now * 1000).getUTCFullYear();
      const next: Portfolio = { ...pf };
      if (day !== pf.daySession) {
        next.daySession = day;
        next.dayStartEquity = equity;
      }
      if (year !== pf.yearSession) {
        next.yearSession = year;
        next.yearStartEquity = equity;
      }
      set({ portfolio: next, meta: { ...get().meta!, now } });
    },
    onEquityPoint: (time: number, value: number) => {
      const pf = get().portfolio;
      const curve = pf.equityCurve.length > 4000 ? pf.equityCurve.slice(-3000) : pf.equityCurve;
      set({ portfolio: { ...pf, equityCurve: [...curve, { time, value }] } });
    },
  };

  return {
    phase: 'onboarding',
    meta: null,
    settings: defaultSettings({
      trader: 'Trader',
      startingCash: 10000,
      risk: 'balanced',
      theme: 'dark',
      enabledClasses: { stock: true, crypto: true },
      commissionFree: true,
      defaultTimeframe: '5m',
    }),
    portfolio: freshPortfolio(10000, nowEpoch()),
    symbol: 'AAPL',
    timeframe: '5m',
    indicators: ['MA20', 'MA50', 'VOL'],
    tick: 0,
    toast: null,

    startWorld: (cfg) => {
      const now = nowEpoch();
      const seed = hashSeed(cfg.trader + ':' + now + ':' + Math.random());
      const settings = defaultSettings(cfg);
      const risk = RISK_PROFILES[cfg.risk];
      const defs = assetsForClasses(cfg.enabledClasses);
      const engine = new MarketEngine(seed, defs, now, risk.volMult, risk.driftMult);
      engine.backfill(730);
      sim.setEngine(engine);
      const portfolio = freshPortfolio(cfg.startingCash, now);
      const firstSymbol = defs[0]?.symbol ?? 'AAPL';
      const meta: WorldMeta = { seed, now: engine.now, genesis: now, createdAt: Date.now() };
      // Open on a market that's actually moving: if equities are closed at
      // launch (nights/weekends) and crypto is on, start on a live coin so the
      // first chart isn't a flat line.
      const stocksLive = isStockOpen(engine.now);
      const defaultSymbol =
        cfg.enabledClasses.stock && stocksLive
          ? 'AAPL'
          : cfg.enabledClasses.crypto
            ? 'BTC'
            : cfg.enabledClasses.stock
              ? 'AAPL'
              : firstSymbol;
      set({
        phase: 'trading',
        meta,
        settings,
        portfolio,
        symbol: defaultSymbol,
        timeframe: cfg.defaultTimeframe,
        tick: get().tick + 1,
      });
      sim.recompute();
      sim.start();
      get().saveNow();
    },

    resume: () => {
      const data = loadGame();
      if (!data) return false;
      const risk = RISK_PROFILES[data.settings.risk];
      const defs = assetsForClasses(data.settings.enabledClasses);
      const engine = MarketEngine.restore(data.engine, defs, risk.volMult, risk.driftMult);
      sim.setEngine(engine);
      // Migrate saves made before banking / net-deposit tracking existed.
      const portfolio: Portfolio = {
        ...data.portfolio,
        netDeposits: data.portfolio.netDeposits ?? data.portfolio.startingCash,
      };
      const settings: Settings = { ...data.settings, linkedBank: data.settings.linkedBank ?? null };
      set({
        phase: 'trading',
        meta: data.meta,
        settings,
        portfolio,
        symbol: data.ui.symbol,
        timeframe: data.ui.timeframe as Timeframe,
        indicators: data.ui.indicators as IndicatorKey[],
        tick: get().tick + 1,
      });
      settleExpiredOptions(get, set);
      sim.recompute();
      sim.start();
      return true;
    },

    restart: () => {
      sim.stop();
      clearGame();
      set({
        phase: 'onboarding',
        meta: null,
        portfolio: freshPortfolio(10000, nowEpoch()),
        tick: get().tick + 1,
      });
    },

    setSettings: (patch) => {
      set({ settings: { ...get().settings, ...patch }, tick: get().tick + 1 });
      get().saveNow();
    },
    setHud: (patch) => {
      const s = get().settings;
      set({ settings: { ...s, hud: { ...s.hud, ...patch } }, tick: get().tick + 1 });
      get().saveNow();
    },
    setSpeed: (v) => set({ settings: { ...get().settings, speed: v }, tick: get().tick + 1 }),
    setSymbol: (s) => set({ symbol: s }),
    setTimeframe: (t) => set({ timeframe: t }),
    toggleIndicator: (k) => {
      const cur = get().indicators;
      set({ indicators: cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k] });
    },

    placeStockOrder: (symbol, side, qty) => {
      const eng = sim.engine;
      if (!eng || qty <= 0) return 'Invalid order';
      const def = ASSET_MAP[symbol];
      const mid = eng.price(symbol);
      const spread = mid * (get().settings.spreadBps / 10000);
      const fill = side === 'buy' ? mid + spread : mid - spread;
      const commission = get().settings.commissionPerTrade;
      const signedQty = side === 'buy' ? qty : -qty;
      const pf = { ...get().portfolio };
      pf.stocks = pf.stocks.map((s) => ({ ...s }));
      pf.trades = pf.trades;
      const cost = fill * qty;

      if (side === 'buy') {
        if (cost + commission > pf.cash) return 'Insufficient buying power';
        pf.cash -= cost + commission;
      } else {
        const held = findStock(pf, symbol)?.qty ?? 0;
        if (qty > held + 1e-9) return 'You cannot sell more than you hold';
        pf.cash += cost - commission;
      }
      const realized = applyStockFill(pf, symbol, signedQty, fill);
      const unit = def?.class === 'crypto' ? '' : ' sh';
      const trade = mkTrade({
        time: eng.now,
        kind: 'stock',
        symbol,
        action: `${side === 'buy' ? 'Buy' : 'Sell'} ${formatQty(qty)}${unit} ${symbol}`,
        qty: signedQty,
        price: fill,
        value: cost,
        realized: side === 'sell' ? realized : undefined,
      });
      pf.trades = [trade, ...pf.trades].slice(0, 500);
      set({ portfolio: pf, tick: get().tick + 1 });
      sim.recompute();
      get().saveNow();
      return null;
    },

    tradeOption: (ref, side, qty) => {
      const eng = sim.engine;
      if (!eng || qty <= 0) return 'Invalid order';
      const pos = get().portfolio.options.find(
        (o) => o.id === `${ref.symbol}-${ref.type}-${ref.strike}-${ref.expiry}`,
      );
      const mid = sim.optionPrice({ id: '', ref, qty: 1, avgPremium: 0 });
      const spread = Math.max(0.01, mid * 0.015);
      const fill = side === 'buy' ? mid + spread : Math.max(0, mid - spread);
      const commission = get().settings.optionCommission * qty;
      const signedQty = side === 'buy' ? qty : -qty;
      const pf = { ...get().portfolio };
      pf.options = pf.options.map((o) => ({ ...o }));
      const premiumFlow = fill * qty * CONTRACT_MULTIPLIER;

      // Determine if this opens a short (writing) — needs margin/cash to receive.
      const isOpeningShort = side === 'sell' && (!pos || pos.qty >= 0);
      if (side === 'buy') {
        if (premiumFlow + commission > pf.cash) return 'Insufficient buying power';
        pf.cash -= premiumFlow + commission;
      } else {
        // Selling: receive premium. If opening short, ensure margin coverage.
        if (isOpeningShort) {
          const margin = qty * CONTRACT_MULTIPLIER * (fill + 0.2 * ref.strike);
          if (margin > pf.cash + premiumFlow) return 'Insufficient margin to write this option';
        }
        pf.cash += premiumFlow - commission;
      }
      const { realized } = applyOptionFill(pf, ref, signedQty, fill);
      const trade = mkTrade({
        time: eng.now,
        kind: 'option',
        symbol: ref.symbol,
        action: `${side === 'buy' ? 'Buy' : 'Sell'} ${qty} ${ref.symbol} ${strikeLabel(ref.strike)}${ref.type === 'call' ? 'C' : 'P'}`,
        qty: signedQty,
        price: fill,
        value: premiumFlow,
        realized: side === 'sell' ? realized : undefined,
      });
      pf.trades = [trade, ...pf.trades].slice(0, 500);
      set({ portfolio: pf, tick: get().tick + 1 });
      sim.recompute();
      get().saveNow();
      return null;
    },

    closeOption: (id) => {
      const pos = get().portfolio.options.find((o) => o.id === id);
      if (!pos) return;
      get().tradeOption(pos.ref, pos.qty > 0 ? 'sell' : 'buy', Math.abs(pos.qty));
    },

    deposit: (amount) => {
      if (!(amount > 0)) return 'Enter an amount greater than zero';
      const now = sim.engine?.now ?? nowEpoch();
      const pf = { ...get().portfolio };
      // A funding event is a cash flow, not a gain: shift the P/L baselines too.
      pf.cash += amount;
      pf.netDeposits += amount;
      pf.dayStartEquity += amount;
      pf.yearStartEquity += amount;
      pf.trades = [
        mkTrade({ time: now, kind: 'cash', symbol: 'CASH', action: `Deposit ${money(amount)}`, qty: 0, price: 0, value: amount }),
        ...pf.trades,
      ].slice(0, 500);
      set({ portfolio: pf, tick: get().tick + 1 });
      sim.recompute();
      get().saveNow();
      return null;
    },

    withdraw: (amount, bank) => {
      if (!(amount > 0)) return 'Enter an amount greater than zero';
      const val = sim.getValuation();
      const available = val?.buyingPower ?? get().portfolio.cash;
      if (amount > available + 1e-9) return 'Amount exceeds your available cash balance';
      const now = sim.engine?.now ?? nowEpoch();
      const pf = { ...get().portfolio };
      pf.cash -= amount;
      pf.netDeposits -= amount;
      pf.dayStartEquity -= amount;
      pf.yearStartEquity -= amount;
      pf.trades = [
        mkTrade({
          time: now,
          kind: 'cash',
          symbol: 'CASH',
          action: `Withdraw ${money(amount)} → ${bank.bank} ••${bank.last4}`,
          qty: 0,
          price: 0,
          value: -amount,
        }),
        ...pf.trades,
      ].slice(0, 500);
      set({ portfolio: pf, settings: { ...get().settings, linkedBank: bank }, tick: get().tick + 1 });
      sim.recompute();
      get().saveNow();
      return null;
    },

    showToast: (msg) => {
      set({ toast: msg });
      setTimeout(() => set({ toast: null }), 2600);
    },

    saveNow: () => {
      const eng = sim.engine;
      const st = get();
      if (!eng || !st.meta) return;
      saveGame({
        version: 1,
        meta: st.meta,
        settings: st.settings,
        portfolio: st.portfolio,
        engine: eng.snapshot(),
        ui: { symbol: st.symbol, timeframe: st.timeframe, indicators: st.indicators },
      });
    },
  };
});

/** Cash-settle any option positions whose expiry has passed. */
function settleExpiredOptions(
  get: () => AppState,
  set: (p: Partial<AppState>) => void,
): void {
  const eng = sim.engine;
  if (!eng) return;
  const pf = get().portfolio;
  const expired = pf.options.filter((o) => o.ref.expiry <= eng.now);
  if (expired.length === 0) return;
  const next: Portfolio = { ...pf, options: pf.options.filter((o) => o.ref.expiry > eng.now) };
  const trades: Trade[] = [];
  for (const o of expired) {
    const spot = eng.price(o.ref.symbol);
    const intrinsic =
      o.ref.type === 'call' ? Math.max(0, spot - o.ref.strike) : Math.max(0, o.ref.strike - spot);
    const settle = intrinsic * o.qty * CONTRACT_MULTIPLIER;
    next.cash += settle;
    const realized = (intrinsic - o.avgPremium) * o.qty * CONTRACT_MULTIPLIER;
    next.realizedPnl += realized;
    trades.push(
      mkTrade({
        time: o.ref.expiry,
        kind: 'option',
        symbol: o.ref.symbol,
        action: `${intrinsic > 0 ? 'Settle' : 'Expire'} ${Math.abs(o.qty)} ${o.ref.symbol} ${strikeLabel(o.ref.strike)}${o.ref.type === 'call' ? 'C' : 'P'}`,
        qty: -o.qty,
        price: intrinsic,
        value: settle,
        realized,
      }),
    );
  }
  next.trades = [...trades, ...pf.trades].slice(0, 500);
  set({ portfolio: next, tick: get().tick + 1 });
}

function formatQty(q: number): string {
  if (q >= 1 && Number.isInteger(q)) return q.toString();
  return q.toPrecision(4).replace(/\.?0+$/, '');
}
function strikeLabel(k: number): string {
  if (k >= 1) return k % 1 === 0 ? k.toString() : k.toFixed(2);
  return k.toPrecision(3);
}
