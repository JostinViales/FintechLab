import { supabase } from '@/services/supabase/client';
import type {
  OkxApiResponse,
  OkxFill,
  OkxAccountBalance,
  OkxFundingBalance,
  OkxSavingsBalance,
  OkxTicker,
  OkxSyncResult,
  OkxPositionHistory,
  OkxOpenPosition,
} from '@/types/okx';
import type { Trade, TradingInstance } from '@/types/trading';
import { loadTrades, saveTrade, upsertAssetBalance } from '@/services/supabase/trading';

// --- Demo mode state ---

let demoMode = false;

export const setDemoMode = (enabled: boolean): void => {
  demoMode = enabled;
};

export const isDemoMode = (): boolean => demoMode;

// --- Low-level proxy call ---

const callOkxProxy = async <T>(
  endpoint: string,
  method: 'GET' | 'POST',
  params?: Record<string, string>,
): Promise<OkxApiResponse<T> | null> => {
  const { data, error } = await supabase.functions.invoke('okx-proxy', {
    body: { endpoint, method, params, demo: demoMode },
  });

  if (error) {
    // Extract body from FunctionsHttpError for debugging
    const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
    if (ctx?.json) {
      try {
        const body = await ctx.json();
        console.error('OKX proxy error body:', body);
      } catch {
        console.error('OKX proxy error:', error.message);
      }
    } else {
      console.error('OKX proxy error:', error);
    }
    return null;
  }

  const response = data as { data: OkxApiResponse<T>; error?: string };
  if (response.error) {
    console.error('OKX proxy response error:', response.error);
    return null;
  }

  return response.data;
};

// --- Public API ---

export const fetchTradeHistory = async (params?: {
  instId?: string;
  after?: string;
  before?: string;
  limit?: string;
}): Promise<OkxFill[]> => {
  const queryParams: Record<string, string> = {};
  if (params?.instId) queryParams.instId = params.instId;
  if (params?.after) queryParams.after = params.after;
  if (params?.before) queryParams.before = params.before;
  if (params?.limit) queryParams.limit = params.limit;

  queryParams.instType = queryParams.instType ?? 'SPOT';
  const response = await callOkxProxy<OkxFill>(
    '/api/v5/trade/fills-history',
    'GET',
    queryParams,
  );

  if (!response || response.code !== '0') {
    console.error('Failed to fetch trade history:', response?.msg);
    return [];
  }

  return response.data;
};

export const fetchRecentFills = async (params?: {
  instId?: string;
  after?: string;
  before?: string;
  limit?: string;
}): Promise<OkxFill[]> => {
  const queryParams: Record<string, string> = {};
  if (params?.instId) queryParams.instId = params.instId;
  if (params?.after) queryParams.after = params.after;
  if (params?.before) queryParams.before = params.before;
  if (params?.limit) queryParams.limit = params.limit;

  queryParams.instType = queryParams.instType ?? 'SPOT';
  const response = await callOkxProxy<OkxFill>(
    '/api/v5/trade/fills',
    'GET',
    queryParams,
  );

  if (!response || response.code !== '0') {
    console.error('Failed to fetch recent fills:', response?.msg);
    return [];
  }

  return response.data;
};

export const fetchAccountBalance = async (): Promise<OkxAccountBalance | null> => {
  const response = await callOkxProxy<OkxAccountBalance>('/api/v5/account/balance', 'GET');

  if (!response || response.code !== '0') {
    console.error('Failed to fetch account balance:', response?.msg);
    return null;
  }

  return response.data[0] ?? null;
};

export const fetchTicker = async (instId: string): Promise<OkxTicker | null> => {
  const response = await callOkxProxy<OkxTicker>('/api/v5/market/ticker', 'GET', { instId });

  if (!response || response.code !== '0') {
    console.error('Failed to fetch ticker:', response?.msg);
    return null;
  }

  return response.data[0] ?? null;
};

