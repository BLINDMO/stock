import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { sim } from '../state/sim';
import { useSimTick } from '../hooks/useSim';
import { ASSET_MAP, assetsForClasses } from '../engine/assets';
import { price as fmtPrice, pct } from '../util/format';

type Tab = 'all' | 'stock' | 'crypto' | 'holdings';

export function Watchlist() {
  useSimTick(400);
  const symbol = useStore((s) => s.symbol);
  const setSymbol = useStore((s) => s.setSymbol);
  const enabled = useStore((s) => s.settings.enabledClasses);
  const holdings = useStore((s) => s.portfolio.stocks);
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');

  const universe = useMemo(() => assetsForClasses(enabled), [enabled]);
  const holdSet = useMemo(() => new Set(holdings.filter((h) => h.qty !== 0).map((h) => h.symbol)), [holdings]);

  const rows = universe.filter((a) => {
    if (tab === 'stock' && a.class !== 'stock') return false;
    if (tab === 'crypto' && a.class !== 'crypto') return false;
    if (tab === 'holdings' && !holdSet.has(a.symbol)) return false;
    if (q && !(a.symbol.toLowerCase().includes(q.toLowerCase()) || a.name.toLowerCase().includes(q.toLowerCase())))
      return false;
    return true;
  });

  return (
    <div className="panel">
      <div className="search">
        <span style={{ color: 'var(--text-faint)' }}>⌕</span>
        <input placeholder="Search markets" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="tabs">
        {(['all', 'stock', 'crypto', 'holdings'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t === 'all' ? 'All' : t === 'stock' ? 'Stocks' : t === 'crypto' ? 'Crypto' : 'Holdings'}
          </button>
        ))}
      </div>
      <div className="watchlist">
        {rows.length === 0 && <div className="empty">No markets</div>}
        {rows.map((a) => {
          const st = sim.engine?.assets.get(a.symbol);
          const px = st?.price ?? a.seedPrice;
          const dayOpen = st?.dayOpen ?? a.seedPrice;
          const chg = dayOpen > 0 ? ((px - dayOpen) / dayOpen) * 100 : 0;
          return (
            <div
              key={a.symbol}
              className={'wl-row' + (symbol === a.symbol ? ' active' : '')}
              onClick={() => setSymbol(a.symbol)}
            >
              <div className="col-l">
                <div className="sym">{a.symbol}</div>
                <div className="name">{a.name}</div>
              </div>
              <div className="col-r">
                <div className="px mono">{fmtPrice(px)}</div>
                <div className={'chg mono ' + (chg >= 0 ? 'up' : 'down')}>{pct(chg)}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ padding: '8px 14px', fontSize: 10, color: 'var(--text-faint)', borderTop: '1px solid var(--border)' }}>
        {ASSET_MAP[symbol]?.sector}
      </div>
    </div>
  );
}
