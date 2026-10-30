# Planner + Plans: critique & audit (Phase 1 baseline)

Method: design review (sub-agent, screenshots + source + live app) → then detector evidence (Phase 0 CDP scans, both themes, desktop + phone)

Evidence used for the critique: the 8 Phase 0 screenshots (`planner`, `planner-plans` × dark/light × desktop/phone), the source files listed in the brief plus `src/components/ui/Modal.tsx`, `src/components/ui/Ai.tsx`, `src/components/tasks/TaskChips.tsx`, `src/index.css` and `tailwind.config.js`, and a Playwright probe of the live app (`.scratch/planner-review/probe.cjs`). The probe used fresh contexts at 1440×900 and at 390×844 with touch, and aborted every non-GET request to Supabase, so no data changed. One write was attempted and blocked (see Priority Issue 2). ✨ buttons were not pressed.

## Critique

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | The drop ghost shows "2:00 PM – 3:00 PM" while you drag from Unscheduled, and the now-line, toasts and the "Tap a time to schedule …" bar are clear. But a block you are moving or resizing shows no time readout once it is compact (<40px, i.e. 15–30 min), and Dismiss on a draft plan gives no feedback at all. |
| 2 | Match System / Real World | 3 | It follows calendar-app conventions (lanes for overlaps, "this one only / all sessions", locked synced events). `sessionLine` hard-codes 12-hour "7:00 PM" (`recurrence.ts:142`) while the grid uses the locale (`planner.ts:27`). |
| 3 | User Control and Freedom | 2 | Only Add to Planner has Undo (`AddPlanDialog.tsx:214`). Unschedule (×), moving a block, "Delete this one only", Dismiss draft, "Discard" suggestions and the check-offs that also move a goal have no undo. You can't cancel a drag with Escape, and `pointercancel` commits the move (`Planner.tsx:237`). |
| 4 | Consistency and Standards | 2 | Task blocks drag, but repeating blocks only open a dialog, even though the header says "drag blocks to move them". Deleting all sessions uses `window.confirm` (`OccurrenceDialog.tsx:133`), while removing a plan uses a styled Modal. The legend says "Your tasks = violet", yet priority tasks render rose/fuchsia, amber or other colours (`TaskChips.tsx:7–20`). The OccurrenceDialog has two pairs of identically labelled buttons ("This one only" ×2, "All … sessions" ×2). |
| 5 | Error Prevention | 2 | On a phone, a vertical swipe on a task block moves it instead of scrolling. Every Planner dialog steals focus every 15 s, so typed text lands in the wrong field. The Weeks inputs clamp on every keystroke. Double-tapping a repeating block's checkbox can count a goal twice. |
| 6 | Recognition Rather Than Recall | 3 | The legend, page description, tip line and "Drafts from Atlas — not on your Planner yet" kicker keep context visible. The resize grip is invisible until hover (`Planner.tsx:696`), so nobody on touch finds it. |
| 7 | Flexibility and Efficiency | 2 | Accept all, natural-language quick add ("review PR 3pm for 30m") and tap-to-place are real accelerators. There are no keyboard shortcuts for day/week/prev/next/today, no keyboard way to place, move or resize a block, and no multi-select. |
| 8 | Aesthetic and Minimalist Design | 2 | Off-direction everywhere: violet active tab and today pill, a pink "now" line with a glow, rose→fuchsia task gradients, cyan→teal manual repeating blocks, and gradient primary buttons. Block text is 10–11px. The phone FAB and orb cover "Plan my day" and "Regenerate". |
| 9 | Error Recovery | 2 | Failures say only "That change could not be saved. Please try again." The plan editor's error doesn't say which session is wrong. "Add repeating block" is disabled with no reason when the end date is before the start. |
| 10 | Help and Documentation | 3 | A good page sentence, the "Tip: tap a task, then tap a time…" line, a legend, and an empty state that teaches ("No plans yet. Ask Atlas for one — for example …"). There's no help for resizing or for how plans relate to habits and goals beyond one faint line. |
| **Total** | | **24/40** | **Acceptable** |

All ten heuristics apply (Operate surface).

### Design Specificity Verdict

**LLM assessment:** The Planner's *structure* is product-specific and well thought through: an Unscheduled inbox beside a 15-minute timeline, tap-to-place as a first-class alternative to drag, locked striped synced events, repeating blocks that link back to a plan with week-by-week check-offs, and an Add-to-Planner dialog that previews real conflicts against your tasks, repeats and calendar and offers Skip, Shift to a computed slot, or Add anyway. That conflict dialog is the most "authored" piece on the surface. It's honest and specific, and it answers "what will this actually do to my week?"

The *visual language* is generic and fights the confirmed direction. The surface reads as a stock "AI-era" calendar:
- violet segmented control, violet today pill;
- a pink glowing now-line;
- gradient-filled blocks in four hue families (violet, rose/fuchsia, amber/orange, cyan/teal);
- violet dashed ghosts;
- gradient primary buttons with a violet glow.

Nothing in it says "The Clear Head". The colour carries no single meaning: violet means "your tasks", "selected", "AI suggestion" *and* "primary action". Cyan means both "Atlas plan" and "a block you made by hand", which breaks the Atlas Colour Rule outright. Typography in the grid (10px hour labels, 10–11px block text, `faint` slate-500) is cramped rather than precise. The missed opportunity is clear: a neutral grid with solid near-white emphasis and one colour per meaning (tasks neutral, priority as a thin edge, synced events in calendar colour, Atlas/plan blocks in cyan, the now-line as a single non-violet signal). That would make it look as deliberate as the logic behind it.

**Deterministic scan:** see the Audit section (the detector was opened only after this critique was written).

### What's Working

1. **Add to Planner with conflict choices (`AddPlanDialog.tsx:175–291`).** It computes real overlaps against task blocks, other repeats and synced events. It names the clash ("Overlaps 'Stats lecture' (calendar, 10:00 AM–11:00 AM)") and pre-selects a concrete shift ("Shift to 11:15 AM") found by `findFreeSlot` within waking hours, with bulk Skip all / Shift all / Add all anyway. The primary button states the true outcome ("Add 6 sessions"), and success comes with an Undo toast. This is honest numbers and user control done right.
2. **Tap-to-place as a first-class path (`Planner.tsx:178–186`, `383–390`).** Selecting an Unscheduled card shows "Tap a time to schedule 'X' · Cancel" and the columns turn `cursor-copy`. Phones don't support HTML5 drag well, and here they aren't second-class. The tip line says so in plain words.
3. **Plans progress is plain and truthful (`PlansSection.tsx:69–175`).** "Week 1 of 4 · 2 of 12 sessions done" comes from `planProgress`, which excludes skipped sessions. Per-week check-offs update optimistically with a pending guard (`pending` map, line 78). The remove dialog spells out the consequence in plain words: "Remove plan, keep blocks" or "Remove plan and upcoming blocks", plus "Sessions already past stay in your history either way" and "The linked habit will be kept."

