# Weekly Review: critique & audit (Phase 1 baseline)

Method: design review (sub-agent, screenshots + source + live app) → then detector evidence (Phase 0 CDP scans, both themes, desktop + phone)

Evidence: `test-results/visual/phase0-before/{dark,light}-{desktop,phone}/review.jpg`; source `src/pages/app/Review.tsx`, `src/components/ui/Card.tsx`, `src/components/ui/Ai.tsx`, `src/components/ui/PageHeader.tsx`, `src/components/ui/States.tsx`, the data hooks it reads (`src/hooks/data/{tasks,habits,moods,focus,notes}.ts`, `src/hooks/useAi.ts`), `server/ai/features.ts` + `server/ai/run.ts` (weekly_summary caching), `src/components/habits/ContributionGrid.tsx` (how habit logs are created), `src/index.css`, `tailwind.config.js`. Live probe with Playwright at 1440×900 and 390×844 as Maya. The probe covered tab order, focus rings, target sizes and computed colours. It was read-only: the ✨ button was never pressed, no AI POST was sent, and the theme toggle was not used because it writes `profile.theme`.

Every number on the page was checked against the code that produces it. The seeded account shows the habit figures disagreeing with each other on screen (issue 1).

## Critique

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | The skeleton waits only for tasks and habit logs (`Review.tsx:109`). Habits, moods, focus sessions and notes can still be in flight, so tiles render "No habits yet", "0m" or "No check-ins this week" and then change. The server returns `cached` for the ✨ summary, but the page stores it (`:133`) and never shows it, so you can't tell whether that summary used an action. |
| 2 | Match System / Real World | 3 | The copy is plain ("A plain look at your last 7 days — what got done, what slipped"). But the page calls a rolling Fri→Thu window "this week" in four places, shows ISO dates ("due 2026-10-27"), and uses "habit-days", which is a coined unit. |
| 3 | User Control and Freedom | 2 | The header says "so you can adjust next week", but nothing on the page can be adjusted. Overdue and done rows aren't links and have no actions. You can't look at last week. The AI summary is local state (`:27`), so it disappears when you navigate away. |
| 4 | Consistency and Standards | 2 | Habit consistency, the per-habit list and the chart's "Habits" series count habit days by different rules, so on Maya's account they contradict each other (33% / 1-of-3 vs 13 check-ins in the chart). The time window is called "last 7 days" in some places and "this week" in others. |
| 5 | Error Prevention | 3 | The page is mostly read-only. The only action is ✨, which shows its cost in a tooltip and disables itself at zero. "Regenerate" always sends `force: true` (a paid call), and only the generic tooltip mentions the cost. |
| 6 | Recognition Rather Than Recall | 3 | Each tile carries its own "how it's calculated" line, which is good. The chart has no legend. You have to read "Purple: tasks completed · Blue: habits done" below it and map it back from memory. |
| 7 | Flexibility and Efficiency | 1 | There's no week picker, no drill-down from a tile or bar to the items behind it, no link from an overdue task to the task, and no way to copy or export the review. The single AI action is the only shortcut. |
| 8 | Aesthetic and Minimalist Design | 2 | The structure is calm: four tiles, one AI card and four content cards. But the title is gradient text, the bars and habit meters are violet, and the chart tooltip has a violet border on a tinted `#14112a`. On desktop, "Habits this week" stretches to the chart's height and leaves about 180px of empty card. |
| 9 | Error Recovery | 1 | Only `tasks.error` is surfaced (`:113`). If the habits, moods, focus or notes query fails, the page doesn't say so. It shows "No habits yet", "—", "0m" or "No check-ins this week" as if they were true, and sends those zeros to the AI. |
| 10 | Help and Documentation | 3 | The per-tile "how" notes are exactly the right kind of contextual help, and they deliver the product's "honest numbers" promise. But they're set in the least legible style on the page (11px faint), and the chart, the Brain Dump counts and the "Still overdue" scope have no explanation at all. |
| **Total** | | **22/40** | **Acceptable** |

### Design Specificity Verdict

The skeleton is a category-standard analytics page: a row of four KPI tiles, a grouped bar chart and two lists. Change the labels and it could be any fitness or productivity "weekly report". What makes it Daybloom is the honesty layer. Every tile states its formula in plain words ("Tasks (not steps) you marked done…", "Days you did each habit ÷ days each habit existed…", "Minutes logged by focus sessions that ran to the end."). The ✨ card also states its cost up front, including "free if nothing changed". That layer is rare and is the product's real character on this page. The design undercuts it in two ways. The explanations are the faintest, smallest text on the screen, and the numbers they explain don't always follow the stated rule (issue 1). The violet/blue bar pair and the gradient title are leftovers from the old brand, and "The Clear Head" direction removes both. Several things would make this page feel authored rather than templated: put the review in the student's own terms (done vs. slipped, with the slipped items actionable), and treat today as "so far". Use colour only for the two series that need it.

