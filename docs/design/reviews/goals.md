# Goals: critique & audit (Phase 1 baseline)

Method: design review (sub-agent, screenshots + source + live app) → then detector evidence (Phase 0 CDP scans, both themes, desktop + phone)

Evidence used for the critique: the four `goals.jpg` screenshots (dark/light × desktop/phone), the source listed below, and a live Playwright pass against `http://localhost:5173/app/goals` as Maya at 1440×900 and 390×844 (touch-target sizes, tab order, the New goal and Edit goal dialogs, typing into the dialog fields). Every non-GET request to Supabase was aborted during the typing test, and no dialog was saved, so no data changed. The ✨ Make a plan button was not pressed; the plan dialog is reviewed from source.

Source: `src/pages/app/Goals.tsx`, `src/components/goals/GoalCard.tsx`, `src/hooks/data/goals.ts`, `src/lib/confetti.ts`, `src/components/ui/EmojiPicker.tsx`, plus `src/components/ui/{Modal,Ai,PageHeader,States}.tsx`, `src/hooks/data/cache.ts`, `src/hooks/useAi.ts`, `src/components/layout/AppShell.tsx`, `src/index.css`, `tailwind.config.js`.

## Critique

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Bumps are optimistic and instant, the bar and "5 books to go" update together, and Make a plan shows a spinner. But `goalPercent` rounds, so 99.5% of a goal shows "100%" and a full bar while the line below still says "0.5 km to go". After accepting a plan, "Added 3 milestones and 7 tasks" is shown before the tasks insert has finished (`Goals.tsx:73-74`). |
| 2 | Match System / Real World | 2 | "Now at / Target / Unit" and "5 books to go" are plain language. The percentage is written "Title 📚 – 58%" with an en dash; on phone it wraps to its own line as "– 58%", which reads as minus 58%. The dialog says goals are "Shown as 'Title target unit'", but the card shows the title exactly as typed, so "Read 12 books this year" keeps saying 12 after the target is changed to 15. |
| 3 | User Control and Freedom | 2 | Progress can go down as well as up, and a goal that drops below target returns to the active list. But deleting a goal uses `window.confirm` with no undo (Brain Dump, Calendars and Habits archive use an Undo toast). Removing a milestone in the edit dialog deletes it immediately, even if the dialog is then closed without Save. Milestones can be ticked and removed but never added or renamed by hand. |
| 4 | Consistency and Standards | 2 | Reaching the target with + celebrates (confetti + toast); reaching it by typing in the edit dialog silently completes the goal. The plan dialog says "Edit or remove anything", but plan tasks can only be removed. The emoji is shown twice on every card (tile and after the title). The primary-gradient "+1" button gives a routine counter the same weight as "New goal". |
| 5 | Error Prevention | 0 | The edit dialog drops keystrokes: typing in Now at, Target or Unit moves focus to the Goal title after the first character (verified live, P0 below). Typing "250" in Target left "2" there and put "50" into the title. The plan dialog lets a milestone title be emptied and still saved. A title with a number in it silently disagrees with the target. |
| 6 | Recognition Rather Than Recall | 3 | Each card shows current, target, unit, deadline, what is left and how many open tasks and habits are linked, so nothing has to be remembered. The counts are plain text, though: you can't get from "3 open tasks" to those tasks. |
| 7 | Flexibility and Efficiency | 2 | The +/– step is chosen by the size of the target (1, 5 or 50: `GoalCard.tsx:10-12`), so "Save 2,000" can only move in 50s from the card; any other amount means opening the dialog. There is no inline number entry and no keyboard shortcut for the counter. |
| 8 | Aesthetic and Minimalist Design | 2 | The card structure is clear, but every bar is a violet→blue→pink gradient, the percentage is violet, the H1 is gradient text and both "+1" and "New goal" are glowing violet gradients. On phone the fixed + FAB sits over the second card's "+1" button while scrolling. |
| 9 | Error Recovery | 2 | "The target must be a number above 0." is a toast, not a message on the field, and the field is not marked invalid. Save failures produce the generic "That change could not be saved. Please try again." with the optimistic change silently rolled back. |
| 10 | Help and Documentation | 3 | The page description and the empty state both explain what a goal is here ("something measurable… like 'Run 100 km'") and mention ✨ Make a plan. The AI button's tooltip states the allowance cost. The dialog's "Shown as" hint is wrong (see 2). |
| **Total** | | **21/40** | **Acceptable** |

### Design Specificity Verdict

