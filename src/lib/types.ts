export type League = {
  id: string;
  code: string;
  name: string;
  country: string | null;
  external_league_id: string | null;
  is_active: boolean;
};

export type Team = {
  id: string;
  external_team_id: string;
  name: string;
  short_name: string | null;
  slug: string | null;
  league_id: string | null;
  is_big_team: boolean;
};

export type Match = {
  id: string;
  external_match_id: string;
  league_id: string;
  season: string | null;
  stage: string | null;
  home_team_id: string;
  away_team_id: string;
  kickoff_at: string;
  ended_at: string | null;
  status: string;
  match_date_ist: string;
  matchweek: number | null;
  home_score: number | null;
  away_score: number | null;
  raw_payload: Record<string, unknown> | null;
};

export type MatchStats = {
  id: string;
  match_id: string;
  possession_home: number | null;
  possession_away: number | null;
  shots_home: number | null;
  shots_away: number | null;
  shots_on_target_home: number | null;
  shots_on_target_away: number | null;
  xg_home: number | null;
  xg_away: number | null;
  red_cards_home: number;
  red_cards_away: number;
  yellow_cards_home: number;
  yellow_cards_away: number;
  corners_home: number | null;
  corners_away: number | null;
  fouls_home: number | null;
  fouls_away: number | null;
  penalties: number;
  events: MatchEvent[];
};

export type MatchEvent = {
  time: { elapsed: number; extra: number | null };
  team: { id: number; name: string };
  player: { id: number; name: string } | null;
  type: string;
  detail: string;
  comments: string | null;
};

export type MatchAnalysis = {
  id: string;
  match_id: string;
  excitement_score: number;
  primary_tier: "banger" | "worth_a_watch" | "snoozefest";
  is_biggie: boolean;
  biggie_reason: string | null;
  summary_short: string | null;
  summary_status: string;
  admin_override: boolean;
};

export type MatchLink = {
  id: string;
  match_id: string;
  link_type: string;
  url: string;
  provider: string | null;
  status: string;
};

export type DigestRun = {
  id: string;
  digest_date_ist: string;
  generation_started_at: string | null;
  generation_completed_at: string | null;
  approval_status: "pending" | "approved" | "rejected";
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
};

export type DigestMatch = {
  id: string;
  digest_run_id: string;
  match_id: string;
  rank_order: number;
  featured_in_email: boolean;
};

export type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  is_verified: boolean;
};

export type UserPreferences = {
  id: string;
  user_id: string;
  delivery_time_ist: string;
  frequency: "daily" | "matchdays_only" | "weekends_only";
  timezone: string;
  is_paused: boolean;
  onboarding_completed: boolean;
};

export type EmailSubscription = {
  id: string;
  user_id: string;
  double_opt_in_confirmed: boolean;
  subscribed: boolean;
  unsubscribed_at: string | null;
};

// Composite types for UI
export type DigestMatchCard = {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  analysis: MatchAnalysis;
  league: League;
  links: MatchLink[];
  stats: MatchStats | null;
};
