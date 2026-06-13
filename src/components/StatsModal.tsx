import { useStore } from '../state/store';
import { sim } from '../state/sim';
import { useSimTick } from '../hooks/useSim';
import { money, pct } from '../util/format';

export function StatsModal({ onClose }: { onClose: () => void }) {
  useSimTick(500);
  const pf = useStore((s) => s.portfolio);
  const meta = useStore((s) => s.meta);
  const trader = useStore((s) => s.settings.trader);
  const val = sim.getValuation();
  const equity = val?.equity ?? pf.cash;

  const basis = pf.netDeposits ?? pf.startingCash;
  const totalReturn = equity - basis;
  const totalReturnPct = basis > 0 ? (totalReturn / basis) * 100 : 0;
  const closed = pf.trades.filter((t) => typeof t.realized === 'number' && t.realized !== 0);
  const wins = closed.filter((t) => (t.realized ?? 0) > 0);
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
  const best = closed.reduce((m, t) => Math.max(m, t.realized ?? -Infinity), -Infinity);
  const worst = closed.reduce((m, t) => Math.min(m, t.realized ?? Infinity), Infinity);
  const daysSimmed = meta ? Math.max(0, Math.round((sim.engine!.now - meta.genesis) / 86400)) : 0;

  const curve = pf.equityCurve;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{trader}'s Performance</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <Sparkline points={curve.map((c) => c.value)} baseline={pf.startingCash} />

          <div className="stat-grid" style={{ marginTop: 18 }}>
            <Card k="Account value" v={money(equity)} />
            <Card k="Total return" v={`${money(totalReturn, { sign: true })} (${pct(totalReturnPct)})`} cls={totalReturn >= 0 ? 'up' : 'down'} />
            <Card k="Realized P/L" v={money(pf.realizedPnl, { sign: true })} cls={pf.realizedPnl >= 0 ? 'up' : 'down'} />
            <Card k="Unrealized P/L" v={money(val?.unrealized ?? 0, { sign: true })} cls={(val?.unrealized ?? 0) >= 0 ? 'up' : 'down'} />
            <Card k="Cash" v={money(pf.cash)} />
            <Card k="Invested" v={money((val?.stockValue ?? 0) + (val?.optionValue ?? 0))} />
            <Card k="Total trades" v={String(pf.trades.length)} />
            <Card k="Win rate" v={`${winRate.toFixed(1)}% (${wins.length}/${closed.length})`} />
            <Card k="Best closed trade" v={Number.isFinite(best) ? money(best, { sign: true }) : '—'} cls="up" />
            <Card k="Worst closed trade" v={Number.isFinite(worst) ? money(worst, { sign: true }) : '—'} cls="down" />
            <Card k="Days simulated" v={daysSimmed.toLocaleString()} />
            <Card k="Open positions" v={String(pf.stocks.filter((s) => Math.abs(s.qty) > 1e-9).length + pf.options.length)} />
          </div>

          <div className="section-title" style={{ padding: '18px 0 6px' }}>Recent activity</div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {pf.trades.length === 0 && <div className="empty">No trades yet</div>}
            {pf.trades.slice(0, 40).map((t) => (
              <div className="pos-row" key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                <div className="col-l">
                  <div className="sym" style={{ fontSize: 12 }}>{t.action}</div>
                  <div className="sub">{new Date(t.time * 1000).toLocaleString('en-US', { timeZone: 'UTC' })} UTC</div>
                </div>
                <div className="col-r">
                  <div className="val mono">{money(Math.abs(t.value))}</div>
                  {typeof t.realized === 'number' && t.realized !== 0 && (
                    <div className={'pl mono ' + (t.realized >= 0 ? 'up' : 'down')}>{money(t.realized, { sign: true })}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ k, v, cls }: { k: string; v: string; cls?: string }) {
  return (
    <div className="stat-card">
      <div className="k">{k}</div>
      <div className={'v mono ' + (cls ?? '')}>{v}</div>
    </div>
  );
}

function Sparkline({ points, baseline }: { points: number[]; baseline: number }) {
  if (points.length < 2) {
    return (
      <div style={{ height: 90, display: 'grid', placeItems: 'center', color: 'var(--text-faint)', fontSize: 12 }}>
        Equity curve will appear as you trade.
      </div>
    );
  }
  const W = 700;
  const H = 90;
  const min = Math.min(...points, baseline);
  const max = Math.max(...points, baseline);
  const range = max - min || 1;
  const step = W / (points.length - 1);
  const y = (v: number) => H - ((v - min) / range) * (H - 8) - 4;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const up = last >= baseline;
  const color = up ? 'var(--up)' : 'var(--down)';
  const baseY = y(baseline);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      <line x1={0} y1={baseY} x2={W} y2={baseY} stroke="var(--border)" strokeDasharray="4 4" />
      <path d={`${path} L${W},${H} L0,${H} Z`} fill={color} opacity={0.1} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.8} />
    </svg>
  );
}
