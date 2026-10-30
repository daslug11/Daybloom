# Focus: critique & audit (Phase 1 baseline)

Method: design review (sub-agent, screenshots + source + live app) → then detector evidence (Phase 0 CDP scans, both themes, desktop + phone)

Evidence: `test-results/visual/phase0-before/{dark,light}-{desktop,phone}/focus.jpg`; source `src/pages/app/Focus.tsx`, `src/components/focus/TimerDisplay.tsx`, `src/components/layout/FocusOverlay.tsx`, `src/hooks/useTimer.tsx`, `src/components/ui/ProgressRing.tsx`, `src/hooks/data/focus.ts` (+ `Card.tsx`, `PageHeader.tsx`, `index.css`, `tailwind.config.js`); live probe with Playwright at 1440×900 as Maya. The probe started, paused and reset the timer and changed lengths, which only touched `localStorage`. No focus session was logged and no app data changed.

## Critique

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | The tab title counts down (`useTimer.tsx:91-100`), but the app shell has no timer indicator once you leave /focus. When a block ends in a background tab, the title goes back to plain "Daybloom", so the only signal disappears. The chart's per-day minutes appear only in a mouse `title` tooltip. |
| 2 | Match System / Real World | 3 | The copy is plain and good ("Working on", "Only finished focus blocks are logged."). "Classic · 25/5" assumes you know that 25/5 means focus/break minutes. |
| 3 | User Control and Freedom | 2 | Esc and a labelled button close full screen. Reset, Skip and the Focus/Break tabs throw away the elapsed block instantly, with no confirm and no undo. |
| 4 | Consistency and Standards | 2 | The Focus/Break control is marked up as `role="tablist"` but behaves as a destructive action. Presets are violet chips, while the overlay uses its own hard-coded tint `#06050b` instead of the theme's surface. |
| 5 | Error Prevention | 1 | Confirmed live: the number inputs can't be cleared (backspace gives "1", then typing 45 gives "145"). Changing the length while paused resets a block in progress (24:57 → 15:00). Mode tabs stay enabled while the timer runs. |
| 6 | Recognition Rather Than Recall | 3 | Presets show their numbers, the chosen task shows inside the ring ("On: …"), and starred top-3 tasks sort first with a ⭐. |
| 7 | Flexibility and Efficiency | 2 | The command palette has Start/Pause, and there are presets plus custom lengths. There's no Space to start or pause on the page or in the overlay, and no shortcut to enter full screen. |
| 8 | Aesthetic and Minimalist Design | 2 | The layout is calm, but violet carries the start button (with a glow), the active mode tab, the chips and the bars, and the ring is a violet→blue→pink gradient. All of these go against the confirmed direction. On desktop the timer card is a large empty area. |
| 9 | Error Recovery | 2 | A failed write shows "Your focus session could not be logged." (`focus.ts:32`), but the block isn't kept for retry. The success toast says "25 minutes logged" before the write is confirmed. |
| 10 | Help and Documentation | 3 | The header explains Pomodoro in one sentence, "Pause the timer to change lengths." appears while running, and the logging rule is stated. |
| **Total** | | **22/40** | **Acceptable** |

### Design Specificity Verdict

The structure is a generic Pomodoro screen: task select, segmented mode, ring, three round buttons, a settings card and a seven-bar chart. It could ship in any timer app unchanged, and in an Operate surface that familiarity is mostly fine. What makes it Daybloom is the link to tasks: starred top-3 tasks first, "On: <task>", and minutes logged against the task. Two weaknesses work against it. First, the page shows nothing about the task beyond its title (no due date, no steps, no "open task"), so the link feels thin. Second, the stats card doesn't live up to the "honest numbers" commitment: it shows bars without numbers, an unlabelled per-task list, and minutes that can be silently lost or miscounted (see issue 1). Visually, the violet glow on the start button and the gradient ring are left over from the old brand. They are exactly what "The Clear Head" direction removes. A neutral near-white ring on near-black would make this the calmest screen in the app, which is what a focus screen should be.

### What's Working

