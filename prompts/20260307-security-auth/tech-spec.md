---
slug: "20260307-security-auth"
title: "Security Audit & Authentication"
spec_type: tech-spec
project: FL
domain: [architecture, pipeline, plugin]
source_repo: ""
# Fields below are filled by /publish-spec
notion_url: ""
gh_issue:
gh_prs: []
status: draft
published_at:
---

# Security Audit & Authentication — Tech Spec

## Persona

You are a senior security engineer specializing in React + Supabase applications with expertise in OWASP top 10 mitigations, Supabase Auth/RLS, Firebase Hosting security headers, and credential lifecycle management. You follow the WealthFlow codebase conventions (outlet context pattern, Supabase services, CSS custom properties, named exports).

## Task

Perform a comprehensive security hardening of WealthFlow and implement mandatory email + password authentication. Every app open requires sign-in — no persistent sessions. This spec addresses **12 identified vulnerabilities** across authentication, authorization, secrets management, API security, and browser security.

### Deliverables

1. **Login page** — Email + password authentication with Supabase Auth, forced on every app open
2. **Route protection** — All existing routes wrapped in an auth guard
3. **Row-Level Security (RLS)** — User-scoped data isolation for all tables
4. **Credential rotation** — Rotate all exposed secrets (Supabase keys, Gemini API key)
5. **Git history cleanup** — Remove `.env.local` from git history
6. **OKX credential encryption** — Migrate from plain text to user-scoped encrypted storage
7. **Gemini API proxy** — Move Gemini calls to an Edge Function (remove client-side key)
8. **CORS hardening** — Restrict OKX proxy to app domain
9. **Security headers** — CSP, X-Frame-Options, HSTS on Firebase Hosting
10. **Input validation** — Max lengths, schema validation on AI responses

---

## Vulnerability Inventory

| # | Category | Severity | Location | Issue |
|---|----------|----------|----------|-------|
| V1 | Secrets in Git | CRITICAL | `.env.local` in git history | Real API keys committed (Supabase, Gemini) |
| V2 | No Authentication | CRITICAL | `App.tsx`, `router.tsx` | Zero auth — all data publicly accessible |
| V3 | No RLS | CRITICAL | All Supabase tables | Anon key grants full read/write to all data |
| V4 | OKX Creds Plain Text | CRITICAL | `okx_credentials` table | API keys, secrets, passphrases stored unencrypted |
| V5 | Gemini Key in Bundle | HIGH | `vite.config.ts:14-16` | `GEMINI_API_KEY` embedded in client JS bundle |
| V6 | CORS Wildcard | HIGH | `okx-proxy/index.ts:4` | `Access-Control-Allow-Origin: *` on trading proxy |
| V7 | No User Scoping | HIGH | `okx-proxy/index.ts:178-181` | Service role key with no user identity check |
| V8 | No Security Headers | MEDIUM | `firebase.json` | Missing CSP, X-Frame-Options, HSTS, Referrer-Policy |
| V9 | No Input Max Lengths | LOW | `TransactionForm.tsx`, `BulkTransactionForm.tsx` | Text fields accept unlimited input |
| V10 | No Schema Validation | LOW | `gemini.ts:168-173` | AI responses parsed with regex + JSON.parse, no schema |
| V11 | Vite Loads All Env | LOW | `vite.config.ts:7` | `loadEnv(mode, '.', '')` loads ALL vars including secrets |
| V12 | Single-Row Credential Table | MEDIUM | `okx_credentials` migration | No `user_id` — multi-user unsafe, delete-all-then-insert pattern |

---

## Architecture Overview

### Before (Current)

```
Browser
  |-- All routes public (no auth)
  |-- Supabase anon key (no RLS) --> Full DB access
  |-- Gemini API key in JS bundle --> Direct AI calls
  |-- OKX proxy (CORS: *, no user check) --> OKX API
```

### After (Target)

```
Browser
  |-- /login (public)
  |-- /* (auth guard: redirect to /login if no session)
  |
  |-- Supabase Auth (email+password, no persistence)
  |     |-- JWT in Authorization header
  |     |-- RLS policies enforce user_id = auth.uid()
  |
  |-- Gemini Edge Function (new) --> Gemini API
  |     |-- API key in Supabase secrets (never in browser)
  |
  |-- OKX proxy (CORS: app domain, user-scoped)
  |     |-- Validates JWT, queries credentials WHERE user_id = auth.uid()
  |     |-- Credentials encrypted with pgcrypto
```

