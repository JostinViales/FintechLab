-- Add instance column to all 7 trading tables for live/demo data isolation
-- Existing data backfills as 'live' via DEFAULT.

-- 1. trades
ALTER TABLE trades
  ADD COLUMN instance TEXT NOT NULL DEFAULT 'live'
  CHECK (instance IN ('live', 'demo'));

-- Drop existing unique constraint on okx_trade_id, replace with instance-scoped partial unique
ALTER TABLE trades DROP CONSTRAINT IF EXISTS trades_okx_trade_id_key;
CREATE UNIQUE INDEX trades_okx_trade_id_instance_uniq
  ON trades (okx_trade_id, instance) WHERE okx_trade_id IS NOT NULL;

CREATE INDEX idx_trades_instance ON trades (instance);

-- 2. asset_balances
ALTER TABLE asset_balances
  ADD COLUMN instance TEXT NOT NULL DEFAULT 'live'
  CHECK (instance IN ('live', 'demo'));

ALTER TABLE asset_balances DROP CONSTRAINT IF EXISTS asset_balances_asset_key;
ALTER TABLE asset_balances ADD CONSTRAINT asset_balances_asset_user_instance_uniq
  UNIQUE (asset, user_id, instance);

CREATE INDEX idx_asset_balances_instance ON asset_balances (instance);

-- 3. watchlist
ALTER TABLE watchlist
  ADD COLUMN instance TEXT NOT NULL DEFAULT 'live'
  CHECK (instance IN ('live', 'demo'));

ALTER TABLE watchlist DROP CONSTRAINT IF EXISTS watchlist_symbol_key;
ALTER TABLE watchlist ADD CONSTRAINT watchlist_symbol_user_instance_uniq
  UNIQUE (symbol, user_id, instance);

-- 4. strategy_tags
ALTER TABLE strategy_tags
  ADD COLUMN instance TEXT NOT NULL DEFAULT 'live'
  CHECK (instance IN ('live', 'demo'));

-- Drop FK from trades.strategy_tag → strategy_tags(name) before modifying unique constraint.
-- The FK can't reference a multi-column unique; strategy_tag becomes a soft reference.
ALTER TABLE trades DROP CONSTRAINT IF EXISTS trades_strategy_tag_fkey;

ALTER TABLE strategy_tags DROP CONSTRAINT IF EXISTS strategy_tags_name_key;
ALTER TABLE strategy_tags ADD CONSTRAINT strategy_tags_name_user_instance_uniq
  UNIQUE (name, user_id, instance);

-- 5. trading_goals
ALTER TABLE trading_goals
  ADD COLUMN instance TEXT NOT NULL DEFAULT 'live'
  CHECK (instance IN ('live', 'demo'));

ALTER TABLE trading_goals DROP CONSTRAINT IF EXISTS trading_goals_period_type_period_key_key;
ALTER TABLE trading_goals ADD CONSTRAINT trading_goals_period_user_instance_uniq
  UNIQUE (period_type, period_key, user_id, instance);

-- 6. trading_limits
-- First add user_id (was missing from RLS migration) + RLS
ALTER TABLE trading_limits ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE trading_limits ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trading_limits' AND policyname = 'Users access own limits'
  ) THEN
    CREATE POLICY "Users access own limits" ON trading_limits
      FOR ALL USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

ALTER TABLE trading_limits
  ADD COLUMN instance TEXT NOT NULL DEFAULT 'live'
  CHECK (instance IN ('live', 'demo'));

-- Drop existing partial unique index and recreate with instance
DROP INDEX IF EXISTS idx_trading_limits_active;
CREATE UNIQUE INDEX trading_limits_period_user_instance_active_uniq
  ON trading_limits (period_type, user_id, instance) WHERE is_active = TRUE;

-- 7. okx_credentials
ALTER TABLE okx_credentials
  ADD COLUMN instance TEXT NOT NULL DEFAULT 'live'
  CHECK (instance IN ('live', 'demo'));

ALTER TABLE okx_credentials DROP CONSTRAINT IF EXISTS okx_credentials_user_unique;
ALTER TABLE okx_credentials ADD CONSTRAINT okx_credentials_user_instance_uniq
  UNIQUE (user_id, instance);
