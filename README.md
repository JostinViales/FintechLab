# WealthFlow

A modern personal finance tracker built with React, TypeScript, and Supabase. Track accounts, manage transactions, set budgets, and get AI-powered financial insights.

---

## Features

### 📊 Dashboard
- **Net Worth Overview** — Real-time aggregation across all accounts
- **Monthly Income & Expense Summary** — At-a-glance financial health
- **Balance Analytics** — Visual breakdown of account distribution
- **Recent Transactions** — Quick access to latest activity

### 💳 Account Management
- Support for multiple account types: Checking, Savings, Credit, Loan, Debt, Investment, Cash
- Automatic balance updates based on transactions
- Edit and delete accounts with balance recalculation

### 💸 Transaction Tracking
- Record income, expenses, and transfers between accounts
- Bulk transaction import for faster data entry
- Advanced filtering and sorting (by date, category, account, status)
- Category-based organization

### 📅 Budget Planning
- **Monthly Budget** — Set spending limits per category
- **Monthly Overview** — Compare actual spending vs. budgeted amounts
- Category management with add/edit/delete support
- Visual progress indicators for budget utilization

### 🤖 AI Financial Advisor
- Natural language financial Q&A powered by Gemini API
- Context-aware responses based on your actual financial data
- Personalized insights and recommendations

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Icons | Lucide React |
| Database | Supabase (PostgreSQL) |
| AI | Google Gemini API |
| Build Tool | Vite |

---

## Getting Started

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **Supabase Account** — For database persistence
- **Gemini API Key** — For AI advisor functionality

### Installation

1. **Clone the repository**
   ```bash
   git clone git@github.com:JostinViales/WealthFlow.git
   cd WealthFlow
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Configure Supabase**
   
   Update `services/supabaseClient.ts` with your Supabase project URL and anon key.

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open in browser**
   
   Navigate to `http://localhost:5173`

---

## Project Structure

```
├── App.tsx                 # Main application component
├── types.ts                # TypeScript type definitions
├── components/
│   ├── AI/                 # AI Financial Advisor
│   ├── Accounts/           # Account management components
│   ├── Budget/             # Budget planning & overview
│   ├── Charts/             # Data visualizations
│   ├── Transactions/       # Transaction forms & lists
│   └── ui/                 # Reusable UI components
├── services/
│   ├── geminiService.ts    # Gemini AI integration
│   ├── supabaseClient.ts   # Supabase client config
│   └── supabaseStorageService.ts  # Data persistence layer
└── index.html              # Entry point
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

---

## License

MIT

