// Core domain types for the ORION market engine.

export type AssetClass = 'stock' | 'crypto';

export interface AssetDef {
  symbol: string;
  name: string;
  class: AssetClass;
  sector: string;
  /** Initial price at world genesis. */
  seedPrice: number;
  /** Annualized expected drift (e.g. 0.08 = 8%/yr). */
  drift: number;
  /** Annualized idiosyncratic volatility. */
  vol: number;
  /** Sensitivity to the broad-market factor. */
  beta: number;
  /** Shares/coins outstanding — used for market-cap display & liquidity. */
  supply: number;
  /** Whether the instrument supports listed options. */
  optionable: boolean;
  /**
   * If set, the instrument only starts trading this many days before the
   * world's genesis (a recent IPO/listing) and has no history before then.
   */
  ipoDaysAgo?: number;
}

export interface Candle {
  /** Unix epoch seconds at bar open. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Live, mutable per-asset simulation state. */
export interface AssetState {
  symbol: string;
  price: number;
  prevClose: number;
  /** Rolling buffer of 1-minute base candles. */
  bars: Candle[];
  /** Rolling buffer of daily candles for long-horizon charts. */
  dailyBars: Candle[];
  /** Day's opening price (for day change %). */
  dayOpen: number;
  /** Reference price at the start of the current sim-year. */
  yearOpen: number;
  /** Accumulator for the daily candle currently being formed. */
  dayAccum: { date: string; open: number; high: number; low: number; volume: number } | null;
  /** Base shares/coins traded per minute, before activity scaling. */
  baseVol: number;
  /** Epoch seconds when the instrument first lists (≤ genesis for legacy names). */
  ipoAt: number;
  lastSession: string; // YYYY-MM-DD of the dayOpen reference
}

export type OptionType = 'call' | 'put';
export type PositionSide = 'long' | 'short';

export interface OptionContractRef {
  symbol: string; // underlying
  type: OptionType;
  strike: number;
  /** Expiration unix epoch seconds (market close on expiry day). */
  expiry: number;
}

export interface StockPosition {
  symbol: string;
  qty: number; // can be fractional for crypto; negative = short
  avgCost: number;
}

export interface OptionPosition {
  id: string;
  ref: OptionContractRef;
  /** Number of contracts. Positive = long, negative = short (written). */
  qty: number;
  /** Premium paid/received per share (contract = 100 shares). */
  avgPremium: number;
}

export interface LinkedBank {
  bank: string;
  last4: string;
  holder: string;
}

export interface Trade {
  id: string;
  time: number;
  kind: 'stock' | 'option' | 'cash';
  symbol: string;
  action: string; // human readable, e.g. "Buy 10 AAPL"
  qty: number;
  price: number;
  value: number;
  realized?: number;
}

export interface Portfolio {
  cash: number;
  startingCash: number;
  /** Total net money the trader has put in (deposits − withdrawals). */
  netDeposits: number;
  stocks: StockPosition[];
  options: OptionPosition[];
  trades: Trade[];
  realizedPnl: number;
  /** Equity snapshot at start of current sim day. */
  dayStartEquity: number;
  daySession: string;
  /** Equity snapshot at start of current sim year. */
  yearStartEquity: number;
  yearSession: number; // year number
  /** Time series of total equity for the performance chart. */
  equityCurve: { time: number; value: number }[];
}

export interface RiskProfile {
  key: 'conservative' | 'balanced' | 'aggressive';
  label: string;
  /** Volatility multiplier applied to the whole world. */
  volMult: number;
  driftMult: number;
}

export interface HudConfig {
  show: boolean;
  position: 'tl' | 'tr' | 'bl' | 'br';
  balance: boolean;
  openTrades: boolean;
  optionsHeld: boolean;
  dayPnl: boolean;
  ytdPnl: boolean;
  buyingPower: boolean;
}

export interface Settings {
  trader: string;
  theme: 'dark' | 'midnight' | 'light';
  risk: RiskProfile['key'];
  commissionPerTrade: number;
  optionCommission: number; // per contract
  spreadBps: number; // half-spread in basis points
  hud: HudConfig;
  enabledClasses: { stock: boolean; crypto: boolean };
  defaultTimeframe: string;
  speed: number; // sim minutes per real second
  linkedBank: LinkedBank | null;
}

export interface WorldMeta {
  seed: number;
  /** Current simulation time, unix epoch seconds. */
  now: number;
  /** Genesis time of the world. */
  genesis: number;
  createdAt: number;
}
