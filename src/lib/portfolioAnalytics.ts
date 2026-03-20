import type {
  Trade,
  AssetBalance,
  PortfolioSummary,
  PortfolioHolding,
  DiversificationAnalysis,
  ConcentrationRisk,
  AssetHoldingDuration,
  PortfolioValuePoint,
  PortfolioRiskMetrics,
} from '@/types';
import type { OkxTicker } from '@/types/okx';
import { computeTradingStats } from '@/lib/tradingAnalytics';

/**
 * Aggregate portfolio totals from balances, live prices, and 24h change from OKX tickers.
 */
export const computePortfolioSummary = (
  balances: AssetBalance[],
  trades: Trade[],
  livePrices: Map<string, OkxTicker>,
): PortfolioSummary => {
  const totalCost = balances.reduce((sum, b) => sum + b.totalCost, 0);
  const stats = computeTradingStats(trades);

  let totalValue = 0;
  let totalPrev24hValue = 0;
  let totalCurrent24hValue = 0;
  let hasAnyPrice = false;

  for (const balance of balances) {
    const ticker = livePrices.get(balance.asset + '-USDT');
    if (ticker) {
      hasAnyPrice = true;
      const currentPrice = Number(ticker.last);
      const open24h = Number(ticker.open24h);
      const value = balance.totalQuantity * currentPrice;
      const prevValue = balance.totalQuantity * open24h;
      totalValue += value;
      totalPrev24hValue += prevValue;
      totalCurrent24hValue += value;
    } else {
      totalValue += balance.totalCost;
    }
  }

  const unrealizedPnl = hasAnyPrice ? totalValue - totalCost : 0;
  const unrealizedPnlPct = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0;
  const change24h = hasAnyPrice ? totalCurrent24hValue - totalPrev24hValue : 0;
  const change24hPct = totalPrev24hValue > 0 ? (change24h / totalPrev24hValue) * 100 : 0;

  return {
    totalValue: hasAnyPrice ? totalValue : totalCost,
    totalCost,
    unrealizedPnl,
    unrealizedPnlPct,
    realizedPnl: stats.totalRealizedPnl,
    change24h,
    change24hPct,
    assetCount: balances.length,
  };
};

/**
 * Enrich balances with first buy date, holding duration, trade count, and 24h change.
 */
export const computePortfolioHoldings = (
  balances: AssetBalance[],
  trades: Trade[],
  livePrices: Map<string, OkxTicker>,
): PortfolioHolding[] => {
  const now = Date.now();
  let totalCurrentValue = 0;

  // Pre-compute current values for allocation %
  const enrichedWithPrice = balances.map((b) => {
    const ticker = livePrices.get(b.asset + '-USDT');
    const currentPrice = ticker ? Number(ticker.last) : 0;
    const currentValue = currentPrice > 0 ? b.totalQuantity * currentPrice : b.totalCost;
    totalCurrentValue += currentValue;
    return { balance: b, ticker, currentPrice, currentValue };
  });

  return enrichedWithPrice.map(({ balance, ticker, currentPrice, currentValue }) => {
    const assetTrades = trades.filter((t) => {
      const tradeAsset = t.symbol.split('-')[0] ?? t.symbol;
      return tradeAsset === balance.asset;
    });

    const buyTrades = assetTrades.filter((t) => t.side === 'buy');
    const sortedBuys = [...buyTrades].sort(
      (a, b) => new Date(a.tradedAt).getTime() - new Date(b.tradedAt).getTime(),
    );

    const firstBuyDate = sortedBuys.length > 0 ? sortedBuys[0]!.tradedAt : '';
    const holdingDurationDays = firstBuyDate
      ? Math.floor((now - new Date(firstBuyDate).getTime()) / 86_400_000)
      : 0;

    const open24h = ticker ? Number(ticker.open24h) : 0;
    const last = ticker ? Number(ticker.last) : 0;
    const change24h = ticker ? (last - open24h) * balance.totalQuantity : 0;
    const change24hPct = open24h > 0 ? ((last - open24h) / open24h) * 100 : 0;

    const unrealizedPnl = currentPrice > 0 ? currentValue - balance.totalCost : 0;
    const unrealizedPnlPct =
      balance.totalCost > 0 ? (unrealizedPnl / balance.totalCost) * 100 : 0;

    return {
      asset: balance.asset,
      totalQuantity: balance.totalQuantity,
      avgBuyPrice: balance.avgBuyPrice,
      totalCost: balance.totalCost,
      currentPrice,
      currentValue,
      unrealizedPnl,
      unrealizedPnlPct,
      allocationPct: totalCurrentValue > 0 ? (currentValue / totalCurrentValue) * 100 : 0,
      firstBuyDate,
      holdingDurationDays,
      tradeCount: assetTrades.length,
      change24h,
      change24hPct,
    };
  });
};

