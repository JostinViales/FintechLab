---
slug: "20260306-trading-command-center"
title: "Trading Command Center"
spec_type: tech-spec
project: WF
domain: [trading, api-integration, ai]
source_repo: ""
notion_url: ""
gh_issue:
gh_prs: []
status: draft
published_at:
---

# Trading Command Center — Tech Spec

## Persona

You are a senior full-stack engineer specializing in React 19 + TypeScript financial applications with real-time data integration. You are deeply familiar with the OKX V5 REST/WebSocket API, Supabase Edge Functions, Recharts, and Tailwind CSS. You follow the WealthFlow codebase conventions (outlet context pattern, Supabase storage service, `src/types/` domain types, `src/services/` API layer).

## Task

Build the **Trading Command Center** — a comprehensive crypto trading hub within WealthFlow that replaces the current placeholder `TradingPage`. The system integrates with OKX (spot) via read-only API, supports manual trade entry, and provides deep analytics, AI-powered insights (Gemini), and real-time market data.

### Deliverables

1. **Supabase schema** — New tables for trades, assets, watchlist, strategy tags, and trading limits
2. **Supabase Edge Function** — Secure OKX API proxy (keys in Supabase Vault)
3. **OKX service client** — Frontend service layer consuming the Edge Function
4. **Trading types** — Expanded TypeScript domain types
5. **Trading page + sub-components** — Full UI with tabs/sections
6. **AI trading features** — Gemini-powered trade analysis, risk assessment, journal summarizer
7. **Real-time market data** — WebSocket-based live ticker and watchlist

---

## Architecture Overview

```
Browser (React)
    |
    |-- src/services/okx/client.ts -----> Supabase Edge Function -----> OKX REST API v5
    |                                         (keys in Vault)
    |-- src/services/okx/websocket.ts ---> OKX Public WebSocket (no auth needed)
    |
    |-- src/services/supabase/trading.ts -> Supabase PostgreSQL (trades, assets, etc.)
    |
    |-- src/services/gemini.ts (existing) -> Gemini AI (trade analysis)
```

### Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| OKX API proxy | Supabase Edge Function | API keys never reach the browser; Vault-encrypted storage |
| Real-time prices | OKX Public WebSocket (direct) | Public channels don't require auth; lower latency than polling |
| Trade persistence | Supabase PostgreSQL | Consistent with existing app pattern; enables cross-device sync |
| AI analysis | Gemini (existing service) | Already integrated in the app for financial advisor |
| Charts | Recharts (existing dep) | Already used for BalanceChart; consistent UI |

---

## Phases

This is a large feature. Implementation is split into 4 phases, each independently shippable.

### Phase 1: Core Foundation (MVP)

Data model, trade history, manual entry, basic P&L summary, asset balances.

### Phase 2: OKX API Integration

Supabase Edge Function, auto-sync from OKX, trade import, live ticker/watchlist.

### Phase 3: Advanced Analytics & Charts

Equity curve, drawdown, time-based analysis, hold duration, strategy tagging, performance per strategy.

### Phase 4: AI Features & Risk Management

Gemini trade analysis, risk scoring, journal summarizer, rebalancing suggestions, position sizing calculator, trading limits.

---

## Phase 1: Core Foundation (MVP)

### 1.1 Database Schema (Supabase)

#### Table: `trades`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` PK | Auto-generated |
| `symbol` | `text` NOT NULL | Trading pair (e.g., `BTC-USDT`) |
| `side` | `text` NOT NULL | `buy` or `sell` |
| `price` | `numeric` NOT NULL | Execution price |
| `quantity` | `numeric` NOT NULL | Amount of base asset |
| `total` | `numeric` GENERATED | `price * quantity` (stored generated column) |
| `fee` | `numeric` DEFAULT 0 | Trading fee |
| `fee_currency` | `text` | Fee denomination (e.g., `USDT`) |
| `realized_pnl` | `numeric` | Calculated P&L for closing trades |
| `strategy_tag` | `text` | Optional strategy label (breakout, DCA, etc.) |
| `notes` | `text` | Free-form trade notes |
| `source` | `text` DEFAULT 'manual' | `manual` or `okx` |
| `okx_trade_id` | `text` UNIQUE | OKX trade ID (for dedup on sync) |
| `okx_order_id` | `text` | OKX order ID reference |
| `traded_at` | `timestamptz` NOT NULL | When the trade executed |
| `created_at` | `timestamptz` DEFAULT now() | Record creation |

