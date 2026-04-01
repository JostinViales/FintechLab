import React from 'react';
import { ShieldAlert, TrendingDown, Target, PieChart } from 'lucide-react';
import type { PortfolioRiskMetrics } from '../../types';
import { Card } from '../ui/Card';
import { formatPnl, formatPercent } from '../../lib/format';

interface PortfolioRiskCardsProps {
  metrics: PortfolioRiskMetrics;
}

const concentrationColor = (score: number): string => {
  if (score > 50) return 'text-[var(--accent-danger)]';
  if (score > 30) return 'text-amber-400';
  return 'text-[var(--accent-success)]';
};

const concentrationBorder = (score: number): string => {
  if (score > 50) return 'border-l-[var(--accent-danger)]';
  if (score > 30) return 'border-l-amber-400';
  return 'border-l-[var(--accent-success)]';
};

export const PortfolioRiskCards: React.FC<PortfolioRiskCardsProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* Concentration Score */}
      <Card className={`border-l-4 ${concentrationBorder(metrics.concentrationScore)}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Concentration</p>
          <PieChart size={18} className="text-[var(--text-muted)]" />
        </div>
        <h3 className={`text-2xl font-bold ${concentrationColor(metrics.concentrationScore)}`}>
          {metrics.concentrationScore}
        </h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">HHI / 100 (lower is better)</p>
      </Card>

      {/* Volatility */}
      <Card className="border-l-4 border-l-[var(--accent-info)]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Volatility</p>
          <ShieldAlert size={18} className="text-[var(--text-muted)]" />
        </div>
        <h3 className="text-2xl font-bold text-[var(--text-primary)]">
          {metrics.portfolioVolatility > 0
            ? `$${metrics.portfolioVolatility.toFixed(0)}`
            : '---'}
        </h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">Annualized std dev</p>
      </Card>

      {/* Max Drawdown */}
      <Card className="border-l-4 border-l-[var(--accent-danger)]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Max Drawdown</p>
          <TrendingDown size={18} className="text-[var(--text-muted)]" />
        </div>
        <h3 className="text-2xl font-bold text-[var(--accent-danger)]">
          {metrics.maxDrawdown > 0 ? formatPnl(-metrics.maxDrawdown) : '---'}
        </h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {metrics.maxDrawdownPct > 0 ? `${formatPercent(metrics.maxDrawdownPct)} from peak` : 'No drawdown'}
        </p>
      </Card>

      {/* Largest Position */}
      <Card className="border-l-4 border-l-amber-400">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Largest Position</p>
          <Target size={18} className="text-[var(--text-muted)]" />
        </div>
        <h3 className="text-2xl font-bold text-[var(--text-primary)]">
          {metrics.largestPosition}
        </h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {formatPercent(metrics.largestPositionPct)} of portfolio
        </p>
      </Card>
    </div>
  );
};
