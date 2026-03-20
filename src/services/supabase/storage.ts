import { supabase } from './client';
import {
  Account,
  Transaction,
  Category,
  MonthlyBudgetAllocation,
  AccountType,
  TransactionType,
} from '@/types';

interface SupabaseAccountRow {
  id: string;
  name: string;
  type: string;
  balance: number;
  color: string;
  goal: number | null;
  deadline: string | null;
}

interface SupabaseCategoryRow {
  id: string;
  name: string;
  default_monthly_budget: number;
}

interface SupabaseTransactionRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  account_id: string;
  to_account_id: string | null;
  category: string;
}

interface SupabaseMonthlyBudgetRow {
  id: string;
  category_id: string;
  month: string;
  amount: number;
}

// --- Default Data for Fresh Install ---
const DEFAULT_ACCOUNTS: Omit<Account, 'id'>[] = [
  { name: 'Main Checking', type: AccountType.CHECKING, balance: 2500, color: '#6366f1' },
  { name: 'Emergency Fund', type: AccountType.SAVINGS, balance: 10000, color: '#10b981' },
  { name: 'Stock Portfolio', type: AccountType.INVESTMENT, balance: 5400, color: '#8b5cf6' },
  { name: 'Credit Card', type: AccountType.CREDIT, balance: -450, color: '#ef4444' },
];

const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Housing', defaultMonthlyBudget: 2000 },
  { name: 'Food', defaultMonthlyBudget: 500 },
  { name: 'Transportation', defaultMonthlyBudget: 250 },
  { name: 'Utilities', defaultMonthlyBudget: 200 },
  { name: 'Entertainment', defaultMonthlyBudget: 100 },
  { name: 'Shopping', defaultMonthlyBudget: 167 },
  { name: 'Health', defaultMonthlyBudget: 83 },
  { name: 'Debt', defaultMonthlyBudget: 417 },
  { name: 'Income', defaultMonthlyBudget: 0 },
  { name: 'Transfer', defaultMonthlyBudget: 0 },
];

function mapAccountRow(row: SupabaseAccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type as AccountType,
    balance: Number(row.balance),
    color: row.color,
    goal: row.goal != null ? Number(row.goal) : null,
    deadline: row.deadline ?? null,
  };
}

function mapCategoryRow(row: SupabaseCategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    defaultMonthlyBudget: Number(row.default_monthly_budget),
  };
}

function mapTransactionRow(row: SupabaseTransactionRow): Transaction {
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    amount: Number(row.amount),
    type: row.type as TransactionType,
    accountId: row.account_id,
    toAccountId: row.to_account_id ?? undefined,
    category: row.category,
  };
}

function mapMonthlyBudgetRow(row: SupabaseMonthlyBudgetRow): MonthlyBudgetAllocation {
  return {
    id: row.id,
    categoryId: row.category_id,
    month: row.month,
    amount: Number(row.amount),
  };
}

async function getUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

// --- Public API ---

