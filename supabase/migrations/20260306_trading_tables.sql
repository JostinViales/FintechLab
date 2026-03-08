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