**LLM assessment:** The idea is specific to Daybloom; the skin is not. A goal here is deliberately a number ("Read 12 books", "Run 100 km") with a visible remainder ("5 books to go"), a deadline, and counts of the tasks and habits that feed it. That is a good, honest product decision for students: it refuses vague "be healthier" goals and gives a number you can move in two seconds between lectures. The ✨ Make a plan flow also fits the product's AI stance: it drafts milestones and tasks, you prune them, and nothing is written until you press "Add to my goal".

The presentation is category-interchangeable: an emoji tile, a rainbow gradient progress bar, a violet percentage, a gradient H1 and a gradient pill button are the stock "habit tracker template" look, and they contradict "The Clear Head" (neutral emphasis, colour only for meaning). The biggest missed opportunity is that the number and the plan never meet. Milestones are a checklist that has no effect on the number, and the deadline has no relationship to progress, so the card can't tell Maya the one thing a student wants to know: "am I on track?" A plain, calculated line such as "Needs 1 book every 9 days to finish by 28 Dec" would be specific, honest and useful.

### What's Working

1. **The number is the goal** (`GoalCard.tsx:40-58`). "7 of 12 books · by Dec 28, 2026" and "5 books to go · 1 habit" are calculated directly from stored values, with the unit written out and no invented "insights". It is the honest-numbers commitment done right in its basic form.
2. **One-tap progress with symmetric undo** (`Goals.tsx:47-55`). + and – update optimistically; going back below the target clears `completed_at` and the goal returns to the active list, so a mis-tap at the finish line is recoverable. Confetti respects reduced motion (`confetti.ts:5`, `disableForReducedMotion: true`).
3. **AI drafts, the user decides** (`Goals.tsx:205-255`). The plan opens as an editable review ("Edit or remove anything, then add it"), with remove buttons on every milestone and task, Discard as an equal choice, and the allowance cost on the button's tooltip ("Uses 1 of your 15 AI actions left today").

### Priority Issues

**[P0] The goal dialog drops keystrokes and moves focus to the title on every edit**
- **What:** Both dialogs pass an inline `onClose={() => setEditor(null)}` / `onClose={() => setPlanFor(null)}` (`Goals.tsx:132`, `Goals.tsx:206`). `Modal`'s focus effect depends on `[open, onClose]` (`Modal.tsx:21-50`), so every state change re-runs it: the cleanup focuses the element behind the dialog, and the setup focuses the first `[autofocus]`/input on the next frame. Verified live in New goal: clicking Unit and typing "km" left "k" in Unit and "m" in the Goal title; selecting Target and typing "250" left "2" in Target and "50" appended to the title. Clicking an emoji also throws focus to the title. The same pattern will send focus to milestone 1 while editing milestone 2 in the ✨ plan dialog.
- **Why it matters:** Creating or editing a goal is the core task of this page, and the number fields are the point of a goal. A student types a target of 250 and gets 2, with "50" glued to the title. This silently corrupts the numbers the page promises to be honest about.
- **Fix:** Make `Modal`'s effect independent of `onClose` identity: keep `onClose` in a ref (`const close = useRef(onClose); close.current = onClose;`) and depend only on `[open]`. That fixes every dialog in the app at once. Add a Playwright test that types into a non-first field and asserts both value and focus.
- **Suggested command:** `/impeccable harden`

**[P1] Milestones can only come from AI**
- **What:** There is no way to add or rename a milestone by hand. The only creation paths are ✨ Make a plan (`Goals.tsx:68-76`) and the ✨ note panel (`AiNotePanels.tsx:249-261`); the edit dialog can only remove them (`Goals.tsx:166-182`).
- **Why it matters:** PRODUCT.md commits that "every feature still works without AI" and that AI is "a helper, never a requirement". A student who is out of allowance, or who simply wants to write "Finish chapter 3", can't. It also means the AI's draft milestone titles can never be corrected after adding.
- **Fix:** In the edit dialog's Milestones section, add an "Add a milestone" input (Enter to add) and make each existing title an inline-editable field, all applied on Save. Show the section for every goal, not only those that already have milestones.
- **Suggested command:** `/impeccable clarify`

**[P1] The percentage can claim more progress than the numbers show, and the title can contradict the target**
- **What:** `goalPercent` uses `Math.round` (`GoalCard.tsx:7`): 9.95 of 10 km renders "– 100%" and a full bar beside "0.05 km to go". The en-dash format "– 58%" (`GoalCard.tsx:38`) wraps on phone to a line beginning "– 58%", which reads as a negative number (visible in both phone screenshots). The edit dialog promises "Shown as 'Title target unit'" (`Goals.tsx:132`), but the card shows the free-text title, so changing the target from 12 to 15 leaves "Read 12 books this year · 7 of 15 books".
- **Why it matters:** "Honest numbers" is one of the four binding commitments, and "every number says how it was calculated". A goal that says 100% before it is reached, or a percentage that looks negative, breaks trust in exactly the number this page exists to show.
- **Fix:** Use `Math.floor` (and show "<1%" for small non-zero progress), so 100% appears only when `current >= target`. Move the percentage out of the title into the progress row ("7 of 12 books · 58%"), with no dash. Replace the dialog description with what actually happens ("The title is shown as you write it; progress shows as 'current of target unit'"), or drop the number from the placeholder example so titles don't duplicate the target.
- **Suggested command:** `/impeccable clarify`

