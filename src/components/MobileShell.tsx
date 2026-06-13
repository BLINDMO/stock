import { useState } from 'react';
import { SPEED_PRESETS, useStore } from '../state/store';
import { sim } from '../state/sim';
import { useSimTick } from '../hooks/useSim';
import { clock } from '../util/format';
import { Watchlist } from './Watchlist';
import { Chart } from './Chart';
import { Hud } from './Hud';
import { OrderPanel } from './OrderPanel';
import { Positions } from './Positions';
import { isStockOpen } from '../util/marketHours';

type MTab = 'markets' | 'chart' | 'trade' | 'positions';

export function MobileShell({
  onSettings,
  onStats,
  onOpenChain,
  onBanking,
}: {
  onSettings: () => void;
  onStats: () => void;
  onOpenChain: () => void;
  onBanking: () => void;
}) {
  const [tab, setTab] = useState<MTab>('chart');
  const symbol = useStore((s) => s.symbol);

  return (
    <div className="app mobile">
      <MobileTopBar onSettings={onSettings} onStats={onStats} onBanking={onBanking} />

      <div className="m-main">
        <div className="m-view" style={{ display: tab === 'markets' ? 'flex' : 'none' }}>
          <Watchlist onPick={() => setTab('chart')} />
        </div>
        <div className="m-view chart-area" style={{ display: tab === 'chart' ? 'flex' : 'none' }}>
          <Chart />
          <Hud />
        </div>
        <div className="m-view" style={{ display: tab === 'trade' ? 'flex' : 'none' }}>
          <OrderPanel onOpenChain={onOpenChain} hidePositions />
        </div>
        <div className="m-view m-scroll" style={{ display: tab === 'positions' ? 'flex' : 'none' }}>
          <Positions showSummary />
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
        <button className={tab === 'positions' ? 'active' : ''} onClick={() => setTab('positions')}>
          <span className="ic">▦</span>
          Positions
        </button>
      </nav>
    </div>
  );
}

function MobileTopBar({
  onSettings,
  onStats,
  onBanking,
}: {
  onSettings: () => void;
  onStats: () => void;
  onBanking: () => void;
}) {
  useSimTick(500);
  const speed = useStore((s) => s.settings.speed);
  const setSpeed = useStore((s) => s.setSpeed);
  const now = sim.engine?.now ?? 0;
  const open = isStockOpen(now);

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
      <button className="icon-btn" onClick={onBanking}>🏦</button>
      <button className="icon-btn" onClick={onStats}>📊</button>
      <button className="icon-btn" onClick={onSettings}>⚙</button>
    </div>
  );
}
