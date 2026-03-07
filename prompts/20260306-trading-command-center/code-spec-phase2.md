---
slug: "20260306-trading-command-center"
title: "Trading Command Center — Phase 2: OKX API Integration"
spec_type: code-spec
project: WF
domain: [trading, api-integration]
source_repo: ""
notion_url: ""
gh_issue:
gh_prs: []
status: draft
published_at:
---

# Phase 2: OKX API Integration — Code Spec

## Persona

You are a senior full-stack engineer specializing in React 19 + TypeScript financial applications with real-time data integration. You are deeply familiar with the OKX V5 REST/WebSocket API, Supabase Edge Functions (Deno runtime), and the WealthFlow codebase conventions (Supabase CRUD with row mappers, named exports, Tailwind + CSS custom properties, `@/` path aliases).

## Task

Implement **Phase 2 of the Trading Command Center** — OKX exchange integration. This phase connects WealthFlow to OKX (spot) via a secure server-side proxy, adds trade auto-import with deduplication, introduces real-time market data via WebSocket, and builds a live watchlist and connection settings UI.

### Deliverables

1. **Supabase Edge Function** — `okx-proxy` that securely signs and proxies OKX API requests
2. **OKX REST client** — Frontend service calling the Edge Function
3. **OKX WebSocket service** — Direct browser connection to OKX public channels
4. **OKX type definitions** — Request/response types for OKX API
5. **WatchlistPanel component** — Live ticker sidebar with real-time prices
6. **OkxConnectionSettings component** — API key management + sync controls
7. **TradingPage updates** — Wire up Market tab, Settings tab OKX section, live prices in Overview

### Prerequisites (Phase 1 — Complete)

- 5 Supabase tables created: `trades`, `asset_balances`, `watchlist`, `trading_goals`, `strategy_tags`
- TypeScript types defined in `src/types/trading.ts`
- Supabase trading CRUD in `src/services/supabase/trading.ts`
- Analytics engine in `src/lib/tradingAnalytics.ts`
- 8 UI components in `src/components/trading/`
- TradingPage with tab navigation (Overview, Trades, Settings)

---

## Steps

### Step 1: OKX API Type Definitions

**File: `src/types/okx.ts`** (new)

Define TypeScript types for OKX V5 API request/response shapes. These map the OKX JSON responses to typed structures.

```typescript
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
  code: string; // "0" = success
  msg: string;
  data: T[];
}

// --- Trade History (GET /api/v5/trade/fills-history) ---

export interface OkxFill {
  instId: string;    // e.g. "BTC-USDT"
  tradeId: string;   // Unique trade ID
  ordId: string;     // Order ID
  side: 'buy' | 'sell';
  fillPx: string;    // Fill price (string number)
  fillSz: string;    // Fill size (string number)
  fee: string;       // Fee amount (negative = paid)
  feeCcy: string;    // Fee currency
  ts: string;        // Timestamp (ms since epoch)
  instType: string;  // "SPOT"
}

// --- Account Balance (GET /api/v5/account/balance) ---

export interface OkxBalanceDetail {
  ccy: string;       // Currency (e.g. "BTC")
  availBal: string;  // Available balance
  frozenBal: string; // Frozen balance
  bal: string;       // Total balance
  uTime: string;     // Update time (ms)
}

export interface OkxAccountBalance {
  totalEq: string;   // Total equity in USD
  details: OkxBalanceDetail[];
}

// --- Market Ticker (GET /api/v5/market/ticker) ---

export interface OkxTicker {
  instId: string;     // e.g. "BTC-USDT"
  last: string;       // Last traded price
  lastSz: string;     // Last traded size
  askPx: string;      // Best ask price
  askSz: string;
  bidPx: string;      // Best bid price
  bidSz: string;
  open24h: string;    // 24h open price
  high24h: string;
  low24h: string;
  vol24h: string;     // 24h volume (base currency)
  volCcy24h: string;  // 24h volume (quote currency)
  ts: string;         // Timestamp (ms)
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

// --- Sync Result ---

export interface OkxSyncResult {
  imported: number;
  skipped: number;
  errors: string[];
}
```