1. **Wall-clock timing.** `useTimer.tsx:82-86` computes the remaining time from an absolute `endAt`, not by counting ticks. Background-tab throttling or a sleeping laptop therefore can't drift the clock, and the tab title (`useTimer.tsx:97-99`, confirmed live as "24:57 Focus · Daybloom") is a good low-cost status line.
2. **Plain, upfront copy about what gets counted.** The header says minutes are logged against the task when a block finishes. The stats card says "Only finished focus blocks are logged." The running hint says "Pause the timer to change lengths." This is the product's "say how it was calculated" principle done in words.
3. **The control row is sized well.** Reset and Skip are 44×44 (measured), Start is 56×56, each has an accurate `aria-label` that changes with state ("Skip to break" / "Skip to focus", "Pause timer"), and the clock is `aria-live="off"` so screen readers aren't flooded every second.

### Priority Issues

**[P1] Focus minutes are silently lost or miscounted (honest numbers)**
- *What:* Skip (`useTimer.tsx:126-132`), Reset (`:121-125`) and the Focus/Break tabs (`:133-138`, `TimerDisplay.tsx:26-36`) all throw away the elapsed block with no confirmation or undo. A user 24 minutes in who taps "Skip to break" gets 0 minutes. Changing the length while paused (allowed, `Focus.tsx:80-96`) runs the `[total]` effect (`useTimer.tsx:61-63`), which resets `remaining` to the new full length but keeps the old `startedAt`. Confirmed live: 24:57 became 15:00 after choosing Short. When that block finishes, `minutes: work` (`:69`) logs the new length, not the time actually worked, with a start time from the earlier run. The task can also be changed mid-block (`Focus.tsx:57`), and then the whole block is credited to the task selected at the end.
- *Why it matters:* PRODUCT.md commits to honest numbers. "Focus time" and the per-task totals can be wrong in both directions, with nothing on screen to show it.
- *Fix:* Track the actual running time: add to `elapsedMs` on each pause, and log `Math.round(elapsed/60000)`. While a block is in progress (`startedAt` set), lock the Length inputs and presets as well as the mode tabs, not only while `running`. Before Skip/Reset/mode change with more than 1 minute elapsed, show an inline choice: "Log 24 min and skip" / "Discard". After a discard, show an Undo toast. Lock the task select during a block, or split the minutes when it changes.
- *Suggested command:* `/impeccable harden`

**[P1] Length inputs can't be edited normally**
- *What:* `onChange={(e) => timer.setDurations(Number(e.target.value) || 1, …)}` (`Focus.tsx:92`, `:96`) forces an empty field back to 1 immediately. Live: clearing "25" leaves "1", and typing "45" then gives "145". Values above the max are silently clamped (`useTimer.tsx:140`).
- *Why it matters:* Custom lengths are a headline feature. Most people edit by select-all-and-type or backspace-and-type, and both produce the wrong number with no message.
- *Fix:* Keep a local string draft and commit on blur/Enter after clamping. If the value was out of range, say so inline ("Max 180 min"). Add `inputMode="numeric"` for phones.
- *Suggested command:* `/impeccable harden`

**[P1] Full-screen overlay claims to be modal but isn't (keyboard / screen reader)**
- *What:* `FocusOverlay.tsx:21` has `role="dialog" aria-modal="true"`, but focus is never moved into it. Live: after opening, focus stays on the hidden "Full screen" button. The next 7 Tab presses moved through background controls (presets, Capture, Ask Atlas) before focus reached the overlay. Closing with Esc sends focus to `<body>`, not back to the button that opened it.
- *Why it matters:* A keyboard user can't see where focus is. Screen readers are told the background is inert when it isn't. This is a WCAG 2.4.3 Focus Order / 2.4.7 failure.
- *Fix:* Reuse the focus handling in `Modal.tsx` (or `<dialog>.showModal()`): focus the Start/Pause button on open, trap Tab, make the app root `inert`, and return focus to the trigger on close. Handle Space as Start/Pause inside the overlay.
- *Suggested command:* `/impeccable harden`