### What's Working

1. **The formula is printed on every tile.** All four tiles have a `how` line (`Review.tsx:87,93,99,105`) in plain language, and the sub-lines show the raw counts behind each percentage ("1 of 3 habit-days", "from 6 check-ins"). This is the clearest expression of the PRODUCT.md principle "Every number says how it was calculated" anywhere in the app. Focus time is verifiably honest: `useTimer.tsx:68-69` logs minutes only when a work block finishes, which matches "Minutes logged by focus sessions that ran to the end."
2. **The AI is clearly optional and its cost is stated.** The page works fully without ✨. The card states the price before you press anything ("Uses one AI action (free if nothing changed since last time)"), and the server keeps that promise: `server/ai/run.ts:69-77` returns a cached result for the same week and stats hash without spending allowance. The button's tooltip shows the live allowance ("Uses 1 of your 15 AI actions left today").
3. **The tile maths is careful at the edges.** The week-over-week delta has a real "Same as the 7 days before" state. Mood shows "—" with "No check-ins this week" rather than 0/5. Habit consistency returns `null` (not 0%) when no habit-days exist. Subtasks are excluded from task counts on purpose and say so. All dates are computed in the user's time zone (`dayIn(tz, …)`).

### Priority Issues

**1. [P1] The three habit numbers use different rules and contradict each other on screen**
- **What:** Habit consistency reads **33% · 1 of 3 habit-days**. "Habits this week" reads **0/1, 1/1, 0/1**. The "Day by day" chart shows **13 habit check-ins** (Fri 2, Sat 2, Sun 3, Tue 3, Wed 2, Thu 1). The tile and list count only days on or after `habit.created_at` (`Review.tsx:45-47`). The chart counts every log (`Review.tsx:60`). Logs dated before creation are easy to make for real: the Habits grid lets you tick any past day (`ContributionGrid.tsx:46-54`, only `future` days are blocked, `:18`). A student who adds "Drink water" today and back-fills the last few days gets this contradiction. The denominator also includes **today** while the day is still in progress. At 9 am, every habit you'll do tonight counts as a miss, so the tile drops by up to 1/7 every morning.
- **Why it matters:** This is the one page whose purpose is honest numbers. When two parts of the same screen disagree, the user can't trust any number on it, and the AI is sent the low figure (`habit_consistency_percent`).
- **Fix:** Compute habit-days in one shared function used by the tile, the list and the chart. A habit's window starts at the earlier of its creation date and its first log. Count today in the denominator only if the habit is already done today, and say so in the `how` line: "…today counts once it's done". Add a test with logs dated before creation.
- **Suggested command:** `/impeccable harden`

**2. [P1] When data is loading or fails to load, the page shows confident but false numbers**
- **What:** `loading = tasks.isLoading || logs.isLoading` (`Review.tsx:109`). `useHabits`, `useMoods`, `useFocusSessions` and `useNotes` default to `[]` (`:21-25`), and only `tasks.error` reaches `QueryState` (`:113`). Suppose the moods or habits request fails, or is just slower than tasks. The page then states "No check-ins this week", "No habits yet", "0m" focus or "Brain Dump: 0 captured", and `statsForAi` (`:68-80`) sends those zeros to the summary.
- **Why it matters:** "No check-ins this week" is a factual claim. Making it on a network error breaks the "honest numbers" commitment, and the user has no prompt to retry.
- **Fix:** Gate the page, or each tile, on all six queries. Show a per-tile "Couldn't load mood check-ins · Try again" state instead of an empty-data sentence. Keep the ✨ button disabled until every input has loaded.
- **Suggested command:** `/impeccable harden`

**3. [P1] The "how it's calculated" notes are the hardest text to read, and three figures have none**
- **What:** The `how` lines are `faint text-[11px]` (`Review.tsx:122`): `#64748b` at 11px measures **3.91:1** on the dark card (fails WCAG 1.4.3 AA; light is 4.56:1). The chart caption is also faint (`:171`). It carries two unexplained numbers ("Brain Dump: 7 captured, 3 processed") that aren't part of the chart. "Still overdue (1)" counts every overdue task ever, not this week's (`:38`), yet it sits beside "Done this week". The chart doesn't say that "Habits" means "number of habits ticked that day".
- **Why it matters:** The explanations are what make these numbers trustworthy, and right now they read as fine print. On a phone in daylight, the dark-theme notes are close to unreadable.
- **Fix:** Set the `how` lines to 12px `muted` (7.26:1 in both themes). Move the Brain Dump counts into their own small tile or row, with a how line ("Notes you captured / notes you turned into something or archived in the last 7 days"). Give "Still overdue" a sub-line: "All open tasks past their due date, from any week". Give the chart a one-line note too.
- **Suggested command:** `/impeccable clarify`

