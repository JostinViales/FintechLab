---
slug: "20260306-trading-command-center"
title: "Trading Command Center — Phase 4: AI Features & Risk Management"
spec_type: code-spec
project: WF
domain: [trading, ai, risk-management]
source_repo: ""
notion_url: ""
gh_issue:
gh_prs: []
status: draft
published_at:
---

# Phase 4: AI Features & Risk Management — Code Spec

## Persona

You are a senior React/TypeScript engineer implementing Phase 4 (AI & Risk Management) of the WealthFlow Trading Command Center. You are deeply familiar with the existing Gemini AI service (`services/gemini.ts`), the trading types and analytics engine (`types/trading.ts`, `lib/tradingAnalytics.ts`), the TradingPage tab architecture, and all codebase conventions (CSS custom properties, Card component, named exports, no `any`). You understand prompt engineering for financial analysis and how to structure AI interactions for actionable trading insights.

## Task

Implement Phase 4 of the Trading Command Center: add the **AI Insights tab** with Gemini-powered trade analysis, and a **Position Sizing Calculator** and **Trading Limits** in the Settings tab. This phase extends the existing Gemini service with trading-specific prompt templates, builds 4 AI insight components, and adds practical risk management tools.

### Deliverables (Ordered)

1. Extend Gemini service with trading AI functions (`src/services/gemini.ts`)
2. Trading AI response types (`src/types/trading.ts`)
3. 4 AI insight components (`src/components/trading/ai/`)
4. Position sizing calculator component (`src/components/trading/PositionSizingCalc.tsx`)
5. Trading limits component (`src/components/trading/TradingLimits.tsx`)
6. Supabase migration for `trading_limits` table
7. Trading limits service functions (`src/services/supabase/trading.ts`)
8. TradingPage update — wire AI tab and Settings additions

### Prerequisites (Phase 1-3 — Complete)

- Full trade CRUD, asset balances, strategy tags, trading goals
- `TradingStats` with Sharpe, Sortino, max drawdown, hold duration metrics
- Analytics tab with all Phase 3 charts
- `TradingTab` type includes `'ai'` — tab is declared but not rendered
- Gemini service (`services/gemini.ts`) has working `askFinancialAdvisor()` function
- Gemini model: `'gemini-3-pro-preview'` with `thinkingConfig: { thinkingBudget: 2048 }`

---

## Steps

### Step 1: Supabase Migration — Trading Limits

**File: `supabase/migrations/20260306_trading_limits.sql`** (new)

```sql
CREATE TABLE IF NOT EXISTS trading_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  max_trades INTEGER,
  max_loss NUMERIC,
  max_capital NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one active limit per period type
CREATE UNIQUE INDEX IF NOT EXISTS idx_trading_limits_active
  ON trading_limits (period_type) WHERE is_active = true;
```

---

### Step 2: Extend TypeScript Types

**File: `src/types/trading.ts`** — Add AI response and trading limits types.

Append after existing types:

```typescript
// --- Phase 4: AI & Risk Management Types ---

export interface TradingLimit {
  id: string;
  periodType: 'daily' | 'weekly' | 'monthly';
  maxTrades?: number;
  maxLoss?: number;
  maxCapital?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TradingLimitStatus {
  limit: TradingLimit;
  currentTrades: number;
  currentLoss: number;
  currentCapital: number;
  tradesExceeded: boolean;
  lossExceeded: boolean;
  capitalExceeded: boolean;
}

export interface PositionSizeResult {
  quantity: number;
  riskAmount: number;
  positionValue: number;
  riskRewardRatio: number;
}

// AI response types — structured for UI rendering

export interface TradeSignalAnalysis {
  summary: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  keyLevels: { type: 'support' | 'resistance'; price: number; note: string }[];
  entryZone?: { low: number; high: number };
  stopLoss?: number;
  takeProfit?: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  score: number; // 0-100
  factors: { name: string; severity: 'low' | 'medium' | 'high'; description: string }[];
  suggestions: string[];
}

export interface JournalSummary {
  overview: string;
  patterns: { pattern: string; frequency: string; impact: string }[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface RebalancingSuggestion {
  asset: string;
  currentPct: number;
  targetPct: number;
  action: 'buy' | 'sell' | 'hold';
  amount: number;
  reasoning: string;
}
```

**Update `src/types/index.ts`** — Add to trading exports:

```typescript
export type {
  // ... existing exports ...
  TradingLimit,
  TradingLimitStatus,
  PositionSizeResult,
  TradeSignalAnalysis,
  RiskAssessment,
  JournalSummary,
  RebalancingSuggestion,
} from './trading';
```

---

### Step 3: Extend Gemini Service

