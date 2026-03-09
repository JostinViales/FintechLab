import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2, Wallet, Table2, PieChart, Clock, LineChart, ShieldAlert, AlertCircle } from 'lucide-react';
import type { Trade, AssetBalance } from '@/types';
import type { OkxTicker } from '@/types/okx';
import { loadTrades, loadAssetBalances } from '@/services/supabase/trading';
import { syncTradesFromOkx, syncBalancesFromOkx } from '@/services/okx/client';
import { okxWebSocket } from '@/services/okx/websocket';
import { useTradingInstance } from '@/hooks/useTradingInstance';
import {
  computePortfolioSummary,
  computePortfolioHoldings,
  computeDiversificationAnalysis,
  computeAssetHoldingDurations,
  computePortfolioValueTimeline,
  computePortfolioRiskMetrics,
} from '@/lib/portfolioAnalytics';
import { Card } from '@/components/ui/Card';
import { PortfolioSummaryCards } from '@/components/portfolio/PortfolioSummaryCards';
import { PortfolioHoldingsTable } from '@/components/portfolio/PortfolioHoldingsTable';
import { DiversificationPanel } from '@/components/portfolio/DiversificationPanel';
import { HoldingDurationTimeline } from '@/components/portfolio/HoldingDurationTimeline';
import { PortfolioValueChart } from '@/components/portfolio/PortfolioValueChart';
import { PortfolioRiskCards } from '@/components/portfolio/PortfolioRiskCards';

const SECTIONS = [
  { id: 'summary', label: 'Summary', icon: Wallet },
  { id: 'holdings', label: 'Holdings', icon: Table2 },
  { id: 'diversification', label: 'Diversification', icon: PieChart },
  { id: 'duration', label: 'Duration', icon: Clock },
  { id: 'value', label: 'Value', icon: LineChart },
  { id: 'risk', label: 'Risk', icon: ShieldAlert },
] as const;

export const PortfolioPage: React.FC = () => {
  const { instance } = useTradingInstance();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [assetBalances, setAssetBalances] = useState<AssetBalance[]>([]);
  const [livePrices, setLivePrices] = useState<Map<string, OkxTicker>>(new Map());
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('summary');
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // --- Data Loading (re-runs on instance change) ---
  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      setLoading(true);
      setSyncError(null);

      // Auto-sync from OKX
      try {
        await Promise.all([
          syncTradesFromOkx(instance).catch(() => {}),
          syncBalancesFromOkx(instance).catch(() => {}),
        ]);
      } catch {
        // Sync failures are non-blocking
      }

      const [tradesData, balancesData] = await Promise.all([
        loadTrades(undefined, instance),
        loadAssetBalances(instance),
      ]);

      if (cancelled) return;

      setTrades(tradesData);
      setAssetBalances(balancesData);
      setLoading(false);
    };
    fetchAll();

    return () => {
      cancelled = true;
    };
  }, [instance]);

  // --- WebSocket for Live Prices ---
  useEffect(() => {
    const symbols = new Set<string>();
    assetBalances.forEach((a) => {
      if (a.asset !== 'USDT') symbols.add(a.asset + '-USDT');
    });

    if (symbols.size === 0) return;

    okxWebSocket.connect();

    symbols.forEach((symbol) => {
      okxWebSocket.subscribeTicker(symbol, (ticker) => {
        setLivePrices((prev) => {
          const next = new Map(prev);
          next.set(ticker.instId, ticker);
          return next;
        });
      });
    });

    return () => {
      symbols.forEach((symbol) => okxWebSocket.unsubscribeTicker(symbol));
    };
  }, [assetBalances]);

  // --- Intersection Observer for Active Section ---
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );

    for (const [, el] of sectionRefs.current) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [loading]);

  // --- Computed Values ---
  const summary = useMemo(
    () => computePortfolioSummary(assetBalances, trades, livePrices),
    [assetBalances, trades, livePrices],
  );

  const holdings = useMemo(
    () => computePortfolioHoldings(assetBalances, trades, livePrices),
    [assetBalances, trades, livePrices],
  );

  const diversification = useMemo(
    () => computeDiversificationAnalysis(holdings),
    [holdings],
  );

  const holdingDurations = useMemo(
    () => computeAssetHoldingDurations(assetBalances, trades),
    [assetBalances, trades],
  );

  const valueTimeline = useMemo(
    () => computePortfolioValueTimeline(trades),
    [trades],
  );

  const riskMetrics = useMemo(
    () => computePortfolioRiskMetrics(holdings, trades),
    [holdings, trades],
  );

  const scrollToSection = (id: string) => {
    const el = sectionRefs.current.get(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const setSectionRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) {
      sectionRefs.current.set(id, el);
    }
  };

  // --- Loading State ---
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={48} className="text-[var(--accent-primary)] animate-spin mb-4" />
        <p className="text-[var(--text-secondary)]">Loading portfolio data...</p>
      </div>
    );
  }

  // --- Empty State ---
  if (assetBalances.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-[var(--accent-success-light)] rounded-full">
              <Wallet size={40} className="text-[var(--accent-success)]" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            No Holdings Yet
          </h2>
          <p className="text-[var(--text-secondary)] mb-4">
            Start by adding trades in the Trading page. Your portfolio will automatically update
            as you record buys and sells.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      {/* Sync Error Banner */}
      {syncError && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
          <AlertCircle size={16} className="text-amber-500 shrink-0" />
          <p className="text-sm text-amber-500">{syncError}</p>
        </div>
      )}

      {/* Sticky Section Navigation */}
      <div className="sticky top-0 z-10 bg-[var(--bg-primary)] border-b border-[var(--border-default)] -mx-6 px-6 mb-6">
        <div className="flex gap-1 overflow-x-auto py-1">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeSection === section.id
                  ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <section.icon size={14} />
              {section.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        {/* 1. Portfolio Summary Cards */}
        <div id="summary" ref={setSectionRef('summary')}>
          <PortfolioSummaryCards summary={summary} />
        </div>

        {/* 2. Holdings Table */}
        <div id="holdings" ref={setSectionRef('holdings')}>
          <Card title="Holdings">
            <PortfolioHoldingsTable holdings={holdings} trades={trades} />
          </Card>
        </div>

        {/* 3. Diversification Analysis */}
        <div id="diversification" ref={setSectionRef('diversification')}>
          <Card title="Diversification Analysis">
            <DiversificationPanel analysis={diversification} holdings={holdings} />
          </Card>
        </div>

        {/* 4. Holding Duration Timeline */}
        <div id="duration" ref={setSectionRef('duration')}>
          <Card title="Holding Duration">
            <HoldingDurationTimeline durations={holdingDurations} />
          </Card>
        </div>

        {/* 5. Portfolio Value Over Time */}
        <div id="value" ref={setSectionRef('value')}>
          <Card title="Portfolio Value Over Time">
            <PortfolioValueChart data={valueTimeline} />
          </Card>
        </div>

        {/* 6. Portfolio Risk Metrics */}
        <div id="risk" ref={setSectionRef('risk')}>
          <PortfolioRiskCards metrics={riskMetrics} />
        </div>
      </div>
    </div>
  );
};
