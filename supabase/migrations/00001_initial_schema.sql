-- Football Digest MVP — Initial Schema
-- Run this in the Supabase SQL editor or via supabase db push

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- LEAGUES
-- ============================================================
CREATE TABLE leagues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  country TEXT,
  external_league_id TEXT UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TEAMS
-- ============================================================
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_team_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT,
  slug TEXT,
  league_id UUID REFERENCES leagues(id),
  is_big_team BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_teams_league ON teams(league_id);
CREATE INDEX idx_teams_external ON teams(external_team_id);

-- ============================================================
-- MATCHES
-- ============================================================
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_match_id TEXT UNIQUE NOT NULL,
  league_id UUID NOT NULL REFERENCES leagues(id),
  season TEXT,
  stage TEXT,
  home_team_id UUID NOT NULL REFERENCES teams(id),
  away_team_id UUID NOT NULL REFERENCES teams(id),
  kickoff_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'unknown',
  match_date_ist DATE NOT NULL,
  matchweek INTEGER,
  home_score INTEGER,
  away_score INTEGER,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_matches_league ON matches(league_id);
CREATE INDEX idx_matches_date_ist ON matches(match_date_ist);
CREATE INDEX idx_matches_status ON matches(status);

-- ============================================================
-- MATCH STATS
-- ============================================================
CREATE TABLE match_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID UNIQUE NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  possession_home NUMERIC,
  possession_away NUMERIC,
  shots_home INTEGER,
  shots_away INTEGER,
  shots_on_target_home INTEGER,
  shots_on_target_away INTEGER,
  xg_home NUMERIC,
  xg_away NUMERIC,
  red_cards_home INTEGER DEFAULT 0,
  red_cards_away INTEGER DEFAULT 0,
  yellow_cards_home INTEGER DEFAULT 0,
  yellow_cards_away INTEGER DEFAULT 0,
  corners_home INTEGER,
  corners_away INTEGER,
  fouls_home INTEGER,
  fouls_away INTEGER,
  penalties INTEGER DEFAULT 0,
  events JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- MATCH ANALYSIS
-- ============================================================
CREATE TABLE match_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID UNIQUE NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  excitement_score INTEGER NOT NULL DEFAULT 0,
  primary_tier TEXT NOT NULL DEFAULT 'snoozefest',
  is_biggie BOOLEAN DEFAULT false,
  biggie_reason TEXT,
  summary_short TEXT,
  summary_status TEXT DEFAULT 'pending',
  spoiler_policy_version TEXT DEFAULT 'v1',
  generated_by TEXT DEFAULT 'system',
  admin_override BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_tier CHECK (primary_tier IN ('banger', 'worth_a_watch', 'snoozefest')),
  CONSTRAINT valid_summary_status CHECK (summary_status IN ('pending', 'generated', 'template_fallback', 'admin_edited'))
);

-- ============================================================
-- MATCH LINKS
-- ============================================================
CREATE TABLE match_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL DEFAULT 'highlights',
  url TEXT NOT NULL,
  provider TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_match_links_match ON match_links(match_id);

-- ============================================================
-- DIGEST RUNS
-- ============================================================
CREATE TABLE digest_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  digest_date_ist DATE UNIQUE NOT NULL,
  generation_started_at TIMESTAMPTZ,
  generation_completed_at TIMESTAMPTZ,
  approval_status TEXT DEFAULT 'pending',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_approval_status CHECK (approval_status IN ('pending', 'approved', 'rejected'))
);

-- ============================================================
-- DIGEST MATCHES
-- ============================================================
CREATE TABLE digest_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  digest_run_id UUID NOT NULL REFERENCES digest_runs(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  rank_order INTEGER NOT NULL,
  featured_in_email BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(digest_run_id, match_id)
);

CREATE INDEX idx_digest_matches_run ON digest_matches(digest_run_id);

-- ============================================================
-- USER PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- USER PREFERENCES
-- ============================================================
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  delivery_time_ist TIME DEFAULT '07:00:00',
  frequency TEXT DEFAULT 'daily',
  timezone TEXT DEFAULT 'Asia/Kolkata',
  is_paused BOOLEAN DEFAULT false,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_frequency CHECK (frequency IN ('daily', 'matchdays_only', 'weekends_only'))
);

-- ============================================================
-- USER LEAGUES
-- ============================================================
CREATE TABLE user_leagues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, league_id)
);