**File: `src/services/gemini.ts`** — Add 4 new trading-specific AI functions. Do NOT modify the existing `askFinancialAdvisor` function.

Each function follows the same pattern:
1. Get client via `getClient()`
2. Build a context-rich prompt with structured trade data
3. Call `client.models.generateContent()` with `gemini-3-pro-preview` and thinking config
4. Parse the response text as JSON (wrapped in try/catch)
5. Return typed result or fallback

**Important:** The AI returns free-form text. Each function should request JSON output in the prompt and parse it. If parsing fails, return a sensible fallback with the raw text in the `summary`/`overview` field.

#### 3.1 — `analyzeTradeSignals`

```typescript
import type {
  Trade,
  AssetBalance,
  TradingStats,
  TradeSignalAnalysis,
  RiskAssessment,
  JournalSummary,
  RebalancingSuggestion,
} from '@/types';

export const analyzeTradeSignals = async (
  symbol: string,
  recentTrades: Trade[],
  assetBalances: AssetBalance[],
): Promise<TradeSignalAnalysis> => {
  const client = getClient();
  if (!client) {
    return {
      summary: 'Please configure your API Key to use AI trading analysis.',
      sentiment: 'neutral',
      keyLevels: [],
      confidence: 'low',
      reasoning: 'API key not configured.',
    };
  }

  // Build context:
  // - Symbol being analyzed
  // - Last 20 trades for this symbol (price, side, quantity, date, P&L)
  // - Current position in this asset (from assetBalances)
  // - Recent price action from trades (highest/lowest prices in recent trades)

  const symbolTrades = recentTrades
    .filter((t) => t.symbol === symbol)
    .slice(0, 20);

  const position = assetBalances.find(
    (a) => a.asset === symbol.split('-')[0],
  );

  const prompt = `
    You are an expert crypto trading analyst. Analyze the following trading data for ${symbol}
    and provide structured trade signals.

    **Current Position:**
    ${position ? `Holding ${position.totalQuantity} units, avg buy price $${position.avgBuyPrice.toFixed(2)}, total cost $${position.totalCost.toFixed(2)}` : 'No current position'}

    **Recent Trades (${symbol}):**
    ${symbolTrades.map((t) => `${t.tradedAt.slice(0, 16)} | ${t.side.toUpperCase()} | Price: $${t.price} | Qty: ${t.quantity} | P&L: ${t.realizedPnl != null ? `$${t.realizedPnl.toFixed(2)}` : 'N/A'}`).join('\n')}

    **Instructions:**
    Respond ONLY with a valid JSON object (no markdown, no code fences) matching this structure:
    {
      "summary": "Brief 1-2 sentence overview",
      "sentiment": "bullish" | "bearish" | "neutral",
      "keyLevels": [{"type": "support" | "resistance", "price": number, "note": "string"}],
      "entryZone": {"low": number, "high": number} | null,
      "stopLoss": number | null,
      "takeProfit": number | null,
      "confidence": "low" | "medium" | "high",
      "reasoning": "Detailed reasoning paragraph"
    }

    Base your analysis on the trade history patterns, not external data.
    If there's insufficient data, say so in the summary and use "low" confidence.
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 2048 } },
    });

    const text = response.text ?? '';
    // Try to parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as TradeSignalAnalysis;
    }

    return {
      summary: text,
      sentiment: 'neutral',
      keyLevels: [],
      confidence: 'low',
      reasoning: text,
    };
  } catch (error) {
    console.error('Gemini trade signal error:', error);
    return {
      summary: 'Error analyzing trade signals. Please try again.',
      sentiment: 'neutral',
      keyLevels: [],
      confidence: 'low',
      reasoning: 'API error occurred.',
    };
  }
};
```

#### 3.2 — `assessPortfolioRisk`

```typescript
export const assessPortfolioRisk = async (
  assetBalances: AssetBalance[],
  trades: Trade[],
  stats: TradingStats,
): Promise<RiskAssessment> => {
  // Context includes:
  // - All current positions (asset, quantity, avg price, cost, allocation %)
  // - Key trading stats (win rate, profit factor, max drawdown, Sharpe)
  // - Recent losing streak (consecutive losses from recent trades)
  // - Concentration risk (top position as % of total)
  // - Total portfolio value

  const totalCost = assetBalances.reduce((s, a) => s + a.totalCost, 0);
  const positions = assetBalances.map((a) => ({
    asset: a.asset,
    quantity: a.totalQuantity,
    avgPrice: a.avgBuyPrice,
    cost: a.totalCost,
    pct: totalCost > 0 ? ((a.totalCost / totalCost) * 100).toFixed(1) : '0',
  }));

  const prompt = `
    You are a crypto portfolio risk manager. Assess the risk of this trading portfolio.

    **Portfolio Positions:**
    ${positions.map((p) => `${p.asset}: ${p.quantity} units @ $${p.avgPrice.toFixed(2)} (${p.pct}% of portfolio, $${p.cost.toFixed(2)})`).join('\n')}

    **Trading Statistics:**
    - Total Trades: ${stats.totalTrades}
    - Win Rate: ${stats.winRate.toFixed(1)}%
    - Profit Factor: ${stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
    - Max Drawdown: ${stats.maxDrawdownPct.toFixed(1)}%
    - Sharpe Ratio: ${stats.sharpeRatio.toFixed(2)}
    - Largest Win: $${stats.largestWin.toFixed(2)}
    - Largest Loss: $${stats.largestLoss.toFixed(2)}

    Respond ONLY with a valid JSON object (no markdown, no code fences):
    {
      "overallRisk": "low" | "medium" | "high" | "critical",
      "score": number (0-100, higher = more risky),
      "factors": [{"name": "string", "severity": "low" | "medium" | "high", "description": "string"}],
      "suggestions": ["string"]
    }

    Consider: concentration risk, drawdown levels, win rate trends, position sizing,
    correlation between held assets, and overall portfolio balance.
  `;

  // Same try/catch pattern as analyzeTradeSignals
  // Fallback: { overallRisk: 'medium', score: 50, factors: [], suggestions: ['Unable to assess...'] }
};
```

#### 3.3 — `summarizeTradeJournal`

```typescript
export const summarizeTradeJournal = async (
  trades: Trade[],
  stats: TradingStats,
): Promise<JournalSummary> => {
  // Context includes:
  // - Last 50 trades with full details (symbol, side, price, qty, P&L, strategy, notes, date)
  // - Aggregate stats
  // - Strategy breakdown (which strategies used, how many trades each)
  // - Timing patterns (morning vs afternoon trades)

  const recentTrades = trades.slice(0, 50);
  const strategyBreakdown = new Map<string, number>();
  for (const t of recentTrades) {
    const tag = t.strategyTag ?? 'Untagged';
    strategyBreakdown.set(tag, (strategyBreakdown.get(tag) ?? 0) + 1);
  }

  const prompt = `
    You are a trading psychology coach and journal analyst. Analyze the trading history
    and identify behavioral patterns, strengths, and areas for improvement.

    **Trading Statistics:**
    - Total Trades: ${stats.totalTrades}
    - Win Rate: ${stats.winRate.toFixed(1)}%
    - Avg Win: $${stats.avgWin.toFixed(2)} | Avg Loss: $${stats.avgLoss.toFixed(2)}
    - Profit Factor: ${stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
    - Largest Win: $${stats.largestWin.toFixed(2)} | Largest Loss: $${stats.largestLoss.toFixed(2)}
    - Max Drawdown: ${stats.maxDrawdownPct.toFixed(1)}%

    **Strategy Usage:**
    ${Array.from(strategyBreakdown.entries()).map(([s, c]) => `${s}: ${c} trades`).join('\n')}

    **Recent Trades (Last 50):**
    ${recentTrades.map((t) => `${t.tradedAt.slice(0, 16)} | ${t.side.toUpperCase()} ${t.symbol} | $${t.price} x ${t.quantity} | P&L: ${t.realizedPnl != null ? `$${t.realizedPnl.toFixed(2)}` : 'open'} | Strategy: ${t.strategyTag ?? 'none'} | Notes: ${t.notes ?? '-'}`).join('\n')}

    Respond ONLY with a valid JSON object (no markdown, no code fences):
    {
      "overview": "2-3 sentence summary of trading behavior",
      "patterns": [{"pattern": "name", "frequency": "how often", "impact": "positive/negative impact"}],
      "strengths": ["string"],
      "weaknesses": ["string"],
      "recommendations": ["specific actionable recommendation"]
    }

    Focus on: emotional patterns (revenge trading, FOMO), sizing consistency,
    strategy adherence, timing patterns, and risk management discipline.
  `;

  // Same try/catch pattern
  // Fallback: { overview: rawText, patterns: [], strengths: [], weaknesses: [], recommendations: [] }
};
```

#### 3.4 — `suggestRebalancing`

```typescript
export const suggestRebalancing = async (
  assetBalances: AssetBalance[],
  totalPortfolioValue: number,
): Promise<RebalancingSuggestion[]> => {
  // Context includes:
  // - Current allocations (asset, quantity, cost, allocation %)
  // - Total portfolio value
  // - Number of unique assets

  const totalCost = assetBalances.reduce((s, a) => s + a.totalCost, 0);
  const positions = assetBalances.map((a) => ({
    asset: a.asset,
    cost: a.totalCost,
    pct: totalCost > 0 ? (a.totalCost / totalCost) * 100 : 0,
  }));

  const prompt = `
    You are a crypto portfolio strategist. Analyze the current portfolio allocation
    and suggest rebalancing actions for better diversification and risk management.

    **Current Portfolio ($${totalCost.toFixed(2)} total):**
    ${positions.map((p) => `${p.asset}: $${p.cost.toFixed(2)} (${p.pct.toFixed(1)}%)`).join('\n')}

    Respond ONLY with a valid JSON array (no markdown, no code fences):
    [
      {
        "asset": "string",
        "currentPct": number,
        "targetPct": number,
        "action": "buy" | "sell" | "hold",
        "amount": number (USD value to buy/sell),
        "reasoning": "why this adjustment"
      }
    ]

    Guidelines:
    - Suggest a balanced allocation based on common crypto portfolio strategies
    - If heavily concentrated in one asset (>50%), suggest reducing
    - Consider adding stablecoin allocation if none exists
    - Keep suggestions practical (minimum $50 trades)
    - If portfolio is already well-balanced, use "hold" actions
  `;

  // Same try/catch pattern
  // Parse as JSON array, fallback: []
};
```

---

### Step 4: AI Insight Components

**Directory: `src/components/trading/ai/`** (new directory)

All components follow these patterns:
- Named export
- Loading state while AI generates response
- Error state with retry button
- CSS custom properties for theming
- Card component for containers
- lucide-react icons

#### 4.1 — `TradeSignalAnalysis.tsx`

**File: `src/components/trading/ai/TradeSignalAnalysis.tsx`** (new)

**Props:**
```typescript
interface TradeSignalAnalysisProps {
  trades: Trade[];
  assetBalances: AssetBalance[];
}
```

**Features:**
- Symbol selector dropdown (populated from unique symbols in trades)
- "Analyze" button to trigger analysis
- Loading spinner while Gemini processes
- Results display:
  - Sentiment badge: green "Bullish", red "Bearish", gray "Neutral"
  - Confidence badge: "Low", "Medium", "High" with color
  - Summary text
  - Key levels table: Support/Resistance with prices and notes
  - Entry zone, stop loss, take profit displayed as a visual price ladder
  - Detailed reasoning paragraph

**Layout:**
```tsx
<div className="space-y-4">
  {/* Symbol selector + Analyze button */}
  <div className="flex gap-3">
    <select ...>{uniqueSymbols}</select>
    <button onClick={handleAnalyze}>
      <Brain size={16} /> Analyze
    </button>
  </div>

  {/* Loading state */}
  {loading && <Loader2 className="animate-spin" />}

  {/* Results */}
  {result && (
    <>
      <div className="flex gap-2">
        <SentimentBadge sentiment={result.sentiment} />
        <ConfidenceBadge confidence={result.confidence} />
      </div>
      <p>{result.summary}</p>

      {/* Key Levels */}
      <table>...</table>

      {/* Entry/Stop/Target */}
      {result.entryZone && <PriceLadder ... />}

      {/* Reasoning */}
      <p className="text-sm text-[var(--text-secondary)]">{result.reasoning}</p>
    </>
  )}
