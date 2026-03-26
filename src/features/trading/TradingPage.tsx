import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Settings,
  Plus,
  Loader2,
  BarChart3,
  Radio,
  Brain,
  RefreshCw,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import type {
  Trade,
  AssetBalance,
  WatchlistItem,
  StrategyTag,
  TradingGoal,
  TradingTab,
  TradingLimit,
} from '@/types';
import type { OkxTicker } from '@/types/okx';
import {
  loadTrades,
  saveTrade,
  updateTrade,
  deleteTrade as deleteTradeApi,
  loadAssetBalances,
  upsertAssetBalance,
  clearAssetBalancesByType,
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
  matchTradesForSymbol,
  recalcAllPnl,
} from '@/services/supabase/trading';
import {
  computeTradingStats,
  computeEquityCurve,
  computeAssetBalancesFromTrades,
  computeTimeAnalysis,
  computeHoldDurations,
  computePnlTimeline,
  computeStrategyPerformance,
} from '@/lib/tradingAnalytics';
import { syncTradesFromOkx, syncBalancesFromOkx } from '@/services/okx/client';
import { okxWebSocket } from '@/services/okx/websocket';
import { useTradingInstance } from '@/hooks/useTradingInstance';
import { Card } from '@/components/ui/Card';
import { PnlSummaryCards } from '@/components/trading/PnlSummaryCards';
import { TradeForm } from '@/components/trading/TradeForm';
import { TradeHistoryTable } from '@/components/trading/TradeHistoryTable';
import { AssetBalancesTable } from '@/components/trading/AssetBalancesTable';
import { AllocationPieChart } from '@/components/trading/AllocationPieChart';
import { EquityCurveChart } from '@/components/trading/EquityCurveChart';
import { StrategyTagManager } from '@/components/trading/StrategyTagManager';
import { TradingGoals } from '@/components/trading/TradingGoals';
import { WatchlistPanel } from '@/components/trading/WatchlistPanel';
import { OkxConnectionSettings } from '@/components/trading/OkxConnectionSettings';
import { DrawdownChart } from '@/components/trading/DrawdownChart';
import { PnlTimelineChart } from '@/components/trading/PnlTimelineChart';
import { TimeAnalysisChart } from '@/components/trading/TimeAnalysisChart';
import { HoldDurationChart } from '@/components/trading/HoldDurationChart';
import { StrategyPerformance } from '@/components/trading/StrategyPerformance';
import { RiskMetricsCards } from '@/components/trading/RiskMetricsCards';
import { TradeSignalAnalysis } from '@/components/trading/ai/TradeSignalAnalysis';
import { RiskAssessment } from '@/components/trading/ai/RiskAssessment';
import { TradeJournalSummary } from '@/components/trading/ai/TradeJournalSummary';
import { RebalancingSuggestions } from '@/components/trading/ai/RebalancingSuggestions';
import { PositionSizingCalc } from '@/components/trading/PositionSizingCalc';
import { TradingLimits } from '@/components/trading/TradingLimits';

