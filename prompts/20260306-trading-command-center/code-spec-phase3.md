---
slug: "20260306-trading-command-center"
title: "Trading Command Center — Phase 3: Advanced Analytics & Charts"
spec_type: code-spec
project: WF
domain: [trading, analytics]
source_repo: ""
notion_url: ""
gh_issue:
gh_prs: []
status: draft
published_at:
---

# Phase 3: Advanced Analytics & Charts — Code Spec

## Persona

You are a senior React/TypeScript engineer implementing Phase 3 (Advanced Analytics) of the WealthFlow Trading Command Center. You are intimately familiar with the existing codebase: Recharts charts (`components/trading/EquityCurveChart.tsx`, `components/charts/BalanceChart.tsx`), the analytics engine (`lib/tradingAnalytics.ts`), the TradingPage tab architecture (`features/trading/TradingPage.tsx`), CSS custom properties theming, and the Card component. You write TypeScript strict with no `any`, use named exports, and follow the project's conventions.

## Task

Implement Phase 3 of the Trading Command Center: add the **Analytics tab** with advanced charts and metrics. This includes a drawdown chart, time-based performance heatmap, hold duration histogram, strategy performance breakdown, extended risk metrics (Sharpe/Sortino ratios, max drawdown), and a dedicated P&L timeline chart. All analytics are computed client-side from existing trade data using pure functions.

### Deliverables (Ordered)

1. Extended TypeScript types for analytics (`src/types/trading.ts`)
2. Extended analytics engine functions (`src/lib/tradingAnalytics.ts`)
3. 6 new chart/analytics components (`src/components/trading/`)
4. TradingPage update — wire Analytics tab
5. Extended `TradingStats` with risk metrics in existing components

### Prerequisites (Phase 1 & 2 — Complete)

- Trades CRUD, asset balances, strategy tags, trading goals — all functional
- `computeTradingStats()`, `computeEquityCurve()`, `computeAssetBalancesFromTrades()` — built
- TradingPage with tabs: Overview, Trades, Settings (functional), Market (Phase 2)
- `TradingTab` type already includes `'analytics'` — tab is declared but not rendered
- Recharts already a dependency, used by `EquityCurveChart` and `BalanceChart`

---

## Steps

### Step 1: Extend TypeScript Types

**File: `src/types/trading.ts`** — Add new types. Do NOT modify existing types except `TradingStats`.

Append these new interfaces after the existing `TradeFilters` interface:

```typescript
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

export interface StrategyPerformance {
  strategy: string;
  color: string;
  stats: TradingStats;
}

export interface DrawdownPoint {
  date: string;
  drawdown: number;
  drawdownPct: number;
}
```

**Extend `TradingStats`** — Add risk metrics to the existing interface. Add these fields at the end:

```typescript
// Add to existing TradingStats interface:
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  avgHoldDurationMinutes: number;
  totalVolume: number;
```

**Update `src/types/index.ts`** — Add new type exports:

```typescript
// Add to the existing trading type exports:
export type {
  // ... existing exports ...
  TimeAnalysisBucket,
  TimeAnalysis,
  HoldDuration,
  PnlTimelinePoint,
  StrategyPerformance,
  DrawdownPoint,
} from './trading';
```

---

### Step 2: Extend Analytics Engine

**File: `src/lib/tradingAnalytics.ts`** — Add new pure functions. Also extend `computeTradingStats` to include the new risk metrics.

#### 2.1 — Update `computeTradingStats`

Add the new risk fields to the return object. The Sharpe and Sortino ratios require daily returns derived from the equity curve:

```typescript
// After existing calculations, add:

// Max drawdown from equity curve
const curve = computeEquityCurve(trades, 10000); // internal call
const maxDrawdown = curve.length > 0
  ? Math.max(...curve.map((p) => p.drawdown))
  : 0;
const maxDrawdownPct = curve.length > 0
  ? Math.max(...curve.map((p) => p.drawdownPct))
  : 0;

// Daily returns for Sharpe/Sortino
const dailyReturns = computeDailyReturns(trades);
const sharpeRatio = computeSharpeRatio(dailyReturns);
const sortinoRatio = computeSortinoRatio(dailyReturns);

// Average hold duration
const holdDurations = computeHoldDurations(trades);
const avgHoldDurationMinutes = holdDurations.length > 0
  ? holdDurations.reduce((s, h) => s + h.durationMinutes, 0) / holdDurations.length
  : 0;

// Total volume
const totalVolume = trades.reduce((s, t) => s + t.total, 0);
```

