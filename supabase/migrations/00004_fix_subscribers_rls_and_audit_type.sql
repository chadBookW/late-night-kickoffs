-- ============================================================
-- Migration 00004: Fix subscribers RLS + audit_logs entity_id type
--
-- 1. Restrict subscribers RLS to service_role only (was FOR ALL USING (true))
-- 2. Change audit_logs.entity_id from UUID to TEXT to support non-UUID entity refs
-- 3. Same fix for email_send_log
-- ============================================================

-- ── 1. Fix subscribers RLS: restrict to service_role only ──
DROP POLICY IF EXISTS "Service role full access on subscribers" ON subscribers;
CREATE POLICY "Service role full access on subscribers"
  ON subscribers FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 2. Fix email_send_log RLS: restrict to service_role only ──
DROP POLICY IF EXISTS "Service role full access on email_send_log" ON email_send_log;
CREATE POLICY "Service role full access on email_send_log"
  ON email_send_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 3. Fix admin_users RLS: restrict to service_role only ──
DROP POLICY IF EXISTS "Service role full access on admin_users" ON admin_users;
CREATE POLICY "Service role full access on admin_users"
  ON admin_users FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 4. Widen audit_logs.entity_id to TEXT ──
-- This allows storing both UUIDs and other identifiers (e.g. match IDs from URL params)
ALTER TABLE audit_logs ALTER COLUMN entity_id TYPE TEXT;