**[P1] Deleting a goal or a milestone can't be undone, and milestone removal ignores Save**
- **What:** Goal delete is `window.confirm` then an immediate delete (`Goals.tsx:189-191`). The ✕ on a milestone inside the edit dialog deletes it from the database at once (`Goals.tsx:175`), so closing the dialog with ✕ or Escape does not cancel it, unlike every other field in the same form.
- **Why it matters:** A browser confirm is jarring on phone and inconsistent with the Undo toasts used in Brain Dump, Calendars and Habits. Within one form, some edits wait for Save and one is instant and permanent, which breaks the user's model of "Close = cancel".
- **Fix:** Delete goals optimistically with an Undo toast (`toast('Deleted 📚 Read 12 books', { label: 'Undo', … })`), restoring the goal and its milestones. Stage milestone removals (and the new add/rename from the P1 above) in `editor` state and apply them in `save()`.
- **Suggested command:** `/impeccable harden`

**[P2] The card's colour carries no meaning, and the counter shouts**
- **What:** The progress fill is `bg-gradient-to-r from-violet-500 via-blue-500 to-pink-500` (`GoalCard.tsx:52`), the percentage is violet (`GoalCard.tsx:38`), the emoji tile is violet-tinted (`GoalCard.tsx:33`), and the "+1" counter uses `btn-primary` (`GoalCard.tsx:65`), the same glowing gradient as "New goal". On a page with four goals, there are four primary buttons.
- **Why it matters:** The confirmed direction is neutral near-white emphasis and colour for meaning only. Here colour is decoration, and the one meaningful state (reached vs. in progress vs. behind schedule) has no colour at all.
- **Fix:** Solid neutral fill for the bar (near-white in dark, ink in light) and emerald only when reached. Make + and – a matched pair of ghost/secondary buttons. Keep one primary on the page: "New goal". Drop the duplicate emoji after the title.
- **Suggested command:** `/impeccable quieter`

**[P2] Milestone checkboxes are 16px and their labels aren't clickable**
- **What:** Each milestone is a 16×16 button followed by a plain `<span>` (`GoalCard.tsx:75-83`), measured live at 16×16 on both desktop and phone. Rows are 24px apart.
- **Why it matters:** On a phone, ticking "Run 8K" means hitting a 16px square; tapping the words does nothing. It is the only interactive control on the card that small.
- **Fix:** Make the whole row the button (or wrap in a `<label>` with a real checkbox), with a min height of 44px on touch (`min-h-11 sm:min-h-8`), and keep the 16px visual box inside it.
- **Suggested command:** `mobile-native`

### Persona Red Flags

**Casey (distracted mobile user, one thumb, between lectures):**
- Opens Edit goal to fix the target, taps Target, types "15": Target becomes "1" and "5" lands in the title. Saves without noticing (P0).
- On the second card, the fixed + FAB (`AppShell.tsx:126`, `bottom-20 right-4`) sits over the "+1" button while scrolling (visible in the phone screenshots at y≈1320), so the most common action on the page is under a different button.
- Milestone boxes are 16px and the label isn't tappable; the edit pencil is 32px and the bump buttons are 36×32 / 48×32, all under 44px.
- Delete is a browser `confirm()` sheet with no undo afterwards.

**Jordan (first-timer, a student setting a first goal):**
- The dialog tells them it will show "Title target unit", so they type "Read" as the title, 24 and "books"; the card then reads "Read 📚 – 0%" and "0 of 24 books": the promised format never appears.
- Wants to break the goal into steps without AI, finds a Milestones section only in the edit dialog of goals that already have milestones, and only with remove buttons. Concludes milestones are an AI-only feature.
- After reaching 100% on one goal and seeing confetti, edits another goal straight to its target and gets no celebration at all; the goal just disappears into "Completed 🏆".