**Important:** `computeTradingStats` should NOT call `computeEquityCurve` with the full signature since they'd be circular. Instead, inline the drawdown calculation or use a private helper. The cleanest approach: extract a private `computeDrawdownMetrics` helper that both functions can use.

#### 2.2 — `computeTimeAnalysis`

```typescript
/**
 * Analyze trade performance by hour of day, day of week, and month.
 * Only trades with realizedPnl are included in win rate calculations.
 */
export const computeTimeAnalysis = (trades: Trade[]): TimeAnalysis => {
  const closingTrades = trades.filter((t) => t.realizedPnl != null);

  const byHour: Record<number, TimeAnalysisBucket> = {};
  const byDayOfWeek: Record<number, TimeAnalysisBucket> = {};
  const byMonth: Record<string, TimeAnalysisBucket> = {};

  for (const trade of closingTrades) {
    const date = new Date(trade.tradedAt);
    const hour = date.getUTCHours();
    const day = date.getUTCDay(); // 0=Sun, 6=Sat
    const month = trade.tradedAt.slice(0, 7); // YYYY-MM
    const pnl = trade.realizedPnl ?? 0;
    const isWin = pnl > 0;

    // Accumulate into each bucket
    // For each bucket: increment trades, add pnl, track wins for winRate
    // WinRate = (wins / trades) * 100
  }

  return { byHour, byDayOfWeek, byMonth };
};
```

#### 2.3 — `computeHoldDurations`

Pairs buy/sell trades for the same symbol to estimate hold duration. Uses a simple FIFO matching approach:

```typescript
/**
 * Estimate hold durations by pairing buy and sell trades per symbol (FIFO).
 * Returns durations in minutes with associated P&L.
 */
export const computeHoldDurations = (trades: Trade[]): HoldDuration[] => {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.tradedAt).getTime() - new Date(b.tradedAt).getTime(),
  );

  // Group buys by symbol as FIFO queues
  const buyQueues = new Map<string, { tradedAt: string; quantity: number; price: number }[]>();
  const durations: HoldDuration[] = [];

  for (const trade of sorted) {
    const symbol = trade.symbol;

    if (trade.side === 'buy') {
      const queue = buyQueues.get(symbol) ?? [];
      queue.push({ tradedAt: trade.tradedAt, quantity: trade.quantity, price: trade.price });
      buyQueues.set(symbol, queue);
    } else {
      // Sell: match against earliest buys (FIFO)
      const queue = buyQueues.get(symbol) ?? [];
      let remaining = trade.quantity;

      while (remaining > 0 && queue.length > 0) {
        const oldest = queue[0]!;
        const matched = Math.min(remaining, oldest.quantity);
        const durationMs = new Date(trade.tradedAt).getTime() - new Date(oldest.tradedAt).getTime();
        const pnl = matched * (trade.price - oldest.price);

        durations.push({
          durationMinutes: Math.max(0, durationMs / 60000),
          pnl,
          symbol,
        });

        remaining -= matched;
        oldest.quantity -= matched;
        if (oldest.quantity <= 0) queue.shift();
      }
    }
  }

  return durations;
};
```

#### 2.4 — `computePnlTimeline`

```typescript
/**
 * Aggregate realized P&L per day for timeline chart.
 */
export const computePnlTimeline = (trades: Trade[]): PnlTimelinePoint[] => {
  const closingTrades = trades.filter((t) => t.realizedPnl != null);
  const sorted = [...closingTrades].sort(
    (a, b) => new Date(a.tradedAt).getTime() - new Date(b.tradedAt).getTime(),
  );

  const dailyMap = new Map<string, number>();
  for (const trade of sorted) {
    const date = trade.tradedAt.slice(0, 10);
    dailyMap.set(date, (dailyMap.get(date) ?? 0) + (trade.realizedPnl ?? 0));
  }

  let cumulative = 0;
  const points: PnlTimelinePoint[] = [];
  for (const [date, pnl] of dailyMap) {
    cumulative += pnl;
    points.push({ date, pnl, cumulativePnl: cumulative });
  }

  return points;
};
```

#### 2.5 — `computeStrategyPerformance`

