export enum AccountType {
  CHECKING = 'Checking',
  SAVINGS = 'Savings',
  INVESTMENT = 'Investment',
  CASH = 'Cash',
  CREDIT = 'Credit Card',
  DEBT = 'Debt',
  LOAN = 'Loan',
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  color: string;
  goal?: number | null;
  deadline?: string | null;
}
