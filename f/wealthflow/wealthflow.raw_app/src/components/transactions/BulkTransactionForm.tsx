import React, { useState } from 'react';
import { Account, Category, Transaction, TransactionType } from '../../types';
import { X, Plus, Trash2, Copy } from 'lucide-react';

interface BulkTransactionFormProps {
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
  onSubmit: (transactions: Omit<Transaction, 'id'>[]) => void;
}

interface BulkRow {
  localId: string;
  type: TransactionType;
  date: string;
  description: string;
  amount: string;
  accountId: string;
  categoryName: string;
}

export const BulkTransactionForm: React.FC<BulkTransactionFormProps> = ({
  accounts,
  categories,
  onClose,
  onSubmit,
}) => {
  const [rows, setRows] = useState<BulkRow[]>([createEmptyRow()]);

  function createEmptyRow(): BulkRow {
    return {
      localId: crypto.randomUUID(),
      type: TransactionType.EXPENSE,
      date: new Date().toISOString().slice(0, 10),
      description: '',
      amount: '',
      accountId: accounts[0]?.id || '',
      categoryName: categories[0]?.name || '',
    };
  }

  const addRow = () => {
    const lastRow = rows[rows.length - 1];
    const newRow = createEmptyRow();
    // Copy date and account from previous row for better UX
    if (lastRow) {
      newRow.date = lastRow.date;
      newRow.accountId = lastRow.accountId;
    }
    setRows([...rows, newRow]);
  };

  const duplicateRow = (row: BulkRow) => {
    const newRow = { ...row, localId: crypto.randomUUID() };
    setRows([...rows, newRow]);
  };

  const removeRow = (id: string) => {
    if (rows.length > 1) {
      setRows(rows.filter((r) => r.localId !== id));
    }
  };

  const updateRow = (id: string, field: keyof BulkRow, value: string) => {
    setRows(rows.map((r) => (r.localId === id ? { ...r, [field]: value } : r)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Omit<Transaction, 'id'>[] = [];

    for (const row of rows) {
      if (!row.amount || !row.description) continue;

      const amount = parseFloat(row.amount);
      if (isNaN(amount)) continue;

      payload.push({
        date: row.date,
        description: row.description,
        amount: amount,
        type: row.type,
        category: row.categoryName,
        accountId: row.accountId,
        // Transfers are not supported in this simple bulk view
        // to avoid UI complexity (need to/from)
      });
    }

    if (payload.length > 0) {
      onSubmit(payload);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative flex w-full max-w-5xl flex-col rounded-xl bg-[var(--bg-secondary)] shadow-2xl max-h-[90vh] animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-6 rounded-t-xl">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Bulk Add Expenses</h2>
            <p className="text-sm text-[var(--text-secondary)]">Quickly add multiple transactions at once.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-[var(--bg-secondary)] p-2 text-[var(--text-muted)] shadow-sm transition-all hover:text-[var(--text-primary)] hover:shadow"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--border-default)] text-xs font-semibold text-[var(--text-secondary)]">
                <th className="w-24 pb-3 pl-2">Type</th>
                <th className="w-36 pb-3">Date</th>
                <th className="pb-3">Description</th>
                <th className="w-32 pb-3">Amount</th>
                <th className="w-40 pb-3">Account</th>
                <th className="w-40 pb-3">Category</th>
                <th className="w-20 pb-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {rows.map((row) => (
                <tr key={row.localId} className="transition-colors group hover:bg-[var(--bg-tertiary)]">
                  <td className="align-top p-2">
                    <select
                      value={row.type}
                      onChange={(e) => updateRow(row.localId, 'type', e.target.value)}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                    >
                      <option value={TransactionType.EXPENSE}>Expense</option>
                      <option value={TransactionType.INCOME}>Income</option>
                    </select>
                  </td>
                  <td className="align-top p-2">
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) => updateRow(row.localId, 'date', e.target.value)}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                    />
                  </td>
                  <td className="align-top p-2">
                    <input
                      type="text"
                      maxLength={500}
                      value={row.description}
                      onChange={(e) => updateRow(row.localId, 'description', e.target.value)}
                      placeholder="Description"
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                    />
                  </td>
                  <td className="align-top p-2">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={row.amount}
                        onChange={(e) => updateRow(row.localId, 'amount', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 p-2 pl-6 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                        placeholder="0.00"
                      />
                    </div>
                  </td>
                  <td className="align-top p-2">
                    <select
                      value={row.accountId}
                      onChange={(e) => updateRow(row.localId, 'accountId', e.target.value)}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                    >
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="align-top p-2">
                    <select
                      value={row.categoryName}
                      onChange={(e) => updateRow(row.localId, 'categoryName', e.target.value)}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="align-top flex justify-end gap-1 p-2">
                    <button
                      onClick={() => duplicateRow(row)}
                      className="rounded transition-colors p-2 text-[var(--text-muted)] hover:bg-[var(--accent-primary-light)] hover:text-[var(--accent-primary)]"
                      title="Duplicate Row"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      onClick={() => removeRow(row.localId)}
                      className={`rounded p-2 transition-colors ${
                        rows.length > 1
                          ? 'text-[var(--text-muted)] hover:bg-[var(--accent-danger-light)] hover:text-[var(--accent-danger)]'
                          : 'cursor-not-allowed text-[var(--text-muted)] opacity-30'
                      }`}
                      disabled={rows.length <= 1}
                      title="Remove Row"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={addRow}
            className="mt-6 flex w-fit items-center gap-2 rounded-lg px-3 py-2 font-semibold text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-primary-light)] hover:text-[var(--accent-primary-hover)]"
          >
            <Plus size={18} /> Add Another Row
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-6 rounded-b-xl">
          <div className="text-sm text-[var(--text-secondary)]">
            {rows.filter((r) => r.amount && r.description).length} ready to save
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-transparent px-5 py-2.5 font-medium text-[var(--text-secondary)] transition-all hover:border-[var(--border-default)] hover:bg-[var(--bg-secondary)] hover:shadow-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="rounded-lg bg-indigo-600 px-6 py-2.5 font-semibold text-white shadow-md transition-colors hover:bg-indigo-700"
            >
              Save All Transactions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