**Update `src/types/index.ts`** — add `export * from './okx'` to barrel exports.

---

### Step 2: Supabase Edge Function — OKX Proxy

**File: `supabase/functions/okx-proxy/index.ts`** (new)

This is the security-critical component. OKX API keys never reach the browser. The Edge Function reads credentials from Supabase Vault, signs requests using HMAC-SHA256, and proxies only whitelisted endpoints.

**Runtime:** Deno (Supabase Edge Functions)

```typescript
// Key implementation details:

// 1. CORS handling — allow requests from your domain
// 2. Auth — verify Supabase JWT from Authorization header
// 3. Whitelist — only allow specific OKX endpoints
// 4. Vault — read OKX credentials from Supabase Vault secrets
// 5. Signing — HMAC-SHA256 signature per OKX V5 spec
// 6. Proxy — forward signed request to OKX, return response
```

**Whitelisted Endpoints:**

| OKX Endpoint | Method | Purpose |
|---|---|---|
| `/api/v5/trade/fills-history` | GET | Import trade history |
| `/api/v5/account/balance` | GET | Sync account balances |
| `/api/v5/market/ticker` | GET | Single ticker price |
| `/api/v5/market/tickers` | GET | Multiple ticker prices |

**OKX V5 Request Signing Algorithm:**

```
timestamp = ISO 8601 UTC (e.g., "2026-03-06T12:00:00.000Z")
prehash = timestamp + method + requestPath + body (or "")
signature = Base64(HMAC-SHA256(secretKey, prehash))

Headers:
  OK-ACCESS-KEY: apiKey
  OK-ACCESS-SIGN: signature
  OK-ACCESS-TIMESTAMP: timestamp
  OK-ACCESS-PASSPHRASE: passphrase
  Content-Type: application/json
```

**Vault Secret Names:**

| Secret Name | Value |
|---|---|
| `okx_api_key` | OKX API key |
| `okx_secret_key` | OKX secret key |
| `okx_passphrase` | OKX passphrase |

**How to store in Vault (one-time setup, document in README):**

```sql
SELECT vault.create_secret('your-api-key', 'okx_api_key');
SELECT vault.create_secret('your-secret-key', 'okx_secret_key');
SELECT vault.create_secret('your-passphrase', 'okx_passphrase');
```

**How Edge Function reads from Vault:**

```typescript
const { data: secrets } = await supabaseAdmin
  .from('vault.decrypted_secrets')
  .select('name, decrypted_secret')
  .in('name', ['okx_api_key', 'okx_secret_key', 'okx_passphrase']);
```

**Error Handling:**
- Missing Vault secrets → 500 with `"OKX credentials not configured"`
- Non-whitelisted endpoint → 403 with `"Endpoint not allowed"`
- OKX API error → forward OKX error code and message
- Missing/invalid JWT → 401

**CORS Headers:**
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // tighten in production
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

---

### Step 3: OKX REST Client (Frontend)

**File: `src/services/okx/client.ts`** (replace placeholder)

All functions call the Supabase Edge Function, never OKX directly. Follow the pattern from `src/services/supabase/storage.ts` for error handling (log + return null/empty).