**4. [P2] "Last 7 days" and "this week" are used for the same window**
- **What:** The header says "your last 7 days", and the range Oct 23 – Oct 29 runs Fri→Thu. The cards say "Habits this week", "Done this week", "No check-ins this week", "days each habit existed this week", and the chart's `aria-label` says "…per day this week". Elsewhere in the app, "week" means Monday-start (`weekStart` in `lib/dates.ts`, used by Focus). Today is the last bar, partly done and unmarked.
- **Why it matters:** A student reading "this week" on a Thursday expects Mon–Thu, and Focus's "this week" won't match this page's Focus tile.
- **Fix:** Use "Last 7 days" everywhere on the page (card titles, empty states, aria-label), or switch the page to a real Mon–Sun week with a week picker. Label the final bar "Today" or "Thu (today)".
- **Suggested command:** `/impeccable clarify`

**5. [P2] The ✨ summary doesn't show what it cost, and is thrown away**
- **What:** The server returns `cached: true/false`. The page saves it (`Review.tsx:133`) but never renders it. The button tooltip always reads "Uses 1 of your N AI actions" (`Ai.tsx:42`), even when the press would be a free cache hit. At zero allowance the button is disabled (`Ai.tsx:41,47`), so a summary you already paid for this week can't be viewed again. "Regenerate" sends `force: true` and always costs an action, but the card copy still says "free if nothing changed". The summary disappears when you leave the page. On success, focus stays on the button and nothing announces the new text.
- **Why it matters:** "Shows what it costs from the daily allowance" is a product principle, and "free if nothing changed" is a claim the UI can't currently show is true.
- **Fix:** Under the summary, print "Saved summary · didn't use an action" or "Used 1 action · 14 left". Give Regenerate its own hint ("Writes a fresh one · uses 1 action"). Allow cache lookups when allowance is 0. Keep the last summary per `week_start` in the query cache. Wrap the result in `aria-live="polite"`.
- **Suggested command:** `/impeccable clarify`

**6. [P2] The page is a dead end: the lists can't be acted on and are silently cut off**
- **What:** "Still overdue" rows are plain text with an ISO date (`:222-225`). You can't open, reschedule or complete the task, which is exactly the "adjust next week" the header promises. Both lists take `.slice(0, 20)` (`:204,221`) while the title count shows the full total, with no "+N more". The page has no previous week.
- **Why it matters:** The weekly loop in PRODUCT.md is review → adjust. Right now adjusting means leaving the page and finding each task again in Tasks.
- **Fix:** Make overdue rows open the task editor, with inline "Tomorrow" / "Next week" / "Done" actions. Write dates as "due Tue 27 Oct · 3 days ago". Add "+N more → Tasks" when lists are truncated. Add ‹ › week navigation in the header.
- **Suggested command:** `/impeccable layout`

### Persona Red Flags

**Casey (distracted mobile user, 390×844):** The ✨ "AI summary" button is 113×30, under the 44px comfortable size, and sits at the top-right of the AI card, outside the thumb zone. The fixed Capture "+" and Atlas orb sit over the right edge of the content as she scrolls. In the phone screenshots they cover the end of the AI card's copy ("next wee…") and would cover the right-aligned "due …" dates. If she leaves the app mid-review and comes back, the AI summary is gone (local state) and she has to press it again, a free cache hit but one she's told costs an action. All the explanations are 11px.

**Jordan (first-timer, week one):** A new account is where the rule mismatches show most. Every habit was created this week, so its "days existed" window is short, and any back-filled tick makes the chart and the tile disagree. "1 of 3 habit-days" needs the 11px faint footnote to make sense. "Still overdue" appears next to "Done this week" and suggests it's a weekly figure when it isn't. The chart has no legend, only "Purple / Blue" words below it.

**Sam (screen reader / keyboard):** The chart wrapper is `role="img"` with a generic label ("Tasks completed and habits done per day this week") that carries no numbers. Recharts 3 makes the SVG focusable inside it, so a Tab stop (measured: 494×208 on desktop, 316×208 on phone) lands inside an "image" whose children are presentational. Per-day values are only reachable through the hover/arrow-key tooltip. The delta is "▲ 3 vs the 7 days before", which is read as "black up-pointing triangle 3". The series are told apart by hue only: violet and blue have a luminance ratio of 1.15:1, and the caption refers to them by colour name.

### Cognitive Load

Checklist failures (1 of 8, so **low**):
- **Working memory:** the chart has no in-place legend. You read "Purple: tasks completed · Blue: habits done" below it and map it back to bars that differ only slightly in hue.

Borderline: **Visual hierarchy** passes on the tiles (the 30px values clearly lead), but the AI card sits above the data it summarises, so on a phone the chart starts below the first screen.

