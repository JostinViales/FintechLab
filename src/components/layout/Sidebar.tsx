import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Wallet,
  ArrowRightLeft,
  Sparkles,
  PieChart,
  BarChart3,
  TrendingUp,
  CandlestickChart,
  LogOut,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

interface SidebarProps {
  onOpenAdvisor: () => void;
  onSignOut: () => void;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
    isActive ? 'bg-[var(--bg-tertiary)] text-white' : 'hover:bg-[var(--bg-tertiary)]/50'
  }`;

export const Sidebar: React.FC<SidebarProps> = ({ onOpenAdvisor, onSignOut }) => {
  return (
    <aside className="w-64 bg-[var(--bg-elevated)] text-[var(--text-secondary)] hidden md:flex flex-col fixed h-full z-10 border-r border-[var(--border-default)]">
      <div className="p-6">
        <div className="flex items-center gap-3 text-[var(--text-primary)] mb-8">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Wallet size={24} />
          </div>
          <span className="text-xl font-bold">WealthFlow</span>
        </div>

        <nav className="space-y-2">
          <NavLink to="/" end className={navLinkClass}>
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/monthly" className={navLinkClass}>
            <BarChart3 size={20} />
            <span>Monthly Overview</span>
          </NavLink>
          <NavLink to="/transactions" className={navLinkClass}>
            <ArrowRightLeft size={20} />
            <span>Transactions</span>
          </NavLink>
          <NavLink to="/budget" className={navLinkClass}>
            <PieChart size={20} />
            <span>Monthly Budget</span>
          </NavLink>

          <div className="pt-4 pb-2">
            <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] px-4 mb-2">Coming Soon</p>
          </div>
          <NavLink to="/trading" className={navLinkClass}>
            <CandlestickChart size={20} />
            <span>Trading</span>
          </NavLink>
          <NavLink to="/portfolio" className={navLinkClass}>
            <TrendingUp size={20} />
            <span>Portfolio</span>
          </NavLink>
          <button
            onClick={onOpenAdvisor}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors text-[var(--accent-success)] mt-4"
          >
            <Sparkles size={20} />
            <span>AI Advisor</span>
          </button>
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-[var(--border-default)] space-y-3">
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--accent-danger)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--text-muted)]">&copy; 2024 WealthFlow</p>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
};
