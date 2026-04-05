# Football Digest — Architecture & Flow (v2: Email-First MVP)

## Design Philosophy

> **The product lives in the inbox, not on a website.**
> The Next.js app is a landing page + API backend. No dashboard, no login, no sessions.
> Users subscribe via email → pick leagues → get a daily spoiler-free digest every morning.

## System Overview

```
                         +-----------------------+
                         |    API-Football       |
                         |    (RapidAPI)         |
                         +----------+------------+
                                    |
                                    | Cron 5:30 AM IST (1 API call per league)
                                    v
+----------+    +-------------------------------------------+
|          |    |         Next.js App (Vercel)               |
|  Groq    |<-->|                                           |
|  (LLM)   |    |  /api/jobs/ingest-matches       [POST]   |
|          |    |       |                                   |
+----------+    |       v                                   |
                |  /api/jobs/analyze-matches      [POST]   |
                |       |                                   |
                |       | Scores + Biggies + Summaries      |
                |       v                                   |
                |  Admin reviews at /admin/digest           |
                |  (or auto-approve at 7 AM IST)           |
                |       |                                   |
                |       | Approve / Auto-approve            |
                |       v                                   |
                |  Upstash QStash → batched fan-out         |
                |       |                                   |
                |       v                                   |
                |  /api/jobs/send-batch          [POST]    |
                |       |                                   |
                +-------+-----------------------------------+
                        |              ^
                        v              |
                +-------+------+ +-----+--------+
                |   AWS SES    | |   Supabase   |
                |   (Email)    | |   (DB only)  |
                +--------------+ +--------------+
```

---

## Data Flow (Step by Step)

### Phase 1: Ingest (Cron → 5:30 AM IST)

```
API-Football ──GET /fixtures?date=YYYY-MM-DD&league=39&season=2025──>
                                      |
                     1 request per league (not per match!)
                                      |
                                      v
                               /api/jobs/ingest-matches
                                      |
                                      v
                               Supabase DB:
                               - teams (upsert)
                               - matches (upsert)
                               - match_stats (upsert from nested events/statistics)
```

**Key optimization:** The `/fixtures` endpoint returns events and statistics nested
in a single response when queried by date + league. Old approach made 3 calls per
match (1 fixtures list + 1 stats + 1 events = 31 calls for 10 matches). New approach:
**1 call per league** — for 3 leagues that's 3 calls/day, not 31+.

**Files involved:**
- `src/app/api/jobs/ingest-matches/route.ts` — orchestrator
- `src/lib/sports-api.ts` — API-Football client (single-call approach)
- `src/lib/ist-utils.ts` — IST date helpers

---

### Phase 2: Analyze (Cron → 5:45 AM IST)

```
Supabase DB (matches + stats)
        |
        v
  Excitement Scoring (rules-based, 0-100)
        |
        v
  Biggie Detection (big teams, derbies, late-season)
        |
        v
  Groq LLM Summary (spoiler-free, max 280 chars)
        |
        v
  Spoiler Check (regex filter + fallback templates)
        |
        v
  Supabase DB:
  - match_analysis (score, tier, biggie, summary)
  - digest_runs (one per day)
  - digest_matches (ranked list)
```

*No changes — this phase is solid.*

**Scoring breakdown (0-100):**
```
Goals       → 0-50 pts   (diminishing returns)
Shots       → 0-15 pts
On target   → 0-12 pts
Red cards   → +8 each    (cap 16)
Penalties   → +6 each    (cap 12)
Late drama  → +8-15 pts  (goals after 80')
Lead changes→ +8 each    (cap 16)
Closeness   → +8-10 pts
Controversy → +6 pts     (cap 12)

Tiers: 75+ = Banger, 45-74 = Worth a Watch, 0-44 = Snoozefest
```

**Files involved:**
- `src/app/api/jobs/analyze-matches/route.ts` — orchestrator
- `src/lib/scoring.ts` — excitement scoring algorithm
- `src/lib/biggie.ts` — Biggie detection logic
- `src/lib/summary.ts` — Groq LLM call with retry
- `src/lib/spoiler-check.ts` — spoiler keyword filter + fallback
- `src/lib/groq.ts` — Groq client (lazy init)

