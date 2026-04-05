# Football Digest — Project Context

## What
A private, email-first + web dashboard that delivers a daily spoiler-aware football digest for matches played "yesterday (IST)", ranked by excitement and importance.

## Stack
- **Frontend:** Next.js 16 App Router + Tailwind v4 + shadcn/ui
- **Backend:** Next.js route handlers
- **DB/Auth:** Supabase (Postgres + Magic Link auth)
- **Email:** Resend + React Email
- **LLM:** Groq (Llama 3.1 8B) — free tier
- **Sports Data:** API-Football (RapidAPI)
- **Hosting:** Vercel

## Key Decisions
| Area | Decision |
|------|----------|
| v1 Leagues | Premier League only in UI; multi-league schema |
| Timezone | All digest logic in IST |
| Spoilers | Soft spoilers only — no outcome direction |
| Tags | 🔥 Banger, 👍 Worth a Watch, 😴 Snoozefest, ⭐ Biggie (overlay) |
| Ranking | Deterministic rules-based scoring, NOT LLM |
| Email | Top 3–5 matches in email + full digest on web |
| Auth | Magic link / OTP, no passwords |
| Admin | Manual approve before any emails send |
| Digest time | Generated at ~6:30 AM IST, sent at user-configured time |

## Scoring (excitement_score 0–100)
- Goals (0–50), shots (0–15), shots on target (0–12)
- Red cards (+8 each, cap 16), penalties (+6 each, cap 12)
- Late drama (+8–15), lead changes (+8 each, cap 16)
- Closeness (+8–10), controversy proxy (+6, cap 12)
- Tiers: 75+ = Banger, 45–74 = Worth a Watch, 0–44 = Snoozefest

## Biggie Triggers
- Both teams in "big teams" list
- Known derby match
- Top 6 clash or relegation zone clash
- Late season weight increase
- Admin manual override

## Spoiler Rules
**Allowed:** goal count, red cards, penalties, "late drama", "controversial moment", shot volume, tempo
**Blocked words:** won, beat, defeated, lost, comeback, winner, loser, victory, slipped, held on, collapsed, upset, edged, stunned, narrowly beat

## Folder Structure
```
src/
  app/
    (public)/          — landing, login, verify, auth callback
    (app)/             — dashboard, preferences, onboarding
    (admin)/           — admin digest review
    api/               — route handlers
  components/          — shared UI components
  lib/                 — business logic & clients
    supabase/          — Supabase client helpers
  emails/              — React Email templates
supabase/
  migrations/          — SQL migration files
```

## Cron Schedule (IST)
| Time | Job |
|------|-----|
| 5:30 AM | Ingest matches |
| 5:45 AM | Analyze + score + summarize |
| 6:00–6:45 AM | Admin review window |
| 6:45 AM+ | Queue emails (after approval) |
| Every 5 min | Send due emails |

## Current Progress
- [x] Phase 0: Project setup (Next.js, Supabase, Resend, Groq clients)
- [x] Phase 1: Database schema + auth (migrations, magic link, onboarding)
- [x] Phase 2: Match ingest (API-Football client, ingest job)
- [x] Phase 3: Scoring engine (excitement scoring, Biggie detection, analysis job)
- [x] Phase 4: LLM summaries (Groq integration, spoiler blocker, fallback templates)
- [x] Phase 5: Web UI (landing page, dashboard, preferences, digest cards)
- [x] Phase 6: Admin panel (digest review, edit APIs, approve flow, audit logs)
- [x] Phase 7: Email system (React Email template, queue job, send job, unsubscribe)
- [x] Phase 8: Highlight links (resolver with YouTube search fallback)
- [ ] Phase 9: Polish & QA (pending — needs Supabase project + API keys for live testing)

## Build Status
- ✅ `npm run build` passes cleanly
- All 22 routes generated (9 static, 13 dynamic)
- Middleware handles auth protection for /dashboard, /preferences, /onboarding, /admin

## Next Steps to Go Live
1. Create Supabase project and run migration SQL
2. Set all env vars (.env.local from .env.example)
3. Run `npm run dev` and test auth flow
4. Get RapidAPI key for API-Football
5. Get Groq API key (free)
6. Get Resend API key
7. Deploy to Vercel
8. Seed admin user
9. Dry-run full pipeline with real data
