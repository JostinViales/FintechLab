import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import type { AssetBalance } from '../../types';
import { formatCurrency } from '../../lib/format';

interface AllocationPieChartProps {
  balances: AssetBalance[];
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

export const AllocationPieChart: React.FC<AllocationPieChartProps> = ({ balances }) => {
  const data = balances
    .filter((b) => b.totalCost > 0)
    .map((b) => ({
      name: b.asset,
      value: b.totalCost,
    }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-muted)] text-sm">
        No holdings to display
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((_entry, index) => (
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
            formatter={(value) => [formatCurrency(value as number), 'Cost Basis']}
          />
          <Legend verticalAlign="bottom" height={36} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