**[P2] The "Focus time" chart doesn't show its numbers**
- *What:* Bars (`Focus.tsx:108-114`) have no values or scale. Minutes appear only in a mouse-only `title`. Day labels are 10px narrow weekdays ("F S S M T W T"), so the two T's and two S's can't be told apart, and today isn't marked. The `aria-label` lists "0, 0, 0, 25, 0, 50, 50" without days. The per-task list (`:116-125`) has no heading, covers only the last 7 days and only the top 5, and leaves out sessions with no task, so it won't add up to the 7-day total and nothing says why. A 0-minute day is drawn as a 3px bar (`Math.max(3, …)`), so it looks like a little time was logged.
- *Why it matters:* "Every number says how it was calculated." Today the chart shows only a shape.
- *Fix:* Print minutes above each bar that has any ("50m"), mark today (bold label), use 3-letter weekdays at 12px, and use a hairline baseline instead of a fake 3px bar. Write the aria-label as "Thu 50 min, …". Add a subheading "By task · last 7 days (top 5)" plus a final row "No task: 1h 15m".
- *Suggested command:* `/impeccable clarify`

**[P2] Violet and gradient emphasis everywhere, against the confirmed direction**
- *What:* Start button `bg-violet-600 … shadow-lg shadow-violet-900/30` (`TimerDisplay.tsx:52`). Active mode tab `bg-violet-600` (`:32`). Ring gradient `#a855f7 → #3b82f6 → #ec4899` (`ProgressRing.tsx:18-22`). Bars `bg-violet-500` (`Focus.tsx:111`). `chip-on` violet (`index.css:140`). Gradient page title (`PageHeader.tsx:40`). Overlay hard-coded to a violet-tinted near-black `bg-[#06050b]` (`FocusOverlay.tsx:21`).
- *Why it matters:* The focus screen should be the calmest in the app. Today it is the most violet.
- *Fix:* Make Start a solid near-white button with dark icon (dark) or near-black (light), with no glow. Make the ring a single solid foreground stroke on a 10% track, and the active mode tab a neutral raised segment. Use neutral bars, with today at full contrast and other days at 40%. Use the neutral near-black page token for the overlay.
- *Suggested command:* `/impeccable quieter`

**[P2] The timer goes invisible and loses work outside this page**
- *What:* `AppShell` has no running-timer indicator (no layout component reads `running`/`remaining`). On finish, `running=false` sets the title back to "Daybloom" (`useTimer.tsx:93-95`), and the toast lasts 3s (`useToast.tsx:36`). A block that ends in a background tab therefore leaves no trace. Timer state is plain React state, so a reload, a closed tab or a mobile browser discarding the tab loses the block entirely.
- *Why it matters:* Students switch apps constantly (Casey). An unlogged block means the numbers drift low with no explanation.
- *Fix:* Add a compact timer pill in the top bar (desktop) and above the tab bar (phone) while a block is running or paused, linking to /focus. Keep the title "✓ Focus done · Daybloom" until the user returns. Save `{mode, endAt, startedAt, elapsed, taskId}` to localStorage and restore it on load. A block that finished while away is logged with its real end time.
- *Suggested command:* `/impeccable harden`

### Persona Red Flags

**Casey (distracted mobile user):** On a 390px phone, Start sits mid-screen (y≈490 CSS px), and the Length card sits *below* the timer card and the full-width "Full screen" button. Changing the length means scrolling past the timer and back. The fixed "+" and Atlas orb overlap the right edge of the timer card next to Skip. If Casey switches to a messaging app and the browser discards the tab, the 25-minute block is gone with no record. The number inputs have no `inputMode`, and the clear-then-"1" bug is worse with a phone keypad.

**Sam (keyboard / screen reader):** The full-screen overlay leaves focus on the background and Tab moves through hidden page controls; after Esc, focus lands on `<body>`. The Focus/Break "tabs" have no tabpanel and no arrow-key handling, and pressing one silently resets the clock. The chart's aria-label gives seven numbers with no days. The day labels are 10px `slate-500` (`faint`) on near-black, about 4.0:1, which fails AA for small text. No live announcement happens when a block ends, apart from the 3s toast.

**Alex (power user):** There's no Space to start or pause, no key to enter full screen, and no way to start a block from a task row's keyboard flow except through Ctrl K → "Start focus timer". Typing a custom length is broken (see issue 2). "Skip" destroys work with no undo, so Alex learns not to trust the stats.

### Cognitive Load