</div>
```

#### 4.2 — `RiskAssessment.tsx`

**File: `src/components/trading/ai/RiskAssessment.tsx`** (new)

**Props:**
```typescript
interface RiskAssessmentProps {
  assetBalances: AssetBalance[];
  trades: Trade[];
  stats: TradingStats;
}
```

**Features:**
- "Assess Risk" button to trigger assessment
- Loading state
- Results display:
  - Overall risk level as a large badge: Low (green), Medium (yellow), High (orange), Critical (red)
  - Risk score as a circular progress indicator (0-100)
  - Risk factors list: each factor has severity badge + description
  - Suggestions as an ordered list with checkmark icons

**Risk score visual:**
```tsx
// Circular progress ring using SVG
// Color: green (0-25), yellow (26-50), orange (51-75), red (76-100)
<svg viewBox="0 0 100 100" className="w-24 h-24">
  <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border-subtle)" strokeWidth="8" />
  <circle cx="50" cy="50" r="45" fill="none" stroke={riskColor}
    strokeWidth="8" strokeDasharray={`${score * 2.83} 283`}
    transform="rotate(-90 50 50)" />
  <text x="50" y="55" textAnchor="middle" className="text-lg font-bold">{score}</text>
</svg>
```

#### 4.3 — `TradeJournalSummary.tsx`

**File: `src/components/trading/ai/TradeJournalSummary.tsx`** (new)

**Props:**
```typescript
interface TradeJournalSummaryProps {
  trades: Trade[];
  stats: TradingStats;
}
```

**Features:**
- "Analyze Journal" button
- Loading state
- Results display:
  - Overview paragraph in a highlighted box
  - **Patterns** section: cards with pattern name, frequency, impact (positive/negative icon)
  - **Strengths** section: green checkmark list
  - **Weaknesses** section: red X list
  - **Recommendations** section: numbered list with lightbulb icons

**Layout:**
```tsx
<div className="space-y-6">
  {/* Overview box */}
  <div className="p-4 rounded-lg bg-[var(--accent-primary-light)] border border-[var(--accent-primary)]">
    <p>{result.overview}</p>
  </div>

  {/* Patterns as cards */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {result.patterns.map(p => (
      <Card key={p.pattern}>
        <h4>{p.pattern}</h4>
        <p>Frequency: {p.frequency}</p>
        <p>Impact: {p.impact}</p>
      </Card>
    ))}
  </div>

  {/* Strengths / Weaknesses in 2-column layout */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div>
      <h3>Strengths</h3>
      {result.strengths.map(s => <div><CheckCircle /> {s}</div>)}
    </div>
    <div>
      <h3>Weaknesses</h3>
      {result.weaknesses.map(w => <div><XCircle /> {w}</div>)}
    </div>
  </div>

  {/* Recommendations */}
  <div>
    <h3>Recommendations</h3>
    <ol>{result.recommendations.map(r => <li><Lightbulb /> {r}</li>)}</ol>
  </div>
</div>
```

#### 4.4 — `RebalancingSuggestions.tsx`

**File: `src/components/trading/ai/RebalancingSuggestions.tsx`** (new)

**Props:**
```typescript
interface RebalancingSuggestionsProps {
  assetBalances: AssetBalance[];
}
```

**Features:**
- "Analyze Allocation" button
- Loading state
- Results display:
  - Side-by-side comparison: current allocation pie chart vs suggested allocation pie chart
  - Suggestions table:

| Asset | Current % | Target % | Action | Amount | Reasoning |
|-------|-----------|----------|--------|--------|-----------|

  - Action badge: green "Buy", red "Sell", gray "Hold"
  - Amount formatted with `formatCurrency`

**Pie charts** — Reuse the same Recharts PieChart pattern from `AllocationPieChart.tsx`:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  <div>
    <h4>Current Allocation</h4>
    <PieChart>...</PieChart>
  </div>
  <div>
    <h4>Suggested Allocation</h4>
    <PieChart>...</PieChart>
  </div>
</div>
```

---

### Step 5: Position Sizing Calculator

**File: `src/components/trading/PositionSizingCalc.tsx`** (new)

**Props:** None (self-contained interactive tool)

Interactive calculator for risk-based position sizing.

**Inputs:**
| Field | Type | Default | Label |
|-------|------|---------|-------|
| `accountBalance` | number | 10000 | Account Balance ($) |
| `riskPct` | number (range slider) | 2 | Risk per Trade (%) |
| `entryPrice` | number | — | Entry Price ($) |
| `stopLossPrice` | number | — | Stop Loss Price ($) |
| `takeProfitPrice` | number (optional) | — | Take Profit Price ($) |

**Computed outputs (display in real-time):**
```typescript
const riskAmount = accountBalance * (riskPct / 100);
const priceDiff = Math.abs(entryPrice - stopLossPrice);
const quantity = priceDiff > 0 ? riskAmount / priceDiff : 0;
const positionValue = quantity * entryPrice;
const riskRewardRatio = takeProfitPrice
  ? Math.abs(takeProfitPrice - entryPrice) / priceDiff
  : 0;
```

**Output display:**

| Metric | Format | Visual |
|--------|--------|--------|
| Position Size | `formatCrypto(quantity)` units | Large bold number |
| Risk Amount | `formatCurrency(riskAmount)` | Red text |
| Position Value | `formatCurrency(positionValue)` | Primary text |
| Risk/Reward Ratio | `1:${riskRewardRatio.toFixed(2)}` | Green if >= 2, yellow if 1-2, red if < 1 |
| Position as % of Account | `(positionValue / accountBalance * 100).toFixed(1)%` | Warning if > 25% |

**Risk slider styling:**
```tsx
<input
  type="range"
  min={0.5}
  max={10}
  step={0.5}
  value={riskPct}
  onChange={...}
  className="w-full accent-[var(--accent-primary)]"
/>
// Show risk level labels: Conservative (1-2%), Moderate (3-5%), Aggressive (6-10%)
```

**Validation warnings:**
- "Stop loss is above entry for a long position" if entry > stopLoss and expecting long
- "Position exceeds 25% of account" if positionValue / accountBalance > 0.25
- "Risk/reward below 1:1" if riskRewardRatio < 1

All within a single `Card` component. No server-side persistence needed — this is a pure calculator.

---

### Step 6: Trading Limits

**File: `src/components/trading/TradingLimits.tsx`** (new)

**Props:**
```typescript
interface TradingLimitsProps {
  limits: TradingLimit[];
  trades: Trade[];
  onSave: (limit: Omit<TradingLimit, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete: (id: string) => void;
}
```

**Features:**
- Set daily, weekly, and monthly limits for:
  - Max trades (integer)
  - Max loss (dollar amount)
  - Max capital deployed (dollar amount)
- Each limit period is a separate card with:
  - Toggle (is_active on/off)
  - Input fields for limits
  - Save button
- **Progress indicators** showing current usage vs limits:
  - Trade count progress bar
  - Loss progress bar (fills red as approaching limit)
  - Capital deployed progress bar
- **Warning states:**
  - Yellow warning at 80% of limit
  - Red warning at 100% (exceeded)
  - Soft lockout indicator — shows a banner "Daily trade limit reached" but does NOT prevent trading
- **Current period calculation:**
  - Daily: trades from today (UTC)
  - Weekly: trades from Monday of current week
  - Monthly: trades from first of current month

```typescript
const computeLimitStatus = (
  limit: TradingLimit,
  trades: Trade[],
): TradingLimitStatus => {
  const now = new Date();
  let periodStart: Date;

  switch (limit.periodType) {
    case 'daily':
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'weekly': {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1; // Monday start
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
      break;
    }
    case 'monthly':
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }

  const periodTrades = trades.filter(
    (t) => new Date(t.tradedAt) >= periodStart,
  );

  const currentTrades = periodTrades.length;
  const currentLoss = Math.abs(
    periodTrades
      .filter((t) => (t.realizedPnl ?? 0) < 0)
      .reduce((s, t) => s + (t.realizedPnl ?? 0), 0),
  );
  const currentCapital = periodTrades.reduce((s, t) => s + t.total, 0);

  return {
    limit,
    currentTrades,
    currentLoss,
    currentCapital,
    tradesExceeded: limit.maxTrades != null && currentTrades >= limit.maxTrades,
    lossExceeded: limit.maxLoss != null && currentLoss >= limit.maxLoss,
    capitalExceeded: limit.maxCapital != null && currentCapital >= limit.maxCapital,
  };
};
```

**Progress bar component (inline):**
```tsx
const LimitBar: React.FC<{ current: number; max: number; label: string; format: (v: number) => string }> = ({ current, max, label, format }) => {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span>{format(current)} / {format(max)}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--bg-tertiary)]">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};
```

---

### Step 7: Trading Limits Service Functions

**File: `src/services/supabase/trading.ts`** — Add CRUD for trading_limits.

```typescript
// --- Row Type ---

interface SupabaseTradingLimitRow {
  id: string;
  period_type: string;
  max_trades: number | null;
  max_loss: number | null;
  max_capital: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// --- Row Mapper ---

function mapTradingLimitRow(row: SupabaseTradingLimitRow): TradingLimit {
  return {
    id: row.id,
    periodType: row.period_type as TradingLimit['periodType'],
    maxTrades: row.max_trades ?? undefined,
    maxLoss: row.max_loss != null ? Number(row.max_loss) : undefined,
    maxCapital: row.max_capital != null ? Number(row.max_capital) : undefined,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// --- CRUD ---

export const loadTradingLimits = async (): Promise<TradingLimit[]> => {
  const { data, error } = await supabase
    .from('trading_limits')
    .select('*')
    .order('period_type');
  if (error) console.error('Error loading trading limits:', error);
  return (data ?? []).map(mapTradingLimitRow);
};

export const saveTradingLimit = async (
  limit: Omit<TradingLimit, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<TradingLimit | null> => {
  // Upsert: if an active limit for this period_type exists, update it
  const { data, error } = await supabase
    .from('trading_limits')
    .upsert(
      {
        period_type: limit.periodType,
        max_trades: limit.maxTrades ?? null,
        max_loss: limit.maxLoss ?? null,
        max_capital: limit.maxCapital ?? null,
        is_active: limit.isActive,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'period_type' },
    )
    .select()
    .single();

  if (error) {
    console.error('Error saving trading limit:', error);
    return null;
  }
  return mapTradingLimitRow(data);
};

export const deleteTradingLimit = async (id: string): Promise<void> => {
  const { error } = await supabase.from('trading_limits').delete().eq('id', id);
  if (error) console.error('Error deleting trading limit:', error);
};
```

---

### Step 8: TradingPage Integration

**File: `src/features/trading/TradingPage.tsx`** — Wire AI tab and Settings additions.

#### 8.1 — New Imports

```typescript
import { Brain } from 'lucide-react';
import type { TradingLimit } from '@/types';
import { loadTradingLimits, saveTradingLimit, deleteTradingLimit as deleteTradingLimitApi } from '@/services/supabase/trading';
import { TradeSignalAnalysis as TradeSignalAnalysisView } from '@/components/trading/ai/TradeSignalAnalysis';
import { RiskAssessment as RiskAssessmentView } from '@/components/trading/ai/RiskAssessment';
import { TradeJournalSummary } from '@/components/trading/ai/TradeJournalSummary';
import { RebalancingSuggestions } from '@/components/trading/ai/RebalancingSuggestions';
import { PositionSizingCalc } from '@/components/trading/PositionSizingCalc';
import { TradingLimits } from '@/components/trading/TradingLimits';
```

#### 8.2 — Add AI Tab to TABS Array

Add after the `'analytics'` tab entry:

```typescript
{ id: 'ai' as TradingTab, label: 'AI Insights', icon: Brain },
```

#### 8.3 — New State

```typescript
const [tradingLimits, setTradingLimits] = useState<TradingLimit[]>([]);
```

Add `loadTradingLimits()` to the existing `fetchAll` Promise.all.

#### 8.4 — Trading Limits Handlers

```typescript
const handleSaveTradingLimit = async (limit: Omit<TradingLimit, 'id' | 'createdAt' | 'updatedAt'>) => {
  const saved = await saveTradingLimit(limit);
  if (saved) {
    setTradingLimits((prev) => {
      const filtered = prev.filter(
        (l) => l.periodType !== saved.periodType,
      );
      return [...filtered, saved].sort((a, b) => a.periodType.localeCompare(b.periodType));
    });
  }
};

const handleDeleteTradingLimit = async (id: string) => {
  await deleteTradingLimitApi(id);
  setTradingLimits((prev) => prev.filter((l) => l.id !== id));
};
```

#### 8.5 — AI Tab Content

```tsx
{activeTab === 'ai' && (
  <div className="space-y-6 animate-in fade-in duration-300">
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Card title="Trade Signal Analysis">
        <TradeSignalAnalysisView
          trades={trades}
          assetBalances={assetBalances}
        />
      </Card>
      <Card title="Portfolio Risk Assessment">
        <RiskAssessmentView
          assetBalances={assetBalances}
          trades={trades}
          stats={tradingStats}
        />
      </Card>
    </div>

    <Card title="Trade Journal Analysis">
      <TradeJournalSummary trades={trades} stats={tradingStats} />
    </Card>

    <Card title="Rebalancing Suggestions">
      <RebalancingSuggestions assetBalances={assetBalances} />
    </Card>
  </div>
)}
```

#### 8.6 — Settings Tab Additions

Add after the existing `TradingGoals` component in the Settings tab:

```tsx
<PositionSizingCalc />

<TradingLimits
  limits={tradingLimits}
  trades={trades}
  onSave={handleSaveTradingLimit}
  onDelete={handleDeleteTradingLimit}
/>
```

---

## Context

### Files to Modify

| File | Change |
|------|--------|
| `src/types/trading.ts` | Add AI response types, TradingLimit, PositionSizeResult |
| `src/types/index.ts` | Export new types |
| `src/services/gemini.ts` | Add 4 trading AI functions |
| `src/services/supabase/trading.ts` | Add TradingLimit CRUD |
| `src/features/trading/TradingPage.tsx` | Add AI tab, limits state, Settings additions |

### New Files

| File | Purpose |
|------|---------|
| `supabase/migrations/20260306_trading_limits.sql` | Trading limits table |
| `src/components/trading/ai/TradeSignalAnalysis.tsx` | AI trade signal analysis |
| `src/components/trading/ai/RiskAssessment.tsx` | AI portfolio risk assessment |
| `src/components/trading/ai/TradeJournalSummary.tsx` | AI journal pattern analysis |
| `src/components/trading/ai/RebalancingSuggestions.tsx` | AI rebalancing suggestions |
| `src/components/trading/PositionSizingCalc.tsx` | Risk-based position calculator |
| `src/components/trading/TradingLimits.tsx` | Daily/weekly/monthly trade limits |

### Reference Files (Read Before Coding)

| File | Why |
|------|-----|
| `src/services/gemini.ts` | Existing Gemini client setup, API call pattern |
| `src/components/trading/PnlSummaryCards.tsx` | Stat card layout pattern |
| `src/components/trading/TradingGoals.tsx` | Progress bar + form pattern for TradingLimits |
| `src/components/trading/AllocationPieChart.tsx` | PieChart pattern for RebalancingSuggestions |
| `src/services/supabase/trading.ts` | CRUD pattern for TradingLimit service |
| `src/lib/format.ts` | formatPnl, formatCurrency, formatCrypto |
| `src/features/trading/TradingPage.tsx` | Tab wiring, state management pattern |
| `src/lib/tradingAnalytics.ts` | TradingStats interface (for AI context building) |

### lucide-react Icons Used

| Icon | Component |
|------|-----------|
| `Brain` | AI tab, analyze buttons |
| `Shield`, `ShieldAlert` | Risk assessment severity |
| `CheckCircle` | Journal strengths |
| `XCircle` | Journal weaknesses |
| `Lightbulb` | Recommendations |
| `Calculator` | Position sizing |
| `Lock`, `Unlock` | Trading limits toggle |
| `AlertTriangle` | Limit warnings |
| `Loader2` | Loading states |
| `RefreshCw` | Retry/re-analyze buttons |
| `TrendingUp`, `TrendingDown` | Signal sentiment |

---

## Goal

After completing Phase 4, the Trading Command Center becomes an intelligent trading assistant. The AI Insights tab provides on-demand Gemini-powered analysis: trade signals from historical patterns, portfolio risk scoring, behavioral pattern detection from the trade journal, and rebalancing suggestions. The Settings tab gains a position sizing calculator for disciplined risk management and configurable trading limits (daily/weekly/monthly) with visual progress tracking and soft warnings when limits are approached.

---

## Acceptance Criteria

### AI Functions
- [ ] `analyzeTradeSignals()` sends symbol + trade context to Gemini, returns structured `TradeSignalAnalysis`
- [ ] `assessPortfolioRisk()` analyzes positions + stats, returns `RiskAssessment` with score 0-100
- [ ] `summarizeTradeJournal()` identifies behavioral patterns from trade history
- [ ] `suggestRebalancing()` compares current vs ideal allocation
- [ ] All functions handle missing API key gracefully (return descriptive fallback)
- [ ] All functions handle Gemini API errors with try/catch (log + return fallback)
- [ ] JSON parsing from AI response uses regex extraction with fallback to raw text

### AI Components
- [ ] TradeSignalAnalysis: symbol selector, analyze button, sentiment/confidence badges, key levels, price ladder
- [ ] RiskAssessment: risk score ring (SVG), severity-colored factors list, suggestions
- [ ] TradeJournalSummary: overview box, patterns cards, strengths/weaknesses lists, recommendations
- [ ] RebalancingSuggestions: side-by-side pie charts (current vs suggested), suggestions table
- [ ] All AI components show loading spinner during Gemini calls
- [ ] All AI components handle errors with retry button

### Position Sizing Calculator
- [ ] Inputs: account balance, risk % (slider), entry price, stop loss, take profit (optional)
- [ ] Outputs update in real-time: position size, risk amount, position value, R:R ratio
- [ ] Risk slider shows Conservative/Moderate/Aggressive labels
- [ ] Validation warnings for bad inputs (stop above entry, position > 25% of account, R:R < 1:1)
- [ ] Pure client-side — no persistence needed

### Trading Limits
- [ ] `trading_limits` table created in Supabase
- [ ] CRUD: can create, read, update, delete limits per period (daily/weekly/monthly)
- [ ] Progress bars show current trades/loss/capital vs limits
- [ ] Yellow warning at 80%, red at 100%
- [ ] Soft lockout banner when limit exceeded (does NOT block trading)
- [ ] Period calculations correct: daily = today, weekly = Mon-Sun, monthly = 1st-end

### Integration
- [ ] AI Insights tab visible in TradingPage with Brain icon
- [ ] Settings tab includes PositionSizingCalc and TradingLimits sections
- [ ] Trading limits state loaded on mount and persisted to Supabase
- [ ] All components render correctly in dark and light themes
- [ ] Mobile responsive

### Code Quality
- [ ] No `any` types — TypeScript strict
- [ ] `npm run build` succeeds with zero errors
- [ ] `npm run lint` passes (warnings OK, zero errors)
- [ ] All components use named exports
- [ ] AI prompts request JSON output for structured parsing

---

## PR / Branch

- **Branch:** `feat/trading-ai`
- **PR Title:** `feat: AI-powered trade insights and risk management`
- **Commit prefix:** `feat:` for features, `chore:` for schema migration