---

### Phase 3: Admin Review + Auto-Approve Fallback

```
Admin visits /admin/digest (6:00-6:45 AM IST)
        |
        v
  Same admin UI as before: edit summaries, toggle tiers, approve
        |
        v
  POST /api/admin/digest/[date]/approve
        |
        v
  If admin hasn't approved by 7:00 AM IST:
  ┌─────────────────────────────────────────┐
  │  AUTO-APPROVE FALLBACK (cron at 7:00)   │
  │                                         │
  │  1. Check digest_runs where status =    │
  │     "pending" and date = yesterday      │
  │  2. Check all summaries passed spoiler  │
  │     check (summary_status = "approved") │
  │  3. Auto-approve and queue emails       │
  └─────────────────────────────────────────┘
```

**Why:** Admin bottleneck kills the product if you sleep in.
If all LLM summaries pass the spoiler-check regex, they're safe to auto-send.

**Files involved:**
- `src/app/(admin)/admin/digest/page.tsx` — admin UI (kept for review)
- `src/app/api/admin/digest/[date]/approve/route.ts` — manual approve
- `src/app/api/cron/auto-approve/route.ts` — **NEW:** auto-approve fallback
- `src/lib/admin.ts` — admin helpers

---

### Phase 4: Email Send via AWS SES + QStash Batching

```
Approve (manual or auto)
        |
        v
  POST to Upstash QStash with digest payload
        |
        v
  QStash fans out to /api/jobs/send-batch
  in batches of 50 subscribers
        |
        v
  For each batch:
  ├── Fetch subscriber emails + league preferences
  ├── Filter digest matches per subscriber's leagues
  ├── Render React Email template → HTML string
  └── Send via AWS SES ($0.10 / 1,000 emails)
        |
        v
  Subscriber receives email:
  ┌──────────────────────────────────────────┐
  │  ⚽ FOOTBALL DIGEST — Apr 3, 2026       │
  │                                          │
  │  🔥 BANGER                              │
  │  Arsenal vs Liverpool                    │
  │  "Six-goal thriller with late penalty    │
  │   and dramatic stoppage-time equalizer"  │
  │  [▶ Watch Highlights]                    │
  │                                          │
  │  👍 WORTH A WATCH                        │
  │  Man City vs Chelsea                     │
  │  "Tight defensive battle with a late     │
  │   breakthrough and red card controversy" │
  │  [▶ Watch Highlights]                    │
  │                                          │
  │  😴 2 more Snoozefests (skipped)         │
  │                                          │
  │  ─────────────────────────────           │
  │  [Unsubscribe] [Manage Preferences]      │
  └──────────────────────────────────────────┘
```

**Why QStash over Vercel cron for sending:**
- Vercel Hobby: 1 cron job/day, 10s function timeout
- QStash free tier: 500 messages/day, automatic retries, batching
- No more `*/5 * * * *` polling — event-driven on approval

**Why AWS SES over Resend:**
- Resend free tier: 100 emails/day (breaks at 101 subscribers)
- AWS SES: $0.10 per 1,000 emails, 62,000 free/month in first year
- Still use React Email for HTML templates, just swap the transport

**Files involved:**
- `src/app/api/jobs/send-batch/route.ts` — **NEW:** batch email sender
- `src/lib/ses.ts` — **NEW:** AWS SES client
- `src/lib/qstash.ts` — **NEW:** Upstash QStash publisher
- `src/emails/daily-digest.tsx` — React Email template (redesigned)
- `src/app/api/unsubscribe/route.ts` — one-click unsubscribe with token

---

### Phase 5: Landing Page Only (No Dashboard)

```
/ (landing page — the ONLY user-facing page)
  │
  ├── Hero: "Which matches are worth watching? We'll tell you."
  │
  ├── Email capture form
  │     └── Enter email → pick leagues (checkboxes) → Subscribe
  │
  ├── Sample digest preview (static mockup of email)
  │
  ├── Social proof / how it works
  │
  └── Footer
        |
        v
  POST /api/subscribe
        |
        ├── Insert into subscribers table
        ├── Send confirmation email (double opt-in)
        └── Redirect to "Check your inbox" page

  /confirm?token=xxx → confirms subscription
  /unsubscribe?token=xxx → one-click unsub
  /preferences?token=xxx → update leagues (tokenized, no login)
```

