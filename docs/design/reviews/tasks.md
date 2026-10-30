# Tasks: critique & audit (Phase 1 baseline)

Method: design review (sub-agent, screenshots + source + live app) → then detector evidence (Phase 0 CDP scans, both themes, desktop + phone)

Evidence used for the critique: the four `tasks.jpg` screenshots (dark/light × desktop/phone), the source listed below, and a live Playwright pass against `http://localhost:5173/app/tasks` as Maya, with every non-GET request to Supabase aborted so no data changed (tab order, focus rings, touch-target sizes, the task editor at 1440 and 390 wide, the quick-add preview). The ✨ buttons were not pressed.

Source: `src/pages/app/Tasks.tsx`, `src/components/tasks/{TaskItem,TaskEditor,QuickAddTask,TaskChips}.tsx`, `src/lib/quickAdd.ts`, `src/hooks/data/tasks.ts`, plus `src/components/ui/{Modal,Ai,PageHeader}.tsx`, `src/hooks/useToast.tsx`, `src/index.css`, `tailwind.config.js`.

## Critique

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | The quick-add "Understood" preview and the completion toast are good feedback. Adding a task with no date and time gives no confirmation, and the new row can land off-screen in "No date" or "Later". The toast region has no live region, so screen readers hear nothing. |
| 2 | Match System / Real World | 3 | "Top 3 today", "Overdue", "Next 7 days" and "No date" are plain student language. The first top-3 row shows "Today 17:00" (due) next to an unlabelled "📅 Today 14:00" (Planner block): two times with no words saying which is which. |
| 3 | User Control and Freedom | 2 | Completing a task has Undo, which is good. The task editor has no cancel: the ✕ button, Escape and a backdrop click all call `save` (`TaskEditor.tsx:68`). Deleting a step (`TaskEditor.tsx:199`) or a task has no undo. |
| 4 | Consistency and Standards | 2 | Tasks use round checkboxes and steps use square 16px ones. Editor fields save on close, but step tick and delete save instantly. Unstarred stars are visible on phone and hidden on desktop. The footer button is labelled "Done", which is also the name of the completed section. |
| 5 | Error Prevention | 1 | The editor drops keystrokes: typing in Notes or "Add a step" moves focus to Title after the first character (verified live, P0 below). Tag edits made in the editor are lost when it is closed with Escape, because Tags is an uncontrolled field that commits only on blur. Quick add schedules Planner time without saying so first. |
| 6 | Recognition Rather Than Recall | 3 | The placeholder teaches the syntax ("report fri 3pm for 1h #work !high") and the chip preview confirms it. On phone the placeholder is cut off at "report fri 3pm fo", so the `#` and `!` syntax is never shown. |
| 7 | Flexibility and Efficiency | 3 | Natural-language quick add, search and tag filters are real accelerators. There are no keyboard shortcuts for complete, star or open on a focused row, and no multi-select. |
| 8 | Aesthetic and Minimalist Design | 2 | Each row can show up to six chip hues (blue date, violet duration and block line, pink tags, rose/amber/emerald priority), plus a matching coloured checkbox ring. The title uses gradient text and the primary button is a violet gradient. Colour is everywhere, so it stops meaning anything. |
| 9 | Error Recovery | 2 | Failures produce a generic toast ("Could not add that task. Please try again."). "A task needs a title." appears as a toast far from the field, and the field is not marked invalid. |
| 10 | Help and Documentation | 3 | The page description explains the top 3 rule. The empty state teaches by example. The empty top-3 slot says "Star (☆) up to three tasks". |
| **Total** | | **24/40** | **Acceptable** |

### Design Specificity Verdict

**LLM assessment:** The task list is close to product-specific. The top-3 cap ("Three is plenty. 🙂"), the "from note" provenance link back to the Brain Dump, and the live "Understood" parse preview are Daybloom ideas, not category boilerplate. They express "capture first, decide later" and the honest, small-scope tone. The visual layer is generic. Translucent glass rows, rainbow pill chips, a gradient H1 and a violet gradient button could belong to any 2023 to-do template, and they contradict the confirmed "Clear Head" direction (neutral near-white emphasis, colour only for meaning). The structure earns its specificity; the skin works against it. The biggest missed opportunity is completion. Ticking off a task, the most frequent and satisfying act on this surface, has no tactile response: the row just disappears into a collapsed "Done" section.

### What's Working