### Priority Issues

**[P1] Every Planner dialog steals focus every 15 seconds, so typed text goes into the wrong field**
- **What:** `Modal` re-runs its focus effect whenever `onClose` changes (`Modal.tsx:21–50`, deps `[open, onClose]`). Every caller on this surface passes an inline arrow (`Planner.tsx:560` `onClose={() => setOpenOcc(null)}`, `563`, `PlanCard.tsx:296–297`, `PlansSection.tsx:178`). The Planner re-renders every 15 s because of `useToday(15_000)` (`Planner.tsx:79`). On each tick the cleanup focuses the trigger button behind the overlay, and the new effect focuses the first input. **Verified live:** in New repeating block, I typed "abc" into Details and waited 16.5 s. Focus had jumped to Title, and the next keystrokes "XYZ" went into Title.
- **Why it matters:** These are the forms where you write session titles and details. Your words silently land in the wrong field, which is a data-integrity bug and a WCAG 2.4.3 / 3.2.1 problem for screen-reader users, whose context suddenly changes.
- **Fix:** In `Modal`, keep `onClose` in a ref and make the effect depend on `[open]` only. Also stop focusing a checkbox first: prefer `[autofocus]`, then the first text input or select, then the panel.
- **Suggested command:** `/impeccable harden`

**[P1] On phones, a swipe on a task block drags it instead of scrolling, and commits the move**
- **What:** `TaskBlock` has `touch-none` and starts a move on `pointerdown` (`Planner.tsx:663–665`), with only a 3px threshold (`211`). `pointercancel` is handled as `pointerup`, which commits (`226–237`). **Verified live:** a synthesized one-finger upward swipe (CDP touch, Chromium, 390×844) starting on "Finish the stats problem set" in day view put the block into drag mode. The page didn't scroll, the edge auto-scroll moved the inner timeline instead (`scrollTop` 770→686), and on release the app tried to `PATCH tasks` with a new time. The probe blocked the write, and the app showed "That change could not be saved."
- **Why it matters:** In day view a 90-minute block is 84px tall and 100% of the column wide. Any thumb that lands on it while scrolling reschedules the task. It's the most common gesture on the most common device for this audience.
- **Fix:**
  - On touch (`e.pointerType === 'touch'`), require a 300–400 ms long-press before entering move mode, with a small lift or scale cue and haptic-style feedback. Until then, leave `touch-action: pan-y` so the page scrolls.
  - Keep `touch-none` only while dragging.
  - Treat `pointercancel` and Escape as *cancel* (restore `orig`), not commit.
  - Show an Undo toast after any move ("Moved to 3:15 PM · Undo").
- **Suggested command:** `mobile-native`

**[P1] Keyboard users can't schedule, move or resize anything**
- **What:**
  - Unscheduled cards are focusable `role="button"`s that select a task (`Planner.tsx:311–315`), but the only way to then pick a time is a mouse click on a non-focusable column `div` (`onColumnClick`, `179–186`, `446–461`).
  - `TaskBlock` has no tabIndex or role (live probe: `tab: -1`), and move and resize are pointer-only.
  - Repeating blocks are reachable, but their time can only change through the dialog.
- **Why it matters:** Time-blocking is the Planner's whole purpose, and PRODUCT.md commits to "fully usable by keyboard". This fails WCAG 2.1.1 (Keyboard, Level A). Resize also has no single-pointer alternative (WCAG 2.5.7, AA).
- **Fix:**
  - When a task is selected, show an inline "Schedule" popover (date, a 15-minute time select, a duration select) that defaults to the next free slot. It doubles as the precise path on phones.
  - Make `TaskBlock` focusable. ↑/↓ moves it 15 min, Shift+↑/↓ resizes it, ←/→ changes the day in week view, Enter opens an edit popover, and changes are announced through a polite live region ("Moved to 3:15 PM").
- **Suggested command:** `/impeccable harden`

**[P1] Colour breaks the confirmed direction and the Atlas Colour Rule across the grid**
- **What:**
  - Manual repeating blocks are `from-cyan-600 to-teal-600` (`Planner.tsx:613`). The legend even lumps them in as "Repeating blocks & plans" (`541`). DESIGN.md names this specific case a bug.
  - Task blocks are violet→indigo or rose→fuchsia / amber→orange gradients (`660`, `TaskChips.tsx:11–16`), and the legend says tasks are violet.
  - The now-line is pink with a `shadow-[0_0_8px_1px_rgba(236,72,153,0.7)]` glow (`519`), next to a rose/fuchsia high-priority block, so "now" and "urgent" read as the same colour (visible in the dark-desktop screenshot: pink block at 2 PM, pink line at 9:45 PM).
  - The active Day/Week tab, the today pill and the selected card ring are violet (`341`, `410`, `318`). AI ghosts are violet dashed (`496`).
- **Why it matters:** Colour is supposed to mean something (the Meaning-Only Rule). Here one hue means four things and two hues mean the same thing, and the surface looks like a different product from the Clear Head direction.
- **Fix:**
  - Tasks become solid neutral surfaces, with priority shown as a 3px left edge in rose/amber/slate.
  - Manual repeats become neutral with a repeat icon. Only plan-linked series (`occ.plan_id`) and ✨ ghosts use cyan; the ghosts get a cyan dashed outline.
  - Day/Week, the today pill and selection use near-white/neutral emphasis.
  - The now-line becomes one solid non-violet signal colour (for example amber or the rose token) with no glow.
  - Rebuild the legend from the same tokens.
- **Suggested command:** `/impeccable colorize`