**What we're removing:**
- ~~Dashboard~~ — product lives in email
- ~~Login page~~ — no sessions needed
- ~~Onboarding~~ — league selection happens on landing page
- ~~Preferences page~~ — replaced by tokenized link in email footer
- ~~proxy.ts~~ — no session management
- ~~Supabase Auth~~ — just email capture, no magic links
- ~~user_profiles~~ — replaced by simple subscribers table

**What we're keeping:**
- Admin panel at `/admin/digest` (still needs login — but just for you)

---

## Simplified Database Schema (v2)

```
subscribers (replaces user_profiles + user_preferences + email_subscriptions)
    │  id, email, token (UUID for unsubscribe/preferences links),
    │  confirmed (boolean), frequency, leagues (text[]),
    │  created_at, unsubscribed_at
    │
    ├──> email_send_log (replaces email_send_queue — just a log)
    │     subscriber_id, digest_run_id, sent_at, ses_message_id
    │
leagues (seeded, unchanged)
    │
    └──> teams (unchanged)

matches (unchanged)
    ├──> match_stats (unchanged)
    ├──> match_analysis (unchanged)
    └──> match_links (unchanged)

digest_runs (unchanged + auto_approved_at field)
    └──> digest_matches (unchanged)

derby_mappings (unchanged)
admin_users (simplified — just email whitelist, no FK)
audit_logs (unchanged)
```

**Tables removed:** user_profiles, user_preferences, user_leagues, email_subscriptions, email_send_queue
**Tables added:** subscribers (single flat table)
**Net reduction:** 15 tables → 12 tables

---

## Auth & Security (v2)

```
No proxy.ts needed. Minimal auth:

Public routes (no auth):
  / (landing page)
  /api/subscribe (email capture)
  /confirm?token=xxx
  /unsubscribe?token=xxx
  /preferences?token=xxx

Admin routes (session auth — Supabase, just for you):
  /admin/digest
  /api/admin/*

Job routes (Bearer CRON_SECRET or QStash signature):
  /api/jobs/*
```

---

## Revised File Tree

```
src/
├── app/
│   ├── page.tsx                      # Landing page (email capture + league picker)
│   ├── layout.tsx                    # Root layout
│   ├── globals.css                   # Tailwind + theme
│   ├── confirm/page.tsx              # "Subscription confirmed!" page
│   ├── unsubscribe/page.tsx          # "You've been unsubscribed" page
│   ├── preferences/page.tsx          # Tokenized preferences (no login)
│   ├── (admin)/
│   │   ├── layout.tsx                # force-dynamic
│   │   └── admin/digest/page.tsx     # Admin review + approve
│   └── api/
│       ├── subscribe/route.ts        # NEW: email capture + confirm email
│       ├── confirm/route.ts          # NEW: double opt-in confirmation
│       ├── unsubscribe/route.ts      # Tokenized unsubscribe
│       ├── preferences/route.ts      # NEW: tokenized league update
│       ├── admin/
│       │   ├── digest/[date]/route.ts
│       │   ├── digest/[date]/approve/route.ts
│       │   ├── match-analysis/[matchId]/route.ts
│       │   └── match-link/[matchId]/route.ts
│       ├── jobs/
│       │   ├── ingest-matches/route.ts
│       │   ├── analyze-matches/route.ts
│       │   └── send-batch/route.ts   # NEW: QStash-triggered batch sender
│       └── cron/
│           ├── ingest/route.ts
│           ├── analyze/route.ts
│           └── auto-approve/route.ts # NEW: 7 AM IST fallback
├── components/
│   └── ui/button.tsx
├── emails/
│   ├── daily-digest.tsx              # Redesigned TLDR-style template
│   └── confirm-subscription.tsx      # NEW: double opt-in email
└── lib/
    ├── supabase/
    │   ├── server.ts                 # Service client only (no session client needed)
    ├── sports-api.ts                 # Optimized: 1 call per league
    ├── scoring.ts
    ├── biggie.ts
    ├── summary.ts
    ├── spoiler-check.ts
    ├── admin.ts
    ├── ses.ts                        # NEW: AWS SES sender
    ├── qstash.ts                     # NEW: QStash publisher
    ├── highlight-links.ts
    ├── ist-utils.ts
    ├── groq.ts
    ├── types.ts
    └── utils.ts
```