Checklist failures (2, moderate):
- **Minimal choices:** the timer card shows 7 controls at once: task select, Focus tab, Break tab, Reset, Start, Skip, Full screen. Three of them (Reset, Skip, mode tab) destroy progress and look as harmless as the others.
- **Grouping:** the length settings that shape the timer are in a separate card. On desktop it's in the right column; on phone it's below the timer and the fold. Choosing a length and pressing Start are one decision split across two places.

Decision points with more than 4 options: the timer card (7). The Length card has 5 (3 presets + 2 inputs), which is acceptable because the inputs are a refinement.

### Minor Observations

- Preset chips wrap to two rows in the 320px desktop sidebar ("Short · 15/3" alone on row 2). They fit on one row on phone.
- On desktop, the 260px ring sits centred in a ~750px card with large empty sides. The left column could be narrower, or the stats could sit beside the ring.
- The empty state never says how to start. A user with no sessions sees "0m today · 0m in the last 7 days" and seven 3px stubs. "Finish a block and it appears here" would teach the loop.
- In the ring, "Ready" doesn't change to "Paused" when paused mid-block. Paused and fresh look the same apart from the time.
- If the selected task is completed elsewhere, it drops out of `open`. The `<select>` then visually falls back to "Nothing specific" while the ring still shows "On: <task>" (`Focus.tsx:24-25,57`).
- The "Working on" label uses the uppercase tracked `label` style, while the card titles ("Length", "Focus time") use sentence case. That's two heading styles on one screen.

## Audit

Opened the detector JSON only after the critique above was written. Extra live probes for this section: a 320×640 viewport, and the full-screen overlay at 844×390 (phone landscape).

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | The full-screen "dialog" doesn't move or trap focus, and focus returns to `<body>` on close. The `faint` text is 3.9:1 on dark cards, with 10px day labels. The Focus/Break control misuses `role="tablist"`. |
| 2 | Performance | 3 | Wall-clock timer. The 250ms interval sets state that only changes once a second (React bails out on equal values), but every `useTimer()` consumer re-renders each second because `value` is a new object every render (`useTimer.tsx:106`). Cards use `backdrop-blur-xl`. Fine in practice. |
| 3 | Theming | 2 | Hard-coded hex in the ring gradient (`ProgressRing.tsx:19-21`) and the overlay `bg-[#06050b]` (`FocusOverlay.tsx:21`). Raw `violet-*` utilities stand in for an emphasis token (`TimerDisplay.tsx:32,52`, `Focus.tsx:111`). Both themes render correctly. |
| 4 | Responsive Design | 2 | In phone landscape (844×390), the overlay content runs from y=-59 to 379 and the exit button sits at y=411–449, off-screen and impossible to scroll to. At 320px the fixed 260px ring pushes the card to the right edge (card 16→318px, 2px right gutter). Targets are good (44/56px). |
| 5 | Implementation Integrity | 2 | Logged minutes don't match minutes worked (the length change carries over `startedAt` and logs `work`; skip/reset discard). Leftover violet/gradient/glow brand on the calmest surface. |
| **Total** | | **11/20** | **Acceptable** |

**Implementation Integrity verdict: fail (narrowly).** The timer engine is sound (absolute `endAt`), but the logging layer doesn't record what happened. The visual layer still uses the old violet brand the owner has retired.

### Detector findings

38 findings across 4 scans (dark-desktop 12, dark-phone 11, light-desktop 8, light-phone 7).

