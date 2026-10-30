# Habits: critique & audit (Phase 1 baseline)

Method: design review (sub-agent, screenshots + source + live app) → then detector evidence (Phase 0 CDP scans, both themes, desktop + phone)

Evidence used for the critique: the four `phase0-before/*/habits.jpg` screenshots; `src/pages/app/Habits.tsx`, `src/components/habits/HabitCard.tsx`, `src/components/habits/ContributionGrid.tsx`, `src/hooks/data/habits.ts`, `src/lib/dates.ts`, plus `Modal`, `Ai`, `EmojiPicker`, `PageHeader`, `States`, `cache.ts`, `index.css`, `server/ai/features.ts` (`suggestHabits`); a read-only Playwright probe of `/app/habits` as Maya at 1440×900 and 390×844 (tab order, target sizes, focus rings, computed colours). No data was changed and no ✨ button was pressed. Today in the seed is Thursday 2026-10-29.

## Critique

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | "1 of 3 done today" is a polite live region and the check-off flips instantly (optimistic). But toggling a past grid square gives no toast or announcement, and the streak number changes silently. |
| 2 | Match System / Real World | 2 | "5/7 this week" is really a rolling last 7 days, while the grid's columns are Monday-to-Sunday calendar weeks. The footer says "darker squares are days you did it", but in dark mode the done squares are lighter. The copy says "click" on a phone. |
| 3 | User Control and Freedom | 2 | Archive has an Undo toast, but once the toast is gone archived habits can't be seen or restored anywhere. A past-day toggle has no undo. |
| 4 | Consistency and Standards | 2 | Delete uses `window.confirm` instead of the app's Modal. The "⋯" icon (usually a menu) opens a full edit dialog. Each habit's emoji shows twice. Violet is used for "done", "today", focus, the AI button and the primary button, all at once. |
| 5 | Error Prevention | 2 | 81 tappable 14×14px history squares per habit, 3px apart, with no confirm or undo: one mis-tap on a phone rewrites history and breaks a streak. Save is disabled while the name is empty (good). |
| 6 | Recognition Rather Than Recall | 2 | The grid has no weekday or month labels. The only way to know a square's date is a `title` tooltip, which touch screens never show. The streak rule sits in a faint footer below every card. |
| 7 | Flexibility and Efficiency | 1 | No shortcuts, no arrow-key grid navigation (243 tab stops across 3 habits), no reordering, and no "Add all" in the suggestions dialog. |
| 8 | Aesthetic and Minimalist Design | 2 | The cards are calm, but on desktop the 200px grid sits in a 538px card with the right 60% empty. The violet gradient title, gradient button and saturated violet grid fight the "Clear Head" direction. The "DAY STREAK" label is 10px faint text. |
| 9 | Error Recovery | 3 | Failed mutations roll back and toast. The server returns a plain "Add a goal first…" message. QueryState offers a retry. The add error ("Could not add that habit.") doesn't say why. |
| 10 | Help and Documentation | 2 | The header sentence, the empty state and the streak footer are good intent. The grid itself has no legend, no axis and no explanation of the empty squares from before the habit existed. |
| **Total** | | **21/40** | **Acceptable** |

### Design Specificity Verdict

The structure is a well-worn pattern: a habit row with a check button, a 🔥 streak counter and a GitHub-style contribution grid. Any habit tracker could ship this card unchanged. That's acceptable for an Operate surface ("earned familiarity"). What isn't acceptable is that the familiar parts are copied without the parts that make them *trustworthy*. GitHub's grid has month and weekday labels and a "Less → More" legend; this one has neither, and it still asks users to edit their history through it. The page's real product-specific idea is the honest-numbers footer ("Streak = days in a row ending today, or ending yesterday…"). That idea is right, but it's rendered as faint 12px text under the last card (below the fold on a phone, at y≈1015 of 844), and two of the numbers it sits beside are mislabelled or can be wrong (see P1s). The visual language is today's generic violet-gradient "glass" kit, not the confirmed neutral, tactile direction.

### What's Working

