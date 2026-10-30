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


The audit was done after the critique was written. The detector JSON (`.scratch/review-input/habits-detector.json`) was opened only at this point.

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | The streak number fails AA (orange-600 3.4:1 in light; faint 0-streak 3.9:1 in dark). "day streak" is 10px at 3.9:1. Grid cells are 14×14 (fails SC 2.5.8). 243 grid tab stops, and the focus ring is clipped. |
| 2 | Performance | 3 | `backdrop-blur-xl` on every `.glass` card plus a fixed multi-radial body background. 81 buttons per card re-render on every toggle (no memo). Fine at 3 habits, but grows linearly. |
| 3 | Theming | 2 | Hard-coded `violet-*` in the grid shades, check-off, today ring, emoji picker and focus. Modal uses `dark:bg-[#13111f]`. The footer copy ("darker squares") is wrong in the dark theme. |
| 4 | Responsive Design | 2 | No horizontal page scroll (scrollWidth = 390 at 390px), but the history editor isn't usable by touch, card titles truncate at 390px, and the desktop grid leaves 60% of each card empty |
| 5 | Implementation Integrity | 2 | Card numbers disagree with the grid (rolling vs calendar week). The streak is capped by the 120-day fetch. Pre-creation days are shown as misses. Gradient text, gradient buttons and violet glows go against the confirmed direction. |
| **Total** | | **11/20** | **Acceptable** |

**Implementation Integrity verdict: fail.** The structure is product-appropriate, but the surface's numbers don't consistently say how they're calculated (see habits-1, habits-2), which is the specific commitment this surface exists to keep.

### Detector findings

70 findings across the four Habits scans (dark-desktop 21, dark-phone 18, light-desktop 16, light-phone 15).

| Rule | Count | Where | Verdict |
|------|-------|-------|---------|
| low-contrast | 22 | `button.btn-primary` "New habit", white on a gradient, 3.9:1 (×4) | **Real.** The gradient is slated for removal; the neutral primary must reach 4.5:1. |
| | | "day streak" label, `#64748b` on `#14131b`, 3.9:1 (dark, ×5) | **Real**, `HabitCard.tsx:47` |
| | | Streak number `text-orange-600` on `#f9fbfd`, 3.4:1 (light, ×4) | **Real.** `text-lg font-bold` is 18px, below the 18.66px bold "large text" threshold, so 4.5:1 applies. `HabitCard.tsx:46`. The detector missed nothing here. Both light-theme numbers fail. |
| | | 0-streak number `.faint`, 3.9:1 (dark-desktop, ×1) | **Real**, `HabitCard.tsx:46` |
| | | Footer `p.faint.mt-4` 4.2/4.3:1 (advisory, ×4) | **Real** (12px, so 4.5:1 applies), `Habits.tsx:110`. This is the streak definition itself. |
| | | `span.flex.h-8` avatar, white on a pink gradient, 3.9:1 (×4) | Real, but app-shell (TopBar), not this surface |
| ai-color-palette | 16 | Body "purple/violet accents" (×4), logo and avatar gradients (×8) | **Real** per DESIGN.md direction (violet leaves everyday UI). Logo and avatar are shell-owned. |
| | | Atlas orb "cyan gradient background" (×4) | **False positive.** Cyan is reserved for Atlas (The Atlas Colour Rule). |
| undersized-ui-text | 12 | "day streak" at 10px, every card, every scan | **Real**, `HabitCard.tsx:47` |
| gradient-text | 6 | `h1.gradient-text` "Habits" (×4) via `PageHeader.tsx:8`; sidebar wordmark (×2, desktop only) | **Real.** Already slated for removal (No-Ornament Type Rule). The wordmark is shell-owned. |
| dark-glow | 6 | `btn-primary` violet glow (×2), capture FAB `shadow-violet-900/30` (×2, `AppShell.tsx:129`), Atlas orb glow (×2) | btn-primary and FAB: **real**, already slated for removal. Orb glow: **false positive / accepted**, as the Atlas signature (keep it, but confirm it stays restrained). |
| skipped-heading | 4 | `<h1>` Habits → `<h3>` habit name | **Real**, `HabitCard.tsx:38` (WCAG 1.3.1 best practice) |
| overused-font | 4 | Inter 100% | **False positive for this surface.** The single sans is a documented choice, and Operate mode explicitly permits it. |

