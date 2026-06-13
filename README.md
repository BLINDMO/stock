# ORION

**Markets, mastered.** A polished trading terminal for stocks, ETFs, options and
crypto — with TradingView-grade charts, real technical indicators, an
options chain with live Greeks, and a market that evolves smoothly into an
infinite future. No predetermined outcomes: every price is a fresh draw from a
realistic stochastic engine, and your fate is entirely in your own hands.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
npm run preview  # serve the production build
```

## What's inside

### A realistic market engine (`src/engine`)
- **Factor model.** A broad-market factor drives correlated moves; each
  instrument adds beta-weighted exposure plus its own idiosyncratic noise.
  Equities and crypto have independent factors with realistic spillover.
- **Volatility clustering** via mean-reverting (Ornstein–Uhlenbeck) volatility
  regimes, plus rare fat-tailed **jumps** for "news".
- **Market hours.** Equities trade the cash session on weekdays (gaps form
  overnight and over weekends); crypto trades 24/7.
- **Deep history.** Every world is backfilled with ~2 years of daily candles
  and the most recent sessions of 1-minute candles, so charts look like an
  established, liquid market from the first second.
- **Deterministic & reproducible.** A single seed plus a saved RNG position
  means a world resumes exactly where it left off — without scripting any
  outcome.

### Real indicators (`src/engine/indicators.ts`)
SMA, EMA, RSI, MACD, Bollinger Bands, session VWAP, volume, and realized
volatility — all computed from the live candle stream and overlaid on the
chart (oscillators render in their own synced pane).

### Options (`src/engine/options.ts`)
Full **Black–Scholes** pricing with **Delta, Gamma, Theta, Vega**, a volatility
**smile**, a laddered chain of weekly/monthly expirations and strikes, plus
buying, writing (with margin checks) and cash-settled expiration.

### The app (`src/components`, `src/state`)
- **Onboarding** — name, opening deposit (pocket money to seven figures),
  markets, risk appetite, theme, default timeframe, commissions.
- **Trading desk** — searchable watchlist, candlestick chart with timeframe and
  indicator controls, an order ticket with buying-power math, and live
  positions for both stocks and options.
- **Options chain** — calls/puts with bid/ask, deltas, Greeks and one-click
  trading.
- **Info overlay (HUD)** — a sleek, glassy panel showing account value, day and
  year-to-date P/L, open positions, contracts held and buying power. Every
  field can be toggled, and the panel can sit in any corner.
- **Settings** — theme, market behavior, commissions, full HUD customization,
  statistics, and a one-tap restart.
- **Statistics** — equity curve, total/realized/unrealized P/L, win rate, best
  and worst closed trades, days simulated and full trade history.
- **Time warp** — pause, live, or fast-forward up to 12 simulated hours per
  second; the engine advances smoothly and your P/L updates in real time.

Progress autosaves to the browser and on tab close, so an in-progress account
survives reloads.
