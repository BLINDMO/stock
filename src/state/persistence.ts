import type { EngineSnapshot } from '../engine/market';
import type { Portfolio, Settings, WorldMeta } from '../engine/types';

const KEY = 'orion.save.v1';

export interface SaveData {
  version: 1;
  meta: WorldMeta;
  settings: Settings;
  portfolio: Portfolio;
  engine: EngineSnapshot;
  ui: { symbol: string; timeframe: string; indicators: string[] };
}

export function saveGame(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    // Storage full or unavailable — trim equity curve and retry once.
    try {
      const trimmed: SaveData = {
        ...data,
        portfolio: { ...data.portfolio, equityCurve: data.portfolio.equityCurve.slice(-500) },
      };
      localStorage.setItem(KEY, JSON.stringify(trimmed));
    } catch {
      /* give up silently */
    }
  }
}

export function loadGame(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearGame(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
