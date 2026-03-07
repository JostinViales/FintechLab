import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Settings,
  Plus,
  Loader2,
  BarChart3,
  Radio,
} from 'lucide-react';
import type { Trade, AssetBalance, WatchlistItem, StrategyTag, TradingGoal, TradingTab } from '@/types';
import type { OkxTicker } from '@/types/okx';
import {
  loadTrades,
  saveTrade,
  updateTrade,
  deleteTrade as deleteTradeApi,
  loadAssetBalances,
  upsertAssetBalance,
  clearAssetBalances,
  loadStrategyTags,
  saveStrategyTag,
  deleteStrategyTag as deleteStrategyTagApi,
  loadTradingGoals,
  saveTradingGoal,
  loadWatchlist,
  addToWatchlist,
  removeFromWatchlist,
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
import { okxWebSocket } from '@/services/okx/websocket';
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

const TABS: { id: TradingTab; label: string; icon: React.FC<{ size?: number }> }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'trades', label: 'Trades', icon: ArrowLeftRight },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'market', label: 'Market', icon: Radio },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const STARTING_CAPITAL = 10000;

export const TradingPage: React.FC = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [assetBalances, setAssetBalances] = useState<AssetBalance[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [strategyTags, setStrategyTags] = useState<StrategyTag[]>([]);
  const [tradingGoals, setTradingGoals] = useState<TradingGoal[]>([]);
  const [livePrices, setLivePrices] = useState<Map<string, OkxTicker>>(new Map());
  const [activeTab, setActiveTab] = useState<TradingTab>('overview');
  const [isTradeFormOpen, setIsTradeFormOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);

  // --- Data Loading ---
  useEffect(() => {
    const fetchAll = async () => {
      const [tradesData, balancesData, watchlistData, tagsData, goalsData] = await Promise.all([
        loadTrades(),
        loadAssetBalances(),
        loadWatchlist(),
        loadStrategyTags(),
        loadTradingGoals(),
      ]);
      setTrades(tradesData);
      setAssetBalances(balancesData);
      setWatchlist(watchlistData);
      setStrategyTags(tagsData);
      setTradingGoals(goalsData);
      setLoading(false);
    };
    fetchAll();
  }, []);

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

  // --- Asset Balance Recalculation ---
  const recalcBalances = useCallback(async (updatedTrades: Trade[]) => {
    const computed = computeAssetBalancesFromTrades(updatedTrades);

    if (computed.size === 0) {
      await clearAssetBalances();
      setAssetBalances([]);
      return;
    }

    const promises = Array.from(computed.entries()).map(([asset, bal]) =>
      upsertAssetBalance({
        asset,
        totalQuantity: bal.totalQuantity,
        avgBuyPrice: bal.avgBuyPrice,
        totalCost: bal.totalCost,
      }),
    );
    const results = await Promise.all(promises);
    setAssetBalances(results.filter((r): r is AssetBalance => r !== null));
  }, []);

  // --- Trade Handlers ---
  const handleSaveTrade = async (data: Omit<Trade, 'id' | 'createdAt' | 'total'>) => {
    let updatedTrades: Trade[];

    if (editingTrade) {
      const updated = await updateTrade(editingTrade.id, data);
      if (!updated) return;
      updatedTrades = trades.map((t) => (t.id === updated.id ? updated : t));
    } else {
      const saved = await saveTrade(data);
      if (!saved) return;
      updatedTrades = [saved, ...trades];
    }

    setTrades(updatedTrades);
    setEditingTrade(null);
    await recalcBalances(updatedTrades);
  };

  const handleDeleteTrade = async (id: string) => {
    if (!confirm('Delete this trade?')) return;
    await deleteTradeApi(id);
    const updatedTrades = trades.filter((t) => t.id !== id);
    setTrades(updatedTrades);
    await recalcBalances(updatedTrades);
  };

  // --- Strategy Tag Handlers ---
  const handleSaveStrategyTag = async (tag: Omit<StrategyTag, 'id'>) => {
    const saved = await saveStrategyTag(tag);
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
    const saved = await saveTradingGoal(goal);
    if (saved) {
      setTradingGoals((prev) => {
        const filtered = prev.filter(
          (g) => !(g.periodType === saved.periodType && g.periodKey === saved.periodKey),
        );
        return [saved, ...filtered];
      });
    }
  };

  // --- Watchlist Handlers ---
  const handleAddToWatchlist = async (symbol: string) => {
    const item = await addToWatchlist(symbol);
    if (item) setWatchlist((prev) => [...prev, item]);
  };

  const handleRemoveFromWatchlist = async (id: string) => {
    await removeFromWatchlist(id);
    setWatchlist((prev) => prev.filter((w) => w.id !== id));
  };

  // --- OKX Sync Handler ---
  const handleSyncComplete = async () => {
    const [tradesData, balancesData] = await Promise.all([loadTrades(), loadAssetBalances()]);
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
          <StrategyTagManager
            tags={strategyTags}
            onSave={handleSaveStrategyTag}
            onDelete={handleDeleteStrategyTag}
          />
          <TradingGoals goals={tradingGoals} trades={trades} onSave={handleSaveTradingGoal} />
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