1. **The live "Understood" preview** (`QuickAddTask.tsx:357-367`). As you type "report fri 3pm for 1h #work !high", the row shows `report · Tomorrow · 3:00 PM · 1h · #work · High` before you commit. It is the right answer to "did it understand me?", and it costs no AI. "✨ Read with AI" appears only as an opt-in for tricky sentences, which fits commitment 1.
2. **When-based grouping with a capped top 3** (`Tasks.tsx:58-65`). Top 3 / Overdue / Today / Next 7 days / Later / No date matches how a student thinks. The 3/3 counter and the hard cap stop the list becoming a guilt wall. The "Done · 3 in the last 60 days" footer says exactly how it counts, which honours "honest numbers".
3. **Undo on completion** (`hooks/data/tasks.ts:200-212`). Completing a task is instant and optimistic, with "Completed '…' · Undo". It also truncates long titles with an ellipsis instead of overflowing.

### Priority Issues

**[P0] The task editor drops keystrokes and moves focus to Title on every edit**
- **What:** `TaskEditor` passes `onClose={save}` (`TaskEditor.tsx:68`), and `save` is a new function on every render. `Modal`'s focus effect depends on `[open, onClose]` (`Modal.tsx:21-50`), so every keystroke runs the cleanup, which focuses the element behind the dialog, and then re-runs the setup, which focuses the first input on the next frame. Verified live: typing "ab" into Notes kept "a" and left focus on `#task-title`; typing "xyz" into "Add a step" kept "x"; typing "XY" at the end of the title kept "X".
- **Why it matters:** Users cannot write notes, add steps by hand, or edit a title. Editing is a core Tasks job, and the dialog quietly corrupts what they type.
- **Fix:** In `Modal`, keep the latest `onClose` in a ref (`const closeRef = useRef(onClose); closeRef.current = onClose;`), call `closeRef.current()` from the key handler and the backdrop, and change the effect's dependencies to `[open]` so focus moves in once and returns once. Most other `<Modal>` call sites also pass inline arrows (Habits, Goals, ConvertDialog and others), so this fixes the whole app.
- **Suggested command:** `/impeccable harden`

**[P1] The editor has no "cancel", and closing with Escape loses tag edits**
- **What:** The ✕, Escape and backdrop all save (`TaskEditor.tsx:68`, `Modal.tsx:25,55,72`). Tags uses `defaultValue` plus `onBlur` (`TaskEditor.tsx:104-109`). Pressing Escape while still in Tags runs `save` before blur, so the new tags are dropped. A user who opened a task just to look, then changed a field by accident, has no way to back out.
- **Why it matters:** Every way out does the same thing, and it does not always do it correctly. People expect ✕ to mean "never mind".
- **Fix:** Pick one model and label it. Either (a) autosave: say "Changes save automatically" under the title, make Tags a controlled field that commits on change, and rename the footer button "Close"; or (b) a draft: ✕/Escape discard, ask "Discard changes?" only when the draft is dirty, and keep a "Save" button. Option (a) fits "quick" better.
- **Suggested command:** `/impeccable harden`

**[P1] The completion Undo toast disappears after 6 seconds, cannot be paused, and is silent to screen readers**
- **What:** `useToast.tsx:36` dismisses action toasts after a fixed 6000 ms. Hover and focus do not pause it, and the container (`useToast.tsx:44`) has no `role="status"` or `aria-live`. The Undo button is at the end of the DOM, past every task row.
- **Why it matters:** A keyboard or screen-reader user who completes the wrong task cannot reach Undo in time and is never told it exists. A mis-tap on a 20px checkbox on a phone is the most likely mistake on this surface.
- **Fix:** Add `role="status" aria-live="polite"` to the toast stack. Pause the timer while the toast is hovered or focused, and give action toasts 10 s. Add a keyboard path to undo the last completion, for example ⌘/Ctrl+Z on the Tasks page or focusing the toast's Undo.
- **Suggested command:** `/impeccable harden`

