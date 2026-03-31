import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import type { StrategyPerformanceData } from '@/types';
import { formatPnl, formatPercent, formatCurrency } from '@/lib/format';

interface StrategyPerformanceProps {
  data: StrategyPerformanceData[];
}

export const StrategyPerformance: React.FC<StrategyPerformanceProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-muted)] text-sm">
        Tag your trades with strategies to see performance breakdown.
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.stats.totalRealizedPnl - a.stats.totalRealizedPnl);

  const chartData = sorted.map((d) => ({
    strategy: d.strategy,
    pnl: d.stats.totalRealizedPnl,
    color: d.color,
  }));

  return (
    <div>
      {/* P&L Bar Chart */}
      <div className="h-48 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
            <XAxis
              dataKey="strategy"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
              tickFormatter={(v) => `$${(v as number).toLocaleString()}`}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '8px',
                border: 'none',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
              }}
              formatter={(value) => [formatPnl(value as number), 'Total P&L']}
            />
            <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--border-default)]">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Strategy
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Trades
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Win Rate
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Avg Win
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Avg Loss
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                PF
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Total P&L
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {sorted.map((d) => (
              <tr key={d.strategy} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                <td className="px-3 py-2.5 text-[var(--text-primary)]">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: d.color }}
                    />
                    {d.strategy}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right text-[var(--text-secondary)]">
                  {d.stats.totalTrades}
                </td>
                <td className="px-3 py-2.5 text-right text-[var(--text-secondary)]">
                  {formatPercent(d.stats.winRate)}
                </td>
                <td className="px-3 py-2.5 text-right text-[var(--accent-success)]">
                  {formatCurrency(d.stats.avgWin)}
                </td>
                <td className="px-3 py-2.5 text-right text-[var(--accent-danger)]">
                  {formatCurrency(d.stats.avgLoss)}
                </td>
                <td className="px-3 py-2.5 text-right text-[var(--text-secondary)]">
                  {d.stats.profitFactor === Infinity ? '---' : d.stats.profitFactor.toFixed(2)}
                </td>
                <td
                  className={`px-3 py-2.5 text-right font-bold ${
                    d.stats.totalRealizedPnl >= 0
                      ? 'text-[var(--accent-success)]'
                      : 'text-[var(--accent-danger)]'
                  }`}
                >
                  {formatPnl(d.stats.totalRealizedPnl)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
