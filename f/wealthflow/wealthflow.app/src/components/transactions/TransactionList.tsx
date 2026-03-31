import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, Account } from '@/types';
import { Search, ArrowUp, ArrowDown, Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';

interface TransactionListProps {
  transactions: Transaction[];
  accounts: Account[];
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
}

type SortField = 'date' | 'amount';
type SortOrder = 'asc' | 'desc';

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  accounts,
  onEdit,
  onDelete,
}) => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<TransactionType | 'All'>('All');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterAccount, setFilterAccount] = useState<string>('All');
  const [filterMonth, setFilterMonth] = useState<string>('All');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Get unique categories from transactions
  const uniqueCategories = useMemo(() => {
    const cats = new Set(transactions.map((t) => t.category));
    return Array.from(cats).sort();
  }, [transactions]);

  // Get unique months from transactions (YYYY-MM format)
  const uniqueMonths = useMemo(() => {
    const months = new Set(transactions.map((t) => t.date.slice(0, 7)));
    return Array.from(months).sort().reverse();
  }, [transactions]);

  const formatMonthLabel = (yyyyMm: string): string => {
    const [year, month] = yyyyMm.split('-');
    const date = new Date(Number(year), Number(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const processedTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        const matchesSearch =
          t.description.toLowerCase().includes(search.toLowerCase()) ||
          t.category.toLowerCase().includes(search.toLowerCase());
        const matchesType = filterType === 'All' || t.type === filterType;
        const matchesCategory = filterCategory === 'All' || t.category === filterCategory;
        const matchesAccount = filterAccount === 'All' || t.accountId === filterAccount;
        const matchesMonth = filterMonth === 'All' || t.date.startsWith(filterMonth);
        return matchesSearch && matchesType && matchesCategory && matchesAccount && matchesMonth;
      })
      .sort((a, b) => {
        const mul = sortOrder === 'asc' ? 1 : -1;
        if (sortField === 'date') {
          return mul * (new Date(a.date).getTime() - new Date(b.date).getTime());
        }
        return mul * (a.amount - b.amount);
      });
  }, [transactions, search, filterType, filterCategory, filterAccount, filterMonth, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getAccountName = (id?: string) => accounts.find((a) => a.id === id)?.name || 'Unknown';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:justify-between">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            size={18}
          />
          <input
            type="text"
            placeholder="Search description or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] pl-10 pr-4 py-2 text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as TransactionType | 'All')}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:outline-none"
          >
            <option value="All">All Types</option>
            <option value={TransactionType.INCOME}>Income</option>
            <option value={TransactionType.EXPENSE}>Expense</option>
            <option value={TransactionType.TRANSFER}>Transfer</option>
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:outline-none"
          >
            <option value="All">All Categories</option>
            {uniqueCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <select
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:outline-none"
          >
            <option value="All">All Accounts</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:outline-none"
          >
            <option value="All">All Months</option>
            {uniqueMonths.map((month) => (
              <option key={month} value={month}>
                {formatMonthLabel(month)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {/* Desktop Table View */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full">
            <thead className="border-b border-[var(--border-default)] bg-[var(--bg-tertiary)]">
              <tr>
                <th
                  className="cursor-pointer px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
                  onClick={() => toggleSort('date')}
                >
                  <div className="flex items-center gap-1">
                    Date
                    {sortField === 'date' &&
                      (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Account
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Category
                </th>
                <th
                  className="cursor-pointer px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
                  onClick={() => toggleSort('amount')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Amount
                    {sortField === 'amount' &&
                      (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--bg-secondary)]">
              {processedTransactions.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-[var(--bg-tertiary)]">
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-[var(--text-secondary)]">
                    {t.date}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-[var(--text-primary)]">
                    {t.description}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-[var(--text-secondary)]">
                    {getAccountName(t.accountId)}
                    {t.type === TransactionType.TRANSFER && ` → ${getAccountName(t.toAccountId)}`}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-[var(--text-secondary)]">
                    <span className="rounded-full bg-[var(--bg-tertiary)] px-2 py-1 text-xs font-medium text-[var(--text-secondary)]">
                      {t.category}
                    </span>
                  </td>
                  <td
                    className={`whitespace-nowrap px-6 py-4 text-right text-sm font-bold ${
                      t.type === TransactionType.INCOME
                        ? 'text-[var(--accent-success)]'
                        : t.type === TransactionType.EXPENSE
                          ? 'text-[var(--text-primary)]'
                          : 'text-[var(--accent-info)]'
                    }`}
                  >
                    {t.type === TransactionType.EXPENSE ? '-' : '+'}${t.amount.toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    <button
                      onClick={() => onEdit(t)}
                      className="mr-3 text-[var(--accent-primary)] hover:opacity-80"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => onDelete(t.id)}
                      className="text-[var(--accent-danger)] hover:opacity-80"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {processedTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[var(--text-muted)]">
                    No transactions found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="divide-y divide-[var(--border-subtle)] md:hidden">
          {processedTransactions.length === 0 ? (
            <div className="px-4 py-12 text-center text-[var(--text-muted)]">
              No transactions found matching your filters.
            </div>
          ) : (
            processedTransactions.map((t) => (
              <div
                key={t.id}
                className="bg-[var(--bg-secondary)] p-4 transition-colors active:bg-[var(--bg-tertiary)]"
                onClick={() => onEdit(t)}
              >
                <div className="flex gap-3">
                  {/* Type Indicator */}
                  <div
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      t.type === TransactionType.INCOME
                        ? 'bg-[var(--accent-success)]'
                        : t.type === TransactionType.EXPENSE
                          ? 'bg-[var(--accent-danger)]'
                          : 'bg-[var(--accent-info)]'
                    }`}
                  />

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-medium text-[var(--text-primary)]">
                        {t.description}
                      </p>
                      <span
                        className={`shrink-0 font-bold ${
                          t.type === TransactionType.INCOME
                            ? 'text-[var(--accent-success)]'
                            : t.type === TransactionType.EXPENSE
                              ? 'text-[var(--text-primary)]'
                              : 'text-[var(--accent-info)]'
                        }`}
                      >
                        {t.type === TransactionType.EXPENSE ? '-' : '+'}${t.amount.toLocaleString()}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <span>{t.date}</span>
                      <span>•</span>
                      <span className="truncate">{getAccountName(t.accountId)}</span>
                      {t.type === TransactionType.TRANSFER && (
                        <>
                          <span>→</span>
                          <span className="truncate">{getAccountName(t.toAccountId)}</span>
                        </>
                      )}
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="inline-block rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                        {t.category}
                      </span>

                      {/* Action Buttons */}
                      <div className="flex gap-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(t);
                          }}
                          className="rounded-full p-2 text-[var(--accent-primary)] active:bg-[var(--accent-primary-light)]"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(t.id);
                          }}
                          className="rounded-full p-2 text-[var(--accent-danger)] active:bg-[var(--accent-danger-light)]"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};
