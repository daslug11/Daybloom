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

<!-- AUDIT-BELOW: written after opening the detector file -->
