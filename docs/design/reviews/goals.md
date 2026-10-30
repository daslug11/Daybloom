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

_(written after the critique; see below)_
