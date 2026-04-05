-- Run this AFTER the user has signed up via magic link at least once.
-- This seeds nipunmanavya13@gmail.com as an admin.
-- The user must exist in auth.users first (sign up via the app).

-- Step 0: Ensure user_profiles row exists (trigger may not have fired if migration ran after signup)
INSERT INTO user_profiles (id, email, is_verified)
SELECT id, email, true
FROM auth.users
WHERE email = 'nipunmanavya13@gmail.com'
ON CONFLICT (id) DO NOTHING;

-- Step 1: Create user_preferences + email_subscription so onboarding is complete
INSERT INTO user_preferences (user_id, delivery_time_ist, frequency, onboarding_completed)
SELECT id, '07:00:00', 'daily', true
FROM auth.users
WHERE email = 'nipunmanavya13@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET onboarding_completed = true;

INSERT INTO email_subscriptions (user_id, subscribed, double_opt_in_confirmed)
SELECT id, true, true
FROM auth.users
WHERE email = 'nipunmanavya13@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET subscribed = true;

-- Step 2: Add as admin
INSERT INTO admin_users (user_id)
SELECT id
FROM auth.users
WHERE email = 'nipunmanavya13@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- Step 3: Subscribe to Premier League
INSERT INTO user_leagues (user_id, league_id)
SELECT u.id, l.id
FROM auth.users u, leagues l
WHERE u.email = 'nipunmanavya13@gmail.com'
  AND l.code = 'PL'
ON CONFLICT DO NOTHING;
