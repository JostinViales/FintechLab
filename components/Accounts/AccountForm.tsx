import React, { useState, useEffect } from 'react';
import { Account, AccountType } from '../../types';
import { X } from 'lucide-react';

interface AccountFormProps {
  initialData?: Account | null;
  onClose: () => void;
  onSubmit: (data: Omit<Account, 'id'>) => void;
}

const LIABILITY_TYPES = [AccountType.CREDIT, AccountType.DEBT, AccountType.LOAN];

export const AccountForm: React.FC<AccountFormProps> = ({ initialData, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>(AccountType.CHECKING);
  const [balance, setBalance] = useState('');
  const [color, setColor] = useState('#6366f1');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setType(initialData.type);
      // Show absolute value for user friendliness if it's a liability, 
      // but if they manually entered a negative for a normal account, keep it.
      const isLiability = LIABILITY_TYPES.includes(initialData.type);
      if (isLiability && initialData.balance < 0) {
        setBalance(Math.abs(initialData.balance).toString());
      } else {
        setBalance(initialData.balance.toString());
      }
      setColor(initialData.color);
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    let finalBalance = parseFloat(balance) || 0;
    
    // Automatically negate the balance for liabilities if the user entered a positive number (amount owed)
    if (LIABILITY_TYPES.includes(type) && finalBalance > 0) {
        finalBalance = -finalBalance;
    }

    onSubmit({
      name,
      type,
      balance: finalBalance,
      color,
    });
    onClose();
  };

  const isLiability = LIABILITY_TYPES.includes(type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold text-slate-800 mb-6">
          {initialData ? 'Edit Account' : 'New Account'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Account Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
              placeholder={isLiability ? "e.g. Student Loan" : "e.g. Chase Sapphire"}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Account Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none bg-white"
            >
              {Object.values(AccountType).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {isLiability ? 'Amount Owed (Positive Value)' : 'Current Balance'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input
                type="number"
                step="0.01"
                required
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="w-full pl-8 pr-4 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                placeholder="0.00"
              />
            </div>
            {isLiability ? (
              <p className="text-xs text-slate-500 mt-1">
                Enter the amount you owe. We'll store it as a negative balance automatically.
              </p>
            ) : (
              initialData && (
                <p className="text-xs text-amber-600 mt-1">
                  Warning: Editing balance directly may cause discrepancies with transaction history.
                </p>
              )
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Color Tag</label>
            <div className="flex gap-2">
              {['#6366f1', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md transition-colors mt-2"
          >
            {initialData ? 'Save Changes' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
};