const TABS: { id: TradingTab; label: string; icon: React.FC<{ size?: number }> }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'trades', label: 'Trades', icon: ArrowLeftRight },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'ai', label: 'AI Insights', icon: Brain },
  { id: 'market', label: 'Market', icon: Radio },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const STARTING_CAPITAL = 10000;

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
  const [isTradeFormOpen, setIsTradeFormOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalcStatus, setRecalcStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [recalcCount, setRecalcCount] = useState(0);
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
  const equityCurve = useMemo(() => computeEquityCurve(trades, STARTING_CAPITAL), [trades]);
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

  // --- Asset Balance Recalculation (trading account only) ---
  const recalcBalances = useCallback(
    async (updatedTrades: Trade[]) => {
      const computed = computeAssetBalancesFromTrades(updatedTrades);

      // Only clear trading-type balances — preserve Funding/Earn rows
      await clearAssetBalancesByType('trading', instance);

      if (computed.size === 0) {
        // Reload to keep Funding/Earn balances visible
        const remaining = await loadAssetBalances(instance);
        setAssetBalances(remaining);
        return;
      }

      const promises = Array.from(computed.entries()).map(([asset, bal]) =>
        upsertAssetBalance(
          {
            asset,
            totalQuantity: bal.totalQuantity,
            avgBuyPrice: bal.avgBuyPrice,
            totalCost: bal.totalCost,
            accountType: 'trading',
          },
          instance,
        ),
      );
      await Promise.all(promises);
      // Reload all balances so Funding/Earn remain visible
      const allBalances = await loadAssetBalances(instance);
      setAssetBalances(allBalances);
    },
    [instance],
  );

  // --- Trade Handlers ---
  const handleSaveTrade = async (data: Omit<Trade, 'id' | 'createdAt' | 'total'>) => {
    let savedSymbol: string;

    if (editingTrade) {
      const updated = await updateTrade(editingTrade.id, data);
      if (!updated) return;
      savedSymbol = updated.symbol;
    } else {
      const saved = await saveTrade(data, instance);
      if (!saved) return;
      savedSymbol = saved.symbol;
    }

    await matchTradesForSymbol(savedSymbol, instance);
    const refreshedTrades = await loadTrades(undefined, instance);
    setTrades(refreshedTrades);
    setEditingTrade(null);
    await recalcBalances(refreshedTrades);
  };

  const handleDeleteTrade = async (id: string) => {
    if (!confirm('Delete this trade?')) return;
    const deletedTrade = trades.find((t) => t.id === id);
    await deleteTradeApi(id);

    if (deletedTrade) {
      await matchTradesForSymbol(deletedTrade.symbol, instance);
    }

    const refreshedTrades = await loadTrades(undefined, instance);
    setTrades(refreshedTrades);
    await recalcBalances(refreshedTrades);
  };

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

  // --- Recalculate All P&L ---
  const handleRecalcAllPnl = async () => {
    setRecalcStatus('running');
    const count = await recalcAllPnl(instance);
    const refreshedTrades = await loadTrades(undefined, instance);
    setTrades(refreshedTrades);
    await recalcBalances(refreshedTrades);
    setRecalcCount(count);
    setRecalcStatus('done');
    setTimeout(() => setRecalcStatus('idle'), 3000);
  };

  // --- OKX Sync Handler ---
  const handleSyncComplete = async () => {
    await recalcAllPnl(instance);
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
          <div className="flex justify-end">
            <button
              onClick={() => {
                setEditingTrade(null);
                setIsTradeFormOpen(true);
              }}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-md transition-all active:scale-95"
            >
              <Plus size={20} />
              <span>Add Trade</span>
            </button>
          </div>
          <TradeHistoryTable
            trades={trades}
            strategyTags={strategyTags}
            onEdit={(trade) => {
              setEditingTrade(trade);
              setIsTradeFormOpen(true);
            }}
            onDelete={handleDeleteTrade}
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

          <Card title="Recalculate All P&L">
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Re-run FIFO matching for manually entered trades to recalculate realized P&L.
              Useful after bulk imports or manual edits.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRecalcAllPnl}
                disabled={recalcStatus === 'running'}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg shadow-md transition-all active:scale-95"
              >
                {recalcStatus === 'running' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                {recalcStatus === 'running' ? 'Recalculating...' : 'Recalculate All P&L'}
              </button>
              {recalcStatus === 'done' && (
                <span className="flex items-center gap-1 text-sm text-emerald-400">
                  <CheckCircle size={16} />
                  Updated {recalcCount} trade{recalcCount !== 1 ? 's' : ''}
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

      {/* Trade Form Modal */}
      {isTradeFormOpen && (
        <TradeForm
          strategyTags={strategyTags}
          initialData={editingTrade}
          onClose={() => {
            setIsTradeFormOpen(false);
            setEditingTrade(null);
          }}
          onSubmit={handleSaveTrade}
        />
      )}
    </div>
  );
};
