import { useStore } from '../state/store';
import { sim } from '../state/sim';
import { useSimTick } from '../hooks/useSim';
import { money, pct } from '../util/format';

export function Hud() {
  useSimTick(300);
  const hud = useStore((s) => s.settings.hud);
  const portfolio = useStore((s) => s.portfolio);
  if (!hud.show) return null;

  const val = sim.getValuation();
  const equity = val?.equity ?? portfolio.cash;
  const openTrades = portfolio.stocks.filter((s) => Math.abs(s.qty) > 1e-9).length;
  const contracts = portfolio.options.reduce((a, o) => a + Math.abs(o.qty), 0);
  const dayPl = equity - portfolio.dayStartEquity;
  const dayPlPct = portfolio.dayStartEquity > 0 ? (dayPl / portfolio.dayStartEquity) * 100 : 0;
  const ytdPl = equity - portfolio.yearStartEquity;
  const ytdPlPct = portfolio.yearStartEquity > 0 ? (ytdPl / portfolio.yearStartEquity) * 100 : 0;

  const anyRow = hud.openTrades || hud.optionsHeld || hud.dayPnl || hud.ytdPnl || hud.buyingPower;

  return (
    <div className={'hud ' + hud.position}>
      {hud.balance && (
        <div>
          <div className="hud-grip">Account Value</div>
          <div className="hud-balance mono">{money(equity)}</div>
        </div>
      )}
      {anyRow && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {hud.dayPnl && (
            <Row k="Day P/L" cls={dayPl >= 0 ? 'up' : 'down'} v={`${money(dayPl, { sign: true })} (${pct(dayPlPct)})`} />
          )}
          {hud.ytdPnl && (
            <Row k="YTD P/L" cls={ytdPl >= 0 ? 'up' : 'down'} v={`${money(ytdPl, { sign: true })} (${pct(ytdPlPct)})`} />
          )}
          {hud.openTrades && <Row k="Open positions" v={String(openTrades)} />}
          {hud.optionsHeld && <Row k="Contracts" v={String(contracts)} />}
          {hud.buyingPower && <Row k="Buying power" v={money(val?.buyingPower ?? portfolio.cash)} />}
        </div>
      )}
    </div>
  );
}

function Row({ k, v, cls }: { k: string; v: string; cls?: string }) {
  return (
    <div className="hud-row">
      <span className="k">{k}</span>
      <span className={'v mono ' + (cls ?? '')}>{v}</span>
    </div>
  );
}
