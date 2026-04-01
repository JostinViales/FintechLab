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

export interface MonthlyBudget {
  month: string; // "YYYY-MM"
  limit: number;
  spent: number;
}

export interface FinancialState {
  accounts: import('./accounts').Account[];
  transactions: import('./transactions').Transaction[];
  categories: Category[];
}

export type ChartDataPoint = {
  name: string;
  value: number;
  fill?: string;
};
