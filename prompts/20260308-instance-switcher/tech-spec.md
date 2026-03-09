---
slug: "20260308-instance-switcher"
title: "Live/Demo Instance Switching with Auto-Sync"
spec_type: tech-spec
project: FL
domain: [architecture, plugin, pipeline]
source_repo: "JostinViales/FintechLab"
# Fields below are filled by /publish-spec — leave as-is
notion_url: ""
gh_issue:
gh_prs: []
status: draft
published_at:
---

# Tech Spec: Live/Demo Instance Switching with Auto-Sync

## Persona

You are a senior frontend/fullstack engineer experienced with React 19, TypeScript, Supabase (PostgreSQL + Edge Functions), and crypto exchange APIs (OKX). You understand multi-environment data isolation, real-time WebSocket integrations, and progressive UX patterns for trading platforms.

## Task

Implement a Live/Demo instance switcher in the sidebar that:
1. Separates all trading data (trades, balances, watchlist, strategy tags, goals, limits) by instance at the database level
2. Stores separate OKX API credentials per instance (live keys vs demo keys)
3. Automatically syncs trades and balances from OKX when switching instances
4. Removes the manual "Trading Mode" toggle from Settings — the sidebar switcher replaces it
5. Shows a subtle error banner when credentials are missing for the target instance

## Systems Involved

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (React 19 + TypeScript)                       │
│                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Sidebar  │  │ TradingPage  │  │ PortfolioPage    │   │
│  │ Instance │──│ Auto-sync    │  │ Auto-sync        │   │
│  │ Switcher │  │ + data load  │  │ + data load      │   │
│  └────┬─────┘  └──────┬───────┘  └────────┬─────────┘   │
│       │               │                   │             │
│       ▼               ▼                   ▼             │
│  ┌─────────────────────────────────────────────────┐    │
│  │  TradingInstanceContext (React Context)          │    │
│  │  instance: 'live' | 'demo'                      │    │
│  │  setInstance() → localStorage + OKX client mode  │    │
│  └──────────────────────┬──────────────────────────┘    │
│                         │                               │
│  ┌──────────────────────▼──────────────────────────┐    │
│  │  Service Layer                                   │    │
│  │  trading.ts: all queries filter by instance      │    │
│  │  okx/client.ts: sync functions pass instance     │    │
│  └──────────────────────┬──────────────────────────┘    │
└─────────────────────────┼───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Supabase Edge Function (okx-proxy)                     │
│  - Credential lookup filtered by instance               │
│  - x-simulated-trading: 1 header for demo               │
│  - HMAC signing with instance-specific keys             │
└──────────────────────┬──────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼                         ▼
┌──────────────────┐    ┌──────────────────┐
│  OKX Live API    │    │  OKX Demo API    │
│  ws.okx.com      │    │  wspap.okx.com   │
│  www.okx.com     │    │  www.okx.com     │
│                  │    │  + simulated hdr  │
└──────────────────┘    └──────────────────┘
```

## Data Flow

### Instance Switch Sequence

```
User clicks "Demo" in sidebar
  → TradingInstanceContext.setInstance('demo')
    → localStorage.set('wealthflow:trading-instance', 'demo')
    → setDemoMode(true) on OKX client (sets demo flag for API calls)
    → okxWebSocket.setDemoMode(true) (reconnects to demo WS endpoint)
    → React re-render triggers useEffect in TradingPage/PortfolioPage
      → loading = true, show spinner
      → syncTradesFromOkx('demo') + syncBalancesFromOkx('demo') in parallel
        → Edge function looks up credentials WHERE instance = 'demo'
        → OKX API called with x-simulated-trading: 1
        → New trades saved with instance = 'demo'
      → Reload all data with .eq('instance', 'demo')
      → loading = false, render demo data
```

### Credential Storage Flow

```
User enters Demo API keys in Settings
  → storeCredentials(apiKey, secretKey, passphrase)
    → Edge function receives { ..., demo: true }
    → DELETE FROM okx_credentials WHERE user_id = X AND instance = 'demo'
    → INSERT INTO okx_credentials (..., instance = 'demo')
