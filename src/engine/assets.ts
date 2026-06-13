import type { AssetDef } from './types';

// A catalogue of instruments. Seed prices are plausible reference points; once
// the world starts, every price evolves purely from the stochastic engine, so
// quotes here are only a starting line — never a script.

const stock = (
  symbol: string,
  name: string,
  sector: string,
  seedPrice: number,
  drift: number,
  vol: number,
  beta: number,
  supply: number,
  extra: Partial<AssetDef> = {},
): AssetDef => ({ symbol, name, class: 'stock', sector, seedPrice, drift, vol, beta, supply, optionable: true, ...extra });

const crypto = (
  symbol: string,
  name: string,
  seedPrice: number,
  drift: number,
  vol: number,
  beta: number,
  supply: number,
  optionable = false,
): AssetDef => ({ symbol, name, class: 'crypto', sector: 'Crypto', seedPrice, drift, vol, beta, supply, optionable });

export const STOCKS: AssetDef[] = [
  stock('AAPL', 'Apple Inc.', 'Technology', 212.4, 0.11, 0.26, 1.05, 15.2e9),
  stock('MSFT', 'Microsoft Corp.', 'Technology', 442.6, 0.12, 0.24, 0.98, 7.4e9),
  stock('NVDA', 'NVIDIA Corp.', 'Semiconductors', 126.8, 0.22, 0.48, 1.62, 24.6e9),
  stock('AMZN', 'Amazon.com Inc.', 'Consumer Disc.', 186.3, 0.13, 0.31, 1.18, 10.4e9),
  stock('GOOGL', 'Alphabet Inc.', 'Communication', 178.2, 0.10, 0.27, 1.03, 12.2e9),
  stock('META', 'Meta Platforms', 'Communication', 498.1, 0.14, 0.36, 1.28, 2.5e9),
  stock('TSLA', 'Tesla Inc.', 'Automotive', 246.7, 0.16, 0.55, 1.74, 3.19e9),
  stock('AMD', 'Advanced Micro Devices', 'Semiconductors', 158.9, 0.15, 0.47, 1.55, 1.62e9),
  stock('NFLX', 'Netflix Inc.', 'Communication', 678.4, 0.12, 0.38, 1.21, 0.43e9),
  stock('JPM', 'JPMorgan Chase', 'Financials', 204.1, 0.08, 0.22, 1.06, 2.87e9),
  stock('BAC', 'Bank of America', 'Financials', 39.8, 0.07, 0.27, 1.14, 7.9e9),
  stock('V', 'Visa Inc.', 'Financials', 273.5, 0.10, 0.21, 0.94, 2.0e9),
  stock('DIS', 'Walt Disney Co.', 'Communication', 99.6, 0.06, 0.30, 1.10, 1.82e9),
  stock('KO', 'Coca-Cola Co.', 'Consumer Staples', 63.2, 0.05, 0.16, 0.58, 4.31e9),
  stock('PEP', 'PepsiCo Inc.', 'Consumer Staples', 168.4, 0.05, 0.17, 0.60, 1.37e9),
  stock('WMT', 'Walmart Inc.', 'Consumer Staples', 67.9, 0.07, 0.18, 0.52, 8.05e9),
  stock('XOM', 'Exxon Mobil', 'Energy', 114.7, 0.06, 0.28, 0.88, 4.4e9),
  stock('CVX', 'Chevron Corp.', 'Energy', 156.2, 0.05, 0.27, 0.92, 1.84e9),
  stock('PFE', 'Pfizer Inc.', 'Healthcare', 28.4, 0.04, 0.24, 0.66, 5.66e9),
  stock('JNJ', 'Johnson & Johnson', 'Healthcare', 148.9, 0.05, 0.17, 0.55, 2.41e9),
  stock('UNH', 'UnitedHealth Group', 'Healthcare', 492.3, 0.09, 0.25, 0.72, 0.92e9),
  stock('BA', 'Boeing Co.', 'Industrials', 178.6, 0.06, 0.40, 1.42, 0.61e9),
  stock('CAT', 'Caterpillar Inc.', 'Industrials', 342.8, 0.08, 0.29, 1.12, 0.49e9),
  stock('INTC', 'Intel Corp.', 'Semiconductors', 31.2, 0.04, 0.41, 1.20, 4.25e9),
  stock('CRM', 'Salesforce Inc.', 'Technology', 254.7, 0.11, 0.34, 1.24, 0.97e9),
  stock('ORCL', 'Oracle Corp.', 'Technology', 142.3, 0.10, 0.28, 0.99, 2.76e9),
  stock('PYPL', 'PayPal Holdings', 'Financials', 62.8, 0.07, 0.39, 1.33, 1.02e9),
  stock('SHOP', 'Shopify Inc.', 'Technology', 64.5, 0.15, 0.52, 1.66, 1.29e9),
  stock('UBER', 'Uber Technologies', 'Technology', 71.2, 0.13, 0.44, 1.40, 2.09e9),
  stock('COIN', 'Coinbase Global', 'Financials', 224.6, 0.18, 0.72, 2.10, 0.25e9),
  stock('SPY', 'SPDR S&P 500 ETF', 'Index', 543.1, 0.09, 0.16, 1.00, 0.92e9),
  stock('QQQ', 'Invesco QQQ Trust', 'Index', 472.8, 0.11, 0.20, 1.10, 0.55e9),
  // Freshly listed: priced at the offering, no options yet, no price history
  // before yesterday's debut — a true new-issue trading profile.
  stock('SPCX', 'SpaceX (Space Exploration Technologies)', 'Aerospace', 168.0, 0.24, 0.66, 1.5, 1.8e9, {
    optionable: false,
    ipoDaysAgo: 1,
  }),
];

