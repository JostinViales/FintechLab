---
slug: "20260330-windmill-full-migration"
title: "WealthFlow Full Migration to Windmill"
spec_type: tech-spec
project: WF
domain: [windmill, architecture, infrastructure]
source_repo: "JostinViales/FintechLab"
# Fields below are filled by /publish-spec — leave as-is
notion_url: ""
gh_issue:
gh_prs: []
status: draft
published_at:
---

# WealthFlow Full Migration to Windmill — Tech Spec

## Persona

You are a **senior platform engineer** experienced with Windmill full-code apps (React), Python backend runnables, and Supabase PostgreSQL. You understand the WealthFlow codebase — React 19 + TypeScript 5.8 SPA with outlet context state management, OKX exchange integration via HMAC-signed Edge Function proxies, and client-side trading/portfolio analytics. You are familiar with Windmill's `backend/` runnable pattern, `wmill` CLI workflows, and Docker-based self-hosted deployments.

## Task

Migrate WealthFlow from a **Firebase-hosted React SPA + Supabase Edge Functions** architecture to a **Windmill full-code app** with Python backend runnables and scheduled orchestration flows.

### Problem

The current architecture has backend logic scattered across three layers:

1. **Supabase Edge Functions** (Deno) — OKX API proxy with HMAC signing, Gemini AI proxy
2. **Client-side services** (`src/services/okx/client.ts`) — Trade/balance sync logic that runs in the browser, triggered manually by user clicking "Sync"
3. **Client-side analytics** (`src/lib/`) — Trading stats, portfolio metrics computed on every page render

This creates several issues:
- **Manual sync** — Users must remember to click "Sync" to import new trades/balances
- **No orchestration** — No scheduling, retry logic, or job monitoring for sync operations
- **Scattered backend** — Logic split between Edge Functions (Deno), browser JS, and pure TS libraries
- **Firebase dependency** — Hosting on Firebase adds a deployment layer that doesn't serve the product
- **Auth overhead** — Supabase Auth login flow is unnecessary since the app is only accessed by the owner through Windmill

### Deliverables

1. **Windmill full-code React app** — Existing React app adapted to run inside Windmill's app framework
2. **Python backend runnables** — OKX proxy, Gemini proxy ported from Deno Edge Functions to Python
3. **Scheduled sync flows** — Trade and balance sync as Windmill scheduled jobs (hourly/30min)
4. **Auth removal** — Strip all login/auth code; app is accessed only through Windmill
5. **Firebase retirement** — Remove Firebase config, hosting, and CI/CD pipeline
6. **Analytics cache** (optional) — Pre-compute expensive stats server-side

---

## Architecture Overview

### Current Architecture

```
┌─────────────────────────────────────────────────┐
│  Firebase Hosting                                │
│  ┌───────────────────────────────────────────┐   │
│  │  React SPA (Vite build → dist/)           │   │
│  │  ├── OKX sync logic (manual trigger)      │   │
│  │  ├── Trading analytics (client-side)      │   │
│  │  ├── Portfolio analytics (client-side)    │   │
│  │  └── Supabase Auth (login/session)        │   │
│  └────────────┬──────────────────────────────┘   │
└───────────────┼──────────────────────────────────┘
                │
        ┌───────▼───────┐       ┌──────────────────┐
        │ Supabase Edge │       │  OKX Exchange    │
        │ Functions     │──────►│  REST API        │
        │ (okx-proxy)   │       │  WebSocket       │
        │ (gemini-proxy)│       └──────────────────┘
        └───────┬───────┘
                │
        ┌───────▼───────┐
        │ Supabase      │
        │ PostgreSQL    │
        │ (trades,      │
        │  balances,    │
        │  budgets)     │
        └───────────────┘
```