```

## Steps

### Step 1: Type Definition

**File**: `src/types/trading.ts`

Add:
```typescript
export type TradingInstance = 'live' | 'demo';
```

**File**: `src/types/index.ts`
- Export `TradingInstance` from the barrel.

---

### Step 2: Database Migration

**New file**: `supabase/migrations/20260308_instance_mode.sql`

Add `instance TEXT NOT NULL DEFAULT 'live' CHECK (instance IN ('live', 'demo'))` column to all 7 tables:

| Table | Column Added | Constraint Changes |
|-------|-------------|-------------------|
| `trades` | `instance` | Add `UNIQUE(okx_trade_id, instance) WHERE okx_trade_id IS NOT NULL` |
| `asset_balances` | `instance` | `UNIQUE(asset)` → `UNIQUE(asset, user_id, instance)` |
| `watchlist` | `instance` | `UNIQUE(symbol)` → `UNIQUE(symbol, user_id, instance)` |
| `strategy_tags` | `instance` | `UNIQUE(name)` → `UNIQUE(name, user_id, instance)` |
| `trading_goals` | `instance` | `UNIQUE(period_type, period_key)` → `UNIQUE(period_type, period_key, user_id, instance)` |
| `trading_limits` | `instance` | Partial index `(period_type) WHERE is_active` → `(period_type, user_id, instance) WHERE is_active` |
| `okx_credentials` | `instance` | `UNIQUE(user_id)` → `UNIQUE(user_id, instance)` |

- Add indexes on `instance` for `trades` and `asset_balances` (most queried).
- Existing data backfills as `'live'` via the `DEFAULT`.
- No RLS changes needed — existing `user_id` policies remain; `instance` is data-partitioning, not access-control.

---

### Step 3: Edge Function — Credential Isolation

**File**: `supabase/functions/okx-proxy/index.ts`

**`getCredentials()`**: Add instance filter to credential lookup:
```typescript
.eq('user_id', userId)
.eq('instance', demo ? 'demo' : 'live')
```

**`handleStoreCredentials()`**: Scope delete + insert to specific instance:
```typescript
const instance = body.demo ? 'demo' : 'live';
// Delete only this instance's credentials
await adminDb.from('okx_credentials').delete()
  .eq('user_id', userId).eq('instance', instance);