Indexes: `(symbol)`, `(traded_at DESC)`, `(strategy_tag)`, `(source)`

#### Table: `asset_balances`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` PK | Auto-generated |
| `asset` | `text` UNIQUE NOT NULL | Asset symbol (e.g., `BTC`, `ETH`, `USDT`) |
| `total_quantity` | `numeric` NOT NULL | Current holdings |
| `avg_buy_price` | `numeric` | Weighted average cost basis |
| `total_cost` | `numeric` | Total capital deployed |
| `last_synced_at` | `timestamptz` | Last OKX balance sync |

#### Table: `watchlist`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` PK | Auto-generated |
| `symbol` | `text` UNIQUE NOT NULL | Trading pair to watch |
| `sort_order` | `integer` DEFAULT 0 | Display order |
| `created_at` | `timestamptz` DEFAULT now() | |

#### Table: `trading_goals`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` PK | Auto-generated |
| `period_type` | `text` NOT NULL | `weekly` or `monthly` |
| `period_key` | `text` NOT NULL | e.g., `2026-W10` or `2026-03` |
| `target_pnl` | `numeric` NOT NULL | Profit target |
| `max_trades` | `integer` | Self-imposed trade limit |
| `max_capital` | `numeric` | Max capital to deploy |
| `created_at` | `timestamptz` DEFAULT now() | |

Unique constraint: `(period_type, period_key)`

#### Table: `strategy_tags`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` PK | Auto-generated |
| `name` | `text` UNIQUE NOT NULL | e.g., `breakout`, `mean-reversion`, `DCA` |
| `color` | `text` NOT NULL | Hex color for UI badges |
| `description` | `text` | Optional description |

### 1.2 TypeScript Types

**File: `src/types/trading.ts`** (replaces current placeholder)

```typescript
export type TradeSide = 'buy' | 'sell';
export type TradeSource = 'manual' | 'okx';
export type GoalPeriodType = 'weekly' | 'monthly';

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
  tradedAt: string; // ISO 8601
  createdAt: string;
}

export interface AssetBalance {
  id: string;
  asset: string;
  totalQuantity: number;
  avgBuyPrice: number;
  totalCost: number;
  currentPrice?: number;    // populated from live data
  currentValue?: number;    // populated: totalQuantity * currentPrice
  unrealizedPnl?: number;   // populated: currentValue - totalCost
  unrealizedPnlPct?: number;
  allocationPct?: number;   // % of total portfolio
  lastSyncedAt?: string;
}

export interface WatchlistItem {
  id: string;
  symbol: string;
  sortOrder: number;
  currentPrice?: number;  // populated from WebSocket
  change24h?: number;     // populated from market data
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

// Computed analytics (not persisted)
export interface TradingStats {
  totalTrades: number;
  totalRealizedPnl: number;
  totalUnrealizedPnl: number;
  totalFeesPaid: number;
  winRate: number;          // % of profitable closing trades
  avgWin: number;
  avgLoss: number;
  profitFactor: number;     // gross profit / gross loss
  avgTradeSize: number;
  largestWin: number;
  largestLoss: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpeRatio?: number;
  sortinoRatio?: number;
}

export interface TimeAnalysis {
  byHour: Record<number, { trades: number; pnl: number; winRate: number }>;
  byDayOfWeek: Record<number, { trades: number; pnl: number; winRate: number }>;
  byMonth: Record<string, { trades: number; pnl: number; winRate: number }>;
}

export interface HoldDuration {
  durationMinutes: number;
  pnl: number;
  symbol: string;
}

export interface EquityCurvePoint {
  date: string;
  equity: number;
  drawdown: number;
  drawdownPct: number;
}
```

### 1.3 Service Layer

**File: `src/services/supabase/trading.ts`**

Following the same pattern as `src/services/supabase/storage.ts`:

