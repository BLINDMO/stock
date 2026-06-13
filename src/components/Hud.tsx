import { useStore } from '../state/store';
import { sim } from '../state/sim';
import { useSimTick } from '../hooks/useSim';
import { useIsMobile } from '../hooks/useIsMobile';
import { money, pct } from '../util/format';

export function Hud() {
  useSimTick(300);
  const isMobile = useIsMobile();
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
  const bp = val?.buyingPower ?? portfolio.cash;

  // Mobile: a slim ribbon docked below the chart so candles stay fully visible.
  if (isMobile) {
    return (
      <div className="hud-ribbon">
        {hud.balance && (
          <div className="chip chip-balance">
            <span className="ck">Value</span>
            <span className="cv mono">{money(equity, { compact: true })}</span>
          </div>
        )}
        {hud.dayPnl && (
          <div className="chip">
            <span className="ck">Day</span>
            <span className={'cv mono ' + (dayPl >= 0 ? 'up' : 'down')}>{money(dayPl, { sign: true, compact: true })} <i>{pct(dayPlPct)}</i></span>
          </div>
        )}
        {hud.ytdPnl && (
          <div className="chip">
            <span className="ck">YTD</span>
            <span className={'cv mono ' + (ytdPl >= 0 ? 'up' : 'down')}>{money(ytdPl, { sign: true, compact: true })}</span>
          </div>
        )}
        {hud.openTrades && (
          <div className="chip">
            <span className="ck">Pos</span>
            <span className="cv mono">{openTrades}</span>
          </div>
        )}
        {hud.optionsHeld && (
          <div className="chip">
            <span className="ck">Opt</span>
            <span className="cv mono">{contracts}</span>
          </div>
        )}
        {hud.buyingPower && (
          <div className="chip">
            <span className="ck">BP</span>
            <span className="cv mono">{money(bp, { compact: true })}</span>
          </div>
        )}
      </div>
    );
  }

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
          {hud.dayPnl && <Row k="Day P/L" cls={dayPl >= 0 ? 'up' : 'down'} v={`${money(dayPl, { sign: true })} (${pct(dayPlPct)})`} />}
          {hud.ytdPnl && <Row k="YTD P/L" cls={ytdPl >= 0 ? 'up' : 'down'} v={`${money(ytdPl, { sign: true })} (${pct(ytdPlPct)})`} />}
          {hud.openTrades && <Row k="Open positions" v={String(openTrades)} />}
          {hud.optionsHeld && <Row k="Contracts" v={String(contracts)} />}
          {hud.buyingPower && <Row k="Buying power" v={money(bp)} />}
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
