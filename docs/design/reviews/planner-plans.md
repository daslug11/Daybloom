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

<!-- AUDIT-PLACEHOLDER -->