```typescript
// CRUD operations:
export const loadTrades = async (filters?: TradeFilters): Promise<Trade[]>
export const saveTrade = async (trade: Omit<Trade, 'id' | 'createdAt' | 'total'>): Promise<Trade>
export const deleteTrade = async (id: string): Promise<void>
export const bulkSaveTrades = async (trades: Omit<Trade, 'id' | 'createdAt' | 'total'>[]): Promise<Trade[]>

export const loadAssetBalances = async (): Promise<AssetBalance[]>
export const saveAssetBalance = async (balance: Omit<AssetBalance, 'id'>): Promise<AssetBalance>
export const recalculateAssetBalances = async (): Promise<AssetBalance[]>  // from trades

export const loadWatchlist = async (): Promise<WatchlistItem[]>
export const addToWatchlist = async (symbol: string): Promise<WatchlistItem>
export const removeFromWatchlist = async (id: string): Promise<void>

export const loadStrategyTags = async (): Promise<StrategyTag[]>
export const saveStrategyTag = async (tag: Omit<StrategyTag, 'id'>): Promise<StrategyTag>

export const loadTradingGoals = async (): Promise<TradingGoal[]>
export const saveTradingGoal = async (goal: Omit<TradingGoal, 'id'>): Promise<TradingGoal>
```

### 1.4 Analytics Engine

**File: `src/lib/tradingAnalytics.ts`**

Pure functions (no side effects) that compute all analytics from trade data:

```typescript
export const computeTradingStats = (trades: Trade[]): TradingStats
export const computeEquityCurve = (trades: Trade[], startingCapital: number): EquityCurvePoint[]
export const computeTimeAnalysis = (trades: Trade[]): TimeAnalysis
export const computeHoldDurations = (trades: Trade[]): HoldDuration[]
export const computeStrategyPerformance = (trades: Trade[]): Record<string, TradingStats>
export const computeCorrelationMatrix = (priceHistory: Record<string, number[]>): number[][]
export const computePositionSize = (
  accountBalance: number,
  riskPct: number,
  entryPrice: number,
  stopLossPrice: number
): { quantity: number; riskAmount: number; positionValue: number }
```

### 1.5 UI Components

**Directory structure:**

```
src/
├── features/trading/
│   └── TradingPage.tsx              # Main page with tab navigation
├── components/trading/
│   ├── TradeForm.tsx                # Modal: manual trade entry/edit
│   ├── TradeHistoryTable.tsx        # Filterable, sortable trade table
│   ├── PnlSummaryCards.tsx          # Top-level P&L stats cards
│   ├── AssetBalancesTable.tsx       # Holdings with live prices
│   ├── AllocationPieChart.tsx       # Portfolio allocation donut chart
│   ├── EquityCurveChart.tsx         # Running equity + drawdown overlay
│   ├── PnlTimelineChart.tsx         # Realized P&L over time (bar/line)
│   ├── DrawdownChart.tsx            # Drawdown from peak over time
│   ├── TimeAnalysisChart.tsx        # Heatmap: performance by hour/day
│   ├── HoldDurationChart.tsx        # Histogram of hold durations
│   ├── StrategyPerformance.tsx      # Performance breakdown per strategy tag
│   ├── StrategyTagManager.tsx       # CRUD for strategy tags
│   ├── WatchlistPanel.tsx           # Live ticker sidebar/panel
│   ├── TradingGoals.tsx             # Goal setting + progress tracker
│   ├── TradingLimits.tsx            # Daily/weekly trade & capital limits
│   ├── PositionSizingCalc.tsx       # Risk-based position size calculator
│   ├── CorrelationMatrix.tsx        # Asset correlation heatmap
│   └── ai/
│       ├── TradeSignalAnalysis.tsx   # Gemini: entry/exit suggestions
│       ├── RiskAssessment.tsx        # Gemini: per-position risk score
│       ├── TradeJournalSummary.tsx   # Gemini: pattern analysis from history
│       └── RebalancingSuggestions.tsx # Gemini: portfolio drift analysis
```

**TradingPage layout — Tab-based navigation:**

