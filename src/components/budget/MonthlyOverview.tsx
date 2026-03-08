import React, { useMemo } from 'react';
import { Category, Transaction, TransactionType, MonthlyBudgetAllocation } from '@/types';
import { Card } from '@/components/ui/Card';
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
import { ArrowUpRight, ArrowDownRight, TrendingUp, AlertCircle } from 'lucide-react';

interface MonthlyOverviewProps {
  categories: Category[];
  transactions: Transaction[];
  monthlyBudgets: MonthlyBudgetAllocation[];
  selectedMonth: string;
}

export const MonthlyOverview: React.FC<MonthlyOverviewProps> = ({
  categories,
  transactions,
  monthlyBudgets,
  selectedMonth,
}) => {
  // 1. Calculate Monthly Stats
  const currentMonthData = useMemo(() => {
    const txs = transactions.filter((t) => t.date.startsWith(selectedMonth));
    const income = txs
      .filter((t) => t.type === TransactionType.INCOME)
      .reduce((acc, t) => acc + t.amount, 0);
    const expense = txs
      .filter((t) => t.type === TransactionType.EXPENSE)
      .reduce((acc, t) => acc + t.amount, 0);

    const categorySpending: Record<string, number> = {};
    txs
      .filter((t) => t.type === TransactionType.EXPENSE)
      .forEach((t) => {
        categorySpending[t.category] = (categorySpending[t.category] ?? 0) + t.amount;
      });

    return { income, expense, categorySpending, txs };
  }, [transactions, selectedMonth]);

  // 2. Prepare Trend Data (Last 6 Months)
  const trendData = useMemo(() => {
    const data = [];
    const date = new Date(selectedMonth + '-01');

    for (let i = 5; i >= 0; i--) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${yyyy}-${mm}`;

      const monthlyExpense = transactions
        .filter((t) => t.date.startsWith(key) && t.type === TransactionType.EXPENSE)
        .reduce((acc, t) => acc + t.amount, 0);

      data.push({
        name: d.toLocaleString('default', { month: 'short' }),
        expense: monthlyExpense,
        isCurrent: i === 0,
      });
    }
    return data;
  }, [transactions, selectedMonth]);

  // 3. Prepare Category Comparison List
  const categoryBreakdown = useMemo(() => {
    return categories
      .map((cat) => {
        const actual = currentMonthData.categorySpending[cat.name] ?? 0;

        const monthBudget = monthlyBudgets.find(
          (mb) => mb.categoryId === cat.id && mb.month === selectedMonth,
        );
        const target = monthBudget ? monthBudget.amount : cat.defaultMonthlyBudget;

        const percent = target > 0 ? (actual / target) * 100 : 0;
        const isOver = actual > target;

        return {
          ...cat,
          actual,
          target,
          percent,
          isOver,
        };
      })
      .sort((a, b) => b.actual - a.actual);
  }, [categories, currentMonthData, monthlyBudgets, selectedMonth]);

  const netSavings = currentMonthData.income - currentMonthData.expense;
  const savingsRate =
    currentMonthData.income > 0 ? (netSavings / currentMonthData.income) * 100 : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* High Level Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-[var(--gradient-savings-from)] to-[var(--bg-secondary)] border-[var(--accent-primary-muted)]">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-[var(--accent-primary-light)] rounded-lg text-[var(--accent-primary)]">
              <ArrowDownRight size={24} />
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--accent-primary-muted)] text-[var(--accent-primary)]">
              Income
            </span>
          </div>
          <h3 className="text-2xl font-bold text-[var(--text-primary)]">
            ${currentMonthData.income.toLocaleString()}
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Total earnings this month</p>
        </Card>

        <Card className="bg-gradient-to-br from-[var(--gradient-expense-from)] to-[var(--bg-secondary)] border-[var(--accent-danger-light)]">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-[var(--accent-danger-light)] rounded-lg text-[var(--accent-danger)]">
              <ArrowUpRight size={24} />
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--accent-danger-light)] text-[var(--accent-danger)]">
              Expenses
            </span>
          </div>
          <h3 className="text-2xl font-bold text-[var(--text-primary)]">
            ${currentMonthData.expense.toLocaleString()}
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Total spending this month</p>
        </Card>

        <Card className="bg-gradient-to-br from-[var(--gradient-income-from)] to-[var(--bg-secondary)] border-[var(--accent-success-light)]">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-[var(--accent-success-light)] rounded-lg text-[var(--accent-success)]">
              <TrendingUp size={24} />
            </div>
            <span
              className={`text-xs font-semibold px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--accent-success-light)] ${netSavings >= 0 ? 'text-[var(--accent-success)]' : 'text-[var(--accent-danger)]'}`}
            >
              {savingsRate.toFixed(1)}% Rate
            </span>
          </div>
          <h3
            className={`text-2xl font-bold ${netSavings >= 0 ? 'text-[var(--accent-success)]' : 'text-[var(--accent-danger)]'}`}
          >
            {netSavings >= 0 ? '+' : ''}${netSavings.toLocaleString()}
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Net Savings</p>
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
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                  />
                  <Tooltip
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value) => [`$${(value as number).toLocaleString()}`, 'Expenses']}
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
                .filter((t) => t.type === TransactionType.EXPENSE)
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 5)
                .map((tx) => (
                  <div
                    key={tx.id}
                    className="flex justify-between items-center p-2 rounded hover:bg-[var(--bg-tertiary)]"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--text-primary)] truncate">
                        {tx.description}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {tx.date} &bull; {tx.category}
                      </p>
                    </div>
                    <span className="font-semibold text-[var(--text-primary)]">
                      ${tx.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              {currentMonthData.txs.filter((t) => t.type === TransactionType.EXPENSE).length ===
                0 && (
                <p className="text-center text-[var(--text-muted)] py-4">
                  No expenses recorded yet.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Category Breakdown */}
      <Card title="Category Breakdown vs Monthly Target">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--bg-tertiary)] border-b border-[var(--border-default)]">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase">
                  Category
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase">
                  Actual
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase">
                  Avg Target
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--text-secondary)] uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {categoryBreakdown.map((cat) => (
                <tr key={cat.id} className="hover:bg-[var(--bg-tertiary)]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--text-primary)]">{cat.name}</p>
                    <div className="w-full max-w-[140px] h-1.5 bg-[var(--bg-tertiary)] rounded-full mt-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cat.isOver ? 'bg-[var(--accent-danger)]' : 'bg-[var(--accent-success)]'}`}
                        style={{ width: `${Math.min(cat.percent, 100)}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-[var(--text-primary)]">
                    ${cat.actual.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--text-secondary)] text-sm">
                    ${cat.target.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {cat.isOver ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--accent-danger-light)] text-[var(--accent-danger-text)] text-xs font-medium">
                        <AlertCircle size={12} /> Over
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-[var(--accent-success-light)] text-[var(--accent-success-text)] text-xs font-medium">
                        Good
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-[var(--border-subtle)] -mx-4">
          {categoryBreakdown.map((cat) => (
            <div key={cat.id} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[var(--text-primary)] truncate">{cat.name}</p>
                </div>
                {cat.isOver ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent-danger-light)] text-[var(--accent-danger-text)] text-[10px] font-medium shrink-0 ml-2">
                    <AlertCircle size={10} /> Over
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--accent-success-light)] text-[var(--accent-success-text)] text-[10px] font-medium shrink-0 ml-2">
                    Good
                  </span>
                )}
              </div>

              <div className="w-full h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all ${cat.isOver ? 'bg-[var(--accent-danger)]' : 'bg-[var(--accent-success)]'}`}
                  style={{ width: `${Math.min(cat.percent, 100)}%` }}
                />
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">
                  Target:{' '}
                  <span className="font-medium text-[var(--text-primary)]">
                    ${cat.target.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </span>
                <span className="font-bold text-[var(--text-primary)]">
                  ${cat.actual.toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Yearly Budget Aggregation */}
      <Card title={`Yearly Budget Overview ${selectedMonth.slice(0, 4)}`}>
        <YearlyAggregation
          categories={categories}
          transactions={transactions}
          monthlyBudgets={monthlyBudgets}
          selectedYear={selectedMonth.slice(0, 4)}
        />
      </Card>
    </div>
  );
};

