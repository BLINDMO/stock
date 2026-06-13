import { useState } from 'react';
import { RISK_PROFILES, useStore } from '../state/store';
import { sim } from '../state/sim';
import type { HudConfig, RiskProfile, Settings } from '../engine/types';

type Tab = 'general' | 'display' | 'account';

export function SettingsModal({ onClose, onStats }: { onClose: () => void; onStats: () => void }) {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const setHud = useStore((s) => s.setHud);
  const restart = useStore((s) => s.restart);
  const [tab, setTab] = useState<Tab>('general');
  const [confirmRestart, setConfirmRestart] = useState(false);

  const setTheme = (theme: Settings['theme']) => setSettings({ theme });
  const setRisk = (risk: RiskProfile['key']) => {
    setSettings({ risk });
    const r = RISK_PROFILES[risk];
    sim.engine?.setRisk(r.volMult, r.driftMult);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-tabs">
          {(['general', 'display', 'account'] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="modal-body">
          {tab === 'general' && (
            <>
              <Field label="Theme">
                <select className="input" value={settings.theme} onChange={(e) => setTheme(e.target.value as Settings['theme'])}>
                  <option value="dark">Dark</option>
                  <option value="midnight">Midnight</option>
                  <option value="light">Light</option>
                </select>
              </Field>
              <Field label="Market behavior" desc="Tunes overall volatility and trend strength.">
                <select className="input" value={settings.risk} onChange={(e) => setRisk(e.target.value as RiskProfile['key'])}>
                  {Object.values(RISK_PROFILES).map((r) => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Commissions">
                <select
                  className="input"
                  value={settings.commissionPerTrade > 0 ? 'std' : 'free'}
                  onChange={(e) =>
                    setSettings(
                      e.target.value === 'free'
                        ? { commissionPerTrade: 0, optionCommission: 0 }
                        : { commissionPerTrade: 4.95, optionCommission: 0.65 },
                    )
                  }
                >
                  <option value="free">Commission-free</option>
                  <option value="std">Standard ($4.95 + $0.65/contract)</option>
                </select>
              </Field>
            </>
          )}

          {tab === 'display' && (
            <>
              <Toggle
                label="Show info overlay (HUD)"
                desc="The floating account panel on the chart."
                on={settings.hud.show}
                onChange={(v) => setHud({ show: v })}
              />
              <Field label="Overlay position">
                <select
                  className="input"
                  value={settings.hud.position}
                  onChange={(e) => setHud({ position: e.target.value as HudConfig['position'] })}
                >
                  <option value="tl">Top left</option>
                  <option value="tr">Top right</option>
                  <option value="bl">Bottom left</option>
                  <option value="br">Bottom right</option>
                </select>
              </Field>
              <div className="section-title" style={{ padding: '14px 0 4px' }}>Overlay fields</div>
              <Toggle label="Account value" on={settings.hud.balance} onChange={(v) => setHud({ balance: v })} />
              <Toggle label="Day P/L" on={settings.hud.dayPnl} onChange={(v) => setHud({ dayPnl: v })} />
              <Toggle label="Year-to-date P/L" on={settings.hud.ytdPnl} onChange={(v) => setHud({ ytdPnl: v })} />
              <Toggle label="Open positions" on={settings.hud.openTrades} onChange={(v) => setHud({ openTrades: v })} />
              <Toggle label="Contracts held" on={settings.hud.optionsHeld} onChange={(v) => setHud({ optionsHeld: v })} />
              <Toggle label="Buying power" on={settings.hud.buyingPower} onChange={(v) => setHud({ buyingPower: v })} />
            </>
          )}

          {tab === 'account' && (
            <>
              <div className="setting-row">
                <div>
                  <div className="label">View statistics</div>
                  <div className="desc">Performance, win rate and trade history.</div>
                </div>
                <button className="btn" onClick={onStats}>Open</button>
              </div>
              <div className="setting-row" style={{ borderBottom: 'none' }}>
                <div>
                  <div className="label">Restart account</div>
                  <div className="desc">Wipes your world and returns to onboarding. This cannot be undone.</div>
                </div>
                {confirmRestart ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" onClick={() => setConfirmRestart(false)}>Cancel</button>
                    <button className="btn danger" onClick={() => { restart(); onClose(); }}>Confirm</button>
                  </div>
                ) : (
                  <button className="btn danger" onClick={() => setConfirmRestart(true)}>Restart</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {desc && <div className="desc" style={{ marginBottom: 8 }}>{desc}</div>}
      {children}
    </div>
  );
}

function Toggle({ label, desc, on, onChange }: { label: string; desc?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="setting-row">
      <div>
        <div className="label">{label}</div>
        {desc && <div className="desc">{desc}</div>}
      </div>
      <button className={'toggle' + (on ? ' on' : '')} onClick={() => onChange(!on)} />
    </div>
  );
}
