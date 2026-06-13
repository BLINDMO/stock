import { useState } from 'react';
import { RISK_PROFILES, useStore, type OnboardingConfig } from '../state/store';
import type { Timeframe } from '../engine/market';
import { money } from '../util/format';

const CASH_PRESETS = [500, 1000, 5000, 10000, 25000, 100000, 500000, 1000000];

export function Onboarding({ canResume, onResume }: { canResume: boolean; onResume: () => void }) {
  const startWorld = useStore((s) => s.startWorld);
  const [step, setStep] = useState(0);
  const [cfg, setCfg] = useState<OnboardingConfig>({
    trader: '',
    startingCash: 10000,
    risk: 'balanced',
    theme: 'dark',
    enabledClasses: { stock: true, crypto: true },
    commissionFree: true,
    defaultTimeframe: '5m',
  });

  const patch = (p: Partial<OnboardingConfig>) => setCfg((c) => ({ ...c, ...p }));
  const TOTAL = 5;
  const canNext =
    step !== 2 || cfg.enabledClasses.stock || cfg.enabledClasses.crypto; // need ≥1 market
  const next = () => (step < TOTAL - 1 ? setStep(step + 1) : startWorld(cfg));
  const back = () => setStep(Math.max(0, step - 1));

  return (
    <div className="onboard">
      <div className="onboard-card">
        <div className="brand">
          <span className="dot" /> ORION
        </div>
        <div className="tagline">Markets, mastered.</div>

        <div className="steps-dots">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <div key={i} className={'d' + (i <= step ? ' on' : '')} />
          ))}
        </div>

        {step === 0 && (
          <div className="step">
            <h3>Welcome</h3>
            <p className="sub">Let's set up your account. What should we call you?</p>
            <input
              className="input"
              autoFocus
              placeholder="Your name"
              value={cfg.trader}
              onChange={(e) => patch({ trader: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && next()}
            />
            {canResume && (
              <button className="btn" style={{ marginTop: 16, width: '100%' }} onClick={onResume}>
                ↻ Continue existing account
              </button>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="step">
            <h3>Opening deposit</h3>
            <p className="sub">Start with any amount — your strategy scales from pocket money to a serious book.</p>
            <input
              className="input mono"
              type="number"
              min={1}
              value={cfg.startingCash}
              onChange={(e) => patch({ startingCash: Math.max(1, Number(e.target.value) || 0) })}
            />
            <div className="cash-presets">
              {CASH_PRESETS.map((v) => (
                <button
                  key={v}
                  className={cfg.startingCash === v ? 'sel' : ''}
                  onClick={() => patch({ startingCash: v })}
                >
                  {money(v, { compact: true })}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="step">
            <h3>Choose your markets</h3>
            <p className="sub">Trade equities, digital assets, or both. You can change this later.</p>
            <div className="option-cards two">
              <div
                className={'opt-card' + (cfg.enabledClasses.stock ? ' sel' : '')}
                onClick={() => patch({ enabledClasses: { ...cfg.enabledClasses, stock: !cfg.enabledClasses.stock } })}
              >
                <div className="t">📈 Stocks & ETFs</div>
                <div className="d">Blue chips, growth names and index funds with full options chains.</div>
              </div>
              <div
                className={'opt-card' + (cfg.enabledClasses.crypto ? ' sel' : '')}
                onClick={() => patch({ enabledClasses: { ...cfg.enabledClasses, crypto: !cfg.enabledClasses.crypto } })}
              >
                <div className="t">₿ Crypto</div>
                <div className="d">30+ coins trading 24/7, from majors to high-volatility movers.</div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="step">
            <h3>Risk appetite</h3>
            <p className="sub">This tunes how lively the markets feel. There are no rigged outcomes either way.</p>
            <div className="option-cards">
              {Object.values(RISK_PROFILES).map((r) => (
                <div
                  key={r.key}
                  className={'opt-card' + (cfg.risk === r.key ? ' sel' : '')}
                  onClick={() => patch({ risk: r.key })}
                >
                  <div className="t">{r.label}</div>
                  <div className="d">
                    {r.key === 'conservative' && 'Calmer swings, steadier trends. Easier to learn the ropes.'}
                    {r.key === 'balanced' && 'True-to-life volatility across the board. The default experience.'}
                    {r.key === 'aggressive' && 'Bigger moves and sharper reversals. High risk, high reward.'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="step">
            <h3>Finishing touches</h3>
            <p className="sub">Personalize the look and your default chart.</p>
            <label className="field" style={{ margin: '0 0 14px' }}>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>Theme</span>
              <div className="option-cards" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginTop: 6 }}>
                {(['dark', 'midnight', 'light'] as const).map((t) => (
                  <div key={t} className={'opt-card' + (cfg.theme === t ? ' sel' : '')} onClick={() => patch({ theme: t })}>
                    <div className="t" style={{ textTransform: 'capitalize', fontSize: 13 }}>{t}</div>
                  </div>
                ))}
              </div>
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ flex: 1 }}>
                <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>Default timeframe</span>
                <select
                  className="input"
                  style={{ marginTop: 6 }}
                  value={cfg.defaultTimeframe}
                  onChange={(e) => patch({ defaultTimeframe: e.target.value as Timeframe })}
                >
                  {['1m', '5m', '15m', '1h', '4h', '1D'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label style={{ flex: 1 }}>
                <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>Commissions</span>
                <select
                  className="input"
                  style={{ marginTop: 6 }}
                  value={cfg.commissionFree ? 'free' : 'std'}
                  onChange={(e) => patch({ commissionFree: e.target.value === 'free' })}
                >
                  <option value="free">Commission-free</option>
                  <option value="std">Standard ($4.95 + $0.65/contract)</option>
                </select>
              </label>
            </div>
          </div>
        )}

        <div className="onboard-nav">
          {step > 0 && (
            <button className="btn" onClick={back}>
              Back
            </button>
          )}
          <button className="btn primary" onClick={next} disabled={!canNext}>
            {step === TOTAL - 1 ? 'Open account →' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
