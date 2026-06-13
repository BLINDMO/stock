import { useState } from 'react';
import { useStore } from '../state/store';
import { sim } from '../state/sim';
import { useSimTick } from '../hooks/useSim';
import type { LinkedBank } from '../engine/types';
import { money } from '../util/format';

const DEFAULT_BANK = 'Commerce';
const DEFAULT_LAST4 = '8186';

export function BankingModal({ onClose }: { onClose: () => void }) {
  useSimTick(400);
  const portfolio = useStore((s) => s.portfolio);
  const linkedBank = useStore((s) => s.settings.linkedBank);
  const deposit = useStore((s) => s.deposit);
  const withdraw = useStore((s) => s.withdraw);
  const showToast = useStore((s) => s.showToast);

  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  // Withdrawal requires confirming the destination bank account details.
  const [holder, setHolder] = useState(linkedBank?.holder ?? '');
  const [accountNo, setAccountNo] = useState(linkedBank ? `••••${linkedBank.last4}` : '');
  const [routing, setRouting] = useState('');

  const val = sim.getValuation();
  const available = val?.buyingPower ?? portfolio.cash;
  const amt = Math.max(0, Number(amount.replace(/[^0-9.]/g, '')) || 0);

  const submitDeposit = () => {
    const err = deposit(amt);
    if (err) return showToast(err);
    showToast(`Deposited ${money(amt)}`);
    onClose();
  };

  const submitWithdraw = () => {
    const last4 = (accountNo.replace(/\D/g, '').slice(-4)) || DEFAULT_LAST4;
    if (!holder.trim()) return showToast('Enter the account holder name');
    if (accountNo.replace(/\D/g, '').length < 4) return showToast('Enter a valid account number');
    const bank: LinkedBank = { bank: DEFAULT_BANK, last4, holder: holder.trim() };
    const err = withdraw(amt, bank);
    if (err) return showToast(err);
    showToast(`${money(amt)} sent to ${bank.bank} ••${last4}`);
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Banking</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-tabs">
          <button className={tab === 'deposit' ? 'active' : ''} onClick={() => setTab('deposit')}>Deposit</button>
          <button className={tab === 'withdraw' ? 'active' : ''} onClick={() => setTab('withdraw')}>Withdraw</button>
        </div>
        <div className="modal-body">
          <div className="bank-balance">
            <div>
              <div className="k">Available to {tab === 'deposit' ? 'fund from' : 'withdraw'}</div>
              <div className="v mono">{tab === 'deposit' ? 'External account' : money(available)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="k">Cash balance</div>
              <div className="v mono">{money(portfolio.cash)}</div>
            </div>
          </div>

          {/* Linked external account card */}
          <div className="bank-card">
            <div className="bank-card-row">
              <span className="bank-logo">🏦</span>
              <div>
                <div className="bank-name">{DEFAULT_BANK} Bank</div>
                <div className="bank-acct mono">Checking ••••{linkedBank?.last4 ?? DEFAULT_LAST4}</div>
              </div>
              <span className="bank-status">Linked</span>
            </div>
          </div>

          <div className="field" style={{ margin: '16px 0 0' }}>
            <label>Amount (USD)</label>
            <div className="control">
              <input
                className="mono"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                autoFocus
              />
            </div>
          </div>
          <div className="chips" style={{ margin: '8px 0 0' }}>
            {(tab === 'deposit' ? [100, 1000, 10000, 100000] : [0.25, 0.5, 1]).map((p) => (
              <button
                key={p}
                onClick={() =>
                  tab === 'deposit'
                    ? setAmount(String(p))
                    : setAmount((available * (p as number)).toFixed(2))
                }
              >
                {tab === 'deposit' ? money(p as number, { compact: true }) : p === 1 ? 'All' : `${(p as number) * 100}%`}
              </button>
            ))}
          </div>

          {tab === 'withdraw' && (
            <div style={{ marginTop: 18 }}>
              <div className="section-title" style={{ padding: '0 0 8px' }}>Destination bank account</div>
              <div className="field" style={{ margin: 0 }}>
                <label>Account holder</label>
                <input className="input" placeholder="Full name" value={holder} onChange={(e) => setHolder(e.target.value)} />
              </div>
              <div className="field" style={{ margin: '10px 0 0' }}>
                <label>Account number</label>
                <input className="input mono" placeholder={`••••${DEFAULT_LAST4}`} value={accountNo} onChange={(e) => setAccountNo(e.target.value)} />
              </div>
              <div className="field" style={{ margin: '10px 0 0' }}>
                <label>Routing number (optional)</label>
                <input className="input mono" placeholder="Commerce Bank" value={routing} onChange={(e) => setRouting(e.target.value)} />
              </div>
            </div>
          )}

          <button
            className={'submit ' + (tab === 'deposit' ? 'buy' : 'sell')}
            style={{ marginTop: 18 }}
            disabled={amt <= 0}
            onClick={tab === 'deposit' ? submitDeposit : submitWithdraw}
          >
            {tab === 'deposit' ? `Deposit ${amt > 0 ? money(amt) : ''}` : `Withdraw ${amt > 0 ? money(amt) : ''}`}
          </button>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'center', marginTop: 10 }}>
            {tab === 'deposit'
              ? 'Funds are available to trade instantly.'
              : `Transfers settle to ${DEFAULT_BANK} Bank ••••${linkedBank?.last4 ?? DEFAULT_LAST4}.`}
          </div>
        </div>
      </div>
    </div>
  );
}
