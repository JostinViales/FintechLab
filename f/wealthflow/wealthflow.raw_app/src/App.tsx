import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Plus, Layers, Calendar, Loader2 } from 'lucide-react';
import {
  Account,
  Transaction,
  Category,
  MonthlyBudgetAllocation,
  TransactionType,
  AccountType,
} from './types';
import {
  loadData,
  saveData,
  deleteAccount,
  deleteCategory,
  deleteTransaction,
} from './services/supabase/storage';
import { initSupabase } from './services/supabase/client';
import { backend } from '../wmill';
import { AccountForm } from './components/accounts/AccountForm';
import { TransactionForm } from './components/transactions/TransactionForm';
import { BulkTransactionForm } from './components/transactions/BulkTransactionForm';
import { FinancialAdvisor } from './components/ai/FinancialAdvisor';
import { Sidebar } from './components/layout/Sidebar';
import { MobileNav } from './components/layout/MobileNav';
import { TradingInstanceProvider } from './hooks/useTradingInstance';

export interface AppContext {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  monthlyBudgets: MonthlyBudgetAllocation[];
  filteredTransactions: Transaction[];
  monthStats: { income: number; expense: number; savings: number };
  netWorth: number;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  openAccountModal: (account?: Account) => void;
  handleDeleteAccount: (id: string) => void;
  openTransactionModal: (tx?: Transaction) => void;
  handleDeleteTransaction: (id: string) => void;
  handleAddCategory: (name: string) => void;
  handleUpdateCategory: (updatedCat: Category) => void;
  handleDeleteCategory: (id: string) => void;
  handleUpdateMonthlyBudget: (categoryId: string, month: string, amount: number) => void;
  navigateToTransactions: () => void;
}

const VIEW_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Financial Overview', subtitle: 'Track your wealth, monthly budget, and savings.' },
  '/monthly': {
    title: 'Monthly Overview',
    subtitle: 'Analyze spending trends and category breakdown.',
  },
  '/transactions': {
    title: 'Transactions',
    subtitle: 'Manage all your income and expenses.',
  },
  '/budget': {
    title: 'Monthly Budget',
    subtitle: 'Set your spending limits by category for each month.',
  },
  '/trading': { title: 'Trading', subtitle: 'Track your trades and analyze P&L.' },
  '/portfolio': {
    title: 'Portfolio',
    subtitle: 'Holdings, asset allocation, and performance.',
  },
};

