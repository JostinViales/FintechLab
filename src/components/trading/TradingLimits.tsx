import React, { useState, useMemo } from 'react';
import { Shield, AlertTriangle, Trash2 } from 'lucide-react';
import type { TradingLimit, TradingLimitStatus, Trade } from '@/types';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/format';

interface TradingLimitsProps {
  limits: TradingLimit[];
  trades: Trade[];
  onSave: (limit: Omit<TradingLimit, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete: (id: string) => void;
}

const PERIOD_TYPES = ['daily', 'weekly', 'monthly'] as const;

const computeLimitStatus = (limit: TradingLimit, trades: Trade[]): TradingLimitStatus => {
  const now = new Date();
  let periodStart: Date;

  switch (limit.periodType) {
    case 'daily':
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'weekly': {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
      break;
    }
    case 'monthly':
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }

  const periodTrades = trades.filter((t) => new Date(t.tradedAt) >= periodStart);
  const currentTrades = periodTrades.length;
  const currentLoss = Math.abs(
    periodTrades
      .filter((t) => (t.realizedPnl ?? 0) < 0)
      .reduce((s, t) => s + (t.realizedPnl ?? 0), 0),
  );
  const currentCapital = periodTrades.reduce((s, t) => s + t.total, 0);

  return {
    limit,
    currentTrades,
    currentLoss,
    currentCapital,
    tradesExceeded: limit.maxTrades != null && currentTrades >= limit.maxTrades,
    lossExceeded: limit.maxLoss != null && currentLoss >= limit.maxLoss,
    capitalExceeded: limit.maxCapital != null && currentCapital >= limit.maxCapital,
  };
};

const LimitBar: React.FC<{
  current: number;
  max: number;
  label: string;
  format: (v: number) => string;
}> = ({ current, max, label, format }) => {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className="text-[var(--text-primary)]">
          {format(current)} / {format(max)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[var(--bg-tertiary)]">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export const TradingLimits: React.FC<TradingLimitsProps> = ({
  limits,
  trades,
  onSave,
  onDelete,
}) => {
  const [editingPeriod, setEditingPeriod] = useState<string | null>(null);
  const [maxTrades, setMaxTrades] = useState('');
  const [maxLoss, setMaxLoss] = useState('');
  const [maxCapital, setMaxCapital] = useState('');

  const statuses = useMemo(() => {
    return limits.map((l) => computeLimitStatus(l, trades));
  }, [limits, trades]);

  const handleEdit = (period: string) => {
    const existing = limits.find((l) => l.periodType === period);
    setEditingPeriod(period);
    setMaxTrades(existing?.maxTrades?.toString() ?? '');
    setMaxLoss(existing?.maxLoss?.toString() ?? '');
    setMaxCapital(existing?.maxCapital?.toString() ?? '');
  };

  const handleSave = (period: string) => {
    onSave({
      periodType: period as TradingLimit['periodType'],
      maxTrades: maxTrades ? parseInt(maxTrades, 10) : undefined,
      maxLoss: maxLoss ? parseFloat(maxLoss) : undefined,
      maxCapital: maxCapital ? parseFloat(maxCapital) : undefined,
      isActive: true,
    });
    setEditingPeriod(null);
    setMaxTrades('');
    setMaxLoss('');
    setMaxCapital('');
  };

  const inputClass =
    'w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]';

  return (
    <Card
      title="Trading Limits"
      action={<Shield size={16} className="text-[var(--text-muted)]" />}
    >
      <div className="space-y-6">
        {PERIOD_TYPES.map((period) => {
          const existing = limits.find((l) => l.periodType === period);
          const status = statuses.find((s) => s.limit.periodType === period);
          const isEditing = editingPeriod === period;
          const anyExceeded =
            status &&
            (status.tradesExceeded || status.lossExceeded || status.capitalExceeded);

          return (
            <div
              key={period}
              className="pb-6 border-b border-[var(--border-subtle)] last:border-b-0 last:pb-0"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-[var(--text-primary)] capitalize">
                  {period} Limits
                </h4>
                <div className="flex items-center gap-2">
                  {existing && (
                    <button
                      onClick={() => onDelete(existing.id)}
                      className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  {!isEditing && (
                    <button
                      onClick={() => handleEdit(period)}
                      className="text-xs text-indigo-500 hover:text-indigo-400 transition-colors"
                    >
                      {existing ? 'Edit' : 'Set Limits'}
                    </button>
                  )}
                </div>
              </div>

              {anyExceeded && (
                <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-red-500/10 border border-red-500/30">
                  <AlertTriangle size={14} className="text-red-500 shrink-0" />
                  <span className="text-xs text-red-500 font-medium">
                    {period.charAt(0).toUpperCase() + period.slice(1)} limit reached
                  </span>
                </div>
              )}

              {status && existing && !isEditing && (
                <div className="space-y-3">
                  {existing.maxTrades != null && (
                    <LimitBar
                      current={status.currentTrades}
                      max={existing.maxTrades}
                      label="Trades"
                      format={(v) => v.toString()}
                    />
                  )}
                  {existing.maxLoss != null && (
                    <LimitBar
                      current={status.currentLoss}
                      max={existing.maxLoss}
                      label="Loss"
                      format={formatCurrency}
                    />
                  )}
                  {existing.maxCapital != null && (
                    <LimitBar
                      current={status.currentCapital}
                      max={existing.maxCapital}
                      label="Capital"
                      format={formatCurrency}
                    />
                  )}
                </div>
              )}

              {!existing && !isEditing && (
                <p className="text-xs text-[var(--text-muted)]">
                  No {period} limits configured.
                </p>
              )}

              {isEditing && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-[var(--text-secondary)]">
                        Max Trades
                      </label>
                      <input
                        type="number"
                        value={maxTrades}
                        onChange={(e) => setMaxTrades(e.target.value)}
                        className={inputClass}
                        placeholder="10"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-[var(--text-secondary)]">
                        Max Loss ($)
                      </label>
                      <input
                        type="number"
                        value={maxLoss}
                        onChange={(e) => setMaxLoss(e.target.value)}
                        className={inputClass}
                        placeholder="500"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-[var(--text-secondary)]">
                        Max Capital ($)
                      </label>
                      <input
                        type="number"
                        value={maxCapital}
                        onChange={(e) => setMaxCapital(e.target.value)}
                        className={inputClass}
                        placeholder="5000"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSave(period)}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingPeriod(null)}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};