### Target Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Windmill (self-hosted Docker)                          │
│                                                         │
│  ┌──────────────────────────────────┐                   │
│  │  Full-Code React App             │                   │
│  │  ├── All existing UI components  │                   │
│  │  ├── Direct Supabase reads       │◄── wmill.ts ──┐  │
│  │  ├── OKX WebSocket (prices)      │               │  │
│  │  └── No auth / no login page     │               │  │
│  └──────────────────────────────────┘               │  │
│                                                      │  │
│  ┌──────────────────────────────────┐               │  │
│  │  Python Backend Runnables        │◄──────────────┘  │
│  │  ├── okx_proxy.py (HMAC sign)    │                   │
│  │  ├── gemini_proxy.py             │                   │
│  │  ├── sync_trades.py              │                   │
│  │  └── sync_balances.py            │                   │
│  └──────────────────────────────────┘                   │
│                                                         │
│  ┌──────────────────────────────────┐                   │
│  │  Scheduled Flows                 │                   │
│  │  ├── Trade sync (hourly)         │                   │
│  │  └── Balance sync (every 30min)  │                   │
│  └──────────────────────────────────┘                   │
│                                                         │
└───────────────┬─────────────────────────────────────────┘
                │
        ┌───────▼───────┐       ┌──────────────────┐
        │ Supabase      │       │  OKX Exchange    │
        │ PostgreSQL    │       │  REST API        │
        │ (unchanged)   │       └──────────────────┘
        └───────────────┘
```

---

## Context

### Current Infrastructure Inventory

**Frontend (React SPA)**

| File | Lines | Purpose |
|------|-------|---------|
| `src/main.tsx` | ~10 | Entry: `RouterProvider` |
| `src/App.tsx` | ~520 | Layout shell, global state, auth guard, outlet context |
| `src/router.tsx` | ~40 | `createBrowserRouter` with 7 routes |
| `src/features/trading/TradingPage.tsx` | ~400 | Trading UI + manual sync triggers |
| `src/features/portfolio/PortfolioPage.tsx` | ~300 | Portfolio UI + manual sync triggers |
| `src/features/auth/LoginPage.tsx` | — | Supabase Auth login (to be removed) |
| `src/components/` | ~21 trading, ~6 portfolio, budget, charts, AI | All UI components |

**Backend Services (client-side)**

| File | Lines | Purpose |
|------|-------|---------|
| `src/services/okx/client.ts` | ~380 | OKX proxy calls + sync logic |
| `src/services/okx/websocket.ts` | ~200 | Live price tickers (browser WebSocket) |
| `src/services/supabase/client.ts` | ~20 | Supabase client init with `VITE_` env vars |
| `src/services/supabase/trading.ts` | ~250 | Trading CRUD (trades, balances, watchlist, goals, limits) |
| `src/services/supabase/storage.ts` | ~200 | Budget/finance CRUD |
| `src/services/gemini.ts` | ~100 | Gemini AI proxy client |

**Edge Functions (Deno)**

| File | Lines | Purpose |
|------|-------|---------|
| `supabase/functions/okx-proxy/index.ts` | ~270 | HMAC-SHA256 signing, credential storage, API proxy |
| `supabase/functions/gemini-proxy/index.ts` | ~120 | Gemini AI proxy with 5 allowed actions |

**Analytics (pure functions)**

| File | Lines | Functions |
|------|-------|-----------|
| `src/lib/tradingAnalytics.ts` | ~300 | `computeTradingStats`, `computeEquityCurve`, `computeTimeAnalysis`, `computeHoldDurations`, `computePnlTimeline`, `computeStrategyPerformance` |
| `src/lib/portfolioAnalytics.ts` | ~300 | `computePortfolioSummary`, `computePortfolioHoldings`, `computeDiversificationAnalysis`, `computeAssetHoldingDurations`, `computePortfolioValueTimeline`, `computePortfolioRiskMetrics` |

**Infrastructure**

| File | Purpose |
|------|---------|
| `firebase.json` | Firebase Hosting config (CSP headers, rewrites, caching) |
| `.github/workflows/firebase-deploy.yml` | CI/CD: lint → type-check → build → Firebase deploy |
| `vite.config.ts` | Vite 6 config (React, Tailwind v4, `@` alias, port 3000) |
| 9 files in `supabase/migrations/` | Database schema |

### Database Tables

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `trades` | id, symbol, side, price, quantity, realized_pnl, okx_pos_id, direction, open_avg_px, close_avg_px, funding_fee, leverage, margin_mode, user_id, instance | Position-based (from ADR 20260324) |
| `asset_balances` | id, asset, total_quantity, avg_buy_price, total_cost, account_type, earnings, user_id, instance | Composite unique: (asset, user_id, instance, account_type) |
| `okx_credentials` | user_id, api_key, secret_key, passphrase, instance | Encrypted OKX API keys |
| `strategy_tags` | id, name, color, instance | User-defined trade tags |
| `watchlist` | id, symbol, sort_order, instance | Watched cryptocurrencies |
| `trading_goals` | id, period_type, period_key, target_pnl, instance | Monthly/weekly profit targets |
| `trading_limits` | id, period_type, max_trades, max_loss, max_capital, is_active | Risk management |
| `accounts` | id, name, type, balance, color | Budget accounts |
| `transactions` | id, date, description, amount, type, account_id, category | Budget transactions |
| `categories` | id, name, default_monthly_budget | Budget categories |
| `monthly_budgets` | id, category_id, month, amount | Monthly allocations |

### Instance Management

All trading data is partitioned by `(user_id, instance)` where `instance ∈ {'live', 'demo'}`. This must be preserved in Windmill flows — every backend runnable accepts an `instance` parameter.

---

## Steps

### Phase 1: Scaffold Windmill Full-Code App

**Goal**: Get the existing React app rendering inside Windmill's full-code app framework.

#### Target Directory Structure

```
f/wealthflow/wealthflow.app/
├── wmill-app.yaml              # Windmill app config
├── package.json                # React deps + windmill-client
├── vite.config.ts              # Adapted for Windmill IIFE build
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── index.html                  # Entry HTML (with theme init script)
├── src/
│   ├── main.tsx                # Entry: RouterProvider
│   ├── App.tsx                 # Layout shell (auth code removed)
│   ├── router.tsx              # Routes (login route removed)
│   ├── wmill.ts                # Auto-generated backend client
│   ├── types/                  # All type definitions (copy as-is)
│   ├── features/               # Page components (copy, remove auth/)
│   ├── components/             # UI components (copy as-is)
│   ├── hooks/                  # Custom hooks (copy as-is)
│   ├── lib/                    # Pure utilities (copy as-is)
│   ├── services/
│   │   ├── supabase/
│   │   │   ├── client.ts       # Modified: service-role client, no auth
│   │   │   ├── storage.ts      # Unchanged
│   │   │   └── trading.ts      # Unchanged
│   │   ├── okx/
│   │   │   ├── client.ts       # Modified: calls Windmill backend
│   │   │   └── websocket.ts    # Unchanged (browser WebSocket)
│   │   └── gemini.ts           # Modified: calls Windmill backend
│   └── styles/
│       ├── globals.css
│       └── theme.css
└── backend/
    ├── okx_proxy.py            # Phase 2
    ├── gemini_proxy.py         # Phase 2
    ├── sync_trades.py          # Phase 3
    └── sync_balances.py        # Phase 3
