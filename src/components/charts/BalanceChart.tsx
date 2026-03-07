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
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import { Account } from '@/types';

interface BalanceChartProps {
  accounts: Account[];
  className?: string;
}

export const BalanceChart: React.FC<BalanceChartProps> = ({ accounts, className }) => {
  const data = accounts.map((acc) => ({
    name: acc.name,
    balance: acc.balance,
    color: acc.color,
    type: acc.type,
  }));

  // For pie chart, only show positive balances (Assets) to avoid rendering errors
  const assetData = data.filter((d) => d.balance > 0);

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${className}`}>
      {/* Bar Chart: Account Distribution */}
      <div className="h-64">
        <h4 className="text-sm font-medium text-slate-500 mb-4 text-center">
          Net Worth by Account
        </h4>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#64748b' }}
            />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
            <Tooltip
              cursor={{ fill: '#f1f5f9' }}
              contentStyle={{
                borderRadius: '8px',
                border: 'none',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
              formatter={(value) => [`$${(value as number).toLocaleString()}`, 'Balance']}
            />
            <Bar dataKey="balance" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.balance < 0 ? '#ef4444' : entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie Chart: Allocation (Assets Only) */}
      <div className="h-64">
        <h4 className="text-sm font-medium text-slate-500 mb-4 text-center">Asset Allocation</h4>
        {assetData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={assetData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="balance"
              >
                {assetData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: '8px',
                  border: 'none',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
                formatter={(value) => [`$${(value as number).toLocaleString()}`, 'Value']}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            No positive assets to display
          </div>
        )}
      </div>
    </div>
  );
};
