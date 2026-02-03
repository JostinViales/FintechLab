import { Account, Transaction, AccountType, TransactionType, Category, MonthlyBudgetAllocation } from '../types';

// Declare global sql.js init function (loaded via script tag in index.html)
declare global {
  interface Window {
    initSqlJs: (config: { locateFile: (file: string) => string }) => Promise<any>;
  }
}

const STORAGE_KEY = 'wealthflow_sqlite_db';
let db: any = null;

// --- Default Data for Fresh Install ---
const DEFAULT_ACCOUNTS: Account[] = [
  { id: '1', name: 'Main Checking', type: AccountType.CHECKING, balance: 2500, color: '#6366f1' },
  { id: '2', name: 'Emergency Fund', type: AccountType.SAVINGS, balance: 10000, color: '#10b981' },
  { id: '3', name: 'Stock Portfolio', type: AccountType.INVESTMENT, balance: 5400, color: '#8b5cf6' },
  { id: '4', name: 'Credit Card', type: AccountType.CREDIT, balance: -450, color: '#ef4444' },
];

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'c1', name: 'Housing', defaultMonthlyBudget: 2000 },
  { id: 'c2', name: 'Food', defaultMonthlyBudget: 500 },
  { id: 'c3', name: 'Transportation', defaultMonthlyBudget: 250 },
  { id: 'c4', name: 'Utilities', defaultMonthlyBudget: 200 },
  { id: 'c5', name: 'Entertainment', defaultMonthlyBudget: 100 },
  { id: 'c6', name: 'Shopping', defaultMonthlyBudget: 167 },
  { id: 'c7', name: 'Health', defaultMonthlyBudget: 83 },
  { id: 'c8', name: 'Debt', defaultMonthlyBudget: 417 },
  { id: 'c9', name: 'Income', defaultMonthlyBudget: 0 },
  { id: 'c10', name: 'Transfer', defaultMonthlyBudget: 0 },
];

const DEFAULT_TRANSACTIONS: Transaction[] = [
  {
    id: 't1',
    date: new Date().toISOString().split('T')[0],
    description: 'Initial Balance',
    amount: 0,
    type: TransactionType.INCOME,
    accountId: '1',
    category: 'Income'
  }
];

// --- Binary String Conversion Helpers (Safe for LocalStorage) ---
const toBinString = (arr: Uint8Array) => {
  return Array.from(arr, (byte) => String.fromCharCode(byte)).join('');
}

const toBinArray = (str: string) => {
  const l = str.length;
  const arr = new Uint8Array(l);
  for (let i = 0; i < l; i++) arr[i] = str.charCodeAt(i);
  return arr;
}

// --- Database Initialization ---
export const initDB = async () => {
  if (db) return db;

  if (!window.initSqlJs) {
    throw new Error("sql.js not loaded");
  }

  const SQL = await window.initSqlJs({
    locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
  });

  // Check for existing DB in LocalStorage
  const savedDbStr = localStorage.getItem(STORAGE_KEY);

  if (savedDbStr) {
    try {
      const u8 = toBinArray(savedDbStr);
      db = new SQL.Database(u8);
    } catch (e) {
      console.error("Failed to load DB from LS, creating new.", e);
      db = new SQL.Database();
      createTables(db);
      seedData(db);
    }
  } else {
    // New DB
    db = new SQL.Database();
    createTables(db);
    seedData(db);
  }

  return db;
};