```

#### Steps

1. **Scaffold from Windmill React template** — `wmill app init` or clone the [windmill-react-template](https://github.com/windmill-labs/windmill-react-template)

2. **Copy `src/` files** from current project into the app's `src/`, excluding:
   - `src/features/auth/` (LoginPage — being removed)

3. **Adapt `vite.config.ts`**:
   - Keep `@vitejs/plugin-react` and `@tailwindcss/vite` plugins
   - Keep `@` path alias (`@ → ./src`)
   - Add Windmill IIFE build output configuration (single bundle, no code splitting)
   - Add proxy config for `wmill app dev` workflow

4. **Adapt `package.json`**:
   - Keep all existing deps: `react`, `react-dom`, `react-router-dom`, `recharts`, `lucide-react`, `@supabase/supabase-js`, `@google/genai`
   - Add: `windmill-client`
   - Remove: `firebase-tools`

5. **Copy `index.html`** with theme initialization script intact

6. **Verify**: `npm install && wmill app dev .` starts the dev server, routes render, Tailwind styles work

#### Risk: Tailwind CSS v4 Compatibility

Windmill ships its own Tailwind CSS. If the bundled version conflicts with v4:
- Isolate the app's Tailwind config to not inherit Windmill's
- The CSS custom properties in `theme.css` (`var(--bg-primary)`, etc.) are independent and should work regardless

#### Risk: IIFE Build + React Router

Windmill expects IIFE output (single bundle). Code splitting via `React.lazy` won't work. The current codebase does **not** use lazy loading, so this is fine. If added in the future, routes must be eagerly imported.

---

### Phase 2: Python Backend Runnables

**Goal**: Replace Supabase Edge Functions with Windmill Python scripts in `backend/`.

#### 2A: OKX Proxy (`backend/okx_proxy.py`)

Port from `supabase/functions/okx-proxy/index.ts` (270 lines).

**Functionality**:
- Receive endpoint, method, params, demo flag
- Validate endpoint against whitelist
- Fetch OKX credentials from `okx_credentials` table (service-role Supabase client)
- Generate HMAC-SHA256 signature (Python `hmac` + `hashlib` + `base64`)
- Proxy request to OKX REST API via `httpx`
- Return response data

**Whitelisted endpoints** (from current edge function):
```
/api/v5/trade/fills-history
/api/v5/trade/fills
/api/v5/trade/orders-history-archive
/api/v5/account/balance
/api/v5/asset/balances
/api/v5/finance/savings/balance
/api/v5/market/ticker
/api/v5/market/tickers
/api/v5/account/positions-history
/api/v5/account/positions
```

**Additional actions** (currently in edge function):
- `store-credentials`: Upsert API keys into `okx_credentials` table
- `test-connection`: Verify credentials by calling `/api/v5/account/balance`

**Dependencies**: `httpx`, `supabase` (supabase-py)

**Credentials**: Read from Supabase `okx_credentials` table using Windmill secret `f/wealthflow/supabase_service_role_key`

#### 2B: Gemini Proxy (`backend/gemini_proxy.py`)

Port from `supabase/functions/gemini-proxy/index.ts` (120 lines).

**Functionality**:
- Validate action against allowed set: `financial-advisor`, `analyze-trade-signals`, `assess-portfolio-risk`, `summarize-trade-journal`, `suggest-rebalancing`
- Call Gemini API via `google-genai` SDK
- Return response text

**Dependencies**: `google-genai`

**Credentials**: Gemini API key from Windmill secret `f/wealthflow/gemini_api_key`

#### 2C: Rewire Frontend Service Calls

**`src/services/okx/client.ts`** — Replace `callOkxProxy()`:

```typescript
// BEFORE (line 32):
const { data, error } = await supabase.functions.invoke('okx-proxy', {
  body: { endpoint, method, params, demo: demoMode },
});

