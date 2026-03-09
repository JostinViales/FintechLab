-- Add instance column to all 7 trading tables for live/demo data isolation

-- 1. trades
ALTER TABLE trades
  ADD COLUMN instance TEXT NOT NULL DEFAULT 'live'
  CHECK (instance IN ('live', 'demo'));

-- Drop existing unique index on okx_trade_id, replace with instance-scoped partial unique
DROP INDEX IF EXISTS trades_okx_trade_id_key;
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
ALTER TABLE trading_limits
  ADD COLUMN instance TEXT NOT NULL DEFAULT 'live'
  CHECK (instance IN ('live', 'demo'));

-- Drop existing partial unique index and recreate with instance
DROP INDEX IF EXISTS trading_limits_period_type_idx;
CREATE UNIQUE INDEX trading_limits_period_user_instance_active_uniq
  ON trading_limits (period_type, user_id, instance) WHERE is_active = TRUE;

-- 7. okx_credentials
ALTER TABLE okx_credentials
  ADD COLUMN instance TEXT NOT NULL DEFAULT 'live'
  CHECK (instance IN ('live', 'demo'));

ALTER TABLE okx_credentials DROP CONSTRAINT IF EXISTS okx_credentials_user_id_key;
ALTER TABLE okx_credentials ADD CONSTRAINT okx_credentials_user_instance_uniq
  UNIQUE (user_id, instance);