/**
 * Compute Herfindahl-Hirschman Index, a 0-100 diversification score,
 * and concentration risk alerts.
 */
export const computeDiversificationAnalysis = (
  holdings: PortfolioHolding[],
): DiversificationAnalysis => {
  if (holdings.length === 0) {
    return { score: 0, herfindahlIndex: 0, topAssetPct: 0, concentrationRisks: [] };
  }

  // HHI = sum of squared allocation percentages (range: 10000/n to 10000)
  const hhi = holdings.reduce((sum, h) => sum + h.allocationPct ** 2, 0);

  // Normalize HHI to 0-100 score (inverted: lower HHI = better diversification)
  // Perfect diversification across n assets: HHI = 10000/n → score = 100
  // Single asset: HHI = 10000 → score = 0
  const minHhi = holdings.length > 0 ? 10000 / holdings.length : 10000;
  const score =
    holdings.length <= 1 ? 0 : Math.round(((10000 - hhi) / (10000 - minHhi)) * 100);

  const topAssetPct = Math.max(...holdings.map((h) => h.allocationPct), 0);

  const concentrationRisks: ConcentrationRisk[] = holdings
    .filter((h) => h.allocationPct > 25)
    .map((h) => {
      let level: ConcentrationRisk['level'];
      let message: string;

      if (h.allocationPct > 50) {
        level = 'critical';
        message = `${h.asset} represents over 50% of your portfolio — extremely concentrated`;
      } else if (h.allocationPct > 35) {
        level = 'high';
        message = `${h.asset} is over 35% of portfolio — consider reducing exposure`;
      } else {
        level = 'medium';
        message = `${h.asset} is over 25% of portfolio — monitor closely`;
      }

      return { asset: h.asset, allocationPct: h.allocationPct, level, message };
    })
    .sort((a, b) => b.allocationPct - a.allocationPct);

  return {
    score: Math.max(0, Math.min(100, score)),
    herfindahlIndex: Math.round(hhi),
    topAssetPct,
    concentrationRisks,
  };
};

/**
 * Group trades by asset to find earliest/latest buy and compute holding days.
 */
export const computeAssetHoldingDurations = (
  balances: AssetBalance[],
  trades: Trade[],
): AssetHoldingDuration[] => {
  const now = Date.now();
  const totalValue = balances.reduce((sum, b) => sum + b.totalCost, 0);

  return balances.map((balance) => {
    const assetTrades = trades.filter((t) => {
      const tradeAsset = t.symbol.split('-')[0] ?? t.symbol;
      return tradeAsset === balance.asset && t.side === 'buy';
    });

    const sorted = [...assetTrades].sort(
      (a, b) => new Date(a.tradedAt).getTime() - new Date(b.tradedAt).getTime(),
    );

    const firstBuyDate = sorted.length > 0 ? sorted[0]!.tradedAt : '';
    const lastBuyDate = sorted.length > 0 ? sorted[sorted.length - 1]!.tradedAt : '';
    const holdingDays = firstBuyDate
      ? Math.floor((now - new Date(firstBuyDate).getTime()) / 86_400_000)
      : 0;

    return {
      asset: balance.asset,
      firstBuyDate,
      lastBuyDate,
      holdingDays,
      totalQuantity: balance.totalQuantity,
      allocationPct: totalValue > 0 ? (balance.totalCost / totalValue) * 100 : 0,
    };
  });
};

