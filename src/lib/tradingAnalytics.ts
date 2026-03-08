import type {
  Trade,
  TradingStats,
  EquityCurvePoint,
  StrategyTag,
  TimeAnalysis,
  TimeAnalysisBucket,
  HoldDuration,
  PnlTimelinePoint,
  StrategyPerformanceData,
} from '@/types';

// --- Private Helpers ---

/**
 * Compute daily P&L returns from trades.
 */
const computeDailyReturns = (trades: Trade[]): number[] => {
  const closingTrades = trades.filter((t) => t.realizedPnl != null);
  const sorted = [...closingTrades].sort(
    (a, b) => new Date(a.tradedAt).getTime() - new Date(b.tradedAt).getTime(),
  );

  const dailyMap = new Map<string, number>();
  for (const trade of sorted) {
    const date = trade.tradedAt.slice(0, 10);
    dailyMap.set(date, (dailyMap.get(date) ?? 0) + (trade.realizedPnl ?? 0));
  }

  return Array.from(dailyMap.values());
};

/**
 * Annualized Sharpe ratio from daily returns.
 * Formula: (mean / stdDev) * sqrt(252)
 * Risk-free rate assumed 0 for crypto.
 */
const computeSharpeRatio = (dailyReturns: number[]): number => {
  if (dailyReturns.length < 2) return 0;
  const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
  const variance =
    dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (dailyReturns.length - 1);
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;
  return (mean / stdDev) * Math.sqrt(252);
};

/**
 * Annualized Sortino ratio — like Sharpe but only penalizes downside volatility.
 */
const computeSortinoRatio = (dailyReturns: number[]): number => {
  if (dailyReturns.length < 2) return 0;
  const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
  const negativeReturns = dailyReturns.filter((r) => r < 0);
  if (negativeReturns.length === 0) return mean > 0 ? Infinity : 0;
  const downsideVariance =
    negativeReturns.reduce((s, r) => s + r ** 2, 0) / negativeReturns.length;
  const downsideStdDev = Math.sqrt(downsideVariance);
  if (downsideStdDev === 0) return 0;
  return (mean / downsideStdDev) * Math.sqrt(252);
};

/**
 * Compute drawdown metrics from trades without depending on computeEquityCurve.
 */
const computeDrawdownMetrics = (
  trades: Trade[],
): { maxDrawdown: number; maxDrawdownPct: number } => {
  const sorted = [...trades]
    .filter((t) => t.realizedPnl != null)
    .sort((a, b) => new Date(a.tradedAt).getTime() - new Date(b.tradedAt).getTime());

  if (sorted.length === 0) return { maxDrawdown: 0, maxDrawdownPct: 0 };

  let equity = 10000; // reference starting capital
  let peak = equity;
  let maxDD = 0;
  let maxDDPct = 0;

  for (const trade of sorted) {
    equity += (trade.realizedPnl ?? 0) - trade.fee;
    peak = Math.max(peak, equity);
    const dd = peak - equity;
    const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
    maxDD = Math.max(maxDD, dd);
    maxDDPct = Math.max(maxDDPct, ddPct);
  }

  return { maxDrawdown: maxDD, maxDrawdownPct: maxDDPct };
};

// --- Public Functions ---

/**
 * Compute aggregate trading statistics from a list of trades.
 * Only trades with realizedPnl set are counted for win/loss metrics.
 */
export const computeTradingStats = (trades: Trade[]): TradingStats => {
  const closingTrades = trades.filter((t) => t.realizedPnl != null);
  const wins = closingTrades.filter((t) => (t.realizedPnl ?? 0) > 0);
  const losses = closingTrades.filter((t) => (t.realizedPnl ?? 0) < 0);

  const grossProfit = wins.reduce((sum, t) => sum + (t.realizedPnl ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.realizedPnl ?? 0), 0));

  const totalFees = trades.reduce((sum, t) => sum + t.fee, 0);
  const totalRealizedPnl = closingTrades.reduce((sum, t) => sum + (t.realizedPnl ?? 0), 0);
  const totalVolume = trades.reduce((s, t) => s + t.total, 0);

  const { maxDrawdown, maxDrawdownPct } = computeDrawdownMetrics(trades);
  const dailyReturns = computeDailyReturns(trades);
  const sharpeRatio = computeSharpeRatio(dailyReturns);
  const sortinoRatio = computeSortinoRatio(dailyReturns);

  const holdDurations = computeHoldDurations(trades);
  const avgHoldDurationMinutes =
    holdDurations.length > 0
      ? holdDurations.reduce((s, h) => s + h.durationMinutes, 0) / holdDurations.length
      : 0;

  return {
    totalTrades: trades.length,
    totalRealizedPnl,
    totalFeesPaid: totalFees,
    winCount: wins.length,
    lossCount: losses.length,
    winRate: closingTrades.length > 0 ? (wins.length / closingTrades.length) * 100 : 0,
    avgWin: wins.length > 0 ? grossProfit / wins.length : 0,
    avgLoss: losses.length > 0 ? grossLoss / losses.length : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    avgTradeSize: trades.length > 0 ? totalVolume / trades.length : 0,
    largestWin: wins.length > 0 ? Math.max(...wins.map((t) => t.realizedPnl ?? 0)) : 0,
    largestLoss: losses.length > 0 ? Math.min(...losses.map((t) => t.realizedPnl ?? 0)) : 0,
    maxDrawdown,
    maxDrawdownPct,
    sharpeRatio,
    sortinoRatio,
    avgHoldDurationMinutes,
    totalVolume,
  };
};