---

## Implementation Phases

### Phase 1: Authentication & Route Protection (V2)

**Priority: CRITICAL — Do this first.**

#### 1.1 Supabase Auth Setup

Enable Email/Password auth in the Supabase dashboard (Settings > Auth > Email). Disable email confirmation for development; enable it before production.

#### 1.2 Login Page

**New file: `src/features/auth/LoginPage.tsx`**

```typescript
interface LoginPageProps {}

export const LoginPage = () => {
  // State: email, password, loading, error
  // On submit: supabase.auth.signInWithPassword({ email, password })
  // On success: navigate to '/'
  // Sign-up toggle: supabase.auth.signUp({ email, password })
  // No "Remember me" — session is ephemeral
};
```

**Design:**
- Centered card layout using existing `Card` component
- WealthFlow logo/title at top
- Email + password fields with form validation
- Sign In / Sign Up toggle
- Error messages displayed inline
- Uses existing theme CSS variables (dark/light compatible)

#### 1.3 Session Configuration — No Persistence

**Modify: `src/services/supabase/client.ts`**

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
      'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,       // No localStorage/cookies — session dies on tab close
    autoRefreshToken: false,     // No silent refresh — forces re-login
    detectSessionInUrl: false,   // No OAuth redirects
  },
});
```

This ensures every browser open / tab close requires a fresh login.

#### 1.4 Auth Guard & Router Restructure

**Modify: `src/router.tsx`**

```typescript
import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from '@/App';
import { LoginPage } from '@/features/auth/LoginPage';
// ... existing page imports

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <App />,  // App.tsx handles auth check
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'transactions', element: <TransactionsPage /> },
      { path: 'budget', element: <BudgetPage /> },
      { path: 'monthly', element: <MonthlyOverviewPage /> },
      { path: 'trading', element: <TradingPage /> },
      { path: 'portfolio', element: <PortfolioPage /> },
      { path: 'goals', element: <GoalsPage /> },
    ],
  },
]);
```

**Modify: `src/App.tsx`**

Add auth state check at the top of the App component:

```typescript
const [user, setUser] = useState<User | null>(null);
const [authLoading, setAuthLoading] = useState(true);

useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    setUser(session?.user ?? null);
    setAuthLoading(false);
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      setUser(session?.user ?? null);
    }
  );

  return () => subscription.unsubscribe();
}, []);

if (authLoading) return <LoadingSpinner />;
if (!user) return <Navigate to="/login" replace />;
```

#### 1.5 Sign Out

Add a sign-out button to the Sidebar component:

```typescript
// In Sidebar.tsx or layout
const handleSignOut = async () => {
  await supabase.auth.signOut();
  // onAuthStateChange will set user to null -> redirect to /login
};
```

---

### Phase 2: Row-Level Security (V3, V7, V12)

**Priority: CRITICAL — Enables multi-user data isolation.**

#### 2.1 Add `user_id` to All Tables

**New migration: `supabase/migrations/20260307_add_user_id_rls.sql`**

```sql
-- Add user_id column to all existing tables
ALTER TABLE accounts ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE transactions ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE categories ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE monthly_budgets ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE trades ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE asset_balances ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE watchlist ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE trading_goals ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE strategy_tags ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Modify okx_credentials: add user_id, drop single-row assumption
ALTER TABLE okx_credentials ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE okx_credentials ADD CONSTRAINT okx_credentials_user_unique UNIQUE (user_id);

-- Enable RLS on all tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE okx_credentials ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own data
-- Pattern: SELECT, INSERT, UPDATE, DELETE all require auth.uid() = user_id

-- accounts
CREATE POLICY "Users access own accounts" ON accounts
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- transactions
CREATE POLICY "Users access own transactions" ON transactions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- categories
CREATE POLICY "Users access own categories" ON categories
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- monthly_budgets
CREATE POLICY "Users access own budgets" ON monthly_budgets
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- trades
CREATE POLICY "Users access own trades" ON trades
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- asset_balances
CREATE POLICY "Users access own balances" ON asset_balances
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- watchlist
CREATE POLICY "Users access own watchlist" ON watchlist
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- trading_goals
CREATE POLICY "Users access own goals" ON trading_goals
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- strategy_tags
CREATE POLICY "Users access own tags" ON strategy_tags
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- okx_credentials (only accessible via Edge Function, but RLS as defense-in-depth)
CREATE POLICY "Users access own credentials" ON okx_credentials
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