| Tab | Components | Phase |
|-----|-----------|-------|
| **Overview** | PnlSummaryCards, EquityCurveChart, AssetBalancesTable, AllocationPieChart | 1 |
| **Trades** | TradeHistoryTable, TradeForm (modal) | 1 |
| **Analytics** | DrawdownChart, TimeAnalysisChart, HoldDurationChart, StrategyPerformance, CorrelationMatrix | 3 |
| **Market** | WatchlistPanel, (FundingRateDashboard, OrderBookDepth — future) | 2 |
| **AI Insights** | TradeSignalAnalysis, RiskAssessment, TradeJournalSummary, RebalancingSuggestions | 4 |
| **Settings** | StrategyTagManager, TradingGoals, TradingLimits, PositionSizingCalc, OKX connection config | 1-2 |

### 1.6 State Management

Trading state is **independent from the existing App.tsx outlet context** (which handles budget/transactions). The TradingPage manages its own state:

```typescript
// Inside TradingPage.tsx
const [trades, setTrades] = useState<Trade[]>([]);
const [assetBalances, setAssetBalances] = useState<AssetBalance[]>([]);
const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
const [strategyTags, setStrategyTags] = useState<StrategyTag[]>([]);
const [tradingGoals, setTradingGoals] = useState<TradingGoal[]>([]);
const [activeTab, setActiveTab] = useState<TradingTab>('overview');

// Computed (useMemo)
const tradingStats = useMemo(() => computeTradingStats(trades), [trades]);
const equityCurve = useMemo(() => computeEquityCurve(trades, startingCapital), [trades]);
```

**Future refactor:** Extract into `src/hooks/useTrading.ts` custom hook (aligns with tech debt plan in CLAUDE.md).

---

## Phase 2: OKX API Integration

### 2.1 Supabase Edge Function

**File: `supabase/functions/okx-proxy/index.ts`**

```
POST /okx-proxy
Body: { endpoint: string, method: "GET" | "POST", params?: Record<string, string> }
Response: { data: any } | { error: string }
```

**Security:**
- OKX API key, secret, and passphrase stored in **Supabase Vault**
- Edge Function reads from Vault at runtime
- Request signing (HMAC SHA256) happens server-side
- Only whitelisted OKX endpoints are proxied:
  - `GET /api/v5/trade/fills-history` — Trade history
  - `GET /api/v5/account/balance` — Account balances
  - `GET /api/v5/market/tickers` — Market prices
  - `GET /api/v5/market/ticker` — Single ticker
  - `GET /api/v5/market/books` — Order book
  - `GET /api/v5/public/funding-rate` — Funding rates

### 2.2 Frontend OKX Service

**File: `src/services/okx/client.ts`** (replaces current placeholder)

```typescript
// All calls go through the Edge Function
export const fetchTradeHistory = async (params: {
  instId?: string;
  after?: string;
  before?: string;
  limit?: number;
}): Promise<OkxTradeResponse[]>

export const fetchAccountBalance = async (): Promise<OkxBalanceResponse[]>

export const fetchTicker = async (instId: string): Promise<OkxTickerResponse>

export const fetchTickers = async (instType: 'SPOT'): Promise<OkxTickerResponse[]>

export const syncTradesFromOkx = async (): Promise<{
  imported: number;
  skipped: number;  // already existed (dedup by okx_trade_id)
}>
```

### 2.3 WebSocket Service (Public — No Auth)

**File: `src/services/okx/websocket.ts`**

```typescript
// Direct browser connection to OKX public WebSocket
// wss://ws.okx.com:8443/ws/v5/public

export class OkxWebSocketService {
  connect(): void
  disconnect(): void
  subscribeTicker(instId: string, callback: (data: TickerUpdate) => void): void
  unsubscribeTicker(instId: string): void
  subscribeOrderBook(instId: string, callback: (data: OrderBookUpdate) => void): void
  onReconnect(callback: () => void): void
}
```

- Auto-reconnect with exponential backoff
- Heartbeat/ping-pong keepalive
- Subscribe to tickers for all watchlist items + held assets

### 2.4 OKX Connection Settings UI

**Component: `src/components/trading/OkxConnectionSettings.tsx`**

- Input fields for API key, secret, passphrase (stored in Supabase Vault via Edge Function)
- "Test Connection" button
- Connection status indicator
- "Sync Now" button with progress indicator
- Last sync timestamp display

