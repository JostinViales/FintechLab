// --- Enums / Literal Types ---

export type TradeSide = 'buy' | 'sell';
export type TradeSource = 'manual' | 'okx';
export type GoalPeriodType = 'weekly' | 'monthly';
export type TradingTab = 'overview' | 'trades' | 'analytics' | 'market' | 'ai' | 'settings';
export type TradingInstance = 'live' | 'demo';

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
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  avgHoldDurationMinutes: number;
  totalVolume: number;
}

export interface EquityCurvePoint {
  date: string;
  equity: number;
  drawdown: number;
  drawdownPct: number;
}

// --- Phase 3: Advanced Analytics Types ---

export interface TimeAnalysisBucket {
  trades: number;
  pnl: number;
  winRate: number;
}

export interface TimeAnalysis {
  byHour: Record<number, TimeAnalysisBucket>;
  byDayOfWeek: Record<number, TimeAnalysisBucket>;
  byMonth: Record<string, TimeAnalysisBucket>;
}

export interface HoldDuration {
  durationMinutes: number;
  pnl: number;
  symbol: string;
}

export interface PnlTimelinePoint {
  date: string;
  pnl: number;
  cumulativePnl: number;
}

export interface StrategyPerformanceData {
  strategy: string;
  color: string;
  stats: TradingStats;
}

export interface DrawdownPoint {
  date: string;
  drawdown: number;
  drawdownPct: number;
}

// --- Phase 4: AI & Risk Management Types ---

export interface TradingLimit {
  id: string;
  periodType: 'daily' | 'weekly' | 'monthly';
  maxTrades?: number;
  maxLoss?: number;
  maxCapital?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TradingLimitStatus {
  limit: TradingLimit;
  currentTrades: number;
  currentLoss: number;
  currentCapital: number;
  tradesExceeded: boolean;
  lossExceeded: boolean;
  capitalExceeded: boolean;
}

export interface PositionSizeResult {
  quantity: number;
  riskAmount: number;
  positionValue: number;
  riskRewardRatio: number;
}

export interface TradeSignalAnalysis {
  summary: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  keyLevels: { type: 'support' | 'resistance'; price: number; note: string }[];
  entryZone?: { low: number; high: number };
  stopLoss?: number;
  takeProfit?: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  factors: { name: string; severity: 'low' | 'medium' | 'high'; description: string }[];
  suggestions: string[];
}

export interface JournalSummary {
  overview: string;
  patterns: { pattern: string; frequency: string; impact: string }[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface RebalancingSuggestion {
  asset: string;
  currentPct: number;
  targetPct: number;
  action: 'buy' | 'sell' | 'hold';
  amount: number;
  reasoning: string;
}

// --- Filters ---

export interface TradeFilters {
  symbol?: string;
  side?: TradeSide;
  strategyTag?: string;
  dateFrom?: string;
  dateTo?: string;
}