#### 2.2 Update Service Layer

All Supabase CRUD operations in `services/supabase/storage.ts` and `services/supabase/trading.ts` must include `user_id` on inserts. Supabase auto-injects the JWT from the client, so RLS `auth.uid()` resolves automatically — no code changes needed for queries/selects.

For inserts, get the user ID:

```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error('Not authenticated');

// Include user_id in insert
await supabase.from('accounts').insert({ ...data, user_id: user.id });
```

#### 2.3 Update OKX Proxy — User-Scoped Credentials

**Modify: `supabase/functions/okx-proxy/index.ts`**

Replace service role client with user-context client:

```typescript
// Extract user JWT from request Authorization header
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Create client with user's JWT — RLS enforces user_id scoping
const db = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  { global: { headers: { Authorization: authHeader } } },
);
```

This ensures `getCredentials()` only returns the authenticated user's credentials (via RLS).

---

### Phase 3: Secrets Remediation (V1, V4, V5, V11)

**Priority: CRITICAL — Exposed credentials must be rotated.**

#### 3.1 Rotate All Exposed Credentials

| Credential | Action | Where |
|-----------|--------|-------|
| Supabase URL + Anon Key | Regenerate in Supabase Dashboard > Settings > API | Update `.env.local` |
| Gemini API Key | Regenerate in Google AI Studio | Update `.env.local` + Supabase secrets |
| OKX API Key/Secret/Passphrase | Regenerate in OKX account settings | Re-enter via app UI |

#### 3.2 Remove `.env.local` from Git History

```bash
# Option A: BFG Repo-Cleaner (recommended — faster)
bfg --delete-files .env.local

# Option B: git filter-repo
git filter-repo --path .env.local --invert-paths

# After cleanup:
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force-with-lease  # coordinate with collaborators
```

#### 3.3 Encrypt OKX Credentials at Rest

**Modify migration for `okx_credentials`:**

```sql
-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Store credentials encrypted
-- Encryption key stored in Supabase Vault (not in the table)
-- Edge Function encrypts on store, decrypts on read using Vault key
```

**In the Edge Function:**
- On `store-credentials`: encrypt with `pgp_sym_encrypt(value, vault_key)` before insert
- On `getCredentials`: decrypt with `pgp_sym_decrypt(value, vault_key)` on read
- Vault key accessed via `Deno.env.get('OKX_ENCRYPTION_KEY')` (set in Supabase secrets)

#### 3.4 Move Gemini API Key to Edge Function

**New file: `supabase/functions/gemini-proxy/index.ts`**

```typescript
// Proxies Gemini API calls — API key stays server-side
// POST /gemini-proxy
// Body: { action: string, payload: object }
// Actions: 'analyze-trade-signals', 'assess-risk', 'summarize-journal',
//          'suggest-rebalancing', 'financial-advisor', 'categorize-transactions'
```

**Modify: `src/services/gemini.ts`**

Replace direct Gemini API calls with Edge Function calls:

```typescript
// Before (INSECURE):
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

// After (SECURE):
const callGeminiProxy = async (action: string, payload: object) => {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(`${SUPABASE_URL}/functions/v1/gemini-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ action, payload }),
  });
  return response.json();
};
```

**Modify: `vite.config.ts`**

Remove Gemini key injection:

```typescript
// REMOVE these lines:
// define: {
//   'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
//   'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
// },

// REPLACE with:
define: {},
```

Also fix the loadEnv call to only load VITE_ prefixed vars:

```typescript
// Before (loads ALL env vars):
const env = loadEnv(mode, '.', '');