**[P2] Chip rainbow: every task attribute has its own hue, and time chips are cyan**
- **What:** `TaskChips.tsx:138-162` and `TaskItem.tsx:42,50-53`: the date is blue, the time is **cyan** (breaking the Atlas Colour Rule), duration and the Planner-block line are violet, tags are pink, and priority is rose/amber/emerald. The checkbox repeats priority as a coloured ring (`TaskItem.tsx:83-87`). As a result, the overdue dentist task has a green ring (Low) next to a red "Overdue" chip, two signals pulling in opposite directions.
- **Why it matters:** When everything is coloured, nothing stands out. "Overdue" and "High" are what should catch the eye, and they compete with decorative blue and pink.
- **Fix:** Make date, time, duration and tag chips neutral (hairline border, muted text, icon carries the type). Keep colour only for overdue (rose) and high priority, and show medium/low priority as the flag icon with a neutral label. Use a neutral checkbox ring. Never use cyan on this surface. Label the block line in words: "Blocked 14:00–15:00".
- **Suggested command:** `/impeccable quieter`

**[P2] Starring is hidden on desktop and blocked on phone**
- **What:** Unstarred stars are `md:opacity-0` until hover (`TaskItem.tsx:71`), so at 768px and up they cannot be seen, including on touch tablets and laptops with no hover. On phone, the fixed "+" FAB and the Atlas orb sit right over the star column. In the dark-phone screenshot, the FAB covers the Overdue row's star.
- **Why it matters:** "Star up to three" is the page's one instruction, and on desktop the control that does it is invisible.
- **Fix:** Always show the outline star at muted contrast and brighten it on hover. On phone, keep the right 72px of the list clear of the FAB stack, or move the star to the left of the title.
- **Suggested command:** `/impeccable adapt`

**[P2] Quick add changes the Planner silently, and plain adds give no confirmation**
- **What:** `taskFromParsed` (`quickAdd.ts:90-95`) creates a Planner block whenever a date and a time are typed. The preview shows the date and time chips but never says "and blocks 15:00–16:00 in your Planner"; a toast says so only afterwards (`QuickAddTask.tsx:329`). Adds without a time produce no feedback at all, and the new row often lands below the fold.
- **Why it matters:** It is a side effect the user did not choose, on the screen they trust most. Casey on a phone types a task and sees nothing happen.
- **Fix:** Add a "→ Planner 15:00–16:00" chip to the preview whenever a block will be created. After any add, scroll the new row into view and flash its border once, or toast "Added to Next 7 days".
- **Suggested command:** `/impeccable clarify`

### Persona Red Flags

**Casey (distracted mobile user, 390px):**
- The complete checkbox is a 20×20 px target (measured) next to a full-width "open" button. A thumb aimed at the circle often opens the editor instead.
- The quick-add placeholder is cut off at "try "report fri 3pm fo", so the `#tag` and `!priority` syntax never shows.
- The "+" FAB and the orb cover the star column.
- In the editor (a bottom sheet), Title is autofocused, so the keyboard opens at once and covers half the sheet. The "Done" button sits below the fold, under Notes and Steps.
- "✨ Break it down" shows its cost only in a `title` tooltip, which touch screens cannot show, and the phone top bar has no "✨ N left today" pill. On phone, the AI cost is invisible.

**Sam (keyboard / screen reader):**
- The tab order is sensible (quick add → search → tag chips → per row: complete, open, star), and focus rings are visible (a violet 2px ring with offset, verified).
- But the P0 focus bug makes the editor unusable by keyboard.
- The Undo toast is unannounced and unreachable in time.
- The "Show steps" disclosure is `text-xs faint`, about 16px tall.
- Section counts ("3/3", "1") are bare numbers after the heading, so a screen reader reads "Overdue 1" with no noun.

**Alex (power user):**
- Natural-language quick add is fast, but nothing on the page responds to a key: no `x` to complete, `s` to star or Enter to open a focused row.
- No multi-select to reschedule five overdue tasks at once.
- The 3-star cap is enforced by a toast after the click, not by disabling the stars.

### Cognitive Load

Checklist failures (3 of 8, **moderate**):
- **Minimal choices:** the task editor shows 16 controls at once on open: Title, Due date, Time, Priority, Estimate, Tags, Goal, Top-3 checkbox, Block-time checkbox, Notes, ✨ Break it down, Add-a-step input, add button, Delete, Focus on this, Done.
- **Progressive disclosure:** Goal, Estimate, Notes and Planner blocking are rarely needed and could sit behind "More details".
- **Visual hierarchy:** on a task row, the chips weigh as much as the title. Six coloured pills under a 14px title pull the eye away from the words.

