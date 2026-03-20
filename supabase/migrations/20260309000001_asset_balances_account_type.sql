-- Add account_type column to distinguish Trading / Funding / Earn holdings
ALTER TABLE asset_balances
  ADD COLUMN account_type TEXT NOT NULL DEFAULT 'trading'
  CHECK (account_type IN ('trading', 'funding', 'earn'));

-- Drop the old unique constraint (asset, user_id, instance)
ALTER TABLE asset_balances
  DROP CONSTRAINT IF EXISTS asset_balances_asset_user_instance_uniq;

-- Add new unique constraint including account_type
ALTER TABLE asset_balances
  ADD CONSTRAINT asset_balances_asset_user_instance_accttype_uniq
  UNIQUE (asset, user_id, instance, account_type);

-- Set DEFAULT auth.uid() on user_id for all trading tables
-- (fixes RLS WITH CHECK failures when inserting without explicit user_id)
ALTER TABLE asset_balances ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE trades ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE watchlist ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE trading_goals ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE strategy_tags ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE trading_limits ALTER COLUMN user_id SET DEFAULT auth.uid();