// AFTER:
import { backend } from '../wmill';
const result = await backend.okx_proxy({
  endpoint, method, params, demo: demoMode
});
```

**`src/services/gemini.ts`** — Replace fetch to edge function:

```typescript
// BEFORE:
const response = await fetch(`${SUPABASE_URL}/functions/v1/gemini-proxy`, { ... });

// AFTER:
import { backend } from '../wmill';
const result = await backend.gemini_proxy({ action, prompt });
```

#### Verification
- OKX account balance fetch works end-to-end through Windmill backend
- HMAC signatures match (test with same inputs as Deno implementation)
- All 5 Gemini actions return valid responses
- Credential store/retrieve works for both live and demo instances

---

### Phase 3: Scheduled Sync Flows

**Goal**: Move trade/balance sync from manual UI triggers to Windmill scheduled flows, keeping manual trigger option.

#### 3A: Trade Sync (`backend/sync_trades.py`)

Port from `syncTradesFromOkx()` in `src/services/okx/client.ts` (lines ~250-301).

```python
def main(instance: str = "live") -> dict:
    """
    Sync closed positions from OKX to the trades table.

    Returns:
        dict with imported, skipped, errors counts
    """
```

**Logic to port**:
1. Load existing trades for dedup by `okx_pos_id`
2. Paginated fetch of `/api/v5/account/positions-history` (up to 10 pages × 100 records)
3. Skip positions before cutoff date (2026-01-01)
4. Map OKX position fields → trade row (replicating `mapOkxPositionToTrade` from client.ts)
5. Insert new trades into Supabase `trades` table
6. Return `{ imported, skipped, errors }`

**Dependencies**: `httpx`, `supabase`

#### 3B: Balance Sync (`backend/sync_balances.py`)

Port from `syncBalancesFromOkx()` in `src/services/okx/client.ts` (lines ~303-377).

```python
def main(instance: str = "live") -> dict:
    """
    Sync asset balances from OKX trading, funding, and earn accounts.
    """