Decision points with more than 4 options: **none.** The only control on the page is the ✨ button.

### Minor Observations

- Mood emoji rounding: 3.5 rounds to 4 and shows 🙂 "Good" (`Review.tsx:98`). That's defensible, but there's no hint that the emoji is rounded.
- "▲ 3 vs the 7 days before" says nothing about direction being good or bad. It's correctly neutral (no green or red), but there's no word "more"/"fewer" for screen readers or quick reading.
- A zero day (Mon) draws nothing at all, so a reader can't tell "0" from "no data".
- The ✨ glyph appears twice in one card header: in the title "✨ Summary & suggestions" and as the button's Sparkles icon.
- The tile labels are uppercase and widely tracked at 12px. That's fine, but it makes four labels shout above the numbers they name.
- "Nothing overdue. 👏" is the page's only decorative emoji. It's harmless, but the other empty states are plain.
- Habit names are cut at `w-40 truncate` (`:181`) with no `title`, so long habit names lose their ending on desktop even when there's room to spare.
- The light-theme habit meter track (`bg-slate-900/10`) is 1.19:1 against the card. The `n/of` numbers carry the meaning, so it's only a polish issue.

## Audit

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | The "how it's calculated" notes, the habit `n/of` counts, the chart caption and the overdue dates are `#64748b` on `#14131b`, which is 3.9:1 in dark (fails 1.4.3). The chart is `role="img"` with no numbers in its label but contains a focusable SVG. Its two series differ only by hue (1.15:1). The AI result isn't announced. The skip link, landmarks, h1→h2 order and visible focus rings are all correct. |
| 2 | Performance | 3 | The route is lazy-loaded, so Recharts is only paid for here, and bar animation is off. Nine cards each carry `backdrop-blur-xl` plus a fade-in on mount. `useMemo` deps are lint-suppressed (`Review.tsx:63`) but complete in practice. |
| 3 | Theming | 2 | The chart is all hard-coded hex (`#8b5cf6`, `#3b82f6`, `#94a3b8`, `#475569`, `#14112a`, a violet `rgba` border) picked by reading `document.documentElement.classList` during render (`Review.tsx:31`), which goes stale on a theme toggle. Violet carries the bars, the habit meters, the tooltip, the ✨ button and the gradient title. Under the direction, ✨/AI should be cyan and emphasis neutral. |
| 4 | Responsive Design | 3 | There's no horizontal overflow at 390px (verified). Tiles reflow 4→2 columns and cards stack. The ✨ button is 113×30, which passes 2.5.8 (≥24px) but is below the 44px comfort size. The Capture "+" and Atlas orb float over the right edge of cards mid-scroll (`main` has `pb-32`, so the end of the page clears them). |
| 5 | Implementation Integrity | 2 | Verified logic defects in the numbers: habit-day rules differ between the tile/list and the chart, only two of six queries are gated for loading and errors, and `cached` is fetched but unused. That's on top of the old-brand violet. These are several verified issues, not systemic drift. |
| **Total** | | **12/20** | **Acceptable** |

**Implementation integrity verdict: fail (narrowly).** The honesty layer (formula lines, a cost statement, null-not-zero handling) is product-specific and good. But two defects on a page whose whole purpose is honest numbers mean it currently says things that aren't true. The habit tile, list and chart disagree on the seeded data, and failed queries render as "No check-ins this week".

### Detector findings

Counts for the review screen. Most findings come from the app shell, which every app screen shares.

| Rule | dark-desktop | dark-phone | light-desktop | light-phone | Where | Verdict |
|------|---:|---:|---:|---:|------|---------|
| low-contrast | 7 | 7 | 1 | 1 | 5× `p.faint` on this page (4 tile `how` lines `Review.tsx:122`, chart caption `:171`) + habit `n/of` `:187` at 3.9:1. 1× the avatar "M" white on violet→pink (`TopBar.tsx:70`), in both themes | **Real.** The page's own findings are dark-only (light measures 4.56:1). Overdue "due …" (`:224`) is the same faint style and also fails, but the detector didn't report it. The avatar is a shell finding. |
| tiny-text | 4 | 4 | 4 | 4 | the four tile `how` lines, `text-[11px]` (`Review.tsx:122`) | **Real.** These carry the honest-numbers explanations, so they're the worst place for 11px. |
| ai-color-palette | 4 | 4 | 4 | 4 | Logo mark (`Logo.tsx:6`), avatar gradient (`TopBar.tsx:70`), body-wide "violet accents", **Atlas orb cyan gradient** | Violet ones are **real but already slated for removal** (DESIGN.md direction). The cyan orb is a **false positive**: cyan is reserved for Atlas. The detector missed the page's own violet, which is in inline JS/SVG: bar fills `Review.tsx:166-167`, tooltip border `:165`, habit meter `bg-violet-500` `:185`. |
| gradient-text | 2 | 1 | 2 | 1 | `h1.gradient-text` "Weekly Review" (`PageHeader.tsx:8`, `index.css:59-62`); sidebar wordmark on desktop | **Real**, slated for removal (No-Ornament Type Rule). |
| dark-glow | 2 | 2 | 0 | 0 | Capture FAB violet glow; Atlas orb cyan glow | FAB glow is **real** (shell, slated for removal). The orb glow is Atlas's own surface. It's borderline under "no glows", but cyan-on-orb is sanctioned, so it's a **false positive** for this page. |
| overused-font | 1 | 1 | 1 | 1 | Inter for 100% of text | **False positive.** One sans family is a deliberate system choice (DESIGN.md typography, operate.md "One family is often right"). |
| straggler | 0 | 1 | 0 | 1 | Header description: "week." alone on its last line at 390px | **Real, P3.** Fixable with `text-wrap: pretty` on `PageHeader` descriptions. |