```typescript
import { supabase } from '@/services/supabase/client';
import type {
  OkxProxyRequest,
  OkxApiResponse,
  OkxFill,
  OkxAccountBalance,
  OkxTicker,
  OkxSyncResult,
} from '@/types/okx';
import type { Trade } from '@/types/trading';

// --- Low-level proxy call ---

const callOkxProxy = async <T>(
  request: OkxProxyRequest
): Promise<OkxApiResponse<T> | null> => {
  // 1. Get current session for JWT
  // 2. Call supabase.functions.invoke('okx-proxy', { body: request })
  // 3. Parse response, handle errors
  // 4. Return typed OkxApiResponse<T> or null on error
};

// --- Public API ---

export const fetchTradeHistory = async (params?: {
  instId?: string;
  after?: string;
  before?: string;
  limit?: string;
}): Promise<OkxFill[]> => {
  // GET /api/v5/trade/fills-history
  // Returns array of fills
};

export const fetchAccountBalance = async (): Promise<OkxAccountBalance | null> => {
  // GET /api/v5/account/balance
  // Returns account balance with details per currency
};

export const fetchTicker = async (instId: string): Promise<OkxTicker | null> => {
  // GET /api/v5/market/ticker?instId=BTC-USDT
  // Returns single ticker
};

export const fetchTickers = async (instType: string = 'SPOT'): Promise<OkxTicker[]> => {
  // GET /api/v5/market/tickers?instType=SPOT
  // Returns all spot tickers
};

export const testConnection = async (): Promise<boolean> => {
  // Call fetchAccountBalance
  // Return true if successful, false on error
  // Used by OkxConnectionSettings "Test Connection" button
};

// --- Sync Logic ---

export const syncTradesFromOkx = async (): Promise<OkxSyncResult> => {
  // 1. Fetch trade fills from OKX (paginate: OKX returns max 100 per request)
  //    - Use `after` param for pagination (cursor-based)
  //    - Fetch until no more data or reasonable limit (e.g., 500 trades)
  // 2. For each fill, map to Trade shape:
  //    - symbol: fill.instId
  //    - side: fill.side
  //    - price: Number(fill.fillPx)
  //    - quantity: Number(fill.fillSz)
  //    - fee: Math.abs(Number(fill.fee))
  //    - feeCurrency: fill.feeCcy
  //    - source: 'okx'
  //    - okxTradeId: fill.tradeId
  //    - okxOrderId: fill.ordId
  //    - tradedAt: new Date(Number(fill.ts)).toISOString()
  // 3. Deduplicate: check existing trades where source='okx' and okxTradeId matches
  //    - Use bulkSaveTrades for new trades only
  // 4. After import, call recalculateAssetBalances()
  // 5. Return { imported, skipped, errors }
};

export const syncBalancesFromOkx = async (): Promise<boolean> => {
  // 1. Fetch account balance from OKX
  // 2. For each non-zero balance, upsert into asset_balances
  // 3. Set lastSyncedAt to now
  // 4. Return success/failure
};
```

**Pagination Detail:**

OKX `fills-history` uses cursor pagination:
- First request: no `after` param
- Subsequent requests: `after` = last `tradeId` from previous response
- Stop when response returns fewer than `limit` items or empty

---

### Step 4: OKX WebSocket Service

**File: `src/services/okx/websocket.ts`** (new)

Direct browser connection to OKX public WebSocket — no auth needed for public channels (tickers). This provides real-time price updates for the watchlist and held assets.

**Endpoint:** `wss://ws.okx.com:8443/ws/v5/public`

