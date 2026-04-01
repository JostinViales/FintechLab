import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { TransactionType } from '../../types';
import type { AppContext } from '../../App';
import { AccountList } from '../../components/accounts/AccountList';
import { BalanceChart } from '../../components/charts/BalanceChart';
import { Card } from '../../components/ui/Card';
import { Plus, ArrowRightLeft } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const {
    accounts,
    filteredTransactions,
    monthStats,
    netWorth,
    openAccountModal,
    handleDeleteAccount,
    openTransactionModal,
    navigateToTransactions,
  } = useOutletContext<AppContext>();

  return (
    <div className="animate-in fade-in duration-300">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="border-l-4 border-l-[var(--accent-primary)]">
          <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">Net Worth</p>
          <h3 className="text-2xl font-bold text-[var(--text-primary)]">
            ${netWorth.toLocaleString()}
          </h3>
        </Card>
        <Card className="border-l-4 border-l-[var(--accent-success)]">
          <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">Monthly Income</p>
          <h3 className="text-2xl font-bold text-[var(--accent-success)]">
            +${monthStats.income.toLocaleString()}
          </h3>
        </Card>
        <Card className="border-l-4 border-l-[var(--accent-danger)]">
          <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">Monthly Expenses</p>
          <h3 className="text-2xl font-bold text-[var(--accent-danger)]">
            -${monthStats.expense.toLocaleString()}
          </h3>
        </Card>
      </div>

      <AccountList
        accounts={accounts}
        onAddAccount={() => openAccountModal()}
        onEditAccount={openAccountModal}
        onDeleteAccount={handleDeleteAccount}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
        <div className="xl:col-span-2 space-y-8">
          <Card title="Analytics">
            <BalanceChart accounts={accounts} />
          </Card>
        </div>

        <div className="xl:col-span-1">
          <Card title="Recent Transactions" className="h-full">
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {filteredTransactions.length === 0 ? (
                <p className="text-center text-[var(--text-muted)] py-8">
                  No transactions for this month.
                </p>
              ) : (
                filteredTransactions.slice(0, 10).map((tx) => {
                  const accountName =
                    accounts.find((a) => a.id === tx.accountId)?.name ?? 'Unknown';
                  return (
                    <div
                      key={tx.id}
                      className="flex justify-between items-center p-3 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors border border-transparent hover:border-[var(--border-subtle)] cursor-pointer"
                      onClick={() => openTransactionModal(tx)}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-full ${
                            tx.type === TransactionType.INCOME
                              ? 'bg-[var(--accent-success-light)] text-[var(--accent-success)]'
                              : tx.type === TransactionType.EXPENSE
                                ? 'bg-[var(--accent-danger-light)] text-[var(--accent-danger)]'
                                : 'bg-[var(--accent-info-light)] text-[var(--accent-info)]'
                          }`}
                        >
                          {tx.type === TransactionType.INCOME ? (
                            <Plus size={16} />
                          ) : tx.type === TransactionType.EXPENSE ? (
                            <ArrowRightLeft size={16} className="rotate-45" />
                          ) : (
                            <ArrowRightLeft size={16} />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">{tx.description}</p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {tx.date} &bull; {accountName}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`font-semibold ${
                          tx.type === TransactionType.INCOME
                            ? 'text-[var(--accent-success)]'
                            : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {tx.type === TransactionType.EXPENSE ? '-' : '+'}$
                        {tx.amount.toLocaleString()}
                      </span>
                    </div>
                  );
                })
              )}
              {filteredTransactions.length > 10 && (
                <button
                  onClick={navigateToTransactions}
                  className="w-full text-center text-[var(--accent-primary)] text-sm font-medium pt-2"
                >
                  View All Transactions
                </button>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
