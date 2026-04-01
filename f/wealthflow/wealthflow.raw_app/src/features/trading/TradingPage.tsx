import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Settings,
  Loader2,
  BarChart3,
  Radio,
  Brain,
  CheckCircle,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import type {
  Trade,
  AssetBalance,
  WatchlistItem,
  StrategyTag,
  TradingGoal,
  TradingTab,
  TradingLimit,
} from '../../types';
import type { OkxTicker } from '../../types/okx';
import {
  loadTrades,
  loadAssetBalances,
  loadStrategyTags,
  saveStrategyTag,
  deleteStrategyTag as deleteStrategyTagApi,
  loadTradingGoals,
  saveTradingGoal,
  loadWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  loadTradingLimits,
  saveTradingLimit,
  deleteTradingLimit as deleteTradingLimitApi,
  clearAllTrades,
  clearAssetBalances,
} from '../../services/supabase/trading';
import {
  computeTradingStats,
  computeEquityCurve,
  computeTimeAnalysis,
  computeHoldDurations,
  computePnlTimeline,
  computeStrategyPerformance,
} from '../../lib/tradingAnalytics';
import { syncTradesFromOkx, syncBalancesFromOkx } from '../../services/okx/client';
import { okxWebSocket } from '../../services/okx/websocket';
import { useTradingInstance } from '../../hooks/useTradingInstance';
import { Card } from '../../components/ui/Card';
import { PnlSummaryCards } from '../../components/trading/PnlSummaryCards';
import { TradeHistoryTable } from '../../components/trading/TradeHistoryTable';
import { AssetBalancesTable } from '../../components/trading/AssetBalancesTable';
import { AllocationPieChart } from '../../components/trading/AllocationPieChart';
import { EquityCurveChart } from '../../components/trading/EquityCurveChart';
import { StrategyTagManager } from '../../components/trading/StrategyTagManager';
import { TradingGoals } from '../../components/trading/TradingGoals';
import { WatchlistPanel } from '../../components/trading/WatchlistPanel';
import { OkxConnectionSettings } from '../../components/trading/OkxConnectionSettings';
import { DrawdownChart } from '../../components/trading/DrawdownChart';
import { PnlTimelineChart } from '../../components/trading/PnlTimelineChart';
import { TimeAnalysisChart } from '../../components/trading/TimeAnalysisChart';
import { HoldDurationChart } from '../../components/trading/HoldDurationChart';
import { StrategyPerformance } from '../../components/trading/StrategyPerformance';
import { RiskMetricsCards } from '../../components/trading/RiskMetricsCards';
import { TradeSignalAnalysis } from '../../components/trading/ai/TradeSignalAnalysis';
import { RiskAssessment } from '../../components/trading/ai/RiskAssessment';
import { TradeJournalSummary } from '../../components/trading/ai/TradeJournalSummary';
import { RebalancingSuggestions } from '../../components/trading/ai/RebalancingSuggestions';
import { PositionSizingCalc } from '../../components/trading/PositionSizingCalc';
import { TradingLimits } from '../../components/trading/TradingLimits';

