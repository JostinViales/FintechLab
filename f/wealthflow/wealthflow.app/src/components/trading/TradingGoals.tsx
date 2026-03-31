import React, { useState, useMemo } from 'react';
import { Target } from 'lucide-react';
import type { TradingGoal, Trade, GoalPeriodType } from '@/types';
import { Card } from '@/components/ui/Card';
import { formatPnl, formatPercent } from '@/lib/format';

interface TradingGoalsProps {
  goals: TradingGoal[];
  trades: Trade[];
  onSave: (goal: Omit<TradingGoal, 'id'>) => void;
}

function getCurrentPeriodKey(type: GoalPeriodType): string {
  const now = new Date();
  if (type === 'monthly') {
    return now.toISOString().slice(0, 7);
  }
  // Weekly: ISO week format YYYY-Www
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const daysSinceJan4 = Math.floor((now.getTime() - jan4.getTime()) / 86400000);
  const weekNum = Math.ceil((daysSinceJan4 + jan4.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
}

function isTradeInPeriod(trade: Trade, periodType: GoalPeriodType, periodKey: string): boolean {
  if (periodType === 'monthly') {
    return trade.tradedAt.startsWith(periodKey);
  }
  // For weekly, parse the period key and check
  const tradeDate = new Date(trade.tradedAt);
  const [yearStr, weekStr] = periodKey.split('-W');
  const year = parseInt(yearStr ?? '0', 10);
  const week = parseInt(weekStr ?? '0', 10);

  // Get the Monday of the target week
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return tradeDate >= monday && tradeDate <= sunday;
}

export const TradingGoals: React.FC<TradingGoalsProps> = ({ goals, trades, onSave }) => {
  const [periodType, setPeriodType] = useState<GoalPeriodType>('monthly');
  const [targetPnl, setTargetPnl] = useState('');
  const [maxTrades, setMaxTrades] = useState('');
  const [maxCapital, setMaxCapital] = useState('');

  const currentPeriodKey = getCurrentPeriodKey(periodType);
  const currentGoal = goals.find(
    (g) => g.periodType === periodType && g.periodKey === currentPeriodKey,
  );

  const periodTrades = useMemo(() => {
    return trades.filter((t) => isTradeInPeriod(t, periodType, currentPeriodKey));
  }, [trades, periodType, currentPeriodKey]);

  const periodPnl = periodTrades.reduce((sum, t) => sum + (t.realizedPnl ?? 0), 0);
  const periodTradeCount = periodTrades.length;
  const periodCapital = periodTrades.reduce((sum, t) => sum + t.total, 0);

  const pnlProgress =
    currentGoal && currentGoal.targetPnl !== 0
      ? Math.min((periodPnl / currentGoal.targetPnl) * 100, 100)
      : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPnl) return;
    onSave({
      periodType,
      periodKey: currentPeriodKey,
      targetPnl: parseFloat(targetPnl),
      maxTrades: maxTrades ? parseInt(maxTrades, 10) : undefined,
      maxCapital: maxCapital ? parseFloat(maxCapital) : undefined,
    });
    setTargetPnl('');
    setMaxTrades('');
    setMaxCapital('');
  };

  return (
    <Card title="Trading Goals">
      {/* Period Toggle */}
      <div className="flex rounded-lg bg-[var(--bg-tertiary)] p-1 mb-4 w-fit">
        <button
          type="button"
          onClick={() => setPeriodType('weekly')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
            periodType === 'weekly'
              ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Weekly
        </button>
        <button
          type="button"
          onClick={() => setPeriodType('monthly')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
            periodType === 'monthly'
              ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Monthly
        </button>
      </div>

      <p className="text-xs text-[var(--text-muted)] mb-4">
        Current period:{' '}
        <span className="font-medium text-[var(--text-secondary)]">{currentPeriodKey}</span>
      </p>

      {/* Current Goal Progress */}
      {currentGoal ? (
        <div className="space-y-4 mb-6">
          {/* P&L Progress */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-[var(--text-secondary)]">P&L Target</span>
              <span className="text-[var(--text-primary)]">
                {formatPnl(periodPnl)} / {formatPnl(currentGoal.targetPnl)}
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  pnlProgress >= 100 ? 'bg-[var(--accent-success)]' : 'bg-[var(--accent-primary)]'
                }`}
                style={{ width: `${Math.max(pnlProgress, 0)}%` }}
              />
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {formatPercent(pnlProgress)} of target
            </p>
          </div>

          {/* Trade Count */}
          {currentGoal.maxTrades != null && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[var(--text-secondary)]">Trade Limit</span>
                <span
                  className={`text-[var(--text-primary)] ${
                    periodTradeCount >= currentGoal.maxTrades
                      ? 'text-[var(--accent-danger)] font-bold'
                      : ''
                  }`}
                >
                  {periodTradeCount} / {currentGoal.maxTrades}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    periodTradeCount >= currentGoal.maxTrades
                      ? 'bg-[var(--accent-danger)]'
                      : 'bg-[var(--accent-info)]'
                  }`}
                  style={{
                    width: `${Math.min((periodTradeCount / currentGoal.maxTrades) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Capital Limit */}
          {currentGoal.maxCapital != null && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[var(--text-secondary)]">Capital Limit</span>
                <span className="text-[var(--text-primary)]">
                  ${periodCapital.toLocaleString()} / ${currentGoal.maxCapital.toLocaleString()}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    periodCapital >= currentGoal.maxCapital
                      ? 'bg-[var(--accent-danger)]'
                      : 'bg-[var(--accent-info)]'
                  }`}
                  style={{
                    width: `${Math.min((periodCapital / currentGoal.maxCapital) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-6">
          <Target size={16} />
          No goal set for this period. Create one below.
        </div>
      )}

      {/* Set/Update Goal Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-sm font-medium text-[var(--text-primary)]">
          {currentGoal ? 'Update Goal' : 'Set Goal'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">
              P&L Target ($)
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={targetPnl}
              onChange={(e) => setTargetPnl(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
              placeholder="1000"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">Max Trades</label>
            <input
              type="number"
              value={maxTrades}
              onChange={(e) => setMaxTrades(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
              placeholder="50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">
              Max Capital ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={maxCapital}
              onChange={(e) => setMaxCapital(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
              placeholder="10000"
            />
          </div>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          {currentGoal ? 'Update Goal' : 'Set Goal'}
        </button>
      </form>
    </Card>
  );
};
