import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import type { PnlTimelinePoint } from '../../types';
import { formatPnl } from '../../lib/format';

interface PnlTimelineChartProps {
  data: PnlTimelinePoint[];
}

export const PnlTimelineChart: React.FC<PnlTimelineChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-72 text-[var(--text-muted)] text-sm">
        Complete some trades to see P&L timeline.
      </div>
    );
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
          />
          <YAxis
            yAxisId="left"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
            tickFormatter={(v) => `$${(v as number).toLocaleString()}`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
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
              const v = value as number;
              if (name === 'pnl') return [formatPnl(v), 'Daily P&L'];
              return [formatPnl(v), 'Cumulative P&L'];
            }}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Bar dataKey="pnl" yAxisId="left" radius={[2, 2, 0, 0]}>
            {data.map((entry, idx) => (
              <Cell key={`cell-${idx}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
            ))}
          </Bar>
          <Line
            type="monotone"
            dataKey="cumulativePnl"
            yAxisId="right"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