// After (only loads VITE_ vars — safe for client):
const env = loadEnv(mode, '.', 'VITE_');
```

---

### Phase 4: CORS & Security Headers (V6, V8)

#### 4.1 Restrict CORS on OKX Proxy

**Modify: `supabase/functions/okx-proxy/index.ts`**

```typescript
const ALLOWED_ORIGINS = [
  'https://your-app.web.app',        // Firebase Hosting production
  'https://your-app.firebaseapp.com', // Firebase Hosting alt domain
  'http://localhost:3000',            // Local development
];

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
};
```

Apply same CORS to the new `gemini-proxy` Edge Function.

#### 4.2 Add Security Headers to Firebase Hosting

**Modify: `firebase.json`**

Add a global headers block:

```json
{
  "source": "**",
  "headers": [
    {
      "key": "X-Frame-Options",
      "value": "DENY"
    },
    {
      "key": "X-Content-Type-Options",
      "value": "nosniff"
    },
    {
      "key": "Referrer-Policy",
      "value": "strict-origin-when-cross-origin"
    },
    {
      "key": "Permissions-Policy",
      "value": "camera=(), microphone=(), geolocation=()"
    },
    {
      "key": "Content-Security-Policy",
      "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co wss://ws.okx.com:8443 https://your-app.web.app; img-src 'self' data:; font-src 'self'; frame-ancestors 'none';"
    },
    {
      "key": "Strict-Transport-Security",
      "value": "max-age=31536000; includeSubDomains"
    }
  ]
}
```

Note: `unsafe-inline` for `style-src` is required by Tailwind CSS. The `connect-src` must include Supabase and OKX WebSocket domains.

---

### Phase 5: Input Validation & Schema Hardening (V9, V10)

#### 5.1 Add Max Length Constraints

**Modify: Form components with text inputs**

| Field | Component | Max Length |
|-------|-----------|-----------|
| Description | `TransactionForm.tsx` | 500 chars |
| Description | `BulkTransactionForm.tsx` | 500 chars |
| Trade notes | `TradeForm.tsx` | 1000 chars |
| Category name | Category forms | 100 chars |
| Strategy tag name | `StrategyTagManager.tsx` | 50 chars |

Apply via `maxLength` attribute on `<input>` / `<textarea>` elements.

#### 5.2 Schema Validation for Gemini Responses

**Add dependency:** `zod` (lightweight schema validation)

```bash
npm install zod
```

**New file: `src/lib/schemas.ts`**

Define Zod schemas for all Gemini response shapes:

```typescript
import { z } from 'zod';

export const tradeSignalSchema = z.object({
  signal: z.enum(['buy', 'sell', 'hold']),
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
  entryPrice: z.number().optional(),
  stopLoss: z.number().optional(),
  takeProfit: z.number().optional(),
});

export const riskAssessmentSchema = z.object({
  riskScore: z.number().min(1).max(10),
  factors: z.array(z.string()),
  recommendation: z.string(),
});

// ... schemas for all Gemini response types
```

**Modify: `gemini.ts` response parsing**

Replace regex + raw JSON.parse with schema validation:

```typescript
// Before:
const jsonMatch = text.match(/\{[\s\S]*\}/);
if (jsonMatch) return JSON.parse(jsonMatch[0]) as TradeSignalAnalysis;

