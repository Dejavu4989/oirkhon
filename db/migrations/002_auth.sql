-- Accounts, sign-in sessions and subscription state.
-- Apply after 001_init.sql:  psql "$DATABASE_URL" -f db/migrations/002_auth.sql

-- 001 created `users` with contact fields only; sign-in needs credentials.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash           TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub              TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url              TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_subscribed           BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

-- Google's stable subject id. Partial index so many rows may stay NULL.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_google_sub
    ON users(google_sub) WHERE google_sub IS NOT NULL;

-- Emails are stored lower-cased; this stops "A@x.mn" and "a@x.mn" both existing.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower
    ON users(lower(email)) WHERE email IS NOT NULL;

-- A signed-in browser. Distinct from `sessions`, which tracks anonymous play.
-- Only the SHA-256 of the cookie is stored, so a database leak grants no logins.
CREATE TABLE IF NOT EXISTS auth_sessions (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash    TEXT UNIQUE NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user   ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);

-- A subscriber is a user whose flag is on and whose term has not lapsed.
-- `subscription_expires_at IS NULL` means a lifetime plan.
CREATE OR REPLACE VIEW active_subscribers AS
    SELECT id AS user_id
    FROM users
    WHERE is_subscribed
      AND (subscription_expires_at IS NULL OR subscription_expires_at > now());
