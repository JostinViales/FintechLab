import React from 'react';
import { Account, AccountType } from '../../types';
import { Wallet, TrendingUp, CreditCard, DollarSign, Plus, Pencil, Trash2, Landmark, Banknote } from 'lucide-react';
import { Card } from '../ui/Card';

interface AccountListProps {
  accounts: Account[];
  onAddAccount: () => void;
  onEditAccount: (account: Account) => void;
  onDeleteAccount: (id: string) => void;
}

const getIcon = (type: AccountType) => {
  switch (type) {
    case AccountType.INVESTMENT: return <TrendingUp size={20} className="text-purple-600" />;
    case AccountType.CREDIT: return <CreditCard size={20} className="text-red-500" />;
    case AccountType.SAVINGS: return <Wallet size={20} className="text-emerald-500" />;
    case AccountType.DEBT: return <Banknote size={20} className="text-amber-600" />;
    case AccountType.LOAN: return <Landmark size={20} className="text-orange-600" />;
    default: return <DollarSign size={20} className="text-indigo-500" />;
  }
};

export const AccountList: React.FC<AccountListProps> = ({ accounts, onAddAccount, onEditAccount, onDeleteAccount }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {accounts.map((account) => {
        const isNegative = account.balance < 0;
        return (
          <Card key={account.id} className="relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
              <button 
                onClick={(e) => { e.stopPropagation(); onEditAccount(account); }}
                className="p-1.5 bg-white text-slate-500 hover:text-indigo-600 rounded shadow-sm border border-slate-100"
              >
                <Pencil size={14} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onDeleteAccount(account.id); }}
                className="p-1.5 bg-white text-slate-500 hover:text-red-600 rounded shadow-sm border border-slate-100"
              >
                <Trash2 size={14} />
              </button>
            </div>

            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">{account.type}</p>
                <h4 className="text-xl font-bold text-slate-900 truncate pr-2">{account.name}</h4>
              </div>
              <div className={`p-2 rounded-full bg-slate-50`}>
                {getIcon(account.type)}
              </div>
            </div>
            <div className="mt-4">
              <span className={`text-2xl font-bold ${isNegative ? 'text-red-600' : 'text-slate-800'}`}>
                {isNegative ? '-' : ''}${Math.abs(account.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div 
              className="absolute bottom-0 left-0 h-1 bg-current opacity-50" 
              style={{ width: '100%', color: account.color }} 
            />
          </Card>
        );
      })}

      {/* Add Account Card */}
      <button 
        onClick={onAddAccount}
        className="flex flex-col items-center justify-center h-full min-h-[140px] bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all group"
      >
        <div className="p-3 rounded-full bg-white shadow-sm mb-3 group-hover:scale-110 transition-transform">
          <Plus size={24} className="text-indigo-500" />
        </div>
        <span className="font-semibold text-slate-600 group-hover:text-indigo-600">Add Account</span>
      </button>
    </div>
  );
};