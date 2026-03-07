---
slug: "20260306-trading-command-center"
title: "Trading Command Center — Phase 1 Implementation"
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

# Trading Command Center — Phase 1 Code Spec

## Persona

You are a senior React/TypeScript engineer implementing Phase 1 (Core Foundation MVP) of the WealthFlow Trading Command Center. You are intimately familiar with the existing codebase patterns: Supabase CRUD with row mappers (`services/supabase/storage.ts`), modal forms (`components/transactions/TransactionForm.tsx`), Recharts charts (`components/charts/BalanceChart.tsx`), the Card component (`components/ui/Card.tsx`), the outlet context pattern (`App.tsx`), and Tailwind + CSS custom properties theming. You write TypeScript strict with no `any`, use named exports, and follow the project's import ordering (React > react-router > third-party > @/ aliases > relative).

## Task

Implement Phase 1 of the Trading Command Center: replace the current placeholder `TradingPage` with a fully functional trade tracker featuring manual trade entry, trade history table, P&L summary, asset balances, allocation chart, equity curve, and strategy tag management. All data persists to Supabase.

### Deliverables (Ordered)

1. Supabase migration SQL for 5 new tables
2. TypeScript domain types (`src/types/trading.ts`)
3. Type re-exports (`src/types/index.ts`)
4. Supabase trading service (`src/services/supabase/trading.ts`)
5. Analytics engine (`src/lib/tradingAnalytics.ts`)
6. Format helpers for trading (`src/lib/format.ts` — extend existing)
7. UI Components (8 files under `src/components/trading/`)
8. TradingPage rewrite (`src/features/trading/TradingPage.tsx`)

---

## Steps

### Step 1: Supabase Migration SQL

Create `supabase/migrations/20260306_trading_tables.sql`. Run this in the Supabase SQL editor or via CLI.

```sql
-- 1. Strategy tags (referenced by trades)
CREATE TABLE IF NOT EXISTS strategy_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  description TEXT
);

-- Seed default strategy tags
INSERT INTO strategy_tags (name, color, description) VALUES
  ('Breakout', '#10b981', 'Breakout from consolidation or key level'),
  ('Mean Reversion', '#8b5cf6', 'Reversion to mean/average price'),
  ('DCA', '#3b82f6', 'Dollar-cost averaging into a position'),
  ('Scalp', '#f59e0b', 'Short-term scalp trade'),
  ('Swing', '#ec4899', 'Multi-day swing trade')
ON CONFLICT (name) DO NOTHING;

-- 2. Trades
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  price NUMERIC NOT NULL CHECK (price > 0),
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  total NUMERIC GENERATED ALWAYS AS (price * quantity) STORED,
  fee NUMERIC NOT NULL DEFAULT 0,
  fee_currency TEXT NOT NULL DEFAULT 'USDT',
  realized_pnl NUMERIC,
  strategy_tag TEXT REFERENCES strategy_tags(name) ON UPDATE CASCADE ON DELETE SET NULL,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'okx')),
  okx_trade_id TEXT UNIQUE,
  okx_order_id TEXT,
  traded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades (symbol);
CREATE INDEX IF NOT EXISTS idx_trades_traded_at ON trades (traded_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_strategy_tag ON trades (strategy_tag);
CREATE INDEX IF NOT EXISTS idx_trades_source ON trades (source);

-- 3. Asset balances (computed/synced snapshot)
CREATE TABLE IF NOT EXISTS asset_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset TEXT UNIQUE NOT NULL,
  total_quantity NUMERIC NOT NULL DEFAULT 0,
  avg_buy_price NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ
);

-- 4. Watchlist
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT UNIQUE NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Trading goals
CREATE TABLE IF NOT EXISTS trading_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly')),
  period_key TEXT NOT NULL,
  target_pnl NUMERIC NOT NULL,
  max_trades INTEGER,
  max_capital NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period_type, period_key)
);
```

**Verification:** After running, confirm all 5 tables exist via Supabase dashboard or `\dt` in SQL editor.

---

### Step 2: TypeScript Types

**File: `src/types/trading.ts`** — Replace the current placeholder entirely.

```typescript
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
```

---

### Step 3: Update Type Exports

**File: `src/types/index.ts`** — Replace the trading exports to include all new types.

Current line 15: `export type { Trade, Position } from './trading';`

Replace with:

```typescript
export type {
  TradeSide,
  TradeSource,
  GoalPeriodType,
  TradingTab,
  Trade,
  AssetBalance,
  WatchlistItem,
  TradingGoal,
  StrategyTag,
  TradingStats,
  EquityCurvePoint,
  TradeFilters,
} from './trading';
```

Remove the `Position` export (no longer exists).

---

### Step 4: Supabase Trading Service