| Rule | Count (dd/dp/ld/lp) | Element | Verdict |
|------|------|---------|---------|
| ai-color-palette, "Purple/violet gradient" | 2/2/2/2 = 8 | Logo tile `span.flex.h-9` (`Logo.tsx:6`) and avatar `span.flex.h-8` (`TopBar.tsx:70`) | Real, but **shell**, not Focus. Already slated for removal per DESIGN.md. |
| ai-color-palette, "Purple/violet accent colors" (body) | 1/1/1/1 = 4 | Page-wide: Start button, mode tab, chips, bars | **Real on this surface.** Covered by issue focus-7. |
| ai-color-palette, "Cyan gradient background" | 1/1/1/1 = 4 | Atlas orb core `span.absolute.inset-[18%]` (`AtlasOrb.tsx:8`) | **False positive.** Cyan is reserved for Atlas. |
| gradient-text | 2/1/2/1 = 6 | `h1.gradient-text` page title (`PageHeader.tsx:40` → `index.css:59-62`) ×4, sidebar wordmark ×2 | Real; shared component, already slated by the No-Ornament Type Rule. |
| low-contrast, `#64748b` on `#14131b` 3.9:1 | 1/1/0/0 = 2 | `p.faint.mt-3` "Only finished focus blocks are logged." (`Focus.tsx:126`) | **Real, dark only** (light passes). The same `faint` class is on the 10px day labels (`Focus.tsx:112`), the per-task minutes (`:121`) and the running hint (`:99`). The detector reported only one instance. |
| low-contrast, white on `#cc4fb7` 3.9:1 | 1/1/1/1 = 4 | Avatar initial (`TopBar.tsx:70`) | Real, shell. |
| dark-glow `#4c1d95` | 2/2/0/0 = 4 | Start button `button.flex.h-14` (`TimerDisplay.tsx:52`) ×2 **(this surface)**; capture FAB `button.flex.h-12` (`AppShell.tsx:129`) ×2 (shell) | Real. The same `shadow-violet-900/30` also renders in light mode but isn't flagged there. |
| dark-glow `#164e63` | 1/1/0/0 = 2 | Atlas orb button | **False positive.** Atlas's cyan glow belongs to the Atlas signature. Whether the orb keeps a glow under "no glows" is an owner call for the Atlas surface, not this one. |
| overused-font (Inter 100%) | 1/1/1/1 = 4 | body | **False positive for Operate.** One sans family is the documented system and operate.md endorses it. |

**Detector missed:**
- The ring's violet→blue→pink gradient. It isn't drawn at 0 progress, which is the scanned state.
- The solid `bg-violet-500` bars, which aren't a gradient.
- The overlay, which wasn't open during the scan.
- Every behavioural defect: logging, inputs, focus handling, landscape clipping.

### Findings by severity

**[P1] Logged focus minutes don't match time worked**
- **Location:** `src/hooks/useTimer.tsx:61-63, 69, 121-138`; `src/pages/app/Focus.tsx:57, 80-96`; `src/components/focus/TimerDisplay.tsx:26-36`
- **Category:** Implementation Integrity
- **Impact:** A length change while paused resets the block and logs the new length with the old `startedAt`. Skip, Reset and mode switch discard elapsed work with no confirmation. A mid-block task change credits the whole block to the new task. "Focus time" and per-task totals are wrong in both directions. This breaks the honest-numbers commitment.
- **Recommendation:** Accumulate real running time and log that. Lock length, presets, mode and task while a block is in progress, not only while running. Offer "Log N min / Discard" with Undo.
- **Suggested command:** `/impeccable harden`

**[P1] Number inputs snap to 1 and concatenate**
- **Location:** `src/pages/app/Focus.tsx:92, 96`
- **Category:** Implementation Integrity / Accessibility (forms)
- **Impact:** Clearing gives "1" and typing 45 gives "145". Values are silently clamped to 180 or 60.
- **WCAG:** 3.3.1 Error Identification (silent clamp)
- **Recommendation:** Keep a local string draft and commit on blur/Enter. Show an inline range message. Add `inputMode="numeric"`.
- **Suggested command:** `/impeccable harden`

**[P1] Full-screen overlay doesn't manage focus**
- **Location:** `src/components/layout/FocusOverlay.tsx:12-26`
- **Category:** Accessibility
- **Impact:** Focus stays on the hidden trigger. 7 Tab presses moved through background controls before focus entered the overlay. Esc returns focus to `<body>`. `aria-modal="true"` is untrue.
- **WCAG:** 2.4.3 Focus Order, 2.4.7 Focus Visible (focus off-screen), 4.1.2
- **Recommendation:** Use `<dialog>.showModal()` or the `Modal.tsx` focus trap, set `inert` on the app root, focus Start/Pause on open, and restore focus to the "Full screen" button.
- **Suggested command:** `/impeccable harden`