```typescript
import type { OkxTicker, OkxWsMessage, OkxWsSubscription } from '@/types/okx';

type TickerCallback = (ticker: OkxTicker) => void;

export class OkxWebSocketService {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, Set<TickerCallback>> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private pingIntervalId: ReturnType<typeof setInterval> | null = null;
  private isManualDisconnect: boolean = false;

  // --- Connection Management ---

  connect(): void {
    // 1. Create WebSocket to OKX public endpoint
    // 2. Set up event handlers: onopen, onmessage, onclose, onerror
    // 3. On open: reset reconnect attempts, start ping interval, re-subscribe existing
    // 4. On message: parse JSON, route to callbacks
    // 5. On close: attempt reconnect (if not manual disconnect)
    // 6. On error: log, WebSocket will fire onclose next
  }

  disconnect(): void {
    // 1. Set isManualDisconnect = true
    // 2. Clear ping interval
    // 3. Clear reconnect timeout
    // 4. Close WebSocket
    // 5. Clear all subscriptions
  }

  // --- Subscriptions ---

  subscribeTicker(instId: string, callback: TickerCallback): void {
    // 1. Add callback to subscriptions map for instId
    // 2. If WebSocket connected, send subscribe message:
    //    { op: 'subscribe', args: [{ channel: 'tickers', instId }] }
  }

  unsubscribeTicker(instId: string): void {
    // 1. Remove from subscriptions map
    // 2. If WebSocket connected, send unsubscribe message
  }

  // --- Private Methods ---

  private handleMessage(event: MessageEvent): void {
    // 1. Parse JSON
    // 2. Ignore ping/pong frames and subscription confirmations
    // 3. If data has arg.channel === 'tickers':
    //    - Extract instId from arg
    //    - Get callbacks from subscriptions map
    //    - Call each callback with ticker data
  }

  private reconnect(): void {
    // 1. If manual disconnect or max attempts reached, stop
    // 2. Exponential backoff: delay = min(1000 * 2^attempts, 30000)
    // 3. setTimeout -> connect()
    // 4. Increment reconnectAttempts
  }

  private startPing(): void {
    // OKX requires ping every 30 seconds to keep connection alive
    // Send 'ping' text frame every 25 seconds
    // If no pong received, reconnect
  }

  private resubscribeAll(): void {
    // On reconnect, re-subscribe all existing subscriptions
    // Batch into single subscribe message
  }

  // --- State ---

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get subscribedSymbols(): string[] {
    return Array.from(this.subscriptions.keys());
  }
}

// Singleton instance
export const okxWebSocket = new OkxWebSocketService();
```

**Key Behaviors:**
- Ping/pong every 25s (OKX disconnects after 30s idle)
- Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)
- Max 10 reconnect attempts, then stop
- Re-subscribe all tickers on reconnect
- Singleton export for app-wide usage

---

### Step 5: WatchlistPanel Component

**File: `src/components/trading/WatchlistPanel.tsx`** (new)

Live ticker panel showing real-time prices for watchlist items. Uses the WebSocket service for price updates.

**Props:**
```typescript
interface WatchlistPanelProps {
  watchlist: WatchlistItem[];
  onAdd: (symbol: string) => void;
  onRemove: (id: string) => void;
}
```

**Features:**
- Display each watchlist item with: symbol, current price, 24h change, 24h change %
- Green/red coloring for positive/negative 24h change
- "Add Symbol" input with autocomplete (common pairs: BTC-USDT, ETH-USDT, SOL-USDT, etc.)
- Remove button per item
- Connection status indicator (green dot = connected, red = disconnected)
- Price flash animation on update (brief green/red highlight)

**Lifecycle:**
```typescript
useEffect(() => {
  okxWebSocket.connect();

  // Subscribe to each watchlist symbol
  watchlist.forEach((item) => {
    okxWebSocket.subscribeTicker(item.symbol, (ticker) => {
      // Update local state with new price
      // Compute 24h change from ticker.open24h and ticker.last
    });
  });

  return () => {
    // Unsubscribe all on unmount
    // Don't disconnect — other components may use it
    watchlist.forEach((item) => {
      okxWebSocket.unsubscribeTicker(item.symbol);
    });
  };
}, [watchlist]);
```

**Styling:**
- Use `var(--bg-secondary)` for panel background
- Use `var(--border-default)` for item separators
- Price up: `text-emerald-500`, Price down: `text-red-500`
- Flash animation: CSS transition on background-color (200ms)
- lucide-react icons: `Plus`, `X`, `Wifi`, `WifiOff`

**Common Trading Pairs (for autocomplete suggestions):**
```typescript
const COMMON_PAIRS = [
  'BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'XRP-USDT',
  'DOGE-USDT', 'ADA-USDT', 'AVAX-USDT', 'DOT-USDT',
  'LINK-USDT', 'MATIC-USDT', 'UNI-USDT', 'ATOM-USDT',
  'LTC-USDT', 'NEAR-USDT', 'ARB-USDT', 'OP-USDT',
];
```

