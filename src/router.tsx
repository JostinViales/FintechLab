import { createBrowserRouter } from 'react-router-dom';
import App from '@/App';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { TransactionsPage } from '@/features/transactions/TransactionsPage';
import { BudgetPage } from '@/features/budget/BudgetPage';
import { MonthlyOverviewPage } from '@/features/budget/MonthlyOverviewPage';
import { TradingPage } from '@/features/trading/TradingPage';
import { PortfolioPage } from '@/features/portfolio/PortfolioPage';
import { GoalsPage } from '@/features/goals/GoalsPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'transactions', element: <TransactionsPage /> },
      { path: 'budget', element: <BudgetPage /> },
      { path: 'monthly', element: <MonthlyOverviewPage /> },
      { path: 'trading', element: <TradingPage /> },
      { path: 'portfolio', element: <PortfolioPage /> },
      { path: 'goals', element: <GoalsPage /> },
    ],
  },
]);
