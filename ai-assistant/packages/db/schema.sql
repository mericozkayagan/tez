-- ============================================
-- AI Assistant Platform – Database Schema
-- PostgreSQL 16+
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ──────────────────────────────────

CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      VARCHAR(320) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ─── AI API Keys (encrypted) ────────────────

CREATE TABLE ai_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  provider      VARCHAR(20)  NOT NULL CHECK (provider IN ('openai', 'anthropic')),
  encrypted_key TEXT         NOT NULL,
  iv            TEXT         NOT NULL,
  auth_tag      TEXT         NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_keys_user_id ON ai_keys(user_id);

-- ─── OAuth Accounts (encrypted tokens) ──────

CREATE TABLE oauth_accounts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider                 VARCHAR(20)  NOT NULL CHECK (provider IN ('google', 'notion')),
  encrypted_access_token   TEXT         NOT NULL,
  access_token_iv          TEXT         NOT NULL,
  access_token_tag         TEXT         NOT NULL,
  encrypted_refresh_token  TEXT         NOT NULL,
  refresh_token_iv         TEXT         NOT NULL,
  refresh_token_tag        TEXT         NOT NULL,
  token_expiry             TIMESTAMPTZ  NOT NULL,
  scope                    TEXT         NOT NULL DEFAULT '',
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

CREATE INDEX idx_oauth_accounts_user_provider ON oauth_accounts(user_id, provider);

-- ─── Auto-update updated_at trigger ─────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_ai_keys_updated_at
  BEFORE UPDATE ON ai_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_oauth_accounts_updated_at
  BEFORE UPDATE ON oauth_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Conversations ───────────────────────────

CREATE TABLE conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT         NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id, updated_at DESC);

CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Messages ────────────────────────────────

CREATE TABLE messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID         NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role             VARCHAR(20)  NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content          TEXT         NOT NULL DEFAULT '',
  tool_calls       JSONB,
  tool_results     JSONB,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id, created_at ASC);
