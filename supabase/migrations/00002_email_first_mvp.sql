-- ============================================================
-- Migration 00002: Email-First MVP
-- Adds subscribers table, email_send_log, simplifies admin_users
-- Drops user_profiles, user_preferences, user_leagues,
--   email_subscriptions, email_send_queue
-- ============================================================

-- ── 1. Create subscribers table ──
CREATE TABLE subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  confirmed BOOLEAN DEFAULT false,
  frequency TEXT DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekends_only')),
  leagues TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_subscribers_email ON subscribers(email);
CREATE INDEX idx_subscribers_token ON subscribers(token);
CREATE INDEX idx_subscribers_confirmed ON subscribers(confirmed) WHERE confirmed = true AND unsubscribed_at IS NULL;

ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on subscribers" ON subscribers FOR ALL USING (true);

-- ── 2. Create email_send_log (replaces email_send_queue) ──
CREATE TABLE email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  digest_run_id UUID NOT NULL REFERENCES digest_runs(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT now(),
  ses_message_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_send_log_subscriber ON email_send_log(subscriber_id);
CREATE INDEX idx_send_log_digest ON email_send_log(digest_run_id);
-- Idempotency: only one successful send per subscriber per digest
CREATE UNIQUE INDEX idx_send_log_idempotent
  ON email_send_log(subscriber_id, digest_run_id)
  WHERE ses_message_id IS NOT NULL;

ALTER TABLE email_send_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on email_send_log" ON email_send_log FOR ALL USING (true);

-- ── 3. Add auto_approved_at to digest_runs ──
ALTER TABLE digest_runs ADD COLUMN IF NOT EXISTS auto_approved_at TIMESTAMPTZ;

-- ── 4. Simplify admin_users — drop FK to user_profiles, use email directly ──
-- Drop the old admin_users table and recreate with email-based auth
DROP TABLE IF EXISTS admin_users CASCADE;

CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on admin_users" ON admin_users FOR ALL USING (true);

-- Seed admin
INSERT INTO admin_users (email) VALUES ('nipunmanavya13@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- ── 5. Migrate existing data if any ──
-- Copy existing email_subscriptions/user_preferences users into subscribers
INSERT INTO subscribers (email, confirmed, frequency, leagues, created_at)
SELECT
  up.email,
  true,
  COALESCE(upr.frequency, 'daily'),
  COALESCE(
    ARRAY(
      SELECT l.code FROM user_leagues ul
      JOIN leagues l ON l.id = ul.league_id
      WHERE ul.user_id = up.id
    ),
    '{}'
  ),
  up.created_at
FROM user_profiles up
LEFT JOIN user_preferences upr ON upr.user_id = up.id
LEFT JOIN email_subscriptions es ON es.user_id = up.id
WHERE es.subscribed = true OR upr.user_id IS NOT NULL
ON CONFLICT (email) DO NOTHING;

-- ── 6. Drop old user tables ──
-- Order matters due to FK dependencies
DROP TABLE IF EXISTS email_send_queue CASCADE;
DROP TABLE IF EXISTS email_subscriptions CASCADE;
DROP TABLE IF EXISTS user_leagues CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- ── 7. Drop the old auth trigger (no longer needed) ──
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ── 8. Updated_at trigger for new tables ──
CREATE TRIGGER set_updated_at_subscribers
  BEFORE UPDATE ON subscribers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