1. **The check-off is a real, tactile target.** The 44×44 button in `HabitCard.tsx:26-36` has `aria-pressed` and a full sentence label ("Mark Drink water done today" / "Undo … for today"), and swaps the emoji for a heavy check. It's the clearest one-tap action in the app, and the daily-burst use case ("Casey between lectures") is served well.
2. **The page tries to explain its numbers.** The header sentence names all three interactions (tick, streak, fix history). The streak has both a `title` and a footer definition (`Habits.tsx:110`), and `streak()` in `dates.ts:78-86` honestly implements "ending yesterday if today isn't logged yet", so a streak doesn't read 0 at 8am. The intent matches PRODUCT.md's "every number says how it was calculated".
3. **Safe lifecycle choices.** Archive is offered before Delete, archive keeps history and has an Undo toast (`Habits.tsx:150-153`), and Delete names the habit and says "This can't be undone." The empty state (`Habits.tsx:82-86`) gives three concrete starter habits and explains ✨ Suggest. The editor's "Keep it small enough to do on a bad day." is a well-judged line for this audience.

### Priority Issues

**[P1] "this week" is not this week, and the grid shows days before the habit existed as misses**
- **What:** `HabitCard.tsx:21-22` counts `today, today-1 … today-6`, a rolling 7 days, and prints it as "5/7 this week" (`HabitCard.tsx:42`). The grid directly below groups days into Monday–Sunday calendar weeks (`ContributionGrid.tsx:12-19`). For Maya's "Read 20 minutes" on Thursday, the grid's current week shows 2 of 4 days done; the card says "5/7 this week". Separately, `ContributionGrid` ignores `habit.created_at`, so "Stretch" (about two weeks old) shows ten weeks of grey "not done" squares, and screen readers announce each one as "not done".
- **Why it matters:** PRODUCT.md's commitment is "Every number says how it was calculated." These two numbers contradict each other on the same card, and the grid accuses new users of weeks of failure they never had. That is exactly the "fake insight" pattern the product forbids, and it's demotivating for the student audience.
- **Fix:** Rename to "5 of the last 7 days", or compute a true Monday-based week ("2 of 4 days this week") so it matches the grid. Pass `created_at` into `ContributionGrid` and render pre-creation days as non-interactive, visibly different cells (a dotted outline or no fill) with the label "before you started". Make the streak footer say how the weekly count is calculated too.
- **Suggested command:** `/impeccable clarify`

**[P1] Streak silently caps at about 120 days**
- **What:** `useHabitLogs` fetches only `day >= today − 120` (`habits.ts:11,27`), and `streak()` walks back until a day is missing (`dates.ts:78-86`). A streak longer than about 120 days stops at the edge of the fetched data and shows ~121, forever. The query key `habitLogsKey(uid)` (`habits.ts:9,25`) also doesn't include `today`, so a tab left open past midnight keeps the old range.
- **Why it matters:** This is a P0-class trust bug for exactly the users who care most (the long-streak ones), and it violates "honest numbers". It's a bug, but it only shows after four months, so it's rated P1.
- **Fix:** Compute streaks server-side (a SQL gaps-and-islands query or an RPC returning `current_streak`), or fetch logs until the first gap. Add `today` to the logs query key. If you keep a cap, display "120+".
- **Suggested command:** `/impeccable harden`

