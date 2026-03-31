import React from 'react';
import { Account, AccountType } from '@/types';
import {
  Wallet,
  TrendingUp,
  CreditCard,
  DollarSign,
  Plus,
  Pencil,
  Trash2,
  Landmark,
  Banknote,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/format';

function getGoalProgress(account: Account) {
  if (!account.goal || account.goal <= 0) return null;
  const percent = Math.min(Math.max((account.balance / account.goal) * 100, 0), 100);
  const remaining = Math.max(0, account.goal - account.balance);
  const isComplete = account.balance >= account.goal;
  return { percent, remaining, isComplete };
}

function getDeadlineInfo(deadline: string | null | undefined, remaining: number) {
  if (!deadline || remaining <= 0) return null;
  const now = new Date();
  const target = new Date(deadline);
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const monthsLeft = Math.max(0, diffDays / 30.44);

  let label: string;
  let urgency: 'success' | 'warning' | 'danger';

  if (diffDays < 0) {
    label = 'Overdue';
    urgency = 'danger';
  } else if (diffDays < 30) {
    label = `${diffDays}d left`;
    urgency = 'danger';
  } else if (monthsLeft < 3) {
    label = `${Math.ceil(monthsLeft)}mo left`;
    urgency = 'warning';
  } else {
    label = `${Math.ceil(monthsLeft)}mo left`;
    urgency = 'success';
  }

  const monthlySavingsNeeded = monthsLeft > 0 ? remaining / monthsLeft : remaining;

  return { label, urgency, monthlySavingsNeeded };
}

interface AccountListProps {
  accounts: Account[];
  onAddAccount: () => void;
  onEditAccount: (account: Account) => void;
  onDeleteAccount: (id: string) => void;
}

const getIcon = (type: AccountType) => {
  switch (type) {
    case AccountType.INVESTMENT:
      return <TrendingUp size={20} className="text-purple-500" />;
    case AccountType.CREDIT:
      return <CreditCard size={20} className="text-[var(--accent-danger)]" />;
    case AccountType.SAVINGS:
      return <Wallet size={20} className="text-[var(--accent-success)]" />;
    case AccountType.DEBT:
      return <Banknote size={20} className="text-amber-500" />;
    case AccountType.LOAN:
      return <Landmark size={20} className="text-orange-500" />;
    default:
      return <DollarSign size={20} className="text-[var(--accent-primary)]" />;
  }
};

export const AccountList: React.FC<AccountListProps> = ({
  accounts,
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {accounts.map((account) => {
        const isNegative = account.balance < 0;
        return (
          <Card
            key={account.id}
            className="relative overflow-hidden group hover:shadow-md transition-shadow"
          >
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditAccount(account);
                }}
                className="p-1.5 bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] rounded shadow-sm border border-[var(--border-subtle)]"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteAccount(account.id);
                }}
                className="p-1.5 bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--accent-danger)] rounded shadow-sm border border-[var(--border-subtle)]"
              >
                <Trash2 size={14} />
              </button>
            </div>

            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">
                  {account.type}
                </p>
                <h4 className="text-xl font-bold text-[var(--text-primary)] truncate pr-2">
                  {account.name}
                </h4>
              </div>
              <div className="p-2 rounded-full bg-[var(--bg-tertiary)]">
                {getIcon(account.type)}
              </div>
            </div>
            <div className="mt-4">
              <span
                className={`text-2xl font-bold ${isNegative ? 'text-[var(--accent-danger)]' : 'text-[var(--text-primary)]'}`}
              >
                {isNegative ? '-' : ''}$
                {Math.abs(account.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            {(() => {
              const progress = getGoalProgress(account);
              if (!progress) return null;
              const deadlineInfo = getDeadlineInfo(account.deadline, progress.remaining);
              const urgencyColor = {
                success: 'text-[var(--accent-success)]',
                warning: 'text-[var(--accent-warning)]',
                danger: 'text-[var(--accent-danger)]',
              };
              return (
                <div className="mt-3 space-y-1.5">
                  <div className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${progress.isComplete ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[var(--text-secondary)]">
                      {progress.isComplete
                        ? 'Goal reached!'
                        : `${Math.round(progress.percent)}% of ${formatCurrency(account.goal!)}`}
                    </span>
                    {deadlineInfo && !progress.isComplete && (
                      <span className={urgencyColor[deadlineInfo.urgency]}>
                        {formatCurrency(Math.round(deadlineInfo.monthlySavingsNeeded))}/mo
                      </span>
                    )}
                  </div>
                  {deadlineInfo && !progress.isComplete && (
                    <div className="text-right">
                      <span
                        className={`text-[10px] font-medium ${urgencyColor[deadlineInfo.urgency]}`}
                      >
                        {deadlineInfo.label}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}
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
        className="flex flex-col items-center justify-center h-full min-h-[140px] bg-[var(--bg-tertiary)] border-2 border-dashed border-[var(--border-default)] rounded-xl hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary-light)] transition-all group"
      >
        <div className="p-3 rounded-full bg-[var(--bg-secondary)] shadow-sm mb-3 group-hover:scale-110 transition-transform">
          <Plus size={24} className="text-[var(--accent-primary)]" />
        </div>
        <span className="font-semibold text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)]">
          Add Account
        </span>
      </button>
    </div>
  );
};