The source scan (`src_scan_all`, 12 findings) has no hits in `Review.tsx`, `Card.tsx`, `Ai.tsx` or `PageHeader.tsx`. Its `index.css:60-61` gradient-text and `index.css:79` violet button hits apply here through `.gradient-text`. **What the detector can't see** (all found in Assessment A): the habit-number contradiction, the unguarded loading and error states, the stale theme in the chart, the hue-only chart series, and the focusable SVG inside `role="img"`.

### Findings by severity

**[P1] Habit consistency, the per-habit list and the chart count habit-days by different rules**
- **Location:** `src/pages/app/Review.tsx:44-51` (tile + list: days ≥ `created_at`, today always eligible) vs `src/pages/app/Review.tsx:60` (chart: every log); `src/components/habits/ContributionGrid.tsx:46-54` (past days before creation can be ticked)
- **Category:** Implementation Integrity
- **Impact:** On the same screen, the user sees 33% / "1 of 3 habit-days" and 13 habit check-ins. Every morning the tile drops because today counts as a miss. The AI is given the low figure.
- **Recommendation:** Use one `habitDays(habit, logs, days, today)` helper for all three. The window starts at min(created, first log). Today counts only if it's done. Update the `how` copy to match, and add a unit test.
- **Suggested command:** `/impeccable harden`

**[P1] Only tasks and habit logs gate loading and errors; everything else renders failures as real empties**
- **Location:** `src/pages/app/Review.tsx:21-25, 109, 113, 68-80`
- **Category:** Implementation Integrity
- **Impact:** A slow or failed moods/habits/focus/notes query shows "No check-ins this week", "No habits yet", "0m" or "0 captured", and the ✨ summary is generated from those zeros.
- **Recommendation:** Combine `isLoading`/`error` across all six queries (or handle them per tile). Show a per-tile error with retry. Disable ✨ until all inputs have loaded.
- **Suggested command:** `/impeccable harden`

**[P1] The calculation notes and secondary figures fail text contrast in dark, at 11px**
- **Location:** `src/pages/app/Review.tsx:122` (`faint text-[11px]`), `:171` (chart caption), `:187` (habit `n/of`), `:224` (overdue due date); `.faint` = `text-slate-500` in both themes (`src/index.css:66-68`)
- **Category:** Accessibility
- **Impact:** At 3.9:1 (measured `#64748b` on `#14131b`) the explanations that make the numbers honest are the hardest text to read, especially on a phone.
- **WCAG:** 1.4.3 Contrast (Minimum), AA
- **Recommendation:** Use `muted` (`slate-400` in dark, 7.26:1) at 12px for `how` lines, counts and dates. Separately, fix `.faint` in dark to at least `slate-400` (system-wide, see DESIGN.md "faint tier fails AA").
- **Suggested command:** `/impeccable typeset`

**[P2] Chart colours are hard-coded and go stale on theme change**
- **Location:** `src/pages/app/Review.tsx:31` (`dark` read from the DOM during render), `:162-167`; the theme is applied in an effect after render (`src/hooks/useProfile.ts:76-80`, toggle at `src/components/layout/TopBar.tsx:41`)
- **Category:** Theming
- **Impact:** After toggling the theme, the grid, axis ticks and tooltip keep the previous theme's colours until something else re-renders the page (the next `useNow` minute tick). Light-on-light ticks and a `#14112a` tooltip are the likely result. This was traced in code but not exercised live, because the toggle writes `profile.theme`.
- **Recommendation:** Derive chart colours from CSS custom properties (`getComputedStyle` on a ref, or pass `var(--chart-…)` as `fill`/`stroke`, which SVG accepts). Alternatively, read the theme from the same state that `useThemeSync` uses.
- **Suggested command:** `/impeccable colorize`