Decision points with more than 4 options:
- The editor (16, above).
- The per-row metadata strip (up to 7 tokens: due, duration, tags…, priority, block time, steps, goal, from note).
- The tag filter row, which grows with every tag: unbounded, and wraps to a second line on phone.

### Minor Observations

- The H1 "Tasks" uses `gradient-text` (`PageHeader.tsx:8`). This is already slated for removal.
- The empty top-3 hint says "Star (☆)", but the icon is Lucide `Star`, not the ☆ glyph. Close enough, but say "the star".
- `Tasks.tsx:59` puts "⭐" inside the `h2` text, so screen readers announce "star Top 3 today".
- The section hint "What would make today a win" is hidden on phone (`hidden sm:inline`), where the one-line purpose matters most.
- The step checkbox in the editor is 16px square (`TaskEditor.tsx:193`), and the one on the row is 20px round: two different checkbox vocabularies.
- The modal title is just "Task". The task's own title would orient better, with "Edit task" as the accessible name.
- "Estimate (min)" and the Planner block's "Length" are two fields for nearly the same idea, and the Estimate field is still shown once a block is set.
- A completed task row keeps the violet-filled checkbox (`TaskItem.tsx:31`). Per the direction, this should be neutral near-white, or emerald for "done".

## Audit

The detector JSON was opened only after the Critique section above was written.

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | Focus rings and labels are good, but the editor's focus handling is broken (P0). `.faint` text and several chips fail contrast in both themes. The Undo toast has no live region and a fixed timeout. |
| 2 | Performance | 3 | No layout-property animation, and rows use no blur. Small costs remain: `stepsOf` is O(n²) per render, and `background-attachment: fixed` on the body with three radial gradients. |
| 3 | Theming | 2 | Dark and light both work, but every task colour is a raw Tailwind hue (`TaskChips.tsx`, `TaskItem.tsx`), the dialog uses `dark:bg-[#13111f]`, and there are no semantic tokens for priority, status or done. |
| 4 | Responsive Design | 2 | Usable at 390px, with rough edges: 20px complete targets, a 16px step checkbox, FABs over the star column, the syntax placeholder cut off, and the editor's "Done" below the fold. |
| 5 | Implementation Integrity | 2 | Several verified issues: the Modal effect re-runs on every render, Tags is an uncontrolled field, cyan breaks the Atlas Colour Rule in time chips, and violet gradients and glows drift from the direction. |
| **Total** | | **11/20** | **Acceptable** |

**Implementation integrity verdict: fail (fixable).** The task model, grouping and quick-add parser are coherent and product-specific. The failure is one shared primitive (`Modal`) that corrupts input, plus a colour layer that does not express the system's own rules.

### Detector findings

54 findings across the four captures: dark-desktop 15, dark-phone 14, light-desktop 13, light-phone 12. The source scan (`src_scan_all`) has no findings in the Tasks files; its hits are all in shell or other surfaces (`index.css:60-61,79`, `TopBar.tsx:70`, `Logo.tsx:6` and others).

| Rule | Count (all 4 captures) | What it hit | Verdict |
|---|---|---|---|
| `low-contrast` | 22 (5+5+6+6) | Dark: `.faint` slate-500 `#64748b` on `#08070f` 4.2:1 (section counts "3/3", "1") and on row `#121119` 3.9:1 ("from note"); quick-add and Search placeholders 3.9:1. Light: Search placeholder slate-400 2.5:1; `.faint` on `#f1f5f9` 4.3:1; **High** chip `text-rose-600` on rose tint 3.8:1; **Medium** chip amber-700 4.4:1; `#sec-overdue` heading rose-600 on slate-100 4.3:1. Shell: avatar "M" white on pink gradient 3.9:1. | **Real.** The quick-add placeholder carries the only syntax instruction, so it counts as meaningful text. The avatar is shell-level (`TopBar.tsx:70`), not Tasks. |
| `ai-color-palette` | 16 (4 per capture) | Sidebar logo tile gradient; avatar gradient; "Purple/violet accent colors detected" on body; **"Cyan gradient background" on `span.absolute.inset-[18%]` = the Atlas orb**. | Violet hits are real and already slated for removal (DESIGN.md direction). **The cyan orb hit is a false positive**: cyan is reserved for Atlas. |
| `gradient-text` | 6 (2+1+2+1) | `h1.gradient-text` "Tasks" (`PageHeader.tsx:8` → `index.css:59-61`); the sidebar wordmark (desktop only). | Real; already slated (No-Ornament Type Rule). |
| `dark-glow` | 6 (3 dark-desktop, 3 dark-phone) | `btn-primary` "Add" violet glow (`index.css:79-80`); capture FAB `#4c1d95` glow; **Atlas orb `#164e63` glow**. | Add and FAB: real, slated. Orb glow: **intentional for now** (Atlas signature). Flag it for the owner, since the direction says "no glows" outside the HUD. |
| `overused-font` | 4 | Inter is 100% of text. | **False positive.** DESIGN.md chooses one sans family on purpose, and operate.md says one family is often right for product UI. |