---

## Phase 3: Advanced Analytics & Charts

### 3.1 Charts (all using Recharts)

| Chart | Type | Data Source |
|-------|------|-------------|
| **Equity Curve** | Area chart with drawdown overlay | `computeEquityCurve()` |
| **Drawdown** | Area chart (inverted, red) | `computeEquityCurve()` |
| **P&L Timeline** | Bar chart (green/red by day/week) | Aggregated from trades |
| **Allocation** | Donut/pie chart | `assetBalances` |
| **Time Analysis** | Heatmap (hour x day) | `computeTimeAnalysis()` |
| **Hold Duration** | Histogram | `computeHoldDurations()` |
| **Strategy Perf** | Grouped bar chart | `computeStrategyPerformance()` |
| **Correlation** | Heatmap matrix | `computeCorrelationMatrix()` |

### 3.2 Strategy Tagging System

- CRUD for strategy tags (name, color, description)
- Assign tags when creating/editing trades
- Filter trade history by strategy
- Per-strategy stats: win rate, avg P&L, trade count, profit factor

### 3.3 Risk Metrics

Computed in `src/lib/tradingAnalytics.ts`:
- **Max drawdown**: Peak-to-trough decline in equity
- **Sharpe ratio**: `(mean return - risk-free rate) / std deviation of returns`
- **Sortino ratio**: Like Sharpe but only penalizes downside volatility
- Daily returns calculated from equity curve

---

## Phase 4: AI Features & Risk Management

### 4.1 Gemini Integration for Trading

Extends existing `src/services/gemini.ts` with new prompt templates:

```typescript
export const analyzeTradeSignals = async (
  symbol: string,
  recentTrades: Trade[],
  marketData: TickerData
): Promise<TradeSignalAnalysis>

export const assessPositionRisk = async (
  position: AssetBalance,
  allPositions: AssetBalance[],
  marketData: TickerData
): Promise<RiskAssessment>

export const summarizeTradeJournal = async (
  trades: Trade[],
  stats: TradingStats
): Promise<JournalSummary>

export const suggestRebalancing = async (
  currentAllocations: AssetBalance[],
  targetAllocations: Record<string, number>
): Promise<RebalancingSuggestion[]>
```

### 4.2 Trading Limits & Goals

