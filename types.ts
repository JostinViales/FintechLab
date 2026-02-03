export enum AccountType {
  CHECKING = 'Checking',
  SAVINGS = 'Savings',
  INVESTMENT = 'Investment',
  CASH = 'Cash',
  CREDIT = 'Credit Card',
  DEBT = 'Debt',
  LOAN = 'Loan'
}

export enum TransactionType {
  INCOME = 'Income',
  EXPENSE = 'Expense',
  TRANSFER = 'Transfer'
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  color: string;
}

export interface Category {
  id: string;
  name: string;
  defaultMonthlyBudget: number;
}

export interface MonthlyBudgetAllocation {
  id: string;
  categoryId: string;
  month: string; // "YYYY-MM" format
  amount: number;
}

export interface Transaction {
  id: string;
  date: string; // ISO date string
  description: string;
  amount: number;
  type: TransactionType;
  accountId: string; // The account the money is coming from (Expense/Transfer) or going to (Income)
  toAccountId?: string; // For transfers, the destination account
  category: string;
}

export interface MonthlyBudget {
  month: string; // "YYYY-MM"
  limit: number;
  spent: number;
}

export interface FinancialState {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
}

export type ChartDataPoint = {
  name: string;
  value: number;
  fill?: string;
};