**File: `src/services/supabase/trading.ts`** — New file.

Follow the exact pattern from `src/services/supabase/storage.ts`:
- Define `Supabase*Row` interfaces for snake_case DB columns
- Write `map*Row` functions to convert snake_case → camelCase
- Export async CRUD functions

```typescript
import { supabase } from './client';
import type {
  Trade,
  AssetBalance,
  WatchlistItem,
  TradingGoal,
  StrategyTag,
  TradeFilters,
} from '@/types';

// --- Row Types (snake_case from Supabase) ---

interface SupabaseTradeRow {
  id: string;
  symbol: string;
  side: string;
  price: number;
  quantity: number;
  total: number;
  fee: number;
  fee_currency: string;
  realized_pnl: number | null;
  strategy_tag: string | null;
  notes: string | null;
  source: string;
  okx_trade_id: string | null;
  okx_order_id: string | null;
  traded_at: string;
  created_at: string;
}

interface SupabaseAssetBalanceRow {
  id: string;
  asset: string;
  total_quantity: number;
  avg_buy_price: number;
  total_cost: number;
  last_synced_at: string | null;
}

interface SupabaseWatchlistRow {
  id: string;
  symbol: string;
  sort_order: number;
  created_at: string;
}

interface SupabaseTradingGoalRow {
  id: string;
  period_type: string;
  period_key: string;
  target_pnl: number;
  max_trades: number | null;
  max_capital: number | null;
  created_at: string;
}

interface SupabaseStrategyTagRow {
  id: string;
  name: string;
  color: string;
  description: string | null;
}

// --- Row Mappers ---

function mapTradeRow(row: SupabaseTradeRow): Trade {
  return {
    id: row.id,
    symbol: row.symbol,
    side: row.side as Trade['side'],
    price: Number(row.price),
    quantity: Number(row.quantity),
    total: Number(row.total),
    fee: Number(row.fee),
    feeCurrency: row.fee_currency,
    realizedPnl: row.realized_pnl != null ? Number(row.realized_pnl) : undefined,
    strategyTag: row.strategy_tag ?? undefined,
    notes: row.notes ?? undefined,
    source: row.source as Trade['source'],
    okxTradeId: row.okx_trade_id ?? undefined,
    okxOrderId: row.okx_order_id ?? undefined,
    tradedAt: row.traded_at,
    createdAt: row.created_at,
  };
}

function mapAssetBalanceRow(row: SupabaseAssetBalanceRow): AssetBalance {
  return {
    id: row.id,
    asset: row.asset,
    totalQuantity: Number(row.total_quantity),
    avgBuyPrice: Number(row.avg_buy_price),
    totalCost: Number(row.total_cost),
    lastSyncedAt: row.last_synced_at ?? undefined,
  };
}

function mapWatchlistRow(row: SupabaseWatchlistRow): WatchlistItem {
  return {
    id: row.id,
    symbol: row.symbol,
    sortOrder: row.sort_order,
  };
}

function mapTradingGoalRow(row: SupabaseTradingGoalRow): TradingGoal {
  return {
    id: row.id,
    periodType: row.period_type as TradingGoal['periodType'],
    periodKey: row.period_key,
    targetPnl: Number(row.target_pnl),
    maxTrades: row.max_trades ?? undefined,
    maxCapital: row.max_capital != null ? Number(row.max_capital) : undefined,
  };
}

function mapStrategyTagRow(row: SupabaseStrategyTagRow): StrategyTag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    description: row.description ?? undefined,
  };
}

// --- Trades CRUD ---

export const loadTrades = async (filters?: TradeFilters): Promise<Trade[]> => {
  let query = supabase.from('trades').select('*').order('traded_at', { ascending: false });

  if (filters?.symbol) query = query.eq('symbol', filters.symbol);
  if (filters?.side) query = query.eq('side', filters.side);
  if (filters?.strategyTag) query = query.eq('strategy_tag', filters.strategyTag);
  if (filters?.dateFrom) query = query.gte('traded_at', filters.dateFrom);
  if (filters?.dateTo) query = query.lte('traded_at', filters.dateTo);

  const { data, error } = await query;
  if (error) console.error('Error loading trades:', error);
  return (data ?? []).map(mapTradeRow);
};

export const saveTrade = async (
  trade: Omit<Trade, 'id' | 'createdAt' | 'total'>,
): Promise<Trade | null> => {
  const row = {
    symbol: trade.symbol,
    side: trade.side,
    price: trade.price,
    quantity: trade.quantity,
    fee: trade.fee,
    fee_currency: trade.feeCurrency,
    realized_pnl: trade.realizedPnl ?? null,
    strategy_tag: trade.strategyTag ?? null,
    notes: trade.notes ?? null,
    source: trade.source,
    okx_trade_id: trade.okxTradeId ?? null,
    okx_order_id: trade.okxOrderId ?? null,
    traded_at: trade.tradedAt,
  };

  const { data, error } = await supabase.from('trades').insert(row).select().single();
  if (error) {
    console.error('Error saving trade:', error);
    return null;
  }
  return mapTradeRow(data);
};

export const updateTrade = async (
  id: string,
  trade: Partial<Omit<Trade, 'id' | 'createdAt' | 'total'>>,
): Promise<Trade | null> => {
  const row: Record<string, unknown> = {};
  if (trade.symbol !== undefined) row.symbol = trade.symbol;
  if (trade.side !== undefined) row.side = trade.side;
  if (trade.price !== undefined) row.price = trade.price;
  if (trade.quantity !== undefined) row.quantity = trade.quantity;
  if (trade.fee !== undefined) row.fee = trade.fee;
  if (trade.feeCurrency !== undefined) row.fee_currency = trade.feeCurrency;
  if (trade.realizedPnl !== undefined) row.realized_pnl = trade.realizedPnl ?? null;
  if (trade.strategyTag !== undefined) row.strategy_tag = trade.strategyTag ?? null;
  if (trade.notes !== undefined) row.notes = trade.notes ?? null;
  if (trade.tradedAt !== undefined) row.traded_at = trade.tradedAt;

  const { data, error } = await supabase.from('trades').update(row).eq('id', id).select().single();
  if (error) {
    console.error('Error updating trade:', error);
    return null;
  }
  return mapTradeRow(data);
};

export const deleteTrade = async (id: string): Promise<void> => {
  const { error } = await supabase.from('trades').delete().eq('id', id);
  if (error) console.error('Error deleting trade:', error);
};

// --- Asset Balances ---

export const loadAssetBalances = async (): Promise<AssetBalance[]> => {
  const { data, error } = await supabase.from('asset_balances').select('*').order('asset');
  if (error) console.error('Error loading asset balances:', error);
  return (data ?? []).map(mapAssetBalanceRow);
};

export const upsertAssetBalance = async (
  balance: Omit<AssetBalance, 'id'>,
): Promise<AssetBalance | null> => {
  const row = {
    asset: balance.asset,
    total_quantity: balance.totalQuantity,
    avg_buy_price: balance.avgBuyPrice,
    total_cost: balance.totalCost,
    last_synced_at: balance.lastSyncedAt ?? null,
  };

  const { data, error } = await supabase
    .from('asset_balances')
    .upsert(row, { onConflict: 'asset' })
    .select()
    .single();

  if (error) {
    console.error('Error upserting asset balance:', error);
    return null;
  }
  return mapAssetBalanceRow(data);
};

export const deleteAssetBalance = async (id: string): Promise<void> => {
  const { error } = await supabase.from('asset_balances').delete().eq('id', id);
  if (error) console.error('Error deleting asset balance:', error);
};

// --- Strategy Tags ---

export const loadStrategyTags = async (): Promise<StrategyTag[]> => {
  const { data, error } = await supabase.from('strategy_tags').select('*').order('name');
  if (error) console.error('Error loading strategy tags:', error);
  return (data ?? []).map(mapStrategyTagRow);
};

export const saveStrategyTag = async (
  tag: Omit<StrategyTag, 'id'>,
): Promise<StrategyTag | null> => {
  const { data, error } = await supabase
    .from('strategy_tags')
    .insert({ name: tag.name, color: tag.color, description: tag.description ?? null })
    .select()
    .single();

  if (error) {
    console.error('Error saving strategy tag:', error);
    return null;
  }
  return mapStrategyTagRow(data);
};

export const deleteStrategyTag = async (id: string): Promise<void> => {
  const { error } = await supabase.from('strategy_tags').delete().eq('id', id);
  if (error) console.error('Error deleting strategy tag:', error);
};

// --- Watchlist ---

export const loadWatchlist = async (): Promise<WatchlistItem[]> => {
  const { data, error } = await supabase.from('watchlist').select('*').order('sort_order');
  if (error) console.error('Error loading watchlist:', error);
  return (data ?? []).map(mapWatchlistRow);
};

export const addToWatchlist = async (symbol: string): Promise<WatchlistItem | null> => {
  const { data, error } = await supabase
    .from('watchlist')
    .insert({ symbol, sort_order: 0 })
    .select()
    .single();

  if (error) {
    console.error('Error adding to watchlist:', error);
    return null;
  }
  return mapWatchlistRow(data);
};

export const removeFromWatchlist = async (id: string): Promise<void> => {
  const { error } = await supabase.from('watchlist').delete().eq('id', id);
  if (error) console.error('Error removing from watchlist:', error);
};

// --- Trading Goals ---

export const loadTradingGoals = async (): Promise<TradingGoal[]> => {
  const { data, error } = await supabase
    .from('trading_goals')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) console.error('Error loading trading goals:', error);
  return (data ?? []).map(mapTradingGoalRow);
};

export const saveTradingGoal = async (
  goal: Omit<TradingGoal, 'id'>,
): Promise<TradingGoal | null> => {
  const { data, error } = await supabase
    .from('trading_goals')
    .upsert(
      {
        period_type: goal.periodType,
        period_key: goal.periodKey,
        target_pnl: goal.targetPnl,
        max_trades: goal.maxTrades ?? null,
        max_capital: goal.maxCapital ?? null,
      },
      { onConflict: 'period_type,period_key' },
    )
    .select()
    .single();

  if (error) {
    console.error('Error saving trading goal:', error);
    return null;
  }
  return mapTradingGoalRow(data);
};
```

