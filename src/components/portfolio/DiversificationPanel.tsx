import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import type { DiversificationAnalysis, PortfolioHolding } from '@/types';
import { formatCurrency, formatPercent } from '@/lib/format';

interface DiversificationPanelProps {
  analysis: DiversificationAnalysis;
  holdings: PortfolioHolding[];
}

const COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#3b82f6',
  '#8b5cf6',
  '#14b8a6',
  '#ef4444',
];

const scoreColor = (score: number): string => {
  if (score >= 70) return 'text-[var(--accent-success)]';
  if (score >= 40) return 'text-amber-400';
  return 'text-[var(--accent-danger)]';
};

const scoreLabel = (score: number): string => {
  if (score >= 70) return 'Well Diversified';
  if (score >= 40) return 'Moderate';
  return 'Concentrated';
};

const riskLevelColor = (level: string): string => {
  switch (level) {
    case 'critical':
      return 'text-red-500 bg-red-500/10';
    case 'high':
      return 'text-orange-500 bg-orange-500/10';
    case 'medium':
      return 'text-amber-400 bg-amber-400/10';
    default:
      return 'text-[var(--text-muted)] bg-[var(--bg-tertiary)]';
  }
};

const RiskIcon: React.FC<{ level: string }> = ({ level }) => {
  switch (level) {
    case 'critical':
      return <ShieldAlert size={14} className="text-red-500" />;
    case 'high':
      return <AlertTriangle size={14} className="text-orange-500" />;
    default:
      return <AlertTriangle size={14} className="text-amber-400" />;
  }
};

export const DiversificationPanel: React.FC<DiversificationPanelProps> = ({
  analysis,
  holdings,
}) => {
  // Use market value for pie chart (not cost basis)
  const pieData = holdings
    .filter((h) => h.currentValue > 0)
    .map((h) => ({
      name: h.asset,
      value: h.currentValue,
    }));

  if (holdings.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-muted)] text-sm">
        No holdings to analyze
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Pie Chart */}
      <div>
        <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
          Allocation by Market Value
        </h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: '8px',
                  border: 'none',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                }}
                formatter={(value) => [formatCurrency(value as number), 'Market Value']}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Score + Alerts */}
      <div>
        {/* Diversification Score */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
            Diversification Score
          </h4>
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="var(--border-subtle)"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke={
                    analysis.score >= 70
                      ? 'var(--accent-success)'
                      : analysis.score >= 40
                        ? '#fbbf24'
                        : 'var(--accent-danger)'
                  }
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(analysis.score / 100) * 264} 264`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-xl font-bold ${scoreColor(analysis.score)}`}>
                  {analysis.score}
                </span>
              </div>
            </div>
            <div>
              <p className={`text-sm font-semibold ${scoreColor(analysis.score)}`}>
                {scoreLabel(analysis.score)}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                HHI: {analysis.herfindahlIndex.toLocaleString()} &middot; Top asset:{' '}
                {formatPercent(analysis.topAssetPct)}
              </p>
            </div>
          </div>
        </div>

        {/* Concentration Alerts */}
        <div>
          <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
            Concentration Alerts
          </h4>
          {analysis.concentrationRisks.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-[var(--accent-success)]">
              <CheckCircle size={16} />
              <span>No concentration risks detected</span>
            </div>
          ) : (
            <div className="space-y-2">
              {analysis.concentrationRisks.map((risk) => (
                <div
                  key={risk.asset}
                  className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm ${riskLevelColor(risk.level)}`}
                >
                  <RiskIcon level={risk.level} />
                  <div>
                    <span className="font-medium">{risk.asset}</span>
                    <span className="opacity-80"> — {formatPercent(risk.allocationPct)}</span>
                    <p className="text-xs opacity-70 mt-0.5">{risk.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
