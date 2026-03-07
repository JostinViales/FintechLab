# WealthFlow — Personal Finance Platform

Multi-module finance platform: budget tracking, trading (OKX), portfolio management, and financial goals.

## Tech Stack

- **Frontend**: React 19, TypeScript 5.8 (strict), Vite 6, React Router 6
- **Styling**: Tailwind CSS v4 (build pipeline), CSS custom properties (dark/light theme)
- **Charts**: Recharts
- **Backend**: Supabase (PostgreSQL + auth), Gemini AI (financial advisor)
- **Hosting**: Firebase Hosting, GitHub Actions CI/CD
- **Testing**: Vitest, Testing Library

## Commands

```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Type-check + production build
npm run lint         # ESLint (src/)
npm run lint:fix     # ESLint auto-fix
npm run format       # Prettier write
npm run format:check # Prettier check
npm run test         # Vitest run
npm run type-check   # TypeScript check
```

## Directory Structure

```
src/
├── main.tsx                    # Entry: RouterProvider
├── App.tsx                     # Layout shell: Sidebar + Outlet + global state
├── router.tsx                  # createBrowserRouter route definitions
├── types/                      # Domain types (accounts, transactions, budget, trading)
├── services/
│   ├── supabase/               # client.ts, storage.ts (CRUD)
│   ├── gemini.ts               # AI financial advisor
│   └── okx/                    # OKX exchange API (placeholder)
├── features/                   # Route-level page components
│   ├── dashboard/
│   ├── transactions/
│   ├── budget/                 # BudgetPage + MonthlyOverviewPage
│   ├── trading/                # Placeholder
│   ├── portfolio/              # Placeholder
│   └── goals/                  # Placeholder
├── components/                 # Shared UI
│   ├── ui/                     # Card, ThemeToggle
│   ├── layout/                 # Sidebar, MobileNav
│   ├── accounts/               # AccountList, AccountForm
│   ├── transactions/           # TransactionForm, TransactionList, BulkTransactionForm
│   ├── budget/                 # MonthlyBudget, MonthlyOverview
│   ├── charts/                 # BalanceChart
│   └── ai/                     # FinancialAdvisor
├── hooks/                      # Custom hooks (future)
├── lib/                        # Pure utilities (format.ts)
├── styles/                     # globals.css, theme.css
└── test/                       # Test setup
```

## Module Map

| Module | Directories | Status |
|--------|------------|--------|
| Budget & Finance | `features/dashboard`, `features/transactions`, `features/budget`, `components/accounts`, `components/transactions`, `components/budget`, `components/charts` | Active |
| AI Advisor | `components/ai`, `services/gemini.ts` | Active |
| Trading | `features/trading`, `services/okx/` | Placeholder |
| Portfolio | `features/portfolio` | Placeholder |
| Goals | `features/goals` | Placeholder |

## Conventions

### Naming
- **Components**: PascalCase (`AccountList.tsx`), named exports
- **Hooks/utils/services**: camelCase (`formatCurrency`, `loadData`)
- **Directories**: lowercase (`components/accounts/`)
- **Props**: `interface XxxProps` above component

### Routing
- `createBrowserRouter` in `src/router.tsx`
- Layout routes: `App.tsx` renders `<Outlet context={...} />`
- Pages use `useOutletContext<AppContext>()` for data access

### State
- Global state in `App.tsx` via `useState` + Supabase persistence
- Data passed to pages via outlet context
- Future: extract into custom hooks in `hooks/`

### Services
- All API calls through `services/`, never in components
- Supabase client requires env vars (no hardcoded fallbacks)

### Imports
Order: React → react-router → third-party → @/ aliases → relative

### Styling
- Tailwind utility classes + CSS custom properties (`var(--bg-primary)`)
- Dark mode via `data-theme="dark"` on `<html>`
- Theme variables in `src/styles/theme.css`

## Environment Variables

```bash
VITE_SUPABASE_URL=          # Supabase project URL
VITE_SUPABASE_ANON_KEY=     # Supabase anon/public key
VITE_GEMINI_API_KEY=        # Google Gemini API key
# Future:
VITE_OKX_API_KEY=           # OKX exchange API key
VITE_OKX_SECRET_KEY=        # OKX secret key
VITE_OKX_PASSPHRASE=        # OKX passphrase
```

## Database Schema (Supabase)

| Table | Key Columns |
|-------|------------|
| `accounts` | id, name, type, balance, color |
| `transactions` | id, date, description, amount, type, account_id, to_account_id, category |
| `categories` | id, name, default_monthly_budget |
| `monthly_budgets` | id, category_id, month, amount |

## Git

- Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`)
- Feature branches, PRs to `main`
- CI: lint + type-check + build before deploy
- Preview deploys on PRs via Firebase

## Tech Debt

- [ ] App.tsx state refactor → custom hooks/context
- [ ] Write test cases (Vitest + Testing Library)
- [ ] Implement OKX API client
- [ ] Error boundaries
- [ ] Code splitting (React.lazy for feature pages)
- [ ] Auth + Row Level Security
