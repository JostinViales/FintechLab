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

// --- Account Balance (GET /api/v5/account/balance) ---

export interface OkxBalanceDetail {
  ccy: string;
  availBal: string;
  frozenBal: string;
  cashBal: string;
  eq: string;
  uTime: string;
  eqUsd: string;
  // Spot cost basis fields
  openAvgPx: string;
  accAvgPx: string;
  spotBal: string;
  spotUpl: string;
  spotUplRatio: string;
  totalPnl: string;
  totalPnlRatio: string;
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

// --- Position History (GET /api/v5/account/positions-history) ---

export interface OkxPositionHistory {
  instId: string;
  instType: string;
  mgnMode: string;
  posId: string;
  posSide: string;
  direction: string;
  openAvgPx: string;
  closeAvgPx: string;
  closeTotalPos: string;
  openMaxPos: string;
  realizedPnl: string;
  pnl: string;
  pnlRatio: string;
  fee: string;
  fundingFee: string;
  liqPenalty: string;
  settledPnl: string;
  type: string;
  lever: string;
  ccy: string;
  cTime: string;
  uTime: string;
  uly: string;
  triggerPx: string;
  nonSettleAvgPx: string;
}

// --- Open Positions (GET /api/v5/account/positions) ---

export interface OkxOpenPosition {
  instType: string;
  instId: string;
  posId: string;
  pos: string;
  posSide: string;
  avgPx: string;
  markPx: string;
  upl: string;
  uplRatio: string;
  lever: string;
  mgnMode: string;
  liqPx: string;
  notionalUsd: string;
  fee: string;
  fundingFee: string;
  realizedPnl: string;
  cTime: string;
  uTime: string;
  ccy: string;
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
