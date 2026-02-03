import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Wallet,
  ArrowRightLeft,
  Plus,
  Sparkles,
  Calendar,
  PieChart,
  Layers,
  BarChart3,
  Loader2
} from 'lucide-react';
import {
  Account,
  Transaction,
  Category,
  MonthlyBudgetAllocation,
  TransactionType,
  AccountType,
} from './types';
import { loadData, saveData, deleteAccount, deleteCategory, deleteTransaction } from './services/supabaseStorageService';
import { AccountList } from './components/Accounts/AccountList';
import { AccountForm } from './components/Accounts/AccountForm';
import { BalanceChart } from './components/Charts/BalanceChart';
import { TransactionForm } from './components/Transactions/TransactionForm';
import { TransactionList } from './components/Transactions/TransactionList';
import { BulkTransactionForm } from './components/Transactions/BulkTransactionForm';
import { MonthlyBudget } from './components/Budget/MonthlyBudget';
import { MonthlyOverview } from './components/Budget/MonthlyOverview';
import { FinancialAdvisor } from './components/AI/FinancialAdvisor';
import { Card } from './components/ui/Card';

type View = 'dashboard' | 'transactions' | 'budget' | 'monthly';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
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

  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await loadData();
        setAccounts(data.accounts);
        setTransactions(data.transactions);
        setCategories(data.categories);
        setMonthlyBudgets(data.monthlyBudgets);
      } catch (error) {
        console.error("Failed to load SQLite DB", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Save data on change
  useEffect(() => {
    if (!loading && accounts.length > 0) {
      const persist = async () => {
        setIsSaving(true);
        await saveData(accounts, transactions, categories, monthlyBudgets);
        setIsSaving(false);
      };

      // Debounce slightly to avoid hammering DB
      const timeout = setTimeout(persist, 500);
      return () => clearTimeout(timeout);
    }
  }, [accounts, transactions, categories, monthlyBudgets, loading]);

  // --- Account Logic ---

  const handleSaveAccount = (data: Omit<Account, 'id'>) => {
    if (editingAccount) {
      // Edit Mode
      setAccounts(prev => prev.map(acc =>
        acc.id === editingAccount.id ? { ...data, id: editingAccount.id } : acc
      ));
    } else {
      // Create Mode
      const newAccount: Account = { ...data, id: crypto.randomUUID() };
      setAccounts(prev => [...prev, newAccount]);
    }
    setEditingAccount(null);
  };

  const handleDeleteAccount = (id: string) => {
    if (confirm("Are you sure? This will not delete transactions associated with this account.")) {
      setAccounts(prev => prev.filter(a => a.id !== id));
      deleteAccount(id); // Delete from Supabase
    }
  };

  const openAccountModal = (account?: Account) => {
    setEditingAccount(account || null);
    setIsAccountModalOpen(true);
  };

  // --- Transaction Logic ---

  const handleSaveTransaction = (data: Omit<Transaction, 'id'>) => {
    let updatedTransactions = [...transactions];
    let prevTransaction: Transaction | undefined;

    if (editingTransaction) {
      prevTransaction = transactions.find(t => t.id === editingTransaction.id);
      updatedTransactions = transactions.map(t =>
        t.id === editingTransaction.id ? { ...data, id: editingTransaction.id } : t
      );
    } else {
      updatedTransactions = [{ ...data, id: crypto.randomUUID() }, ...transactions];
    }

    setTransactions(updatedTransactions);

    // Recalculate Balances

    // 1. Revert previous transaction effect if editing
    let tempAccounts = [...accounts];

    if (prevTransaction) {
      tempAccounts = applyTransactionToBalances(tempAccounts, prevTransaction, true); // true = revert
    }

    // 2. Apply new transaction effect
    const newTx = editingTransaction ? { ...data, id: editingTransaction.id } : { ...data, id: 'temp' }; // id doesn't matter for calc
    tempAccounts = applyTransactionToBalances(tempAccounts, newTx as Transaction, false);

    setAccounts(tempAccounts);
    setEditingTransaction(null);
  };

  const handleSaveBulkTransactions = (newTransactions: Omit<Transaction, 'id'>[]) => {
    let currentAccounts = [...accounts];
    const createdTransactions: Transaction[] = [];

    newTransactions.forEach(data => {
      const tx: Transaction = { ...data, id: crypto.randomUUID() };
      createdTransactions.push(tx);
      currentAccounts = applyTransactionToBalances(currentAccounts, tx, false); // false for 'not revert'
    });

    // Add new transactions to the top of the list
    setTransactions(prev => [...createdTransactions, ...prev]);
    setAccounts(currentAccounts);
    setIsBulkTransactionModalOpen(false);
  };

  const handleDeleteTransaction = (id: string) => {
    if (confirm("Delete this transaction?")) {
      const txToDelete = transactions.find(t => t.id === id);
      if (txToDelete) {
        setTransactions(prev => prev.filter(t => t.id !== id));
        setAccounts(prev => applyTransactionToBalances(prev, txToDelete, true)); // revert balance
        deleteTransaction(id); // Delete from Supabase
      }
    }
  };

  const applyTransactionToBalances = (currentAccounts: Account[], tx: Transaction, revert: boolean): Account[] => {
    const multiplier = revert ? -1 : 1;

    // Check if this is a "Debt Payment" masquerading as an Expense
    const isDebtPayment = tx.type === TransactionType.EXPENSE && tx.category === 'Debt';

    // If it is a debt payment, we need to find a target debt account to reduce
    // We prioritize accounts explicitly typed as DEBT, LOAN, or CREDIT
    const targetDebtAccount = isDebtPayment
      ? currentAccounts.find(a =>
        [AccountType.DEBT, AccountType.LOAN, AccountType.CREDIT].includes(a.type) && a.id !== tx.accountId
      )
      : null;

    return currentAccounts.map(acc => {
      let newBalance = acc.balance;

      // 1. Handle Source/Destination Impact
      if (acc.id === tx.accountId) {
        if (tx.type === TransactionType.EXPENSE || tx.type === TransactionType.TRANSFER) {
          newBalance -= (tx.amount * multiplier);
        } else if (tx.type === TransactionType.INCOME) {
          newBalance += (tx.amount * multiplier);
        }
      }

      // 2. Handle Transfer Destination
      if (tx.type === TransactionType.TRANSFER && acc.id === tx.toAccountId) {
        newBalance += (tx.amount * multiplier);
      }

      // 3. Handle "Expense as Debt Payment" Special Logic
      // If we found a valid debt account, and this IS that account, apply the credit
      if (isDebtPayment && targetDebtAccount && acc.id === targetDebtAccount.id) {
        // Paying off debt increases the balance (e.g. -500 + 100 = -400)
        // We add the amount because it's a payment TOWARDS the account
        newBalance += (tx.amount * multiplier);
      }

      return { ...acc, balance: newBalance };
    });
  };

  const openTransactionModal = (tx?: Transaction) => {
    setEditingTransaction(tx || null);
    setIsTransactionModalOpen(true);
  };

  // --- Category Logic ---

  const handleAddCategory = (name: string) => {
    const newCat: Category = { id: crypto.randomUUID(), name, defaultMonthlyBudget: 0 };
    setCategories(prev => [...prev, newCat]);
  };

  const handleUpdateCategory = (updatedCat: Category) => {
    setCategories(prev => prev.map(c => c.id === updatedCat.id ? updatedCat : c));
  };

  const handleDeleteCategory = (id: string) => {
    const category = categories.find(c => c.id === id);
    if (!category) return;

    const hasTransactions = transactions.some(t => t.category === category.name);
    if (hasTransactions) {
      if (!confirm(`The category "${category.name}" is used in existing transactions. Deleting it will keep the transactions but remove the category from the budget list. Continue?`)) {
        return;
      }
    } else {
      if (!confirm(`Are you sure you want to delete the category "${category.name}"?`)) {
        return;
      }
    }

    setCategories(prev => prev.filter(c => c.id !== id));
    // Also remove any monthly budget allocations for this category
    setMonthlyBudgets(prev => prev.filter(mb => mb.categoryId !== id));
    deleteCategory(id); // Delete from Supabase (monthly_budgets cascade deleted)
  };

  const handleUpdateMonthlyBudget = (categoryId: string, month: string, amount: number) => {
    setMonthlyBudgets(prev => {
      const existing = prev.find(mb => mb.categoryId === categoryId && mb.month === month);
      if (existing) {
        return prev.map(mb =>
          mb.categoryId === categoryId && mb.month === month
            ? { ...mb, amount }
            : mb
        );
      } else {
        return [...prev, { id: crypto.randomUUID(), categoryId, month, amount }];
      }
    });
  };

  // --- Derived State ---

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  const monthStats = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      if (t.type === TransactionType.INCOME) acc.income += t.amount;
      if (t.type === TransactionType.EXPENSE) acc.expense += t.amount;
      if (t.type === TransactionType.TRANSFER) acc.savings += t.amount;
      return acc;
    }, { income: 0, expense: 0, savings: 0 });
  }, [filteredTransactions]);

  const netWorth = accounts.reduce((acc, curr) => acc + curr.balance, 0);

  // --- Views ---

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 size={48} className="text-indigo-600 animate-spin mb-4" />
        <h2 className="text-xl font-semibold text-slate-800">Loading Data...</h2>
        <p className="text-slate-500 mt-2">Connecting to Supabase</p>
      </div>
    );
  }

  const renderDashboard = () => (
    <div className="animate-in fade-in duration-300">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="border-l-4 border-l-indigo-500">
          <p className="text-sm font-medium text-slate-500 mb-1">Net Worth</p>
          <h3 className="text-2xl font-bold text-slate-900">${netWorth.toLocaleString()}</h3>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <p className="text-sm font-medium text-slate-500 mb-1">Monthly Income</p>
          <h3 className="text-2xl font-bold text-emerald-600">+${monthStats.income.toLocaleString()}</h3>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <p className="text-sm font-medium text-slate-500 mb-1">Monthly Expenses</p>
          <h3 className="text-2xl font-bold text-red-600">-${monthStats.expense.toLocaleString()}</h3>
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
                <p className="text-center text-slate-400 py-8">No transactions for this month.</p>
              ) : (
                filteredTransactions.slice(0, 10).map(tx => {
                  const accountName = accounts.find(a => a.id === tx.accountId)?.name || 'Unknown';
                  return (
                    <div key={tx.id} className="flex justify-between items-center p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 cursor-pointer" onClick={() => openTransactionModal(tx)}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${tx.type === TransactionType.INCOME ? 'bg-emerald-100 text-emerald-600' :
                          tx.type === TransactionType.EXPENSE ? 'bg-red-100 text-red-600' :
                            'bg-blue-100 text-blue-600'
                          }`}>
                          {tx.type === TransactionType.INCOME ? <Plus size={16} /> :
                            tx.type === TransactionType.EXPENSE ? <ArrowRightLeft size={16} className="rotate-45" /> :
                              <ArrowRightLeft size={16} />}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{tx.description}</p>
                          <p className="text-xs text-slate-500">{tx.date} • {accountName}</p>
                        </div>
                      </div>
                      <span className={`font-semibold ${tx.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-slate-900'
                        }`}>
                        {tx.type === TransactionType.EXPENSE ? '-' : '+'}${tx.amount.toLocaleString()}
                      </span>
                    </div>
                  );
                })
              )}
              {filteredTransactions.length > 10 && (
                <button onClick={() => setCurrentView('transactions')} className="w-full text-center text-indigo-600 text-sm font-medium pt-2">
                  View All Transactions
                </button>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 hidden md:flex flex-col fixed h-full z-10">
        <div className="p-6">
          <div className="flex items-center gap-3 text-white mb-8">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Wallet size={24} />
            </div>
            <span className="text-xl font-bold">WealthFlow</span>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'dashboard' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50'}`}
            >
              <LayoutDashboard size={20} />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setCurrentView('monthly')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'monthly' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50'}`}
            >
              <BarChart3 size={20} />
              <span>Monthly Overview</span>
            </button>
            <button
              onClick={() => setCurrentView('transactions')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'transactions' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50'}`}
            >
              <ArrowRightLeft size={20} />
              <span>Transactions</span>
            </button>
            <button
              onClick={() => setCurrentView('budget')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'budget' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50'}`}
            >
              <PieChart size={20} />
              <span>Monthly Budget</span>
            </button>
            <button onClick={() => setIsAdvisorOpen(true)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800 rounded-lg transition-colors text-emerald-400 mt-4">
              <Sparkles size={20} />
              <span>AI Advisor</span>
            </button>
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-slate-800">
          <p className="text-xs text-slate-500">© 2024 WealthFlow</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto">
        {/* Mobile Header */}
        <div className="md:hidden flex justify-between items-center mb-6">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
            <Wallet className="text-indigo-600" /> WealthFlow
          </div>
          <button onClick={() => setIsAdvisorOpen(true)} className="p-2 text-emerald-600 bg-emerald-50 rounded-full">
            <Sparkles size={24} />
          </button>
        </div>

        {/* Top Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {currentView === 'dashboard' && 'Financial Overview'}
              {currentView === 'monthly' && 'Monthly Overview'}
              {currentView === 'transactions' && 'Transactions'}
              {currentView === 'budget' && 'Monthly Budget'}
            </h1>
            <p className="text-slate-500">
              {currentView === 'dashboard' && 'Track your wealth, monthly budget, and savings.'}
              {currentView === 'monthly' && 'Analyze spending trends and category breakdown.'}
              {currentView === 'transactions' && 'Manage all your income and expenses.'}
              {currentView === 'budget' && 'Set your spending limits by category for each month.'}
            </p>
          </div>
          <div className="flex gap-3">
            {/* Show Date Picker for Dashboard AND Monthly Overview */}
            {(currentView === 'dashboard' || currentView === 'monthly') && (
              <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
                <Calendar size={16} className="text-slate-400 mr-2" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="text-sm text-slate-700 outline-none bg-transparent"
                />
              </div>
            )}

            <button
              onClick={() => setIsBulkTransactionModalOpen(true)}
              className="hidden sm:flex items-center gap-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg shadow-sm transition-all"
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

        {currentView === 'dashboard' && renderDashboard()}

        {currentView === 'monthly' && (
          <MonthlyOverview
            categories={categories}
            transactions={transactions}
            monthlyBudgets={monthlyBudgets}
            selectedMonth={selectedMonth}
          />
        )}

        {currentView === 'transactions' && (
          <TransactionList
            transactions={transactions}
            accounts={accounts}
            onEdit={openTransactionModal}
            onDelete={handleDeleteTransaction}
          />
        )}

        {currentView === 'budget' && (
          <MonthlyBudget
            categories={categories}
            transactions={transactions}
            monthlyBudgets={monthlyBudgets}
            selectedMonth={selectedMonth}
            onAddCategory={handleAddCategory}
            onUpdateCategory={handleUpdateCategory}
            onDeleteCategory={handleDeleteCategory}
            onUpdateMonthlyBudget={handleUpdateMonthlyBudget}
            onMonthChange={setSelectedMonth}
          />
        )}
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
        <div className="fixed bottom-4 right-4 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom">
          <Loader2 size={12} className="animate-spin" /> Saving to Supabase...
        </div>
      )}
    </div>
  );
};

export default App;