export const fetchTickers = async (instType: string = 'SPOT'): Promise<OkxTicker[]> => {
  const response = await callOkxProxy<OkxTicker>('/api/v5/market/tickers', 'GET', { instType });

  if (!response || response.code !== '0') {
    console.error('Failed to fetch tickers:', response?.msg);
    return [];
  }

  return response.data;
};

export const fetchFundingBalances = async (): Promise<OkxFundingBalance[]> => {
  const response = await callOkxProxy<OkxFundingBalance>('/api/v5/asset/balances', 'GET');

  if (!response || response.code !== '0') {
    console.error('Failed to fetch funding balances:', response?.msg);
    return [];
  }

  return response.data;
};

export const fetchSavingsBalances = async (): Promise<OkxSavingsBalance[]> => {
  const response = await callOkxProxy<OkxSavingsBalance>(
    '/api/v5/finance/savings/balance',
    'GET',
  );

  if (!response || response.code !== '0') {
    console.error('Failed to fetch savings balances:', response?.msg);
    return [];
  }

  return response.data;
};

export const fetchPositionHistory = async (params?: {
  instType?: string;
  instId?: string;
  after?: string;
  before?: string;
  limit?: string;
}): Promise<OkxPositionHistory[]> => {
  const queryParams: Record<string, string> = {};
  if (params?.instType) queryParams.instType = params.instType;
  if (params?.instId) queryParams.instId = params.instId;
  if (params?.after) queryParams.after = params.after;
  if (params?.before) queryParams.before = params.before;
  if (params?.limit) queryParams.limit = params.limit;

  const response = await callOkxProxy<OkxPositionHistory>(
    '/api/v5/account/positions-history',
    'GET',
    queryParams,
  );

  if (!response || response.code !== '0') {
    console.error('Failed to fetch position history:', response?.msg);
    return [];
  }

  return response.data;
};

export const fetchOpenPositions = async (params?: {
  instType?: string;
  instId?: string;
}): Promise<OkxOpenPosition[]> => {
  const queryParams: Record<string, string> = {};
  if (params?.instType) queryParams.instType = params.instType;
  if (params?.instId) queryParams.instId = params.instId;

  const response = await callOkxProxy<OkxOpenPosition>(
    '/api/v5/account/positions',
    'GET',
    queryParams,
  );

  if (!response || response.code !== '0') {
    console.error('Failed to fetch open positions:', response?.msg);
    return [];
  }

  return response.data;
};

export const testConnection = async (): Promise<boolean> => {
  const balance = await fetchAccountBalance();
  return balance !== null;
};

// --- Store Credentials ---

export const storeCredentials = async (
  apiKey: string,
  secretKey: string,
  passphrase: string,
  demo?: boolean,
): Promise<boolean> => {
  const { error } = await supabase.functions.invoke('okx-proxy', {
    body: { action: 'store-credentials', apiKey, secretKey, passphrase, demo: demo ?? demoMode },
  });

  if (error) {
    const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
    if (ctx?.json) {
      try {
        const body = await ctx.json();
        console.error('Store credentials error body:', body);
      } catch {
        console.error('Failed to store credentials:', error.message);
      }
    } else {
      console.error('Failed to store credentials:', error);
    }
    return false;
  }

  return true;
};

// --- Sync Logic ---

const CLOSE_TYPE_LABELS: Record<string, string> = {
  '1': 'Partial close',
  '2': 'Close all',
  '3': 'Liquidation',
  '4': 'Partial liquidation',
  '5': 'ADL (partial)',
  '6': 'ADL (full)',
};

function mapOkxPositionToTrade(
  position: OkxPositionHistory,
): Omit<Trade, 'id' | 'createdAt' | 'total'> {
  const direction = (position.direction || position.posSide || 'net') as Trade['direction'];

  return {
    symbol: position.instId,
    side: 'sell',
    price: Number(position.closeAvgPx),
    quantity: Number(position.closeTotalPos),
    fee: Math.abs(Number(position.fee)),
    feeCurrency: position.ccy || 'USDT',
    realizedPnl: Number(position.realizedPnl),
    source: 'okx',
    okxPosId: position.posId,
    direction,
    openAvgPx: Number(position.openAvgPx),
    closeAvgPx: Number(position.closeAvgPx),
    fundingFee: Math.abs(Number(position.fundingFee)),
    liqPenalty: Math.abs(Number(position.liqPenalty)),
    pnlRatio: Number(position.pnlRatio),
    leverage: position.lever,
    marginMode: position.mgnMode as Trade['marginMode'],
    openTime: new Date(Number(position.cTime)).toISOString(),
    closeTime: new Date(Number(position.uTime)).toISOString(),
    tradedAt: new Date(Number(position.uTime)).toISOString(),
    notes: CLOSE_TYPE_LABELS[position.type] ?? undefined,
  };
}

