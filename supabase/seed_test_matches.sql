-- ============================================================
-- SEED TEST MATCHES for e2e testing
-- Uses yesterday's IST date so the pipeline picks them up.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- Get yesterday's date in IST
DO $$
DECLARE
  yesterday_ist DATE := (NOW() AT TIME ZONE 'Asia/Kolkata' - INTERVAL '1 day')::DATE;
  pl_id UUID;
  team_ars UUID;
  team_liv UUID;
  team_mci UUID;
  team_che UUID;
  team_new UUID;
  team_avl UUID;
  team_wol UUID;
  team_bou UUID;
  match1_id UUID;
  match2_id UUID;
  match3_id UUID;
  match4_id UUID;
BEGIN
  -- Get PL league ID
  SELECT id INTO pl_id FROM leagues WHERE code = 'PL';

  -- Insert test teams
  INSERT INTO teams (id, external_team_id, name, short_name, slug, league_id, is_big_team)
  VALUES
    (gen_random_uuid(), '42', 'Arsenal', 'ARS', 'arsenal', pl_id, true),
    (gen_random_uuid(), '40', 'Liverpool', 'LIV', 'liverpool', pl_id, true),
    (gen_random_uuid(), '50', 'Manchester City', 'MCI', 'manchester-city', pl_id, true),
    (gen_random_uuid(), '49', 'Chelsea', 'CHE', 'chelsea', pl_id, true),
    (gen_random_uuid(), '34', 'Newcastle United', 'NEW', 'newcastle-united', pl_id, false),
    (gen_random_uuid(), '66', 'Aston Villa', 'AVL', 'aston-villa', pl_id, false),
    (gen_random_uuid(), '39', 'Wolverhampton', 'WOL', 'wolverhampton', pl_id, false),
    (gen_random_uuid(), '35', 'AFC Bournemouth', 'BOU', 'afc-bournemouth', pl_id, false)
  ON CONFLICT (external_team_id) DO UPDATE SET name = EXCLUDED.name;

  SELECT id INTO team_ars FROM teams WHERE external_team_id = '42';
  SELECT id INTO team_liv FROM teams WHERE external_team_id = '40';
  SELECT id INTO team_mci FROM teams WHERE external_team_id = '50';
  SELECT id INTO team_che FROM teams WHERE external_team_id = '49';
  SELECT id INTO team_new FROM teams WHERE external_team_id = '34';
  SELECT id INTO team_avl FROM teams WHERE external_team_id = '66';
  SELECT id INTO team_wol FROM teams WHERE external_team_id = '39';
  SELECT id INTO team_bou FROM teams WHERE external_team_id = '35';

  -- ── Match 1: Arsenal vs Liverpool (Big team clash, high-scoring = BANGER + BIGGIE) ──
  INSERT INTO matches (id, external_match_id, league_id, season, stage, home_team_id, away_team_id,
    kickoff_at, status, match_date_ist, matchweek, home_score, away_score)
  VALUES (
    gen_random_uuid(), '90001', pl_id, '2025', 'Regular Season - 30', team_ars, team_liv,
    yesterday_ist + TIME '20:00:00', 'FT', yesterday_ist, 30, 3, 3
  )
  ON CONFLICT (external_match_id) DO UPDATE SET home_score = 3, away_score = 3
  RETURNING id INTO match1_id;

  INSERT INTO match_stats (match_id, possession_home, possession_away, shots_home, shots_away,
    shots_on_target_home, shots_on_target_away, red_cards_home, red_cards_away,
    yellow_cards_home, yellow_cards_away, corners_home, corners_away,
    fouls_home, fouls_away, penalties, events)
  VALUES (match1_id, 52, 48, 18, 15, 8, 7, 0, 0, 3, 4, 7, 5, 12, 10, 1,
    '[{"type":"Goal","detail":"Normal Goal","time":{"elapsed":12,"extra":null},"team":{"id":42},"player":{"id":1,"name":"Saka"},"assist":{"id":null,"name":null},"comments":null},
      {"type":"Goal","detail":"Normal Goal","time":{"elapsed":34,"extra":null},"team":{"id":40},"player":{"id":2,"name":"Salah"},"assist":{"id":null,"name":null},"comments":null},
      {"type":"Goal","detail":"Normal Goal","time":{"elapsed":55,"extra":null},"team":{"id":42},"player":{"id":3,"name":"Havertz"},"assist":{"id":null,"name":null},"comments":null},
      {"type":"Goal","detail":"Normal Goal","time":{"elapsed":67,"extra":null},"team":{"id":40},"player":{"id":4,"name":"Nunez"},"assist":{"id":null,"name":null},"comments":null},
      {"type":"Goal","detail":"Penalty","time":{"elapsed":82,"extra":null},"team":{"id":42},"player":{"id":1,"name":"Saka"},"assist":{"id":null,"name":null},"comments":"VAR decision"},
      {"type":"Goal","detail":"Normal Goal","time":{"elapsed":90,"extra":3},"team":{"id":40},"player":{"id":2,"name":"Salah"},"assist":{"id":null,"name":null},"comments":null}]'::jsonb
  )
  ON CONFLICT (match_id) DO UPDATE SET events = EXCLUDED.events;

  -- ── Match 2: Man City vs Chelsea (Big team clash, tight game = WORTH A WATCH + BIGGIE) ──
  INSERT INTO matches (id, external_match_id, league_id, season, stage, home_team_id, away_team_id,
    kickoff_at, status, match_date_ist, matchweek, home_score, away_score)
  VALUES (
    gen_random_uuid(), '90002', pl_id, '2025', 'Regular Season - 30', team_mci, team_che,
    yesterday_ist + TIME '17:30:00', 'FT', yesterday_ist, 30, 1, 0
  )
  ON CONFLICT (external_match_id) DO UPDATE SET home_score = 1, away_score = 0
  RETURNING id INTO match2_id;

  INSERT INTO match_stats (match_id, possession_home, possession_away, shots_home, shots_away,
    shots_on_target_home, shots_on_target_away, red_cards_home, red_cards_away,
    yellow_cards_home, yellow_cards_away, corners_home, corners_away,
    fouls_home, fouls_away, penalties, events)
  VALUES (match2_id, 62, 38, 14, 8, 5, 3, 1, 0, 2, 5, 6, 3, 9, 14, 0,
    '[{"type":"Goal","detail":"Normal Goal","time":{"elapsed":78,"extra":null},"team":{"id":50},"player":{"id":5,"name":"Haaland"},"assist":{"id":null,"name":null},"comments":null},
      {"type":"Card","detail":"Red Card","time":{"elapsed":85,"extra":null},"team":{"id":49},"player":{"id":6,"name":"Caicedo"},"assist":{"id":null,"name":null},"comments":null}]'::jsonb
  )
  ON CONFLICT (match_id) DO UPDATE SET events = EXCLUDED.events;

  -- ── Match 3: Newcastle vs Aston Villa (mid-table, some action = WORTH A WATCH) ──
  INSERT INTO matches (id, external_match_id, league_id, season, stage, home_team_id, away_team_id,
    kickoff_at, status, match_date_ist, matchweek, home_score, away_score)
  VALUES (
    gen_random_uuid(), '90003', pl_id, '2025', 'Regular Season - 30', team_new, team_avl,
    yesterday_ist + TIME '20:00:00', 'FT', yesterday_ist, 30, 2, 1
  )
  ON CONFLICT (external_match_id) DO UPDATE SET home_score = 2, away_score = 1
  RETURNING id INTO match3_id;

  INSERT INTO match_stats (match_id, possession_home, possession_away, shots_home, shots_away,
    shots_on_target_home, shots_on_target_away, red_cards_home, red_cards_away,
    yellow_cards_home, yellow_cards_away, corners_home, corners_away,
    fouls_home, fouls_away, penalties, events)
  VALUES (match3_id, 45, 55, 12, 10, 5, 4, 0, 0, 3, 2, 4, 6, 11, 9, 0,
    '[{"type":"Goal","detail":"Normal Goal","time":{"elapsed":23,"extra":null},"team":{"id":34},"player":{"id":7,"name":"Isak"},"assist":{"id":null,"name":null},"comments":null},
      {"type":"Goal","detail":"Normal Goal","time":{"elapsed":56,"extra":null},"team":{"id":66},"player":{"id":8,"name":"Watkins"},"assist":{"id":null,"name":null},"comments":null},
      {"type":"Goal","detail":"Normal Goal","time":{"elapsed":88,"extra":null},"team":{"id":34},"player":{"id":7,"name":"Isak"},"assist":{"id":null,"name":null},"comments":null}]'::jsonb
  )
  ON CONFLICT (match_id) DO UPDATE SET events = EXCLUDED.events;

  -- ── Match 4: Wolves vs Bournemouth (dull game = SNOOZEFEST) ──
  INSERT INTO matches (id, external_match_id, league_id, season, stage, home_team_id, away_team_id,
    kickoff_at, status, match_date_ist, matchweek, home_score, away_score)
  VALUES (
    gen_random_uuid(), '90004', pl_id, '2025', 'Regular Season - 30', team_wol, team_bou,
    yesterday_ist + TIME '20:00:00', 'FT', yesterday_ist, 30, 0, 0
  )
  ON CONFLICT (external_match_id) DO UPDATE SET home_score = 0, away_score = 0
  RETURNING id INTO match4_id;

  INSERT INTO match_stats (match_id, possession_home, possession_away, shots_home, shots_away,
    shots_on_target_home, shots_on_target_away, red_cards_home, red_cards_away,
    yellow_cards_home, yellow_cards_away, corners_home, corners_away,
    fouls_home, fouls_away, penalties, events)
  VALUES (match4_id, 50, 50, 6, 5, 1, 2, 0, 0, 1, 1, 3, 2, 8, 7, 0,
    '[]'::jsonb
  )
  ON CONFLICT (match_id) DO UPDATE SET events = EXCLUDED.events;

  RAISE NOTICE 'Seeded 4 test matches for %', yesterday_ist;
  RAISE NOTICE 'Match 1 (Banger): Arsenal 3-3 Liverpool (id: %)', match1_id;
  RAISE NOTICE 'Match 2 (Worth a Watch): Man City 1-0 Chelsea (id: %)', match2_id;
  RAISE NOTICE 'Match 3 (Worth a Watch): Newcastle 2-1 Aston Villa (id: %)', match3_id;
  RAISE NOTICE 'Match 4 (Snoozefest): Wolves 0-0 Bournemouth (id: %)', match4_id;
END $$;
