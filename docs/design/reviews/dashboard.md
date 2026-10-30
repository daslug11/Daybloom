# Dashboard (+ app shell): critique & audit (Phase 1 baseline)

Method: design review (sub-agent, screenshots + source + live app) → then detector evidence (Phase 0 CDP scans, both themes, desktop + phone)

Scope: `/app` dashboard plus the shell it sits in: sidebar, top bar, mobile bottom tab bar and More sheet, floating capture "+" and Atlas orb, command palette (⌘K), focus overlay and toasts. Evidence: the four `phase0-before/*/dashboard.jpg` screenshots, the source files listed below, and live Playwright probes at 390×844 (touch) and 1440×900 against the seeded "Maya" account. The probes only read the page; no data was changed.

Note on the phone screenshots: they are full-page captures, so the fixed tab bar and FABs appear in the middle of the page (over "Top tasks"). That is a capture artefact, not a layout bug. The same goes for the sidebar ending at 900px in the desktop captures. The real-viewport behaviour was checked live.

## Critique

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Failed loads are shown as empty states. If `useTasks`/`useNotes` errors, the cards say "Nothing due today" or "Inbox · 0 / Empty" (`Dashboard.tsx:192-206, 230-255`). The cached AI briefing has no "written at" time, so it can contradict the live counts beside it. The active nav, inbox badge and "✨ 15 left today" pill are good. |
| 2 | Match System / Real World | 3 | Plain, student-shaped copy ("Good evening, Maya", "Process inbox", "4 notes waiting"). "Dashboard" in the sidebar becomes "Today" in the tab bar (`MobileNav.tsx:27`), and "Top tasks" lists 4 items while the app teaches "top 3". |
| 3 | User Control and Freedom | 2 | Tapping a habit chip logs it and the chip vanishes, with no undo and no done state (`Dashboard.tsx:222`). Task completion does get an Undo toast, but it auto-dismisses after 6s and doesn't pause on hover or focus. |
| 4 | Consistency and Standards | 2 | The task title is a `<button aria-label="Open task …">` that does nothing on the dashboard, because `onOpen` is never passed (`Dashboard.tsx:198`); on Tasks the same row opens the task. Violet means "primary", "selected", "link", "Atlas-adjacent AI", "now", "badge" and "focus" all at once. |
| 5 | Error Prevention | 3 | Destructive actions aren't present here, and AI buttons show their allowance cost in the tooltip and disable at zero. Habit chips and the 20px completion circles are easy to mis-tap on a phone. |
| 6 | Recognition Rather Than Recall | 3 | Every card has a labelled "→ page" link, empty states say what to do, and icon + label nav. The kbd hints (N, Ctrl K) are visible on desktop. |
| 7 | Flexibility and Efficiency | 3 | N to capture, ⌘K palette with "Add task: '…'" fallback, ⌘J for Atlas, collapsible sidebar. The keyboard path is held back by 2 tab stops per task row, one of them dead (see 4). |
| 8 | Aesthetic and Minimalist Design | 2 | The optional AI briefing owns the full-width hero slot, while the Inbox (the heart of the product) sits bottom-right. Equal-height grid rows leave large dead areas (Schedule card ~360px tall for one sentence; Habits ~190px for two chips). Gradient greeting, gradient+glow "Process inbox" button, violet FAB and body glows all compete. |
| 9 | Error Recovery | 2 | Mutation errors roll back with a generic toast ("That change could not be saved"), which is fine. Query errors on this page have no ErrorState or retry at all. AI errors only show as a transient toast. |
| 10 | Help and Documentation | 3 | The Getting started checklist is computed from real data, the tour can be replayed from the palette, tooltips explain AI cost, and every empty state teaches. There's no contextual help for what "Top tasks" includes (starred + overdue). |
| **Total** | | **25/40** | **Acceptable** |

### Design Specificity Verdict

**Partly authored, partly category-default.** What is specific to Daybloom: the copy and the content model. The greeting line counts real things ("4 tasks for today · 0 things still on the schedule · 1 done so far"), the Inbox card has a single, product-defining "Process inbox" action, empty states route into the capture-then-organise loop ("Press N or capture a thought"), and the checklist is checked from real data. The AI briefing is labelled ✨, opt-in and priced from the allowance.

What is interchangeable: the composition. It is the generic "greeting + 2-column bento of equal cards" dashboard that any SaaS template ships. Every card has the same weight, the same icon + title + "Link →" header and the same glass fill, so nothing tells you what to do first. The visual language (violet→blue→pink gradient text, gradient glowing primary button, translucent blur cards, tinted near-black with colour washes) is the stock "AI product" look, and it directly contradicts "The Clear Head" direction. The biggest missed opportunity: the product is "Brain Dump first", yet the dashboard has no capture affordance of its own and puts the inbox fifth in reading order.

### What's Working

1. **Honest, countable header line.** `Dashboard.tsx:103-105` turns three real queries into one plain sentence with correct pluralisation. It is exactly the "every number says how it was calculated" spirit, and it reads in under a second.
2. **Empty states that teach the loop.** Schedule ("Nothing more scheduled today. Block time for a task, or sync a calendar."), Top tasks ("star (☆) up to three tasks…") and Inbox ("Press N or capture a thought…") each name the next action and link straight to it (`Dashboard.tsx:182-184, 203-205, 235-241`).
3. **AI is visibly optional and priced.** The briefing is never generated on load; it is read from `ai_cache` (`Dashboard.tsx:54-60`). The ✨ button's title spells out "Uses 1 of your N AI actions left today" and disables at zero (`Ai.tsx:39-53`). The top bar shows the allowance. This honours commitment #1 better than most AI products.

