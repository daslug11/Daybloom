# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: **students and young adults** handling classes, deadlines, side projects, jobs and new routines. They need structure without a steep learning curve. They are regular people, not productivity enthusiasts, and won't learn a system before getting value.

Daybloom is used by one person organising their own life. There are no teams, sharing or shared workspaces.

## Product Purpose

Daybloom is a free life organiser: a single place to get everything out of your head and then get it done.

**Success:**
- People capture thoughts the moment they have them.
- They regularly turn that inbox into real commitments: tasks, time on the Planner, habits and goals.
- They come back daily for the dashboard and weekly for the review.

## Positioning

**Brain Dump first.**

- **Capture first.** Anything can be captured without deciding what it is: press N, tap +, use the quick-add bar, or talk.
- **Organise later.** Process inbox walks through each note: make a task, schedule it, add it to a goal, keep it as an idea, or archive it. Anything converted keeps a link back to the note it came from.
- **Atlas is optional.** The built-in assistant can sort, extract, summarise and plan, but it supports this capture-then-organise loop rather than replacing it. Everything works without AI.

## Operating Context

- **Devices:** a web app at https://daybloom.online, used on phones and desktops, often in short bursts between other things.
- **Daily loop:**
  - capture at any moment;
  - the dashboard: today's schedule, top 3 tasks, habits due, inbox count, an optional ✨ daily briefing;
  - work from Tasks, the Planner and the Focus timer.
- **Weekly loop:** process the inbox, then the Weekly Review (plain stats plus an optional ✨ summary).
- **External calendars:** read-only. Users paste ICS links and events appear locked in the Planner. Daybloom never connects to Google or any outside calendar account, and never writes to one.
- **Atlas:** a slide-out chat panel (⌘/Ctrl+J or the orb button) and a full-screen voice mode. It acts on the user's real data, confirms before deleting, and says what it changed.

## Capabilities and Constraints

**Areas:**
- **Brain Dump:** Inbox, Ideas, All notes and Archive views; Markdown and checklists; tags; search.
- **Tasks:** natural-language quick add, priorities, due dates, steps, today's top 3.
- **Planner:** day and week timeline in 15-minute steps, synced events, repeating blocks.
- **Plans:** schedules drafted by Atlas, such as workout or study plans, added to the Planner as repeating blocks.
- **The rest:** Calendars, Habits with streaks, Goals with milestones, Focus (Pomodoro), Mood check-ins, Weekly Review, Settings.

**Accounts:** email and password or magic link, plus email verification, password reset, and changing email or password. Onboarding is followed by a skippable tour and a Getting started checklist.

**Stack:** React, Vite and Tailwind on Vercel, with Supabase for auth and data. Row Level Security is on every table.

**AI:**
- Every AI call uses one model, `claude-haiku-5-5`.
- AI runs only when the user taps a ✨ button or talks to Atlas.
- Each use counts against a visible per-user daily allowance ("✨ N left today"), which resets at midnight UTC.
- Global daily and monthly spend caps pause AI for everyone, with the message "AI is resting until tomorrow 🌙".
- Editing, adding and checking off things never uses AI.

**Not built and not decided:** paid tiers, sharing or collaboration, native mobile apps, notifications.

## Brand Commitments

- **Name and mark:** Daybloom, with the 🌸 mark.
- **Atlas:** an original character. Calm, polished, quietly witty, with a refined British manner. Uses the user's name now and then. Concise.
- **Voice mode** (user-specified): a full-screen HUD that is near-black, with a cyan orb, counter-rotating rings, real-data readouts and a monospace transcript. It boots with "Systems online. Good evening, {name}."
- **Interface copy:**
  - Plain and honest.
  - Every page answers "what is this for, and what do I do here?"
  - Empty states say how to start.
  - No vague marketing language.

## Evidence on Hand

- **Landing page:** previews built from the real app components with sample data (`src/pages/public/Landing.tsx`).
- **Audit:** `docs/AUDIT.md` records what was removed as fake or decorative, and what was merged or redefined.
- **Legal pages:** `/terms` and `/privacy` are placeholders marked for review, not final legal text.
- **Absent, never to be fabricated:**
  - real user counts, testimonials or reviews;
  - press, partners or customer logos;
  - usage metrics or benchmarks;
  - pricing beyond "free".

## Product Principles

1. **Capture first, decide later.** Getting a thought out of your head should never require choosing what it is. Organising is a separate, guided step.
2. **Honest by default.** No made-up stats, fake insights or invented social proof. Every number says how it was calculated.
3. **AI is a helper, never a requirement.** It runs only on request, shows what it costs from the daily allowance, and every feature still works without it.
4. **Low friction for busy students.** It must be useful in the first minute and in short sessions on a phone, without learning a system first.
5. **Your data is yours.** Users only ever see their own data, and can export everything or delete their account at any time.

## Accessibility & Inclusion

- Fully usable by keyboard and screen reader: labelled controls, focus management in dialogs, visible focus.
- Respects reduced-motion settings.
- Works as well on a phone as on a desktop, with a bottom tab bar on mobile.
- Dark and light themes.
- Voice input degrades gracefully: browsers without speech recognition get a typed fallback.