```typescript
/**
 * Compute TradingStats per strategy tag.
 */
export const computeStrategyPerformance = (
  trades: Trade[],
  strategyTags: StrategyTag[],
): StrategyPerformance[] => {
  const tagMap = new Map(strategyTags.map((t) => [t.name, t]));
  const grouped = new Map<string, Trade[]>();

  for (const trade of trades) {
    const key = trade.strategyTag ?? 'Untagged';
    const list = grouped.get(key) ?? [];
    list.push(trade);
    grouped.set(key, list);
  }

  return Array.from(grouped.entries()).map(([strategy, strategyTrades]) => ({
    strategy,
    color: tagMap.get(strategy)?.color ?? '#94a3b8',
    stats: computeTradingStats(strategyTrades),
  }));
};
```

#### 2.6 — Private Helpers (Sharpe/Sortino)

```typescript
/**
 * Compute daily P&L returns from trades.
 */
const computeDailyReturns = (trades: Trade[]): number[] => {
  const closingTrades = trades.filter((t) => t.realizedPnl != null);
  const sorted = [...closingTrades].sort(
    (a, b) => new Date(a.tradedAt).getTime() - new Date(b.tradedAt).getTime(),
  );

  const dailyMap = new Map<string, number>();
  for (const trade of sorted) {
    const date = trade.tradedAt.slice(0, 10);
    dailyMap.set(date, (dailyMap.get(date) ?? 0) + (trade.realizedPnl ?? 0));
  }

  return Array.from(dailyMap.values());
};

/**
 * Annualized Sharpe ratio from daily returns.
 * Formula: (mean - riskFreeRate) / stdDev * sqrt(252)
 * Risk-free rate assumed 0 for crypto.
 */
const computeSharpeRatio = (dailyReturns: number[]): number => {
  if (dailyReturns.length < 2) return 0;
  const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
  const variance =
    dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (dailyReturns.length - 1);
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;
  return (mean / stdDev) * Math.sqrt(252);
};

/**
 * Annualized Sortino ratio — like Sharpe but only penalizes downside volatility.
 * Formula: (mean - riskFreeRate) / downsideStdDev * sqrt(252)
 */
const computeSortinoRatio = (dailyReturns: number[]): number => {
  if (dailyReturns.length < 2) return 0;
  const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
  const negativeReturns = dailyReturns.filter((r) => r < 0);
  if (negativeReturns.length === 0) return mean > 0 ? Infinity : 0;
  const downsideVariance =
    negativeReturns.reduce((s, r) => s + r ** 2, 0) / negativeReturns.length;
  const downsideStdDev = Math.sqrt(downsideVariance);
  if (downsideStdDev === 0) return 0;
  return (mean / downsideStdDev) * Math.sqrt(252);
};
```

---

### Step 3: Chart Components

All components go in `src/components/trading/`. Each uses:
- Named export (`export const ComponentName: React.FC<Props>`)
- `interface ComponentNameProps` above the component
- CSS variables for theming: `var(--bg-secondary)`, `var(--text-muted)`, `var(--border-subtle)`, etc.
- Recharts with `ResponsiveContainer`
- Empty state message when data is empty
- Follow the exact Recharts patterns from `EquityCurveChart.tsx` (gradient defs, axis styling, tooltip styling)

#### 3.1 — `DrawdownChart.tsx`

**File: `src/components/trading/DrawdownChart.tsx`** (new)

**Props:** `{ data: EquityCurvePoint[] }`

Inverted area chart showing drawdown from peak over time. Uses the `drawdownPct` field from the existing equity curve data.

```typescript
// Key Recharts config:
// - AreaChart with data mapped to { date, drawdownPct: -point.drawdownPct }
//   (negate so drawdown goes below zero)
// - Area: fill gradient from red to transparent, stroke red
// - YAxis: show negative percentages
// - Tooltip: show date, drawdown $, drawdown %
// - Reference line at y=0

// Gradient definition:
// <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
//   <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
//   <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
// </linearGradient>
```

Height: `h-64`. Empty state: "Complete some trades to see drawdown analysis."

#### 3.2 — `PnlTimelineChart.tsx`

**File: `src/components/trading/PnlTimelineChart.tsx`** (new)

**Props:** `{ data: PnlTimelinePoint[] }`

Composite chart showing daily P&L as bars (green/red) with cumulative P&L as an overlay line.

