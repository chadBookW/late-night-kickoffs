-- ============================================================
-- Migration 00003: Fix teams, derbies, and big team flags
--
-- Problem: Initial seed used API-Football external IDs (42, 49, 40, 50, 33, 47).
-- football-data.org uses completely different IDs:
--   Arsenal=57, Chelsea=61, Liverpool=64, Man City=65, Man United=66, Tottenham=73
--
-- COLLISION: ext=66 is "Aston Villa" (old ingest) in DB but "Man United" on football-data.org.
-- Aston Villa's correct football-data.org ID is 58 (already in DB as "Aston Villa FC").
--
-- Current DB state:
--   ext=42 Arsenal       (seed, big=true, used by Apr 2 matches)
--   ext=49 Chelsea       (seed, big=true, used by Apr 2 matches)
--   ext=40 Liverpool     (seed, big=true, used by Apr 2 matches)
--   ext=50 Man City      (seed, big=true, used by Apr 2 matches)
--   ext=33 Man United    (seed, big=true, NOT used)
--   ext=47 Tottenham     (seed, big=true, NOT used)
--   ext=61 Chelsea FC    (football-data.org, used by Mar matches)
--   ext=64 Liverpool FC  (football-data.org, used by Mar matches)
--   ext=73 Tottenham FC  (football-data.org, used by Mar matches)
--   ext=58 Aston Villa FC (football-data.org, used by Mar matches)
--   ext=66 Aston Villa   (old ingest, used by Apr 2 matches) ← COLLISION with Man Utd
--   ext=67 Newcastle FC  (football-data.org, used by Mar matches)
--   ext=34 Newcastle     (old ingest, used by Apr 2 matches)
-- ============================================================

-- ── Step 1: Migrate match refs from old seed → football-data.org teams ──
-- Chelsea: ext=49 → ext=61
UPDATE matches SET home_team_id = (SELECT id FROM teams WHERE external_team_id = '61')
WHERE home_team_id = (SELECT id FROM teams WHERE external_team_id = '49');
UPDATE matches SET away_team_id = (SELECT id FROM teams WHERE external_team_id = '61')
WHERE away_team_id = (SELECT id FROM teams WHERE external_team_id = '49');

-- Liverpool: ext=40 → ext=64
UPDATE matches SET home_team_id = (SELECT id FROM teams WHERE external_team_id = '64')
WHERE home_team_id = (SELECT id FROM teams WHERE external_team_id = '40');
UPDATE matches SET away_team_id = (SELECT id FROM teams WHERE external_team_id = '64')
WHERE away_team_id = (SELECT id FROM teams WHERE external_team_id = '40');

-- Newcastle: ext=34 → ext=67
UPDATE matches SET home_team_id = (SELECT id FROM teams WHERE external_team_id = '67')
WHERE home_team_id = (SELECT id FROM teams WHERE external_team_id = '34');
UPDATE matches SET away_team_id = (SELECT id FROM teams WHERE external_team_id = '67')
WHERE away_team_id = (SELECT id FROM teams WHERE external_team_id = '34');

-- Aston Villa: ext=66 → ext=58 (MUST happen before we delete ext=66)
UPDATE matches SET home_team_id = (SELECT id FROM teams WHERE external_team_id = '58')
WHERE home_team_id = (SELECT id FROM teams WHERE external_team_id = '66');
UPDATE matches SET away_team_id = (SELECT id FROM teams WHERE external_team_id = '58')
WHERE away_team_id = (SELECT id FROM teams WHERE external_team_id = '66');

-- ── Step 2: Update Arsenal (ext=42) and Man City (ext=50) in place ──
-- No football-data.org records for these exist yet, so rename the old ones.
UPDATE teams SET external_team_id = '57', name = 'Arsenal FC', short_name = 'ARS',
  league_id = (SELECT id FROM leagues WHERE code = 'PL')
WHERE external_team_id = '42';

UPDATE teams SET external_team_id = '65', name = 'Manchester City FC', short_name = 'MCI',
  league_id = (SELECT id FROM leagues WHERE code = 'PL')
WHERE external_team_id = '50';

-- ── Step 3: Delete orphaned old teams ──
DELETE FROM teams WHERE external_team_id = '49'; -- old Chelsea
DELETE FROM teams WHERE external_team_id = '40'; -- old Liverpool
DELETE FROM teams WHERE external_team_id = '33'; -- old Man United (unused)
DELETE FROM teams WHERE external_team_id = '47'; -- old Tottenham (unused)
DELETE FROM teams WHERE external_team_id = '66'; -- old Aston Villa (matches moved to ext=58)
DELETE FROM teams WHERE external_team_id = '34'; -- old Newcastle (matches moved to ext=67)

-- ── Step 4: Set is_big_team correctly ──
UPDATE teams SET is_big_team = false; -- reset all
UPDATE teams SET is_big_team = true WHERE external_team_id IN (
  '57',  -- Arsenal FC
  '61',  -- Chelsea FC
  '64',  -- Liverpool FC
  '65',  -- Manchester City FC
  '73'   -- Tottenham Hotspur FC
);
-- Man United (ext=66) will be created on first ingest; biggie.ts handles it via name match.

-- ── Step 5: Update derby mappings with football-data.org IDs ──
DELETE FROM derby_mappings;
INSERT INTO derby_mappings (team_a_external_id, team_b_external_id, derby_name) VALUES
  ('57', '73',  'North London Derby'),    -- Arsenal vs Tottenham
  ('64', '62',  'Merseyside Derby'),      -- Liverpool vs Everton
  ('65', '66',  'Manchester Derby'),      -- Man City vs Man United
  ('61', '73',  'London Derby'),          -- Chelsea vs Tottenham
  ('57', '61',  'London Derby'),          -- Arsenal vs Chelsea
  ('64', '66',  'Northwest Derby'),       -- Liverpool vs Man United
  ('61', '66',  'Big Six Clash'),         -- Chelsea vs Man United
  ('57', '64',  'Big Six Clash'),         -- Arsenal vs Liverpool
  ('65', '64',  'Title Clash'),           -- Man City vs Liverpool
  ('57', '65',  'Title Clash');           -- Arsenal vs Man City
