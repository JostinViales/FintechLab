import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Wallet,
  ArrowRightLeft,
  Sparkles,
  PieChart,
  BarChart3,
  Plus,
} from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useTradingInstance } from '../../hooks/useTradingInstance';

interface MobileNavProps {
  onOpenAdvisor: () => void;
  onAddTransaction: () => void;
}

const mobileNavClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-col items-center justify-center w-16 h-full transition-colors ${
    isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'
  }`;

export const MobileNav: React.FC<MobileNavProps> = ({ onOpenAdvisor, onAddTransaction }) => {
  const { instance, setInstance, isDemo } = useTradingInstance();

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden flex justify-between items-center mb-6">
        <div className="flex items-center gap-2 text-[var(--text-primary)] font-bold text-lg">
          <Wallet className="text-[var(--accent-primary)]" /> WealthFlow
        </div>
        <div className="flex items-center gap-2">
          {/* Instance Chip */}
          <button
            onClick={() => setInstance(isDemo ? 'live' : 'demo')}
            className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full transition-colors ${
              isDemo
                ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                : 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
            }`}
          >
            {instance}
          </button>
          <ThemeToggle />
          <button
            onClick={onOpenAdvisor}
            className="p-2 text-[var(--accent-success)] bg-[var(--accent-success-light)] rounded-full"
          >
            <Sparkles size={24} />
          </button>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--bg-secondary)] border-t border-[var(--border-default)] px-2 pb-safe z-40">
        <div className="flex justify-around items-center h-16">
          <NavLink to="/" end className={mobileNavClass}>
            <LayoutDashboard size={22} />
            <span className="text-[10px] mt-1 font-medium">Dashboard</span>
          </NavLink>

          <NavLink to="/monthly" className={mobileNavClass}>
            <BarChart3 size={22} />
            <span className="text-[10px] mt-1 font-medium">Monthly</span>
          </NavLink>

          {/* Center FAB for Add Transaction */}
          <div className="relative -mt-6">
            <button
              onClick={onAddTransaction}
              className="flex items-center justify-center w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg active:scale-95 transition-transform"
            >
              <Plus size={28} />
            </button>
          </div>

          <NavLink to="/transactions" className={mobileNavClass}>
            <ArrowRightLeft size={22} />
            <span className="text-[10px] mt-1 font-medium">Transactions</span>
          </NavLink>

          <NavLink to="/budget" className={mobileNavClass}>
            <PieChart size={22} />
            <span className="text-[10px] mt-1 font-medium">Budget</span>
          </NavLink>
        </div>
      </nav>
    </>
  );
};
