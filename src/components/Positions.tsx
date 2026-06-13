import { useMemo } from 'react';
import { useStore } from '../state/store';
import { sim } from '../state/sim';
import { useSimTick } from '../hooks/useSim';
import { CONTRACT_MULTIPLIER } from '../engine/portfolio';
import { money, price as fmtPrice, qty as fmtQty, pct } from '../util/format';

/** Open stock & option positions with live P/L and one-tap close/manage. */
export function Positions({ showSummary = false }: { showSummary?: boolean }) {
  useSimTick(300);
  const portfolio = useStore((s) => s.portfolio);
  const setSymbol = useStore((s) => s.setSymbol);
  const placeStockOrder = useStore((s) => s.placeStockOrder);
  const closeOption = useStore((s) => s.closeOption);
  const showToast = useStore((s) => s.showToast);
  const eng = sim.engine;
  const val = sim.getValuation();

  const stocks = portfolio.stocks.filter((s) => Math.abs(s.qty) > 1e-9);
  const options = portfolio.options;

  const optionRows = useMemo(
    () =>
      options.map((o) => {
        const mark = sim.optionPrice(o);
        const pl = (mark - o.avgPremium) * o.qty * CONTRACT_MULTIPLIER;
        return { o, mark, pl };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options, eng?.now],
  );

  const equity = val?.equity ?? portfolio.cash;
  const dayPl = equity - portfolio.dayStartEquity;
  const dayPlPct = portfolio.dayStartEquity > 0 ? (dayPl / portfolio.dayStartEquity) * 100 : 0;
  const openPl = (val?.unrealized ?? 0);

  return (
    <div className="positions-view">
      {showSummary && (
        <div className="port-summary">
          <div className="ps-main">
            <div className="ps-k">Portfolio value</div>
            <div className="ps-v mono">{money(equity)}</div>
          </div>
          <div className="ps-grid">
            <div>
              <div className="ps-k">Day P/L</div>
              <div className={'ps-sv mono ' + (dayPl >= 0 ? 'up' : 'down')}>{money(dayPl, { sign: true })} ({pct(dayPlPct)})</div>
            </div>
            <div>
              <div className="ps-k">Open P/L</div>
              <div className={'ps-sv mono ' + (openPl >= 0 ? 'up' : 'down')}>{money(openPl, { sign: true })}</div>
            </div>
            <div>
              <div className="ps-k">Cash</div>
              <div className="ps-sv mono">{money(portfolio.cash)}</div>
            </div>
          </div>
        </div>
      )}

      <div className="section-title">Stock Positions</div>
      {stocks.length === 0 && <div className="empty">No open positions</div>}
      {stocks.map((s) => {
        const px = eng?.price(s.symbol) ?? s.avgCost;
        const value = px * s.qty;
        const pl = (px - s.avgCost) * s.qty;
        const plPct = s.avgCost > 0 ? ((px - s.avgCost) / s.avgCost) * 100 * Math.sign(s.qty) : 0;
        return (
          <div className="pos-row" key={s.symbol}>
            <div className="col-l" style={{ cursor: 'pointer' }} onClick={() => setSymbol(s.symbol)}>
              <div className="sym">{s.symbol}</div>
              <div className="sub">
                {fmtQty(s.qty)} @ {fmtPrice(s.avgCost)} · mkt {fmtPrice(px)}
              </div>
            </div>
            <div className="col-r">
              <div className="val mono">{money(value)}</div>
              <div className={'pl mono ' + (pl >= 0 ? 'up' : 'down')}>
                {money(pl, { sign: true })} ({plPct >= 0 ? '+' : ''}
                {plPct.toFixed(1)}%)
              </div>
            </div>
            <button
              className="flat-btn"
              onClick={() => {
                const err = placeStockOrder(s.symbol, s.qty > 0 ? 'sell' : 'buy', Math.abs(s.qty));
                showToast(err ?? `Closed ${s.symbol}`);
              }}
            >
              Close
            </button>
          </div>
        );
      })}

      <div className="section-title">Options</div>
      {optionRows.length === 0 && <div className="empty">No option contracts</div>}
      {optionRows.map(({ o, mark, pl }) => (
        <div className="pos-row" key={o.id}>
          <div className="col-l" style={{ cursor: 'pointer' }} onClick={() => setSymbol(o.ref.symbol)}>
            <div className="sym">
              {o.ref.symbol} {fmtPrice(o.ref.strike)}
              {o.ref.type === 'call' ? 'C' : 'P'}
            </div>
            <div className="sub">
              {o.qty > 0 ? 'Long' : 'Short'} {Math.abs(o.qty)} @ {fmtPrice(o.avgPremium)} · {expLabel(o.ref.expiry, eng?.now ?? 0)}
            </div>
          </div>
          <div className="col-r">
            <div className="val mono">{fmtPrice(mark)}</div>
            <div className={'pl mono ' + (pl >= 0 ? 'up' : 'down')}>{money(pl, { sign: true })}</div>
          </div>
          <button className="flat-btn" onClick={() => { closeOption(o.id); showToast('Closed contract'); }}>
            Close
          </button>
        </div>
      ))}
    </div>
  );
}

function expLabel(expiry: number, now: number): string {
  const days = Math.max(0, Math.round((expiry - now) / 86400));
  return days === 0 ? 'exp today' : `${days}d`;
}