---

### Step 6: OkxConnectionSettings Component

**File: `src/components/trading/OkxConnectionSettings.tsx`** (new)

Settings panel for OKX API configuration, connection testing, and trade sync. This component does NOT store API keys in the browser — keys are sent directly to a separate Edge Function endpoint that stores them in Vault.

**Props:**
```typescript
interface OkxConnectionSettingsProps {
  onSyncComplete: () => void; // Callback to refresh trades after sync
}
```

**Sections:**

1. **Connection Status**
   - Status indicator: Connected / Not Configured / Error
   - Last sync timestamp (from most recent trade with source='okx')
   - WebSocket status indicator

2. **API Key Setup** (collapsible)
   - Input fields: API Key, Secret Key, Passphrase
   - All inputs `type="password"` with show/hide toggle
   - "Save to Vault" button — calls Edge Function to store in Vault
   - "Test Connection" button — calls `testConnection()`, shows success/failure toast
   - Note: "Keys are stored server-side in encrypted Vault. They never touch the browser after setup."

3. **Sync Controls**
   - "Sync Trades" button — calls `syncTradesFromOkx()`
   - "Sync Balances" button — calls `syncBalancesFromOkx()`
   - Progress indicator during sync
   - Result display: "Imported 23 trades, skipped 5 duplicates"
   - Error list if any trades failed to import

**Edge Function for Vault Storage:**

Add a second Edge Function route or extend `okx-proxy` to handle credential storage:

```
POST /okx-proxy (body: { action: 'store-credentials', apiKey, secretKey, passphrase })
→ Stores in Supabase Vault, returns success/failure
```

**Security Note:** The "store-credentials" action must verify the Supabase JWT and only allow the authenticated user to store their own keys. In the MVP, this is single-user, so JWT verification is sufficient.

---

### Step 7: Live Prices in Asset Balances

**Update: `src/components/trading/AssetBalancesTable.tsx`**

Enhance the existing asset balances table to show live price data from WebSocket:

**Changes:**
- Accept new prop: `livePrices: Map<string, OkxTicker>`
- For each asset, look up `livePrices.get(asset + '-USDT')`
- Compute and display:
  - **Current Price** — from live ticker
  - **Current Value** — `totalQuantity * currentPrice`
  - **Unrealized P&L** — `currentValue - totalCost`
  - **Unrealized P&L %** — `(unrealizedPnl / totalCost) * 100`
- Color P&L green/red based on sign
- Flash price on update

**New Columns (added to existing table):**

| Column | Source | Format |
|---|---|---|
| Current Price | `livePrices` | `formatCrypto()` |
| Current Value | computed | `formatCurrency()` |
| Unrealized P&L | computed | `formatPnl()` |
| Unrealized P&L % | computed | `formatPnlPct()` |

---

### Step 8: TradingPage Integration

**Update: `src/features/trading/TradingPage.tsx`**

Wire up new Phase 2 components and state.

**New State:**
```typescript
const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
const [livePrices, setLivePrices] = useState<Map<string, OkxTicker>>(new Map());
```

**Data Loading (add to existing `fetchAll`):**
```typescript
const watchlistData = await loadWatchlist();
setWatchlist(watchlistData);
```

**WebSocket Integration:**
```typescript
useEffect(() => {
  okxWebSocket.connect();

  // Subscribe to watchlist symbols
  const allSymbols = new Set<string>();
  watchlist.forEach((w) => allSymbols.add(w.symbol));
  // Also subscribe to held asset symbols
  assetBalances.forEach((a) => {
    if (a.asset !== 'USDT') allSymbols.add(a.asset + '-USDT');
  });

  allSymbols.forEach((symbol) => {
    okxWebSocket.subscribeTicker(symbol, (ticker) => {
      setLivePrices((prev) => {
        const next = new Map(prev);
        next.set(ticker.instId, ticker);
        return next;
      });
    });
  });

  return () => {
    allSymbols.forEach((symbol) => okxWebSocket.unsubscribeTicker(symbol));
  };
}, [watchlist, assetBalances]);
```

