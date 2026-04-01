import React from 'react';
import { useOutletContext } from 'react-router-dom';
import type { AppContext } from '../../App';
import { MonthlyOverview } from '../../components/budget/MonthlyOverview';

export const MonthlyOverviewPage: React.FC = () => {
  const { categories, transactions, monthlyBudgets, selectedMonth } =
    useOutletContext<AppContext>();

  return (
    <MonthlyOverview
      categories={categories}
      transactions={transactions}
      monthlyBudgets={monthlyBudgets}
      selectedMonth={selectedMonth}
    />
  );
};
