import { useState } from 'react';
import { SPEED_PRESETS, useStore } from '../state/store';
import { sim } from '../state/sim';
import { useSimTick } from '../hooks/useSim';
import { clock } from '../util/format';
import { Watchlist } from './Watchlist';
import { Chart } from './Chart';
import { Hud } from './Hud';
import { OrderPanel } from './OrderPanel';

type MTab = 'markets' | 'chart' | 'trade';

function stocksOpen(now: number): boolean {
  const d = new Date(now * 1000);
  const dow = d.getUTCDay();
  const m = d.getUTCHours() * 60 + d.getUTCMinutes();
  return dow >= 1 && dow <= 5 && m >= 14 * 60 + 30 && m < 21 * 60;
}

export function MobileShell({
  onSettings,
  onStats,
  onOpenChain,
}: {
  onSettings: () => void;
  onStats: () => void;
  onOpenChain: () => void;
}) {
  const [tab, setTab] = useState<MTab>('chart');
  const symbol = useStore((s) => s.symbol);

  return (
    <div className="app mobile">
      <MobileTopBar onSettings={onSettings} onStats={onStats} />

      <div className="m-main">
        <div className="m-view" style={{ display: tab === 'markets' ? 'flex' : 'none' }}>
          <Watchlist onPick={() => setTab('chart')} />
        </div>
        <div className="m-view chart-area" style={{ display: tab === 'chart' ? 'flex' : 'none' }}>
          <Chart />
          <Hud />
        </div>
        <div className="m-view" style={{ display: tab === 'trade' ? 'flex' : 'none' }}>
          <OrderPanel onOpenChain={onOpenChain} />
        </div>
      </div>

      <nav className="m-bottomnav">
        <button className={tab === 'markets' ? 'active' : ''} onClick={() => setTab('markets')}>
          <span className="ic">☰</span>
          Markets
        </button>
        <button className={tab === 'chart' ? 'active' : ''} onClick={() => setTab('chart')}>
          <span className="ic">📈</span>
          {symbol}
        </button>
        <button className={tab === 'trade' ? 'active' : ''} onClick={() => setTab('trade')}>
          <span className="ic">⇅</span>
          Trade
        </button>
      </nav>
    </div>
  );
}

function MobileTopBar({ onSettings, onStats }: { onSettings: () => void; onStats: () => void }) {
  useSimTick(500);
  const speed = useStore((s) => s.settings.speed);
  const setSpeed = useStore((s) => s.setSpeed);
  const now = sim.engine?.now ?? 0;
  const open = stocksOpen(now);

  return (
    <div className="topbar m-topbar">
      <div className="brand">
        <span className="dot" /> ORION
      </div>
      <span className={'led' + (open ? '' : ' closed')} title={open ? 'Markets open' : 'Equities closed'} />
      <div className="clock mono">{clock(now)}</div>
      <div className="spacer" />
      <div className="speed-group m-speed">
        <button className={'pause' + (speed === 0 ? ' active' : '')} onClick={() => setSpeed(0)}>
          ❙❙
        </button>
        {SPEED_PRESETS.map((p) => (
          <button key={p.value} className={speed === p.value ? 'active' : ''} onClick={() => setSpeed(p.value)}>
            {p.label}
          </button>
        ))}
      </div>
      <button className="icon-btn" onClick={onStats}>📊</button>
      <button className="icon-btn" onClick={onSettings}>⚙</button>
    </div>
  );
}