CREATE INDEX idx_user_leagues_user ON user_leagues(user_id);

-- ============================================================
-- EMAIL SUBSCRIPTIONS
-- ============================================================
CREATE TABLE email_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  double_opt_in_confirmed BOOLEAN DEFAULT false,
  subscribed BOOLEAN DEFAULT true,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- EMAIL SEND QUEUE
-- ============================================================
CREATE TABLE email_send_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  digest_run_id UUID NOT NULL REFERENCES digest_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending',
  provider_message_id TEXT,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_send_status CHECK (status IN ('pending', 'sent', 'failed', 'skipped'))
);

CREATE INDEX idx_email_queue_status ON email_send_queue(status, scheduled_for);
CREATE INDEX idx_email_queue_digest ON email_send_queue(digest_run_id);

-- ============================================================
-- ADMIN USERS
-- ============================================================
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_user_id UUID,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_actor ON audit_logs(actor_user_id);

-- ============================================================
-- DERBY MAPPINGS (for Biggie detection)
-- ============================================================
CREATE TABLE derby_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_a_external_id TEXT NOT NULL,
  team_b_external_id TEXT NOT NULL,
  derby_name TEXT NOT NULL,
  league_id UUID REFERENCES leagues(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_a_external_id, team_b_external_id)
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Leagues
INSERT INTO leagues (code, name, country, external_league_id, is_active) VALUES
  ('PL', 'Premier League', 'England', '39', true),
  ('UCL', 'UEFA Champions League', 'Europe', '2', false);

-- Big teams (PL) — external_team_id from API-Football
-- These will be updated when we first ingest teams
-- Arsenal=42, Chelsea=49, Liverpool=40, ManCity=50, ManUtd=33, Spurs=47
INSERT INTO teams (external_team_id, name, short_name, slug, is_big_team) VALUES
  ('42', 'Arsenal', 'ARS', 'arsenal', true),
  ('49', 'Chelsea', 'CHE', 'chelsea', true),
  ('40', 'Liverpool', 'LIV', 'liverpool', true),
  ('50', 'Manchester City', 'MCI', 'man-city', true),
  ('33', 'Manchester United', 'MUN', 'man-utd', true),
  ('47', 'Tottenham Hotspur', 'TOT', 'spurs', true);

-- Derby mappings (PL)
INSERT INTO derby_mappings (team_a_external_id, team_b_external_id, derby_name) VALUES
  ('42', '47', 'North London Derby'),
  ('40', '45', 'Merseyside Derby'),
  ('33', '50', 'Manchester Derby'),
  ('49', '47', 'London Derby'),
  ('42', '49', 'London Derby'),
  ('40', '33', 'Northwest Derby'),
  ('49', '33', 'Big Six Clash'),
  ('42', '40', 'Big Six Clash'),
  ('50', '40', 'Title Clash'),
  ('42', '50', 'Title Clash');

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Users can manage their own preferences
CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can manage their own league subscriptions
CREATE POLICY "Users can view own leagues"
  ON user_leagues FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own leagues"
  ON user_leagues FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own leagues"
  ON user_leagues FOR DELETE
  USING (auth.uid() = user_id);

-- Users can manage their own email subscription
CREATE POLICY "Users can view own email sub"
  ON email_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own email sub"
  ON email_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- Public read for leagues, matches, analysis (digest data)
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read leagues" ON leagues FOR SELECT USING (true);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read matches" ON matches FOR SELECT USING (true);

ALTER TABLE match_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read analysis" ON match_analysis FOR SELECT USING (true);

ALTER TABLE match_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read stats" ON match_stats FOR SELECT USING (true);

ALTER TABLE match_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read links" ON match_links FOR SELECT USING (true);

ALTER TABLE digest_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read digest runs" ON digest_runs FOR SELECT USING (true);

ALTER TABLE digest_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read digest matches" ON digest_matches FOR SELECT USING (true);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP (trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, is_verified)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.email_confirmed_at IS NOT NULL, false));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_user_profiles BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_user_preferences BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_matches BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_match_stats BEFORE UPDATE ON match_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_match_analysis BEFORE UPDATE ON match_analysis FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_email_subscriptions BEFORE UPDATE ON email_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_email_send_queue BEFORE UPDATE ON email_send_queue FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_leagues BEFORE UPDATE ON leagues FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_teams BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_digest_runs BEFORE UPDATE ON digest_runs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