**Missed by the detector:** the cyan time chip (it appears only while typing in quick add), the editor focus and keystroke bug, the 20px and 16px touch targets, the unannounced toast, and the star hidden at `md:` widths. These come from the live pass and the source reading.

### Findings by severity

**[P0] Modal focus effect re-runs on every render; the task editor drops keystrokes**
- **Location:** `src/components/ui/Modal.tsx:21-50` (effect deps `[open, onClose]`; the cleanup calls `previous?.focus()`, the setup focuses the first input in `requestAnimationFrame`); `src/components/tasks/TaskEditor.tsx:68` (`onClose={save}`, a new function each render).
- **Category:** Accessibility / Implementation Integrity
- **Impact:** After the first character in any field, focus goes to the trigger behind the dialog, then back to Title, and the keystrokes typed in between are lost. Verified live: Notes kept 1 of 2 characters, "Add a step" 1 of 3, Title 1 of 2. Every other modal passing an inline `onClose` (Habits, Goals, ConvertDialog, PlansSection…) has the same exposure whenever its parent re-renders.
- **WCAG:** 2.4.3 Focus Order; 3.2.2 On Input (unexpected change of context)
- **Recommendation:** Keep `onClose` in a ref and change the effect's dependencies to `[open]`; capture `previous` once per open.
- **Suggested command:** `/impeccable harden`

**[P1] The toast stack has no live region and a fixed 6 s action timeout**
- **Location:** `src/hooks/useToast.tsx:36,44`
- **Category:** Accessibility
- **Impact:** "Completed … · Undo" is never announced, and keyboard users cannot reach Undo before it disappears.
- **WCAG:** 4.1.3 Status Messages; 2.2.1 Timing Adjustable
- **Recommendation:** Add `role="status" aria-live="polite"` to the container; pause the timer on hover and focus; 10 s for action toasts; a keyboard undo for the last completion.
- **Suggested command:** `/impeccable harden`

**[P1] Text contrast below AA in both themes**
- **Location:** `src/index.css:66-67` (`.faint` = slate-500 in dark, used by `Tasks.tsx:86,149,150,167` and `TaskItem.tsx:55,59,61`); `src/components/tasks/TaskChips.tsx:99` (High chip `text-rose-600`), `:104` (Medium chip amber-700 in light); `src/pages/app/Tasks.tsx:146` (Overdue heading `text-rose-600`); `src/index.css:70-72` (placeholders slate-400 in light, slate-500 in dark).
- **Category:** Accessibility
- **Impact:** Section counts, "from note", "Show steps", "3 in the last 60 days", the High and Medium chips and the Overdue heading are hard to read at 11–12px.
- **WCAG:** 1.4.3 Contrast (Minimum)
- **Recommendation:** Dark `.faint` → slate-400 (about 7:1 on `#08070f`). Light chip text → rose-700 / amber-800. Overdue heading → rose-700. Placeholders → slate-500 in light, slate-400 in dark.
- **Suggested command:** `/impeccable polish`

**[P1] The editor has no discard path, and Tags commits only on blur**
- **Location:** `src/components/tasks/TaskEditor.tsx:68,104-109`
- **Category:** Implementation Integrity
- **Impact:** Escape while in Tags saves without the new tags; ✕ saves instead of cancelling (see the Critique).
- **Recommendation:** A controlled Tags field, and an explicit autosave or draft model (see the Critique).
- **Suggested command:** `/impeccable harden`

**[P2] Cyan used for a non-Atlas meaning (time chip)**
- **Location:** `src/components/tasks/TaskChips.tsx:143-147`
- **Category:** Theming / Implementation Integrity
- **Impact:** It breaks the Atlas Colour Rule: the quick-add preview's "3:00 PM" chip looks like an AI result.
- **Recommendation:** A neutral chip with a clock icon.
- **Suggested command:** `/impeccable quieter`

