# Daybloom audit — what's removed, merged or redefined

Audit of the app as of commit `41b6d9c` (localStorage version), done before the
Supabase / Atlas upgrade. Rule applied: **everything on screen must do something
for the user, and every number must be explainable in one sentence.**

## Removed (fake, decorative or meaningless)

| What | Where | Why it goes |
| --- | --- | --- |
| "✨ AI Insights" card with "Beta" badge and "100% organic, 0% neural network" | `InsightsCard.tsx`, `lib/insights.ts` (`generateInsights`) | Rule-based text dressed up as AI. Replaced by the real, on-request **✨ Daily briefing** and the Weekly Review **✨ AI summary**. |
| Productivity Score (big animated number, "Absolute unit 🦄" verdicts, "peer-reviewed by nobody") | `WeeklyReview.tsx`, `weeklyStats().score` | An arbitrary 40/30/15/15 formula. Replaced by four plain stats that each say how they're calculated. |
| "Goal progress 54% — across 4 goals" | Dashboard stat card | Averaging percentages of unrelated goals means nothing. Goals show their own progress on the Goals page. |
| Rotating motivational quotes | `lib/quotes.ts`, dashboard hero | Decorative filler. The hero now shows today's date and what's on today. |
| Seeded demo data (tasks, habits, moods, goals, notes, calendars, focus sessions) | `lib/seed.ts`, `seedIfFirstVisit()` | Real accounts start empty and use guided empty states and onboarding. Demo content exists only as fixtures for the landing-page previews. |
| Built-in demo ICS feed (`/api/demo-calendar.ics`) | `server/demo.ts`, `api/demo-calendar.ts` | Only existed to feed the seed data. |
| Auto keyword tags with a "💭 Thought" fallback | `lib/tags.ts` | Guessing "🛒 Shopping" from the word "buy" mislabels a lot. Notes use explicit `#tags` you write and can filter on. |
| "Notifications: muted. Distractions: banished." | Deep Work overlay | Untrue: the app can't mute notifications. The overlay stays as an honest full-screen timer. |
| Sidebar tagline "life, but organized ✨", welcome-modal marketing copy | `Sidebar.tsx`, `WelcomeModal.tsx` | Vague. Onboarding explains what to do instead. |
| Decorative avatar circle in the top bar | `TopBar.tsx` | Becomes the account menu (settings, log out). |
| Generic "Nothing here yet — let's change that! 🚀" empty states | `EmptyState.tsx` and pages | Each page gets an empty state that says what the page is for and the first thing to do. |
| Calendar JSON export/import in Settings | `SettingsModal.tsx`, `lib/backup.ts` | Superseded by **Export all my data** in account settings. |
| "📅 My Calendars" quick-launch card on the dashboard | `CalendarsCard.tsx` | Not part of "today at a glance". Pinned calendars stay on the Calendars page. |

## Merged (one home per feature)

| Before | After |
| --- | --- |
| **Today's Focus** (dashboard widget with its own list of picked task IDs) and **Tasks** | A task can be marked **Top 3 today** (star) on the Tasks page. The dashboard shows those tasks; checking one there completes the same task. |
| Top-bar quick add (task-only) and Brain Dump input | One **Capture** composer (top bar, floating + button, `N`, voice): it saves to the Brain Dump **Inbox** by default, or switch it to **Task** to use natural-language parsing. |
| "All habits" aggregate contribution grid and per-habit grids | Per-habit history grid only; the aggregate repeated the same information less precisely. |
| Kanban board (To Do / In Progress / Done) and due dates added later | **Tasks list grouped by when** (Overdue, Today, Upcoming, Someday, Done). With due dates, priorities and Top 3, an extra "In progress" column was a second, competing way to sort the same list. *If you want the board back, it can return as a view toggle.* |
| "Next up" card and Planner sync pill | Dashboard **Today** card (schedule = synced events + time-blocked tasks). Sync status stays on Calendars and Planner. |
| Command palette quick add and capture | The palette keeps navigation and actions and sends "add …" text to the Capture composer, so parsing behaves the same everywhere. |

## Redefined numbers (each is explained in the UI)

- **Tasks completed** — tasks you marked done in the last 7 days (and the 7 days before, for comparison).
- **Habit consistency** — check-ins ÷ (habits × days each habit existed in the week).
- **Average mood** — mean of your daily check-ins this week, with how many days you checked in.
- **Focus time** — minutes logged by finished Pomodoro sessions, and which tasks they were for.
- **Streak** — consecutive days ending today (or yesterday, if today isn't logged yet).
- **✨ N left today** — AI actions remaining in your daily allowance (resets at midnight UTC).

## Toned down

- Background: three drifting animated blur blobs → one static gradient wash (no animation, cheaper to paint).
- Removed the shimmer animation on headings, the page slide transitions and staggered card entrances; a single short fade remains, and it's turned off under `prefers-reduced-motion`.
- Confetti only when a goal reaches its target (previously on every checkbox, habit and Pomodoro).
- Glow-on-hover kept subtle and only on clickable cards.

## Kept (they're purposeful)

Dark theme, purple→blue gradients and glassy cards; Planner (day/week timeline,
drag, resize, locked synced events, current-time line); Calendars (groups, pins,
search/filters, Google embed preview, ICS sync with per-calendar errors and the
"find your ICS address" guide); natural-language quick add (chrono-node);
Pomodoro timer; mood check-in and 7-day chart; habit streaks and history grid;
command palette.
