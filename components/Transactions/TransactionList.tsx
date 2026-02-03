import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, Account } from '../../types';
import { Search, Filter, ArrowUp, ArrowDown, Pencil, Trash2 } from 'lucide-react';
import { Card } from '../ui/Card';

interface TransactionListProps {
  transactions: Transaction[];
  accounts: Account[];
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
}

type SortField = 'date' | 'amount';
type SortOrder = 'asc' | 'desc';

export const TransactionList: React.FC<TransactionListProps> = ({ transactions, accounts, onEdit, onDelete }) => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<TransactionType | 'All'>('All');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterAccount, setFilterAccount] = useState<string>('All');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Get unique categories from transactions
  const uniqueCategories = useMemo(() => {
    const cats = new Set(transactions.map(t => t.category));
    return Array.from(cats).sort();
  }, [transactions]);

  const processedTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        const matchesSearch = t.description.toLowerCase().includes(search.toLowerCase()) ||
          t.category.toLowerCase().includes(search.toLowerCase());
        const matchesType = filterType === 'All' || t.type === filterType;
        const matchesCategory = filterCategory === 'All' || t.category === filterCategory;
        const matchesAccount = filterAccount === 'All' || t.accountId === filterAccount;
        return matchesSearch && matchesType && matchesCategory && matchesAccount;
      })
      .sort((a, b) => {
        const mul = sortOrder === 'asc' ? 1 : -1;
        if (sortField === 'date') {
          return mul * (new Date(a.date).getTime() - new Date(b.date).getTime());
        }
        return mul * (a.amount - b.amount);
      });
  }, [transactions, search, filterType, filterCategory, filterAccount, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getAccountName = (id?: string) => accounts.find(a => a.id === id)?.name || 'Unknown';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search description or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none text-sm"
          >
            <option value="All">All Types</option>
            <option value={TransactionType.INCOME}>Income</option>
            <option value={TransactionType.EXPENSE}>Expense</option>
            <option value={TransactionType.TRANSFER}>Transfer</option>
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none text-sm"
          >
            <option value="All">All Categories</option>
            {uniqueCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none text-sm"
          >
            <option value="All">All Accounts</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                  onClick={() => toggleSort('date')}
                >
                  <div className="flex items-center gap-1">
                    Date
                    {sortField === 'date' && (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Account</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                <th
                  className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                  onClick={() => toggleSort('amount')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Amount
                    {sortField === 'amount' && (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {processedTransactions.map(t => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{t.date}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{t.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {getAccountName(t.accountId)}
                    {t.type === TransactionType.TRANSFER && ` → ${getAccountName(t.toAccountId)}`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    <span className="px-2 py-1 rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                      {t.category}
                    </span>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${t.type === TransactionType.INCOME ? 'text-emerald-600' :
                      t.type === TransactionType.EXPENSE ? 'text-slate-900' : 'text-blue-600'
                    }`}>
                    {t.type === TransactionType.EXPENSE ? '-' : '+'}${t.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => onEdit(t)} className="text-indigo-600 hover:text-indigo-900 mr-3">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => onDelete(t.id)} className="text-red-600 hover:text-red-900">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {processedTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No transactions found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};