/**
 * Compute equity curve from trades sorted by date ascending.
 * Starting capital is the initial equity value.
 */
export const computeEquityCurve = (
  trades: Trade[],
  startingCapital: number,
): EquityCurvePoint[] => {
  const sorted = [...trades]
    .filter((t) => t.realizedPnl != null)
    .sort((a, b) => new Date(a.tradedAt).getTime() - new Date(b.tradedAt).getTime());

  if (sorted.length === 0) return [];

  let equity = startingCapital;
  let peak = startingCapital;
  const points: EquityCurvePoint[] = [];

  for (const trade of sorted) {
    equity += (trade.realizedPnl ?? 0) - trade.fee;
    peak = Math.max(peak, equity);
    const drawdown = peak - equity;
    const drawdownPct = peak > 0 ? (drawdown / peak) * 100 : 0;

    points.push({
      date: trade.tradedAt.slice(0, 10),
      equity,
      drawdown,
      drawdownPct,
    });
  }

  return points;
};

/**
 * Recalculate asset balances from trade history.
 * Uses weighted average cost basis method.
 */
export const computeAssetBalancesFromTrades = (
  trades: Trade[],
): Map<string, { totalQuantity: number; avgBuyPrice: number; totalCost: number }> => {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.tradedAt).getTime() - new Date(b.tradedAt).getTime(),
  );

  const balances = new Map<
    string,
    { totalQuantity: number; avgBuyPrice: number; totalCost: number }
  >();

  for (const trade of sorted) {
    const asset = trade.symbol.split('-')[0] ?? trade.symbol;
    const current = balances.get(asset) ?? { totalQuantity: 0, avgBuyPrice: 0, totalCost: 0 };

    if (trade.side === 'buy') {
      const newCost = current.totalCost + trade.total;
      const newQty = current.totalQuantity + trade.quantity;
      current.totalQuantity = newQty;
      current.totalCost = newCost;
      current.avgBuyPrice = newQty > 0 ? newCost / newQty : 0;
    } else {
      const sellRatio =
        current.totalQuantity > 0 ? Math.min(trade.quantity / current.totalQuantity, 1) : 0;
      current.totalQuantity = Math.max(0, current.totalQuantity - trade.quantity);
      current.totalCost = current.totalCost * (1 - sellRatio);
    }

    balances.set(asset, current);
  }

  for (const [asset, bal] of balances) {
    if (bal.totalQuantity <= 0) balances.delete(asset);
  }

  return balances;
};

/**
 * Analyze trade performance by hour of day, day of week, and month.
 * Only trades with realizedPnl are included in win rate calculations.
 */