**[P2] The chart's two series are told apart by hue only, in off-direction violet**
- **Location:** `src/pages/app/Review.tsx:166-167` (`#8b5cf6` / `#3b82f6`), `:165` (violet tooltip border), `:171-173` (caption "Purple: … · Blue: …"); habit meter `:185` `bg-violet-500`
- **Category:** Accessibility / Theming
- **Impact:** The two series have a luminance ratio of 1.15:1, so they're hard to separate for colour-vision-deficient users and in greyscale. The legend tells you a colour name instead of showing a key. Violet goes against the confirmed direction.
- **WCAG:** 1.4.1 Use of Color; 1.4.11 Non-text Contrast (blue bar 3.52:1 on light passes, violet bar 4.05:1)
- **Recommendation:** Use neutral near-white (dark) / near-black (light) for Tasks and a mid-grey for Habits, so the series differ in lightness. Add a real legend with swatches and labels ("Tasks done", "Habits ticked"). Make meters neutral. Don't use cyan: this chart isn't AI.
- **Suggested command:** `/impeccable colorize`

**[P2] The chart is an "image" containing a keyboard stop, with no text alternative for its values**
- **Location:** `src/pages/app/Review.tsx:159-170`; Recharts 3.10.1 `accessibilityLayer` makes the SVG focusable (live: a Tab stop of 494×208 desktop / 316×208 phone)
- **Category:** Accessibility
- **Impact:** Screen-reader users get "Tasks completed and habits done per day this week, image" and none of the 14 numbers. A focusable descendant inside `role="img"` is announced inconsistently.
- **WCAG:** 1.1.1 Non-text Content; 4.1.2 Name, Role, Value
- **Recommendation:** Drop `role="img"` and let Recharts' accessibility layer speak. Alternatively, keep `role="img"`, set `accessibilityLayer={false}`, and add a visually hidden `<table>` (day × tasks × habits) or a value-bearing `aria-label` ("Fri: 0 tasks, 2 habits; …").
- **Suggested command:** `/impeccable harden`

**[P2] The ✨ summary hides whether it cost an action, and can't be re-read**
- **Location:** `src/pages/app/Review.tsx:27, 130-153`; `src/components/ui/Ai.tsx:41-47`; `server/ai/run.ts:69-81`
- **Category:** Implementation Integrity
- **Impact:** `cached` is returned and ignored. The tooltip claims a cost on a free cache hit. At 0 allowance a cached summary is unreachable. Regenerate always costs an action, against "free if nothing changed". The result isn't announced (no `aria-live`).
- **Recommendation:** Render "Saved summary · no action used" or "Used 1 action". Give Regenerate its own cost hint. Allow cache hits at zero allowance. Persist the result per `week_start` in the query cache. Wrap the result in `aria-live="polite"`. Move the ✨ button and the result panel to Atlas cyan, per the direction.
- **Suggested command:** `/impeccable clarify`

**[P2] "Last 7 days" vs "this week" wording; "Still overdue" scope unstated**
- **Location:** `src/pages/app/Review.tsx:93, 98, 112, 159, 176, 201, 218`; overdue filter `:38`
- **Category:** Implementation Integrity (copy matches data)
- **Impact:** The labels describe a different window than the one computed. The all-time overdue count reads as weekly.
- **Recommendation:** Say "last 7 days" consistently. Add a sub-line to "Still overdue". Mark today's bar as "so far".
- **Suggested command:** `/impeccable clarify`

**[P2] Lists are silently truncated and can't be acted on**
- **Location:** `src/pages/app/Review.tsx:204, 221` (`slice(0, 20)` under a full-count title), `:222-225` (plain text rows, ISO date)
- **Category:** Implementation Integrity
- **Impact:** "Done this week (27)" lists 20 items with no hint of the rest. Overdue tasks can't be opened or rescheduled from the review.
- **Recommendation:** Add "+N more → Tasks" (filtered). Make rows buttons that open the task editor, with quick reschedule actions. Format dates in words ("Tue 27 Oct · 3 days ago").
- **Suggested command:** `/impeccable layout`

**[P2] Small ✨ target and floating buttons over content on phone**
- **Location:** `src/pages/app/Review.tsx:131` (`size="sm"` → `!px-2.5 !py-1.5 !text-xs`, measured 113×30); shell FAB + Atlas orb fixed at bottom right
- **Category:** Responsive
- **Impact:** The page's only action is a 30px-tall target at the top right of a card. Mid-scroll, the two 48px floating buttons cover the right edge of card text (the AI copy, "due …" dates).
- **WCAG:** 2.5.8 Target Size (Minimum) passes; this falls short of the 44px guideline
- **Recommendation:** Use the `md` size on phones (≥44px height). On narrow screens, put the AI button under the copy at full width. Keep the floating buttons' right gutter clear in cards (`pr-14` on right-aligned meta, or move dates under titles on phone).
- **Suggested command:** `mobile-native`

