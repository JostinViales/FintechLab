// --- Enums / Literal Types ---

export type TradeSide = 'buy' | 'sell';
export type TradeSource = 'manual' | 'okx';
export type GoalPeriodType = 'weekly' | 'monthly';
export type TradingTab = 'overview' | 'trades' | 'analytics' | 'market' | 'ai' | 'settings';

// --- Persisted Entities ---

export interface Trade {
  id: string;
  symbol: string;
  side: TradeSide;
  price: number;
  quantity: number;
  total: number;
  fee: number;
  feeCurrency: string;
  realizedPnl?: number;
  strategyTag?: string;
  notes?: string;
  source: TradeSource;
  okxTradeId?: string;
  okxOrderId?: string;
  tradedAt: string;
  createdAt: string;
}

export interface AssetBalance {
  id: string;
  asset: string;
  totalQuantity: number;
  avgBuyPrice: number;
  totalCost: number;
  currentPrice?: number;
  currentValue?: number;
  unrealizedPnl?: number;
  unrealizedPnlPct?: number;
  allocationPct?: number;
  lastSyncedAt?: string;
}

export interface WatchlistItem {
  id: string;
  symbol: string;
  sortOrder: number;
  currentPrice?: number;
  change24h?: number;
  change24hPct?: number;
}

export interface TradingGoal {
  id: string;
  periodType: GoalPeriodType;
  periodKey: string;
  targetPnl: number;
  maxTrades?: number;
  maxCapital?: number;
}

export interface StrategyTag {
  id: string;
  name: string;
  color: string;
  description?: string;
}

// --- Computed / Derived (not persisted) ---

export interface TradingStats {
  totalTrades: number;
  totalRealizedPnl: number;
  totalFeesPaid: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  avgTradeSize: number;
  largestWin: number;
  largestLoss: number;
}

export interface EquityCurvePoint {
  date: string;
  equity: number;
  drawdown: number;
  drawdownPct: number;
}

// --- Filters ---

export interface TradeFilters {
  symbol?: string;
  side?: TradeSide;
  strategyTag?: string;
  dateFrom?: string;
  dateTo?: string;
}
