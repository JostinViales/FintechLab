# WealthFlow

A personal finance platform built with React and hosted on Windmill. Track accounts, manage transactions, set budgets, monitor OKX trading, and get AI-powered financial insights.

---

## Features

### Dashboard
- **Net Worth Overview** — Real-time aggregation across all accounts
- **Monthly Income & Expense Summary** — At-a-glance financial health
- **Balance Analytics** — Visual breakdown of account distribution
- **Recent Transactions** — Quick access to latest activity

### Account Management
- Support for multiple account types: Checking, Savings, Credit, Loan, Debt, Investment, Cash
- Automatic balance updates based on transactions

### Transaction Tracking
- Record income, expenses, and transfers between accounts
- Bulk transaction import for faster data entry
- Advanced filtering and sorting (by date, category, account)

### Budget Planning
- **Monthly Budget** — Set spending limits per category
- **Monthly Overview** — Compare actual spending vs. budgeted amounts

### Trading (OKX Integration)
- Automated trade sync from OKX exchange (position-based)
- Asset balance tracking across trading, funding, and earn accounts
- P&L analytics, equity curves, drawdown charts
- Strategy tagging and performance analysis
- AI-powered trade signals, risk assessment, and rebalancing suggestions

### Portfolio
- Holdings overview with live OKX ticker prices
- Diversification analysis and risk metrics
- Holding duration timeline

### AI Financial Advisor
- Natural language financial Q&A powered by Gemini
- Context-aware responses based on your actual financial data

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, React Router (memory) |
| Styling | Tailwind CSS v4 (pre-compiled) |
| Charts | Recharts |
| Backend | Windmill (Python runnables) |
| Database | Supabase (PostgreSQL) |
| AI | Google Gemini |
| Exchange | OKX API (HMAC-SHA256 signed) |
| Hosting | Windmill Cloud |

---

## Architecture

```
Windmill Cloud (fintechlab workspace)
├── Full-Code React App (f/wealthflow/wealthflow)
│   └── Bundled by Windmill esbuild, served in iframe
├── Backend Runnables (Python)
│   ├── get_supabase_config — Returns DB config to frontend
│   ├── okx_proxy — HMAC-signed OKX API proxy
│   ├── gemini_proxy — Gemini AI proxy
│   ├── sync_trades — Scheduled OKX trade sync
│   └── sync_balances — Scheduled OKX balance sync
└── Supabase (PostgreSQL)
    └── accounts, transactions, categories, trades, balances, etc.
```

---

## Development

See [CLAUDE.md](CLAUDE.md) for full architecture docs, commands, conventions, and database schema.

### Quick start

```bash
cd f/wealthflow/wealthflow.raw_app

# Recompile Tailwind CSS (after style changes)
npx @tailwindcss/cli -i src/styles/globals.css -o index.css --minify

# Deploy
wmill script push f/wealthflow/<script>.py   # Push a backend script
wmill app push f/wealthflow/wealthflow.raw_app f/wealthflow/wealthflow  # Push the app
```

---

## License

MIT
