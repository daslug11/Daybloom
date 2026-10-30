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

_(written after opening the detector file; see below)_
