CREATE TABLE IF NOT EXISTS user_provider_keys (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('openai','deepseek','groq','openrouter')),
  model TEXT NOT NULL,
  base_url TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  iv TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(user_id,provider)
);
CREATE INDEX IF NOT EXISTS idx_provider_keys_user ON user_provider_keys(user_id);
