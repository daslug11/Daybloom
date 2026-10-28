# Daybloom 🌸

Vibe-coded life organizer ✨ — purple-to-blue gradients, glassmorphism, emoji everywhere.
Tasks, habits, focus timer, goals, brain dump, calendar links and a weekly review, all stored
locally in your browser (no backend).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

`npm run build` type-checks and builds to `dist/`; `npm run preview` serves the build.

## Stack

Vite · React 18 · TypeScript · Tailwind CSS · lucide-react · framer-motion · recharts · canvas-confetti

## Structure

```
src/
  App.tsx              shell: sidebar / top bar / mobile tabs, providers, ⌘K shortcut, page switch
  main.tsx             seeds demo data on first visit, mounts the app
  index.css            Tailwind + shared classes (.glass, .btn-primary, .chip, .gradient-text…)
  pages/               one file per sidebar entry
    Dashboard  Tasks  Habits  Focus  Goals  Notes  Calendars  WeeklyReview
  components/          shared UI (Card, Modal, CommandPalette, SettingsModal, ProgressRing,
                       ContributionGrid, MoodCheckin, TodaysFocus, InsightsCard, …)
    calendars/         CalendarCard, CalendarModal, GroupModal, ColorSwatches, TypeBadge
  hooks/
    useLocalStorage.ts shared, synced localStorage state (used by every feature)
    useData.ts         typed per-feature hooks (useTasks, useHabits, useCalendars…)
    useTimer.tsx       app-wide Pomodoro (keeps running across pages)
    useToast.tsx       toasts with optional Undo action
    useRoute.ts        tiny hash router
    useApp.ts          app actions context (navigate, open palette/settings…)
  lib/
    types.ts storage.ts seed.ts dates.ts insights.ts calendars.ts backup.ts tags.ts quotes.ts …
```

Settings (⚙️) has **Reset data** (re-seeds the demo data, keeping your name) and
**Export / Import JSON** for calendar links.