**[P1] Overlay clips in phone landscape and the exit can't be reached**
- **Location:** `src/components/layout/FocusOverlay.tsx:21-25` (`fixed inset-0 flex … justify-center gap-8`, no overflow handling; `TimerDisplay size={300}`)
- **Category:** Responsive
- **Impact:** At 844×390 the mode tabs start at y=-59 and the "Exit full screen" button is at y=411–449, outside the viewport and not scrollable. A touch user has no Esc key, so the only way out is rotating the phone or reloading.
- **WCAG:** 1.4.10 Reflow
- **Recommendation:** Size the ring from the viewport (`min(300px, 60vh, 80vw)`), add `overflow-y-auto`, and pin a close button at top-right inside `env(safe-area-inset-*)`.
- **Suggested command:** `/impeccable adapt`

**[P1] Faint text fails contrast on dark; day labels are 10px**
- **Location:** `src/index.css:66-68` (`.faint` = slate-500 in both themes); used at `src/pages/app/Focus.tsx:99, 112, 121, 126`
- **Category:** Accessibility
- **Impact:** 3.9:1 on the dark card (detector, confirmed). The weekday letters are 10px in the same colour, so the chart axis is barely readable.
- **WCAG:** 1.4.3 Contrast (Minimum)
- **Recommendation:** Use `dark:text-slate-400` (about 7:1) for `.faint` and a 12px minimum for labels, per DESIGN.md's "Don't use 10px text".
- **Suggested command:** `/impeccable typeset`

**[P2] Chart and per-task list don't state their numbers or scope**
- **Location:** `src/pages/app/Focus.tsx:108-125`
- **Category:** Implementation Integrity / Accessibility
- **Impact:** Values are hover-only. The aria-label has no day names. 0-minute days get a 3px bar. The per-task list is unlabelled, limited to the top 5 and the last 7 days, and leaves out unlinked sessions.
- **WCAG:** 1.1.1 (partial text alternative)
- **Recommendation:** Value labels, a today marker, "Thu 50 min" aria text, a "By task · last 7 days (top 5)" heading and a "No task" row.
- **Suggested command:** `/impeccable clarify`

**[P2] Violet, gradients and glow on the focus surface (and hard-coded colours)**
- **Location:** `src/components/focus/TimerDisplay.tsx:32, 52`; `src/components/ui/ProgressRing.tsx:18-22`; `src/pages/app/Focus.tsx:111`; `src/components/layout/FocusOverlay.tsx:21`; `src/index.css:140`; `src/components/ui/PageHeader.tsx:40`
- **Category:** Theming
- **Impact:** Goes against the confirmed direction (near-white emphasis, no gradients or glows, untinted near-black). Hex values bypass any token, so a theme change won't reach them.
- **Recommendation:** Introduce an emphasis token (near-white on dark, near-black on light) and use it for Start, the active segment, the ring stroke and today's bar. Overlay background = the neutral page token.
- **Suggested command:** `/impeccable quieter`

**[P2] Timer state isn't visible off-page and isn't persisted**
- **Location:** `src/hooks/useTimer.tsx:49-57, 91-100`; `src/components/layout/AppShell.tsx` (no indicator)
- **Category:** Implementation Integrity
- **Impact:** A reload or a discarded mobile tab loses the block. A finish in a background tab leaves no trace after the 3s toast.
- **Recommendation:** Persist `{mode, endAt, startedAt, elapsed, taskId}` to localStorage, add a timer pill in the shell, and keep a "done" title until the user acknowledges it.
- **Suggested command:** `/impeccable harden`

**[P2] Focus/Break is a fake tablist and stays live while running**
- **Location:** `src/components/focus/TimerDisplay.tsx:25-36`
- **Category:** Accessibility
- **Impact:** `role="tab"` with no `tabpanel`, no roving tabindex and no arrow keys. Selecting a tab is a destructive reset, not a view switch. Screen readers announce "tab 2 of 2" for what is really a mode action.
- **WCAG:** 4.1.2 Name, Role, Value
- **Recommendation:** Use a segmented control with `aria-pressed` (or `radiogroup`), disabled during a block in progress.
- **Suggested command:** `/impeccable harden`

