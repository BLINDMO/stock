import type { OptionPosition, Portfolio, StockPosition } from './types';
import { blackScholes } from './options';

export const CONTRACT_MULTIPLIER = 100;
export const RISK_FREE_RATE = 0.045;

export interface Valuation {
  cash: number;
  stockValue: number;
  optionValue: number;
  equity: number;
  unrealized: number;
  // Buying power: cash minus margin tied up in short options.
  buyingPower: number;
  longExposure: number;
}

export interface PriceFn {
  (symbol: string): number;
}

/** Mark an option position to market. */
export function markOption(
  pos: OptionPosition,
  spot: number,
  now: number,
  iv: number,
): number {
  const t = Math.max(0, (pos.ref.expiry - now) / (365 * 86400));
  const g = blackScholes({ spot, strike: pos.ref.strike, t, r: RISK_FREE_RATE, vol: iv, type: pos.ref.type });
  return g.price;
}

export function valuePortfolio(
  pf: Portfolio,
  price: PriceFn,
  optionPrice: (p: OptionPosition) => number,
): Valuation {
  let stockValue = 0;
  let longExposure = 0;
  let unrealized = 0;
  for (const s of pf.stocks) {
    const px = price(s.symbol);
    const val = s.qty * px;
    stockValue += val;
    if (s.qty > 0) longExposure += val;
    unrealized += (px - s.avgCost) * s.qty;
  }
  let optionValue = 0;
  let shortMargin = 0;
  for (const o of pf.options) {
    const px = optionPrice(o);
    const val = o.qty * px * CONTRACT_MULTIPLIER;
    optionValue += val;
    unrealized += (px - o.avgPremium) * o.qty * CONTRACT_MULTIPLIER;
    if (o.qty < 0) {
      // Reg-T style short-option margin: ~20% of notional, simplified.
      shortMargin += Math.abs(o.qty) * CONTRACT_MULTIPLIER * (px + 0.2 * o.ref.strike);
    }
  }
  const equity = pf.cash + stockValue + optionValue;
  return {
    cash: pf.cash,
    stockValue,
    optionValue,
    equity,
    unrealized,
    buyingPower: Math.max(0, pf.cash - shortMargin),
    longExposure,
  };
}

export function findStock(pf: Portfolio, symbol: string): StockPosition | undefined {
  return pf.stocks.find((s) => s.symbol === symbol);
}

/** Apply a stock fill, updating average cost & realized P/L. Returns realized. */
export function applyStockFill(pf: Portfolio, symbol: string, qty: number, price: number): number {
  let pos = findStock(pf, symbol);
  let realized = 0;
  if (!pos) {
    pos = { symbol, qty: 0, avgCost: price };
    pf.stocks.push(pos);
  }
  const sameDir = Math.sign(qty) === Math.sign(pos.qty) || pos.qty === 0;
  if (sameDir) {
    const totalCost = pos.avgCost * pos.qty + price * qty;
    pos.qty += qty;
    pos.avgCost = pos.qty !== 0 ? totalCost / pos.qty : price;
  } else {
    // Reducing or flipping: realize P/L on the closed portion.
    const closing = Math.min(Math.abs(qty), Math.abs(pos.qty)) * Math.sign(qty) * -1;
    realized += (price - pos.avgCost) * closing;
    pos.qty += qty;
    if (Math.sign(pos.qty) !== Math.sign(pos.qty - qty) && pos.qty !== 0) {
      // Flipped through zero: remainder opens a new position at fill price.
      pos.avgCost = price;
    }
    if (pos.qty === 0) pos.avgCost = price;
  }
  if (Math.abs(pos.qty) < 1e-12) {
    pf.stocks = pf.stocks.filter((s) => s !== pos);
  }
  pf.realizedPnl += realized;
  return realized;
}

/** Apply an option fill (qty signed: + opens/closes long, - opens/closes short). */
export function applyOptionFill(
  pf: Portfolio,
  ref: OptionPosition['ref'],
  qty: number,
  premium: number,
): { realized: number; position: OptionPosition | null } {
  const id = optionId(ref);
  let pos = pf.options.find((o) => o.id === id);
  let realized = 0;
  if (!pos) {
    pos = { id, ref, qty: 0, avgPremium: premium };
    pf.options.push(pos);
  }
  const sameDir = Math.sign(qty) === Math.sign(pos.qty) || pos.qty === 0;
  if (sameDir) {
    const total = pos.avgPremium * pos.qty + premium * qty;
    pos.qty += qty;
    pos.avgPremium = pos.qty !== 0 ? total / pos.qty : premium;
  } else {
    const closing = Math.min(Math.abs(qty), Math.abs(pos.qty)) * Math.sign(qty) * -1;
    realized += (premium - pos.avgPremium) * closing * CONTRACT_MULTIPLIER;
    pos.qty += qty;
    if (pos.qty === 0) pos.avgPremium = premium;
    else if (Math.sign(pos.qty) !== Math.sign(pos.qty - qty)) pos.avgPremium = premium;
  }
  pf.realizedPnl += realized;
  if (pos.qty === 0) {
    pf.options = pf.options.filter((o) => o !== pos);
    return { realized, position: null };
  }
  return { realized, position: pos };
}

export function optionId(ref: OptionPosition['ref']): string {
  return `${ref.symbol}-${ref.type}-${ref.strike}-${ref.expiry}`;
}

export function dayPnl(pf: Portfolio, currentEquity: number): number {
  return currentEquity - pf.dayStartEquity;
}

export function ytdPnl(pf: Portfolio, currentEquity: number): number {
  return currentEquity - pf.yearStartEquity;
}

export function totalPnl(pf: Portfolio, currentEquity: number): number {
  return currentEquity - pf.netDeposits;
}