**Tab Updates:**

| Tab | Change |
|---|---|
| **Overview** | Pass `livePrices` to `AssetBalancesTable` |
| **Market** | Render `WatchlistPanel` (was empty/placeholder) |
| **Settings** | Add `OkxConnectionSettings` section |

**Watchlist Handlers:**
```typescript
const handleAddToWatchlist = async (symbol: string) => {
  const item = await addToWatchlist(symbol);
  if (item) setWatchlist((prev) => [...prev, item]);
};

const handleRemoveFromWatchlist = async (id: string) => {
  await removeFromWatchlist(id);
  setWatchlist((prev) => prev.filter((w) => w.id !== id));
};

const handleSyncComplete = async () => {
  // Refresh trades and balances after OKX sync
  const [tradesData, balancesData] = await Promise.all([
    loadTrades(),
    loadAssetBalances(),
  ]);
  setTrades(tradesData);
  setAssetBalances(balancesData);
};
```

---

## Context

### Files to Modify

| File | Change |
|---|---|
| `src/services/okx/client.ts` | Replace placeholder with full OKX REST client |
| `src/types/index.ts` | Add `export * from './okx'` |
| `src/components/trading/AssetBalancesTable.tsx` | Add live price columns |
| `src/features/trading/TradingPage.tsx` | Add Market tab, WebSocket, watchlist state |

### New Files

| File | Purpose |
|---|---|
| `src/types/okx.ts` | OKX API type definitions |
| `supabase/functions/okx-proxy/index.ts` | Supabase Edge Function for OKX proxy |
| `src/services/okx/websocket.ts` | WebSocket service for live prices |
| `src/components/trading/WatchlistPanel.tsx` | Live ticker watchlist UI |
| `src/components/trading/OkxConnectionSettings.tsx` | API key setup + sync controls |

### Existing Patterns to Follow

