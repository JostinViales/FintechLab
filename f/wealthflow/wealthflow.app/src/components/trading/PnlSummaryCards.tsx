import React from 'react';
import { TrendingUp, Target, BarChart3, DollarSign } from 'lucide-react';
import type { TradingStats } from '@/types';
import { Card } from '@/components/ui/Card';
import { formatPnl, formatPercent, formatCurrency } from '@/lib/format';

interface PnlSummaryCardsProps {
  stats: TradingStats;
}

export const PnlSummaryCards: React.FC<PnlSummaryCardsProps> = ({ stats }) => {
  const pnlColor =
    stats.totalRealizedPnl >= 0 ? 'text-[var(--accent-success)]' : 'text-[var(--accent-danger)]';
  const pnlBorder =
    stats.totalRealizedPnl >= 0
      ? 'border-l-[var(--accent-success)]'
      : 'border-l-[var(--accent-danger)]';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      <Card className={`border-l-4 ${pnlBorder}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Total P&L</p>
          <TrendingUp size={18} className="text-[var(--text-muted)]" />
        </div>
        <h3 className={`text-2xl font-bold ${pnlColor}`}>{formatPnl(stats.totalRealizedPnl)}</h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Profit Factor: {stats.profitFactor === Infinity ? '---' : stats.profitFactor.toFixed(2)}
        </p>
      </Card>

      <Card className="border-l-4 border-l-[var(--accent-success)]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Win Rate</p>
          <Target size={18} className="text-[var(--text-muted)]" />
        </div>
        <h3 className="text-2xl font-bold text-[var(--accent-success)]">
          {formatPercent(stats.winRate)}
        </h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {stats.winCount}W / {stats.lossCount}L
        </p>
      </Card>

      <Card className="border-l-4 border-l-[var(--accent-info)]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Total Trades</p>
          <BarChart3 size={18} className="text-[var(--text-muted)]" />
        </div>
        <h3 className="text-2xl font-bold text-[var(--text-primary)]">{stats.totalTrades}</h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Avg Size: {formatCurrency(stats.avgTradeSize)}
        </p>
      </Card>

      <Card className="border-l-4 border-l-[var(--accent-danger)]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Total Fees</p>
          <DollarSign size={18} className="text-[var(--text-muted)]" />
        </div>
        <h3 className="text-2xl font-bold text-[var(--accent-danger)]">
          $
          {stats.totalFeesPaid.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Best: {formatPnl(stats.largestWin)} / Worst: {formatPnl(stats.largestLoss)}
        </p>
      </Card>
    </div>
  );
};
