-- OKX API credentials storage (single-row table for personal use)
CREATE TABLE IF NOT EXISTS okx_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key TEXT NOT NULL,
  secret_key TEXT NOT NULL,
  passphrase TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