const TABS: { id: TradingTab; label: string; icon: React.FC<{ size?: number }> }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'trades', label: 'Trades', icon: ArrowLeftRight },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'ai', label: 'AI Insights', icon: Brain },
  { id: 'market', label: 'Market', icon: Radio },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const TradingPage: React.FC = () => {
  const { instance } = useTradingInstance();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [assetBalances, setAssetBalances] = useState<AssetBalance[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [strategyTags, setStrategyTags] = useState<StrategyTag[]>([]);
  const [tradingGoals, setTradingGoals] = useState<TradingGoal[]>([]);
  const [tradingLimits, setTradingLimits] = useState<TradingLimit[]>([]);
  const [livePrices, setLivePrices] = useState<Map<string, OkxTicker>>(new Map());
  const [activeTab, setActiveTab] = useState<TradingTab>('overview');
  const [loading, setLoading] = useState(true);
  const [resetStatus, setResetStatus] = useState<'idle' | 'confirm' | 'running' | 'done'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

  // --- Data Loading (re-runs on instance change) ---
  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      setLoading(true);
      setSyncError(null);

      // Auto-sync from OKX sequentially (parallel causes WORKER_LIMIT on free tier)
      try {
        await syncTradesFromOkx(instance).catch(() => {});
        await syncBalancesFromOkx(instance).catch(() => {});
      } catch {
        // Sync failures are non-blocking — data will load from DB
      }

      const [tradesData, balancesData, watchlistData, tagsData, goalsData, limitsData] =
        await Promise.all([
          loadTrades(undefined, instance),
          loadAssetBalances(instance),
          loadWatchlist(instance),
          loadStrategyTags(instance),
          loadTradingGoals(instance),
          loadTradingLimits(instance),
        ]);

      if (cancelled) return;

      setTrades(tradesData);
      setAssetBalances(balancesData);
      setWatchlist(watchlistData);
      setStrategyTags(tagsData);
      setTradingGoals(goalsData);
      setTradingLimits(limitsData);
      setLoading(false);
    };
    fetchAll();

    return () => {
      cancelled = true;
    };
  }, [instance]);

  // --- Computed ---
  const tradingStats = useMemo(() => computeTradingStats(trades), [trades]);
  const equityCurve = useMemo(() => computeEquityCurve(trades), [trades]);
  const timeAnalysis = useMemo(() => computeTimeAnalysis(trades), [trades]);
  const holdDurations = useMemo(() => computeHoldDurations(trades), [trades]);
  const pnlTimeline = useMemo(() => computePnlTimeline(trades), [trades]);
  const strategyPerformance = useMemo(
    () => computeStrategyPerformance(trades, strategyTags),
    [trades, strategyTags],
  );

  // --- WebSocket for Live Prices ---
  useEffect(() => {
    const allSymbols = new Set<string>();
    watchlist.forEach((w) => allSymbols.add(w.symbol));
    assetBalances.forEach((a) => {
      if (a.asset !== 'USDT') allSymbols.add(a.asset + '-USDT');
    });

    if (allSymbols.size === 0) return;

    okxWebSocket.connect();

    allSymbols.forEach((symbol) => {
      okxWebSocket.subscribeTicker(symbol, (ticker) => {
        setLivePrices((prev) => {
          const next = new Map(prev);
          next.set(ticker.instId, ticker);
          return next;
        });
      });
    });

    return () => {
      allSymbols.forEach((symbol) => okxWebSocket.unsubscribeTicker(symbol));
    };
  }, [watchlist, assetBalances]);

  // --- Strategy Tag Handlers ---
  const handleSaveStrategyTag = async (tag: Omit<StrategyTag, 'id'>) => {
    const saved = await saveStrategyTag(tag, instance);
    if (saved) {
      setStrategyTags((prev) => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
    }
  };

  const handleDeleteStrategyTag = async (id: string) => {
    await deleteStrategyTagApi(id);
    setStrategyTags((prev) => prev.filter((t) => t.id !== id));
  };

  // --- Trading Goal Handler ---
  const handleSaveTradingGoal = async (goal: Omit<TradingGoal, 'id'>) => {
    const saved = await saveTradingGoal(goal, instance);
    if (saved) {
      setTradingGoals((prev) => {
        const filtered = prev.filter(
          (g) => !(g.periodType === saved.periodType && g.periodKey === saved.periodKey),
        );
        return [saved, ...filtered];
      });
    }
  };

  // --- Trading Limits Handlers ---
  const handleSaveTradingLimit = async (
    limit: Omit<TradingLimit, 'id' | 'createdAt' | 'updatedAt'>,
  ) => {
    const saved = await saveTradingLimit(limit, instance);
    if (saved) {
      setTradingLimits((prev) => {
        const filtered = prev.filter((l) => l.periodType !== saved.periodType);
        return [...filtered, saved].sort((a, b) => a.periodType.localeCompare(b.periodType));
      });
    }
  };

  const handleDeleteTradingLimit = async (id: string) => {
    await deleteTradingLimitApi(id);
    setTradingLimits((prev) => prev.filter((l) => l.id !== id));
  };

  // --- Watchlist Handlers ---
  const handleAddToWatchlist = async (symbol: string) => {
    const item = await addToWatchlist(symbol, instance);
    if (item) setWatchlist((prev) => [...prev, item]);
  };

  const handleRemoveFromWatchlist = async (id: string) => {
    await removeFromWatchlist(id);
    setWatchlist((prev) => prev.filter((w) => w.id !== id));
  };

  const handleResetTradingData = async () => {
    if (resetStatus !== 'confirm') {
      setResetStatus('confirm');
      return;
    }
    setResetStatus('running');
    await clearAllTrades(instance);
    await clearAssetBalances(instance);
    setTrades([]);
    setAssetBalances([]);
    setResetStatus('done');
    setTimeout(() => setResetStatus('idle'), 3000);
  };

  // --- OKX Sync Handler ---
  const handleSyncComplete = async () => {
    const [tradesData, balancesData] = await Promise.all([
      loadTrades(undefined, instance),
      loadAssetBalances(instance),
    ]);
    setTrades(tradesData);
    setAssetBalances(balancesData);
  };

  // --- Loading State ---
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={48} className="text-[var(--accent-primary)] animate-spin mb-4" />
        <p className="text-[var(--text-secondary)]">Loading trading data...</p>
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

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 border-b border-[var(--border-default)] overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <PnlSummaryCards stats={tradingStats} />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <Card title="Equity Curve">
                <EquityCurveChart data={equityCurve} />
              </Card>
            </div>
            <div className="xl:col-span-1">
              <Card title="Portfolio Allocation">
                <AllocationPieChart balances={assetBalances} />
              </Card>
            </div>
          </div>

          <Card title="Holdings">
            <AssetBalancesTable balances={assetBalances} livePrices={livePrices} />
          </Card>
        </div>
      )}

      {/* Trades Tab */}
      {activeTab === 'trades' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <TradeHistoryTable
            trades={trades}
            strategyTags={strategyTags}
          />
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <RiskMetricsCards stats={tradingStats} />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card title="P&L Timeline">
              <PnlTimelineChart data={pnlTimeline} />
            </Card>
            <Card title="Drawdown">
              <DrawdownChart data={equityCurve} />
            </Card>
          </div>

          <Card title="Time Analysis">
            <TimeAnalysisChart data={timeAnalysis} />
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card title="Hold Duration vs P&L">
              <HoldDurationChart data={holdDurations} />
            </Card>
            <Card title="Strategy Performance">
              <StrategyPerformance data={strategyPerformance} />
            </Card>
          </div>
        </div>
      )}

      {/* AI Insights Tab */}
      {activeTab === 'ai' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card title="Trade Signal Analysis">
              <TradeSignalAnalysis trades={trades} assetBalances={assetBalances} />
            </Card>
            <Card title="Portfolio Risk Assessment">
              <RiskAssessment assetBalances={assetBalances} trades={trades} stats={tradingStats} />
            </Card>
          </div>

          <Card title="Trade Journal Analysis">
            <TradeJournalSummary trades={trades} stats={tradingStats} />
          </Card>

          <Card title="Rebalancing Suggestions">
            <RebalancingSuggestions assetBalances={assetBalances} />
          </Card>
        </div>
      )}

      {/* Market Tab */}
      {activeTab === 'market' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <WatchlistPanel
            watchlist={watchlist}
            onAdd={handleAddToWatchlist}
            onRemove={handleRemoveFromWatchlist}
          />
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <OkxConnectionSettings onSyncComplete={handleSyncComplete} />

          <Card title="Reset Trading Data">
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Delete all trades and asset balances for this instance. You can then re-sync from OKX
              to start fresh with live data.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleResetTradingData}
                disabled={resetStatus === 'running'}
                className={`flex items-center gap-2 ${
                  resetStatus === 'confirm'
                    ? 'bg-red-700 hover:bg-red-800'
                    : 'bg-red-600 hover:bg-red-700'
                } disabled:opacity-50 text-white px-4 py-2 rounded-lg shadow-md transition-all active:scale-95`}
              >
                {resetStatus === 'running' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}
                {resetStatus === 'confirm'
                  ? 'Click again to confirm'
                  : resetStatus === 'running'
                    ? 'Deleting...'
                    : 'Delete All Trades & Balances'}
              </button>
              {resetStatus === 'confirm' && (
                <button
                  onClick={() => setResetStatus('idle')}
                  className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
              )}
              {resetStatus === 'done' && (
                <span className="flex items-center gap-1 text-sm text-emerald-400">
                  <CheckCircle size={16} />
                  All data cleared
                </span>
              )}
            </div>
          </Card>

          <StrategyTagManager
            tags={strategyTags}
            onSave={handleSaveStrategyTag}
            onDelete={handleDeleteStrategyTag}
          />
          <TradingGoals goals={tradingGoals} trades={trades} onSave={handleSaveTradingGoal} />
          <PositionSizingCalc />
          <TradingLimits
            limits={tradingLimits}
            trades={trades}
            onSave={handleSaveTradingLimit}
            onDelete={handleDeleteTradingLimit}
          />
        </div>
      )}

    </div>
  );
};
