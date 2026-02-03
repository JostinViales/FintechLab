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

export const BulkTransactionForm: React.FC<BulkTransactionFormProps> = ({ accounts, categories, onClose, onSubmit }) => {
  const [rows, setRows] = useState<BulkRow[]>([
    createEmptyRow()
  ]);

  function createEmptyRow(): BulkRow {
    return {
        localId: crypto.randomUUID(),
        type: TransactionType.EXPENSE,
        date: new Date().toISOString().split('T')[0],
        description: '',
        amount: '',
        accountId: accounts[0]?.id || '',
        categoryName: categories[0]?.name || ''
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
          setRows(rows.filter(r => r.localId !== id));
      }
  };
  
  const updateRow = (id: string, field: keyof BulkRow, value: any) => {
      setRows(rows.map(r => r.localId === id ? { ...r, [field]: value } : r));
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
              accountId: row.accountId
              // Transfers are not supported in this simple bulk view to avoid UI complexity (need to/from)
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col relative animate-in fade-in zoom-in duration-200">
               {/* Header */}
               <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Bulk Add Expenses</h2>
                        <p className="text-sm text-slate-500">Quickly add multiple transactions at once.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm hover:shadow transition-all"><X size={20} /></button>
               </div>
               
               {/* Body - Scrollable */}
               <div className="flex-1 overflow-y-auto p-6">
                   <table className="w-full text-left border-collapse">
                       <thead>
                           <tr className="text-xs font-semibold text-slate-500 border-b border-slate-200">
                               <th className="pb-3 pl-2 w-24">Type</th>
                               <th className="pb-3 w-36">Date</th>
                               <th className="pb-3">Description</th>
                               <th className="pb-3 w-32">Amount</th>
                               <th className="pb-3 w-40">Account</th>
                               <th className="pb-3 w-40">Category</th>
                               <th className="pb-3 w-20"></th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                           {rows.map((row) => (
                               <tr key={row.localId} className="group hover:bg-slate-50 transition-colors">
                                   <td className="p-2 align-top">
                                        <select 
                                            value={row.type}
                                            onChange={(e) => updateRow(row.localId, 'type', e.target.value)}
                                            className="w-full p-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-200 outline-none bg-white"
                                        >
                                            <option value={TransactionType.EXPENSE}>Expense</option>
                                            <option value={TransactionType.INCOME}>Income</option>
                                        </select>
                                   </td>
                                   <td className="p-2 align-top">
                                        <input 
                                            type="date"
                                            value={row.date}
                                            onChange={(e) => updateRow(row.localId, 'date', e.target.value)}
                                            className="w-full p-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-200 outline-none"
                                        />
                                   </td>
                                   <td className="p-2 align-top">
                                        <input 
                                            type="text"
                                            value={row.description}
                                            onChange={(e) => updateRow(row.localId, 'description', e.target.value)}
                                            placeholder="Description"
                                            className="w-full p-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-200 outline-none"
                                        />
                                   </td>
                                   <td className="p-2 align-top">
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                            <input 
                                                type="number"
                                                step="0.01"
                                                value={row.amount}
                                                onChange={(e) => updateRow(row.localId, 'amount', e.target.value)}
                                                className="w-full pl-6 p-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-200 outline-none"
                                                placeholder="0.00"
                                            />
                                        </div>
                                   </td>
                                   <td className="p-2 align-top">
                                        <select
                                            value={row.accountId}
                                            onChange={(e) => updateRow(row.localId, 'accountId', e.target.value)}
                                            className="w-full p-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-200 outline-none bg-white"
                                        >
                                            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                        </select>
                                   </td>
                                   <td className="p-2 align-top">
                                        <select
                                            value={row.categoryName}
                                            onChange={(e) => updateRow(row.localId, 'categoryName', e.target.value)}
                                            className="w-full p-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-200 outline-none bg-white"
                                        >
                                            {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                                        </select>
                                   </td>
                                   <td className="p-2 align-top flex gap-1 justify-end">
                                       <button onClick={() => duplicateRow(row)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Duplicate Row">
                                           <Copy size={16} />
                                       </button>
                                       <button onClick={() => removeRow(row.localId)} className={`p-2 rounded transition-colors ${rows.length > 1 ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' : 'text-slate-200 cursor-not-allowed'}`} disabled={rows.length <= 1} title="Remove Row">
                                           <Trash2 size={16} />
                                       </button>
                                   </td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
                   <button onClick={addRow} className="mt-6 flex items-center gap-2 text-indigo-600 font-semibold hover:text-indigo-700 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors w-fit">
                       <Plus size={18} /> Add Another Row
                   </button>
               </div>
               
               {/* Footer */}
               <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-between items-center">
                   <div className="text-sm text-slate-500">
                        {rows.filter(r => r.amount && r.description).length} ready to save
                   </div>
                   <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 rounded-lg transition-all">Cancel</button>
                        <button onClick={handleSubmit} className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-colors">
                            Save All Transactions
                        </button>
                   </div>
               </div>
          </div>
      </div>
  );
};