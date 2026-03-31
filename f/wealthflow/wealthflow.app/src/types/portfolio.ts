// --- Portfolio Types ---

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  realizedPnl: number;
  change24h: number;
  change24hPct: number;
  assetCount: number;
}

export interface PortfolioHolding {
  asset: string;
  totalQuantity: number;
  avgBuyPrice: number;
  totalCost: number;
  currentPrice: number;
  currentValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  allocationPct: number;
  firstBuyDate: string;
  holdingDurationDays: number;
  tradeCount: number;
  change24h: number;
  change24hPct: number;
}

export interface DiversificationAnalysis {
  score: number;
  herfindahlIndex: number;
  topAssetPct: number;
  concentrationRisks: ConcentrationRisk[];
}

export interface ConcentrationRisk {
  asset: string;
  allocationPct: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  message: string;
}

export interface AssetHoldingDuration {
  asset: string;
  firstBuyDate: string;
  lastBuyDate: string;
  holdingDays: number;
  totalQuantity: number;
  allocationPct: number;
}

export interface PortfolioValuePoint {
  date: string;
  totalCost: number;
  estimatedValue: number;
  realizedPnl: number;
}

export interface PortfolioRiskMetrics {
  concentrationScore: number;
  portfolioVolatility: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  largestPosition: string;
  largestPositionPct: number;
}