export const CRYPTOS: AssetDef[] = [
  crypto('BTC', 'Bitcoin', 67250, 0.25, 0.62, 1.0, 19.7e6, true),
  crypto('ETH', 'Ethereum', 3520, 0.28, 0.74, 1.15, 120.4e6, true),
  crypto('SOL', 'Solana', 162.4, 0.40, 1.05, 1.45, 462e6),
  crypto('BNB', 'BNB', 592.3, 0.22, 0.66, 0.92, 147e6),
  crypto('XRP', 'XRP', 0.524, 0.18, 0.88, 1.05, 55.5e9),
  crypto('ADA', 'Cardano', 0.412, 0.20, 0.96, 1.18, 35.5e9),
  crypto('DOGE', 'Dogecoin', 0.124, 0.30, 1.32, 1.6, 144e9),
  crypto('AVAX', 'Avalanche', 27.8, 0.32, 1.08, 1.38, 400e6),
  crypto('DOT', 'Polkadot', 6.12, 0.21, 0.94, 1.12, 1.43e9),
  crypto('MATIC', 'Polygon', 0.548, 0.24, 1.02, 1.25, 9.9e9),
  crypto('LINK', 'Chainlink', 14.2, 0.28, 0.98, 1.22, 0.61e9),
  crypto('LTC', 'Litecoin', 72.6, 0.12, 0.78, 0.96, 74.5e6),
  crypto('UNI', 'Uniswap', 7.84, 0.26, 1.04, 1.3, 0.6e9),
  crypto('ATOM', 'Cosmos', 6.92, 0.22, 0.97, 1.14, 0.39e9),
  crypto('XLM', 'Stellar', 0.098, 0.16, 0.92, 1.02, 29.4e9),
  crypto('BCH', 'Bitcoin Cash', 372.5, 0.14, 0.84, 1.0, 19.7e6),
  crypto('NEAR', 'NEAR Protocol', 5.21, 0.34, 1.12, 1.4, 1.08e9),
  crypto('APT', 'Aptos', 8.64, 0.36, 1.18, 1.42, 0.42e9),
  crypto('ARB', 'Arbitrum', 0.812, 0.30, 1.22, 1.5, 3.5e9),
  crypto('OP', 'Optimism', 1.74, 0.32, 1.2, 1.48, 1.0e9),
  crypto('FIL', 'Filecoin', 4.38, 0.20, 1.06, 1.28, 0.58e9),
  crypto('ICP', 'Internet Computer', 9.82, 0.24, 1.14, 1.32, 0.47e9),
  crypto('INJ', 'Injective', 24.6, 0.42, 1.34, 1.62, 0.1e9),
  crypto('SUI', 'Sui', 0.964, 0.44, 1.4, 1.66, 2.6e9),
  crypto('PEPE', 'Pepe', 0.0000118, 0.50, 1.85, 2.1, 4.2e14),
  crypto('SHIB', 'Shiba Inu', 0.0000172, 0.34, 1.6, 1.8, 5.89e14),
  crypto('WIF', 'dogwifhat', 2.41, 0.55, 1.95, 2.2, 0.99e9),
  crypto('TRX', 'TRON', 0.122, 0.16, 0.82, 0.94, 87e9),
  crypto('ETC', 'Ethereum Classic', 26.4, 0.14, 0.92, 1.04, 147e6),
  crypto('HBAR', 'Hedera', 0.078, 0.22, 1.08, 1.24, 35e9),
];

export const ALL_ASSETS: AssetDef[] = [...STOCKS, ...CRYPTOS];

export const ASSET_MAP: Record<string, AssetDef> = Object.fromEntries(
  ALL_ASSETS.map((a) => [a.symbol, a]),
);

export function assetsForClasses(classes: { stock: boolean; crypto: boolean }): AssetDef[] {
  return ALL_ASSETS.filter((a) =>
    (a.class === 'stock' && classes.stock) || (a.class === 'crypto' && classes.crypto),
  );
}