// After:
const jsonMatch = text.match(/\{[\s\S]*\}/);
if (jsonMatch) {
  const parsed = JSON.parse(jsonMatch[0]);
  return tradeSignalSchema.parse(parsed);  // Throws ZodError if invalid
}
```

---

## Context: Files to Modify

| File | Changes |
|------|---------|
| `src/services/supabase/client.ts` | Add `persistSession: false`, `autoRefreshToken: false` |
| `src/router.tsx` | Add `/login` route, keep existing routes under auth guard |
| `src/App.tsx` | Add auth state check, redirect to `/login` if no session, sign-out handler |
| `src/services/supabase/storage.ts` | Add `user_id` to all insert operations |
| `src/services/supabase/trading.ts` | Add `user_id` to all insert operations |
| `supabase/functions/okx-proxy/index.ts` | User JWT validation, CORS restriction, user-scoped credentials |
| `src/services/gemini.ts` | Replace direct API calls with Edge Function proxy |
| `vite.config.ts` | Remove `GEMINI_API_KEY` from `define`, fix `loadEnv` prefix |
| `firebase.json` | Add security headers (CSP, X-Frame-Options, HSTS, etc.) |
| `src/components/transactions/TransactionForm.tsx` | Add `maxLength` to text fields |
| `src/components/transactions/BulkTransactionForm.tsx` | Add `maxLength` to text fields |
| `src/components/layout/Sidebar.tsx` | Add sign-out button |

## New Files

| File | Purpose |
|------|---------|
| `src/features/auth/LoginPage.tsx` | Email + password login/signup page |
| `supabase/functions/gemini-proxy/index.ts` | Server-side Gemini API proxy |
| `supabase/migrations/20260307_add_user_id_rls.sql` | Add user_id + RLS to all tables |
| `src/lib/schemas.ts` | Zod schemas for AI response validation |

---

## Goal

After implementation, WealthFlow transitions from a fully open app to a properly secured financial platform where:
- Every visit requires authentication (email + password, no session persistence)
- All data is user-scoped via RLS — one user cannot see another's data
- No secrets are exposed in the client bundle or git history
- OKX credentials are encrypted at rest and user-scoped
- Security headers protect against clickjacking, MIME sniffing, and XSS
- AI responses are schema-validated before rendering

---

## Acceptance Criteria

### Phase 1: Authentication & Route Protection
- [ ] Login page renders at `/login` with email + password fields
- [ ] Sign-up flow creates a new Supabase Auth user
- [ ] Sign-in flow authenticates and redirects to `/`
- [ ] Session is NOT persisted — closing/reopening tab requires re-login
- [ ] All routes except `/login` redirect unauthenticated users to `/login`
- [ ] Sign-out button in sidebar clears session and redirects to `/login`
- [ ] Login page follows existing theme (dark/light mode compatible)
- [ ] Loading spinner shown while checking auth state

### Phase 2: Row-Level Security
- [ ] All tables have a `user_id` column referencing `auth.users(id)`
- [ ] RLS enabled on all tables with `auth.uid() = user_id` policies
- [ ] Existing service layer includes `user_id` in all insert operations
- [ ] OKX proxy validates user JWT and scopes credential queries to authenticated user
- [ ] `okx_credentials` has `UNIQUE(user_id)` constraint (one set of credentials per user)
- [ ] Unauthenticated Supabase queries return empty results (not errors)

### Phase 3: Secrets Remediation
- [ ] All previously exposed credentials (Supabase keys, Gemini API key) are rotated
- [ ] `.env.local` removed from git history (BFG or filter-repo)
- [ ] OKX credentials encrypted at rest using pgcrypto
- [ ] Gemini API key removed from client bundle — all AI calls go through `gemini-proxy` Edge Function
- [ ] `vite.config.ts` no longer injects `GEMINI_API_KEY` into `define`
- [ ] `loadEnv` uses `'VITE_'` prefix filter instead of `''`

### Phase 4: CORS & Security Headers
- [ ] OKX proxy CORS restricted to production domain + localhost:3000
- [ ] Gemini proxy CORS restricted to same origins
- [ ] Firebase Hosting serves `X-Frame-Options: DENY`
- [ ] Firebase Hosting serves `X-Content-Type-Options: nosniff`
- [ ] Firebase Hosting serves `Content-Security-Policy` with restrictive policy
- [ ] Firebase Hosting serves `Strict-Transport-Security` header
- [ ] Firebase Hosting serves `Referrer-Policy: strict-origin-when-cross-origin`

### Phase 5: Input Validation & Schema Hardening
- [ ] All text input fields have `maxLength` constraints
- [ ] Zod schemas defined for all Gemini response types
- [ ] Gemini response parsing uses `schema.parse()` instead of raw `JSON.parse`
- [ ] Invalid AI responses throw a typed error (not a silent failure)

---

## PR / Branch Strategy

| Phase | Branch | PR Title |
|-------|--------|----------|
| 1 | `feat/auth` | feat: Email + password authentication with forced re-login |
| 2 | `feat/rls` | feat: Row-Level Security and user-scoped data isolation |
| 3 | `fix/secrets-remediation` | fix: Rotate exposed credentials, encrypt OKX keys, Gemini proxy |
| 4 | `fix/security-headers` | fix: CORS hardening and browser security headers |
| 5 | `feat/input-validation` | feat: Input validation and AI response schema validation |

**Recommended merge order:** Phase 3 (secrets) > Phase 1 (auth) > Phase 2 (RLS) > Phase 4 (headers) > Phase 5 (validation)

Secrets rotation (Phase 3) should happen first since the credentials are already exposed. Auth (Phase 1) comes next as the foundation for RLS (Phase 2).