### Priority Issues

**[P1] Phone layout: every dashboard card overflows the right gutter, and long inbox notes would push it off-screen**
- **What:** On a 390px phone the grid column resolves to 375px inside a 358px content box, so all cards run 17px past the 16px right padding and sit flush against the screen edge (visible in both phone screenshots, measured live: `gridTemplateColumns: 375px`, grid box 358px, document scrollWidth 391). The cause is the Inbox list item `className="truncate"` (`Dashboard.tsx:246`). Because grid items default to `min-width: auto`, the nowrap text's full width becomes the column's minimum. A note near the 90-character `clip()` limit would make every card ~600px wide and the page scroll horizontally.
- **Why it matters:** Casey is the primary user, and the dashboard is the daily-return screen. The missing right gutter makes it look broken, and the worst case breaks the "works as well on a phone" commitment.
- **Fix:** Give the grid `grid-cols-1` / `grid-cols-[minmax(0,1fr)]` at base and `lg:grid-cols-2` (which Tailwind already emits as `minmax(0,1fr)`), or add `min-w-0` to `Card`. Then verify truncation on the Inbox and Schedule rows with a 90-char note.
- **Suggested command:** `/impeccable adapt` (then `break-ui` with long notes)

**[P1] Dead "Open task" control on every Top tasks row**
- **What:** `TaskItem` renders the title as `<button aria-label="Open task …">` (`TaskItem.tsx:37`), but the dashboard passes no `onOpen` (`Dashboard.tsx:198`). Clicking or pressing Enter on the title does nothing (verified live: URL unchanged, no dialog). It adds 4 extra tab stops that announce an action they don't perform.
- **Why it matters:** The title is the largest target in the row and the natural thing to tap. Screen-reader and keyboard users are told it opens the task, and mouse users click and get nothing. This breaks consistency with the Tasks page.
- **Fix:** Pass `onOpen` to open the same task drawer used on Tasks (or navigate to `/app/tasks?open=<id>`). If that's out of scope, have `TaskItem` render a non-interactive `<div>` when `onOpen` is undefined.
- **Suggested command:** `/impeccable harden`

**[P1] Load failures masquerade as real "nothing here" states (honest-numbers breach)**
- **What:** The dashboard never reads `error` from `useTasks`, `useNotes`, `useHabits` or `useMoods`. On a failed query, Top tasks shows "Nothing due today", the Inbox says "Inbox · 0 · Empty. Press N…", Habits says "No habits yet", and the header says "0 tasks for today · … 0 done so far" (`Dashboard.tsx:64-67, 104, 192-256`). The sidebar badge silently disappears too (`Sidebar.tsx:11-14`).
- **Why it matters:** PRODUCT.md commitment #2 ("honest numbers"). On a flaky phone connection, a student is told their inbox is empty and they have nothing due, which is the most damaging lie this screen can tell.
- **Fix:** For each card, branch on `isError` and render the existing `ErrorState` with retry (`States.tsx:19`), and show "—" instead of 0 in the header sentence while any source is errored or loading.
- **Suggested command:** `/impeccable harden`

**[P2] The hierarchy inverts the product: the optional AI briefing is the hero, the Brain Dump is last**
- **What:** Reading order is ✨ Daily briefing (full width, top), Schedule, Top tasks, Habits, Inbox, then Mood. The inbox card holds the screen's only primary button, yet it sits in the 5th slot, below the fold on a phone (~1,450px down at 390px). There is no capture input on the dashboard itself; on phones the top-bar capture field is hidden (`TopBar.tsx:25`, `hidden … sm:flex`).
- **Why it matters:** "Brain Dump first" and "AI is a helper, never a requirement". The first screenful on a phone is an AI summary and an empty Schedule card.
- **Fix:** Lead with a compact "Today" block: Top tasks first, then an Inbox strip with count + Process inbox + an inline capture field. Demote the briefing to a collapsed, one-line ✨ row ("Get today's briefing" / headline only, with expand). Let cards size to content (`items-start` or a masonry/column flow) so Schedule doesn't stretch to the Top tasks height.
- **Suggested command:** `/impeccable layout`

**[P2] Violet/gradient emphasis everywhere contradicts the confirmed direction**
- **What:** These all carry violet/gradient today:
  - gradient-text greeting (`Dashboard.tsx:100`, `.gradient-text` `index.css:59-62`);
  - gradient + glow "Process inbox" (`.btn-primary` `index.css:78-81`);
  - violet capture FAB with violet shadow (`AppShell.tsx:129`);
  - violet active nav (`Sidebar.tsx:41`) and violet badges (`Sidebar.tsx:63`, `MobileNav.tsx:28`);
  - violet "Now" pill (`Dashboard.tsx:176`);
  - violet links;
  - violet→pink avatar (`TopBar.tsx:70`);
  - violet toast glow (`useToast.tsx:53`);
  - body colour washes (`index.css:23-27`).