**[P3] Fixed 260px ring squeezes the 320px layout**
- **Location:** `src/components/ui/ProgressRing.tsx:10,15`; `src/components/focus/TimerDisplay.tsx:21`
- **Category:** Responsive
- **Impact:** At 320px the card widens to the right edge (2px gutter instead of 16px). There's no scroll, but the layout is lopsided.
- **Recommendation:** Make the size responsive (`width: min(260px, 100%)` with an SVG `viewBox`).
- **Suggested command:** `/impeccable adapt`

**[P3] State labels drift from reality**
- **Location:** `src/components/focus/TimerDisplay.tsx:43`; `src/pages/app/Focus.tsx:24-25, 57`
- **Category:** Implementation Integrity
- **Impact:** A paused block reads "Ready". A task completed elsewhere makes the select show "Nothing specific" while the ring still says "On: <task>".
- **Recommendation:** Add a "Paused" state, and keep the selected task in the options even if it's done.
- **Suggested command:** `/impeccable polish`

### Positive findings

- The timer uses an absolute `endAt` (`useTimer.tsx:116`, `:84`), so it's immune to interval throttling and sleep. The tab title shows the countdown.
- Icon buttons have accurate, state-aware `aria-label`s, and the clock has `aria-live="off"`.
- The touch targets on the core controls are generous: 44×44 Reset/Skip, 56×56 Start, 26px-tall chips with ≥8px spacing (passes 2.5.8).
- Label/`htmlFor` and wrapping `<label>`s on every form field. A native `<select>` gives the right picker on phones.
- The write path reports failure in plain language (`focus.ts:32`). The data query is scoped by RLS and bounded to 35 days.
- No horizontal page scroll at 320px or 390px.

## Motion on this surface

| Motion | Where | Trigger | Duration / easing | Earns its place? |
|---|---|---|---|---|
| Card fade + 4px rise | `Card.tsx:16` (`animate-fade-in`), `tailwind.config.js:12,15` | Mount of each of the 3 cards | 250ms ease-out | Marginal. All three cards play it at once on every visit to the page. It's harmless, but operate.md says product loads into the task. Candidate for `remove-animations` app-wide. |
| Ring progress sweep | `ProgressRing.tsx:35` (`transition: stroke-dashoffset 0.5s linear`) | Every 1s tick; also reset/skip/mode change | 500ms linear | Yes for ticks: it smooths 1-second steps on a 260px ring (about 0.5px per second at 25 min). On reset it sweeps backwards over 500ms, which reads as "rewinding" and is acceptable. |
| Mode segment colour | `TimerDisplay.tsx:32` (`transition`, Tailwind default 150ms) | Focus/Break change | 150ms cubic-bezier(0.4,0,0.2,1) | Yes, state feedback. |
| Start button hover | `TimerDisplay.tsx:52` (`transition hover:bg-violet-500`) | Hover | 150ms | Yes, but there's no press state. The other buttons get `active:scale-[0.97]` from `.btn` (`index.css:76`); the main action should feel the most tactile. |
| Full screen button press | `.btn` `active:scale-[0.97]` (`index.css:76`) | Press | 150ms | Yes, tactile feedback in line with the direction. |
| Chip / input / icon-button colour | `index.css:70, 90, 133` | Hover / focus | 150ms | Yes. |
| Overlay open/close | `FocusOverlay.tsx:18-21` | Full screen / Esc | None (instant) | Fine. A 150–200ms opacity fade would make entering focus mode feel intentional without slowing it down. |

All of the above are covered by the global reduced-motion rule (`index.css:32-37`). The ring then jumps each second, which is acceptable because it still shows the state.

## Machine-readable summary