**[P3] Every card fades in on each visit**
- **Location:** `src/components/ui/Card.tsx:16` (`animate-fade-in`), `tailwind.config.js:11-16` (250ms ease-out, 4px rise)
- **Category:** Performance / Implementation Integrity
- **Impact:** Nine cards fade in together each time the page mounts. It tells you nothing about state, on a page you open to read numbers.
- **Recommendation:** Remove the mount fade from static data cards (keep it for cards that appear in response to an action, like the AI result).
- **Suggested command:** `remove-animations`

**[P3] The delta glyph and mood emoji are unlabeled; header straggler**
- **Location:** `src/pages/app/Review.tsx:86` ("▲ 3"), `:98` (rounded emoji), `src/components/ui/PageHeader.tsx:9` (straggler "week.")
- **Category:** Accessibility
- **Impact:** Screen readers say "black up-pointing triangle". Sighted users don't learn "3 more". It's minor.
- **Recommendation:** Write "3 more than the 7 days before" (or `aria-hidden` the glyph with sr-only text). Add `text-wrap: pretty` to page descriptions.
- **Suggested command:** `/impeccable polish`

### Positive findings

- **Honest formulas, implemented faithfully where it matters.** Focus time really counts only finished work blocks (`useTimer.tsx:68-69`). Subtasks are excluded as the copy says. All day bucketing uses the profile time zone. `null` (not 0) is used when there's no data, which renders "—".
- **The AI cost model is real.** The server caches by week + stats hash and doesn't spend allowance on a hit (`server/ai/run.ts:69-77`). The button shows the remaining allowance and disables itself at zero.
- **Keyboard and structure basics are right.** There's a skip link, one `main`, an h1 followed by h2 card titles, visible focus rings on every stop (verified across the full tab cycle), and no horizontal overflow at 390px.
- **Chart motion is already off** (`isAnimationActive={false}`, `Review.tsx:166-167`): data appears immediately.

## Motion on this surface

| What | Where | Trigger | Duration / easing | Earns its place? |
|------|-------|---------|-------------------|------------------|
| Card fade-in + 4px rise (all 9 cards) | `src/components/ui/Card.tsx:16`, `tailwind.config.js:12,15` | Mount (each visit, after loading) | 250ms `ease-out`, `both` | **No.** Decorative on a read-only data page. Remove for static cards (P3 above). |
| Skeleton pulse | `src/components/ui/States.tsx:43` (via `QueryState`, `Review.tsx:113`) | While tasks/habit logs load | Tailwind `animate-pulse` 2s infinite | **Yes.** It conveys loading. Should cover all six queries (P1). |
| ✨ button spinner | `src/components/ui/Ai.tsx:51` | While the summary request is pending | `animate-spin` 1s linear | **Yes.** It's the only feedback during a multi-second AI call. Pair it with "Writing…" text for screen readers. |
| Button press scale | `src/index.css:75-76` (`.btn` `transition` + `active:scale-[0.97]`) | Press on ✨ button | Tailwind default 150ms | **Yes.** Tactile feedback, consistent with the "tactile, confident" direction. |
| Recharts tooltip move | `Review.tsx:165` (`<Tooltip>` with default animation) | Hover or arrow-keys on the chart | Recharts default ~400ms ease | **Marginal.** It slides between bars. Set `isAnimationActive={false}` to match the bars and the "quick" character. |
| Bar grow-in | `Review.tsx:166-167` | — | Disabled (`isAnimationActive={false}`) | Correctly off. |
| Reduced motion | `src/index.css:32-40` | `prefers-reduced-motion: reduce` | Global 0.01ms | Acceptable here. None of this page's motion carries state that would be lost (the spinner still renders a static icon). |

## Machine-readable summary