```

**Logic to port**:
1. Fetch trading account balance (with cost basis from `openAvgPx`)
2. Fetch funding balances
3. Fetch savings/earn balances (with `earnings` field)
4. Upsert all to `asset_balances` with composite key `(asset, user_id, instance, account_type)`

#### 3C: Windmill Schedules

| Schedule | Cron | Script | Parameters |
|----------|------|--------|------------|
| Trade sync (live) | `0 * * * *` (hourly) | `sync_trades.py` | `instance: "live"` |
| Trade sync (demo) | `0 * * * *` (hourly) | `sync_trades.py` | `instance: "demo"` |
| Balance sync (live) | `*/30 * * * *` (every 30min) | `sync_balances.py` | `instance: "live"` |
| Balance sync (demo) | `*/30 * * * *` (every 30min) | `sync_balances.py` | `instance: "demo"` |

Only schedule instances that have active OKX credentials.

#### 3D: Frontend Adaptation

Remove sync functions from `src/services/okx/client.ts`:
- Delete `syncTradesFromOkx()` (~50 lines)
- Delete `syncBalancesFromOkx()` (~75 lines)

Keep in `client.ts` (still needed client-side):
- `callOkxProxy()` (rewired in Phase 2)
- `fetchAccountBalance()`, `fetchTickers()`, `fetchOpenPositions()`
- `testConnection()`, `storeCredentials()`
- `setDemoMode()`, `isDemoMode()`

Modify `TradingPage.tsx` and `PortfolioPage.tsx` sync buttons to call backend:
```typescript
// BEFORE:
const result = await syncTradesFromOkx(instance);

