# Daybloom 🌸

A personal organiser built around a **Brain Dump**. Capture every thought in one place, then turn it into tasks, planner blocks, habits and goals. **Atlas** is a built-in assistant you can chat or talk to.

Live at **https://daybloom.online**: React and Vite on Vercel, Supabase for accounts and data, and Claude (Haiku 5.5) for the ✨ features. The AI features have strict usage limits.

- [Features](#features)
- [How AI usage is limited](#how-ai-usage-is-limited)
- [Deploy: Supabase setup](#1-supabase-setup)
- [Deploy: Vercel environment variables](#2-vercel)
- [Local development](#local-development)
- [Tests](#tests)
- [Project structure](#project-structure)

---

## Features

| Area | What it does | ✨ AI (only when you tap) |
| --- | --- | --- |
| **Brain Dump** | Capture from anywhere: the + button, the N key, the quick-add bar or voice. Supports Markdown, checklists, #tags, pinning, archiving and full-text search. Views: Inbox, Ideas, All notes, Archive. **Process inbox** goes through notes one at a time: Make task, Schedule, Add to goal, Keep as idea, or Archive. You can convert a note into a task, time block, habit or goal, and it keeps a link back to the note. | Organize inbox · Extract actions · Summarize (one note or the week) · Find patterns · Turn into a plan |
| **Dashboard** | Today's schedule (synced events and blocks), top tasks, habits due, inbox count, a mood check-in, and a Getting started checklist. | Daily briefing (once per day; reused for free) |
| **Tasks** | Natural-language quick add ("dentist fri 3pm #health !high for 30m"), priorities, due dates, steps, and a top 3 for today. | Read a tricky sentence · Break it down |
| **Planner** | Day and week timeline in 15-minute steps. Drag to block time and resize blocks. Synced calendar events appear as locked blocks. Repeating blocks run weekly on chosen days until an end date or for a number of weeks; edit or delete "this one only" or every session. | Plan my day/week: suggested blocks you accept or discard |
| **Plans** | Ask Atlas for a schedule (workouts, study, meal prep, reading, a project timeline). It asks a quick follow-up if needed, checks your Planner and calendar, and shows a plan card listing every session. Edit any session for free, then **Add to Planner** as repeating blocks, with a preview of conflicts (skip, shift or add anyway) and Undo. Planner → Plans tracks progress ("Week 2 of 4 · 5 of 12 sessions done"), check-offs, pausing and removal. Optionally also tracked as a habit and a goal. | Drafting a plan is one Atlas reply; Regenerate is one action; editing, adding and checking off use none |
| **Calendars** | Calendar links in groups, with drag and drop between groups. Read-only ICS sync into the Planner every 10 minutes. | — |
| **Habits** | Daily check-off, streaks and a 12-week history grid. | Suggest habits from your goals |
| **Goals** | Numeric targets with milestones and linked tasks and habits. | Make a plan: milestones and first tasks |
| **Focus** | Pomodoro timer linked to a task. Finished blocks log the time against it. | — |
| **Mood** | One-tap daily check-in and a weekly chart. | Reflect |
| **Weekly Review** | Plain stats for the last 7 days, each with a note on how it's calculated. | Summary and 3 suggestions |
| **Atlas** | Chat panel (orb button or ⌘/Ctrl+J) that works on your real data: add, update, complete and schedule tasks, capture and process notes, log habits, update goals, draft plans. It asks before deleting. History is saved per user. | Every reply counts toward the allowance |
| **Voice mode** | Full-screen HUD with live readouts (time, next event, tasks left, AI uses left). Uses Web Speech input; replies are spoken with an en-GB voice by default. Optional "Hey Atlas" wake phrase, off by default. | Same as Atlas |

Accounts support sign-up with email confirmation, password or magic-link log in, password reset, change email and password, JSON export of all data, and account deletion. On first sign-in, Daybloom offers to import data saved locally by the old offline-only version.

## How AI usage is limited

Every AI call runs server-side in `/api`. The browser never sees the API key.

- **One model, hardcoded.** Every call uses `claude-haiku-5-5`, set in [`server/ai/config.ts`](server/ai/config.ts). It is never read from env, the user or the request. The test mock rejects any other model.
- **Per-user daily allowance.** `DAILY_AI_LIMIT_PER_USER` (default 15) is shown in the app as "✨ 14 left today" and resets at midnight UTC. Admins can override it per user, or block a user.
- **Global spend caps.** `DAILY_SPEND_CAP_USD` (default $0.50) and `MONTHLY_SPEND_CAP_USD` (default $5) pause AI for everyone with "AI is resting until tomorrow 🌙". If unset, the defaults apply. There is never "no cap".
- **Rate limit.** At most 5 requests per minute per user.
- **Atomic checks.** All checks run in one Postgres function (`ai_begin`) under a per-user lock, so parallel requests can't overshoot. Failed calls are refunded.
- **Optional allow-list.** With `ALLOWED_EMAILS` set, only those users get AI.
- **Cost rules.**
  - Prompts are short and include only the data a feature needs.
  - Repeated requests are cached (`ai_cache`): the daily briefing, weekly summary and reflections are free if nothing changed.
  - `max_tokens` is capped at 1200 for structured features, 1000 for Atlas and 500 for voice.
  - Atlas sends only the last 8 messages and at most 6 tool rounds per reply.
- **Logging.** Every request is logged in `usage_log` with tokens and estimated cost. `/admin` (only for `ADMIN_EMAIL`) shows users, requests and spend for today and this month, plus top users, and lets you change a user's limit or block them.

---

## Deploy

### 1. Supabase setup

1. **Create a project** at [supabase.com](https://supabase.com) (the free tier is fine). Choose a strong database password and a region near your users.

2. **Run the migrations.** In **SQL Editor → New query**, paste and run each file in order:
   1. [`supabase/migrations/20261028000001_schema.sql`](supabase/migrations/20261028000001_schema.sql) creates the tables, Row Level Security policies and the profile trigger.
   2. [`supabase/migrations/20261028000002_ai_limits.sql`](supabase/migrations/20261028000002_ai_limits.sql) creates the usage log, limits, cache and admin functions.
   3. [`supabase/migrations/20261029000001_plans.sql`](supabase/migrations/20261029000001_plans.sql) creates plans and repeating Planner blocks.

   **Already deployed?** Run only the migrations you haven't run yet, in order. For the Plans feature, that's file 3.

   If you use the Supabase CLI, `supabase link` and then `supabase db push` does the same thing.

   Every table has RLS enabled, and users can only reach their own rows. The AI-limit and admin functions can only be executed by the service role, which only the server has.

3. **Auth → URL Configuration:**
   - **Site URL:** `https://daybloom.online`
   - **Redirect URLs:** add all of these:
     ```
     https://daybloom.online/auth/callback
     https://daybloom.online/auth/callback?type=email_change
     https://daybloom.online/reset-password
     https://daybloom.online/**
     ```
     For Vercel preview deployments, also add `https://*-<your-vercel-team>.vercel.app/**`. For local development, add `http://localhost:5173/**`.

4. **Auth → Providers → Email:**
   - Enable the Email provider.
   - Keep **Confirm email** on.
   - Keep **Secure email change** on. Users then confirm a new address from both the old and the new inbox, and the app explains this.
   - Set the minimum password length to 8.

5. **Auth → Email Templates.** For each template, set the subject and paste the HTML from [`supabase/templates/`](supabase/templates):

   | Template | Subject | File |
   | --- | --- | --- |
   | Confirm signup | `Confirm your Daybloom account` | `confirm-signup.html` |
   | Magic Link | `Your Daybloom sign-in link` | `magic-link.html` |
   | Reset Password | `Reset your Daybloom password` | `reset-password.html` |
   | Change Email Address | `Confirm your new email for Daybloom` | `change-email.html` |

6. **Auth → SMTP Settings (recommended).** Supabase's built-in mailer sends only a few emails per hour, which is fine for testing but not for launch. Add your own SMTP provider (Resend, Postmark, SES and so on) with a sender like `Daybloom <hello@daybloom.online>`.

7. **Get the keys** from **Project Settings → API**: the Project URL, the `anon` public key, and the `service_role` key. Keep the service role key secret; it goes only in Vercel.

### 2. Vercel

Import the repo into Vercel. The framework (Vite) is detected from `vercel.json`. In **Settings → Environment Variables**, add the following for **Production** (and Preview if you use it):

| Variable | Required | Example | What it's for |
| --- | --- | --- | --- |
| `SUPABASE_URL` | optional | `https://abcd.supabase.co` | Project URL (public). Defaults to the live project in [`shared/publicConfig.ts`](shared/publicConfig.ts). A trailing `/rest/v1/` is ignored. |
| `SUPABASE_ANON_KEY` | optional | `eyJ…` | Public anon key, used by the front end and to verify users. Defaults to the one in `shared/publicConfig.ts`. |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | `eyJ…` | **Secret.** Server only: AI limits, admin, account deletion. |
| `SITE_URL` | ✅ | `https://daybloom.online` | Used for auth email redirects and links. |
| `ANTHROPIC_API_KEY` | ✅ for AI | `sk-ant-…` | **Secret.** Without it, AI features show as off and everything else works. |
| `DAILY_AI_LIMIT_PER_USER` | optional | `15` | AI requests per user per UTC day. Default 15. |
| `DAILY_SPEND_CAP_USD` | optional | `0.50` | Global daily AI spend cap. Default 0.50. |
| `MONTHLY_SPEND_CAP_USD` | optional | `5` | Global monthly AI spend cap. Default 5. |
| `ALLOWED_EMAILS` | optional | `me@x.com,friend@y.com` | If set, only these users can use AI. |
| `ADMIN_EMAIL` | optional | `me@x.com` | The account that can open `/admin`. Its email must be confirmed. |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SITE_URL` are baked into the front end at build time. **Redeploy after changing them.** Server-only variables apply on the next request.

The two public Supabase values are also committed in `shared/publicConfig.ts`, so a build works without them. Point that file at your own project if you fork Daybloom. The service role key and the Anthropic key are secrets: they only ever come from Vercel's environment variables and never reach the browser.

There are 5 serverless functions (`api/*.ts`), well under the Hobby plan limit. Each one is listed by name in `vercel.json` → `functions`, because Vercel rejects patterns that overlap or match no file. If you add a file to `api/`, add it there too. Atlas streams its replies and has a 60-second timeout; the others have 30 seconds.

**Checklist after deploying:**
1. Sign up at https://daybloom.online/signup and confirm the email.
2. Finish onboarding.
3. Check that "✨ 15 left today" appears in the top bar.
4. Open `/admin` with your `ADMIN_EMAIL` account.
5. In the Anthropic Console, also set a monthly spend limit on the API key as a final safety net.

---

## Local development

Requires Node 20+ and Docker.

```bash
npm install
npm run supabase:up    # Postgres + GoTrue + PostgREST + Mailpit in Docker; applies migrations; writes .env.local
npm run gateway        # (separate terminal) serves the local stack at http://localhost:54321
npm run dev            # http://localhost:5173 (the /api routes run inside Vite)
```

- **Emails** (sign-up, magic link, reset) arrive in Mailpit at http://localhost:54324.
- **Real AI:** put `ANTHROPIC_API_KEY=…` in `.env.local`.
- **Mock AI (free):** run `npm run mock:ai` and start the dev server with `ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://127.0.0.1:4010 npm run dev`.
- **Other stack commands:** `npm run supabase:migrate` re-applies the migrations, `npm run supabase:reset` wipes everything, and `npm run supabase:down` stops the containers.

## Tests

```bash
npm run typecheck
npm test             # unit tests, plus DB/RLS and API integration tests when the local stack is up
npm run test:e2e     # browser flows (needs supabase:up, gateway, mock:ai and the dev server as above)
```

- **Integration tests** (`tests/integration`) run the real `/api` handlers against the local Supabase and a mock Anthropic server. They cover:
  - RLS isolation between users.
  - Atomic limits under concurrency, refunds, the rate limit, spend caps and the allow-list.
  - Admin endpoints and account deletion.
  - Every ✨ feature, asserting the pinned model, `effort: low` and capped `max_tokens`.
- **The e2e script** (`tests/e2e/flows.mjs`) drives Chromium through these flows:
  - Sign-up with email confirmation, onboarding and the tour.
  - Brain dump capture, search, AI organize and inbox processing.
  - Atlas actions and delete confirmation.
  - Voice HUD.
  - Hitting the AI limit.
  - Password reset, magic link and email change.
  - Export and account deletion.
  - Planner and goal AI, the admin page and local-data import.
  - Plans: Atlas asks a follow-up and drafts a 4-week workout plan; regenerate, edit a session, add with a conflict (shift), undo, re-add (skip, with a goal), edit one session "this one only", check off a session, and remove the plan with its upcoming blocks. Also the plan card in voice mode.
  - Mobile layout, checked for horizontal overflow.

  Every flow fails on any console error. Set `E2E_ADMIN_EMAIL` to the dev server's `ADMIN_EMAIL` to include the admin UI flow.

## Project structure

```
api/                 Vercel functions: ai, atlas, account, admin, calendar-sync (thin wrappers)
server/
  ai/config.ts       MODEL (claude-haiku-5-5), pricing, max_tokens, effort, history size
  ai/limits.ts       ai_begin / ai_finish / ai_status wrappers and user-facing messages
  ai/features.ts     every ✨ feature: short prompt + zod schema + normalisation
  data/recurrence.ts repeating-block and plan date logic, shared with the app
  data/plans.ts      busy times and plan clean-up for Atlas's plan tools
  ai/atlas/          persona prompt, tools (short refs instead of UUIDs), streaming handler
  data/              compact context loaders shared by features and Atlas
  calendar/          ICS fetch (SSRF-guarded), parse, sync
  account.ts admin.ts auth.ts env.ts http.ts routes.ts vitePlugin.ts
supabase/
  migrations/        schema + RLS, AI limits/usage/admin functions, plans + repeating blocks
  templates/         branded auth emails
  local/             docker-compose for the local stack
src/
  pages/public/      Landing, Terms, Privacy (placeholders to review), 404
  pages/auth/        SignUp, LogIn, ForgotPassword, ResetPassword, AuthCallback
  pages/app/         Dashboard, Onboarding, BrainDump, Tasks, Planner, Calendars, Habits,
                     Goals, Focus, Mood, Review, Settings
  pages/Admin.tsx
  components/        layout/ (shell, nav, palette), atlas/ (panel, orb, voice HUD), notes/,
                     tasks/, habits/, goals/, calendars/, onboarding/ (tour, checklist, import), ui/
  hooks/             auth, profile, AI status, react-query data hooks per table, timer, sync
  lib/               supabase client, api client, dates, quick-add parser, planner math, speech
tests/               unit, integration (local stack), e2e (Playwright), mock Anthropic server
docs/AUDIT.md        what was removed, merged and redefined in the upgrade
```

> **Legal:** `/terms` and `/privacy` are **placeholders**, clearly marked in the page. Review them and replace the [bracketed] parts before launch.
