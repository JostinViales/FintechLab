import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import type { PortfolioValuePoint } from '@/types';
import { formatCurrency } from '@/lib/format';

interface PortfolioValueChartProps {
  data: PortfolioValuePoint[];
}

export const PortfolioValueChart: React.FC<PortfolioValueChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-72 text-[var(--text-muted)] text-sm">
        No portfolio history available
      </div>
    );
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <defs>
            <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            tickFormatter={(value) => {
              const d = new Date(value);
              return `${d.getMonth() + 1}/${d.getDate()}`;
            }}
          />
          <YAxis
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
          />
          <Tooltip
            contentStyle={{
              borderRadius: '8px',
              border: 'none',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
            }}
            formatter={(value, name) => [
              formatCurrency(value as number),
              name === 'totalCost' ? 'Cost Basis' : 'Estimated Value',
            ]}
            labelFormatter={(label) => new Date(label).toLocaleDateString()}
          />
          <Legend
            formatter={(value) => (value === 'totalCost' ? 'Cost Basis' : 'Estimated Value')}
          />
          <Area
            type="monotone"
            dataKey="totalCost"
            stroke="#6366f1"
            fill="url(#costGradient)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="estimatedValue"
            stroke="#10b981"
            fill="url(#valueGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