```typescript
// Key Recharts config:
// - ComposedChart
// - Bar: dataKey="pnl", green fill for positive, red for negative
//   Use <Cell> to conditionally color each bar
// - Line: dataKey="cumulativePnl", stroke indigo, strokeWidth 2
// - XAxis: dataKey="date"
// - Two YAxes: left for daily P&L, right for cumulative
// - Tooltip: show date, daily P&L (formatted with formatPnl), cumulative P&L

// Bar coloring per entry:
// <Bar dataKey="pnl" yAxisId="left">
//   {data.map((entry, idx) => (
//     <Cell key={idx} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
//   ))}
// </Bar>
```

Height: `h-72`. Empty state: "Complete some trades to see P&L timeline."

#### 3.3 — `TimeAnalysisChart.tsx`

**File: `src/components/trading/TimeAnalysisChart.tsx`** (new)

**Props:** `{ data: TimeAnalysis }`

Tab-switchable view showing performance by hour, day of week, or month.

Internal state: `activeView: 'hour' | 'day' | 'month'`

**Hour view:** Bar chart, X axis = 0-23, Y axis = P&L, bar color by positive/negative.

**Day view:** Bar chart, X axis = Mon-Sun labels, Y axis = P&L.

**Month view:** Bar chart, X axis = month labels (e.g., "2026-01"), Y axis = P&L.

Each bar has a tooltip showing: trade count, total P&L, win rate.

```typescript
// Day labels mapping:
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Transform data for the active view:
// Map Record<key, TimeAnalysisBucket> to array of { label, trades, pnl, winRate }
```

Height: `h-72`. View toggle: 3 small buttons above the chart, styled like the TradingPage tab bar but smaller.

#### 3.4 — `HoldDurationChart.tsx`

**File: `src/components/trading/HoldDurationChart.tsx`** (new)

**Props:** `{ data: HoldDuration[] }`

Scatter plot showing hold duration vs P&L for each matched trade pair.

```typescript
// Key Recharts config:
// - ScatterChart
// - Scatter: dataKey mapped to { x: durationMinutes, y: pnl }
// - XAxis: duration in human-readable format
//   - < 60 min: show as minutes
//   - >= 60 min and < 1440: show as hours
//   - >= 1440: show as days
// - YAxis: P&L in dollars
// - Tooltip: show symbol, duration (formatted), P&L (formatPnl)
// - ReferenceLine at y=0 (dashed)
// - Dot coloring: green for positive P&L, red for negative

// For the scatter data, map each HoldDuration to:
// { x: duration, y: pnl, symbol, fill: pnl >= 0 ? '#10b981' : '#ef4444' }
```

Height: `h-72`. Empty state: "Need matched buy/sell pairs to analyze hold durations."

#### 3.5 — `StrategyPerformance.tsx`

**File: `src/components/trading/StrategyPerformance.tsx`** (new)

**Props:** `{ data: StrategyPerformance[] }`

Comparison view of performance metrics per strategy tag. Two sections:

**Section 1: Grouped bar chart** comparing key metrics across strategies:
- X axis: strategy names
- Bars: Total P&L, Win Rate (secondary Y axis as %)
- Bar colors from strategy tag colors

**Section 2: Summary table** below the chart:

| Strategy | Trades | Win Rate | Avg Win | Avg Loss | Profit Factor | Total P&L |
|----------|--------|----------|---------|----------|---------------|-----------|

- Use the strategy tag's color as a badge dot before the name
- Sort by total P&L descending
- Color P&L values green/red

```typescript
// Table structure mirrors TradeHistoryTable pattern (desktop table + mobile cards)
// Use Card component as wrapper
```

Height: chart `h-64`, table below. Empty state: "Tag your trades with strategies to see performance breakdown."

#### 3.6 — `RiskMetricsCards.tsx`

**File: `src/components/trading/RiskMetricsCards.tsx`** (new)

**Props:** `{ stats: TradingStats }`

Grid of 6 stat cards showing advanced risk metrics. Follows the exact same pattern as `PnlSummaryCards.tsx`.

| Card | Value | Format | Subtitle |
|------|-------|--------|----------|
| Max Drawdown | `stats.maxDrawdown` | `formatPnl()` | `stats.maxDrawdownPct` as % |
| Sharpe Ratio | `stats.sharpeRatio` | 2 decimal places | "Annualized (252 trading days)" |
| Sortino Ratio | `stats.sortinoRatio` | 2 decimal places | "Downside risk adjusted" |
| Avg Hold | `stats.avgHoldDurationMinutes` | Human-readable duration | "Average trade duration" |
| Total Volume | `stats.totalVolume` | `formatCurrency()` | "Lifetime trading volume" |
| Profit Factor | `stats.profitFactor` | 2 decimal places | "> 1.0 is profitable" |