**[P1] The history grid can't be read or safely edited on a phone or with a keyboard**
- **What:** Each habit renders 81 `<button>`s at 14×14px with 3px gaps (`ContributionGrid.tsx:33,36,46-55`; measured 14×14 in the live app at both sizes). The grid has no weekday or month labels and no legend. A cell's date exists only in `title` and `aria-label`, and the `title` never appears on touch. Every cell is a separate tab stop with no roving tabindex: 243 grid stops for 3 habits (270 tabbables on the page). Tapping a cell toggles history immediately, with no toast, undo or announcement (`Habits.tsx:104`).
- **Why it matters:** The header promises "click any past square to fix your history", but on a phone you can't tell which square is which date, and the targets fail WCAG 2.5.8 (24×24 minimum with spacing). A mis-tap quietly breaks a streak, and the student has no way to notice what changed. Keyboard users have to tab through 81 stops per habit to reach the next card.
- **Fix:** Keep the grid as a read-only visual (one `role="img"` with a summary like "Done 41 of 84 days"). Move history editing to a dedicated "Edit history" view: a labelled, month-calendar picker with ≥40px days (or a row of the last 7 days with weekday labels and 44px targets). If cells stay interactive, make it one tab stop with arrow-key roving focus (`role="grid"`), add M/T/W/T/F/S/S row labels and month labels above the columns, and show a toast with Undo ("Marked Tue 27 Oct done · Undo") after every past-day change.
- **Suggested command:** `/impeccable adapt` (then `/impeccable harden` for the keyboard grid)

**[P2] The streak definition is in the wrong place, and its copy is wrong in dark mode**
- **What:** The explanation lives at `Habits.tsx:110` as `.faint text-xs`: slate-500 on the page background, below every card (y=1015 on a 844-tall phone). It says "Darker squares are days you did it", but done cells are `violet-500` on a `white/7%` empty tile in dark mode (`ContributionGrid.tsx:4-10`), so they're *lighter*. The per-card "DAY STREAK" label is 10px faint uppercase (`HabitCard.tsx:47`), and the definition there is in a `title` tooltip.
- **Why it matters:** This is the surface's one honest-numbers explanation, and it's the least visible text on the page and factually wrong in the default theme.
- **Fix:** Put a small legend row directly above the first card ("■ done · □ not done · ◻ today · Streak = days in a row, counting yesterday until you log today") at muted contrast, 12px+. Change the copy to "Filled squares are days you did it." Make "day streak" 11–12px muted, and make the 🔥 number a button or disclosure that shows the definition on tap, not a `title`.
- **Suggested command:** `/impeccable clarify`

**[P2] Archived habits vanish, and Delete breaks the app's dialog pattern**
- **What:** Archive says "its history is kept" (`Habits.tsx:152`), but nothing in the app lists or restores archived habits (`useHabits` filters `archived_at is null`, `habits.ts:18`; no "Archived" view exists). Delete uses the browser's `window.confirm` (`Habits.tsx:162`), unstyled, from inside the app's own Modal.
- **Why it matters:** "Your data is yours" and "honest copy": telling users history is kept, with no way to reach it, is a soft lie. The native confirm looks like a different product and on mobile Safari it can show the page URL.
- **Fix:** Add an "Archived (n)" disclosure at the bottom of the Habits page with a Restore action for each habit. Replace `window.confirm` with an in-modal confirm step (Modal swaps to "Delete 'Stretch' and 34 days of history?" with a danger button).
- **Suggested command:** `/impeccable harden`

**[P2] The suggestions dialog: the end state lies, and there's no batch action**
- **What:** After the user adds every suggestion, `suggestions` becomes `[]` and the dialog shows "No new suggestions — you may already have habits covering your goals." (`Habits.tsx:181-182`), which isn't true: they just added them. Each item has its own violet-gradient "Add" (`Habits.tsx:197-206`), with no "Add all" and no "Done". Keys are array indexes (`key={i}`). The AI result is presented in the everyday violet kit, not the Atlas cyan that DESIGN.md reserves for AI results.
- **Why it matters:** Wrong copy at the end of the flow means a bad final moment (peak-end), and the student has to tap Add four times.
- **Fix:** Track the added items and show "Added 3 habits ✓" with a Done button when the list empties. Add an "Add all" secondary action. Style the result panel with the Atlas cyan accent and quieter neutral Add buttons.
- **Suggested command:** `/impeccable polish`

### Persona Red Flags