**[P2] Drag precision: snapping is right, but feedback and auto-scroll are crude**
- **What (from the pointer code):**
  - Snapping is a correct 15-minute `Math.round` of the delta, so the grab offset is preserved (`Planner.tsx:209–220`).
  - Edge auto-scroll runs only inside `pointermove`, at a fixed 12px per event, and only when the pointer has moved past the origin (`204–208`). Hold the pointer still in the 40px edge band and scrolling stops. Wiggle it and the speed depends on mouse polling rate.
  - The whole Planner re-renders and lane layout recomputes for every column on every pointermove (`setInteraction` per move).
  - Compact blocks (15–30 min) show no time while you drag. Dropping from Unscheduled *centres* the block on the cursor (`155`), but tap-to-place puts the *start* at the tap point (`182`), so the same gesture lands 30 min apart depending on the input method.
  - Resize has only an 8px hit strip with a hover-only grip (`695–697`). On a 15-min block (14px tall) that strip covers more than half the block, so a move often becomes a resize.
  - With no lift, scale or shadow change on pickup (only `ring-2`), "pick up" doesn't feel tactile.
- **Why it matters:** "Crisp, precise, quick" lives or dies in this interaction. Right now it feels approximate, especially on a trackpad and at the top and bottom of the day.
- **Fix:**
  - Drive auto-scroll from a `requestAnimationFrame` loop while a drag is active, with speed proportional to depth into a 48px edge zone.
  - Show a floating time pill ("3:15 – 4:00 PM") beside every preview, regardless of block height.
  - Use the same anchor rule for drop and tap (start at the pointer, snapped).
  - Give resize a 12–16px handle that is visible on touch and focus. For blocks under 30 min, only allow resize from a grip outside the move area.
  - Add a subtle lift (shadow plus `scale(1.02)`) on pickup, at ~120 ms.
  - Throttle `setInteraction` to only fire when the snapped preview changes.
- **Suggested command:** `emil-design-eng`

**[P2] The phone layout puts the timeline below the fold, nests two scrollers, and the FABs cover controls**
- **What:**
  - On 390px the page header and the Unscheduled card (its own `max-h-56` scroller) take the first 1.6 screens. The timeline (a `max-h-[68vh]` inner scroller) starts below them.
  - After tapping a task, the "Tap a time to schedule" bar sits in the timeline card, off-screen.
  - The global "+" FAB and the Atlas orb overlap "Plan my day" (dark/light phone `planner.jpg`), "Regenerate" (`planner-plans.jpg`), and the day-view now-label and the right part of blocks around 9–10 PM (`.scratch/planner-review/phone-swipe-mid.png`).
- **Why it matters:** Casey opens the Planner to see *today*. Instead they get an inbox list and must scroll past it, inside two competing scroll areas, where the inner scroller traps the thumb.
- **Fix:**
  - On phones, lead with the day timeline. Put Unscheduled in a collapsible strip or bottom sheet ("6 unscheduled ▸") that opens over the timeline in tap-to-place mode.
  - Let the timeline use page scroll (sticky day header) instead of an inner `68vh` box.
  - Reserve bottom padding equal to the FAB stack (~140px) on this page, or hide the "+" FAB on the Planner.
- **Suggested command:** `/impeccable adapt`

### Persona Red Flags

**Casey (distracted mobile user, one thumb):**
- Thumbing down the day view over a task block reschedules it (verified).
- The timeline is ~1.6 screens down, below the Unscheduled list. Tapping a task scrolls nothing into view, and the confirmation bar is off-screen.
- Touch targets are tiny:
  - block checkbox 14×14 and unschedule × 15×15 (measured);
  - ghost Accept/Dismiss about 15×15;
  - plan check-offs 16×16;
  - Week chevrons 28×28;
  - Day/Week tabs 46×28 and 57×28;
  - Today 61×26.
- The resize grip exists only on hover. The FAB and orb cover "Plan my day" and "Regenerate".
- After ✨ Plan my day, the ghost suggestions live only in React state (`Planner.tsx:103`). Switch apps and come back after a reload, and the suggestions you spent an AI use on are gone.

