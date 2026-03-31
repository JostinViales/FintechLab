import { backend } from '@/wmill';
import type {
  OkxApiResponse,
  OkxAccountBalance,
  OkxFundingBalance,
  OkxSavingsBalance,
  OkxTicker,
  OkxSyncResult,
  OkxPositionHistory,
  OkxOpenPosition,
} from '@/types/okx';
import type { TradingInstance } from '@/types/trading';

// --- Demo mode state ---

let demoMode = false;

export const setDemoMode = (enabled: boolean): void => {
  demoMode = enabled;
};

export const isDemoMode = (): boolean => demoMode;

// --- Low-level proxy call (via Windmill backend) ---

const callOkxProxy = async <T>(
  endpoint: string,
  method: 'GET' | 'POST',
  params?: Record<string, string>,
): Promise<OkxApiResponse<T> | null> => {
  try {
    const result = await backend.okx_proxy({
      endpoint,
      method,
      params: params ?? {},
      demo: demoMode,
    });

    const response = result as { data: OkxApiResponse<T>; error?: string };
    if (response.error) {
      console.error('OKX proxy response error:', response.error);
      return null;
    }

    return response.data;
  } catch (error) {
    console.error('OKX proxy error:', error);
    return null;
  }
};

// --- Public API ---

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

// --- Store Credentials (via Windmill backend) ---

export const storeCredentials = async (
  apiKey: string,
  secretKey: string,
  passphrase: string,
  demo?: boolean,
): Promise<boolean> => {
  try {
    const result = await backend.okx_proxy({
      action: 'store-credentials',
      api_key: apiKey,
      secret_key: secretKey,
      passphrase,
      demo: demo ?? demoMode,
    });

    const response = result as { success?: boolean; error?: string };
    if (response.error) {
      console.error('Store credentials error:', response.error);
      return false;
    }

    return response.success === true;
  } catch (error) {
    console.error('Failed to store credentials:', error);
    return false;
  }
};

// --- Sync via Windmill backend ---

export const syncTradesFromOkx = async (
  instance: TradingInstance = 'live',
): Promise<OkxSyncResult> => {
  try {
    const result = await backend.sync_trades({ instance });
    return result as OkxSyncResult;
  } catch (error) {
    console.error('Trade sync error:', error);
    return { imported: 0, skipped: 0, errors: ['Sync failed: ' + String(error)] };
  }
};

export const syncBalancesFromOkx = async (
  instance: TradingInstance = 'live',
): Promise<boolean> => {
  try {
    const result = await backend.sync_balances({ instance });
    return (result as { success?: boolean }).success !== false;
  } catch (error) {
    console.error('Balance sync error:', error);
    return false;
  }
};
