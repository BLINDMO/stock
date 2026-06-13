import { SPEED_PRESETS, useStore } from '../state/store';
import { sim } from '../state/sim';
import { useSimTick } from '../hooks/useSim';
import { clock } from '../util/format';
import { isStockOpen } from '../util/marketHours';

export function TopBar({ onSettings, onStats, onBanking }: { onSettings: () => void; onStats: () => void; onBanking: () => void }) {
  useSimTick(500);
  const speed = useStore((s) => s.settings.speed);
  const setSpeed = useStore((s) => s.setSpeed);
  const now = sim.engine?.now ?? 0;
  const open = isStockOpen(now);

  return (
    <div className="topbar">
      <div className="brand">
        <span className="dot" /> ORION
      </div>
      <div className="market-status">
        <span className={'led' + (open ? '' : ' closed')} />
        {open ? 'Markets open' : 'Equities closed · Crypto live'}
      </div>
      <div className="clock mono">{clock(now)} UTC</div>

      <div className="spacer" />

      <div className="speed-group">
        <button
          className={'pause' + (speed === 0 ? ' active' : '')}
          onClick={() => setSpeed(0)}
          title="Pause"
        >
          ❙❙
        </button>
        {SPEED_PRESETS.map((p) => (
          <button key={p.value} className={speed === p.value ? 'active' : ''} onClick={() => setSpeed(p.value)}>
            {p.label}
          </button>
        ))}
      </div>

      <button className="icon-btn" title="Banking" onClick={onBanking}>
        🏦
      </button>
      <button className="icon-btn" title="Statistics" onClick={onStats}>
        📊
      </button>
      <button className="icon-btn" title="Settings" onClick={onSettings}>
        ⚙
      </button>
    </div>
  );
}