/**
 * Walk trades chronologically, tracking cumulative cost basis and realized P&L
 * to build a portfolio value timeline.
 */
export const computePortfolioValueTimeline = (trades: Trade[]): PortfolioValuePoint[] => {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.tradedAt).getTime() - new Date(b.tradedAt).getTime(),
  );

  if (sorted.length === 0) return [];

  const dailyMap = new Map<
    string,
    { totalCost: number; realizedPnl: number }
  >();

  let cumulativeCost = 0;
  let cumulativeRealizedPnl = 0;

  // Track per-asset cost for accurate cost basis
  const assetCosts = new Map<string, { quantity: number; cost: number }>();

  for (const trade of sorted) {
    const date = trade.tradedAt.slice(0, 10);
    const asset = trade.symbol.split('-')[0] ?? trade.symbol;
    const current = assetCosts.get(asset) ?? { quantity: 0, cost: 0 };

    if (trade.side === 'buy') {
      current.quantity += trade.quantity;
      current.cost += trade.total;
    } else {
      const sellRatio = current.quantity > 0
        ? Math.min(trade.quantity / current.quantity, 1)
        : 0;
      current.quantity = Math.max(0, current.quantity - trade.quantity);
      current.cost = current.cost * (1 - sellRatio);
      cumulativeRealizedPnl += trade.realizedPnl ?? 0;
    }

    assetCosts.set(asset, current);

    cumulativeCost = 0;
    for (const [, val] of assetCosts) {
      cumulativeCost += val.cost;
    }

    dailyMap.set(date, {
      totalCost: cumulativeCost,
      realizedPnl: cumulativeRealizedPnl,
    });
  }

  return Array.from(dailyMap.entries()).map(([date, data]) => ({
    date,
    totalCost: data.totalCost,
    estimatedValue: data.totalCost + data.realizedPnl,
    realizedPnl: data.realizedPnl,
  }));
};

/**
 * Compute portfolio-level risk metrics: concentration score, volatility,
 * max drawdown, and largest position.
 */
export const computePortfolioRiskMetrics = (
  holdings: PortfolioHolding[],
  trades: Trade[],
): PortfolioRiskMetrics => {
  // Concentration score (inverted HHI)
  const hhi = holdings.reduce((sum, h) => sum + h.allocationPct ** 2, 0);
  const concentrationScore = Math.round(hhi / 100);

  // Volatility from daily value changes
  const closingTrades = trades.filter((t) => t.realizedPnl != null);
  const sortedTrades = [...closingTrades].sort(
    (a, b) => new Date(a.tradedAt).getTime() - new Date(b.tradedAt).getTime(),
  );

  const dailyPnl = new Map<string, number>();
  for (const trade of sortedTrades) {
    const date = trade.tradedAt.slice(0, 10);
    dailyPnl.set(date, (dailyPnl.get(date) ?? 0) + (trade.realizedPnl ?? 0));
  }

  const dailyReturns = Array.from(dailyPnl.values());
  let portfolioVolatility = 0;
  if (dailyReturns.length > 1) {
    const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
    const variance =
      dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (dailyReturns.length - 1);
    portfolioVolatility = Math.sqrt(variance) * Math.sqrt(252);
  }

  // Max drawdown from cumulative equity
  let equity = 10000;
  let peak = equity;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;

  for (const trade of sortedTrades) {
    equity += (trade.realizedPnl ?? 0) - trade.fee;
    peak = Math.max(peak, equity);
    const dd = peak - equity;
    const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
    maxDrawdown = Math.max(maxDrawdown, dd);
    maxDrawdownPct = Math.max(maxDrawdownPct, ddPct);
  }

  // Largest position
  const sorted = [...holdings].sort((a, b) => b.allocationPct - a.allocationPct);
  const largestPosition = sorted.length > 0 ? sorted[0]!.asset : '---';
  const largestPositionPct = sorted.length > 0 ? sorted[0]!.allocationPct : 0;

  return {
    concentrationScore,
    portfolioVolatility,
    maxDrawdown,
    maxDrawdownPct,
    largestPosition,
    largestPositionPct,
  };
};
