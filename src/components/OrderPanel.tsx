import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { sim } from '../state/sim';
import { useSimTick } from '../hooks/useSim';
import { ASSET_MAP } from '../engine/assets';
import { Positions } from './Positions';
import { money, price as fmtPrice, qty as fmtQty } from '../util/format';

export function OrderPanel({ onOpenChain, hidePositions = false }: { onOpenChain: () => void; hidePositions?: boolean }) {
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

      {!hidePositions && <Positions />}
    </div>
  );
}