const App: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [monthlyBudgets, setMonthlyBudgets] = useState<MonthlyBudgetAllocation[]>([]);

  // Modal States
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isBulkTransactionModalOpen, setIsBulkTransactionModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);

  // Editing States
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize Supabase from Windmill backend, then load data
  useEffect(() => {
    const init = async () => {
      try {
        const config = await backend.get_supabase_config({}) as {
          url: string;
          key: string;
          user_id: string;
        };
        initSupabase(config.url, config.key, config.user_id || 'default-user');

        const data = await loadData();
        setAccounts(data.accounts);
        setTransactions(data.transactions);
        setCategories(data.categories);
        setMonthlyBudgets(data.monthlyBudgets);
      } catch (error) {
        console.error('Failed to initialize or load data', error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Save data on change
  useEffect(() => {
    if (!loading && accounts.length > 0) {
      const persist = async () => {
        setIsSaving(true);
        await saveData(accounts, transactions, categories, monthlyBudgets);
        setIsSaving(false);
      };

      const timeout = setTimeout(persist, 500);
      return () => clearTimeout(timeout);
    }
  }, [accounts, transactions, categories, monthlyBudgets, loading]);

  // --- Account Logic ---

  const handleSaveAccount = (data: Omit<Account, 'id'>) => {
    if (editingAccount) {
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === editingAccount.id ? { ...data, id: editingAccount.id } : acc,
        ),
      );
    } else {
      const newAccount: Account = { ...data, id: crypto.randomUUID() };
      setAccounts((prev) => [...prev, newAccount]);
    }
    setEditingAccount(null);
  };

  const handleDeleteAccount = (id: string) => {
    if (confirm('Are you sure? This will not delete transactions associated with this account.')) {
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      deleteAccount(id);
    }
  };

  const openAccountModal = (account?: Account) => {
    setEditingAccount(account ?? null);
    setIsAccountModalOpen(true);
  };

  // --- Transaction Logic ---

  const applyTransactionToBalances = (
    currentAccounts: Account[],
    tx: Transaction,
    revert: boolean,
  ): Account[] => {
    const multiplier = revert ? -1 : 1;

    const isDebtPayment = tx.type === TransactionType.EXPENSE && tx.category === 'Debt';

    const targetDebtAccount = isDebtPayment
      ? currentAccounts.find(
          (a) =>
            [AccountType.DEBT, AccountType.LOAN, AccountType.CREDIT].includes(a.type) &&
            a.id !== tx.accountId,
        )
      : null;

    return currentAccounts.map((acc) => {
      let newBalance = acc.balance;

      if (acc.id === tx.accountId) {
        if (tx.type === TransactionType.EXPENSE || tx.type === TransactionType.TRANSFER) {
          newBalance -= tx.amount * multiplier;
        } else if (tx.type === TransactionType.INCOME) {
          newBalance += tx.amount * multiplier;
        }
      }

      if (tx.type === TransactionType.TRANSFER && acc.id === tx.toAccountId) {
        newBalance += tx.amount * multiplier;
      }

      if (isDebtPayment && targetDebtAccount && acc.id === targetDebtAccount.id) {
        newBalance += tx.amount * multiplier;
      }

      return { ...acc, balance: newBalance };
    });
  };

  const handleSaveTransaction = (data: Omit<Transaction, 'id'>) => {
    let updatedTransactions = [...transactions];
    let prevTransaction: Transaction | undefined;

    if (editingTransaction) {
      prevTransaction = transactions.find((t) => t.id === editingTransaction.id);
      updatedTransactions = transactions.map((t) =>
        t.id === editingTransaction.id ? { ...data, id: editingTransaction.id } : t,
      );
    } else {
      updatedTransactions = [{ ...data, id: crypto.randomUUID() }, ...transactions];
    }

    setTransactions(updatedTransactions);

    let tempAccounts = [...accounts];

    if (prevTransaction) {
      tempAccounts = applyTransactionToBalances(tempAccounts, prevTransaction, true);
    }

    const newTx = editingTransaction
      ? { ...data, id: editingTransaction.id }
      : { ...data, id: 'temp' };
    tempAccounts = applyTransactionToBalances(tempAccounts, newTx as Transaction, false);

    setAccounts(tempAccounts);
    setEditingTransaction(null);
  };

  const handleSaveBulkTransactions = (newTransactions: Omit<Transaction, 'id'>[]) => {
    let currentAccounts = [...accounts];
    const createdTransactions: Transaction[] = [];

    newTransactions.forEach((data) => {
      const tx: Transaction = { ...data, id: crypto.randomUUID() };
      createdTransactions.push(tx);
      currentAccounts = applyTransactionToBalances(currentAccounts, tx, false);
    });

    setTransactions((prev) => [...createdTransactions, ...prev]);
    setAccounts(currentAccounts);
    setIsBulkTransactionModalOpen(false);
  };

  const handleDeleteTransaction = (id: string) => {
    if (confirm('Delete this transaction?')) {
      const txToDelete = transactions.find((t) => t.id === id);
      if (txToDelete) {
        setTransactions((prev) => prev.filter((t) => t.id !== id));
        setAccounts((prev) => applyTransactionToBalances(prev, txToDelete, true));
        deleteTransaction(id);
      }
    }
  };

  const openTransactionModal = (tx?: Transaction) => {
    setEditingTransaction(tx ?? null);
    setIsTransactionModalOpen(true);
  };

  // --- Category Logic ---

  const handleAddCategory = (name: string) => {
    const newCat: Category = { id: crypto.randomUUID(), name, defaultMonthlyBudget: 0 };
    setCategories((prev) => [...prev, newCat]);
  };

  const handleUpdateCategory = (updatedCat: Category) => {
    setCategories((prev) => prev.map((c) => (c.id === updatedCat.id ? updatedCat : c)));
  };

  const handleDeleteCategory = (id: string) => {
    const category = categories.find((c) => c.id === id);
    if (!category) return;

    const hasTransactions = transactions.some((t) => t.category === category.name);
    if (hasTransactions) {
      if (
        !confirm(
          `The category "${category.name}" is used in existing transactions. Deleting it will keep the transactions but remove the category from the budget list. Continue?`,
        )
      ) {
        return;
      }
    } else {
      if (!confirm(`Are you sure you want to delete the category "${category.name}"?`)) {
        return;
      }
    }

    setCategories((prev) => prev.filter((c) => c.id !== id));
    setMonthlyBudgets((prev) => prev.filter((mb) => mb.categoryId !== id));
    deleteCategory(id);
  };

  const handleUpdateMonthlyBudget = (categoryId: string, month: string, amount: number) => {
    setMonthlyBudgets((prev) => {
      const existing = prev.find((mb) => mb.categoryId === categoryId && mb.month === month);
      if (existing) {
        return prev.map((mb) =>
          mb.categoryId === categoryId && mb.month === month ? { ...mb, amount } : mb,
        );
      } else {
        return [...prev, { id: crypto.randomUUID(), categoryId, month, amount }];
      }
    });
  };

  // --- Derived State ---

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  const monthStats = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, t) => {
        if (t.type === TransactionType.INCOME) acc.income += t.amount;
        if (t.type === TransactionType.EXPENSE) acc.expense += t.amount;
        if (t.type === TransactionType.TRANSFER) acc.savings += t.amount;
        return acc;
      },
      { income: 0, expense: 0, savings: 0 },
    );
  }, [filteredTransactions]);

  const netWorth = accounts.reduce((acc, curr) => acc + curr.balance, 0);

  const currentPath = location.pathname;
  const viewInfo = VIEW_TITLES[currentPath] ?? { title: 'WealthFlow', subtitle: '' };
  const showDatePicker = currentPath === '/' || currentPath === '/monthly';

  // --- Context for child routes ---
  const outletContext: AppContext = {
    accounts,
    transactions,
    categories,
    monthlyBudgets,
    filteredTransactions,
    monthStats,
    netWorth,
    selectedMonth,
    setSelectedMonth,
    openAccountModal,
    handleDeleteAccount,
    openTransactionModal,
    handleDeleteTransaction,
    handleAddCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    handleUpdateMonthlyBudget,
    navigateToTransactions: () => navigate('/transactions'),
  };

  // --- Views ---

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center">
        <Loader2 size={48} className="text-[var(--accent-primary)] animate-spin mb-4" />
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">Loading Data...</h2>
        <p className="text-[var(--text-secondary)] mt-2">Connecting to Supabase</p>
      </div>
    );
  }

  return (
    <TradingInstanceProvider>
    <div className="min-h-screen bg-[var(--bg-primary)] flex">
      {/* Sidebar */}
      <Sidebar onOpenAdvisor={() => setIsAdvisorOpen(true)} />

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto">
        {/* Mobile Header & Nav */}
        <MobileNav
          onOpenAdvisor={() => setIsAdvisorOpen(true)}
          onAddTransaction={() => openTransactionModal()}
        />

        {/* Top Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{viewInfo.title}</h1>
            <p className="text-[var(--text-secondary)]">{viewInfo.subtitle}</p>
          </div>
          <div className="flex gap-3">
            {showDatePicker && (
              <div className="flex items-center bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 shadow-sm">
                <Calendar size={16} className="text-[var(--text-muted)] mr-2" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="text-sm text-[var(--text-primary)] outline-none bg-transparent"
                />
              </div>
            )}

            <button
              onClick={() => setIsBulkTransactionModalOpen(true)}
              className="hidden sm:flex items-center gap-2 bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] px-4 py-2 rounded-lg shadow-sm transition-all"
            >
              <Layers size={20} />
              <span>Bulk Add</span>
            </button>

            <button
              onClick={() => openTransactionModal()}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-md transition-all active:scale-95"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">Add Transaction</span>
            </button>
          </div>
        </header>

        {/* Route Content */}
        <Outlet context={outletContext} />

        {/* Spacer for mobile bottom nav */}
        <div className="h-20 md:hidden" />
      </main>

      {/* Modals */}
      {isTransactionModalOpen && (
        <TransactionForm
          accounts={accounts}
          categories={categories}
          initialData={editingTransaction}
          onClose={() => {
            setIsTransactionModalOpen(false);
            setEditingTransaction(null);
          }}
          onSubmit={handleSaveTransaction}
        />
      )}

      {isBulkTransactionModalOpen && (
        <BulkTransactionForm
          accounts={accounts}
          categories={categories}
          onClose={() => setIsBulkTransactionModalOpen(false)}
          onSubmit={handleSaveBulkTransactions}
        />
      )}

      {isAccountModalOpen && (
        <AccountForm
          initialData={editingAccount}
          onClose={() => {
            setIsAccountModalOpen(false);
            setEditingAccount(null);
          }}
          onSubmit={handleSaveAccount}
        />
      )}

      <FinancialAdvisor
        isOpen={isAdvisorOpen}
        onClose={() => setIsAdvisorOpen(false)}
        accounts={accounts}
        transactions={transactions}
        categories={categories}
      />

      {/* Saving Indicator */}
      {isSaving && (
        <div className="fixed bottom-4 right-4 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom z-50">
          <Loader2 size={12} className="animate-spin" /> Saving to Supabase...
        </div>
      )}
    </div>
    </TradingInstanceProvider>
  );
};

export default App;