**Key patterns mirrored from `storage.ts`:**
- `Supabase*Row` interfaces for type safety on DB responses
- `map*Row` private functions converting snake_case → camelCase
- Error logging but no throws (matches existing pattern)
- `null` return on error for write operations so caller can handle
- Filter chaining on queries

---

### Step 5: Analytics Engine

**File: `src/lib/tradingAnalytics.ts`** — New file. Pure functions, zero side effects.

```typescript
import type { Trade, TradingStats, EquityCurvePoint } from '@/types';

/**
 * Compute aggregate trading statistics from a list of trades.
 * Only trades with realized_pnl set are counted for win/loss metrics.
 */
export const computeTradingStats = (trades: Trade[]): TradingStats => {
  const closingTrades = trades.filter((t) => t.realizedPnl != null);
  const wins = closingTrades.filter((t) => (t.realizedPnl ?? 0) > 0);
  const losses = closingTrades.filter((t) => (t.realizedPnl ?? 0) < 0);

  const grossProfit = wins.reduce((sum, t) => sum + (t.realizedPnl ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.realizedPnl ?? 0), 0));

  const totalFees = trades.reduce((sum, t) => sum + t.fee, 0);
  const totalRealizedPnl = closingTrades.reduce((sum, t) => sum + (t.realizedPnl ?? 0), 0);

  return {
    totalTrades: trades.length,
    totalRealizedPnl: totalRealizedPnl,
    totalFeesPaid: totalFees,
    winCount: wins.length,
    lossCount: losses.length,
    winRate: closingTrades.length > 0 ? (wins.length / closingTrades.length) * 100 : 0,
    avgWin: wins.length > 0 ? grossProfit / wins.length : 0,
    avgLoss: losses.length > 0 ? grossLoss / losses.length : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    avgTradeSize: trades.length > 0 ? trades.reduce((s, t) => s + t.total, 0) / trades.length : 0,
    largestWin: wins.length > 0 ? Math.max(...wins.map((t) => t.realizedPnl ?? 0)) : 0,
    largestLoss: losses.length > 0 ? Math.min(...losses.map((t) => t.realizedPnl ?? 0)) : 0,
  };
};

/**
 * Compute equity curve from trades sorted by date ascending.
 * Starting capital is the initial equity value (e.g., total USDT deposited).
 */
export const computeEquityCurve = (
  trades: Trade[],
  startingCapital: number,
): EquityCurvePoint[] => {
  const sorted = [...trades]
    .filter((t) => t.realizedPnl != null)
    .sort((a, b) => new Date(a.tradedAt).getTime() - new Date(b.tradedAt).getTime());

  if (sorted.length === 0) return [];

  let equity = startingCapital;
  let peak = startingCapital;
  const points: EquityCurvePoint[] = [];

  for (const trade of sorted) {
    equity += (trade.realizedPnl ?? 0) - trade.fee;
    peak = Math.max(peak, equity);
    const drawdown = peak - equity;
    const drawdownPct = peak > 0 ? (drawdown / peak) * 100 : 0;

    points.push({
      date: trade.tradedAt.slice(0, 10),
      equity,
      drawdown,
      drawdownPct,
    });
  }

  return points;
};

/**
 * Recalculate asset balances from trade history.
 * Returns a map of asset -> { totalQuantity, avgBuyPrice, totalCost }.
 * Uses FIFO-like weighted average for cost basis.
 */
export const computeAssetBalancesFromTrades = (
  trades: Trade[],
): Map<string, { totalQuantity: number; avgBuyPrice: number; totalCost: number }> => {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.tradedAt).getTime() - new Date(b.tradedAt).getTime(),
  );

  const balances = new Map<
    string,
    { totalQuantity: number; avgBuyPrice: number; totalCost: number }
  >();

  for (const trade of sorted) {
    // Extract base asset from symbol (e.g., "BTC-USDT" -> "BTC")
    const asset = trade.symbol.split('-')[0] ?? trade.symbol;
    const current = balances.get(asset) ?? { totalQuantity: 0, avgBuyPrice: 0, totalCost: 0 };

    if (trade.side === 'buy') {
      const newCost = current.totalCost + trade.total;
      const newQty = current.totalQuantity + trade.quantity;
      current.totalQuantity = newQty;
      current.totalCost = newCost;
      current.avgBuyPrice = newQty > 0 ? newCost / newQty : 0;
    } else {
      // sell: reduce quantity, keep avg buy price, reduce cost proportionally
      const sellRatio =
        current.totalQuantity > 0
          ? Math.min(trade.quantity / current.totalQuantity, 1)
          : 0;
      current.totalQuantity = Math.max(0, current.totalQuantity - trade.quantity);
      current.totalCost = current.totalCost * (1 - sellRatio);
      // avgBuyPrice stays the same on sells (weighted average method)
    }

    balances.set(asset, current);
  }

  // Remove zero-quantity assets
  for (const [asset, bal] of balances) {
    if (bal.totalQuantity <= 0) balances.delete(asset);
  }

  return balances;
};
```