export const computeTimeAnalysis = (trades: Trade[]): TimeAnalysis => {
  const closingTrades = trades.filter((t) => t.realizedPnl != null);

  const byHour: Record<number, { trades: number; pnl: number; wins: number }> = {};
  const byDayOfWeek: Record<number, { trades: number; pnl: number; wins: number }> = {};
  const byMonth: Record<string, { trades: number; pnl: number; wins: number }> = {};

  for (const trade of closingTrades) {
    const date = new Date(trade.tradedAt);
    const hour = date.getUTCHours();
    const day = date.getUTCDay();
    const month = trade.tradedAt.slice(0, 7);
    const pnl = trade.realizedPnl ?? 0;
    const isWin = pnl > 0 ? 1 : 0;

    // Hour bucket
    if (!byHour[hour]) byHour[hour] = { trades: 0, pnl: 0, wins: 0 };
    byHour[hour].trades++;
    byHour[hour].pnl += pnl;
    byHour[hour].wins += isWin;

    // Day bucket
    if (!byDayOfWeek[day]) byDayOfWeek[day] = { trades: 0, pnl: 0, wins: 0 };
    byDayOfWeek[day].trades++;
    byDayOfWeek[day].pnl += pnl;
    byDayOfWeek[day].wins += isWin;

    // Month bucket
    if (!byMonth[month]) byMonth[month] = { trades: 0, pnl: 0, wins: 0 };
    byMonth[month].trades++;
    byMonth[month].pnl += pnl;
    byMonth[month].wins += isWin;
  }

  const toBucket = (raw: Record<string | number, { trades: number; pnl: number; wins: number }>): Record<string, TimeAnalysisBucket> => {
    const result: Record<string, TimeAnalysisBucket> = {};
    for (const [key, val] of Object.entries(raw)) {
      result[key] = {
        trades: val.trades,
        pnl: val.pnl,
        winRate: val.trades > 0 ? (val.wins / val.trades) * 100 : 0,
      };
    }
    return result;
  };

  return {
    byHour: toBucket(byHour) as Record<number, TimeAnalysisBucket>,
    byDayOfWeek: toBucket(byDayOfWeek) as Record<number, TimeAnalysisBucket>,
    byMonth: toBucket(byMonth),
  };
};

/**
 * Estimate hold durations by pairing buy and sell trades per symbol (FIFO).
 */
export const computeHoldDurations = (trades: Trade[]): HoldDuration[] => {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.tradedAt).getTime() - new Date(b.tradedAt).getTime(),
  );

  const buyQueues = new Map<string, { tradedAt: string; quantity: number; price: number }[]>();
  const durations: HoldDuration[] = [];

  for (const trade of sorted) {
    const symbol = trade.symbol;

    if (trade.side === 'buy') {
      const queue = buyQueues.get(symbol) ?? [];
      queue.push({ tradedAt: trade.tradedAt, quantity: trade.quantity, price: trade.price });
      buyQueues.set(symbol, queue);
    } else {
      const queue = buyQueues.get(symbol) ?? [];
      let remaining = trade.quantity;

      while (remaining > 0 && queue.length > 0) {
        const oldest = queue[0]!;
        const matched = Math.min(remaining, oldest.quantity);
        const durationMs =
          new Date(trade.tradedAt).getTime() - new Date(oldest.tradedAt).getTime();
        const pnl = matched * (trade.price - oldest.price);

        durations.push({
          durationMinutes: Math.max(0, durationMs / 60000),
          pnl,
          symbol,
        });

        remaining -= matched;
        oldest.quantity -= matched;
        if (oldest.quantity <= 0) queue.shift();
      }
    }
  }

  return durations;
};

/**
 * Aggregate realized P&L per day for timeline chart.
 */
export const computePnlTimeline = (trades: Trade[]): PnlTimelinePoint[] => {
  const closingTrades = trades.filter((t) => t.realizedPnl != null);
  const sorted = [...closingTrades].sort(
    (a, b) => new Date(a.tradedAt).getTime() - new Date(b.tradedAt).getTime(),
  );

  const dailyMap = new Map<string, number>();
  for (const trade of sorted) {
    const date = trade.tradedAt.slice(0, 10);
    dailyMap.set(date, (dailyMap.get(date) ?? 0) + (trade.realizedPnl ?? 0));
  }

  let cumulative = 0;
  const points: PnlTimelinePoint[] = [];
  for (const [date, pnl] of dailyMap) {
    cumulative += pnl;
    points.push({ date, pnl, cumulativePnl: cumulative });
  }

  return points;
};

/**
 * Compute TradingStats per strategy tag.
 */
export const computeStrategyPerformance = (
  trades: Trade[],
  strategyTags: StrategyTag[],
): StrategyPerformanceData[] => {
  const tagMap = new Map(strategyTags.map((t) => [t.name, t]));
  const grouped = new Map<string, Trade[]>();

  for (const trade of trades) {
    const key = trade.strategyTag ?? 'Untagged';
    const list = grouped.get(key) ?? [];
    list.push(trade);
    grouped.set(key, list);
  }

  return Array.from(grouped.entries()).map(([strategy, strategyTrades]) => ({
    strategy,
    color: tagMap.get(strategy)?.color ?? '#94a3b8',
    stats: computeTradingStats(strategyTrades),
  }));
};
