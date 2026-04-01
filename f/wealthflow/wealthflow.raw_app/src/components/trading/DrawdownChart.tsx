import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import type { EquityCurvePoint } from '../../types';
import { formatPnl } from '../../lib/format';

interface DrawdownChartProps {
  data: EquityCurvePoint[];
}

export const DrawdownChart: React.FC<DrawdownChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-muted)] text-sm">
        Complete some trades to see drawdown analysis.
      </div>
    );
  }

  const chartData = data.map((p) => ({
    date: p.date,
    drawdownPct: -p.drawdownPct,
    drawdown: -p.drawdown,
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
            tickFormatter={(v) => `${(v as number).toFixed(1)}%`}
          />
          <ReferenceLine y={0} stroke="var(--border-default)" strokeDasharray="3 3" />
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
              if (name === 'drawdownPct') return [`${v.toFixed(2)}%`, 'Drawdown %'];
              return [formatPnl(v), 'Drawdown $'];
            }}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Area
            type="monotone"
            dataKey="drawdownPct"
            stroke="#ef4444"
            strokeWidth={2}
            fill="url(#drawdownGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