**Casey (distracted mobile user)**
- The primary check-off works well, but on 390px the card's meta line wraps to three lines and truncates the title to "📚 Read 20 minu…" because the emoji is shown twice (once in the button, once in the title) and the streak block takes about 110px.
- The grid uses about 324px but its 14px squares are the only way to fix history. The `title` dates never appear on touch, so Casey taps blind, and nothing confirms the change.
- The streak explanation is below the fold (y≈1015) and below the fixed tab bar's overlap zone. The FAB and Atlas orb sit over the right side of the second card (visible in `dark-phone/habits.jpg`).
- The New habit and Suggest buttons are at the top of the page, out of thumb reach, though the global + FAB covers capture.

**Sam (keyboard / screen reader)**
- 270 tab stops on the page, 243 of them grid squares. The first grid cell is tab stop 22 on desktop. There's no arrow-key navigation and no "skip grid".
- Grid buttons are announced "Mon, Aug 10: not done, toggle button, not pressed" for days *before the habit existed*.
- The focus ring on the first column is clipped by the grid's `overflow-x-auto` wrapper (`ContributionGrid.tsx:36`): only the bottom-right of the ring is visible on Aug 10 in the live probe.
- Card titles are `<h3>` directly under the page `<h1>` (`HabitCard.tsx:38`), with no `<h2>`. The streak's definition is `title`-only, so screen readers don't announce it.
- Past-day toggles produce no live announcement; only "N of M done today" is live.

**Jordan (first-timer)**
- "Click any past square to fix your history" with no labelled squares: Jordan can't find "Tuesday". The "⋯" icon gives no hint that it's how you rename, archive or delete. The ✨ Suggest from goals button is shown even with no goals, and only after pressing it does the server say "Add a goal first" (`server/ai/features.ts:416`).

### Cognitive Load

Checklist failures (3, moderate):
- **Chunking:** each card shows 81 undifferentiated squares, with no week or month grouping labels.
- **Recognition / working memory:** to edit a date, the user has to count columns back from the ringed "today" square and remember which row is which weekday.
- **Visual hierarchy:** the check-off, the 🔥 number, the violet grid and the ringed today cell all compete. On "Read 20 minutes" the solid violet block outweighs today's unchecked state, which is the only thing that needs action.

Decision points with more than 4 options:
- **Habit card:** check-off, edit, plus 81 grid buttons (83 actions per card).
- **Editor modal:** an 18-emoji picker (`Habits.tsx:17`). That's acceptable as a picker, but the emoji buttons have no accessible names beyond the glyph and no `aria-pressed` (`EmojiPicker.tsx:7-17`).

### Minor Observations

- The emoji is duplicated in the button and the title (`HabitCard.tsx:35,39`). Drop it from the `<h3>`.
- 🔥 still shows at full colour for a 0 streak (`HabitCard.tsx:46`). Only the number turns faint, so "🔥 0" reads as a small celebration of nothing. Show "—" or a muted 0 without the flame.
- The "1 of 3 done today" summary is the only page-level number. A streak or "this week" summary is absent, which is fine; just don't add one without the definitions.
- The editor's goal `<select>` only appears when goals exist (good). There's no way to reorder habits even though `sort` exists.
- The header copy says "click"; use "tap or click" or a neutral "select".
- The desktop grid occupies 200px of a 538px card. Either let cells grow (`flex-1` columns) or put the grid beside the title block.

## Audit

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | 14px grid targets (fails SC 2.5.8), 243 grid tab stops, focus ring clipped by `overflow-x-auto`, 10px faint "day streak" label below AA |
| 2 | Performance | 3 | `backdrop-blur-xl` on every card plus a fixed radial-gradient body. 243 grid buttons each re-render on every log toggle (no memo), still cheap. |
| 3 | Theming | 2 | Hard-coded violet throughout the grid, check-off and focus. Modal `dark:bg-[#13111f]`. The "darker squares" copy is wrong in dark. |
| 4 | Responsive Design | 2 | No horizontal overflow (scrollWidth = viewport), but the history editor is unusable by touch and titles truncate at 390px |
| 5 | Implementation Integrity | 2 | Numbers on the card disagree (rolling vs calendar week), streak capped by the 120-day fetch, gradient text and buttons against the direction |
| **Total** | | **11/20** | **Acceptable** |

<!-- AUDIT_DETECTOR_PLACEHOLDER -->