// AFTER:
const result = await backend.sync_trades({ instance });
```

#### Verification
- Manual sync from TradingPage imports trades correctly and shows counts
- Scheduled sync runs on time in Windmill job monitor
- Dedup works (no duplicate trades on repeated sync)
- Both live and demo instances sync independently

---

### Phase 4: Auth Removal & Supabase Client Simplification

**Goal**: Remove all authentication code. The app is only accessed through Windmill — no login required.

#### 4A: Remove Auth from App.tsx

Remove from `src/App.tsx`:
- `User` import from `@supabase/supabase-js`
- `user` state (`useState<User | null>`)
- `useEffect` for `supabase.auth.getSession()` and `onAuthStateChange`
- `handleSignOut` function
- Auth guard: `if (!user) return <Navigate to="/login" />`
- Loading spinner while checking auth
- Sign-out button in sidebar
- Pass of `user` to child components

#### 4B: Remove Login Route

Remove from `src/router.tsx`:
- `/login` route entry
- `LoginPage` import

Delete: `src/features/auth/LoginPage.tsx` (if exists)

#### 4C: Simplify Supabase Client

Modify `src/services/supabase/client.ts`:

```typescript
// BEFORE: Uses anon key with auth session
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// AFTER: Service-role client, no auth needed
// Supabase URL and key injected at build time or via Windmill context
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
```

**Decision**: Whether to use service-role key (full access, bypasses RLS) or anon key (requires RLS policies to be updated). Since auth is removed and this is a single-user app:
- **Use service-role key** from the frontend for simplicity
- Remove all `getCurrentUserId()` calls or hardcode a single user ID
- Alternatively, keep anon key + disable RLS on all tables

#### 4D: Clean Up user_id References

The trading service (`src/services/supabase/trading.ts`) uses `getCurrentUserId()` which calls `supabase.auth.getUser()`. This must be replaced with either:
- A hardcoded user ID constant
- A Windmill-provided user context
- Remove `user_id` filtering entirely if single-user

#### Verification
- App loads directly to Dashboard (no login page)
- All CRUD operations work (accounts, transactions, categories, budgets)
- Trading data loads for both live and demo instances
- No auth-related console errors

---

### Phase 5: Analytics Cache (Optional — Defer Post-Migration)

**Goal**: Pre-compute expensive analytics server-side and cache results.

This phase is **optional** and can be deferred. Client-side analytics work fine at current data volumes (~100-300 trades). Implement this when:
- Trade count exceeds 1,000+
- Page load times for Trading/Portfolio become noticeable
- You want historical snapshots for trend analysis

#### If Implemented

**New table**:
```sql
CREATE TABLE analytics_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    instance TEXT NOT NULL DEFAULT 'live',
    cache_key TEXT NOT NULL,
    data JSONB NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(instance, cache_key)
);
```

**Backend scripts**:
- `backend/compute_trading_stats.py` — port from `src/lib/tradingAnalytics.ts`
- `backend/compute_portfolio_stats.py` — port from `src/lib/portfolioAnalytics.ts`

**Schedule**: Run after sync completion (flow chaining) or on fixed interval.

**Frontend**: Hybrid approach — try cache first, fall back to client-side computation if stale (> 1 hour).

---

### Phase 6: Firebase Retirement & Deployment

**Goal**: Remove all Firebase infrastructure, set up Windmill deployment pipeline.

#### 6A: Delete Firebase Files

- `firebase.json`
- `.firebaserc`
- `.github/workflows/firebase-deploy.yml`
- Remove `firebase-tools` from `devDependencies` in root `package.json`

#### 6B: Delete Supabase Edge Functions

- `supabase/functions/okx-proxy/` (entire directory)
- `supabase/functions/gemini-proxy/` (entire directory)

Keep `supabase/migrations/` — database schema is unchanged.

#### 6C: Windmill Deployment Workflow

```bash
# Deploy app + backend runnables
cd f/wealthflow/wealthflow.app/
npm run build
wmill app push .
```

#### 6D: New CI/CD (GitHub Actions)

```yaml
# .github/workflows/windmill-deploy.yml
name: Deploy to Windmill
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint && npm run type-check
      - run: npm run build
      - run: pip install windmill-cli
      - run: wmill app push f/wealthflow/wealthflow.app/
        env:
          WM_TOKEN: ${{ secrets.WINDMILL_TOKEN }}
          WM_WORKSPACE: ${{ secrets.WINDMILL_WORKSPACE }}
          WM_URL: ${{ secrets.WINDMILL_URL }}
```

#### 6E: CSP Headers

Configure at Windmill's reverse proxy (Caddy) to match current Firebase security headers:
- `connect-src 'self' https://*.supabase.co wss://ws.okx.com:8443 wss://wspap.okx.com:8443`
- `frame-ancestors 'none'`
- HSTS, X-Content-Type-Options, X-Frame-Options

#### 6F: Remove Dead Code

- All `supabase.functions.invoke` references (should be zero after Phase 2)
- Unused auth-related imports (should be zero after Phase 4)
- `VITE_SUPABASE_ANON_KEY` references (replaced in Phase 4)

#### Verification
- `wmill app push` deploys successfully
- App accessible at Windmill app URL
- All features functional: budget, trading, portfolio, AI advisor
- WebSocket prices stream (CSP allows `wss://ws.okx.com:8443`)
- Scheduled syncs visible in Windmill job monitor

---

## Windmill Resources to Configure

| Resource | Type | Path | Purpose |
|----------|------|------|---------|
| Supabase URL | Variable | `f/wealthflow/supabase_url` | Database connection |
| Supabase Service Role Key | Secret | `f/wealthflow/supabase_service_role_key` | Backend + frontend DB access |
| Gemini API Key | Secret | `f/wealthflow/gemini_api_key` | AI features (backend only) |

OKX credentials remain in the `okx_credentials` Supabase table (per-instance, stored via `okx_proxy.py` `store-credentials` action).

---

## Environment Variable Migration