export const loadData = async (): Promise<{
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  monthlyBudgets: MonthlyBudgetAllocation[];
}> => {
  // Load Accounts
  const { data: accountsData, error: accountsError } = await supabase.from('accounts').select('*');

  if (accountsError) {
    console.error('Error loading accounts:', accountsError);
  }

  let accounts: Account[] = (accountsData ?? []).map(mapAccountRow);

  // Load Categories
  const { data: categoriesData, error: categoriesError } = await supabase
    .from('categories')
    .select('*');

  if (categoriesError) {
    console.error('Error loading categories:', categoriesError);
  }

  let categories: Category[] = (categoriesData ?? []).map(mapCategoryRow);

  // Load Transactions
  const { data: transactionsData, error: transactionsError } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false });

  if (transactionsError) {
    console.error('Error loading transactions:', transactionsError);
  }

  const transactions: Transaction[] = (transactionsData ?? []).map(mapTransactionRow);

  // Load Monthly Budgets
  const { data: monthlyBudgetsData, error: monthlyBudgetsError } = await supabase
    .from('monthly_budgets')
    .select('*');

  if (monthlyBudgetsError) {
    console.error('Error loading monthly budgets:', monthlyBudgetsError);
  }

  const monthlyBudgets: MonthlyBudgetAllocation[] = (monthlyBudgetsData ?? []).map(
    mapMonthlyBudgetRow,
  );

  // Seed default data if empty
  if (accounts.length === 0) {
    const uid = await getUserId();
    const { data: seededAccounts, error } = await supabase
      .from('accounts')
      .insert(DEFAULT_ACCOUNTS.map((a) => ({ ...a, user_id: uid })))
      .select();

    if (!error && seededAccounts) {
      accounts = seededAccounts.map(mapAccountRow);
    }
  }

  if (categories.length === 0) {
    const uid = await getUserId();
    const { data: seededCategories, error } = await supabase
      .from('categories')
      .insert(
        DEFAULT_CATEGORIES.map((c) => ({
          name: c.name,
          default_monthly_budget: c.defaultMonthlyBudget,
          user_id: uid,
        })),
      )
      .select();

    if (!error && seededCategories) {
      categories = seededCategories.map(mapCategoryRow);
    }
  }

  return { accounts, categories, transactions, monthlyBudgets };
};

export const saveData = async (
  accounts: Account[],
  transactions: Transaction[],
  categories: Category[],
  monthlyBudgets: MonthlyBudgetAllocation[] = [],
) => {
  const uid = await getUserId();

  // Upsert Accounts
  const accountsToUpsert = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    balance: a.balance,
    color: a.color,
    goal: a.goal ?? null,
    deadline: a.deadline ?? null,
    user_id: uid,
  }));

  const { error: accountsError } = await supabase
    .from('accounts')
    .upsert(accountsToUpsert, { onConflict: 'id' });

  if (accountsError) {
    console.error('Error saving accounts:', accountsError);
  }

  // Upsert Categories
  const categoriesToUpsert = categories.map((c) => ({
    id: c.id,
    name: c.name,
    default_monthly_budget: c.defaultMonthlyBudget,
    user_id: uid,
  }));

  const { error: categoriesError } = await supabase
    .from('categories')
    .upsert(categoriesToUpsert, { onConflict: 'id' });

  if (categoriesError) {
    console.error('Error saving categories:', categoriesError);
  }

  // Upsert Transactions
  const transactionsToUpsert = transactions.map((t) => ({
    id: t.id,
    date: t.date,
    description: t.description,
    amount: t.amount,
    type: t.type,
    account_id: t.accountId,
    to_account_id: t.toAccountId ?? null,
    category: t.category,
    user_id: uid,
  }));

  const { error: transactionsError } = await supabase
    .from('transactions')
    .upsert(transactionsToUpsert, { onConflict: 'id' });

  if (transactionsError) {
    console.error('Error saving transactions:', transactionsError);
  }

  // Upsert Monthly Budgets
  if (monthlyBudgets.length > 0) {
    const monthlyBudgetsToUpsert = monthlyBudgets.map((mb) => ({
      id: mb.id,
      category_id: mb.categoryId,
      month: mb.month,
      amount: mb.amount,
      user_id: uid,
    }));

    const { error: monthlyBudgetsError } = await supabase
      .from('monthly_budgets')
      .upsert(monthlyBudgetsToUpsert, { onConflict: 'id' });

    if (monthlyBudgetsError) {
      console.error('Error saving monthly budgets:', monthlyBudgetsError);
    }
  }
};

// Delete operations for cleanup
export const deleteAccount = async (id: string) => {
  const { error } = await supabase.from('accounts').delete().eq('id', id);
  if (error) console.error('Error deleting account:', error);
};

export const deleteCategory = async (id: string) => {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) console.error('Error deleting category:', error);
};

export const deleteTransaction = async (id: string) => {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) console.error('Error deleting transaction:', error);
};

export const deleteMonthlyBudget = async (id: string) => {
  const { error } = await supabase.from('monthly_budgets').delete().eq('id', id);
  if (error) console.error('Error deleting monthly budget:', error);
};