**Files removed (~15):**
- `proxy.ts`, `supabase/client.ts`, `supabase/middleware.ts`
- `(public)/home/page.tsx`, `(public)/login/page.tsx`, `(public)/verify/page.tsx`
- `(app)/dashboard/page.tsx`, `(app)/preferences/page.tsx`, `(app)/onboarding/page.tsx`
- `components/digest-card.tsx`, `lib/digest.ts`, `lib/email.ts`
- `api/logout/route.ts`, `api/jobs/prepare-email-queue/route.ts`, `api/jobs/send-due-emails/route.ts`

---

## Cron Schedule (v2)

| Trigger | Time (UTC) | IST | Purpose |
|---------|-----------|-----|---------|
| Vercel cron | `0 0 * * *` | 5:30 AM | Ingest matches (1 call/league) |
| Vercel cron | `15 0 * * *` | 5:45 AM | Analyze + score + summarize |
| Vercel cron | `30 1 * * *` | 7:00 AM | Auto-approve fallback |
| QStash (event) | On approval | — | Fan out email batches (50/batch) |

Only 3 Vercel cron jobs (within Hobby tier limit). Email sending is event-driven via QStash.

---

## External Services (v2)

| Service | Purpose | Free Tier | Monthly Cost at Scale |
|---------|---------|-----------|----------------------|
| **Supabase** | DB only (no auth) | 500MB | $0 |
| **Groq** | LLM summaries | 14,400 req/day | $0 |
| **API-Football** | Match data | 100 req/day (need ~3/day) | $0 |
| **AWS SES** | Email delivery | 62K/month (1st year) | $0.10/1K after |
| **Upstash QStash** | Batched email fan-out | 500 msg/day | $0 |
| **Vercel** | Hosting + 3 crons | Hobby tier | $0 |

**Total cost at 1,000 subscribers: ~$0/month** (within free tiers)
**Total cost at 10,000 subscribers: ~$1/month** (just SES)

---

## Migration Plan (v1 → v2)

### Wave 1: Core Refactors (do first)
1. **Optimize API-Football** — single endpoint with nested stats/events
2. **New `subscribers` table** — flat schema, UUID token for unsubscribe
3. **New landing page** — email capture + league picker (no login)
4. **Subscribe + confirm endpoints** — double opt-in flow

### Wave 2: Email Infra Swap
5. **AWS SES client** — replace Resend
6. **QStash integration** — batched email fan-out on approval
7. **Redesign email template** — TLDR/Morning Brew scannable style
8. **Auto-approve cron** — 7 AM IST fallback

### Wave 3: Cleanup
9. **Delete unused files** — dashboard, login, onboarding, preferences, proxy
10. **Simplify DB migration** — drop old user tables
11. **Update admin panel** — minor tweaks for new schema

---

## Email Template Design (TLDR Style)

```
Subject: ⚽ Your Football Digest — Apr 3 | 1 Banger, 1 Worth a Watch

Preview text: Arsenal vs Liverpool was WILD. Here's what to watch...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔥 BANGER

Arsenal vs Liverpool ⭐ BIGGIE
Premier League · Matchweek 30

"Six-goal thriller with a late penalty and a dramatic
stoppage-time equalizer. The kind of match that reminds
you why you love football."

▶ Watch Highlights → [link]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👍 WORTH A WATCH

Man City vs Chelsea ⭐ BIGGIE
Premier League · Matchweek 30

"Tight defensive battle broken open by a late goal and
a controversial red card. Worth your 90 minutes."

▶ Watch Highlights → [link]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

😴 SNOOZEFESTS (2 matches — we saved you the time)
• Newcastle 2-1 Aston Villa — decent but predictable
• Wolves 0-0 Bournemouth — skip it entirely

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You're receiving this because you subscribed to Football Digest.
[Update preferences] · [Unsubscribe]
```