`src_scan_all` items touching this surface: `index.css:60-61` (`.gradient-text`) and `index.css:79` (`.btn-primary` gradient). Both are real and already scheduled. Other source hits (CalendarCard, GoalCard, Logo, TopBar, Switch, VoiceHud grid) belong to other surfaces. The VoiceHud grid is the sanctioned showpiece.

**What the detector missed** (found in the critique and the live probe): the 14×14px interactive grid cells and the 243 grid tab stops; the focus ring clipped by `overflow-x-auto`; violet as the meaning colour for "done" in the grid (`ContributionGrid.tsx:4-10`) and on the check-off (`HabitCard.tsx:30`); and every honest-numbers problem (rolling "this week", the streak cap, pre-creation misses, wrong "darker" copy). These are behavioural or semantic, so no static rule would catch them.

### Findings by severity

**[P1] Week count mislabelled; pre-creation days rendered as misses**
- **Location:** `src/components/habits/HabitCard.tsx:21-22,42`; `src/components/habits/ContributionGrid.tsx:13-19,33-58` (no `created_at` input)
- **Category:** Implementation Integrity
- **Impact:** Two numbers on one card disagree ("5/7 this week" vs 2 of 4 days in the grid's current week). New habits show weeks of "not done", read aloud as such.
- **WCAG:** n/a (PRODUCT.md honest-numbers commitment)
- **Recommendation:** Label it "N of the last 7 days" or compute a Monday-based week. Pass `habit.created_at` and render earlier days as inert "before you started" cells.
- **Suggested command:** `/impeccable clarify`

**[P1] Streak capped by the 120-day history fetch; logs query not keyed by date**
- **Location:** `src/hooks/data/habits.ts:11,22-29`; `src/lib/dates.ts:78-86`
- **Category:** Implementation Integrity
- **Impact:** Any streak longer than ~120 days displays ~121 forever. After midnight in an open tab, the range is stale until a refetch.
- **WCAG:** n/a
- **Recommendation:** Return `current_streak` from an RPC (gaps-and-islands), or keep fetching until a gap is found. Include `today` in `habitLogsKey`.
- **Suggested command:** `/impeccable harden`

**[P1] Interactive history grid: undersized targets, no keyboard model, clipped focus**
- **Location:** `src/components/habits/ContributionGrid.tsx:33` (`cell = 'h-3.5 w-3.5'`), `:36` (`overflow-x-auto`, `gap-[3px]`), `:46-55`
- **Category:** Accessibility / Responsive
- **Impact:** 81 targets per habit at 14×14 with 3px spacing. They fail SC 2.5.8 (a 24px circle centred on a cell overlaps its neighbours), so mis-taps on phones silently edit history. 243 tab stops for 3 habits. The first column's `ring-2 ring-offset-2` focus ring is cut off by the scroll container (seen live on "Mon, Aug 10").
- **WCAG:** 2.5.8 Target Size (Minimum, AA); 2.4.7 Focus Visible (partially obscured); 2.1.1 is technically met, but with an extreme tab burden
- **Recommendation:** Make the grid a read-only `role="img"` summary, and move editing to a labelled month picker with ≥40px days. Or implement `role="grid"` with roving tabindex and arrow keys, larger cells on touch (`pointer: coarse` → ≥24px with spacing), `p-1` inside the scroller so rings aren't clipped, and an Undo toast after each past-day toggle.
- **Suggested command:** `/impeccable adapt`

**[P1] Streak number and labels fail AA contrast**
- **Location:** `src/components/habits/HabitCard.tsx:46` (`text-orange-600` light = 3.4:1; `.faint` 0-streak dark = 3.9:1), `:47` (10px `.faint` "day streak", 3.9:1 dark); `src/pages/app/Habits.tsx:110` (`.faint text-xs` footer 4.2–4.3:1); `.faint` defined at `src/index.css:66-68`
- **Category:** Accessibility
- **Impact:** The headline number on each card, and the text explaining it, are the least legible things on the page.
- **WCAG:** 1.4.3 Contrast (Minimum)
- **Recommendation:** Use `text-orange-700` (light) or a neutral near-white or slate-900 number with the 🔥 as the only colour. Raise `.faint` to slate-400 on dark and slate-600 on light (or retire `.faint` for anything users must read). Make "day streak" at least 11–12px.
- **Suggested command:** `/impeccable typeset`

**[P2] Streak and grid explanation misplaced and inaccurate in dark theme**
- **Location:** `src/pages/app/Habits.tsx:110`; `src/components/habits/HabitCard.tsx:45` (`title`-only definition)
- **Category:** Implementation Integrity
- **Impact:** "Darker squares are days you did it" is false in dark mode (done cells are lighter). The definition sits below every card and is unreachable on touch via `title`.
- **WCAG:** 1.3.3 Sensory Characteristics (instructions rely on "darker")
- **Recommendation:** Add a legend above the cards with sample swatches and "Filled = done". Make the streak a disclosure (button → popover) instead of `title`.
- **Suggested command:** `/impeccable clarify`

**[P2] Archived habits unreachable; native `window.confirm` for delete**
- **Location:** `src/pages/app/Habits.tsx:150-168`; `src/hooks/data/habits.ts:18`
- **Category:** Implementation Integrity
- **Impact:** "Its history is kept" with no way to view or restore. The browser confirm breaks visual and focus consistency inside the Modal.
- **WCAG:** n/a
- **Recommendation:** Add an "Archived (n)" section with Restore. Use an in-Modal confirm step.
- **Suggested command:** `/impeccable harden`

**[P2] Suggest dialog end state and AI styling**
- **Location:** `src/pages/app/Habits.tsx:179-211` (empty-after-adding message at :181-182; `key={i}` at :186; per-item `btn-primary` at :197)
- **Category:** Implementation Integrity / Theming
- **Impact:** After adding all suggestions the dialog claims "No new suggestions". The AI result uses violet gradients instead of the Atlas cyan reserved for AI result panels. Index keys can mis-associate items after removal.
- **WCAG:** n/a
- **Recommendation:** Show "Added N ✓" plus Done when emptied. Add "Add all". Use stable keys (`s.name`). Give the panel a cyan Atlas accent and neutral Add buttons.
- **Suggested command:** `/impeccable polish`

**[P2] Violet as emphasis everywhere (direction drift)**
- **Location:** `src/components/habits/ContributionGrid.tsx:4-10,54`; `src/components/habits/HabitCard.tsx:30`; `src/components/ui/EmojiPicker.tsx:13`; `src/components/ui/PageHeader.tsx:8`; `src/index.css:30,59-61,78-80,93-96`
- **Category:** Theming
- **Impact:** "Done", "today", "selected", focus, AI and primary are all violet, so colour carries no distinct meaning (Meaning-Only Rule). The gradient title and the button glow are flagged in every scan.
- **WCAG:** n/a
- **Recommendation:** Done = near-white fill (dark) or near-black (light), with a single neutral grid ramp. Today = an outline in the neutral emphasis. Check-off done state = a solid neutral, or emerald (Done Emerald is the documented "completed" colour). Title = solid colour.
- **Suggested command:** `/impeccable quieter`

**[P3] Heading level skip and duplicated emoji**
- **Location:** `src/components/habits/HabitCard.tsx:35,38-39`
- **Category:** Accessibility
- **Impact:** h1 → h3. Each habit's emoji is read and shown twice, which pushes title truncation on phones.
- **WCAG:** 1.3.1 (best practice)
- **Recommendation:** Use `<h2>` (styled as now). Remove the emoji from the title text.
- **Suggested command:** `/impeccable polish`

**[P3] EmojiPicker options lack state and names**
- **Location:** `src/components/ui/EmojiPicker.tsx:7-17`
- **Category:** Accessibility
- **Impact:** The selected emoji is shown only by a violet ring. There's no `aria-pressed` or `role="radio"`, and the accessible name is a raw glyph ("✍️").
- **WCAG:** 4.1.2 Name, Role, Value
- **Recommendation:** Use `role="radiogroup"` / `role="radio"` with `aria-checked`, and give each option an `aria-label` ("Running").
- **Suggested command:** `/impeccable harden`

### Positive findings

- The check-off button is a 44×44 target with `aria-pressed` and full-sentence labels (`HabitCard.tsx:26-36`), measured 44×44 live.
- Every grid button has a full date label ("Thu, Oct 29: done") and `aria-pressed`, and the grid has a named group (`ContributionGrid.tsx:36,42,51-53`). The semantics are there; only the interaction model needs work.
- The "N of M done today" summary is `aria-live="polite"` (`Habits.tsx:90`).
- Optimistic mutations with rollback and an error toast for every write (`cache.ts:9-33`), so offline or failed toggles don't leave lying UI.
- The Modal traps focus, closes on Escape, and returns focus (`Modal.tsx:18-50`). The editor autofocuses the name field, and Enter submits.
- `dates.ts` does all day arithmetic on noon-anchored local keys (`parseKey`), which avoids DST off-by-one streak bugs.
- No horizontal page overflow at 390px or 1440px.

## Motion on this surface

| # | What | Where | Trigger | Duration / easing | Earns its place? |
|---|------|-------|---------|-------------------|------------------|
| 1 | Check-off colour, ring and background change | `HabitCard.tsx:29` (`transition`) | Tap check-off / hover | Tailwind default 150ms `cubic-bezier(0.4,0,0.2,1)` on all props | Yes, it conveys state. But this is the surface's one rewarding moment and it's only a colour fade. A crisp 120–160ms press scale (0.95→1) on the check icon would make "done" feel tactile, per the direction. Keep it short; no confetti. |
| 2 | Grid cell fill and hover ring | `ContributionGrid.tsx:54` (`transition`, `hover:ring-1`) | Hover / toggle / focus | 150ms default | Mostly yes. Side effect: `transition` also animates the `:focus-visible` box-shadow, so the focus ring fades in over 150ms instead of appearing instantly (seen in the live probe). Limit it to `transition-colors`. |
| 3 | Button press scale | `index.css:75-76` (`.btn active:scale-[0.97]`) | Press on New habit, Suggest, Add, Save | 150ms default | Yes, it gives tactile feedback, consistent app-wide |
| 4 | Emoji option hover grow | `EmojiPicker.tsx:12` (`transition hover:scale-110`) | Hover in the editor | 150ms | Marginal. Decorative, and it does nothing on touch. Replace it with a background-tint hover. |
| 5 | Modal enter | `Modal.tsx:63` (`animate-fade-in`; `tailwind.config.js` 0.25s ease-out, 4px rise) | Open New/Edit habit, Suggestions | 250ms ease-out, no exit animation | Acceptable, at the upper end of Operate's 150–250ms. The backdrop `backdrop-blur-sm` (`Modal.tsx:55`) costs paint on low-end phones. Fine to keep, or trim to 180ms. |
| 6 | AI button spinner | `Ai.tsx:51` (`animate-spin`) | Suggest from goals pending | Continuous, linear 1s | Yes, it's the loading state |
| 7 | Loading skeleton pulse | `States.tsx:43` (`animate-pulse`) | Initial habits/logs load | 2s pulse | Yes |
| 8 | Toast enter/exit (archive undo, "Added …", errors) | `useToast.tsx:48-51` (Framer `layout`, opacity/y/scale) | After archive, add suggestion, failed save | Framer default spring | Yes, but the toast has a violet glow `shadow-[…rgba(139,92,246,0.6)]` and a violet Undo button, both against the direction |
| 9 | Input focus transition | `index.css:70-72` (`.input transition`) | Focus the name field / goal select | 150ms | Yes |

Reduced motion: the global rule (`index.css:32-41`) cuts every animation and transition to 0.01ms, which covers all rows above. The CSS rule does not reach the Framer toasts (row 8): Framer animates them from JavaScript, and nothing in `src/` uses `MotionConfig` or `useReducedMotion`. So the toast's 20px rise and scale still play with reduced motion on. Add `<MotionConfig reducedMotion="user">` around the app.

## Machine-readable summary

```json
{"surface":"habits","critique_total":21,"critique_max":40,"na_heuristics":[],"audit_total":11,
 "issues":[
  {"id":"habits-1","severity":"P1","title":"\"this week\" is a rolling 7 days and the grid shows pre-creation days as misses","fix":"Label as 'N of the last 7 days' (or compute a Monday-based week matching the grid); pass habit.created_at to ContributionGrid and render earlier days as inert 'before you started' cells","command":"/impeccable clarify","files":["src/components/habits/HabitCard.tsx:21","src/components/habits/HabitCard.tsx:42","src/components/habits/ContributionGrid.tsx:13"],"source":"both"},
  {"id":"habits-2","severity":"P1","title":"Streak silently capped at ~120 days by the history fetch; logs query not keyed by date","fix":"Compute current_streak server-side (gaps-and-islands RPC) or fetch until a gap; add today to habitLogsKey; show '120+' if any cap remains","command":"/impeccable harden","files":["src/hooks/data/habits.ts:11","src/hooks/data/habits.ts:27","src/lib/dates.ts:78"],"source":"both"},
  {"id":"habits-3","severity":"P1","title":"History grid: 14px targets, 81 tab stops per habit, no date labels, clipped focus ring, silent edits","fix":"Make the grid a read-only role=img summary and move editing to a labelled month picker with >=40px days; or role=grid with roving tabindex + arrow keys, weekday/month labels, >=24px cells on coarse pointers, padding inside the scroller, and an Undo toast after each past-day toggle","command":"/impeccable adapt","files":["src/components/habits/ContributionGrid.tsx:33","src/components/habits/ContributionGrid.tsx:36","src/components/habits/ContributionGrid.tsx:46","src/pages/app/Habits.tsx:104"],"source":"both"},
  {"id":"habits-4","severity":"P1","title":"Streak number and 'day streak' label fail AA contrast; 10px label","fix":"Neutral high-contrast streak number (or orange-700 in light), raise .faint to slate-400 dark / slate-600 light for readable text, 'day streak' at 11-12px","command":"/impeccable typeset","files":["src/components/habits/HabitCard.tsx:46","src/components/habits/HabitCard.tsx:47","src/index.css:66"],"source":"both"},
  {"id":"habits-5","severity":"P2","title":"Streak/grid explanation is a faint footer below all cards and says 'darker squares' (false in dark theme)","fix":"Legend row above the cards with swatches ('Filled = done', today outline, streak rule); change copy to 'Filled squares'; make the streak definition a tap disclosure instead of title","command":"/impeccable clarify","files":["src/pages/app/Habits.tsx:110","src/components/habits/HabitCard.tsx:45"],"source":"both"},
  {"id":"habits-6","severity":"P2","title":"Archived habits can't be viewed or restored; Delete uses window.confirm","fix":"Add an 'Archived (n)' section with Restore; replace window.confirm with an in-Modal confirm step naming the history that will be lost","command":"/impeccable harden","files":["src/pages/app/Habits.tsx:150","src/pages/app/Habits.tsx:162","src/hooks/data/habits.ts:18"],"source":"critique"},
  {"id":"habits-7","severity":"P2","title":"Suggestions dialog claims 'No new suggestions' after you add them all; no Add all; AI panel not in Atlas cyan","fix":"Track added items and show 'Added N' + Done; add 'Add all'; stable keys; cyan Atlas accent on the result panel with neutral Add buttons","command":"/impeccable polish","files":["src/pages/app/Habits.tsx:181","src/pages/app/Habits.tsx:186","src/pages/app/Habits.tsx:197"],"source":"critique"},
  {"id":"habits-8","severity":"P2","title":"Violet used for done, today, selected, focus, AI and primary; gradient title and glowing button","fix":"Neutral near-white/near-black done fill and grid ramp, neutral today outline, emerald or neutral check-off done state, solid page title, no glow","command":"/impeccable quieter","files":["src/components/habits/ContributionGrid.tsx:4","src/components/habits/HabitCard.tsx:30","src/components/ui/PageHeader.tsx:8","src/index.css:78"],"source":"both"},
  {"id":"habits-9","severity":"P3","title":"h1 to h3 heading skip; emoji duplicated in button and title (truncates titles on phone)","fix":"Render habit name as h2; drop emoji from the title text","command":"/impeccable polish","files":["src/components/habits/HabitCard.tsx:35","src/components/habits/HabitCard.tsx:38"],"source":"both"},
  {"id":"habits-10","severity":"P3","title":"EmojiPicker options have no selected state or names for assistive tech","fix":"radiogroup/radio with aria-checked and descriptive aria-labels","command":"/impeccable harden","files":["src/components/ui/EmojiPicker.tsx:7"],"source":"audit"},
  {"id":"habits-11","severity":"P3","title":"Grid transition animates the focus ring; emoji hover scale is decorative","fix":"Use transition-colors on grid cells so focus appears instantly; replace hover:scale-110 with a tint","command":"remove-animations","files":["src/components/habits/ContributionGrid.tsx:54","src/components/ui/EmojiPicker.tsx:12"],"source":"audit"}
 ]}
```