const createTables = (database: any) => {
  database.run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, 
      name TEXT, 
      type TEXT, 
      balance REAL, 
      color TEXT
    );
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY, 
      name TEXT, 
      defaultMonthlyBudget REAL
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY, 
      date TEXT, 
      description TEXT, 
      amount REAL, 
      type TEXT, 
      accountId TEXT, 
      toAccountId TEXT, 
      category TEXT
    );
    CREATE TABLE IF NOT EXISTS monthly_budgets (
      id TEXT PRIMARY KEY,
      categoryId TEXT,
      month TEXT,
      amount REAL
    );
  `);
};

const seedData = (database: any) => {
  // Only seed if empty
  const res = database.exec("SELECT count(*) as c FROM accounts");
  if (res[0].values[0][0] > 0) return;

  // Insert Defaults
  const stmtAcc = database.prepare("INSERT INTO accounts VALUES (?,?,?,?,?)");
  DEFAULT_ACCOUNTS.forEach(a => stmtAcc.run([a.id, a.name, a.type, a.balance, a.color]));
  stmtAcc.free();

  const stmtCat = database.prepare("INSERT INTO categories VALUES (?,?,?)");
  DEFAULT_CATEGORIES.forEach(c => stmtCat.run([c.id, c.name, c.defaultMonthlyBudget]));
  stmtCat.free();

  const stmtTx = database.prepare("INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?)");
  DEFAULT_TRANSACTIONS.forEach(t => stmtTx.run([t.id, t.date, t.description, t.amount, t.type, t.accountId, t.toAccountId || null, t.category]));
  stmtTx.free();
};

// --- Public API ---

export const loadData = async (): Promise<{ accounts: Account[], transactions: Transaction[], categories: Category[], monthlyBudgets: MonthlyBudgetAllocation[] }> => {
  const database = await initDB();

  // Load Accounts
  const accounts: Account[] = [];
  const accRes = database.exec("SELECT * FROM accounts");
  if (accRes.length > 0) {
    accRes[0].values.forEach((row: any) => {
      accounts.push({
        id: row[0],
        name: row[1],
        type: row[2] as AccountType,
        balance: row[3],
        color: row[4]
      });
    });
  }

  // Load Categories
  const categories: Category[] = [];
  const catRes = database.exec("SELECT * FROM categories");
  if (catRes.length > 0) {
    catRes[0].values.forEach((row: any) => {
      categories.push({
        id: row[0],
        name: row[1],
        defaultMonthlyBudget: row[2]
      });
    });
  }

  // Load Transactions
  const transactions: Transaction[] = [];
  const txRes = database.exec("SELECT * FROM transactions");
  if (txRes.length > 0) {
    txRes[0].values.forEach((row: any) => {
      transactions.push({
        id: row[0],
        date: row[1],
        description: row[2],
        amount: row[3],
        type: row[4] as TransactionType,
        accountId: row[5],
        toAccountId: row[6],
        category: row[7]
      });
    });
  }
  // Load Monthly Budgets
  const monthlyBudgets: MonthlyBudgetAllocation[] = [];
  const mbRes = database.exec("SELECT * FROM monthly_budgets");
  if (mbRes.length > 0) {
    mbRes[0].values.forEach((row: any) => {
      monthlyBudgets.push({
        id: row[0],
        categoryId: row[1],
        month: row[2],
        amount: row[3]
      });
    });
  }

  return { accounts, categories, transactions, monthlyBudgets };
};

export const saveData = async (
  accounts: Account[],
  transactions: Transaction[],
  categories: Category[],
  monthlyBudgets: MonthlyBudgetAllocation[] = []
) => {
  const database = await initDB();

  // Use a transaction for atomic updates
  database.run("BEGIN TRANSACTION");

  // Clear tables
  database.run("DELETE FROM accounts");
  database.run("DELETE FROM categories");
  database.run("DELETE FROM transactions");
  database.run("DELETE FROM monthly_budgets");

  // Batch Insert Accounts
  const stmtAcc = database.prepare("INSERT INTO accounts VALUES (?,?,?,?,?)");
  accounts.forEach(a => stmtAcc.run([a.id, a.name, a.type, a.balance, a.color]));
  stmtAcc.free();

  // Batch Insert Categories
  const stmtCat = database.prepare("INSERT INTO categories VALUES (?,?,?)");
  categories.forEach(c => stmtCat.run([c.id, c.name, c.defaultMonthlyBudget]));
  stmtCat.free();

  const stmtTx = database.prepare("INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?)");
  transactions.forEach(t => stmtTx.run([t.id, t.date, t.description, t.amount, t.type, t.accountId, t.toAccountId || null, t.category]));
  stmtTx.free();

  // Batch Insert Monthly Budgets
  const stmtMb = database.prepare("INSERT INTO monthly_budgets VALUES (?,?,?,?)");
  monthlyBudgets.forEach(mb => stmtMb.run([mb.id, mb.categoryId, mb.month, mb.amount]));
  stmtMb.free();

  database.run("COMMIT");

  // Export to Binary and Save to LocalStorage
  const binaryArray = database.export();
  const binaryString = toBinString(binaryArray);

  try {
    localStorage.setItem(STORAGE_KEY, binaryString);
  } catch (e) {
    console.error("Storage Quota Exceeded. DB is too large for LocalStorage.", e);
    alert("Warning: Database size limit reached. Changes may not be saved.");
  }
};