import React, { useState } from 'react';
import { Account, AccountType } from '../../types';
import { X } from 'lucide-react';

interface AccountFormProps {
  initialData?: Account | null;
  onClose: () => void;
  onSubmit: (data: Omit<Account, 'id'>) => void;
}

const LIABILITY_TYPES = [AccountType.CREDIT, AccountType.DEBT, AccountType.LOAN];
const ASSET_TYPES = [AccountType.CHECKING, AccountType.SAVINGS, AccountType.INVESTMENT, AccountType.CASH];

function getInitialBalance(data: Account | null | undefined): string {
  if (!data) return '';
  const isLiability = LIABILITY_TYPES.includes(data.type);
  if (isLiability && data.balance < 0) {
    return Math.abs(data.balance).toString();
  }
  return data.balance.toString();
}

export const AccountForm: React.FC<AccountFormProps> = ({ initialData, onClose, onSubmit }) => {
  const [name, setName] = useState(initialData?.name ?? '');
  const [type, setType] = useState<AccountType>(initialData?.type ?? AccountType.CHECKING);
  const [balance, setBalance] = useState(getInitialBalance(initialData));
  const [color, setColor] = useState(initialData?.color ?? '#6366f1');
  const [goal, setGoal] = useState(initialData?.goal ? initialData.goal.toString() : '');
  const [deadline, setDeadline] = useState(initialData?.deadline ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    let finalBalance = parseFloat(balance) || 0;

    if (LIABILITY_TYPES.includes(type) && finalBalance > 0) {
      finalBalance = -finalBalance;
    }

    const isAsset = ASSET_TYPES.includes(type);
    onSubmit({
      name,
      type,
      balance: finalBalance,
      color,
      goal: isAsset && goal ? parseFloat(goal) : null,
      deadline: isAsset && deadline ? deadline : null,
    });
    onClose();
  };

  const isLiability = LIABILITY_TYPES.includes(type);
  const isAsset = ASSET_TYPES.includes(type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--bg-secondary)] rounded-xl shadow-2xl w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6">
          {initialData ? 'Edit Account' : 'New Account'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Account Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)] outline-none"
              placeholder={isLiability ? 'e.g. Student Loan' : 'e.g. Chase Sapphire'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Account Type</label>
            <select
              value={type}
              onChange={(e) => {
                const newType = e.target.value as AccountType;
                setType(newType);
                if (LIABILITY_TYPES.includes(newType)) {
                  setGoal('');
                  setDeadline('');
                }
              }}
              className="w-full px-4 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)] outline-none"
            >
              {Object.values(AccountType).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              {isLiability ? 'Amount Owed (Positive Value)' : 'Current Balance'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">$</span>
              <input
                type="number"
                step="0.01"
                required
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="w-full pl-8 pr-4 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)] outline-none"
                placeholder="0.00"
              />
            </div>
            {isLiability ? (
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Enter the amount you owe. We&apos;ll store it as a negative balance automatically.
              </p>
            ) : (
              initialData && (
                <p className="text-xs text-amber-600 mt-1">
                  Warning: Editing balance directly may cause discrepancies with transaction
                  history.
                </p>
              )
            )}
          </div>

          {isAsset && (
            <div className="border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Savings Goal (Optional)
              </p>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Target Balance
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)] outline-none"
                    placeholder="e.g. 10000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Target Date
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)] outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Color Tag</label>
            <div className="flex gap-2">
              {[
                '#6366f1',
                '#10b981',
                '#ef4444',
                '#f59e0b',
                '#8b5cf6',
                '#ec4899',
                '#06b6d4',
                '#64748b',
              ].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-[var(--border-strong)] scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md transition-colors mt-2"
          >
            {initialData ? 'Save Changes' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
};