---

### Step 6: Extend Format Helpers

**File: `src/lib/format.ts`** — Add trading-specific formatters to the existing file. Do NOT modify existing functions.

Append after the existing `formatPercent` function:

```typescript
export const formatCrypto = (amount: number, decimals = 6): string => {
  if (amount === 0) return '0';
  // Use fewer decimals for larger amounts
  const d = amount >= 1 ? Math.min(decimals, 4) : decimals;
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: d,
  });
};

export const formatPnl = (amount: number): string => {
  const prefix = amount >= 0 ? '+' : '';
  return `${prefix}$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatPnlPct = (value: number): string => {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
};
```

---

### Step 7: UI Components

All components go in `src/components/trading/`. Each uses:
- Named export (`export const ComponentName: React.FC<Props>`)
- `interface ComponentNameProps` above the component
- CSS variables for theming: `var(--bg-primary)`, `var(--text-secondary)`, etc.
- `Card` from `@/components/ui/Card` for containers
- lucide-react icons

#### 7.1 — `PnlSummaryCards.tsx`

**Props:** `{ stats: TradingStats }`

Renders a grid of 4 stat cards (mirroring DashboardPage's stats grid at `features/dashboard/DashboardPage.tsx:25-44`):

| Card | Value | Border Color | Color Logic |
|------|-------|-------------|-------------|
| Total P&L | `stats.totalRealizedPnl` | `--accent-primary` | Green if positive, red if negative |
| Win Rate | `stats.winRate` + `stats.winCount`/`stats.lossCount` | `--accent-success` | Always `--accent-success` |
| Trade Count | `stats.totalTrades` | `--accent-info` | Neutral |
| Total Fees | `stats.totalFeesPaid` | `--accent-danger` | Always `--accent-danger` |

Use `formatPnl` and `formatPercent` from `@/lib/format`.

**Layout:** `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6`

#### 7.2 — `TradeForm.tsx`

**Props:** `{ strategyTags: StrategyTag[]; initialData?: Trade | null; onClose: () => void; onSubmit: (data: Omit<Trade, 'id' | 'createdAt' | 'total'>) => void; }`

Modal form mirroring the exact pattern from `components/transactions/TransactionForm.tsx`:
- Fixed overlay: `fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm`
- Modal container: `relative w-full max-w-md rounded-xl bg-[var(--bg-secondary)] p-6 shadow-2xl`
- Close button top-right with `X` icon

**Form fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Side | Toggle (buy/sell) | Yes | Two-button toggle like TransactionForm type selector |
| Symbol | Text input | Yes | Placeholder: `BTC-USDT`. Uppercase on change. |
| Price | Number input | Yes | Step 0.01, prefix `$` |
| Quantity | Number input | Yes | Step 0.000001 |
| Fee | Number input | No | Default 0, step 0.01 |
| Fee Currency | Text input | No | Default `USDT` |
| Strategy Tag | Select dropdown | No | Options from `strategyTags` prop + empty option |
| Date/Time | datetime-local input | Yes | Default: now |
| Notes | Textarea | No | 2 rows, placeholder "Trade notes..." |

**Side toggle styling:**
- Buy: green background when active (`bg-emerald-500/20 text-emerald-400`)
- Sell: red background when active (`bg-red-500/20 text-red-400`)

**Submit handler:** Construct the `Omit<Trade, 'id' | 'createdAt' | 'total'>` object. Set `source: 'manual'`. Convert `datetime-local` value to ISO string for `tradedAt`.

#### 7.3 — `TradeHistoryTable.tsx`

**Props:** `{ trades: Trade[]; strategyTags: StrategyTag[]; onEdit: (trade: Trade) => void; onDelete: (id: string) => void; }`

Mirror the exact pattern from `components/transactions/TransactionList.tsx`:
- Search bar + filter dropdowns (symbol, side, strategy tag)
- Desktop table view (`hidden md:block`) + mobile card view (`md:hidden`)
- Sortable columns: date, symbol, side, price, quantity, total, P&L
- Sort toggle function identical to TransactionList

**Table columns:**

| Column | Sortable | Format |
|--------|----------|--------|
| Date | Yes | `formatDate(trade.tradedAt)` |
| Symbol | No | Bold text |
| Side | No | Badge: green "BUY" / red "SELL" |
| Price | Yes | `formatCurrency(trade.price)` |
| Qty | No | `formatCrypto(trade.quantity)` |
| Total | Yes | `formatCurrency(trade.total)` |
| P&L | Yes | `formatPnl(trade.realizedPnl)` — green/red coloring |
| Strategy | No | Colored badge from `strategyTags` |
| Actions | No | Edit (Pencil) + Delete (Trash2) icons |

**Filters state:**
```typescript
const [search, setSearch] = useState('');
const [filterSide, setFilterSide] = useState<TradeSide | 'All'>('All');
const [filterSymbol, setFilterSymbol] = useState<string>('All');
const [filterStrategy, setFilterStrategy] = useState<string>('All');
const [sortField, setSortField] = useState<'traded_at' | 'price' | 'total' | 'realized_pnl'>('traded_at');
const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
```

**Mobile card layout:** Same structure as TransactionList's mobile view — side indicator dot (green/red), symbol + side as title, price and quantity as subtitle, P&L on the right.

#### 7.4 — `AssetBalancesTable.tsx`

**Props:** `{ balances: AssetBalance[] }`

Table within a `Card` showing current holdings:

| Column | Format |
|--------|--------|
| Asset | Bold text (e.g., `BTC`) |
| Quantity | `formatCrypto(balance.totalQuantity)` |
| Avg Buy Price | `formatCurrency(balance.avgBuyPrice)` |
| Total Cost | `formatCurrency(balance.totalCost)` |
| Allocation | Progress bar + percent |

Allocation percentage is pre-computed. Show a small colored bar proportional to allocation.

Empty state: "No holdings yet. Add your first trade to track assets."

#### 7.5 — `AllocationPieChart.tsx`

**Props:** `{ balances: AssetBalance[] }`

Donut chart using Recharts, mirroring `components/charts/BalanceChart.tsx:68-103` (the pie chart section):
- `PieChart` → `Pie` with `innerRadius={60}`, `outerRadius={80}`, `paddingAngle={5}`
- `dataKey="totalCost"` (allocation by cost basis)
- Color palette: predefined array of 8 distinct colors for up to 8 assets
- `Tooltip` with custom formatter showing asset name and value
- `Legend` at bottom

Height: `h-64`. Empty state if no balances.

#### 7.6 — `EquityCurveChart.tsx`

**Props:** `{ data: EquityCurvePoint[] }`

Area chart using Recharts:
- `AreaChart` with `ResponsiveContainer`
- Primary area: `equity` — fill gradient from `var(--accent-primary)` to transparent
- X axis: `date`, Y axis: equity value (formatted as currency)
- `Tooltip` showing date, equity, drawdown, drawdown %
- `CartesianGrid` with `strokeDasharray="3 3"`

Height: `h-72`. Empty state: "Complete some trades to see your equity curve."

#### 7.7 — `StrategyTagManager.tsx`

**Props:** `{ tags: StrategyTag[]; onSave: (tag: Omit<StrategyTag, 'id'>) => void; onDelete: (id: string) => void; }`

Simple CRUD list inside a `Card`:
- List of existing tags as colored badges with delete (X) button
- "Add Strategy" form: name input + color picker (hex input or 6 preset swatches) + save button
- Inline form, not a modal

#### 7.8 — `TradingGoals.tsx`

**Props:** `{ goals: TradingGoal[]; trades: Trade[]; onSave: (goal: Omit<TradingGoal, 'id'>) => void; }`

Card with:
- Current period goal display (this week / this month)
- Progress bar: realized P&L toward target
- Trade count toward max_trades limit
- Simple inline form to set/update goals for the current period
- Period selector: weekly / monthly toggle

---

### Step 8: TradingPage Rewrite

**File: `src/features/trading/TradingPage.tsx`** — Replace placeholder entirely.

**State management** — All state local to this page (independent of AppContext):

```typescript
const [trades, setTrades] = useState<Trade[]>([]);
const [assetBalances, setAssetBalances] = useState<AssetBalance[]>([]);
const [strategyTags, setStrategyTags] = useState<StrategyTag[]>([]);
const [tradingGoals, setTradingGoals] = useState<TradingGoal[]>([]);
const [activeTab, setActiveTab] = useState<TradingTab>('overview');
const [isTradeFormOpen, setIsTradeFormOpen] = useState(false);
const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
const [loading, setLoading] = useState(true);
```

**Data loading** — `useEffect` on mount loads all trading data in parallel:

```typescript
useEffect(() => {
  const fetchAll = async () => {
    const [tradesData, balancesData, tagsData, goalsData] = await Promise.all([
      loadTrades(),
      loadAssetBalances(),
      loadStrategyTags(),
      loadTradingGoals(),
    ]);
    setTrades(tradesData);
    setAssetBalances(balancesData);
    setStrategyTags(tagsData);
    setTradingGoals(goalsData);
    setLoading(false);
  };
  fetchAll();
}, []);
```

**Computed values:**

```typescript
const tradingStats = useMemo(() => computeTradingStats(trades), [trades]);
const equityCurve = useMemo(() => computeEquityCurve(trades, 10000), [trades]);
// 10000 as default starting capital — could be made configurable in Settings
```

**Trade handlers:**

```typescript
const handleSaveTrade = async (data: Omit<Trade, 'id' | 'createdAt' | 'total'>) => {
  if (editingTrade) {
    const updated = await updateTrade(editingTrade.id, data);
    if (updated) {
      setTrades((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    }
  } else {
    const saved = await saveTrade(data);
    if (saved) {
      setTrades((prev) => [saved, ...prev]);
    }
  }
  // Recalculate asset balances from updated trades
  await recalcBalances();
  setEditingTrade(null);
};

const handleDeleteTrade = async (id: string) => {
  if (!confirm('Delete this trade?')) return;
  await deleteTrade(id);
  setTrades((prev) => prev.filter((t) => t.id !== id));
  await recalcBalances();
};

const recalcBalances = async () => {
  // Recompute from local trades state and persist
  const computed = computeAssetBalancesFromTrades(trades);
  const promises = Array.from(computed.entries()).map(([asset, bal]) =>
    upsertAssetBalance({ asset, ...bal }),
  );
  const results = await Promise.all(promises);
  setAssetBalances(results.filter((r): r is AssetBalance => r !== null));
};
```

**Tab navigation:**

```typescript
const tabs: { id: TradingTab; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'trades', label: 'Trades', icon: ArrowLeftRight },
  { id: 'settings', label: 'Settings', icon: Settings },
  // Phase 2+: 'analytics', 'market', 'ai' tabs added later
];
```

Render as horizontal scrollable tab bar:

```tsx
<div className="flex gap-1 mb-6 border-b border-[var(--border-default)] overflow-x-auto">
  {tabs.map((tab) => (
    <button
      key={tab.id}
      onClick={() => setActiveTab(tab.id)}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        activeTab === tab.id
          ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
          : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
      }`}
    >
      <tab.icon size={16} />
      {tab.label}
    </button>
  ))}
</div>
```

**Tab content rendering:**

```tsx
{activeTab === 'overview' && (
  <div className="space-y-6 animate-in fade-in duration-300">
    <PnlSummaryCards stats={tradingStats} />
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2">
        <Card title="Equity Curve">
          <EquityCurveChart data={equityCurve} />
        </Card>
      </div>
      <div className="xl:col-span-1">
        <Card title="Portfolio Allocation">
          <AllocationPieChart balances={assetBalances} />
        </Card>
      </div>
    </div>
    <Card title="Holdings">
      <AssetBalancesTable balances={assetBalances} />
    </Card>
  </div>
)}

{activeTab === 'trades' && (
  <div className="space-y-6 animate-in fade-in duration-300">
    <div className="flex justify-end">
      <button
        onClick={() => { setEditingTrade(null); setIsTradeFormOpen(true); }}
        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-md transition-all active:scale-95"
      >
        <Plus size={20} />
        <span>Add Trade</span>
      </button>
    </div>
    <TradeHistoryTable
      trades={trades}
      strategyTags={strategyTags}
      onEdit={(trade) => { setEditingTrade(trade); setIsTradeFormOpen(true); }}
      onDelete={handleDeleteTrade}
    />
  </div>
)}

{activeTab === 'settings' && (
  <div className="space-y-6 animate-in fade-in duration-300">
    <StrategyTagManager
      tags={strategyTags}
      onSave={handleSaveStrategyTag}
      onDelete={handleDeleteStrategyTag}
    />
    <TradingGoals
      goals={tradingGoals}
      trades={trades}
      onSave={handleSaveTradingGoal}
    />
  </div>
)}
```

**Loading state:** Same spinner as `App.tsx:351-359`:

```tsx
if (loading) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Loader2 size={48} className="text-[var(--accent-primary)] animate-spin mb-4" />
      <p className="text-[var(--text-secondary)]">Loading trading data...</p>
    </div>
  );
}
```

**TradeForm modal** rendered at the bottom of the component (same pattern as `App.tsx:419-430`):

```tsx
{isTradeFormOpen && (
  <TradeForm
    strategyTags={strategyTags}
    initialData={editingTrade}
    onClose={() => { setIsTradeFormOpen(false); setEditingTrade(null); }}
    onSubmit={handleSaveTrade}
  />
)}
```

---

## Context

### Files to Modify

| File | Change |
|------|--------|
| `src/types/trading.ts` | Replace placeholder (Step 2) |
| `src/types/index.ts` | Update trading exports, remove `Position` (Step 3) |
| `src/lib/format.ts` | Append 3 new formatters (Step 6) |
| `src/features/trading/TradingPage.tsx` | Full rewrite (Step 8) |

### New Files

| File | Purpose |
|------|---------|
| `supabase/migrations/20260306_trading_tables.sql` | DB schema |
| `src/services/supabase/trading.ts` | Trading CRUD |
| `src/lib/tradingAnalytics.ts` | Pure analytics |
| `src/components/trading/PnlSummaryCards.tsx` | Stat cards |
| `src/components/trading/TradeForm.tsx` | Trade entry modal |
| `src/components/trading/TradeHistoryTable.tsx` | Trade list |
| `src/components/trading/AssetBalancesTable.tsx` | Holdings table |
| `src/components/trading/AllocationPieChart.tsx` | Donut chart |
| `src/components/trading/EquityCurveChart.tsx` | Area chart |
| `src/components/trading/StrategyTagManager.tsx` | Strategy CRUD |
| `src/components/trading/TradingGoals.tsx` | Goals + progress |

### Reference Files (Read Before Coding)

| File | Why |
|------|-----|
| `src/services/supabase/storage.ts` | Row mapper pattern, CRUD shape |
| `src/components/transactions/TransactionForm.tsx` | Modal form pattern, styling |
| `src/components/transactions/TransactionList.tsx` | Table + filters + sort pattern |
| `src/components/charts/BalanceChart.tsx` | Recharts config, pie chart pattern |
| `src/components/ui/Card.tsx` | Card component API |
| `src/features/dashboard/DashboardPage.tsx` | Stats grid layout, page structure |
| `src/lib/format.ts` | Existing formatters to reuse |
| `src/App.tsx` | Loading state, modal rendering pattern |

---

## Goal

After completing all 8 steps, the `/trading` route transforms from a static "Coming Soon" placeholder into a fully functional crypto trade tracker. Users can manually add/edit/delete trades, see P&L summary stats, view asset holdings with cost basis, explore their equity curve, manage strategy tags, and set trading goals — all persisted to Supabase with dark/light theme support.

---

## Acceptance Criteria

- [ ] 5 Supabase tables created and verified: `trades`, `asset_balances`, `watchlist`, `strategy_tags`, `trading_goals`
- [ ] `src/types/trading.ts` defines all types with no `any` — passes `npm run type-check`
- [ ] `src/services/supabase/trading.ts` provides full CRUD for all 5 tables
- [ ] `computeTradingStats()` correctly calculates win rate, P&L, profit factor from trades
- [ ] `computeEquityCurve()` produces monotonically-tracked equity with correct drawdown
- [ ] `computeAssetBalancesFromTrades()` correctly handles buy/sell weighted averages
- [ ] Can add a trade via `TradeForm` modal — trade appears in `TradeHistoryTable` and persists on refresh
- [ ] Can edit an existing trade — changes reflect in table and stats
- [ ] Can delete a trade — removed from table, stats recalculate, asset balances update
- [ ] Trade history table is searchable (by symbol), filterable (by side, strategy), and sortable (by date, price, total, P&L)
- [ ] P&L summary cards display: total P&L (colored), win rate, trade count, total fees
- [ ] Asset balances table shows: asset, quantity, avg buy price, total cost, allocation %
- [ ] Allocation pie chart renders correctly from asset balances
- [ ] Equity curve area chart renders from trade history
- [ ] Tab navigation works: Overview, Trades, Settings
- [ ] Strategy tags CRUD: can add, view, and delete strategy tags
- [ ] Trading goals: can set weekly/monthly target, see progress bar
- [ ] All components render correctly in both dark and light themes
- [ ] Loading spinner shows while data fetches
- [ ] Mobile responsive: table switches to card view on small screens
- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] `npm run lint` passes

---

## PR / Branch

- **Branch:** `feat/trading-core`
- **PR Title:** `feat: Trading command center — core data model, trade history, P&L`
- **Commit prefix:** `feat:` for new features, `chore:` for schema migration
