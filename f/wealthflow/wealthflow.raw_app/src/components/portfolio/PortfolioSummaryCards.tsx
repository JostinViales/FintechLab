import React from 'react';
import { Wallet, TrendingUp, Clock, BarChart3 } from 'lucide-react';
import type { PortfolioSummary } from '../../types';
import { Card } from '../ui/Card';
import { formatCurrency, formatPnl, formatPnlPct } from '../../lib/format';

interface PortfolioSummaryCardsProps {
  summary: PortfolioSummary;
}

export const PortfolioSummaryCards: React.FC<PortfolioSummaryCardsProps> = ({ summary }) => {
  const unrealizedColor =
    summary.unrealizedPnl >= 0 ? 'text-[var(--accent-success)]' : 'text-[var(--accent-danger)]';
  const unrealizedBorder =
    summary.unrealizedPnl >= 0
      ? 'border-l-[var(--accent-success)]'
      : 'border-l-[var(--accent-danger)]';

  const change24hColor =
    summary.change24h >= 0 ? 'text-[var(--accent-success)]' : 'text-[var(--accent-danger)]';
  const change24hBorder =
    summary.change24h >= 0
      ? 'border-l-[var(--accent-success)]'
      : 'border-l-[var(--accent-danger)]';

  const realizedColor =
    summary.realizedPnl >= 0 ? 'text-[var(--accent-success)]' : 'text-[var(--accent-danger)]';
  const realizedBorder =
    summary.realizedPnl >= 0
      ? 'border-l-[var(--accent-success)]'
      : 'border-l-[var(--accent-danger)]';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {/* Total Value */}
      <Card className="border-l-4 border-l-[var(--accent-primary)]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Total Value</p>
          <Wallet size={18} className="text-[var(--text-muted)]" />
        </div>
        <h3 className="text-2xl font-bold text-[var(--text-primary)]">
          {formatCurrency(summary.totalValue)}
        </h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Cost Basis: {formatCurrency(summary.totalCost)} &middot; {summary.assetCount} asset
          {summary.assetCount !== 1 ? 's' : ''}
        </p>
      </Card>

      {/* Unrealized P&L */}
      <Card className={`border-l-4 ${unrealizedBorder}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Unrealized P&L</p>
          <TrendingUp size={18} className="text-[var(--text-muted)]" />
        </div>
        <h3 className={`text-2xl font-bold ${unrealizedColor}`}>
          {formatPnl(summary.unrealizedPnl)}
        </h3>
        <p className={`text-xs mt-1 ${unrealizedColor}`}>
          {formatPnlPct(summary.unrealizedPnlPct)}
        </p>
      </Card>

      {/* 24h Change */}
      <Card className={`border-l-4 ${change24hBorder}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">24h Change</p>
          <Clock size={18} className="text-[var(--text-muted)]" />
        </div>
        <h3 className={`text-2xl font-bold ${change24hColor}`}>
          {formatPnl(summary.change24h)}
        </h3>
        <p className={`text-xs mt-1 ${change24hColor}`}>
          {formatPnlPct(summary.change24hPct)}
        </p>
      </Card>

      {/* Realized P&L */}
      <Card className={`border-l-4 ${realizedBorder}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Realized P&L</p>
          <BarChart3 size={18} className="text-[var(--text-muted)]" />
        </div>
        <h3 className={`text-2xl font-bold ${realizedColor}`}>
          {formatPnl(summary.realizedPnl)}
        </h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">From closed trades</p>
      </Card>
    </div>
  );
};