// Yearly Aggregation Sub-component
interface YearlyAggregationProps {
  categories: Category[];
  transactions: Transaction[];
  monthlyBudgets: MonthlyBudgetAllocation[];
  selectedYear: string;
}

const YearlyAggregation: React.FC<YearlyAggregationProps> = ({
  categories,
  transactions,
  monthlyBudgets,
  selectedYear,
}) => {
  const yearlyData = useMemo(() => {
    const yearPrefix = selectedYear;

    const yearTxs = transactions.filter((t) => t.date.startsWith(yearPrefix));

    const totalIncome = yearTxs
      .filter((t) => t.type === TransactionType.INCOME)
      .reduce((acc, t) => acc + t.amount, 0);

    const totalExpense = yearTxs
      .filter((t) => t.type === TransactionType.EXPENSE)
      .reduce((acc, t) => acc + t.amount, 0);

    const categorySpending: Record<string, number> = {};
    yearTxs
      .filter((t) => t.type === TransactionType.EXPENSE)
      .forEach((t) => {
        categorySpending[t.category] = (categorySpending[t.category] ?? 0) + t.amount;
      });

    const categoryData = categories
      .map((cat) => {
        const actual = categorySpending[cat.name] ?? 0;

        const monthlyAllocations = monthlyBudgets.filter(
          (mb) => mb.categoryId === cat.id && mb.month.startsWith(yearPrefix),
        );

        let yearlyTarget: number;
        if (monthlyAllocations.length > 0) {
          yearlyTarget = monthlyAllocations.reduce((sum, mb) => sum + mb.amount, 0);
          if (monthlyAllocations.length < 12) {
            const avgMonthly = yearlyTarget / monthlyAllocations.length;
            yearlyTarget = avgMonthly * 12;
          }
        } else {
          yearlyTarget = cat.defaultMonthlyBudget * 12;
        }

        const percent = yearlyTarget > 0 ? (actual / yearlyTarget) * 100 : 0;
        const isOver = actual > yearlyTarget;
        const remaining = yearlyTarget - actual;

        return {
          ...cat,
          actual,
          yearlyTarget,
          percent,
          isOver,
          remaining,
        };
      })
      .sort((a, b) => b.actual - a.actual);

    const totalBudget = categoryData.reduce((acc, c) => acc + c.yearlyTarget, 0);
    const totalRemaining = totalBudget - totalExpense;

    return {
      totalIncome,
      totalExpense,
      totalBudget,
      totalRemaining,
      categoryData,
    };
  }, [categories, transactions, monthlyBudgets, selectedYear]);

  return (
    <div className="space-y-6">
      {/* Yearly Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg">
          <p className="text-xs font-medium text-[var(--text-secondary)] uppercase mb-1">
            Yearly Budget
          </p>
          <p className="text-xl font-bold text-[var(--text-primary)]">
            ${yearlyData.totalBudget.toLocaleString()}
          </p>
        </div>
        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg">
          <p className="text-xs font-medium text-[var(--text-secondary)] uppercase mb-1">
            YTD Spent
          </p>
          <p className="text-xl font-bold text-[var(--accent-danger)]">
            ${yearlyData.totalExpense.toLocaleString()}
          </p>
        </div>
        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg">
          <p className="text-xs font-medium text-[var(--text-secondary)] uppercase mb-1">
            Remaining
          </p>
          <p
            className={`text-xl font-bold ${yearlyData.totalRemaining >= 0 ? 'text-[var(--accent-success)]' : 'text-[var(--accent-danger)]'}`}
          >
            ${yearlyData.totalRemaining.toLocaleString()}
          </p>
        </div>
        <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg">
          <p className="text-xs font-medium text-[var(--text-secondary)] uppercase mb-1">
            YTD Income
          </p>
          <p className="text-xl font-bold text-[var(--accent-success)]">
            ${yearlyData.totalIncome.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Category Yearly Breakdown - Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-[var(--bg-tertiary)] border-b border-[var(--border-default)]">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase">
                Category
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase">
                YTD Spent
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase">
                Yearly Budget
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase">
                Remaining
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--text-secondary)] uppercase">
                Progress
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {yearlyData.categoryData.map((cat) => (
              <tr key={cat.id} className="hover:bg-[var(--bg-tertiary)]">
                <td className="px-4 py-3">
                  <p className="font-medium text-[var(--text-primary)]">{cat.name}</p>
                </td>
                <td className="px-4 py-3 text-right font-bold text-[var(--text-primary)]">
                  ${cat.actual.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-[var(--text-secondary)]">
                  ${cat.yearlyTarget.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </td>
                <td
                  className={`px-4 py-3 text-right font-medium ${cat.remaining >= 0 ? 'text-[var(--accent-success)]' : 'text-[var(--accent-danger)]'}`}
                >
                  {cat.remaining >= 0 ? '' : '-'}$
                  {Math.abs(cat.remaining).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          cat.percent > 100
                            ? 'bg-[var(--accent-danger)]'
                            : cat.percent > 80
                              ? 'bg-amber-400'
                              : 'bg-[var(--accent-success)]'
                        }`}
                        style={{ width: `${Math.min(cat.percent, 100)}%` }}
                      />
                    </div>
                    <span
                      className={`text-xs font-medium w-12 text-right ${cat.isOver ? 'text-[var(--accent-danger)]' : 'text-[var(--text-secondary)]'}`}
                    >
                      {cat.percent.toFixed(0)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Category Yearly Breakdown - Mobile */}
      <div className="md:hidden divide-y divide-[var(--border-subtle)] -mx-4">
        {yearlyData.categoryData.map((cat) => (
          <div key={cat.id} className="p-4">
            <div className="flex justify-between items-start mb-2">
              <p className="font-medium text-[var(--text-primary)]">{cat.name}</p>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  cat.isOver
                    ? 'bg-[var(--accent-danger-light)] text-[var(--accent-danger-text)]'
                    : 'bg-[var(--accent-success-light)] text-[var(--accent-success-text)]'
                }`}
              >
                {cat.percent.toFixed(0)}%
              </span>
            </div>

            <div className="w-full h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full ${
                  cat.percent > 100
                    ? 'bg-[var(--accent-danger)]'
                    : cat.percent > 80
                      ? 'bg-amber-400'
                      : 'bg-[var(--accent-success)]'
                }`}
                style={{ width: `${Math.min(cat.percent, 100)}%` }}
              />
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-secondary)]">
                Budget:{' '}
                <span className="font-medium text-[var(--text-primary)]">
                  ${cat.yearlyTarget.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </span>
              <span className="font-bold text-[var(--text-primary)]">
                ${cat.actual.toLocaleString()}
              </span>
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              Remaining:{' '}
              <span
                className={
                  cat.remaining >= 0
                    ? 'text-[var(--accent-success)]'
                    : 'text-[var(--accent-danger)]'
                }
              >
                {cat.remaining >= 0 ? '' : '-'}$
                {Math.abs(cat.remaining).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
