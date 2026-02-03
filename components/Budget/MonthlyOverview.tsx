import React, { useMemo } from 'react';
import { Category, Transaction, TransactionType, MonthlyBudgetAllocation } from '../../types';
import { Card } from '../ui/Card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { ArrowUpRight, ArrowDownRight, TrendingUp, AlertCircle } from 'lucide-react';

interface MonthlyOverviewProps {
  categories: Category[];
  transactions: Transaction[];
  monthlyBudgets: MonthlyBudgetAllocation[];
  selectedMonth: string; // YYYY-MM
}

export const MonthlyOverview: React.FC<MonthlyOverviewProps> = ({
  categories,
  transactions,
  monthlyBudgets,
  selectedMonth
}) => {

  // 1. Calculate Monthly Stats
  const currentMonthData = useMemo(() => {
    const txs = transactions.filter(t => t.date.startsWith(selectedMonth));
    const income = txs.filter(t => t.type === TransactionType.INCOME).reduce((acc, t) => acc + t.amount, 0);
    const expense = txs.filter(t => t.type === TransactionType.EXPENSE).reduce((acc, t) => acc + t.amount, 0);

    // Group expenses by category
    const categorySpending: Record<string, number> = {};
    txs.filter(t => t.type === TransactionType.EXPENSE).forEach(t => {
      categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
    });

    return { income, expense, categorySpending, txs };
  }, [transactions, selectedMonth]);

  // 2. Prepare Trend Data (Last 6 Months)
  const trendData = useMemo(() => {
    const data = [];
    const date = new Date(selectedMonth + '-01'); // Force first day to avoid timezone offsets skipping months

    // Go back 5 months + current month
    for (let i = 5; i >= 0; i--) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${yyyy}-${mm}`;

      const monthlyExpense = transactions
        .filter(t => t.date.startsWith(key) && t.type === TransactionType.EXPENSE)
        .reduce((acc, t) => acc + t.amount, 0);

      data.push({
        name: d.toLocaleString('default', { month: 'short' }),
        expense: monthlyExpense,
        isCurrent: i === 0
      });
    }
    return data;
  }, [transactions, selectedMonth]);

  // 3. Prepare Category Comparison List
  const categoryBreakdown = useMemo(() => {
    return categories.map(cat => {
      const actual = currentMonthData.categorySpending[cat.name] || 0;

      // Get the monthly budget for this category in the selected month
      const monthBudget = monthlyBudgets.find(
        mb => mb.categoryId === cat.id && mb.month === selectedMonth
      );
      // Fall back to default monthly budget if no specific allocation
      const target = monthBudget ? monthBudget.amount : cat.defaultMonthlyBudget;

      const percent = target > 0 ? (actual / target) * 100 : 0;
      const isOver = actual > target;

      return {
        ...cat,
        actual,
        target,
        percent,
        isOver
      };
    }).sort((a, b) => b.actual - a.actual); // Sort by highest spending
  }, [categories, currentMonthData, monthlyBudgets, selectedMonth]);

  const netSavings = currentMonthData.income - currentMonthData.expense;
  const savingsRate = currentMonthData.income > 0 ? (netSavings / currentMonthData.income) * 100 : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* High Level Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
              <ArrowDownRight size={24} />
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-white border border-indigo-100 text-indigo-600">
              Income
            </span>
          </div>
          <h3 className="text-2xl font-bold text-slate-900">${currentMonthData.income.toLocaleString()}</h3>
          <p className="text-sm text-slate-500 mt-1">Total earnings this month</p>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-white border-red-100">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-red-100 rounded-lg text-red-600">
              <ArrowUpRight size={24} />
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-white border border-red-100 text-red-600">
              Expenses
            </span>
          </div>
          <h3 className="text-2xl font-bold text-slate-900">${currentMonthData.expense.toLocaleString()}</h3>
          <p className="text-sm text-slate-500 mt-1">Total spending this month</p>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
              <TrendingUp size={24} />
            </div>
            <span className={`text-xs font-semibold px-2 py-1 rounded bg-white border border-emerald-100 ${netSavings >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {savingsRate.toFixed(1)}% Rate
            </span>
          </div>
          <h3 className={`text-2xl font-bold ${netSavings >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {netSavings >= 0 ? '+' : ''}${netSavings.toLocaleString()}
          </h3>
          <p className="text-sm text-slate-500 mt-1">Net Savings</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <div className="lg:col-span-2">
          <Card title="6-Month Spending Trend">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Expenses']}
                  />
                  <Bar dataKey="expense" radius={[4, 4, 0, 0]} barSize={40}>
                    {trendData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.isCurrent ? '#6366f1' : '#cbd5e1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Top Expenses List */}
        <div className="lg:col-span-1">
          <Card title="Largest Expenses" className="h-full">
            <div className="space-y-3">
              {currentMonthData.txs
                .filter(t => t.type === TransactionType.EXPENSE)
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 5)
                .map(tx => (
                  <div key={tx.id} className="flex justify-between items-center p-2 rounded hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">{tx.description}</p>
                      <p className="text-xs text-slate-500">{tx.date} • {tx.category}</p>
                    </div>
                    <span className="font-semibold text-slate-800">${tx.amount.toLocaleString()}</span>
                  </div>
                ))}
              {currentMonthData.txs.filter(t => t.type === TransactionType.EXPENSE).length === 0 && (
                <p className="text-center text-slate-400 py-4">No expenses recorded yet.</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Category Breakdown */}
      <Card title="Category Breakdown vs Monthly Target">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Category</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actual</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Avg Target</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categoryBreakdown.map(cat => (
                <tr key={cat.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{cat.name}</p>
                    {/* Mini Progress Bar */}
                    <div className="w-full max-w-[140px] h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cat.isOver ? 'bg-red-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(cat.percent, 100)}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-700">
                    ${cat.actual.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500 text-sm">
                    ${cat.target.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {cat.isOver ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                        <AlertCircle size={12} /> Over
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                        Good
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};