- **Why it matters:** "Crisp, precise, quick" and "neutral near-white emphasis" can't land while seven different meanings share one hue. The Process inbox button glows like a marketing CTA in a tool you open for thirty seconds.
- **Fix:** This is already slated for the foundations pass. Make primary a solid near-white (dark) / near-black (light) button with a shallow shadow, active nav a neutral fill, links neutral with underline, the "Now" pill a single non-violet signal, and the greeting solid ink.
- **Suggested command:** `/impeccable quieter` → `/impeccable colorize` (to re-map meaning-only colour)

**[P2] Phone: two stacked FABs permanently cover the right edge of the content**
- **What:** The capture "+" and Atlas orb (48px each, 12px gap) are fixed at `bottom-20 right-4` (`AppShell.tsx:126`). They occupy a ~60×108px column just above the tab bar and sit on top of whatever scrolls under them. In the live viewport they cover the end of "Idea: a study group for the stats exam #st…" and the right side of the Process inbox row. The main padding (`pb-32`) only clears them at the very bottom.
- **Why it matters:** Casey's thumb zone is exactly where the content gets hidden, and two round buttons stacked together read as one cluster, which makes it easy to tap Atlas when you meant capture.
- **Fix:** On phones, move capture into the tab bar as a centre "+" tab (it is the product's primary action) and keep only the Atlas orb floating, or merge them into one FAB with a long-press/secondary for Atlas. Add right padding to card actions under the FAB, or hide the FABs while scrolling down.
- **Suggested command:** `mobile-native` (then `/impeccable adapt`)

### Persona Red Flags

**Casey (distracted mobile user, one thumb, between lectures)**
- The first screen on a 390px phone is the briefing plus an empty Schedule card. Top tasks starts at ~800px and Process inbox at ~1,450px, so the core daily action is two scrolls away.
- The completion circles are 20×20px (`TaskItem.tsx:30`), which is the main tap on this screen. Habit chips are 30px tall and the card links ("All tasks →", "Planner →", "Habits →") are 16px tall.
- Tapping a habit chip by mistake logs it and the chip disappears, with no undo toast (`Dashboard.tsx:222`; `useToggleHabitLog` only toasts on error).
- The FAB pair covers content right where the thumb rests, and the top bar spends its space on a theme toggle rather than capture.

**Alex (power user, keyboard-first)**
- Good: N, ⌘K, ⌘J, and the palette's "Add task: '…'" fallback.
- Tabbing through Top tasks costs 2 stops per row, one of them a dead "Open task" button. There is no shortcut to complete the focused task or to jump to the inbox.
- The palette options are real `<button>`s in the tab order, so Tab leaves the combobox and walks the list, then out of the dialog (no focus trap). Escape doesn't return focus to the trigger (`CommandPalette.tsx:96-163`; verified live: focus landed on an unlabelled button).

**Sam (screen reader / keyboard-dependent)**
- Toasts have no `role="status"`/`aria-live` (`useToast.tsx:44`). "Completed 'Finish the stats problem set'" and its Undo are never announced, and the Undo disappears after 6s.
- The sidebar inbox badge puts `aria-label` on a plain `<span>` (`Sidebar.tsx:62-64`). That name is generally ignored, so the link reads "Brain Dump4". The mobile badge (`MobileNav.tsx:28`) has no label at all.
- `.faint` small-caps labels ("FOCUS ON", "HEADS UP") and "from note" are slate-500 on the dark card ≈3.8:1, which fails AA for 11–12px text.

### Cognitive Load

Checklist failures (3, so moderate):
- **Visual hierarchy:** every card has identical weight. The one primary button (Process inbox) sits in card 5, and the gradient greeting is the loudest element on the screen while carrying the least information.
- **Single focus:** briefing, schedule, tasks, habits, inbox and mood all ask for attention at once, with four different accent hues on the card icons (blue, violet, orange, pink) that mean nothing.
- **Chunking:** a Top tasks row carries up to 5 chips (due, tag, priority, scheduled time, "from note"), each in a different colour, and the briefing duplicates the task list in prose.

Passing: grouping (cards), working memory (everything needed is on screen), progressive disclosure (sections link out), one thing at a time (no multi-step flow here).

Decision points with >4 options:
- **Mood picker:** 5 options. That is acceptable for a Likert scale, but labels are hidden at `size="sm"` (`MoodPicker.tsx:23`), so they are emoji-only.
- **Sidebar:** 10 top-level destinations plus Settings and Collapse, in a flat list with no grouping. Calendars/Habits/Goals/Focus/Mood/Weekly Review could be grouped under a "Routines/Review" divider.
- **More sheet:** 7 tiles with paragraph blurbs. It's scannable but long, and the Calendars blurb wraps to 4 lines.
- **Command palette (empty query):** about 20 commands across 4 groups. That's acceptable for a palette.

### Minor Observations

- "Top tasks" shows 4 rows (3 starred + 1 overdue) under a name that implies the top 3, and nothing says the overdue one was added because it's due (`Dashboard.tsx:196`).
- The Inbox card shows 3 of 4 notes with no "+1 more" (`Dashboard.tsx:245`). Bullets are typed characters ("• ") rather than list markers, so they truncate with the text.
- The briefing has no "written at 8:12" stamp, so "4 notes waiting in your inbox" stays the same after you process them (stale AI text next to live numbers).
- The "Now" pill in Schedule uses `text-[10px]` (`Dashboard.tsx:176`), and DESIGN.md says no 10px text.
- The all-day filter compares `e.start.slice(0,10)` with the local `today` (`Dashboard.tsx:87`), which can be off by one day for UTC-stamped all-day events in far time zones.
- The Getting started progress bar animates `width` (`Checklist.tsx:54`, `transition-all`).
- The mood row is capped at `max-w-md` inside a full-width card on desktop, which leaves a 2/3 empty band.
- The phone top bar shows logo, search, theme toggle and avatar. The theme toggle doesn't need a prime top-bar slot, and capture does.
- The skip link becomes a white-on-white pill in light mode with no border (`AppShell.tsx:104`), which is fine, but it is the only element using `bg-white` regardless of theme, so in dark it's a bright flash.

## Audit

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | Toasts (incl. the only Undo for completing a task) are never announced (no live region). There are 5 AA contrast failures per dark scan, a dead "Open task" button in the tab order, and the command palette has no focus trap or focus return. |
| 2 | Performance | 3 | Nothing janky on this surface, but `backdrop-blur-xl` sits on every card, the top bar, the sidebar, the tab bar and toasts, over a `background-attachment: fixed` multi-gradient body (`index.css:23-27, 53`), which forces repaint on scroll on low-end phones. |
| 3 | Theming | 2 | Dark and light both work. There is no token layer, though: raw palette classes and hex values (`#08070f`, `#13111f`, `#0b0a14`, `#15121f`, `#0b1220`) are repeated across TopBar, MobileNav, CommandPalette, Modal and AtlasOrb, so the planned neutral re-skin means touching every file. |
| 4 | Responsive Design | 2 | Cards overflow the right gutter at 390px (grid min-content bug). The primary tap targets are 20px (completion circles) and 16px (card links), and the FAB pair covers content on phones. The tab bar respects the safe area. |
| 5 | Implementation Integrity | 2 | Several verified issues: a dead interactive control, query errors rendered as empty data, and systemic violet/gradient/glow drift against the confirmed direction. Otherwise the components are shared and coherent (Card, CardTitle, AiButton, TaskItem). |
| **Total** | | **11/20** | **Acceptable** |

**Implementation Integrity verdict: fail (borderline).** The component vocabulary is shared and consistent, and the data on screen is real (no fabricated numbers). It fails on two counts. The dashboard can present load failures as true zeros, which contradicts the "honest numbers" commitment. And one interactive element (the task title button) is a placebo. The visual layer is systemic violet/gradient drift, already slated for replacement.

### Detector findings

Counts by rule for `dashboard` (dark-desktop / dark-phone / light-desktop / light-phone): 19 / 18 / 11 / 9.

| Rule | DD | DP | LD | LP | Verdict |
|------|----|----|----|----|---------|
| low-contrast | 5 | 5 | 4 | 3 | **Real (all).** See the breakdown below. |
| ai-color-palette | 4 | 4 | 4 | 4 | **Mixed.** Violet logo gradient (`Logo.tsx:6`), violet→pink avatar (`TopBar.tsx:70`) and "violet accents on body" are real and already slated for removal. **The cyan gradient on the Atlas orb (`AtlasOrb.tsx:8`, `span.absolute.inset-[18%]`) is a false positive**: cyan is reserved for Atlas by design. |
| gradient-text | 2 | 1 | 2 | 1 | **Real, slated.** The `h1.gradient-text` greeting (`Dashboard.tsx:100`) and the sidebar wordmark (`Logo.tsx`). This breaks the No-Ornament Type Rule. |
| dark-glow | 3 | 3 | – | – | **Mostly real.** The `.btn-primary` violet glow on "Process inbox" (`index.css:80`) and the capture FAB's `shadow-violet-900/30` (`AppShell.tsx:129`) are real. The Atlas orb's `shadow-cyan-900/30` (`AtlasOrb.tsx:18`) is **borderline**: the hue is legitimate (Atlas), but the "no glows outside the HUD" direction still means it should become a neutral shallow shadow. |
| nested-cards | 4 | 4 | – | – | **Real but low impact.** Each Top tasks `TaskItem` row is a bordered, filled card inside the glass Card (`TaskItem.tsx:26`). It only fires in dark mode because the light fill is near-identical. It adds visual noise; a flat list with dividers would read faster. |
| overused-font | 1 | 1 | 1 | 1 | **False positive.** DESIGN.md and operate.md both endorse one workhorse sans (Inter) for Operate surfaces. |

Low-contrast breakdown (verified against source):
- `p.faint` "FOCUS ON" / "HEADS UP": #64748b on #14131b = **3.9:1**, 12px. `.faint` is `slate-500` in both themes (`index.css:66-68`). Fails AA (1.4.3).
- `span.faint` "from note" in TaskItem: #64748b on #1d1c24 = **3.5:1**, 11px (`TaskItem.tsx:61`). Fails.
- "Process inbox" `.btn-primary`: white on the gradient's blue end #457bf5 = **3.9:1**, 14px semibold. Fails (both themes).
- Avatar initial "M": white on the violet→pink gradient #cc4fb7 = **3.9:1**, 14px bold (`TopBar.tsx:70`). Fails, minor (decorative initial, but it is the account button's only visible text).
- Light theme "High" priority chip: #e11d48 on #fce1e6 = **3.8:1** (`TaskChips.tsx:10`, `text-rose-600`). Fails. The "Medium" chip is **4.45:1** (`TaskChips.tsx:15`, `text-amber-700`), which fails by a hair.

The detector caught things the critique pass under-weighted: the light-theme priority-chip contrast, the avatar initial and the Process inbox button's contrast on its blue end. It did **not** catch the phone grid overflow, the dead "Open task" button, the missing toast live region, the palette focus handling, the 20px touch targets, or the errors-as-empty states. Those come only from source and live probing.

Source scan (`src_scan_all`, the entries touching this surface): `index.css:60-61` gradient-text plus the violet gradient, `index.css:79` the violet `.btn-primary` gradient, `Logo.tsx:6` and `TopBar.tsx:70` violet gradients. The `VoiceHud.tsx:438` grid background is out of scope here and intentional (the HUD is the showpiece).

### Findings by severity

**[P1] Toasts are not announced and their Undo times out**
- **Location:** `src/hooks/useToast.tsx:44-67` (container has no `role="status"`/`aria-live`); timers at `useToast.tsx:36`.
- **Category:** Accessibility
- **Impact:** Completing a task from the dashboard shows "Completed '…'" with Undo, which is the only recovery path. Screen-reader users never hear it, and keyboard users can't reach Undo before it auto-dismisses after 6s (3s for plain toasts). Hovering or focusing doesn't pause it.
- **WCAG:** 4.1.3 Status Messages (AA), 2.2.1 Timing Adjustable (A).
- **Recommendation:** Wrap the stack in `role="status" aria-live="polite"` (use `role="alert"` for errors). Pause the timer on hover/focus-within, give actionable toasts at least 10s, and move focus to nothing (announce only).
- **Suggested command:** `/impeccable harden`

**[P1] Text contrast failures on the dashboard (both themes)**
- **Location:** `src/index.css:66-68` (`.faint` = slate-500 in dark), `src/components/tasks/TaskItem.tsx:61`, `src/index.css:78-81` (`.btn-primary` gradient), `src/components/layout/TopBar.tsx:70`, `src/components/tasks/TaskChips.tsx:10,15`.
- **Category:** Accessibility
- **Impact:** Section labels, "from note" provenance, the primary "Process inbox" CTA and light-mode priority chips fall to 3.5–3.9:1.
- **WCAG:** 1.4.3 Contrast (Minimum).
- **Recommendation:** Make `.faint` `dark:text-slate-400` (≈6.9:1) and use `rose-700`/`amber-800` on light chips. The CTA failure goes away with the planned solid near-white primary (dark text on white is ~17:1).
- **Suggested command:** `/impeccable colorize`

**[P1] Phone: dashboard grid overflows its gutter (min-content from truncated inbox rows)**
- **Location:** `src/pages/app/Dashboard.tsx:109` (grid), `:246` (`li.truncate`); `src/components/ui/Card.tsx:16`.
- **Category:** Responsive
- **Impact:** At 390px every card is 375px in a 358px box, so the right gutter is gone. A long note causes horizontal scroll.
- **WCAG:** 1.4.10 Reflow (AA) at the worst case.
- **Recommendation:** Use `grid-cols-[minmax(0,1fr)] lg:grid-cols-2`, or `min-w-0` on Card.
- **Suggested command:** `/impeccable adapt`

**[P1] Placebo "Open task" button on each Top tasks row**
- **Location:** `src/pages/app/Dashboard.tsx:198` → `src/components/tasks/TaskItem.tsx:37`.
- **Category:** Implementation Integrity / Accessibility
- **Impact:** 4 focusable buttons named "Open task …" that do nothing (verified live).
- **WCAG:** 4.1.2 Name, Role, Value (misleading role/name).
- **Recommendation:** Wire `onOpen`, or render a non-interactive element when no handler is given.
- **Suggested command:** `/impeccable harden`

**[P1] Query errors render as empty/zero data**
- **Location:** `src/pages/app/Dashboard.tsx:39-45, 64-67, 104, 192-256`; `src/components/layout/Sidebar.tsx:11-14`.
- **Category:** Implementation Integrity
- **Impact:** A failed fetch tells the user they have 0 tasks, an empty inbox and no habits, which breaches the honest-numbers commitment.
- **Recommendation:** Add per-card `isError` → `ErrorState` with retry (`States.tsx:19`), and show "—" in the header sentence.
- **Suggested command:** `/impeccable harden`

**[P2] Undersized touch targets for the dashboard's main actions**
- **Location:** `src/components/tasks/TaskItem.tsx:30` (20×20 completion circle); card header links in `Dashboard.tsx:153,189,210,231,259` (≈16px tall); habit chips `Dashboard.tsx:222` (30px); the `AiButton size="sm"` Refresh (30px).
- **Category:** Responsive / Accessibility
- **Impact:** These pass WCAG 2.5.8 via the spacing exception (measured), but they're far below 44px for Casey's thumb on the screen's most frequent tap.
- **WCAG:** 2.5.8 passes; 2.5.5 (AAA) fails.
- **Recommendation:** Give the circle a 44px hit area via padding or `::before` while keeping the 20px visual, pad the card links to `py-2 -my-2`, and make the chips `min-h-11` on touch.
- **Suggested command:** `mobile-native`

**[P2] Command palette: no focus trap, no focus return, options in the tab order**
- **Location:** `src/components/layout/CommandPalette.tsx:96-163`.
- **Category:** Accessibility
- **Impact:**
  - Tab walks the ~20 option `<button>`s and then out of the modal into the page behind it.
  - Closing leaves focus on an unrelated element (verified: an unlabelled button).
  - Group headers aren't exposed as groups.
  - It doesn't use the shared `Modal` focus logic.
- **WCAG:** 2.4.3 Focus Order, 2.1.2 (soft trap expected for `aria-modal`).
- **Recommendation:**
  - Make the options `tabIndex={-1}` (they're driven by `aria-activedescendant` already) and trap Tab in the input.
  - Restore the previously focused element on close.
  - Wrap each group in `role="group"` with `aria-labelledby`.
- **Suggested command:** `/impeccable harden`

**[P2] Violet / gradient / glow / glass drift across shell and dashboard**
- **Location:**
  - `src/index.css:23-27` (body washes), `:53` (glass blur), `:59-62` (gradient-text), `:78-81` (gradient + glow primary);
  - `src/components/layout/AppShell.tsx:129` (violet FAB + glow);
  - `src/components/layout/Sidebar.tsx:41,63`;
  - `src/components/layout/MobileNav.tsx:28,45`;
  - `src/components/layout/TopBar.tsx:70`;
  - `src/hooks/useToast.tsx:53` (violet toast glow);
  - `src/components/onboarding/Checklist.tsx:54`;
  - `src/pages/app/Dashboard.tsx:100,169,176,189,231`.
- **Category:** Theming / Implementation Integrity
- **Impact:** One hue carries seven meanings, and the screen reads as an "AI SaaS" template rather than The Clear Head. The blur on every surface also costs paint on phones.
- **Recommendation:** These are foundations-phase changes, already slated:
  - neutral near-white primary;
  - neutral active nav and badges;
  - solid card fills with one shallow shadow;
  - untinted near-black body with no washes;
  - card-title icons in neutral ink (colour only where it means priority/status/Atlas).
- **Suggested command:** `/impeccable quieter`

**[P2] No colour token layer; hard-coded dark surfaces**
- **Location:** `TopBar.tsx:19,74` (`#08070f`, `#15121f`), `MobileNav.tsx:22` (`#0b0a14`), `CommandPalette.tsx:106` and `Modal.tsx:63` (`#13111f`), `AtlasOrb.tsx:18` (`#0b1220`), `index.css:21,30`.
- **Category:** Theming
- **Impact:** Five near-identical "dark panel" values. The neutral re-skin and any future theme tweak need edits in every file, and drift is guaranteed.
- **Recommendation:** Introduce CSS variables (`--surface-0/1/2`, `--ink`, `--ink-muted`, `--accent`, `--atlas`) in `index.css`, map them in `tailwind.config.js`, and replace the literals.
- **Suggested command:** `/impeccable extract`

**[P2] Habit chip: one tap logs it, with no undo or visible done state**
- **Location:** `src/pages/app/Dashboard.tsx:220-226`; `src/hooks/data/habits.ts:62-72`.
- **Category:** Implementation Integrity (error prevention)
- **Impact:** A mis-tap removes the chip and increments the count. Recovering means going to the Habits page.
- **Recommendation:** Keep done habits visible as checked chips (`aria-pressed`) that toggle back, or show the same Undo toast tasks use.
- **Suggested command:** `/impeccable harden`

**[P3] Motion ignores reduced-motion in toasts; card fade-in replays on every visit**
- **Location:** `src/hooks/useToast.tsx:49-52` (Framer runs in JS, so the CSS reduced-motion rule at `index.css:32-41` doesn't reach it, and there's no `MotionConfig reducedMotion="user"` anywhere); `src/components/ui/Card.tsx:16` + `tailwind.config.js:12-15`.
- **Category:** Accessibility / Performance
- **Impact:** A small rise and scale on toasts for reduced-motion users. All six cards rise 4px every time the dashboard mounts, which reads as "loading" rather than "ready".
- **WCAG:** 2.3.3 (AAA), advisory.
- **Recommendation:** Add `<MotionConfig reducedMotion="user">` at the root, and drop `animate-fade-in` from in-app Cards (keep it for overlays).
- **Suggested command:** `remove-animations`

**[P3] Inbox badges have no reliable accessible name**
- **Location:** `src/components/layout/Sidebar.tsx:62-64` (`aria-label` on a generic `<span>`), `src/components/layout/MobileNav.tsx:28` (no label).
- **Category:** Accessibility
- **Impact:** The link reads as "Brain Dump4" or "Brain Dump 4", with no "in inbox".
- **Recommendation:** Render `<span className="sr-only">, 4 notes in inbox</span>` and make the visible number `aria-hidden`.
- **Suggested command:** `/impeccable harden`

**[P3] Stale AI briefing has no timestamp**
- **Location:** `src/pages/app/Dashboard.tsx:54-60, 124-141`.
- **Category:** Implementation Integrity
- **Impact:** "4 notes waiting in your inbox" persists after processing, right next to a live "Inbox · 0".
- **Recommendation:** Show "Written at 08:12 from your data" under the headline, and dim it when the counts have changed since.
- **Suggested command:** `/impeccable clarify`

**[P3] Task rows are cards inside a card**
- **Location:** `src/components/tasks/TaskItem.tsx:26` inside `Dashboard.tsx:188`.
- **Category:** Implementation Integrity
- **Impact:** Double borders and fills add visual noise (detector nested-cards ×4 in dark).
- **Recommendation:** On the dashboard, render rows flat with hairline dividers (a `variant="flat"` prop on TaskItem).
- **Suggested command:** `/impeccable distill`

### Positive findings

- **Dialogs done right in `Modal`** (`Modal.tsx:19-50`): focus moves in, Tab is trapped, Escape closes and focus returns. The More sheet uses it and becomes a bottom sheet on phones (`items-end`, `rounded-t-3xl`).
- **Skip link, landmarks and headings:** "Skip to content" → `#main`, `aside[aria-label="Main navigation"]`, one `h1` then `h2` per card (verified live). The mobile nav pads for `env(safe-area-inset-bottom)` (`MobileNav.tsx:22`).
- **Mood picker semantics:** `role="radiogroup"` with `role="radio"`/`aria-checked` and labels (`MoodPicker.tsx:7-14`), with 42×44 targets.
- **Optimistic mutations with rollback and an error toast** (`hooks/data/cache.ts:9-33`), plus Undo on task completion (`hooks/data/tasks.ts:78-91`).
- **Keyboard shortcuts are scoped:** N is ignored while typing or when a dialog is open (`AppShell.tsx:59`).
- **Heavy panels are lazy-loaded** (AtlasPanel, VoiceHud, Tour: `AppShell.tsx:17-19`), and the briefing never triggers AI on load.

## Motion on this surface

| # | Animation | Where | Trigger | Duration / easing | Earns its place? |
|---|-----------|-------|---------|-------------------|------------------|
| 1 | Card fade + 4px rise | `Card.tsx:16`, keyframes `tailwind.config.js:12-15` | Every Card mount (all 6–7 dashboard cards at once, on every visit) | 250ms ease-out | **No.** It is a page-load sequence on an Operate surface. Remove from in-app cards. |
| 2 | Toast enter/exit + `layout` | `useToast.tsx:47-52` | Any toast (task complete, errors, AI) | Framer default spring; y 20→0, scale .95→1; exit y 10, scale .95 | **Yes, but tune it:** it conveys arrival. Use opacity + 8px, ~180ms ease-out, and honour reduced motion via `MotionConfig`. |
| 3 | Press scale | `.btn` `index.css:75-76` (`active:scale-[0.97]`) | Pointer down on any `.btn` (Process inbox, Refresh) | Tailwind `transition` 150ms | **Yes.** It is tactile feedback and matches "tactile, confident". |
| 4 | Sidebar width | `Sidebar.tsx:48` (`transition-[width]`) | Collapse/expand | 150ms default | **Marginal.** It animates layout (main column reflows each frame). Keep it short or snap. |
| 5 | Getting started progress bar | `Checklist.tsx:54` (`transition-all` on width) | An item completes | 150ms | **Yes for the state change**, but use `transform: scaleX` rather than `width`. |
| 6 | Palette / account menu / modal fade-in | `CommandPalette.tsx:106`, `TopBar.tsx:74`, `Modal.tsx:63` | Open | 250ms ease-out | **Palette: no.** It is keyboard-invoked (⌘K) and should appear instantly or within ~120ms. Menu and modal: fine at 150–200ms. |
| 7 | Hover colour/border transitions | Nav links `Sidebar.tsx:38`, capture field `TopBar.tsx:25`, More tiles `MobileNav.tsx:45`, TaskItem `TaskItem.tsx:26`, FAB `AppShell.tsx:129`, orb `AtlasOrb.tsx:18`, mood `MoodPicker.tsx:17` | Hover | 150ms | **Yes.** It is cheap state feedback. |
| 8 | Orb glow pulse | `AtlasOrb.tsx:7` (`animate-pulse` only when `active`) | Atlas working (not on the floating button) | 2s infinite | **Yes when active.** It signals Atlas is busy and is cyan-only. Static at rest is correct. |
| 9 | Spinners / skeleton pulse | `Ai.tsx:51` (Loader2 spin), `States.tsx:36,43` | Loading | spin 1s linear / pulse 2s | **Yes.** It shows loading state. |
| 10 | Global reduced-motion kill | `index.css:32-41` | `prefers-reduced-motion: reduce` | 0.01ms | Works for CSS. It misses Framer (toasts), and the spinner's state still reads as a static icon, which is acceptable. |

## Machine-readable summary

```json
{"surface":"dashboard","critique_total":25,"critique_max":40,"na_heuristics":[],"audit_total":11,
 "issues":[
  {"id":"dashboard-1","severity":"P1","title":"Phone grid overflows right gutter (truncated inbox rows set column min-content)","fix":"Use grid-cols-[minmax(0,1fr)] lg:grid-cols-2 or min-w-0 on Card; re-test with 90-char notes","command":"/impeccable adapt","files":["src/pages/app/Dashboard.tsx:109","src/pages/app/Dashboard.tsx:246","src/components/ui/Card.tsx:16"],"source":"critique"},
  {"id":"dashboard-2","severity":"P1","title":"Dead 'Open task' button on every Top tasks row","fix":"Pass onOpen to open the task drawer, or render a non-interactive element in TaskItem when onOpen is undefined","command":"/impeccable harden","files":["src/pages/app/Dashboard.tsx:198","src/components/tasks/TaskItem.tsx:37"],"source":"both"},
  {"id":"dashboard-3","severity":"P1","title":"Query errors shown as empty/zero data (honest-numbers breach)","fix":"Branch on isError per card to ErrorState with retry; show '—' in header counts and sidebar badge while errored","command":"/impeccable harden","files":["src/pages/app/Dashboard.tsx:64","src/pages/app/Dashboard.tsx:104","src/pages/app/Dashboard.tsx:192","src/components/layout/Sidebar.tsx:11"],"source":"both"},
  {"id":"dashboard-4","severity":"P1","title":"Toasts not announced; Undo auto-dismisses without pause","fix":"Add role=status aria-live=polite to the toast stack, pause timers on hover/focus, 10s for actionable toasts","command":"/impeccable harden","files":["src/hooks/useToast.tsx:44","src/hooks/useToast.tsx:36"],"source":"audit"},
  {"id":"dashboard-5","severity":"P1","title":"AA contrast failures: .faint labels, 'from note', Process inbox CTA, avatar initial, light priority chips","fix":"dark:text-slate-400 for .faint; rose-700/amber-800 on light chips; solid near-white primary fixes CTA","command":"/impeccable colorize","files":["src/index.css:66","src/components/tasks/TaskItem.tsx:61","src/index.css:78","src/components/layout/TopBar.tsx:70","src/components/tasks/TaskChips.tsx:10"],"source":"both"},
  {"id":"dashboard-6","severity":"P2","title":"Hierarchy inverted: optional AI briefing is the hero, Inbox/capture is fifth","fix":"Lead with Top tasks + Inbox strip with inline capture; collapse briefing to a one-line ✨ row; size cards to content","command":"/impeccable layout","files":["src/pages/app/Dashboard.tsx:109","src/pages/app/Dashboard.tsx:112","src/pages/app/Dashboard.tsx:230"],"source":"critique"},
  {"id":"dashboard-7","severity":"P2","title":"Violet/gradient/glow/glass drift across shell and dashboard","fix":"Neutral near-white primary, neutral nav/badges, solid fills with one shallow shadow, untinted body, solid greeting","command":"/impeccable quieter","files":["src/index.css:23","src/index.css:59","src/index.css:78","src/components/layout/AppShell.tsx:129","src/components/layout/Sidebar.tsx:41","src/hooks/useToast.tsx:53","src/pages/app/Dashboard.tsx:100"],"source":"both"},
  {"id":"dashboard-8","severity":"P2","title":"Phone: stacked capture + Atlas FABs cover content in the thumb zone","fix":"Move capture into the tab bar as a centre + tab and keep only the Atlas orb floating (or merge); pad content under FAB","command":"mobile-native","files":["src/components/layout/AppShell.tsx:126","src/components/layout/MobileNav.tsx:22"],"source":"critique"},
  {"id":"dashboard-9","severity":"P2","title":"Undersized touch targets: 20px completion circle, 16px card links, 30px chips","fix":"44px hit areas via padding/pseudo-element keeping visual size; min-h-11 chips on touch","command":"mobile-native","files":["src/components/tasks/TaskItem.tsx:30","src/pages/app/Dashboard.tsx:189","src/pages/app/Dashboard.tsx:222"],"source":"both"},
  {"id":"dashboard-10","severity":"P2","title":"Habit chip logs on one tap with no undo or done state","fix":"Keep done habits as aria-pressed toggles or show an Undo toast like tasks","command":"/impeccable harden","files":["src/pages/app/Dashboard.tsx:222","src/hooks/data/habits.ts:62"],"source":"critique"},
  {"id":"dashboard-11","severity":"P2","title":"Command palette lacks focus trap/return; options are tab stops","fix":"tabIndex=-1 on options (activedescendant), trap Tab, restore previous focus on close, role=group per section","command":"/impeccable harden","files":["src/components/layout/CommandPalette.tsx:96","src/components/layout/CommandPalette.tsx:142"],"source":"audit"},
  {"id":"dashboard-12","severity":"P2","title":"No colour token layer; five hard-coded dark surface hexes","fix":"Define surface/ink/accent/atlas CSS variables in index.css, map in tailwind.config.js, replace literals","command":"/impeccable extract","files":["src/components/layout/TopBar.tsx:19","src/components/layout/MobileNav.tsx:22","src/components/layout/CommandPalette.tsx:106","src/components/ui/Modal.tsx:63","src/components/atlas/AtlasOrb.tsx:18"],"source":"audit"},
  {"id":"dashboard-13","severity":"P3","title":"Toast motion ignores reduced-motion; card fade-in replays on every mount","fix":"MotionConfig reducedMotion='user' at root; remove animate-fade-in from in-app Cards; make palette appear instantly","command":"remove-animations","files":["src/hooks/useToast.tsx:49","src/components/ui/Card.tsx:16","src/components/layout/CommandPalette.tsx:106"],"source":"audit"},
  {"id":"dashboard-14","severity":"P3","title":"Inbox badges lack a reliable accessible name","fix":"sr-only ', N notes in inbox' text; aria-hidden on visible number","command":"/impeccable harden","files":["src/components/layout/Sidebar.tsx:62","src/components/layout/MobileNav.tsx:28"],"source":"both"},
  {"id":"dashboard-15","severity":"P3","title":"Cached AI briefing has no timestamp and can contradict live counts","fix":"Show 'Written at HH:MM from your data' and dim when counts changed","command":"/impeccable clarify","files":["src/pages/app/Dashboard.tsx:124"],"source":"critique"},
  {"id":"dashboard-16","severity":"P3","title":"Task rows are cards nested inside the Top tasks card","fix":"Flat TaskItem variant with hairline dividers on the dashboard","command":"/impeccable distill","files":["src/components/tasks/TaskItem.tsx:26"],"source":"audit"}
 ]}
```