**Sam (keyboard and screen reader):**
- Tab order on the page is logical (New goal → Edit → – → + → milestones → Make a plan, per card). But in the dialog, keyboard focus is yanked back to the title after every keystroke in another field (P0).
- The emoji picker's 16 buttons have no accessible name or `aria-pressed` (`EmojiPicker.tsx:5-17`): the screen reader announces "button" or the raw emoji, and the selected one is shown only by a violet ring.
- The title heading reads "Read 12 books this year books emoji en-dash 58 percent"; the percentage is announced twice (heading and progressbar), and the "to go" line is 12px text at 3.9:1 in dark mode.

### Cognitive Load

Checklist failures (2 of 8, moderate):
- **Visual hierarchy:** each card has two violet gradient elements (the bar and the "+1" button), a violet percentage and a violet ✨ button competing at the same weight. The one primary action, "New goal", doesn't stand out once there are several cards.
- **Single focus (edit dialog):** the dialog stacks Goal, Now at, Target, Unit, Deadline, a 16-option emoji grid, the milestone list, Delete and Save in one sheet; on phone (390 wide) it fills the screen. The emoji grid is the visually loudest thing in it and the least important.

Decision points with more than 4 options:
- **Emoji picker:** 16 equal-weight options (`Goals.tsx:18`). It is low-stakes, so this is acceptable, but it could collapse to the current emoji plus "Change".
- **Each goal card:** up to 5 actions (Edit, –, +, each milestone checkbox, ✨ Make a plan). That's fine on its own, but with milestones it grows unbounded.

### Minor Observations

- The "Completed 🏆" section reuses full active cards, including the bump buttons and gradient bar; finished goals deserve a quieter, compact row with the completion date (`Goals.tsx:124-129`).
- `completed_at` is set on reach, but no completion date is shown anywhere.
- Above 100% the bar is capped and the card reads "13 of 12 books · Target reached 🏆". That is honest, but "1 book over target" would be nicer than a silent cap.
- The plan dialog shows task dates as raw ISO strings ("2026-11-04", `Goals.tsx:231`) while the cards use "Dec 28, 2026".
- The "–" decrease button has no visible step; only "+ 1" shows the amount, so "– 50" on a savings goal is a surprise.
- The deadline is never compared to today: an overdue goal looks exactly like one due next year.
- The plan-dialog remove buttons have no `type="button"` (harmless today, as there is no `<form>`).

## Audit

The detector JSON (`.scratch/review-input/goals-detector.json`) was opened only after the critique above was written.

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 1 | The goal dialog moves keyboard focus to the title after every keystroke in any other field (verified live). The 12px "to go / open tasks" line is 3.9:1 in dark mode, and white "+ 1" text on the gradient is 4.0:1 in both themes. The emoji picker buttons have no name or pressed state. Toasts, including "Goal reached", are not in a live region. |
| 2 | Performance | 3 | The route is lazy-loaded (`App.tsx:26`), so `canvas-confetti` only ships with Goals. Per-card `filter`s over milestones/tasks/habits are O(goals × items) per render, which is fine at student scale. The progress fill animates `width` for 500ms, and every card is a `backdrop-blur-xl` glass layer over a fixed gradient background. |
| 3 | Theming | 2 | Everything goes through Tailwind's `dark:` variant and both themes are complete, but the colour is hard-coded palette classes (`bg-violet-500/15`, `text-violet-700 dark:text-violet-300`, `border-violet-600 bg-violet-600`, `from-violet-500 via-blue-500 to-pink-500`) rather than semantic tokens. The dark modal surface is a literal `#13111f` (`Modal.tsx:63`), and the confetti palette is a hex list (`confetti.ts:4`). |
| 4 | Responsive Design | 2 | The one-to-two-column grid and the bottom-sheet dialog work at 390px with no horizontal scroll. But milestone checkboxes are 16×16, the edit pencil is 32×32, the bump buttons are 36×32 and 48×32, and the global + FAB overlaps the second card's "+1" button while scrolling on phone. |
| 5 | Implementation Integrity | 2 | Several verified integrity problems: the focus bug corrupts entered numbers. Milestones can only be created by AI, against the "everything works without AI" commitment. The percentage rounds up to 100% before the goal is reached. The dialog describes a "Title target unit" display that doesn't exist. The plan-accept toast claims tasks were added before the insert resolves. |
| **Total** | | **10/20** | **Acceptable** |

**Implementation Integrity verdict: fail.** The structure is product-specific and the stored numbers are honest, but what is displayed and what is typed are not reliably the same as what is stored (P0 focus bug, P1 rounding), and one feature (milestones) quietly requires AI.

### Detector findings

68 findings across the four scans (dark-desktop 20, dark-phone 20, light-desktop 14, light-phone 14), plus 12 source-scan findings for the whole repo, of which 1 is in this surface's files (`GoalCard.tsx:52`).