| Current | New Location | Accessed By |
|---------|-------------|-------------|
| `VITE_SUPABASE_URL` | Windmill variable or build-time env | Frontend + backend |
| `VITE_SUPABASE_ANON_KEY` | Replaced by service-role key | — |
| `SUPABASE_SERVICE_ROLE_KEY` (edge fn) | Windmill secret `f/wealthflow/supabase_service_role_key` | Backend runnables + frontend |
| `VITE_GEMINI_API_KEY` | Windmill secret `f/wealthflow/gemini_api_key` | Backend only |

---

## Risk Areas

### 1. Tailwind CSS v4 vs Windmill's Bundled Tailwind

**Risk**: Windmill's built-in Tailwind may conflict with the app's v4 setup.
**Mitigation**: Test in Phase 1. If conflict, isolate the app's Tailwind config. The CSS custom properties (`var(--bg-primary)`, etc.) in `theme.css` are independent.

### 2. IIFE Build Output

**Risk**: Windmill expects an IIFE bundle. The current Vite config produces multi-chunk output. React Router with code splitting may not work.
**Mitigation**: The app currently does NOT use `React.lazy` or code splitting. Configure Vite `build.lib` with IIFE format per Windmill template.

### 3. Backend Call Latency

**Risk**: Windmill `backend()` communicates via WebSocket, adding latency vs direct Edge Function calls.
**Mitigation**: Keep direct Supabase queries from the frontend for reads (loading trades, balances). Only use backend runnables for operations needing server-side secrets (HMAC signing, Gemini calls, credential storage).

### 4. WebSocket CSP

**Risk**: Windmill serves the app from a different origin, potentially blocking WebSocket to `wss://ws.okx.com:8443`.
**Mitigation**: WebSocket connections are browser-initiated. Configure Caddy CSP `connect-src` to include OKX WebSocket URLs.

### 5. Python Analytics Port Fidelity (Phase 5 only)

**Risk**: Porting TypeScript analytics to Python could introduce numerical differences.
**Mitigation**: Write comparison tests. This phase is optional and deferred.

### 6. `import.meta.env` References

**Risk**: All `VITE_*` env var references must be found and updated.
**Inventory**: Only 2 files have direct env var access:
- `src/services/supabase/client.ts` (lines 3-4)
- `src/services/gemini.ts` (lines 13, 50)

---

## What Stays Unchanged

- **WebSocket ticker** (`src/services/okx/websocket.ts`) — stays client-side for real-time prices
- **All React UI components** — zero changes to component code
- **Supabase database** — schema, migrations unchanged
- **Analytics libraries** (`tradingAnalytics.ts`, `portfolioAnalytics.ts`) — stay as client-side code
- **Budget/finance CRUD** (`src/services/supabase/storage.ts`) — direct Supabase calls
- **Instance switcher** (`useTradingInstance.ts`) — uses localStorage, works in browser
- **Types** (`src/types/`) — all type definitions unchanged

---

## Implementation Order & Dependencies

```
Phase 1 (Scaffold)
    │
    ▼
Phase 2 (Backend Runnables) ──────► Phase 3 (Scheduled Sync)
    │                                       │
    ▼                                       ▼
Phase 4 (Auth Removal) ◄───────────────────┘
    │
    ▼
Phase 6 (Cleanup & Deploy)

Phase 5 (Analytics Cache) ── deferred, independent
```

- Phase 1 must come first
- Phase 2 and 3 can partially overlap (3 depends on 2A for OKX proxy)
- Phase 4 can start alongside Phase 2 (auth removal is independent of backend runnables)
- Phase 6 is the final cleanup after everything works
- Phase 5 is optional and independent

---

## Goal

A fully Windmill-hosted WealthFlow app where:
- The React app is served by Windmill as a full-code app
- OKX trade/balance sync runs automatically on a schedule (no manual "Sync" button needed, though it remains as an option)
- All backend logic (API proxying, HMAC signing, sync) lives in Python runnables
- No Firebase dependency
- No login page — app is accessed directly through Windmill
- Supabase is a pure database (no Edge Functions, no Auth)

---

