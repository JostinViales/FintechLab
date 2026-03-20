import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import type { AssetHoldingDuration } from '@/types';

interface HoldingDurationTimelineProps {
  durations: AssetHoldingDuration[];
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

const formatDays = (days: number): string => {
  if (days === 0) return '< 1d';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
};

export const HoldingDurationTimeline: React.FC<HoldingDurationTimelineProps> = ({ durations }) => {
  const sorted = [...durations].sort((a, b) => b.holdingDays - a.holdingDays);

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-muted)] text-sm">
        No holding data available
      </div>
    );
  }

  const data = sorted.map((d) => ({
    asset: d.asset,
    days: d.holdingDays,
    allocationPct: d.allocationPct,
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
          <XAxis
            type="number"
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            tickFormatter={formatDays}
          />
          <YAxis
            type="category"
            dataKey="asset"
            width={60}
            tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: '8px',
              border: 'none',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
            }}
            formatter={(value) => [formatDays(value as number), 'Held']}
            labelFormatter={(label) => `${label}`}
          />
          <Bar dataKey="days" radius={[0, 4, 4, 0]} maxBarSize={30}>
            {data.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
