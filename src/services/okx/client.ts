import { supabase } from '@/services/supabase/client';
import type {
  OkxApiResponse,
  OkxFill,
  OkxAccountBalance,
  OkxTicker,
  OkxSyncResult,
} from '@/types/okx';
import type { Trade } from '@/types/trading';
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

export const testConnection = async (): Promise<boolean> => {
  const balance = await fetchAccountBalance();
  return balance !== null;
};

// --- Store Credentials ---

export const storeCredentials = async (
  apiKey: string,
  secretKey: string,
  passphrase: string,
): Promise<boolean> => {
  const { error } = await supabase.functions.invoke('okx-proxy', {
    body: { action: 'store-credentials', apiKey, secretKey, passphrase, demo: demoMode },
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

function mapOkxFillToTrade(fill: OkxFill): Omit<Trade, 'id' | 'createdAt' | 'total'> {
  return {
    symbol: fill.instId,
    side: fill.side,
    price: Number(fill.fillPx),
    quantity: Number(fill.fillSz),
    fee: Math.abs(Number(fill.fee)),
    feeCurrency: fill.feeCcy,
    source: 'okx',
    okxTradeId: fill.tradeId,
    okxOrderId: fill.ordId,
    tradedAt: new Date(Number(fill.ts)).toISOString(),
  };
}

async function importFills(
  fills: OkxFill[],
  existingOkxIds: Set<string | undefined>,
  result: OkxSyncResult,
): Promise<void> {
  for (const fill of fills) {
    if (existingOkxIds.has(fill.tradeId)) {
      result.skipped++;
      continue;
    }

    const tradeData = mapOkxFillToTrade(fill);
    const saved = await saveTrade(tradeData);

    if (saved) {
      result.imported++;
      existingOkxIds.add(fill.tradeId);
    } else {
      result.errors.push(`Failed to save trade ${fill.tradeId}`);
    }
  }
}

export const syncTradesFromOkx = async (): Promise<OkxSyncResult> => {
  const result: OkxSyncResult = { imported: 0, skipped: 0, errors: [] };

  // Load existing OKX trade IDs for dedup
  const existingTrades = await loadTrades({ source: 'okx' } as Parameters<typeof loadTrades>[0]);
  const existingOkxIds = new Set(
    existingTrades.filter((t) => t.okxTradeId).map((t) => t.okxTradeId),
  );

  // 1. Try recent fills first (last 3 days) — /api/v5/trade/fills
  let after: string | undefined;
  for (let page = 0; page < 5; page++) {
    const fills = await fetchRecentFills({ limit: '100', after });
    if (fills.length === 0) break;
    await importFills(fills, existingOkxIds, result);
    after = fills[fills.length - 1]?.tradeId ?? '';
    if (fills.length < 100) break;
  }

  // 2. Also try historical fills (older than 3 days) — /api/v5/trade/fills-history
  after = undefined;
  for (let page = 0; page < 5; page++) {
    const fills = await fetchTradeHistory({ limit: '100', after });
    if (fills.length === 0) break;
    await importFills(fills, existingOkxIds, result);
    after = fills[fills.length - 1]?.tradeId ?? '';
    if (fills.length < 100) break;
  }

  return result;
};

export const syncBalancesFromOkx = async (): Promise<boolean> => {
  const balance = await fetchAccountBalance();
  if (!balance) return false;

  for (const detail of balance.details) {
    const totalBal = Number(detail.bal);
    if (totalBal <= 0) continue;

    await upsertAssetBalance({
      asset: detail.ccy,
      totalQuantity: totalBal,
      avgBuyPrice: 0,
      totalCost: 0,
      lastSyncedAt: new Date().toISOString(),
    });
  }

  return true;
};