```json
{"surface":"review","critique_total":22,"critique_max":40,"na_heuristics":[],"audit_total":12,
 "issues":[
  {"id":"review-1","severity":"P1","title":"Habit consistency, per-habit list and chart count habit-days by different rules and contradict each other (33% / 1-of-3 vs 13 check-ins); today counts as a miss","fix":"One shared habitDays helper for tile, list and chart; window starts at min(created, first log); count today only if done; update the how-line; add a test","command":"/impeccable harden","files":["src/pages/app/Review.tsx:44","src/pages/app/Review.tsx:60","src/components/habits/ContributionGrid.tsx:46"],"source":"both"},
  {"id":"review-2","severity":"P1","title":"Loading/error gated on tasks and logs only; failed or slow habits/moods/focus/notes render as false empties and feed zeros to AI","fix":"Gate loading/error on all six queries or per tile with retry; disable the AI button until inputs load","command":"/impeccable harden","files":["src/pages/app/Review.tsx:109","src/pages/app/Review.tsx:113","src/pages/app/Review.tsx:21"],"source":"both"},
  {"id":"review-3","severity":"P1","title":"How-it's-calculated notes, habit counts, chart caption and due dates are 11-12px faint text at 3.9:1 in dark; chart, Brain Dump counts and overdue scope have no explanation","fix":"Use muted 12px (7.26:1) for how-lines and secondary figures; add how-lines for chart, Brain Dump counts and Still overdue; raise .faint in dark","command":"/impeccable typeset","files":["src/pages/app/Review.tsx:122","src/pages/app/Review.tsx:171","src/pages/app/Review.tsx:187","src/pages/app/Review.tsx:224","src/index.css:66"],"source":"both"},
  {"id":"review-4","severity":"P2","title":"Rolling last-7-days window labelled 'this week' in cards, empty states and chart label; Still overdue is all-time","fix":"Say 'last 7 days' consistently (or switch to Mon-Sun with a week picker); sub-line on Still overdue; mark today's bar 'so far'","command":"/impeccable clarify","files":["src/pages/app/Review.tsx:93","src/pages/app/Review.tsx:159","src/pages/app/Review.tsx:176","src/pages/app/Review.tsx:201","src/pages/app/Review.tsx:38"],"source":"critique"},
  {"id":"review-5","severity":"P2","title":"AI summary hides whether it used an action (cached ignored), tooltip always claims a cost, cached summary unreachable at 0 allowance, lost on navigation, not announced; button still violet","fix":"Show 'Saved summary - no action used' / 'Used 1 action'; Regenerate cost hint; allow cache hits at 0; persist per week_start; aria-live result; move AI button/panel to Atlas cyan","command":"/impeccable clarify","files":["src/pages/app/Review.tsx:27","src/pages/app/Review.tsx:133","src/components/ui/Ai.tsx:41","server/ai/run.ts:69"],"source":"critique"},
  {"id":"review-6","severity":"P2","title":"Done/overdue lists silently cut at 20 and not actionable; ISO due dates; no previous weeks","fix":"'+N more' link to filtered Tasks; rows open the task editor with quick reschedule; human dates; week navigation","command":"/impeccable layout","files":["src/pages/app/Review.tsx:204","src/pages/app/Review.tsx:221"],"source":"critique"},
  {"id":"review-7","severity":"P2","title":"Chart colours hard-coded hex chosen from the DOM at render; stale after theme toggle","fix":"Drive chart fills/strokes from CSS custom properties or the theme state instead of classList at render","command":"/impeccable colorize","files":["src/pages/app/Review.tsx:31","src/pages/app/Review.tsx:162","src/hooks/useProfile.ts:76"],"source":"audit"},
  {"id":"review-8","severity":"P2","title":"Chart series distinguished by hue only (violet vs blue, 1.15:1), legend by colour name, violet bars, tooltip and habit meters off-direction","fix":"Neutral near-white vs mid-grey series with a swatch legend; neutral meters and tooltip; no violet, no cyan","command":"/impeccable colorize","files":["src/pages/app/Review.tsx:165","src/pages/app/Review.tsx:166","src/pages/app/Review.tsx:171","src/pages/app/Review.tsx:185"],"source":"both"},
  {"id":"review-9","severity":"P2","title":"Chart is role=img with a value-less label but contains a focusable Recharts SVG; no text alternative for the 14 values","fix":"Drop role=img and use Recharts accessibilityLayer, or keep role=img with accessibilityLayer off plus an sr-only data table / value-bearing label","command":"/impeccable harden","files":["src/pages/app/Review.tsx:159"],"source":"audit"},
  {"id":"review-10","severity":"P2","title":"AI summary button is 30px tall at the top right on phone; floating Capture/Atlas buttons cover right-edge card text mid-scroll","fix":"md size (>=44px) and full-width under the copy on phone; keep right gutter clear for floating buttons","command":"mobile-native","files":["src/pages/app/Review.tsx:131"],"source":"both"},
  {"id":"review-11","severity":"P3","title":"All nine cards fade in on every visit","fix":"Remove mount fade from static data cards; keep for the AI result appearing","command":"remove-animations","files":["src/components/ui/Card.tsx:16","tailwind.config.js:15"],"source":"audit"},
  {"id":"review-12","severity":"P3","title":"Delta '▲ 3' and rounded mood emoji unlabeled; header description straggler on phone","fix":"'3 more than the 7 days before' with glyph aria-hidden; text-wrap: pretty on page descriptions","command":"/impeccable polish","files":["src/pages/app/Review.tsx:86","src/pages/app/Review.tsx:98","src/components/ui/PageHeader.tsx:9"],"source":"both"}
 ]}
```