**[P2] Task colours are hard-coded Tailwind hues, not semantic tokens**
- **Location:** `TaskChips.tsx:96-112,139-155`; `TaskItem.tsx:26,31,42,50,83-87`; `TaskEditor.tsx:125,131,193,206,210` (`accent-violet-600`, `bg-violet-600`, `border-violet-400/40`); `Modal.tsx:63` (`dark:bg-[#13111f]`)
- **Category:** Theming
- **Impact:** The neutral-emphasis migration has to touch every file. Priority colours are defined twice (`PRIORITY_STYLES.chip` and `priorityRing`).
- **Recommendation:** Add `--priority-high/med/low`, `--status-overdue`, `--status-done` and `--chip-neutral` tokens, and derive both chip and ring from them.
- **Suggested command:** `/impeccable extract`

**[P2] Gradient and glow drift on this surface**
- **Location:** `src/components/ui/PageHeader.tsx:8` (H1 `gradient-text`); `src/index.css:78-80` (`btn-primary` gradient plus violet glow, used by quick-add "Add" and the editor's "Done"); `src/hooks/useToast.tsx:53` (violet toast glow); capture FAB glow (shell)
- **Category:** Implementation Integrity
- **Impact:** Contradicts the confirmed direction (neutral emphasis, no glows). Already slated.
- **Recommendation:** A near-white solid primary button, a solid H1, and one shallow neutral shadow on toasts.
- **Suggested command:** `/impeccable quieter`

**[P2] Touch targets below 44px on phone**
- **Location:** `TaskItem.tsx:30` (complete circle 20×20, measured); `TaskEditor.tsx:193` (step checkbox 16×16); `Tasks.tsx:85-87` ("Show steps", about 16px tall); tag filter chips 26px tall (`index.css:133-135`)
- **Category:** Responsive
- **Impact:** They pass WCAG 2.5.8 only through the spacing exception. They miss Casey's 44px thumb target, and the complete circle sits next to the full-width "open" button.
- **WCAG:** 2.5.8 Target Size (Minimum): passes by spacing; below the 2.5.5 AAA size
- **Recommendation:** Give the complete button a 44×44 hit area with an invisible padding box around the 20px circle. Do the same for the step checkbox (24px visible). Use 36px chips on phone.
- **Suggested command:** `mobile-native`

**[P2] The star is invisible at `md:` and covered by the FABs on phone**
- **Location:** `TaskItem.tsx:71` (`md:opacity-0`); FAB stack in the app shell
- **Category:** Responsive
- **Impact:** Touch tablets cannot star at all, and on phone the FAB covers a row's star.
- **Recommendation:** Keep a muted outline star always visible, and add a right inset for the FAB stack on phone.
- **Suggested command:** `/impeccable adapt`

**[P3] Section headings: emoji in `h2`, bare counts**
- **Location:** `Tasks.tsx:59,146-150`
- **Category:** Accessibility
- **Impact:** A screen reader says "star Top 3 today, 3/3" and "Overdue, 1".
- **Recommendation:** Make the emoji `aria-hidden` and add an sr-only noun ("3 of 3 starred", "1 task").
- **Suggested command:** `/impeccable polish`

**[P3] The toast's Framer Motion animation ignores reduced motion**
- **Location:** `useToast.tsx:47-52`; no `MotionConfig` or `useReducedMotion` anywhere in `src`
- **Category:** Accessibility
- **Impact:** The CSS 0.01ms rule (`index.css:32-40`) does not reach JS-driven animation, so the toast still rises and scales.
- **WCAG:** 2.3.3 (AAA)
- **Recommendation:** Wrap the app in `<MotionConfig reducedMotion="user">`.
- **Suggested command:** `improve-animations`

### Positive findings

- **Labelled controls everywhere:** each row has distinct `aria-label`s ("Complete '…'", "Open task …", "Add to today's top 3") and `aria-pressed` on the star and tag chips. Disclosures use `aria-expanded`, and sections are `aria-labelledby` their headings.
- **Tab order matches visual order,** and the global `:focus-visible` ring (violet 2px with offset, `index.css:28-30`) shows on every row control, verified live. The star becomes visible on keyboard focus (`md:focus:opacity-100`).
- **Optimistic updates with rollback** (`useListMutation`), and the quick-add parser runs locally with no AI. The preview uses `aria-live="polite"` (`QuickAddTask.tsx:358`).
- **Honest scope:** "Done · N in the last 60 days" matches the query window in `useTasks` (`hooks/data/tasks.ts:163`).

## Motion on this surface

| Animation | Where | Trigger | Duration / easing | Earns its place? |
|---|---|---|---|---|
| Dialog fade + 4px rise (`animate-fade-in`) | `Modal.tsx:63`; keyframes `tailwind.config.js:12,15` | Opening the task editor | 250ms `ease-out`, no exit | Mostly. Shorten to about 180ms. On phone, where the editor is a bottom sheet (`items-end`), a short slide-up would explain where it came from. Exit is instant. |
| Backdrop blur | `Modal.tsx:55` (`backdrop-blur-sm`) | Dialog open | static | Fine; keep it light. |
| Toast enter/exit (Framer Motion `y:20→0`, `scale .95→1`, `layout`) | `useToast.tsx:47-52` | Completing a task, errors, 3-star cap | Framer default spring | Yes, it signals state. It ignores `prefers-reduced-motion` (P3 above), and its violet glow is decoration. |
| Chevron rotate | `Tasks.tsx:90` (Show steps), `Tasks.tsx:166` (Done) | Toggling a disclosure | Tailwind `transition` 150ms `cubic-bezier(.4,0,.2,1)` | Yes. The revealed content appears instantly, which is right for "quick". |
| Row hover border → violet | `TaskItem.tsx:26` | Hover | 150ms | Yes as feedback; the colour should become neutral. |
| Checkbox hover tint | `TaskItem.tsx:30` | Hover | 150ms | Yes. |
| **Completion** | `TaskItem.tsx:27-36` | Clicking the circle | **none**: the row leaves its section at once | **Missing motion.** A 120–150ms check fill and stroke before the row collapses would make the most frequent action feel tactile and confirm which row went. That fits "tactile, confident". |
| Star reveal (opacity) | `TaskItem.tsx:71` via `.icon-btn` `transition` (`index.css:89-91`) | Row hover / focus | 150ms | It hides an important control (P2). Keep the transition and drop `md:opacity-0`. |
| Button press scale 0.97 | `index.css:75` (`.btn active:scale-[0.97]`) | Pressing Add, Done, Delete… | 150ms | Yes; it is the "pressable" feel the direction asks for. |
| Input focus border/ring | `index.css:70-72` | Focus | 150ms | Yes. |
| AI spinner (`animate-spin`) | `Ai.tsx:51` | ✨ Break it down / Read with AI pending | continuous | Yes (loading state). |
| Global reduced-motion kill | `index.css:32-40` | `prefers-reduced-motion: reduce` | 0.01ms | Covers CSS only, not Framer Motion. |

## Machine-readable summary

```json
{"surface":"tasks","critique_total":24,"critique_max":40,"na_heuristics":[],"audit_total":11,
 "issues":[
  {"id":"tasks-1","severity":"P0","title":"Task editor drops keystrokes; focus jumps to Title on every edit","fix":"In Modal, keep onClose in a ref and run the focus effect on [open] only, so focus moves in once and returns once; this fixes all modals that pass inline onClose","command":"/impeccable harden","files":["src/components/ui/Modal.tsx:21","src/components/ui/Modal.tsx:50","src/components/tasks/TaskEditor.tsx:68"],"source":"both"},
  {"id":"tasks-2","severity":"P1","title":"Editor has no cancel; X/Esc/backdrop all save, and Esc loses tag edits","fix":"Choose explicit autosave (controlled Tags field, 'Changes save automatically', footer 'Close') or a draft with discard-confirm on dirty close","command":"/impeccable harden","files":["src/components/tasks/TaskEditor.tsx:68","src/components/tasks/TaskEditor.tsx:104"],"source":"both"},
  {"id":"tasks-3","severity":"P1","title":"Undo toast is silent to screen readers and times out after a fixed 6 s","fix":"role=status aria-live=polite on the toast stack, pause on hover/focus, 10 s for action toasts, keyboard undo for the last completion","command":"/impeccable harden","files":["src/hooks/useToast.tsx:36","src/hooks/useToast.tsx:44"],"source":"both"},
  {"id":"tasks-4","severity":"P1","title":"Faint text, High/Medium chips, Overdue heading and placeholders fail AA contrast","fix":"Dark .faint to slate-400; light chip text rose-700/amber-800; Overdue heading rose-700; placeholders slate-500 (light) / slate-400 (dark)","command":"/impeccable polish","files":["src/index.css:66","src/components/tasks/TaskChips.tsx:99","src/components/tasks/TaskChips.tsx:104","src/pages/app/Tasks.tsx:146","src/index.css:70"],"source":"audit"},
  {"id":"tasks-5","severity":"P2","title":"Chip rainbow: six hues per row, cyan time chip breaks the Atlas Colour Rule, priority repeated as checkbox ring","fix":"Neutral chips for date/time/duration/tags; colour only overdue and high priority; neutral checkbox ring; label the block line 'Blocked 14:00-15:00'","command":"/impeccable quieter","files":["src/components/tasks/TaskChips.tsx:138","src/components/tasks/TaskChips.tsx:144","src/components/tasks/TaskItem.tsx:42","src/components/tasks/TaskItem.tsx:50","src/components/tasks/TaskItem.tsx:83"],"source":"both"},
  {"id":"tasks-6","severity":"P2","title":"Star hidden at md+ (invisible on touch tablets) and covered by the FABs on phone","fix":"Always show a muted outline star; keep a right inset clear of the FAB stack on phone or move the star left","command":"/impeccable adapt","files":["src/components/tasks/TaskItem.tsx:71"],"source":"both"},
  {"id":"tasks-7","severity":"P2","title":"Quick add silently blocks Planner time; plain adds give no confirmation","fix":"Show a '-> Planner 15:00-16:00' chip in the preview when a block will be created; scroll to and flash the new row after any add","command":"/impeccable clarify","files":["src/lib/quickAdd.ts:90","src/components/tasks/QuickAddTask.tsx:329","src/components/tasks/QuickAddTask.tsx:357"],"source":"critique"},
  {"id":"tasks-8","severity":"P2","title":"Gradient H1, gradient+glow primary button and violet toast glow drift from the direction","fix":"Solid near-white primary button, solid H1, one shallow neutral toast shadow","command":"/impeccable quieter","files":["src/components/ui/PageHeader.tsx:8","src/index.css:78","src/hooks/useToast.tsx:53"],"source":"both"},
  {"id":"tasks-9","severity":"P2","title":"Touch targets below 44px: 20px complete circle, 16px step checkbox, 16px 'Show steps', 26px tag chips","fix":"44x44 hit area around the complete circle and the step checkbox; taller disclosure and chips on phone","command":"mobile-native","files":["src/components/tasks/TaskItem.tsx:30","src/components/tasks/TaskEditor.tsx:193","src/pages/app/Tasks.tsx:85","src/index.css:133"],"source":"both"},
  {"id":"tasks-10","severity":"P2","title":"Task colours are hard-coded Tailwind hues; priority defined twice; dialog hex background","fix":"Semantic tokens for priority/overdue/done/neutral chip; derive the chip and ring from one map","command":"/impeccable extract","files":["src/components/tasks/TaskChips.tsx:96","src/components/tasks/TaskItem.tsx:83","src/components/tasks/TaskEditor.tsx:125","src/components/ui/Modal.tsx:63"],"source":"audit"},
  {"id":"tasks-11","severity":"P3","title":"Editor shows 16 controls at once; phone sheet autofocuses Title and buries Done","fix":"Title, Due, Priority, Steps up front; Goal/Estimate/Notes/Planner block behind 'More details'; sticky footer on phone; no autofocus on touch","command":"/impeccable distill","files":["src/components/tasks/TaskEditor.tsx:69","src/components/ui/Modal.tsx:43"],"source":"critique"},
  {"id":"tasks-12","severity":"P3","title":"Section headings: emoji inside h2 and bare counts","fix":"aria-hidden emoji; sr-only nouns ('3 of 3 starred', '1 task')","command":"/impeccable polish","files":["src/pages/app/Tasks.tsx:59","src/pages/app/Tasks.tsx:149"],"source":"audit"},
  {"id":"tasks-13","severity":"P3","title":"Completing a task has no tactile motion, and the toast ignores reduced motion","fix":"120-150ms check fill before the row collapses; MotionConfig reducedMotion='user' app-wide","command":"improve-animations","files":["src/components/tasks/TaskItem.tsx:27","src/hooks/useToast.tsx:47"],"source":"audit"}
 ]}
```