// Insert with instance field
await adminDb.from('okx_credentials').insert({
  api_key: apiKey, secret_key: secretKey, passphrase,
  user_id: userId, instance,
});
```

No API contract changes needed — the existing `body.demo` flag derives the instance.

---

### Step 4: React Context — TradingInstanceProvider

**New file**: `src/hooks/useTradingInstance.ts`

```typescript
// TradingInstanceProvider: wraps App layout
// useTradingInstance(): returns { instance, setInstance, isDemo }
//
// State source: localStorage key 'wealthflow:trading-instance' (default: 'live')
// Side effects on setInstance:
//   1. Persist to localStorage
//   2. setDemoMode(instance === 'demo') on OKX client
//   3. okxWebSocket.setDemoMode(instance === 'demo')
```

This replaces the global mutable `let demoMode` pattern — the hook becomes the sole driver of demo mode.

---

### Step 5: App.tsx — Provider Wrapper

**File**: `src/App.tsx`

Wrap layout content with `<TradingInstanceProvider>`. No prop drilling — all consumers use the context hook directly.

---

### Step 6: Service Layer — Instance-Scoped Queries

**File**: `src/services/supabase/trading.ts`

Add `instance: TradingInstance` parameter to all read/write functions. Every SELECT query gets `.eq('instance', instance)`. Every INSERT gets `instance` in the row object.

Functions that operate by `id` only (`updateTrade`, `deleteTrade`, `deleteStrategyTag`, `removeFromWatchlist`, `deleteTradingLimit`) need no change since IDs are globally unique.

Key upsert changes:
- `upsertAssetBalance`: `onConflict: 'asset,user_id,instance'`
- `saveTradingGoal`: `onConflict: 'period_type,period_key,user_id,instance'`
- `saveTradingLimit`: update `onConflict` to include `instance`

---

### Step 7: OKX Client — Instance-Aware Sync

**File**: `src/services/okx/client.ts`

- `syncTradesFromOkx(instance)`: pass instance to `loadTrades()` and `saveTrade()`
- `syncBalancesFromOkx(instance)`: pass instance to `upsertAssetBalance()`
- Keep `setDemoMode`/`isDemoMode` — now driven solely by the context hook, not the Settings UI

---

### Step 8: Sidebar — Segmented Pill Toggle

**File**: `src/components/layout/Sidebar.tsx`

- Call `useTradingInstance()` from context
- Add segmented pill toggle between the budget section and Trading/Portfolio nav links
- "Live" button: emerald (`bg-emerald-500`) when active
- "Demo" button: amber (`bg-amber-500`) when active
- Remove the "Coming Soon" section header — Trading/Portfolio are active features

```
┌──────────────────────────┐
│  Dashboard               │
│  Monthly Overview        │
│  Transactions            │
│  Monthly Budget          │
│                          │
│  ┌─────────┬──────────┐  │
│  │ ● Live  │   Demo   │  │
│  └─────────┴──────────┘  │
│                          │
│  Trading                 │
│  Portfolio               │
│  AI Advisor              │
└──────────────────────────┘
```

---

### Step 9: TradingPage — Auto-Sync on Instance Change

**File**: `src/features/trading/TradingPage.tsx`

- Call `useTradingInstance()` to get `instance`
- Replace initial `useEffect` with one that depends on `instance`:
  1. Set `loading = true`
  2. Run `syncTradesFromOkx(instance)` + `syncBalancesFromOkx(instance)` in parallel
  3. Reload all 6 data sources with `instance` parameter
  4. Set `loading = false`
- Add `syncError: string | null` state — if sync fails due to missing credentials, show inline banner:
  > "No API keys configured for Demo. Set up in Settings."
- Pass `instance` to all service calls throughout the component

---

### Step 10: PortfolioPage — Instance-Aware Loading

**File**: `src/features/portfolio/PortfolioPage.tsx`

- Call `useTradingInstance()` to get `instance`
- Update data loading `useEffect` to depend on `instance`, trigger auto-sync
- Pass `instance` to `loadTrades()` and `loadAssetBalances()`
- Show sync error banner if applicable

---

### Step 11: OkxConnectionSettings — Remove Mode Toggle

**File**: `src/components/trading/OkxConnectionSettings.tsx`

- Remove the "Trading Mode" toggle card entirely (replaced by sidebar switcher)
- Add read-only badge showing current instance: "Configuring: Live" (green) or "Configuring: Demo" (amber)
- Add label on API Keys card: "These credentials are for your [Live/Demo] instance"
- Pass `instance` to `syncTradesFromOkx()` and `syncBalancesFromOkx()`

---

### Step 12: MobileNav — Instance Indicator

**File**: `src/components/layout/MobileNav.tsx`

- Call `useTradingInstance()`
- Add tappable chip in mobile header: "LIVE" (green) or "DEMO" (amber)
- Tapping switches instance (same behavior as sidebar toggle)

## Context

### Key Files

| File | Role |
|------|------|
| `src/types/trading.ts` | `TradingInstance` type definition |
| `src/types/index.ts` | Barrel export |
| `src/hooks/useTradingInstance.ts` | **New** — React context + hook |
| `src/services/supabase/trading.ts` | All trading CRUD — every function gains `instance` param |
| `src/services/okx/client.ts` | OKX API client — sync functions gain `instance` param |
| `src/services/okx/websocket.ts` | WebSocket singleton — `setDemoMode` reconnects to correct endpoint |
| `supabase/functions/okx-proxy/index.ts` | Edge function — credential lookup scoped by instance |
| `src/App.tsx` | Wraps with `TradingInstanceProvider` |
| `src/components/layout/Sidebar.tsx` | Segmented pill toggle UI |
| `src/components/layout/MobileNav.tsx` | Instance indicator chip |
| `src/features/trading/TradingPage.tsx` | Auto-sync on instance change, all queries scoped |
| `src/features/portfolio/PortfolioPage.tsx` | Auto-sync, queries scoped |
| `src/components/trading/OkxConnectionSettings.tsx` | Remove mode toggle, show instance badge |

### Existing Patterns to Reuse

- `setDemoMode()` / `isDemoMode()` in `src/services/okx/client.ts` — keep as-is, just drive from context hook
- `okxWebSocket.setDemoMode()` in `src/services/okx/websocket.ts` — handles WS reconnection
- `onSyncComplete` callback pattern in `OkxConnectionSettings` — reuse for auto-sync completion
- `loadTrades()` filter pattern with optional `TradeFilters` — extend with instance
- Supabase `.upsert()` with `onConflict` composite keys — extend conflict columns

### Architectural Decisions

1. **Database-level isolation** (instance column) over app-level filtering — ensures data integrity even if frontend has bugs
2. **React Context** over prop drilling — instance state needed in Sidebar, TradingPage, PortfolioPage, OkxConnectionSettings, and MobileNav
3. **localStorage persistence** — instance choice survives page refreshes without a DB round-trip
4. **Auto-sync on switch** — reduces manual steps; sync failures handled gracefully with inline banner
5. **Existing `demo` flag reuse** in edge function — no API contract changes needed between client and server

## Goal

After implementation:
- Users switch between Live and Demo with one click in the sidebar
- Each instance has completely separate data: trades, balances, watchlist, strategy tags, goals, limits, and API credentials
- Switching instances automatically syncs the latest trades and balances from OKX
- The app remembers the last-used instance across page refreshes
- No manual "Trading Mode" toggle or API selection is needed

## Acceptance Criteria

- [ ] **Instance column exists** on all 7 trading tables with `CHECK (instance IN ('live', 'demo'))` constraint
- [ ] **Unique constraints updated** — same asset/symbol/tag can exist in both live and demo without conflicts
- [ ] **Separate credentials** — user can store live API keys and demo API keys independently
- [ ] **Sidebar toggle renders** — segmented pill with "Live" (emerald) and "Demo" (amber) states
- [ ] **Mobile indicator renders** — tappable chip in mobile header showing current instance
- [ ] **Instance persists** — refreshing the page keeps the selected instance (localStorage)
- [ ] **Data isolation verified** — adding a trade in Demo does not appear in Live, and vice versa
- [ ] **Auto-sync triggers** — switching instance automatically runs `syncTradesFromOkx` + `syncBalancesFromOkx`
- [ ] **Sync error banner** — switching to an instance with no configured credentials shows: "No API keys configured for [instance]. Set up in Settings."
- [ ] **Settings shows instance** — OkxConnectionSettings displays which instance credentials are being configured
- [ ] **No manual mode toggle** — the "Trading Mode" card is removed from Settings
- [ ] **WebSocket reconnects** — switching instance reconnects to the correct WS endpoint (live vs demo)
- [ ] **Build passes** — `npm run build` completes with no type errors
- [ ] **Rapid switching safe** — toggling quickly does not cause race conditions (loading state gates the toggle)