```typescript
// Layout: grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4
// Border color logic:
//   Sharpe/Sortino: green if > 1, yellow if 0-1, red if negative
//   Max Drawdown: always red border
//   Profit Factor: green if > 1, red if <= 1

// Duration formatting helper (inline):
const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)}h`;
  return `${(minutes / 1440).toFixed(1)}d`;
};
```

---

### Step 4: Wire Analytics Tab in TradingPage

**File: `src/features/trading/TradingPage.tsx`** — Update to render the Analytics tab.

#### 4.1 — New Imports

```typescript
import { BarChart3 } from 'lucide-react';
import {
  computeTimeAnalysis,
  computeHoldDurations,
  computePnlTimeline,
  computeStrategyPerformance,
} from '@/lib/tradingAnalytics';
import { DrawdownChart } from '@/components/trading/DrawdownChart';
import { PnlTimelineChart } from '@/components/trading/PnlTimelineChart';
import { TimeAnalysisChart } from '@/components/trading/TimeAnalysisChart';
import { HoldDurationChart } from '@/components/trading/HoldDurationChart';
import { StrategyPerformance as StrategyPerformanceView } from '@/components/trading/StrategyPerformance';
import { RiskMetricsCards } from '@/components/trading/RiskMetricsCards';
```

#### 4.2 — Add Analytics Tab to TABS Array

Add after the `'trades'` tab entry:

```typescript
{ id: 'analytics' as TradingTab, label: 'Analytics', icon: BarChart3 },
```

#### 4.3 — Add Computed Values

After the existing `equityCurve` useMemo, add:

```typescript
const timeAnalysis = useMemo(() => computeTimeAnalysis(trades), [trades]);
const holdDurations = useMemo(() => computeHoldDurations(trades), [trades]);
const pnlTimeline = useMemo(() => computePnlTimeline(trades), [trades]);
const strategyPerformance = useMemo(
  () => computeStrategyPerformance(trades, strategyTags),
  [trades, strategyTags],
);
```

#### 4.4 — Add Analytics Tab Content

After the Trades tab conditional block, add:

```tsx
{activeTab === 'analytics' && (
  <div className="space-y-6 animate-in fade-in duration-300">
    <RiskMetricsCards stats={tradingStats} />

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Card title="P&L Timeline">
        <PnlTimelineChart data={pnlTimeline} />
      </Card>
      <Card title="Drawdown from Peak">
        <DrawdownChart data={equityCurve} />
      </Card>
    </div>

    <Card title="Performance by Time">
      <TimeAnalysisChart data={timeAnalysis} />
    </Card>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Card title="Hold Duration vs P&L">
        <HoldDurationChart data={holdDurations} />
      </Card>
      <Card title="Strategy Performance">
        <StrategyPerformanceView data={strategyPerformance} />
      </Card>
    </div>
  </div>
)}
```

---

## Context

### Files to Modify

| File | Change |
|------|--------|
| `src/types/trading.ts` | Add 6 new interfaces, extend TradingStats with risk metrics |
| `src/types/index.ts` | Export new types |
| `src/lib/tradingAnalytics.ts` | Add 5 new functions, extend computeTradingStats, add private helpers |
| `src/features/trading/TradingPage.tsx` | Add Analytics tab, computed values, imports |

### New Files

| File | Purpose |
|------|---------|
| `src/components/trading/DrawdownChart.tsx` | Inverted area chart of drawdown from peak |
| `src/components/trading/PnlTimelineChart.tsx` | Daily P&L bars + cumulative line |
| `src/components/trading/TimeAnalysisChart.tsx` | Performance heatmap by hour/day/month |
| `src/components/trading/HoldDurationChart.tsx` | Scatter plot of hold duration vs P&L |
| `src/components/trading/StrategyPerformance.tsx` | Strategy comparison chart + table |
| `src/components/trading/RiskMetricsCards.tsx` | Risk metric stat cards grid |

### Reference Files (Read Before Coding)

| File | Why |
|------|-----|
| `src/components/trading/EquityCurveChart.tsx` | Recharts patterns: gradient defs, axis styling, tooltip, theme vars |
| `src/components/trading/PnlSummaryCards.tsx` | Stat card layout pattern for RiskMetricsCards |
| `src/components/trading/TradeHistoryTable.tsx` | Table pattern (desktop + mobile) for StrategyPerformance table |
| `src/components/charts/BalanceChart.tsx` | Pie/bar chart Recharts config, Cell coloring |
| `src/lib/tradingAnalytics.ts` | Existing analytics functions to extend |
| `src/types/trading.ts` | Existing types to extend |
| `src/features/trading/TradingPage.tsx` | Tab wiring pattern |
| `src/lib/format.ts` | formatPnl, formatCurrency, formatPercent |

### Recharts Components Used

| Component | From | Used In |
|-----------|------|---------|
| `AreaChart`, `Area` | recharts | DrawdownChart |
| `ComposedChart`, `Bar`, `Line` | recharts | PnlTimelineChart |
| `BarChart`, `Bar`, `Cell` | recharts | TimeAnalysisChart, StrategyPerformance |
| `ScatterChart`, `Scatter` | recharts | HoldDurationChart |
| `ResponsiveContainer` | recharts | All charts |
| `XAxis`, `YAxis`, `Tooltip`, `CartesianGrid`, `ReferenceLine`, `Legend` | recharts | Various |

---

## Goal

After completing all steps, the Analytics tab provides deep insights into trading performance: P&L timeline showing daily gains/losses, drawdown visualization, time-based analysis revealing the best hours/days to trade, hold duration analysis for optimizing trade timing, strategy comparison to identify the most profitable approaches, and risk metrics (Sharpe, Sortino, max drawdown) for portfolio-level assessment.

---

## Acceptance Criteria

### Types
- [ ] `TimeAnalysis`, `TimeAnalysisBucket`, `HoldDuration`, `PnlTimelinePoint`, `StrategyPerformance`, `DrawdownPoint` defined in `src/types/trading.ts`
- [ ] `TradingStats` extended with `maxDrawdown`, `maxDrawdownPct`, `sharpeRatio`, `sortinoRatio`, `avgHoldDurationMinutes`, `totalVolume`
- [ ] All new types exported from `src/types/index.ts`

### Analytics Engine
- [ ] `computeTimeAnalysis()` correctly buckets trades by hour (0-23), day of week (0-6), and month (YYYY-MM)
- [ ] `computeHoldDurations()` pairs buy/sell trades per symbol using FIFO and returns correct durations in minutes
- [ ] `computePnlTimeline()` aggregates daily P&L and tracks cumulative P&L correctly
- [ ] `computeStrategyPerformance()` returns per-strategy `TradingStats` with correct tag colors
- [ ] Sharpe ratio computed as `(mean / stdDev) * sqrt(252)` from daily returns
- [ ] Sortino ratio uses only downside (negative) returns for volatility
- [ ] Max drawdown correctly identifies the largest peak-to-trough decline
- [ ] All functions handle empty trade arrays gracefully (return empty/zero)

### Charts
- [ ] DrawdownChart renders inverted area chart with red gradient, negative Y axis
- [ ] PnlTimelineChart renders daily P&L bars (green/red) with cumulative line overlay
- [ ] TimeAnalysisChart toggles between hour, day-of-week, and month views
- [ ] HoldDurationChart renders scatter plot with green/red dots, reference line at y=0
- [ ] StrategyPerformance renders grouped bar chart + summary table
- [ ] RiskMetricsCards renders 6 stat cards with color-coded borders

### Integration
- [ ] Analytics tab visible in TradingPage tab bar with BarChart3 icon
- [ ] Clicking Analytics tab renders all 6 chart sections
- [ ] All computed values use `useMemo` for performance
- [ ] All charts render correctly in both dark and light themes (use CSS custom properties)
- [ ] All charts have responsive containers and appropriate empty states
- [ ] Mobile responsive — charts stack vertically on small screens

### Code Quality
- [ ] No `any` types — TypeScript strict
- [ ] `npm run build` succeeds with zero errors
- [ ] `npm run lint` passes (warnings OK, zero errors)
- [ ] All components use named exports and follow project conventions

---

## PR / Branch

- **Branch:** `feat/trading-analytics`
- **PR Title:** `feat: Advanced trading analytics — drawdown, time analysis, strategy performance`
- **Commit prefix:** `feat:` for new features