export const syncTradesFromOkx = async (
  instance: TradingInstance = 'live',
): Promise<OkxSyncResult> => {
  const result: OkxSyncResult = { imported: 0, skipped: 0, errors: [] };

  // Load existing OKX position IDs for dedup
  const existingTrades = await loadTrades(undefined, instance);
  const existingPosIds = new Set(
    existingTrades.filter((t) => t.okxPosId).map((t) => t.okxPosId),
  );

  // Paginated fetch of closed positions (cursor = uTime of last record)
  let after: string | undefined;
  for (let page = 0; page < 10; page++) {
    const positions = await fetchPositionHistory({ limit: '100', after });
    if (positions.length === 0) break;

    for (const position of positions) {
      if (existingPosIds.has(position.posId)) {
        result.skipped++;
        continue;
      }

      const tradeData = mapOkxPositionToTrade(position);
      const saved = await saveTrade(tradeData, instance);

      if (saved) {
        result.imported++;
        existingPosIds.add(position.posId);
      } else {
        result.errors.push(`Failed to save position ${position.posId}`);
      }
    }

    // Pagination: use uTime of the last record as cursor
    after = positions[positions.length - 1]?.uTime ?? '';
    if (positions.length < 100) break;
  }

  return result;
};

export const syncBalancesFromOkx = async (
  instance: TradingInstance = 'live',
): Promise<boolean> => {
  const now = new Date().toISOString();

  // Fetch all three account types in parallel (safe since outer syncs are sequential)
  const [tradingBalance, fundingBalances, savingsBalances] = await Promise.all([
    fetchAccountBalance(),
    fetchFundingBalances().catch(() => [] as OkxFundingBalance[]),
    fetchSavingsBalances().catch(() => [] as OkxSavingsBalance[]),
  ]);

  // At minimum, trading balance must succeed
  if (!tradingBalance) return false;

  // Upsert Trading account balances (now with cost basis from OKX)
  for (const detail of tradingBalance.details) {
    const totalBal = Number(detail.cashBal) || 0;
    if (totalBal <= 0) continue;

    const avgBuyPrice = Number(detail.openAvgPx) || 0;
    const totalCost = avgBuyPrice > 0 ? totalBal * avgBuyPrice : 0;

    await upsertAssetBalance(
      {
        asset: detail.ccy,
        totalQuantity: totalBal,
        avgBuyPrice,
        totalCost,
        lastSyncedAt: now,
        accountType: 'trading',
      },
      instance,
    );
  }

  // Upsert Funding account balances
  for (const fb of fundingBalances) {
    const totalBal = Number(fb.bal) || 0;
    if (totalBal <= 0) continue;

    await upsertAssetBalance(
      {
        asset: fb.ccy,
        totalQuantity: totalBal,
        avgBuyPrice: 0,
        totalCost: 0,
        lastSyncedAt: now,
        accountType: 'funding',
      },
      instance,
    );
  }

  // Upsert Earn (Simple Earn / Savings) balances with earnings
  for (const sb of savingsBalances) {
    const totalAmt = Number(sb.amt) || 0;
    if (totalAmt <= 0) continue;

    await upsertAssetBalance(
      {
        asset: sb.ccy,
        totalQuantity: totalAmt,
        avgBuyPrice: 0,
        totalCost: 0,
        lastSyncedAt: now,
        accountType: 'earn',
        earnings: Number(sb.earnings) || 0,
      },
      instance,
    );
  }

  return true;
};
