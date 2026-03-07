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