| Rule | Count (dd / dp / ld / lp) | Where | Verdict |
|------|------|------|---------|
| `ai-color-palette` | 6 / 6 / 6 / 6 | Progress fills of both cards (`GoalCard.tsx:52`), "Purple/violet accent colors" on body, sidebar/mobile logo tile, avatar, Atlas orb cyan gradient | **Real** for the two progress bars and the violet accents (slated for removal per DESIGN.md). **Real but out of scope** for the logo and avatar (shell). **False positive** for `span.absolute.inset-[18%]`, the Atlas orb, whose cyan is intentionally reserved for Atlas. |
| `low-contrast` | 5 / 5 / 4 / 4 | White on gradient: "+ 1" bump buttons on both cards (4.0:1) and "New goal" (3.9:1); avatar initial (3.9:1, shell); `span.faint.text-xs` "5 books to go · 1 habit" at 3.9:1 (dark only) | **Real.** All are 12–14px text below 4.5:1. I measured the same `#64748b` on `#14131b` = 3.88:1. In light mode the faint line passes (4.59:1), which matches the scan not flagging it. |
| `dark-glow` | 5 / 5 / 0 / 0 | Violet box-shadow on "New goal" and both "+1" buttons; FAB glow (`#4c1d95`); Atlas orb glow (`#164e63`) | **Real** for the three `btn-primary` glows (direction: no glows). The orb glow is Atlas cyan (acceptable to keep, but DESIGN.md says no glows outside the HUD, so it's a shell decision). FAB is shell. |
| `gradient-text` | 2 / 1 / 2 / 1 | `h1.gradient-text` "Goals" (`PageHeader.tsx:8`), sidebar wordmark | **Real**, shared component, already slated for removal. |
| `skipped-heading` | 1 / 1 / 1 / 1 | `<h1>` "Goals" → `<h3>` goal titles | **Real.** Active cards have no `<h2>`; only the Completed section has one (`Goals.tsx:126`). |
| `unbalanced-heading` | 0 / 1 / 0 / 1 | Card title wraps to a line holding only "– 58%" on phone | **Real**, and it's the same wrap that makes the percentage read as negative (critique P1). |
| `overused-font` | 1 / 1 / 1 / 1 | Inter for 100% of text | **False positive** for an Operate surface: one well-tuned sans is what operate.md recommends, and Inter is the documented system font. |

Things the detector missed that I verified: the dialog focus-jump (P0), 16px milestone targets, the light-mode unchecked milestone border at 2.47:1 (`border-slate-400` on the card), unlabelled emoji buttons, toasts with no live region, the FAB overlap, and all the honest-numbers logic issues (rounding, title/target mismatch, premature "Added" toast).

### Findings by severity

**[P0] Dialog focus is reset on every state change**
- **Location:** `src/components/ui/Modal.tsx:21-50` (effect deps `[open, onClose]`), triggered by the inline `onClose` arrows at `src/pages/app/Goals.tsx:132` and `src/pages/app/Goals.tsx:206`
- **Category:** Accessibility / Implementation Integrity
- **Impact:** Typing in Now at, Target, Unit or Deadline, or picking an emoji, sends focus back to the Goal title; subsequent characters land in the title. Verified live: Unit "km" → Unit "k", title "m"; Target "250" → Target "2", title "…50". Breaks keyboard use and silently corrupts the goal's numbers. The same pattern affects the ✨ plan dialog's milestone inputs.
- **WCAG:** 2.4.3 Focus Order, 3.2.2 On Input
- **Recommendation:** Store `onClose` in a ref inside `Modal` and depend only on `open`; add a regression test that types into the third field of a dialog.
- **Suggested command:** `/impeccable harden`

**[P1] Body text and button labels below 4.5:1**
- **Location:** `src/components/goals/GoalCard.tsx:55` (`.faint text-xs`, dark 3.88:1); `src/components/goals/GoalCard.tsx:65` and `src/pages/app/Goals.tsx:112` (white on `btn-primary` gradient, 3.9–4.0:1 at the blue end, `src/index.css:78-81`)
- **Category:** Accessibility
- **Impact:** The "5 books to go · 1 habit" line, which carries the remaining amount and linked counts, is hard to read in the default dark theme; the "+ 1" label fails in both themes.
- **WCAG:** 1.4.3 Contrast (Minimum)
- **Recommendation:** Use `.muted` (7.2:1 on the dark card) for the progress line, and move the counter off `btn-primary` to a neutral secondary button. The direction's near-white primary with dark text resolves "New goal" too.
- **Suggested command:** `/impeccable colorize`

**[P1] Milestones require AI to exist**
- **Location:** `src/pages/app/Goals.tsx:166-182` (edit dialog: remove only); creation only at `src/pages/app/Goals.tsx:71` and `src/components/notes/AiNotePanels.tsx:260`
- **Category:** Implementation Integrity
- **Impact:** Breaks PRODUCT.md "every feature still works without AI".
- **Recommendation:** Add and rename milestones in the edit dialog, staged until Save.
- **Suggested command:** `/impeccable clarify`

**[P1] Displayed percentage and title can contradict the stored numbers**
- **Location:** `src/components/goals/GoalCard.tsx:7` (`Math.round`), `src/components/goals/GoalCard.tsx:38` ("– {pct}%" in the h3), `src/pages/app/Goals.tsx:132` (description "Shown as 'Title target unit'")
- **Category:** Implementation Integrity
- **Impact:** "100%" with a full bar before the target is reached; "– 58%" reads as negative on phone; the dialog promises a format the card doesn't use.
- **Recommendation:** `Math.floor`, percentage in the progress row without a dash, accurate dialog copy.
- **Suggested command:** `/impeccable clarify`

**[P1] Destructive actions without undo; milestone removal bypasses Save**
- **Location:** `src/pages/app/Goals.tsx:189-191` (`window.confirm` + delete), `src/pages/app/Goals.tsx:175` (immediate milestone delete)
- **Category:** Implementation Integrity
- **Impact:** Inconsistent with the Undo-toast pattern in Brain Dump, Calendars and Habits; Escape/✕ doesn't cancel a milestone removal.
- **Recommendation:** Optimistic delete + Undo toast; stage milestone edits in `editor` state.
- **Suggested command:** `/impeccable harden`

**[P2] Decorative violet/gradient colour and glows on every card**
- **Location:** `src/components/goals/GoalCard.tsx:33`, `:38`, `:52`, `:65`, `:78`; `src/components/ui/EmojiPicker.tsx:13`; `src/lib/confetti.ts:4`; `src/index.css:78-81`
- **Category:** Theming
- **Impact:** Contradicts the confirmed direction (neutral emphasis, no gradients or glows); colour carries no state, so "reached" and "behind" look identical. Detector: 24 `ai-color-palette`, 10 `dark-glow`.
- **Recommendation:** Semantic tokens: neutral fill for progress, emerald for reached, neutral checkbox fill, near-white selection ring in the emoji picker, a neutral/emerald confetti palette.
- **Suggested command:** `/impeccable quieter`

**[P2] Small touch targets and a weak unchecked-box border**
- **Location:** `src/components/goals/GoalCard.tsx:75-83` (16×16 milestone button, label not clickable), `:46` (32×32 edit), `:62-67` (36×32 / 48×32 bumps); unchecked border `border-slate-400` at 2.47:1 on the light card (`:78`)
- **Category:** Responsive / Accessibility
- **Impact:** Hard to hit one-handed. The 16px boxes sit exactly 24px apart, so they only just pass the 2.5.8 spacing exception; the light-mode box outline fails non-text contrast.
- **WCAG:** 1.4.11 Non-text Contrast (light unchecked box); 2.5.8 borderline
- **Recommendation:** Full-row milestone button ≥44px tall on touch; 40–44px bump and edit buttons on phone; `border-slate-500` or darker for the empty box.
- **Suggested command:** `mobile-native`

**[P2] Emoji picker and goal-reached toast are invisible to screen readers**
- **Location:** `src/components/ui/EmojiPicker.tsx:5-17` (no `aria-label`, no `aria-pressed`, no group label; the "Emoji" `<span class="label">` at `Goals.tsx:163` isn't associated); `src/hooks/useToast.tsx` (no `aria-live`/`role="status"` on the toast region)
- **Category:** Accessibility
- **Impact:** Selected emoji is conveyed only by a violet ring; "🏆 Goal reached" and "Added 3 milestones and 7 tasks" are never announced.
- **WCAG:** 4.1.2 Name, Role, Value; 4.1.3 Status Messages
- **Recommendation:** `role="radiogroup" aria-labelledby` on the picker, `role="radio" aria-checked` + `aria-label` per option; `role="status" aria-live="polite"` on the toast container.
- **Suggested command:** `/impeccable harden`

**[P2] The global + FAB covers the "+1" counter on phone**
- **Location:** `src/components/layout/AppShell.tsx:126` (`fixed bottom-20 right-4`) against the right-aligned bump row at `src/components/goals/GoalCard.tsx:61`
- **Category:** Responsive
- **Impact:** In the phone screenshots the FAB sits on top of the second card's "+ 1". Scrolling clears it, but the page's most frequent action is the one being covered.
- **Recommendation:** Put the bump pair on the left of the progress row on phone (thumb-side, away from the FAB column), or reserve a right gutter for the FAB on card action rows.
- **Suggested command:** `/impeccable layout`

**[P2] Plan acceptance reports success early and accepts blank milestones**
- **Location:** `src/pages/app/Goals.tsx:73-74` (`addTasks.mutate` not awaited before the "Added N milestones and M tasks" toast); `src/pages/app/Goals.tsx:212-217` (milestone title can be emptied); `:71` (`mutateAsync` rejection unhandled)
- **Category:** Implementation Integrity
- **Impact:** If the task insert fails, the user sees "Added 7 tasks" followed by an error toast, and the counts are wrong. Blank milestone titles are saved.
- **Recommendation:** `await addTasks.mutateAsync`, wrap in try/catch, trim and drop empty titles, and toast the counts actually returned.
- **Suggested command:** `/impeccable harden`

**[P3] Heading structure**
- **Location:** `src/components/goals/GoalCard.tsx:37-39` (`h3` directly under the page `h1`; the heading includes the emoji and percentage)
- **Category:** Accessibility
- **Impact:** Skipped level (detector, all four scans); the accessible heading name is "Read 12 books this year 📚 – 58%".
- **WCAG:** 1.3.1 Info and Relationships (best practice)
- **Recommendation:** Add a visually hidden `<h2>Active goals</h2>` (or make card titles `h2`), and keep only the title text in the heading.
- **Suggested command:** `/impeccable polish`

**[P3] Progress fill animates width for 500ms**
- **Location:** `src/components/goals/GoalCard.tsx:52` (`transition-[width] duration-500`)
- **Category:** Performance
- **Impact:** Layout-property animation, longer than the 150–250ms Operate budget; with rapid bumps the bar lags the number.
- **Recommendation:** `transform: scaleX()` with `origin-left`, 200ms ease-out.
- **Suggested command:** `animation-performance`

### Positive findings

- The page is lazy-loaded, and confetti respects reduced motion (`disableForReducedMotion: true`), on top of the global reduced-motion rule (`index.css:32-41`).
- Every icon-only control on the card has a specific accessible name ("Edit goal Read 12 books this year", "Decrease by 1", "Complete milestone 'Run 8K'"), and the progress bar is a real `role="progressbar"` with values and a label.
- Page tab order is logical and per card (verified live at both sizes), and `Modal` traps Tab, closes on Escape and restores focus.
- Optimistic mutations with rollback (`hooks/data/cache.ts`) make the counter feel instant and recover cleanly on failure.
- The number inputs use `type="number" min={0} step="any"`, so decimals like 6.5 km work and the phone shows a numeric keypad.

## Motion on this surface

| Motion | Where | Trigger | Duration / easing | Earns its place? |
|--------|-------|---------|-------------------|------------------|
| Progress fill width transition | `GoalCard.tsx:52` | Bump, edit, load | 500ms, default ease | Yes as feedback (the bar moving confirms the bump), but too slow and animates `width`. Use 200ms `scaleX`. |
| Confetti burst (90 particles, violet/indigo/blue/pink) | `confetti.ts:3-5`, called at `Goals.tsx:51` | Reaching the target via + | canvas-confetti default (~2–3s) | Yes. It is a rare, earned peak moment, and reduced motion is respected. Retone away from violet/pink, and fire it on reaching the target from the edit dialog too (`Goals.tsx:63`) for consistency. |
| Modal fade-in + 4px rise | `Modal.tsx:63`, `tailwind.config.js:12-15` | Opening New/Edit goal or the plan | 250ms ease-out | Yes, but it's at the top of the budget; 150–200ms would feel quicker. The `backdrop-blur-sm` overlay (`Modal.tsx:55`) adds cost for no meaning. |
| Button press scale | `index.css` `.btn` (`active:scale-[0.97]`) | Pressing +, –, New goal, Save | Tailwind default 150ms | Yes. Tactile press feedback fits "tactile, confident". |
| Emoji hover scale 110% | `EmojiPicker.tsx:12` (`transition hover:scale-110`) | Hover over an emoji | 150ms | Marginal: decorative, and sticky on touch. Replace with a background tint. |
| AI loading spinner | `Ai.tsx:51` (`animate-spin`) | Make a plan in flight | 1s linear loop | Yes. It shows a real wait. |
| Skeleton pulse | `States.tsx:43` (`animate-pulse`) | Goals loading | 2s loop | Yes. |
| Colour/background transitions | `.icon-btn`, `.input`, `.btn-ghost` (`index.css`) | Hover/focus | 150ms | Yes, quiet state feedback. |

## Machine-readable summary

```json
{"surface":"goals","critique_total":21,"critique_max":40,"na_heuristics":[],"audit_total":10,
 "issues":[
  {"id":"goals-1","severity":"P0","title":"Goal and plan dialogs move focus to the title after each keystroke, corrupting entered numbers","fix":"Keep onClose in a ref inside Modal and depend only on [open]; add a test that types into a non-first dialog field","command":"/impeccable harden","files":["src/components/ui/Modal.tsx:21","src/pages/app/Goals.tsx:132","src/pages/app/Goals.tsx:206"],"source":"both"},
  {"id":"goals-2","severity":"P1","title":"Milestones can only be created by AI","fix":"Add 'Add a milestone' and inline rename in the edit dialog, staged until Save, shown for every goal","command":"/impeccable clarify","files":["src/pages/app/Goals.tsx:166"],"source":"both"},
  {"id":"goals-3","severity":"P1","title":"Percentage rounds to 100% before the target, reads as negative, and the dialog misdescribes the title format","fix":"Use Math.floor (100% only when reached), move the percentage into the progress row without a dash, rewrite the dialog description","command":"/impeccable clarify","files":["src/components/goals/GoalCard.tsx:7","src/components/goals/GoalCard.tsx:38","src/pages/app/Goals.tsx:132"],"source":"both"},
  {"id":"goals-4","severity":"P1","title":"Goal delete has no undo and milestone removal bypasses Save","fix":"Optimistic delete with an Undo toast; stage milestone removals in editor state and apply them in save()","command":"/impeccable harden","files":["src/pages/app/Goals.tsx:189","src/pages/app/Goals.tsx:175"],"source":"both"},
  {"id":"goals-5","severity":"P1","title":"Progress line (3.9:1 dark) and white '+ 1' on gradient (4.0:1) fail contrast","fix":"Use .muted for the progress line; move the counter to a neutral secondary button; near-white primary per direction","command":"/impeccable colorize","files":["src/components/goals/GoalCard.tsx:55","src/components/goals/GoalCard.tsx:65","src/index.css:78"],"source":"audit"},
  {"id":"goals-6","severity":"P2","title":"Decorative violet gradients, glows and a primary-weight counter on every card","fix":"Neutral progress fill with emerald when reached, ghost +/- pair, neutral selection in emoji picker, retoned confetti; drop the duplicate emoji","command":"/impeccable quieter","files":["src/components/goals/GoalCard.tsx:52","src/components/goals/GoalCard.tsx:33","src/components/goals/GoalCard.tsx:65","src/lib/confetti.ts:4","src/components/ui/EmojiPicker.tsx:13"],"source":"both"},
  {"id":"goals-7","severity":"P2","title":"16px milestone checkboxes with unclickable labels; small edit/bump buttons; light unchecked border 2.47:1","fix":"Full-row milestone button min 44px on touch, 40-44px bump/edit buttons on phone, darker empty-box border","command":"mobile-native","files":["src/components/goals/GoalCard.tsx:75","src/components/goals/GoalCard.tsx:46","src/components/goals/GoalCard.tsx:62"],"source":"both"},
  {"id":"goals-8","severity":"P2","title":"Emoji picker has no names or selected state; toasts (Goal reached) not announced","fix":"radiogroup/radio with aria-checked and aria-label; role=status aria-live=polite on the toast region","command":"/impeccable harden","files":["src/components/ui/EmojiPicker.tsx:5","src/hooks/useToast.tsx"],"source":"both"},
  {"id":"goals-9","severity":"P2","title":"Global + FAB covers the '+1' counter on phone","fix":"Put the bump pair thumb-side on the left on phone, or reserve a right gutter for the FAB","command":"/impeccable layout","files":["src/components/layout/AppShell.tsx:126","src/components/goals/GoalCard.tsx:61"],"source":"critique"},
  {"id":"goals-10","severity":"P2","title":"Plan accept toasts success before tasks are saved and allows blank milestones","fix":"Await addTasks.mutateAsync in try/catch, drop empty titles, report actual counts","command":"/impeccable harden","files":["src/pages/app/Goals.tsx:73","src/pages/app/Goals.tsx:212"],"source":"audit"},
  {"id":"goals-11","severity":"P3","title":"h1 jumps to h3 and the heading contains emoji and percentage","fix":"Add an h2 for active goals and keep only the title in the card heading","command":"/impeccable polish","files":["src/components/goals/GoalCard.tsx:37"],"source":"audit"},
  {"id":"goals-12","severity":"P3","title":"Progress fill animates width for 500ms","fix":"scaleX transform, origin-left, 200ms ease-out","command":"animation-performance","files":["src/components/goals/GoalCard.tsx:52"],"source":"audit"}
 ]}
```