**Sam (keyboard / screen reader):**
- Can select an Unscheduled card but can never place it (columns aren't focusable). Task blocks aren't in the tab order.
- `RepeatBlock` is a `role="button"` containing another `<button>` (`Planner.tsx:609–628`), which is nested interactive content.
- `EventBlock` puts `aria-label` on a plain `div` with no role (`583`), so synced events are invisible to screen readers.
- Focus jumps inside dialogs every 15 s. The OccurrenceDialog and AddPlanDialog put first focus on a 13×13 checkbox (measured; with no visible ring in the probe's screenshot, because programmatic focus doesn't match `:focus-visible` there). In OccurrenceDialog, Space on that first focus toggles "Done" *and closes the dialog* (`OccurrenceDialog.tsx:52` → `run` → `onClose`).
- Week view's tab order runs through 7 day-header buttons and every block before reaching the Plans section (40 tab stops measured).

**Alex (power user):**
- No shortcuts for Day/Week, ←/→, T (today) or ✨ plan.
- No keyboard nudging.
- Every "this one only" deletion and every unschedule is final, with no undo.
- Repeating blocks can't be dragged like task blocks, so moving Thursday's session means opening a dialog, changing the time, and choosing "This one only".

### Cognitive Load

Checklist failures (3 of 8, moderate):
- **Single focus.** On phones, Unscheduled and the timeline compete, and the timeline isn't first. On desktop, the colourful mix of four gradient families, a pink line and violet ghosts fights for attention.
- **Visual hierarchy.** The gradient "Add to Planner" button, violet "Plan my week", violet today pill and pink now-line all claim primary weight.
- **Minimal choices.** Draft plan cards show 4 equal-weight actions (Add to Planner, Edit, Regenerate, Dismiss). The OccurrenceDialog shows 5 actions plus a Done checkbox (This one only ×2, All sessions ×2, Close), with identical labels repeated across Save and Delete.

Decision points with >4 options:
- **OccurrenceDialog (`OccurrenceDialog.tsx:51–138`):** 1 checkbox + 4 action buttons + close = 6.
- **Draft PlanCard actions (`PlanCard.tsx:266–282`):** 4 buttons. That's at the limit, and Dismiss has the same visual weight as Edit.
- **AddPlanDialog with conflicts:** 3 bulk chips, then 3 radios per conflict, then 2 checkboxes, then 2 buttons. That's acceptable only because the defaults are sensible.
- **Remove-plan dialog:** 3 buttons, fine.

### Minor Observations

- The week-view title is truncated to "Finish …" / "2:00 PM…" at 1440px (columns ~98px). The full title is only in a `title` tooltip.
- Hour labels are `text-[10px] faint` (`Planner.tsx:429`); all-day chips are `text-[10px]` (`415`).
- The Weeks number inputs reset to 1 the moment you clear them (`PlanEditor.tsx:62`, `RecurringBlockDialog.tsx:251`), so typing "3" after clearing gives "13".
- "Add a session" in the plan editor immediately shows the red "Every session needs a title…" before you have typed anything.
- In the New repeating block dialog on phones, the 3-column Time/Length/Starts row truncates the date ("10/29/2(") (`.scratch/planner-review/phone-recurring.png`).
- Dismissing a draft on the Planner removes it from view with no toast or undo. Restore exists only in the Atlas chat copy of the card (`PlanCard.tsx:289`).
- The toast layer sits above the modal and covers dialog content on phones (the "Also track as a habit" row in `phone-add-plan.png`).
- "Remove plan and upcoming blocks" deletes occurrence rows from *today* on (`plans.ts:201`), so a session you already checked off today loses its tick, despite "Sessions already past stay in your history".
- Ghost suggestions from a different week stay in `ghosts` state after navigating, so the banner count ("✨ 3 suggested blocks") can include blocks you can't see.
- `Planner#plans` deep link scrolls after a fixed 400 ms timeout (`Planner.tsx:120`), so on slow loads it can fire before the section exists.

## Audit

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | You can't place, move or resize a block by keyboard (WCAG 2.1.1, Level A). Dialog focus jumps every 15 s. Cyan blocks have 3.1–3.7:1 text and dark-theme `faint` text is 3.9:1 (1.4.3). The ghost Accept/Dismiss pair and 14px block controls fail 2.5.8. |
| 2 | Performance | 3 | `setInteraction` fires on every pointermove and re-renders the whole Planner, including `PlansSection` → `expandSeries`, plus lane layout for all 7 columns. `.striped` adds `backdrop-filter: blur(6px)` per event over a `backdrop-blur-xl` card. It's fine with demo data, but will drop frames with a busy week. |
| 3 | Theming | 2 | The light and dark themes are both complete, but colour is hard-coded: violet/pink/cyan/teal utilities, `dark:bg-[#13111f]` (`Modal.tsx:63`), an rgba glow (`Planner.tsx:519`), and inline hex from `CALENDAR_COLORS`. Only `--hour-line`/`--slot-line` are tokens. |
| 4 | Responsive Design | 2 | Touch drag takes over page scroll on task blocks and commits on release (verified). Nested inner scrollers and FAB overlap make it worse. Week view keeps `min-w-[760px]` with horizontal scroll (acceptable, since day view is the phone default). |
| 5 | Implementation Integrity | 2 | Several verified issues: the Modal focus bug affects every dialog on the surface, `pointercancel` commits, interactive elements are nested, the legend contradicts the block colours, and manual repeats are cyan against the Atlas Colour Rule. The logic layer (`recurrence.ts`, conflict detection, honest progress) is coherent and product-specific. |
| **Total** | | **11/20** | **Acceptable** |

**Implementation Integrity verdict: fail (narrowly).** The data logic is product-specific and honest. The presentation layer has drifted from DESIGN.md, and the shared Modal has a focus defect that damages user input on this surface.

### Detector findings

The `planner` and `planner-plans` scans are the same page DOM (the second is scrolled to `#plans`), so their counts are identical. Per page: dark-desktop **64**, dark-phone **50**, light-desktop **29**, light-phone **17**. That's 160 unique findings, or 320 across both screen names.

| Rule | dark-desktop | dark-phone | light-desktop | light-phone | Verdict |
|---|---|---|---|---|---|
| low-contrast | 34 | 27 | 9 | 3 | **Real, mostly.** Hour labels `div.faint.absolute` ×23 at 3.9:1 (#64748b on #14131b, dark only). Tip line and legend at 3.9:1. Quick-add placeholder at 3.4:1. White text on cyan repeating blocks at 3.7:1 and their time line at 3.1:1 (**both themes**). `btn-primary` gradient end (#437df5) at 3.8:1. Light "Medium" chip at 4.46:1 (shared `TaskChips`). **False positive:** dark-phone hour label "3.3:1 on #f9c8fd (layer on h1.gradient-text)" is an overlap artefact from the sticky header. Avatar 3.9:1 is in the shell, not this surface. |
| ai-color-palette | 8 | 5 | 8 | 5 | **Mixed.** Cyan gradient on the three workout-plan repeating blocks: the *hue* is a **false positive** (they are Atlas plan blocks, and cyan is reserved for Atlas). The *gradient* and its contrast are real, and the same cyan on a *manual* repeating block would be a true violation. The orb's `span.absolute.inset-[18%]` is a **false positive** (Atlas). The violet task-block gradient (`div.group.absolute`, also in the source scan at `Planner.tsx:660`) is real. The detector called the rose→fuchsia high-priority block "purple/violet"; either way it's off-direction. Logo and avatar (shell) are real but out of scope, and already slated for removal. |
| dark-glow | 4 | 4 | 0 | 0 | `btn-primary` violet glow on quick-add Add and on "Add to Planner" is real and slated for removal. FAB `#4c1d95` glow is shell (real, out of scope). Orb `#164e63` glow is a **false positive** (Atlas). **Missed by the detector:** the pink now-line glow `shadow-[0_0_8px_1px_rgba(236,72,153,0.7)]` (`Planner.tsx:519`). |
| tiny-text (11px) | 4 | 4 | 4 | 4 | Real: tip line (`Planner.tsx:333`), legend (`533`), block titles (`630`, `684`). |
| undersized-ui-text (10px) | 4 | 1 | 4 | 1 | Real: block time ranges "7:00 AM – 7:45 AM" (`636`, `686`). The detector didn't count the 10px hour labels (`429`) or all-day chips (`415`), which are also real. |
| gradient-text | 2 | 1 | 2 | 1 | Real: the `h1` "Planner" (`PageHeader`) and the sidebar brand. Slated for removal per DESIGN.md. |
| nested-cards | 6 | 5 | 0 | 0 | Real but minor: bordered Unscheduled task cards inside the `glass` card (`Planner.tsx:316–317`). Not reported in light because the inner cards there are near-white. |
| repeating-stripes-gradient | 1 | 1 | 1 | 1 | **False positive.** The `repeating-linear-gradient` is the functional 15-minute and hour grid (`Planner.tsx:459`) and the locked-event stripes (`.striped`), which carry meaning ("synced, read-only"). |
| overused-font | 1 | 1 | 1 | 1 | **False positive.** One sans is correct for Operate surfaces (operate.md: "One family is often right"). |
| straggler | 0 | 1 | 0 | 1 | Real, trivial: "exam." widow in the draft plan summary (`PlanCard.tsx:256`). Fix with `text-wrap: pretty`. |
| side-tab (source, `Planner.tsx:415`) | n/a | | | | **False positive.** The 3px left border on all-day chips encodes calendar identity (a meaning-colour), not decoration. |

**What the detector caught that the critique missed:** exact contrast numbers for white on cyan (3.1–3.7:1 in both themes), the 3.4:1 quick-add placeholder, and the 3.8:1 gradient end on `btn-primary`.

**What the detector missed:**
- the Modal focus steal, the touch drag hijack, `pointercancel` committing a move, and keyboard inaccessibility;
- the nested interactive `RepeatBlock`, the role-less `EventBlock` label, and touch-target sizes;
- the now-line glow and the legend/colour mismatch.

### Findings by severity

**[P1] Modal re-focuses on every parent render (focus steal)**
- **Location:** `src/components/ui/Modal.tsx:21–50` (deps `[open, onClose]`). Triggered via `src/pages/app/Planner.tsx:79` (`useToday(15_000)`), `560`, `563`, `src/components/plans/PlanCard.tsx:296–297`, `PlansSection.tsx:178`.
- **Category:** Accessibility / Implementation Integrity
- **Impact:** Every 15 s focus jumps to the trigger and then to the first input, and typing goes into the wrong field. Verified live: "XYZ" typed into Details landed in Title.
- **WCAG:** 2.4.3 Focus Order, 3.2.1/3.2.2 (unexpected change of context)
- **Recommendation:** Store `onClose` in a ref and run the effect on `[open]` only. Initial focus should prefer `[autofocus]` and then text fields over checkboxes.
- **Suggested command:** `/impeccable harden`

**[P1] No keyboard path to schedule, move or resize**
- **Location:** `Planner.tsx:179–186` (click-only column placement), `446–461` (non-focusable columns), `657–699` (`TaskBlock` has no tabIndex or role), `695` (pointer-only resize).
- **Category:** Accessibility
- **Impact:** The core Planner task can't be done without a pointer.
- **WCAG:** 2.1.1 Keyboard (A), 2.5.7 Dragging Movements (AA) for resize
- **Recommendation:** Add a Schedule popover (date, time, duration) for a selected task. Make blocks focusable, with arrow-key nudge and resize and live-region announcements.
- **Suggested command:** `/impeccable harden`

**[P1] Touch drag takes over scroll and commits on cancel**
- **Location:** `Planner.tsx:663–665` (`touch-none`, move on pointerdown), `211` (3px threshold), `226–237` (`pointercancel` → commit). No Escape handler.
- **Category:** Responsive
- **Impact:** Scrolling the day view on a phone reschedules tasks.
- **Evidence:** A synthesized CDP touch swipe in Chromium at 390×844 entered drag mode; the page didn't scroll, and on release the app sent `PATCH /rest/v1/tasks` (blocked by the probe). Not tested on a physical iOS or Android device.
- **Recommendation:** Use a long-press to lift on touch and `touch-action: pan-y` until lifted. Cancel on `pointercancel` and Escape. Show an Undo toast after a move.
- **Suggested command:** `mobile-native`

**[P1] Text contrast below AA on repeating blocks and faint text**
- **Location:**
  - `Planner.tsx:613` with `635`: white and `text-white/85` on cyan-600→teal-600, 3.7:1 and 3.1:1, both themes;
  - `429`: hour labels, `faint` 3.9:1 in dark;
  - `333`, `533`: tip and legend at 3.9:1;
  - `QuickAddTask` placeholder at 3.4:1;
  - `index.css:66`: `.faint` is `text-slate-500` in dark.
- **Category:** Accessibility
- **Impact:** Times and labels in the grid are hard to read at 10–11px.
- **WCAG:** 1.4.3 Contrast (Minimum)
- **Recommendation:** Make `faint` in dark at least slate-400 (#94a3b8, ~7:1). Use solid block fills with ≥4.5:1 text, or dark text on light fills. Remove `/85` opacity on block text.
- **Suggested command:** `/impeccable colorize`

**[P1] Colour system contradicts DESIGN.md direction and the Atlas Colour Rule**
- **Location:**
  - `Planner.tsx:613` (cyan for *every* repeating block, manual ones included);
  - `660` with `TaskChips.tsx:7–20` (violet, rose/fuchsia and amber/orange gradients for tasks);
  - `519–521` (pink now-line with glow);
  - `341`, `410`, `318`, `285`, `293` (violet tabs, today pill, selection, drop zone);
  - `496`, `502`, `513` (violet ghosts and drop ghost);
  - `535–547` (legend says tasks are violet).
- **Category:** Implementation Integrity / Theming
- **Impact:** Colour has no stable meaning, "now" collides with "high priority", and Atlas's reserved cyan is diluted.
- **Recommendation:**
  - Neutral solid task blocks with a priority edge.
  - Cyan only for `occ.plan_id` blocks and ✨ ghosts.
  - Neutral near-white selection.
  - A single-colour now-line with no glow.
  - A legend generated from the same tokens.
- **Suggested command:** `/impeccable colorize`

**[P1] Undersized touch targets on the timeline and in Plans**
- **Location:**
  - `Planner.tsx:625`, `679` (block checkbox 14×14);
  - `691` (unschedule 15×15);
  - `502–507` (ghost Accept/Dismiss about 15×15, 4px apart);
  - `695` (8px resize strip);
  - `PlansSection.tsx:160` (16×16 check-offs at ~24px row pitch), `147–153` (28px chevrons).
- **Category:** Responsive / Accessibility
- **Impact:** Mis-taps between Accept and Dismiss on a suggestion, between complete and drag, and between resize and move.
- **WCAG:** 2.5.8 Target Size (Minimum) fails for the adjacent ghost Accept/Dismiss pair. The others pass only by the spacing exception.
- **Recommendation:**
  - Expand hit areas to ≥24px (ideally 44px on touch) with pseudo-element padding.
  - Make plan check-off rows full-row labels.
  - On phones, show ghost actions in a bottom bar for the selected suggestion.
- **Suggested command:** `mobile-native`

**[P2] Nested interactive content and unlabelled synced events**
- **Location:** `Planner.tsx:608–628` (`role="button"` div containing a `<button>`), `579–584` (`aria-label` on a role-less div, not focusable).
- **Category:** Accessibility
- **Impact:** Screen readers announce the repeating block and its checkbox unpredictably. Synced events are skipped entirely.
- **WCAG:** 4.1.2 Name, Role, Value; 1.3.1
- **Recommendation:** Make the block a container with two sibling buttons (open, done). Give events `role="img"` or a focusable `<button>` that opens a read-only detail.
- **Suggested command:** `/impeccable harden`

**[P2] Drag precision and pointer-move cost**
- **Location:** `Planner.tsx:204–208` (auto-scroll only on pointermove, fixed 12px), `224` (state per move), `155` vs `182` (drop centres the block, tap anchors its start), `684–689` (no time readout when compact), `695` (8px resize strip).
- **Category:** Performance / Implementation Integrity
- **Impact:** Auto-scroll stalls when the pointer rests at an edge. You can't see the time when moving short blocks. Drag and tap land 30 min apart. The whole page re-renders per move event.
- **Recommendation:**
  - rAF-driven, depth-proportional auto-scroll.
  - Only commit state when the snapped preview changes.
  - A floating time pill on the preview.
  - One anchor rule for drop and tap.
  - A larger resize handle.
- **Suggested command:** `emil-design-eng`

**[P2] Phone layout: timeline buried, nested scrollers, FAB overlap**
- **Location:** `Planner.tsx:283–335` (Unscheduled first, with `max-h-56` inner scroll), `425` (`max-h-[68vh]` inner scroll), global FAB/orb over `358` "Plan my day" and `PlanCard.tsx:275` "Regenerate".
- **Category:** Responsive
- **Impact:** Today's schedule is about 1.6 screens down, and two scroll containers compete for the thumb.
- **Recommendation:** Timeline first on phones, Unscheduled in a sheet, page-level scroll with a sticky day header, and bottom padding for the FAB stack.
- **Suggested command:** `/impeccable adapt`

**[P2] Missing undo for destructive or irreversible actions; AI suggestions are lost**
- **Location:**
  - `Planner.tsx:487–490` (unschedule), `378` (Discard), `103` (ghosts in component state only);
  - `OccurrenceDialog.tsx:126` (delete this one);
  - `PlanCard.tsx:278` (Dismiss, which has no toast and no Restore on the Planner).
- **Category:** Implementation Integrity
- **Impact:** One mis-tap loses a scheduled time or a session. A reload throws away suggestions that used part of the daily ✨ allowance.
- **Recommendation:** Show an Undo toast for each, and keep ghosts in `sessionStorage` keyed by date range.
- **Suggested command:** `/impeccable harden`

**[P2] A goal can be counted twice from the Planner**
- **Location:** `Planner.tsx:471–473` (no pending guard on the `RepeatBlock` checkbox) and `src/hooks/data/plans.ts:163–169` (`current ± 1` read-modify-write).
- **Category:** Implementation Integrity
- **Impact:** A double tap marks done twice and adds +2 to the linked goal. That breaks the "honest numbers" commitment.
- **Recommendation:** Disable the checkbox while it saves, as `PlansSection` already does. Better, compute goal progress from the count of done occurrences instead of incrementing it.
- **Suggested command:** `/impeccable harden`

**[P2] Inconsistent dialog patterns**
- **Location:** `OccurrenceDialog.tsx:133` (`window.confirm`), `52` (the Done checkbox closes the dialog), `99–137` (duplicate "This one only" and "All … sessions" labels for save and delete). Repeating blocks can't be dragged (`Planner.tsx:603–643`), despite the header copy at `272`.
- **Category:** Implementation Integrity
- **Impact:** Two confirmation styles, buttons that are ambiguous out of context, and a surprise close.
- **Recommendation:**
  - Use Modal confirm.
  - Labels "Save for this session" / "Save for all sessions" and "Delete this session" / "Delete all sessions".
  - Keep the dialog open on Done.
  - Allow dragging a repeating block, followed by a this-one/all prompt.
- **Suggested command:** `/impeccable clarify`

**[P2] 10–11px functional text in the grid**
- **Location:** `Planner.tsx:409`, `415`, `429`, `585–590`, `630–636`, `684–686`, `509`, `333`, `533`.
- **Category:** Accessibility / Theming
- **Impact:** Times are the information that matters most here, and they're set at 10px.
- **Recommendation:** Use a 12px minimum for block titles and times and 11px for hour labels, with `tabular-nums`. Let short blocks show the time in a tooltip or popover instead of shrinking it.
- **Suggested command:** `/impeccable typeset`

**[P3] Number inputs clamp on every keystroke; vague or absent validation messages**
- **Location:** `PlanEditor.tsx:62`, `126`; `RecurringBlockDialog.tsx:251`, `263`.
- **Category:** Implementation Integrity
- **Recommendation:** Clamp on blur. Mark the offending session with `aria-invalid` and say which one. Explain why "Add repeating block" is disabled.
- **Suggested command:** `/impeccable harden`

**[P3] "Remove plan and upcoming blocks" erases today's check-off**
- **Location:** `src/hooks/data/plans.ts:200–201` (`end_date = today − 1`, deletes rows `gte today`).
- **Category:** Implementation Integrity
- **Recommendation:** Keep today if it's already done, or say "from tomorrow" in the dialog copy.
- **Suggested command:** `/impeccable harden`

**[P3] Smooth scroll and spinner ignore reduced motion intent**
- **Location:** `Planner.tsx:120` (`scrollIntoView({behavior:'smooth'})` overrides the CSS `scroll-behavior` rule), and `index.css:32–40` (the global 0.01ms kill freezes the `animate-spin` loader on "Plan my day").
- **Category:** Accessibility
- **Recommendation:** Pick the scroll behaviour from `matchMedia('(prefers-reduced-motion: reduce)')`. Under reduced motion, replace the spinner with a static "Planning…" label instead of freezing it.
- **Suggested command:** `/impeccable animate`

**[P3] Locale inconsistency in plan session lines**
- **Location:** `server/data/recurrence.ts:142–151` (`time12`, used by `PlanCard.tsx:261`) vs `src/lib/planner.ts:27` (locale-aware).
- **Category:** Implementation Integrity
- **Recommendation:** Format with the locale in the client-side card. Keep `time12` for Atlas text.
- **Suggested command:** `/impeccable clarify`

**[P3] Cards inside a card in Unscheduled**
- **Location:** `Planner.tsx:316–317` inside `285`.
- **Category:** Theming
- **Recommendation:** Use list rows separated by hairlines, with a tactile hover and pressed state, instead of bordered cards inside a glass card.
- **Suggested command:** `/impeccable distill`

### Positive findings

- **Pure, shared, testable date logic** (`server/data/recurrence.ts`): exceptions as rows, ISO weekdays, `findFreeSlot` bounded to waking hours, `planProgress` that excludes skipped sessions. Keep this separation.
- **Dialog basics are right:** a portal, `aria-modal`, Escape to close, a Tab trap, and focus returned on close (`Modal.tsx`). Only the effect dependencies are wrong.
- **Every icon button on the surface has a specific `aria-label`.** Examples: "Unschedule 'Finish the stats problem set'", "Done: Leg day on Mon, Oct 26", "Open Thursday, October 29 in day view". Day/Week use `role="tab"` with `aria-selected`.
- **Optimistic check-offs with a pending guard** in `PlansSection.tsx:78–115`, and an all-or-nothing rollback in `addToPlanner` (`plans.ts:143–146`) so a failed add leaves nothing half-written ("Nothing was changed — please try again").
- **Visible focus rings** on every tab stop measured (global `:focus-visible` ring), and the view choice is remembered per device with a guarded `localStorage`.
- **The AI is clearly optional and metered:** "Plan my week" shows its cost in the tooltip ("Uses 1 of your N AI actions left today"), and you have to accept suggestions before anything changes.

## Motion on this surface

| What | Where | Trigger | Duration / easing | Earns its place? |
|---|---|---|---|---|
| Now-line slides down | `Planner.tsx:518` `transition-[top] duration-1000 ease-linear` | `useToday(15_000)` tick | 1000ms linear | **Yes**, it's quiet and continuous. The pink glow on it (`519`) does not; remove it. |
| Unscheduled card highlight while dragging a block over it | `Planner.tsx:285` `transition` (Tailwind default 150ms ease) | pointer enters sidebar | 150ms | Yes: state feedback. Should use a neutral colour instead of violet. |
| Block pickup / move / resize | `Planner.tsx:663–671` | pointer drag | Instant (no transition on `top`/`height`) | Instant tracking is correct. **Missing:** a ~120ms lift (shadow + `scale(1.02)`) on pickup and a settle on drop, which would deliver the "tactile" brief. |
| Lane reflow of neighbouring blocks during drag | `layoutLanes` per render (`Planner.tsx:439–444`) | each pointermove | Instant jump | No. Neighbours jumping lanes mid-drag is noise. Freeze lanes for the dragged block until drop. |
| Edge auto-scroll | `Planner.tsx:204–208` | pointermove in a 40px edge band | 12px per event, no easing | Needed, but implemented crudely (see P2). Make it rAF-driven and proportional. |
| Dialog entrance | `Modal.tsx:63` `animate-fade-in` (`tailwind.config.js:12–15`) | open | 250ms ease-out, 4px rise | Yes, though 250ms is at the upper end. On phones it's a bottom sheet that only fades; a 200ms slide-up would match the sheet shape. No exit animation (acceptable). |
| Plan progress bar fill | `PlansSection.tsx:136` `transition-all` | check-off | 150ms default | Yes, but animate `transform: scaleX` instead of `width` and limit it to that property. |
| Pressed buttons | `index.css:73–75` `.btn active:scale-[0.97]` | press | 150ms | Yes: tactile and quick. Keep it. |
| ✨ loading spinner | `Ai.tsx` `Loader2 animate-spin` | Plan my day/week pending | Continuous | Yes, it shows state. Under reduced motion it freezes (global kill), so it needs a static text alternative. |
| Smooth scroll to `#plans` | `Planner.tsx:120` | arriving via `Planner#plans` | Browser smooth scroll | Earns its place for orientation, but ignores reduced motion and depends on a fixed 400ms timeout. |
| Hover colour changes (icon buttons, chips, ghost dismiss, block ring) | `index.css` `.icon-btn`, `.chip-*`; `Planner.tsx:505`, `613` | hover | 150ms | Fine. No hover equivalent on touch, which is acceptable. |
| Ghost suggestions appear | `Planner.tsx:493–511` | ✨ result | None (instant) | A 150ms fade-in would help you see what just arrived. Optional. |

## Machine-readable summary

```json
{"surface":"planner-plans","critique_total":24,"critique_max":40,"na_heuristics":[],"audit_total":11,
 "issues":[
  {"id":"planner-plans-1","severity":"P1","title":"Dialogs steal focus every 15 s; typed text lands in the wrong field","fix":"Keep onClose in a ref and run Modal's focus effect on [open] only; initial focus prefers [autofocus] then text fields over checkboxes","command":"/impeccable harden","files":["src/components/ui/Modal.tsx:21","src/pages/app/Planner.tsx:79","src/pages/app/Planner.tsx:560","src/components/plans/PlanCard.tsx:296"],"source":"critique"},
  {"id":"planner-plans-2","severity":"P1","title":"Touch swipe on a task block drags and reschedules it instead of scrolling; pointercancel commits","fix":"Long-press to lift on touch, touch-action pan-y until lifted, cancel on pointercancel/Escape, Undo toast after moves","command":"mobile-native","files":["src/pages/app/Planner.tsx:663","src/pages/app/Planner.tsx:211","src/pages/app/Planner.tsx:226"],"source":"both"},
  {"id":"planner-plans-3","severity":"P1","title":"No keyboard way to schedule, move or resize blocks (WCAG 2.1.1, 2.5.7)","fix":"Schedule popover (date/time/duration) for a selected task; focusable blocks with arrow-key nudge, Shift+arrow resize and live-region announcements","command":"/impeccable harden","files":["src/pages/app/Planner.tsx:179","src/pages/app/Planner.tsx:446","src/pages/app/Planner.tsx:657"],"source":"both"},
  {"id":"planner-plans-4","severity":"P1","title":"Colour contradicts direction: cyan on manual repeats, multi-hue gradient tasks, pink glowing now-line, violet selection; legend mismatches","fix":"Neutral solid task blocks with priority edge; cyan only for plan-linked blocks and AI ghosts; neutral near-white selection; single-colour now-line without glow; legend from tokens","command":"/impeccable colorize","files":["src/pages/app/Planner.tsx:613","src/pages/app/Planner.tsx:660","src/pages/app/Planner.tsx:519","src/pages/app/Planner.tsx:341","src/pages/app/Planner.tsx:535","src/components/tasks/TaskChips.tsx:7"],"source":"both"},
  {"id":"planner-plans-5","severity":"P1","title":"Text contrast below AA: cyan block text 3.1-3.7:1, dark faint hour labels/tip/legend 3.9:1, placeholder 3.4:1","fix":"Raise dark .faint to slate-400; solid block fills with >=4.5:1 text and no /85 opacity","command":"/impeccable colorize","files":["src/pages/app/Planner.tsx:613","src/pages/app/Planner.tsx:635","src/pages/app/Planner.tsx:429","src/index.css:66"],"source":"audit"},
  {"id":"planner-plans-6","severity":"P1","title":"Undersized touch targets: 14px block checkbox, 15px unschedule, adjacent ~15px ghost Accept/Dismiss, 8px resize strip, 16px plan check-offs","fix":"Expand hit areas to >=24px (44px on touch) via pseudo-element padding; full-row check-off labels; bottom action bar for selected ghost on phones","command":"mobile-native","files":["src/pages/app/Planner.tsx:502","src/pages/app/Planner.tsx:679","src/pages/app/Planner.tsx:691","src/pages/app/Planner.tsx:695","src/components/plans/PlansSection.tsx:160"],"source":"both"},
  {"id":"planner-plans-7","severity":"P2","title":"Drag precision: pointermove-only fixed-step auto-scroll, no time readout on compact blocks, drop vs tap anchor differ by half a block, tiny resize zone, re-render per move","fix":"rAF depth-proportional auto-scroll; floating time pill; one anchor rule; larger resize handle; update state only when snapped preview changes; pickup lift","command":"emil-design-eng","files":["src/pages/app/Planner.tsx:204","src/pages/app/Planner.tsx:155","src/pages/app/Planner.tsx:182","src/pages/app/Planner.tsx:224","src/pages/app/Planner.tsx:695"],"source":"critique"},
  {"id":"planner-plans-8","severity":"P2","title":"Phone layout buries the timeline below Unscheduled, nests two scrollers, FAB/orb cover Plan my day and Regenerate","fix":"Timeline first on phones, Unscheduled as a sheet, page-level scroll with sticky day header, bottom padding for the FAB stack","command":"/impeccable adapt","files":["src/pages/app/Planner.tsx:283","src/pages/app/Planner.tsx:294","src/pages/app/Planner.tsx:425"],"source":"critique"},
  {"id":"planner-plans-9","severity":"P2","title":"No undo for unschedule, discard suggestions, delete-this-session, dismiss draft; AI ghost suggestions lost on reload","fix":"Undo toasts for each; persist ghosts in sessionStorage keyed by range","command":"/impeccable harden","files":["src/pages/app/Planner.tsx:487","src/pages/app/Planner.tsx:378","src/pages/app/Planner.tsx:103","src/components/plans/OccurrenceDialog.tsx:126","src/components/plans/PlanCard.tsx:278"],"source":"critique"},
  {"id":"planner-plans-10","severity":"P2","title":"Nested interactive RepeatBlock; synced events have aria-label on a role-less, unfocusable div","fix":"Sibling open/done buttons inside a plain container; events as focusable read-only buttons or role=img","command":"/impeccable harden","files":["src/pages/app/Planner.tsx:608","src/pages/app/Planner.tsx:579"],"source":"audit"},
  {"id":"planner-plans-11","severity":"P2","title":"Rapid double-tap on a repeating block checkbox can double-count the linked goal","fix":"Pending guard on the Planner checkbox; derive goal progress from done occurrences instead of +/-1","command":"/impeccable harden","files":["src/pages/app/Planner.tsx:471","src/hooks/data/plans.ts:163"],"source":"critique"},
  {"id":"planner-plans-12","severity":"P2","title":"Inconsistent dialogs: window.confirm vs Modal, duplicate button labels, Done closes dialog, repeating blocks not draggable","fix":"Modal confirm; explicit labels (Save for this session / all sessions, Delete this session / all sessions); keep dialog open on Done; allow dragging repeats with a this/all prompt","command":"/impeccable clarify","files":["src/components/plans/OccurrenceDialog.tsx:133","src/components/plans/OccurrenceDialog.tsx:52","src/components/plans/OccurrenceDialog.tsx:99","src/pages/app/Planner.tsx:603"],"source":"critique"},
  {"id":"planner-plans-13","severity":"P2","title":"10-11px functional text for block times, titles, hour labels and legend","fix":"12px minimum for block title/time, 11px hour labels with tabular-nums; short blocks reveal time on focus/hover instead of shrinking","command":"/impeccable typeset","files":["src/pages/app/Planner.tsx:429","src/pages/app/Planner.tsx:636","src/pages/app/Planner.tsx:686","src/pages/app/Planner.tsx:533"],"source":"both"},
  {"id":"planner-plans-14","severity":"P3","title":"Weeks inputs clamp per keystroke; plan editor error is premature and unspecific; disabled Add repeating block gives no reason","fix":"Clamp on blur; aria-invalid on the offending session with a named message; explain disabled state","command":"/impeccable harden","files":["src/components/plans/PlanEditor.tsx:62","src/components/plans/PlanEditor.tsx:126","src/components/plans/RecurringBlockDialog.tsx:251"],"source":"critique"},
  {"id":"planner-plans-15","severity":"P3","title":"Remove plan and upcoming blocks deletes today's already-checked session","fix":"Keep today's done session or say 'from tomorrow' in the dialog","command":"/impeccable harden","files":["src/hooks/data/plans.ts:200"],"source":"critique"},
  {"id":"planner-plans-16","severity":"P3","title":"Smooth scroll to #plans ignores reduced motion; reduced-motion kill freezes the Plan my day spinner","fix":"Choose scroll behavior from matchMedia; static 'Planning…' label under reduced motion","command":"/impeccable animate","files":["src/pages/app/Planner.tsx:120","src/index.css:32"],"source":"audit"},
  {"id":"planner-plans-17","severity":"P3","title":"Plan session lines use hard-coded 12-hour time while the grid is locale-aware","fix":"Locale-format session times in PlanCard; keep time12 for Atlas text","command":"/impeccable clarify","files":["server/data/recurrence.ts:142","src/components/plans/PlanCard.tsx:261"],"source":"critique"},
  {"id":"planner-plans-18","severity":"P3","title":"Unscheduled task cards nested inside a glass card","fix":"Hairline-separated list rows with tactile hover/pressed states","command":"/impeccable distill","files":["src/pages/app/Planner.tsx:316"],"source":"audit"}
 ]}
```
