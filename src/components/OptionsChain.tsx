import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { sim } from '../state/sim';
import { useSimTick } from '../hooks/useSim';
import { ASSET_MAP } from '../engine/assets';
import {
  blackScholes,
  buildExpiries,
  buildStrikes,
  smileIv,
} from '../engine/options';
import { CONTRACT_MULTIPLIER, RISK_FREE_RATE } from '../engine/portfolio';
import type { OptionContractRef, OptionType } from '../engine/types';
import { money, price as fmtPrice } from '../util/format';

export function OptionsChain({ onClose }: { onClose: () => void }) {
  useSimTick(500);
  const symbol = useStore((s) => s.symbol);
  const tradeOption = useStore((s) => s.tradeOption);
  const showToast = useStore((s) => s.showToast);
  const def = ASSET_MAP[symbol];
  const eng = sim.engine;
  const now = eng?.now ?? 0;
  const spot = eng?.price(symbol) ?? def?.seedPrice ?? 0;
  const baseIv = sim.ivFor(symbol);

  const expiries = useMemo(() => buildExpiries(now), [Math.floor(now / 86400)]);
  const [expIdx, setExpIdx] = useState(0);
  const expiry = expiries[Math.min(expIdx, expiries.length - 1)];
  const strikes = useMemo(() => buildStrikes(spot, 13), [Math.round(spot * 100)]);

  const [selected, setSelected] = useState<OptionContractRef | null>(null);
  const [qty, setQty] = useState(1);

  if (!def?.optionable) {
    return (
      <Shell symbol={symbol} onClose={onClose}>
        <div className="empty">Options are not listed for {symbol}.</div>
      </Shell>
    );
  }

  const t = Math.max(1 / 365 / 24, (expiry.expiry - now) / (365 * 86400));

  function quote(type: OptionType, strike: number) {
    const iv = smileIv(baseIv, spot, strike, t);
    return blackScholes({ spot, strike, t, r: RISK_FREE_RATE, vol: iv, type });
  }

  const sel = selected ? quote(selected.type, selected.strike) : null;
  const selCost = sel ? sel.price * qty * CONTRACT_MULTIPLIER : 0;

  return (
    <Shell symbol={symbol} onClose={onClose} spot={spot}>
      <div className="expiry-bar">
        {expiries.map((e, i) => (
          <button key={e.expiry} className={i === expIdx ? 'active' : ''} onClick={() => setExpIdx(i)}>
            {e.label} · {e.days}d
          </button>
        ))}
      </div>

      <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        <table className="chain-table">
          <thead>
            <tr>
              <th colSpan={3} style={{ color: 'var(--up)' }}>CALLS</th>
              <th>Strike</th>
              <th colSpan={3} style={{ color: 'var(--down)' }}>PUTS</th>
            </tr>
            <tr>
              <th>Δ</th>
              <th>Bid</th>
              <th>Ask</th>
              <th></th>
              <th>Bid</th>
              <th>Ask</th>
              <th>Δ</th>
            </tr>
          </thead>
          <tbody>
            {strikes.map((k) => {
              const c = quote('call', k);
              const p = quote('put', k);
              const callItm = k < spot;
              const putItm = k > spot;
              const cRef: OptionContractRef = { symbol, type: 'call', strike: k, expiry: expiry.expiry };
              const pRef: OptionContractRef = { symbol, type: 'put', strike: k, expiry: expiry.expiry };
              const isSel = (r: OptionContractRef) =>
                selected && selected.type === r.type && selected.strike === r.strike;
              const spread = (x: number) => Math.max(0.01, x * 0.015);
              return (
                <tr key={k}>
                  <td className={'calls-side' + (callItm ? ' itm' : '') + (isSel(cRef) ? ' active' : '')} onClick={() => sel3(cRef)}>
                    {c.delta.toFixed(2)}
                  </td>
                  <td className={'calls-side' + (callItm ? ' itm' : '')} onClick={() => sel3(cRef)}>
                    {fmtPrice(Math.max(0, c.price - spread(c.price)))}
                  </td>
                  <td className={'calls-side' + (callItm ? ' itm' : '')} onClick={() => sel3(cRef)}>
                    {fmtPrice(c.price + spread(c.price))}
                  </td>
                  <td className="strike-col">{fmtPrice(k)}</td>
                  <td className={'puts-side' + (putItm ? ' itm' : '')} onClick={() => sel3(pRef)}>
                    {fmtPrice(Math.max(0, p.price - spread(p.price)))}
                  </td>
                  <td className={'puts-side' + (putItm ? ' itm' : '')} onClick={() => sel3(pRef)}>
                    {fmtPrice(p.price + spread(p.price))}
                  </td>
                  <td className={'puts-side' + (putItm ? ' itm' : '')} onClick={() => sel3(pRef)}>
                    {p.delta.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && sel && (
        <div style={{ marginTop: 16, padding: 16, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {symbol} {fmtPrice(selected.strike)} {selected.type === 'call' ? 'Call' : 'Put'} · {expiry.label}
            </div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{fmtPrice(sel.price)}</div>
          </div>
          <div className="greeks" style={{ margin: '0 0 12px' }}>
            <Greek k="Delta" v={sel.delta.toFixed(3)} />
            <Greek k="Gamma" v={sel.gamma.toFixed(4)} />
            <Greek k="Theta" v={sel.theta.toFixed(3)} />
            <Greek k="Vega" v={sel.vega.toFixed(3)} />
          </div>

          {(() => {
            const premium = sel.price + Math.max(0.01, sel.price * 0.015); // ask
            const isCall = selected.type === 'call';
            const breakeven = isCall ? selected.strike + premium : selected.strike - premium;
            const cost = premium * qty * CONTRACT_MULTIPLIER;
            const moves = isCall ? [0.05, 0.1, 0.2] : [-0.05, -0.1, -0.2];
            const rows = moves.map((mv) => {
              const target = spot * (1 + mv);
              const intrinsic = isCall ? Math.max(0, target - selected.strike) : Math.max(0, selected.strike - target);
              const pl = (intrinsic - premium) * qty * CONTRACT_MULTIPLIER;
              return { mv, target, pl, plPct: cost > 0 ? (pl / cost) * 100 : 0 };
            });
            return (
              <div className="be-panel">
                <div className="be-head">
                  <span>Breakeven at expiry</span>
                  <b className="mono">{fmtPrice(breakeven)}</b>
                </div>
                <div className="be-sub">Projected profit/loss if {symbol} reaches:</div>
                <div className="be-rows">
                  {rows.map((r) => (
                    <div className="be-row" key={r.mv}>
                      <span className="be-target mono">
                        {fmtPrice(r.target)}
                        <span className="be-move">{r.mv > 0 ? '+' : ''}{(r.mv * 100).toFixed(0)}%</span>
                      </span>
                      <span className={'be-pl mono ' + (r.pl >= 0 ? 'up' : 'down')}>
                        {money(r.pl, { sign: true })}
                        <span className="be-pct">{r.plPct >= 0 ? '+' : ''}{r.plPct.toFixed(0)}%</span>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="be-foot">Max loss {money(cost)} · Max gain {isCall ? 'unlimited' : money((selected.strike - premium) * qty * CONTRACT_MULTIPLIER)}</div>
              </div>
            );
          })()}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
            <div style={{ flex: '0 0 110px' }}>
              <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>Contracts</label>
              <input
                className="input mono"
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                style={{ marginTop: 4 }}
              />
            </div>
            <div style={{ flex: 1, fontSize: 12, color: 'var(--text-dim)' }}>
              <div>
                Debit to buy: <b className="mono" style={{ color: 'var(--text)' }}>{money(selCost)}</b>
              </div>
              <div>
                ≈ {qty * CONTRACT_MULTIPLIER} shares exposure · IV {(sel.iv * 100).toFixed(1)}%
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button
              className="submit buy"
              style={{ margin: 0, width: 'auto', flex: 1 }}
              onClick={() => act('buy')}
            >
              Buy to Open
            </button>
            <button
              className="submit sell"
              style={{ margin: 0, width: 'auto', flex: 1 }}
              onClick={() => act('sell')}
            >
              Sell / Write
            </button>
          </div>
        </div>
      )}
    </Shell>
  );

  function sel3(r: OptionContractRef) {
    setSelected(r);
  }
  function act(sideBuySell: 'buy' | 'sell') {
    if (!selected) return;
    const err = tradeOption(selected, sideBuySell, qty);
    if (err) showToast(err);
    else {
      showToast(`${sideBuySell === 'buy' ? 'Bought' : 'Sold'} ${qty} ${symbol} ${selected.type}`);
      onClose();
    }
  }
}

function Greek({ k, v }: { k: string; v: string }) {
  return (
    <div className="g">
      <div className="k">{k}</div>
      <div className="v mono">{v}</div>
    </div>
  );
}

function Shell({
  symbol,
  spot,
  onClose,
  children,
}: {
  symbol: string;
  spot?: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>
            {symbol} Options{' '}
            {spot !== undefined && (
              <span style={{ color: 'var(--text-dim)', fontWeight: 500, fontSize: 14 }}>
                · Spot {fmtPrice(spot)}
              </span>
            )}
          </h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
