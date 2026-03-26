-- Position-based sync: add position columns to trades + earnings to asset_balances
-- Supports OKX positions-history endpoint data alongside existing fill-based records

-- Position columns on trades table
ALTER TABLE trades ADD COLUMN okx_pos_id TEXT;
ALTER TABLE trades ADD COLUMN direction TEXT CHECK (direction IN ('long', 'short', 'net'));
ALTER TABLE trades ADD COLUMN open_avg_px NUMERIC;
ALTER TABLE trades ADD COLUMN close_avg_px NUMERIC;
ALTER TABLE trades ADD COLUMN funding_fee NUMERIC DEFAULT 0;
ALTER TABLE trades ADD COLUMN liq_penalty NUMERIC DEFAULT 0;
ALTER TABLE trades ADD COLUMN pnl_ratio NUMERIC;
ALTER TABLE trades ADD COLUMN leverage TEXT;
ALTER TABLE trades ADD COLUMN margin_mode TEXT CHECK (margin_mode IN ('isolated', 'cross'));
ALTER TABLE trades ADD COLUMN open_time TIMESTAMPTZ;
ALTER TABLE trades ADD COLUMN close_time TIMESTAMPTZ;

-- Position dedup index (parallel to existing okx_trade_id dedup)
CREATE UNIQUE INDEX trades_okx_pos_id_instance_uniq
  ON trades (okx_pos_id, instance) WHERE okx_pos_id IS NOT NULL;

CREATE INDEX idx_trades_okx_pos_id
  ON trades (okx_pos_id) WHERE okx_pos_id IS NOT NULL;

-- Earnings column for earn/savings account balances
ALTER TABLE asset_balances ADD COLUMN earnings NUMERIC DEFAULT 0;
