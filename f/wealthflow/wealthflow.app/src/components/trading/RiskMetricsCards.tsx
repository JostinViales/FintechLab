import React from 'react';
import { ShieldAlert, TrendingDown, BarChart3, Clock, DollarSign, Scale } from 'lucide-react';
import type { TradingStats } from '@/types';
import { Card } from '@/components/ui/Card';
import { formatPnl, formatPercent, formatCurrency } from '@/lib/format';

interface RiskMetricsCardsProps {
  stats: TradingStats;
}

const formatDuration = (minutes: number): string => {
  if (minutes === 0) return '---';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)}h`;
  return `${(minutes / 1440).toFixed(1)}d`;
};

const ratioColor = (value: number): string => {
  if (value > 1) return 'text-[var(--accent-success)]';
  if (value > 0) return 'text-[var(--text-primary)]';
  return 'text-[var(--accent-danger)]';
};

const ratioBorder = (value: number): string => {
  if (value > 1) return 'border-l-[var(--accent-success)]';
  if (value > 0) return 'border-l-amber-400';
  return 'border-l-[var(--accent-danger)]';
};

export const RiskMetricsCards: React.FC<RiskMetricsCardsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {/* Max Drawdown */}
      <Card className="border-l-4 border-l-[var(--accent-danger)]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Max Drawdown</p>
          <TrendingDown size={18} className="text-[var(--text-muted)]" />
        </div>
        <h3 className="text-2xl font-bold text-[var(--accent-danger)]">
          {formatPnl(-stats.maxDrawdown)}
        </h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {formatPercent(stats.maxDrawdownPct)} from peak
        </p>
      </Card>

      {/* Sharpe Ratio */}
      <Card className={`border-l-4 ${ratioBorder(stats.sharpeRatio)}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Sharpe Ratio</p>
          <ShieldAlert size={18} className="text-[var(--text-muted)]" />
        </div>
        <h3 className={`text-2xl font-bold ${ratioColor(stats.sharpeRatio)}`}>
          {stats.sharpeRatio === 0 ? '---' : stats.sharpeRatio.toFixed(2)}
        </h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">Annualized (252 trading days)</p>
      </Card>

      {/* Sortino Ratio */}
      <Card className={`border-l-4 ${ratioBorder(stats.sortinoRatio)}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Sortino Ratio</p>
          <Scale size={18} className="text-[var(--text-muted)]" />
        </div>
        <h3 className={`text-2xl font-bold ${ratioColor(stats.sortinoRatio)}`}>
          {stats.sortinoRatio === Infinity
            ? '---'
            : stats.sortinoRatio === 0
              ? '---'
              : stats.sortinoRatio.toFixed(2)}
        </h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">Downside risk adjusted</p>
      </Card>

      {/* Avg Hold Duration */}
      <Card className="border-l-4 border-l-[var(--accent-info)]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Avg Hold</p>
          <Clock size={18} className="text-[var(--text-muted)]" />
        </div>
        <h3 className="text-2xl font-bold text-[var(--text-primary)]">
          {formatDuration(stats.avgHoldDurationMinutes)}
        </h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">Average trade duration</p>
      </Card>

      {/* Total Volume */}
      <Card className="border-l-4 border-l-[var(--accent-primary)]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Total Volume</p>
          <DollarSign size={18} className="text-[var(--text-muted)]" />
        </div>
        <h3 className="text-2xl font-bold text-[var(--text-primary)]">
          {formatCurrency(stats.totalVolume)}
        </h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">Lifetime trading volume</p>
      </Card>

      {/* Profit Factor */}
      <Card
        className={`border-l-4 ${stats.profitFactor > 1 ? 'border-l-[var(--accent-success)]' : 'border-l-[var(--accent-danger)]'}`}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Profit Factor</p>
          <BarChart3 size={18} className="text-[var(--text-muted)]" />
        </div>
        <h3
          className={`text-2xl font-bold ${stats.profitFactor > 1 ? 'text-[var(--accent-success)]' : 'text-[var(--accent-danger)]'}`}
        >
          {stats.profitFactor === Infinity ? '---' : stats.profitFactor.toFixed(2)}
        </h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {`> 1.0 is profitable`}
        </p>
      </Card>
    </div>
  );
};