## Acceptance Criteria

- [ ] `wmill app dev .` starts the React app locally with hot reload
- [ ] All 7 routes render correctly (Dashboard, Transactions, Budget, Monthly, Trading, Portfolio)
- [ ] No `/login` route exists; app renders immediately without auth
- [ ] Tailwind CSS v4 styles and theme toggle (dark/light) work
- [ ] OKX proxy calls go through `backend/okx_proxy.py` (not Edge Functions)
- [ ] Gemini AI calls go through `backend/gemini_proxy.py` (not Edge Functions)
- [ ] Manual sync from Trading page imports trades via `backend/sync_trades.py`
- [ ] Manual sync from Portfolio page imports balances via `backend/sync_balances.py`
- [ ] Scheduled trade sync runs hourly and is visible in Windmill job monitor
- [ ] Scheduled balance sync runs every 30 minutes
- [ ] Both live and demo instances sync independently
- [ ] OKX WebSocket live prices stream correctly (CSP configured)
- [ ] Budget CRUD (accounts, transactions, categories) works unchanged
- [ ] `wmill app push` deploys the app to the Windmill instance
- [ ] GitHub Actions workflow deploys on merge to `main`
- [ ] `supabase/functions/` directory is deleted (Edge Functions retired)
- [ ] `firebase.json` and Firebase workflow are deleted
- [ ] No `import.meta.env.VITE_SUPABASE_ANON_KEY` references remain
- [ ] No `supabase.functions.invoke` references remain
- [ ] No `supabase.auth.*` references remain

---

## Complete File List

| # | File | Action |
|---|------|--------|
| 1 | `f/wealthflow/wealthflow.app/wmill-app.yaml` | Create |
| 2 | `f/wealthflow/wealthflow.app/package.json` | Create (adapted from root) |
| 3 | `f/wealthflow/wealthflow.app/vite.config.ts` | Create (adapted for IIFE) |
| 4 | `f/wealthflow/wealthflow.app/tsconfig.json` | Create |
| 5 | `f/wealthflow/wealthflow.app/tsconfig.app.json` | Create |
| 6 | `f/wealthflow/wealthflow.app/tsconfig.node.json` | Create |
| 7 | `f/wealthflow/wealthflow.app/index.html` | Create (from root) |
| 8 | `f/wealthflow/wealthflow.app/src/` | Copy (all frontend code) |
| 9 | `f/wealthflow/wealthflow.app/src/App.tsx` | Modify (remove auth) |
| 10 | `f/wealthflow/wealthflow.app/src/router.tsx` | Modify (remove /login) |
| 11 | `f/wealthflow/wealthflow.app/src/services/supabase/client.ts` | Modify (service-role, no auth) |
| 12 | `f/wealthflow/wealthflow.app/src/services/okx/client.ts` | Modify (use backend(), remove sync fns) |
| 13 | `f/wealthflow/wealthflow.app/src/services/gemini.ts` | Modify (use backend()) |
| 14 | `f/wealthflow/wealthflow.app/src/features/trading/TradingPage.tsx` | Modify (sync via backend) |
| 15 | `f/wealthflow/wealthflow.app/src/features/portfolio/PortfolioPage.tsx` | Modify (sync via backend) |
| 16 | `f/wealthflow/wealthflow.app/backend/okx_proxy.py` | Create |
| 17 | `f/wealthflow/wealthflow.app/backend/gemini_proxy.py` | Create |
| 18 | `f/wealthflow/wealthflow.app/backend/sync_trades.py` | Create |
| 19 | `f/wealthflow/wealthflow.app/backend/sync_balances.py` | Create |
| 20 | `.github/workflows/windmill-deploy.yml` | Create |
| 21 | `firebase.json` | Delete |
| 22 | `.firebaserc` | Delete (if exists) |
| 23 | `.github/workflows/firebase-deploy.yml` | Delete |
| 24 | `supabase/functions/okx-proxy/` | Delete (entire directory) |
| 25 | `supabase/functions/gemini-proxy/` | Delete (entire directory) |
| 26 | `src/features/auth/LoginPage.tsx` | Delete (if exists) |
