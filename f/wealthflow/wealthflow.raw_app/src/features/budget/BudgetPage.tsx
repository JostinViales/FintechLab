import React from 'react';
import { useOutletContext } from 'react-router-dom';
import type { AppContext } from '../../App';
import { MonthlyBudget } from '../../components/budget/MonthlyBudget';

export const BudgetPage: React.FC = () => {
  const {
    categories,
    transactions,
    monthlyBudgets,
    selectedMonth,
    setSelectedMonth,
    handleAddCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    handleUpdateMonthlyBudget,
  } = useOutletContext<AppContext>();

  return (
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
  );
};
