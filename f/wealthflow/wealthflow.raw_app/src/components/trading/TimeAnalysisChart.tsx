import React, { useState, useMemo } from 'react';
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
import type { TimeAnalysis } from '../../types';
import { formatPnl, formatPercent } from '../../lib/format';

interface TimeAnalysisChartProps {
  data: TimeAnalysis;
}

type ViewMode = 'hour' | 'day' | 'month';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const TimeAnalysisChart: React.FC<TimeAnalysisChartProps> = ({ data }) => {
  const [activeView, setActiveView] = useState<ViewMode>('hour');

  const chartData = useMemo(() => {
    switch (activeView) {
      case 'hour':
        return Array.from({ length: 24 }, (_, i) => ({
          label: `${i}:00`,
          pnl: data.byHour[i]?.pnl ?? 0,
          trades: data.byHour[i]?.trades ?? 0,
          winRate: data.byHour[i]?.winRate ?? 0,
        }));
      case 'day':
        return Array.from({ length: 7 }, (_, i) => ({
          label: DAY_LABELS[i] ?? '',
          pnl: data.byDayOfWeek[i]?.pnl ?? 0,
          trades: data.byDayOfWeek[i]?.trades ?? 0,
          winRate: data.byDayOfWeek[i]?.winRate ?? 0,
        }));
      case 'month':
        return Object.entries(data.byMonth)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, bucket]) => ({
            label: month,
            pnl: bucket.pnl,
            trades: bucket.trades,
            winRate: bucket.winRate,
          }));
    }
  }, [data, activeView]);

  const hasData = chartData.some((d) => d.trades > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-72 text-[var(--text-muted)] text-sm">
        Complete some trades to see time-based analysis.
      </div>
    );
  }

  return (
    <div>
      {/* View Toggle */}
      <div className="flex gap-1 mb-4">
        {(['hour', 'day', 'month'] as ViewMode[]).map((view) => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeView === view
                ? 'bg-[var(--accent-primary)] text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {view === 'hour' ? 'By Hour' : view === 'day' ? 'By Day' : 'By Month'}
          </button>
        ))}
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
            <XAxis
              dataKey="label"
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
              formatter={(value, name) => {
                if (name === 'pnl') return [formatPnl(value as number), 'P&L'];
                return [value, name];
              }}
              labelFormatter={(label) => {
                const item = chartData.find((d) => d.label === label);
                if (!item) return label;
                return `${label} | ${item.trades} trades | WR: ${formatPercent(item.winRate)}`;
              }}
            />
            <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
              {chartData.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
