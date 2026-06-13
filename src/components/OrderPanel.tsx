import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { sim } from '../state/sim';
import { useSimTick } from '../hooks/useSim';
import { ASSET_MAP } from '../engine/assets';
import { CONTRACT_MULTIPLIER } from '../engine/portfolio';
import { money, price as fmtPrice, qty as fmtQty } from '../util/format';

export function OrderPanel({ onOpenChain }: { onOpenChain: () => void }) {
  useSimTick(220);
  const symbol = useStore((s) => s.symbol);
  const def = ASSET_MAP[symbol];
  const placeStockOrder = useStore((s) => s.placeStockOrder);
  const showToast = useStore((s) => s.showToast);
  const portfolio = useStore((s) => s.portfolio);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [qtyStr, setQtyStr] = useState('1');

  // Reset quantity when switching instruments to a sensible default.
  useEffect(() => {
    setQtyStr(def?.class === 'crypto' ? '0.1' : '1');
  }, [symbol, def?.class]);

  const px = sim.engine?.price(symbol) ?? def?.seedPrice ?? 0;
  const val = sim.getValuation();
  const buyingPower = val?.buyingPower ?? portfolio.cash;
  const held = portfolio.stocks.find((s) => s.symbol === symbol)?.qty ?? 0;
  const qtyNum = Math.max(0, Number(qtyStr) || 0);
  const notional = qtyNum * px;
  const commission = useStore((s) => s.settings.commissionPerTrade);

  const step = def?.class === 'crypto' ? 0.01 : 1;
  const bump = (d: number) => {
    const next = Math.max(0, +(qtyNum + d).toFixed(8));
    setQtyStr(String(next));
  };
  const setPctOfPower = (p: number) => {
    if (px <= 0) return;
    const raw = (buyingPower * p) / px;
    setQtyStr(def?.class === 'crypto' ? raw.toFixed(6) : String(Math.floor(raw)));
  };

  const canSubmit =
    qtyNum > 0 && (side === 'buy' ? notional + commission <= buyingPower : qtyNum <= held + 1e-9);

  const submit = () => {
    const err = placeStockOrder(symbol, side, qtyNum);
    if (err) showToast(err);
    else showToast(`${side === 'buy' ? 'Bought' : 'Sold'} ${fmtQty(qtyNum)} ${symbol}`);
  };

  return (
    <div className="panel right">
      <div className="panel-head">
        <span>Order · {symbol}</span>
        {def?.optionable && (
          <button className="flat-btn" onClick={onOpenChain} style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
            Options ▸
          </button>
        )}
      </div>

      <div className="seg">
        <button className={'buy' + (side === 'buy' ? ' active' : '')} onClick={() => setSide('buy')}>
          Buy
        </button>
        <button className={'sell' + (side === 'sell' ? ' active' : '')} onClick={() => setSide('sell')}>
          Sell
        </button>
      </div>

      <div className="field">
        <label>Quantity {def?.class === 'crypto' ? `(${symbol})` : '(shares)'}</label>
        <div className="control">
          <input
            className="mono"
            inputMode="decimal"
            value={qtyStr}
            onChange={(e) => setQtyStr(e.target.value.replace(/[^0-9.]/g, ''))}
          />
          <div className="stepper">
            <button onClick={() => bump(step)}>▲</button>
            <button onClick={() => bump(-step)}>▼</button>
          </div>
        </div>
      </div>
      <div className="chips">
        {(side === 'buy' ? [0.25, 0.5, 0.75, 1] : [0.25, 0.5, 0.75, 1]).map((p) => (
          <button
            key={p}
            onClick={() =>
              side === 'buy'
                ? setPctOfPower(p)
                : setQtyStr(def?.class === 'crypto' ? (held * p).toFixed(6) : String(Math.floor(held * p)))
            }
          >
            {p === 1 ? (side === 'buy' ? 'Max' : 'All') : `${p * 100}%`}
          </button>
        ))}
      </div>

      <div className="order-summary">
        <div className="row">
          <span>Market price</span>
          <b className="mono">{fmtPrice(px)}</b>
        </div>
        <div className="row">
          <span>Estimated {side === 'buy' ? 'cost' : 'credit'}</span>
          <b className="mono">{money(notional)}</b>
        </div>
        {commission > 0 && (
          <div className="row">
            <span>Commission</span>
            <b className="mono">{money(commission)}</b>
          </div>
        )}
        <div className="row">
          <span>Buying power</span>
          <b className="mono">{money(buyingPower)}</b>
        </div>
        {held !== 0 && (
          <div className="row">
            <span>Position</span>
            <b className="mono">{fmtQty(held)} {symbol}</b>
          </div>
        )}
      </div>

      <button className={'submit ' + side} disabled={!canSubmit} onClick={submit}>
        {side === 'buy' ? 'Buy' : 'Sell'} {symbol}
      </button>

      <Positions />
    </div>
  );
}

function Positions() {
  useSimTick(300);
  const portfolio = useStore((s) => s.portfolio);
  const setSymbol = useStore((s) => s.setSymbol);
  const placeStockOrder = useStore((s) => s.placeStockOrder);
  const closeOption = useStore((s) => s.closeOption);
  const showToast = useStore((s) => s.showToast);
  const eng = sim.engine;

  const stocks = portfolio.stocks.filter((s) => Math.abs(s.qty) > 1e-9);
  const options = portfolio.options;

  const optionRows = useMemo(
    () =>
      options.map((o) => {
        const mark = sim.optionPrice(o);
        const cost = o.avgPremium;
        const pl = (mark - cost) * o.qty * CONTRACT_MULTIPLIER;
        return { o, mark, pl };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options, eng?.now],
  );

  return (
    <div>
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
                {fmtQty(s.qty)} @ {fmtPrice(s.avgCost)}
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
