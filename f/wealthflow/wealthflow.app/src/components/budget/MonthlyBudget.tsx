import React, { useState, useMemo } from 'react';
import { Category, Transaction, TransactionType, MonthlyBudgetAllocation } from '@/types';
import { Card } from '@/components/ui/Card';
import { Plus, Pencil, Check, X, AlertCircle, Trash2, Calendar, Search } from 'lucide-react';

interface MonthlyBudgetProps {
  categories: Category[];
  transactions: Transaction[];
  monthlyBudgets: MonthlyBudgetAllocation[];
  selectedMonth: string;
  onUpdateCategory: (category: Category) => void;
  onAddCategory: (name: string) => void;
  onDeleteCategory: (id: string) => void;
  onUpdateMonthlyBudget: (categoryId: string, month: string, amount: number) => void;
  onMonthChange: (month: string) => void;
}

type SortField = 'name' | 'budget' | 'spent' | 'remaining';
type StatusFilter = 'all' | 'over' | 'under';

export const MonthlyBudget: React.FC<MonthlyBudgetProps> = ({
  categories,
  transactions,
  monthlyBudgets,
  selectedMonth,
  onUpdateCategory,
  onAddCategory,
  onDeleteCategory,
  onUpdateMonthlyBudget,
  onMonthChange,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingDefaultId, setEditingDefaultId] = useState<string | null>(null);
  const [editDefaultValue, setEditDefaultValue] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const getBudgetForMonth = (categoryId: string): number => {
    const monthlyBudget = monthlyBudgets.find(
      (mb) => mb.categoryId === categoryId && mb.month === selectedMonth,
    );
    if (monthlyBudget) {
      return monthlyBudget.amount;
    }
    const category = categories.find((c) => c.id === categoryId);
    return category?.defaultMonthlyBudget ?? 0;
  };

  const stats = useMemo(() => {
    return categories.map((cat) => {
      const budget = getBudgetForMonth(cat.id);

      const spent = transactions
        .filter(
          (t) =>
            t.category === cat.name &&
            t.type === TransactionType.EXPENSE &&
            t.date.startsWith(selectedMonth),
        )
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        ...cat,
        budget,
        spent,
        remaining: budget - spent,
        percent: budget > 0 ? (spent / budget) * 100 : 0,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, transactions, monthlyBudgets, selectedMonth]);

  const filteredStats = useMemo(() => {
    return stats
      .filter((cat) => {
        const matchesSearch = cat.name.toLowerCase().includes(searchQuery.toLowerCase());
        const isOver = cat.percent > 100;
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'over' && isOver) ||
          (statusFilter === 'under' && !isOver);
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'name':
            return a.name.localeCompare(b.name);
          case 'budget':
            return b.budget - a.budget;
          case 'spent':
            return b.spent - a.spent;
          case 'remaining':
            return b.remaining - a.remaining;
          default:
            return 0;
        }
      });
  }, [stats, searchQuery, sortBy, statusFilter]);

  const totalBudget = stats.reduce((acc, c) => acc + c.budget, 0);
  const totalSpent = stats.reduce((acc, c) => acc + c.spent, 0);

  const startEditing = (cat: Category) => {
    setEditingId(cat.id);
    setEditValue(getBudgetForMonth(cat.id).toString());
  };

  const saveEdit = (cat: Category) => {
    const amount = parseFloat(editValue) || 0;
    onUpdateMonthlyBudget(cat.id, selectedMonth, amount);
    setEditingId(null);
  };

  const startEditingDefault = (cat: Category) => {
    setEditingDefaultId(cat.id);
    setEditDefaultValue(cat.defaultMonthlyBudget.toString());
  };

  const saveDefaultEdit = (cat: Category) => {
    onUpdateCategory({ ...cat, defaultMonthlyBudget: parseFloat(editDefaultValue) || 0 });
    setEditingDefaultId(null);
  };

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      onAddCategory(newCategoryName);
      setNewCategoryName('');
      setIsAdding(false);
    }
  };

  const monthLabel = new Date(selectedMonth + '-01').toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Month Picker */}
      <div className="flex items-center justify-center mb-6">
        <div className="flex items-center bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-4 py-2 shadow-sm">
          <Calendar size={20} className="text-[var(--text-muted)] mr-2" />
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => onMonthChange(e.target.value)}
            className="text-lg font-semibold text-[var(--text-primary)] outline-none bg-transparent cursor-pointer"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-t-4 border-indigo-500">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Monthly Budget</p>
          <h3 className="text-2xl font-bold text-[var(--text-primary)]">${totalBudget.toLocaleString()}</h3>
        </Card>
        <Card className="border-t-4 border-red-500">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Spent This Month</p>
          <h3 className="text-2xl font-bold text-[var(--text-primary)]">${totalSpent.toLocaleString()}</h3>
        </Card>
        <Card className="border-t-4 border-emerald-500">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Remaining</p>
          <h3
            className={`text-2xl font-bold ${totalBudget - totalSpent >= 0 ? 'text-[var(--accent-success)]' : 'text-[var(--accent-danger)]'}`}
          >
            ${(totalBudget - totalSpent).toLocaleString()}
          </h3>
        </Card>
      </div>

      {/* Budget Categories */}
      <Card title={`Budget for ${monthLabel}`}>
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-md">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                size={18}
              />
              <input
                type="text"
                placeholder="Search categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortField)}
                className="px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none text-sm"
              >
                <option value="name">Sort: Name</option>
                <option value="budget">Sort: Budget (High-Low)</option>
                <option value="spent">Sort: Spent (High-Low)</option>
                <option value="remaining">Sort: Remaining (High-Low)</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none text-sm"
              >
                <option value="all">All Status</option>
                <option value="over">Over Budget</option>
                <option value="under">Under Budget</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            {isAdding ? (
              <div className="flex gap-2 animate-in fade-in slide-in-from-right-4 duration-200">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category Name"
                  className="px-3 py-1 text-sm border border-[var(--border-strong)] bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded focus:border-[var(--accent-primary)] outline-none"
                  autoFocus
                />
                <button
                  onClick={handleAddCategory}
                  className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={() => setIsAdding(false)}
                  className="p-1 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded hover:bg-[var(--border-default)]"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAdding(true)}
                className="text-sm text-indigo-600 font-medium flex items-center gap-1 hover:underline"
              >
                <Plus size={16} /> Add Category
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            {filteredStats.map((cat) => (
              <div
                key={cat.id}
                className="relative p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] hover:shadow-sm transition-shadow"
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-[var(--text-primary)]">{cat.name}</span>
                    {cat.percent > 100 && <AlertCircle size={16} className="text-red-500" />}
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <button
                      onClick={() => onDeleteCategory(cat.id)}
                      className="text-[var(--text-muted)] hover:text-[var(--accent-danger)] transition-colors p-1"
                      title="Delete Category"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-end mb-1">
                  <div className="text-sm text-[var(--text-secondary)]">
                    Spent:{' '}
                    <span className="font-semibold text-[var(--text-primary)]">
                      ${cat.spent.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm flex flex-col items-end">
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-medium mb-1">
                      Monthly Limit
                    </span>
                    {editingId === cat.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-28 px-2 py-1 border border-[var(--accent-primary)] rounded text-right outline-none bg-[var(--bg-secondary)] text-[var(--text-primary)] font-semibold"
                          autoFocus
                        />
                        <button
                          onClick={() => saveEdit(cat)}
                          className="text-[var(--accent-primary)] hover:bg-[var(--accent-primary-light)] p-1 rounded"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-[var(--accent-danger)] hover:bg-[var(--accent-danger-light)] p-1 rounded"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-2 group cursor-pointer"
                        onClick={() => startEditing(cat)}
                      >
                        <span className="font-bold text-lg text-[var(--text-primary)] border-b border-transparent group-hover:border-[var(--border-strong)] transition-colors">
                          ${cat.budget.toLocaleString()}
                        </span>
                        <Pencil
                          size={14}
                          className="text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Default Budget Display */}
                <div className="flex justify-end mb-1">
                  <div className="text-xs text-[var(--text-muted)]">
                    Default:
                    {editingDefaultId === cat.id ? (
                      <span className="inline-flex items-center gap-1 ml-1">
                        <input
                          type="number"
                          value={editDefaultValue}
                          onChange={(e) => setEditDefaultValue(e.target.value)}
                          className="w-20 px-1 py-0.5 border border-[var(--accent-primary)] rounded text-right outline-none bg-[var(--bg-secondary)] text-[var(--text-primary)] text-xs"
                          autoFocus
                        />
                        <button
                          onClick={() => saveDefaultEdit(cat)}
                          className="text-[var(--accent-primary)] hover:bg-[var(--accent-primary-light)] p-0.5 rounded"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={() => setEditingDefaultId(null)}
                          className="text-[var(--accent-danger)] hover:bg-[var(--accent-danger-light)] p-0.5 rounded"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ) : (
                      <span
                        className="ml-1 cursor-pointer hover:text-[var(--text-secondary)] hover:underline"
                        onClick={() => startEditingDefault(cat)}
                      >
                        ${cat.defaultMonthlyBudget.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-2 w-full bg-[var(--bg-primary)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      cat.percent > 100
                        ? 'bg-red-500'
                        : cat.percent > 80
                          ? 'bg-amber-400'
                          : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(cat.percent, 100)}%` }}
                  />
                </div>

                <div className="flex justify-between mt-1 text-xs font-medium">
                  <span className={`${cat.percent > 100 ? 'text-[var(--accent-danger)]' : 'text-[var(--text-secondary)]'}`}>
                    {cat.percent.toFixed(1)}% Used
                  </span>
                  <span className="text-[var(--text-secondary)]">
                    Remaining: ${cat.remaining.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}

            {filteredStats.length === 0 && (
              <div className="text-center py-8 text-[var(--text-muted)]">
                {stats.length === 0
                  ? 'No categories defined. Add one to start budgeting.'
                  : 'No categories match your filters.'}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