- Set weekly/monthly profit targets
- Self-imposed trade count limits
- Capital deployment limits
- Progress bars + warnings when approaching limits
- Visual lockout indicator (soft — doesn't block, just warns)

### 4.3 Position Sizing Calculator

Interactive tool:
- Inputs: account balance, risk %, entry price, stop loss price
- Outputs: position size (quantity), risk amount ($), position value ($)
- Formula: `quantity = (balance * riskPct) / abs(entryPrice - stopLossPrice)`

---

## Context: Existing Codebase Patterns

### Patterns to Follow

| Pattern | Reference | Apply To |
|---------|-----------|----------|
| Page via outlet context | `App.tsx:26-45` → `AppContext` | TradingPage can access shared state if needed |
| Supabase CRUD with row mapping | `services/supabase/storage.ts:64-102` | `services/supabase/trading.ts` |
| Modal forms | `components/transactions/TransactionForm.tsx` | `TradeForm.tsx` |
| Card component | `components/ui/Card.tsx` | All stat cards |
| Chart component | `components/charts/BalanceChart.tsx` | All trading charts |
| Recharts usage | Existing BalanceChart | Equity curve, P&L charts |
| Gemini service | `services/gemini.ts` | AI trading features |
| CSS variables for theming | `var(--bg-primary)`, `var(--text-secondary)` | All new components |
| Named exports | All components use `export const` | All new components |
| Route registration | `router.tsx:20` — already registered | No change needed |

### Files to Modify

| File | Change |
|------|--------|
| `src/types/trading.ts` | Replace placeholder with full types |
| `src/types/index.ts` | Update exports for new trading types |
| `src/services/okx/client.ts` | Replace placeholder with real service |
| `src/features/trading/TradingPage.tsx` | Replace placeholder with full page |

### New Files

| File | Purpose |
|------|---------|
| `src/services/supabase/trading.ts` | Trading CRUD operations |
| `src/services/okx/websocket.ts` | WebSocket for live prices |
| `src/lib/tradingAnalytics.ts` | Pure analytics functions |
| `src/components/trading/*.tsx` | ~18 UI components (see 1.5) |
| `supabase/functions/okx-proxy/index.ts` | Edge Function |

### Environment Variables (New)

```bash
# Added to .env (used by Supabase Edge Function, NOT browser)
OKX_API_KEY=             # Stored in Supabase Vault
OKX_SECRET_KEY=          # Stored in Supabase Vault
OKX_PASSPHRASE=          # Stored in Supabase Vault
```

Remove from browser env (VITE_ prefix vars for OKX in CLAUDE.md are no longer needed — keys live server-side).

---

## Goal

After Phase 1, the Trading page transforms from a placeholder into a functional trade tracker with manual entry, P&L summary, asset balances, and basic charts. Each subsequent phase layers on OKX auto-sync, deep analytics, and AI intelligence — ultimately creating a crypto command center that gives you full visibility into every trade, pattern, and opportunity.

---

## Acceptance Criteria

### Phase 1 (MVP)
- [ ] Supabase tables created: `trades`, `asset_balances`, `watchlist`, `trading_goals`, `strategy_tags`
- [ ] Can manually add a trade via `TradeForm` modal (symbol, side, price, quantity, fee, strategy tag, notes)
- [ ] Trade history table displays all trades, sortable by date/symbol/side/P&L
- [ ] Trade history table filterable by symbol, side, date range, strategy tag
- [ ] P&L summary cards show: total realized P&L, win rate, total fees, trade count
- [ ] Asset balances table shows: asset, quantity, avg buy price, total cost
- [ ] Asset balances auto-recalculate when trades are added/edited/deleted
- [ ] Allocation pie chart renders from asset balances
- [ ] Equity curve chart renders from trade history
- [ ] Tab navigation between Overview, Trades, and Settings works
- [ ] All components use existing theme CSS variables (dark/light mode)
- [ ] TypeScript strict — no `any` types

### Phase 2 (OKX Integration)
- [ ] Supabase Edge Function proxies OKX API requests with Vault-stored keys
- [ ] Edge Function only allows whitelisted OKX endpoints
- [ ] "Sync from OKX" imports trade history with dedup by `okx_trade_id`
- [ ] Sync displays count of imported vs skipped trades
- [ ] WebSocket connects to OKX public feed for live ticker prices
- [ ] Watchlist panel shows live prices with 24h change
- [ ] Asset balances table shows current price and unrealized P&L from live data
- [ ] OKX connection settings UI allows entering/testing API keys
- [ ] Auto-reconnect on WebSocket disconnect

### Phase 3 (Analytics)
- [ ] Drawdown chart shows max drawdown from peak over time
- [ ] Time analysis heatmap shows performance by hour and day of week
- [ ] Hold duration histogram renders
- [ ] Strategy performance breakdown shows stats per strategy tag
- [ ] Correlation matrix renders for held assets (requires price history)
- [ ] Sharpe and Sortino ratios display in stats cards
- [ ] All charts are responsive and theme-aware

### Phase 4 (AI & Risk)
- [ ] Trade Signal Analysis sends context to Gemini and displays entry/exit suggestions
- [ ] Risk Assessment generates per-position risk scores
- [ ] Trade Journal Summarizer surfaces behavioral patterns from trade history
- [ ] Portfolio Rebalancing shows current vs target allocation with suggestions
- [ ] Position sizing calculator correctly computes from risk %, entry, stop loss
- [ ] Trading goals (weekly/monthly) with progress tracking
- [ ] Trading limits with visual warnings when approaching limits

---

## PR / Branch Strategy

| Phase | Branch | PR Title |
|-------|--------|----------|
| 1 | `feat/trading-core` | feat: Trading command center — core data model, trade history, P&L |
| 2 | `feat/trading-okx` | feat: OKX API integration with Supabase Edge Function proxy |
| 3 | `feat/trading-analytics` | feat: Advanced trading analytics and charts |
| 4 | `feat/trading-ai` | feat: AI-powered trade insights and risk management |