| Pattern | Reference File | Apply To |
|---|---|---|
| Supabase CRUD with row mapping | `src/services/supabase/storage.ts` | OKX client error handling |
| Edge Function invocation | `supabase.functions.invoke()` | `client.ts` proxy calls |
| Named exports, PascalCase components | All existing components | New components |
| Tailwind + CSS vars theming | `src/components/trading/PnlSummaryCards.tsx` | WatchlistPanel, OkxConnectionSettings |
| Error handling (log, don't throw) | `src/services/supabase/trading.ts` | All new services |
| Format helpers | `src/lib/format.ts` | Price/P&L display |
| Card component | `src/components/ui/Card.tsx` | Settings sections |
| lucide-react icons | All existing components | New components |

### Key Dependencies

```json
{
  "@supabase/supabase-js": "^2.93.3"  // supabase.functions.invoke()
}
```

No new npm dependencies required. WebSocket is native browser API. Edge Function runs on Deno (no package.json).

---

## Goal

After Phase 2, the Trading Command Center connects to OKX exchange. Users can:
- Store OKX API keys securely in Supabase Vault (never in the browser)
- Auto-import trade history from OKX with deduplication
- Sync account balances from OKX
- View real-time prices for watchlist items via WebSocket
- See live unrealized P&L on their asset holdings
- Monitor WebSocket connection status

The system is designed for security-first: all authenticated OKX requests flow through the Edge Function proxy with server-side request signing.

---

## Acceptance Criteria

### Edge Function
- [ ] `supabase/functions/okx-proxy/index.ts` deployed and callable
- [ ] Reads OKX credentials from Supabase Vault (not env vars, not hardcoded)
- [ ] Signs requests using HMAC-SHA256 per OKX V5 spec
- [ ] Only proxies whitelisted endpoints (`fills-history`, `balance`, `ticker`, `tickers`)
- [ ] Returns 403 for non-whitelisted endpoints
- [ ] Returns 401 for missing/invalid Supabase JWT
- [ ] Returns 500 with descriptive error when Vault secrets are missing
- [ ] CORS headers set for cross-origin requests

### OKX REST Client
- [ ] `fetchTradeHistory()` returns typed `OkxFill[]` from Edge Function
- [ ] `fetchAccountBalance()` returns typed `OkxAccountBalance`
- [ ] `fetchTicker()` returns typed `OkxTicker` for a single pair
- [ ] `fetchTickers()` returns all spot tickers
- [ ] `testConnection()` returns boolean (true = credentials valid)
- [ ] `syncTradesFromOkx()` imports trades with dedup by `okxTradeId`
- [ ] Sync displays count of imported vs skipped trades
- [ ] Pagination handles OKX cursor-based pagination (fetches all available fills)
- [ ] `syncBalancesFromOkx()` upserts asset balances from OKX
- [ ] All functions follow error handling pattern (log + return null/empty, never throw)

### WebSocket Service
- [ ] Connects to `wss://ws.okx.com:8443/ws/v5/public`
- [ ] `subscribeTicker()` receives real-time price updates
- [ ] `unsubscribeTicker()` cleanly removes subscription
- [ ] Ping every 25s to keep connection alive
- [ ] Auto-reconnect with exponential backoff (1s → 30s cap)
- [ ] Max 10 reconnect attempts before stopping
- [ ] Re-subscribes all tickers after reconnect
- [ ] `disconnect()` cleanly closes connection and clears state
- [ ] Singleton instance exported for app-wide use

### WatchlistPanel
- [ ] Renders all watchlist items with live prices
- [ ] Shows 24h change and 24h change % with green/red coloring
- [ ] "Add Symbol" input with common pair suggestions
- [ ] Remove button per watchlist item
- [ ] Connection status indicator (green/red dot)
- [ ] Price flash animation on updates
- [ ] Uses CSS custom properties for theming (dark/light mode)

### OkxConnectionSettings
- [ ] API Key, Secret, Passphrase inputs with show/hide toggle
- [ ] "Save to Vault" stores credentials server-side
- [ ] "Test Connection" validates credentials, shows result
- [ ] "Sync Trades" imports with progress indicator and result count
- [ ] "Sync Balances" syncs with progress indicator
- [ ] Connection status display
- [ ] Last sync timestamp display
- [ ] Error messages displayed clearly

### TradingPage Integration
- [ ] Market tab renders WatchlistPanel with live data
- [ ] Settings tab includes OkxConnectionSettings section
- [ ] Overview tab's AssetBalancesTable shows live prices and unrealized P&L
- [ ] WebSocket subscribes to watchlist + held asset symbols
- [ ] `livePrices` state updates on every ticker message
- [ ] After sync, trades and balances refresh automatically
- [ ] No `any` types — TypeScript strict

### Security
- [ ] OKX API keys never stored in browser (no localStorage, no VITE_ env vars)
- [ ] Edge Function reads keys from Supabase Vault only
- [ ] JWT verified on every Edge Function call
- [ ] API key input fields use `type="password"`

---

## PR / Branch Strategy

| Branch | PR Title |
|---|---|
| `feat/trading-okx` | feat: OKX API integration with Supabase Edge Function proxy |

**Implementation Order:**
1. Types (`src/types/okx.ts`)
2. Edge Function (`supabase/functions/okx-proxy/index.ts`)
3. REST Client (`src/services/okx/client.ts`)
4. WebSocket Service (`src/services/okx/websocket.ts`)
5. WatchlistPanel component
6. OkxConnectionSettings component
7. AssetBalancesTable updates (live prices)
8. TradingPage wiring