```json
{"surface":"focus","critique_total":22,"critique_max":40,"na_heuristics":[],"audit_total":11,
 "issues":[
  {"id":"focus-1","severity":"P1","title":"Logged focus minutes don't match time worked (length change while paused, skip/reset/mode discard, mid-block task change)","fix":"Accumulate real running time and log it; lock length/presets/mode/task while a block is in progress; offer 'Log N min / Discard' with Undo","command":"/impeccable harden","files":["src/hooks/useTimer.tsx:61","src/hooks/useTimer.tsx:69","src/hooks/useTimer.tsx:121","src/pages/app/Focus.tsx:80","src/components/focus/TimerDisplay.tsx:26"],"source":"critique"},
  {"id":"focus-2","severity":"P1","title":"Length number inputs snap to 1 and concatenate (clear → 1, type 45 → 145)","fix":"Local string draft committed on blur/Enter with clamp message; inputMode=numeric","command":"/impeccable harden","files":["src/pages/app/Focus.tsx:92","src/pages/app/Focus.tsx:96"],"source":"both"},
  {"id":"focus-3","severity":"P1","title":"Full-screen overlay is aria-modal but doesn't move, trap or restore focus","fix":"Use dialog.showModal() or Modal focus trap, inert app root, focus Start on open, restore to trigger on close, Space toggles","command":"/impeccable harden","files":["src/components/layout/FocusOverlay.tsx:12","src/components/layout/FocusOverlay.tsx:21"],"source":"both"},
  {"id":"focus-4","severity":"P1","title":"Overlay clips in phone landscape; Exit button off-screen and unreachable by touch","fix":"Ring size min(300px,60vh,80vw), overflow-y-auto, pinned top-right close inside safe area","command":"/impeccable adapt","files":["src/components/layout/FocusOverlay.tsx:21","src/components/layout/FocusOverlay.tsx:22"],"source":"audit"},
  {"id":"focus-5","severity":"P1","title":"Faint text 3.9:1 on dark cards; chart day labels 10px","fix":".faint → dark:text-slate-400; 12px minimum for labels","command":"/impeccable typeset","files":["src/index.css:66","src/pages/app/Focus.tsx:112","src/pages/app/Focus.tsx:126"],"source":"both"},
  {"id":"focus-6","severity":"P2","title":"Focus time chart and per-task list don't show values or scope","fix":"Minute labels on bars, today marker, 3-letter 12px days, 'Thu 50 min' aria text, 'By task · last 7 days (top 5)' heading plus 'No task' row, hairline for zero days","command":"/impeccable clarify","files":["src/pages/app/Focus.tsx:108","src/pages/app/Focus.tsx:116"],"source":"critique"},
  {"id":"focus-7","severity":"P2","title":"Violet start button with glow, violet mode tab/chips/bars, gradient ring and title, tinted hard-coded overlay background","fix":"Neutral near-white emphasis token for Start, active segment, ring stroke and today's bar; no glow; overlay uses neutral page token","command":"/impeccable quieter","files":["src/components/focus/TimerDisplay.tsx:32","src/components/focus/TimerDisplay.tsx:52","src/components/ui/ProgressRing.tsx:18","src/pages/app/Focus.tsx:111","src/components/layout/FocusOverlay.tsx:21","src/components/ui/PageHeader.tsx:40"],"source":"both"},
  {"id":"focus-8","severity":"P2","title":"Timer invisible outside /focus and lost on reload or tab discard","fix":"Persist timer state to localStorage and restore; shell timer pill; keep 'done' title until acknowledged","command":"/impeccable harden","files":["src/hooks/useTimer.tsx:49","src/hooks/useTimer.tsx:93","src/components/layout/AppShell.tsx:146"],"source":"critique"},
  {"id":"focus-9","severity":"P2","title":"Focus/Break uses role=tablist for a destructive mode action and stays enabled while running","fix":"Segmented control with aria-pressed or radiogroup; disabled during a block in progress","command":"/impeccable harden","files":["src/components/focus/TimerDisplay.tsx:25"],"source":"audit"},
  {"id":"focus-10","severity":"P3","title":"Fixed 260px ring squeezes the card at 320px width","fix":"Responsive ring size with SVG viewBox (width min(260px,100%))","command":"/impeccable adapt","files":["src/components/ui/ProgressRing.tsx:10","src/components/focus/TimerDisplay.tsx:21"],"source":"audit"},
  {"id":"focus-11","severity":"P3","title":"State labels drift: paused shows 'Ready'; completed selected task shows 'Nothing specific' in select","fix":"Add Paused state label; keep selected task in options even when done","command":"/impeccable polish","files":["src/components/focus/TimerDisplay.tsx:43","src/pages/app/Focus.tsx:24"],"source":"critique"}
 ]}
```
