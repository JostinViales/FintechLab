// --- Edge Function Request/Response ---

export interface OkxProxyRequest {
  endpoint: string;
  method: 'GET' | 'POST';
  params?: Record<string, string>;
}

export interface OkxProxyResponse<T = unknown> {
  data: T;
  error?: string;
}

// --- OKX API Response Envelope ---

export interface OkxApiResponse<T> {
  code: string;
  msg: string;
  data: T[];
}

// --- Trade History (GET /api/v5/trade/fills-history) ---

export interface OkxFill {
  instId: string;
  tradeId: string;
  ordId: string;
  side: 'buy' | 'sell';
  fillPx: string;
  fillSz: string;
  fee: string;
  feeCcy: string;
  ts: string;
  instType: string;
}

// --- Account Balance (GET /api/v5/account/balance) ---

export interface OkxBalanceDetail {
  ccy: string;
  availBal: string;
  frozenBal: string;
  bal: string;
  uTime: string;
}

export interface OkxAccountBalance {
  totalEq: string;
  details: OkxBalanceDetail[];
}

// --- Market Ticker (GET /api/v5/market/ticker) ---

export interface OkxTicker {
  instId: string;
  last: string;
  lastSz: string;
  askPx: string;
  askSz: string;
  bidPx: string;
  bidSz: string;
  open24h: string;
  high24h: string;
  low24h: string;
  vol24h: string;
  volCcy24h: string;
  ts: string;
}

// --- WebSocket Types ---

export interface OkxWsMessage {
  arg: { channel: string; instId: string };
  data: OkxTicker[];
}

export interface OkxWsSubscription {
  op: 'subscribe' | 'unsubscribe';
  args: Array<{ channel: string; instId: string }>;
}

// --- Funding Account Balance (GET /api/v5/asset/balances) ---

export interface OkxFundingBalance {
  ccy: string;
  bal: string;
  availBal: string;
  frozenBal: string;
}

// --- Simple Earn / Savings Balance (GET /api/v5/finance/savings/balance) ---

export interface OkxSavingsBalance {
  ccy: string;
  amt: string;
  earnings: string;
  rate: string;
  loanAmt: string;
  pendingAmt: string;
  redemptAmt: string;
}

// --- Sync Result ---

export interface OkxSyncResult {
  imported: number;
  skipped: number;
  errors: string[];
}

// --- Store Credentials Request ---

export interface OkxStoreCredentialsRequest {
  action: 'store-credentials';
  apiKey: string;
  secretKey: string;
  passphrase: string;
}
