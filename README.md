# Daybloom 🌸

Vibe-coded life organizer ✨ — purple-to-blue gradients, glassmorphism, emoji everywhere.
Tasks with natural-language quick add, a time-blocking planner, habits, focus timer, goals,
brain dump, calendar links with ICS sync, and a weekly review. Your data lives in your browser
(localStorage); a tiny backend exists only to fetch calendar feeds.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

`npm run dev` also serves the calendar-sync API (a Vite plugin mounts the same handlers that
Vercel runs), so there's no second process to start. `npm run build` type-checks and builds to
`dist/`; `npm run preview` serves the build *with* the API; `npm test` runs the unit tests.

## Features at a glance

- **Natural-language quick add** — top bar (press `N`), ⌘K palette, Tasks page and Planner.
  `gym tomorrow 6pm #health !high` → task “gym”, tomorrow, 6:00 PM, `#health`, high priority.
  Also understands `fri 3pm`, `next monday`, `3-5pm`, `for 45m`, `!med`, `!low`. Parsed locally
  with chrono-node and previewed as colored chips before you save. Date + time ⇒ auto time-blocked.
- **Planner** — day/week timeline in 15-minute slots. Drag tasks from *Unscheduled* onto it (or tap a
  task, then tap a slot — works on touch), drag blocks to move (across days in week view), drag the
  bottom edge to resize, drag a block back onto the sidebar to unschedule. Synced calendar events
  are locked, striped blocks; a glowing line tracks the current time.
- **Calendar sync** — flip *Sync* on any saved calendar whose link is an ICS feed. Events show up in
  the Planner and the dashboard's *Next up* card. Per-calendar errors are shown on the card, and the
  Calendars page explains how to find each provider's secret ICS address.

## Stack

Vite · React 18 · TypeScript · Tailwind CSS · lucide-react · framer-motion · recharts · canvas-confetti

## Calendar sync backend

No API keys, no database, no paid services. One endpoint:

```
POST /api/calendar-sync
{ "feeds": [{ "id": "c1", "url": "https://…/basic.ics" }], "from": "<ISO>", "to": "<ISO>", "tz": "Europe/Berlin" }
→ { "results": [{ "id": "c1", "ok": true, "events": [...], "fetchedAt": "…", "cached": false }
                | { "id": "c2", "ok": false, "error": "The calendar server refused access (403)…" }] }
```

- Fetches each feed server-side (browsers can't, because of CORS), parses it with **node-ical**, expands
  recurring events into the requested window, and returns plain JSON. All-day events come back as
  `YYYY-MM-DD` dates so they land on the right day in every time zone.
- **Caches** each feed's body in memory for **10 minutes** (failures for 1 minute). The cache lives
  as long as the server process / warm serverless instance.
- **Guards**: http(s)/webcal only, 10 s timeout, 5 MB cap, max 3 redirects (each re-checked), at most
  25 feeds per request, and it refuses hosts that resolve to localhost/private networks (SSRF
  protection). Set `SYNC_ALLOW_PRIVATE=1` to test against a feed on your own machine.
- Feed URLs are never stored server-side; they stay in your browser's localStorage.
- `GET /api/demo-calendar.ics?tz=…` serves a demo ICS feed (standups, gym, lunch…) generated
  relative to today. The seed data subscribes to it, so sync works out of the box; the sync endpoint
  answers it in-process instead of fetching itself.

Code: `server/` (framework-agnostic, Web `Request`/`Response` handlers), `api/` (Vercel function
entry points), `server/vitePlugin.ts` (dev/preview server), tests in `tests/`.

### Deploying to Vercel

1. Push the repo to GitHub and **Import** it at vercel.com/new (or run `npx vercel` in the repo).
2. Vercel reads `vercel.json`: framework *Vite*, build `npm run build`, output `dist/`, and the
   functions in `api/`. No environment variables are needed.
3. Deploy. The app and `/api/calendar-sync` share one origin, so there's nothing to configure in the
   frontend. Optional: `npx vercel dev` runs the real serverless runtime locally.

**Other hosts:** any static host works for the app, but sync needs the `/api` routes. Either use
`npm run preview` behind a Node host, or wire `handleSyncRequest` from `server/sync.ts` into your
own server (it takes and returns standard `Request`/`Response`). Without the API, the app still
works and the Calendars page clearly says the sync server isn't reachable.

> Behind a corporate proxy in local dev? Start with `NODE_USE_ENV_PROXY=1 npm run dev` so Node's
> `fetch` honors `HTTPS_PROXY`.

## Structure

```
src/
  App.tsx              shell: sidebar / top bar / mobile tabs, providers, ⌘K shortcut, page switch
  main.tsx             seeds demo data on first visit, mounts the app
  index.css            Tailwind + shared classes (.glass, .btn-primary, .chip, .gradient-text…)
  pages/               one file per sidebar entry
    Dashboard  Tasks  Planner  Habits  Focus  Goals  Notes  Calendars  WeeklyReview
  components/          shared UI (Card, Modal, CommandPalette, SettingsModal, ProgressRing,
                       ContributionGrid, MoodCheckin, TodaysFocus, InsightsCard, NextUpCard,
                       QuickAddBar, TaskChips, SyncStatus, …)
    calendars/         CalendarCard, CalendarModal, GroupModal, IcsHelp, SyncToggle, …
  hooks/
    useLocalStorage.ts shared, synced localStorage state (used by every feature)
    useData.ts         typed per-feature hooks (useTasks, useHabits, useCalendars…)
    useTimer.tsx       app-wide Pomodoro (keeps running across pages)
    useCalendarSync.tsx sync state: auto-sync on change + every 10 min, per-feed status
    useQuickAdd.ts     parse + save a natural-language task
    useToast.tsx       toasts with optional Undo action
    useRoute.ts        tiny hash router
    useApp.ts          app actions context (navigate, open palette/settings…)
  lib/
    quickAdd.ts (chrono-node parser)  planner.ts (timeline math)  sync.ts (API client)
    types.ts storage.ts seed.ts dates.ts insights.ts calendars.ts backup.ts tags.ts quotes.ts …
server/                calendar-sync backend (fetch + SSRF guard, node-ical parsing, cache, demo feed)
api/                   Vercel serverless entry points
tests/                 vitest: parser, planner helpers, sync backend
```

Settings (⚙️) has **Reset data** (re-seeds the demo data, keeping your name) and
**Export / Import JSON** for calendar links.
