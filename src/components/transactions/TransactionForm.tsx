import React, { useState } from 'react';
import { Account, Category, Transaction, TransactionType } from '@/types';
import { X } from 'lucide-react';

interface TransactionFormProps {
  accounts: Account[];
  categories: Category[];
  initialData?: Transaction | null;
  onClose: () => void;
  onSubmit: (data: Omit<Transaction, 'id'>) => void;
}

function getDefaultToAccountId(accounts: Account[], initialData?: Transaction | null): string {
  if (initialData?.toAccountId) return initialData.toAccountId;
  const secondAccount = accounts[1];
  if (accounts.length > 1 && secondAccount) return secondAccount.id;
  return '';
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  accounts,
  categories,
  initialData,
  onClose,
  onSubmit,
}) => {
  const [type, setType] = useState<TransactionType>(initialData?.type ?? TransactionType.EXPENSE);
  const [amount, setAmount] = useState(initialData?.amount.toString() ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [category, setCategory] = useState(initialData?.category ?? categories[0]?.name ?? '');
  const [accountId, setAccountId] = useState(initialData?.accountId ?? accounts[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState(getDefaultToAccountId(accounts, initialData));
  const [date, setDate] = useState(initialData?.date ?? new Date().toISOString().slice(0, 10));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !accountId) return;

    onSubmit({
      type,
      amount: parseFloat(amount),
      description,
      category,
      accountId,
      toAccountId: type === TransactionType.TRANSFER ? toAccountId : undefined,
      date,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-xl bg-[var(--bg-secondary)] p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X size={24} />
        </button>

        <h2 className="mb-6 text-2xl font-bold text-[var(--text-primary)]">
          {initialData ? 'Edit Transaction' : 'New Transaction'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type Selector */}
          <div className="flex rounded-lg bg-[var(--bg-tertiary)] p-1">
            {Object.values(TransactionType).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                  type === t
                    ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                $
              </span>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] pl-8 pr-4 py-2 text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Accounts */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                {type === TransactionType.INCOME ? 'To Account' : 'From Account'}
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} (${acc.balance})
                  </option>
                ))}
              </select>
            </div>

            {type === TransactionType.TRANSFER && (
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                  To Account
                </label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                >
                  {accounts
                    .filter((a) => a.id !== accountId)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} (${acc.balance})
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {/* Description & Category */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
              Description
            </label>
            <input
              type="text"
              required
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
              placeholder="e.g. Grocery Shopping"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
              Date
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
            />
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white shadow-md transition-colors hover:bg-indigo-700"
          >
            {initialData ? 'Save Changes' : 'Add Transaction'}
          </button>
        </form>
      </div>
    </div>
  );
};
