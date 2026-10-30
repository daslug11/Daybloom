# Onboarding & tour: critique & audit (Phase 1 baseline)

Method: design review (sub-agent, screenshots + source + live app) → then detector evidence (Phase 0 CDP scans, both themes, desktop + phone)

Scope: first-run setup (`/app/welcome`, `src/pages/app/Onboarding.tsx`), the 8-step spotlight tour (`src/components/onboarding/Tour.tsx`, started from `src/components/layout/AppShell.tsx`), the dashboard Getting started checklist (`src/components/onboarding/Checklist.tsx`), and the legacy local-data import prompt (`src/components/onboarding/LocalImportPrompt.tsx`). Mode: Operate (first run).

Evidence: Phase 0 screenshots `onboarding.jpg` and `tour.jpg` in all four variants (dark/light × desktop/phone), plus `dashboard.jpg` (the checklist is hidden for Maya). Live probe with Playwright at 1440×900 and 390×844 as Maya: opened `/app/welcome` without submitting, replayed the tour from the command palette, stepped through all 8 stops with the arrow keys, recorded spotlight presence, focus, Tab order and button sizes, then closed the browser context without finishing, so no `tour_completed_at` was written. No data was changed.

## Critique

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | The setup progress bar and "Step N of 8" are clear. But every setup write is fire-and-forget: `addNote.mutate` and `addTasks.mutate` (Onboarding.tsx:52,56) and the step-0 profile save (:50) never report failure. If **Finish** or **Skip setup** fails, `catch { setSaving(false) }` (:42–44, :67–69) re-enables the button and shows nothing. |
| 2 | Match System / Real World | 3 | The copy is plain, warm and student-shaped ("Empty your head", "One thing to get done"). But the tour opens with "Seven stops" over a counter that reads "Step 1 of 8". It tells phone users things are "all in the sidebar", which phones don't have. It shows "⌘J" on phones and on Windows/Linux. |
| 3 | User Control and Freedom | 2 | Skip setup, Skip this step, Back, Skip tour and Escape are all present. But hiding the checklist (×) can't be undone anywhere, and closing the import prompt by ×, Escape or a backdrop click permanently counts as "Don't import", with no way to bring the offer back. |
| 4 | Consistency and Standards | 2 | Three different "skip" treatments: violet `.link` "Skip setup", unstyled slate "Skip tour", ghost "Don't import". The tour's buttons are shrunk (`!px-3 !py-1.5`) compared with every other dialog. Violet (the gradient Continue with its glow, the violet progress bar, the violet spotlight ring and card border, a violet-tinted `#15121f` card) contradicts the confirmed neutral direction. |
| 5 | Error Prevention | 2 | Going Back and then Continue again re-creates the note and the task (Onboarding.tsx:52–56 fire on every Continue). A single Escape on the stacked tour plus import modal throws away the import offer for good. |
| 6 | Recognition Rather Than Recall | 2 | On phone, 5 of the 6 targeted tour stops (Capture, Brain Dump, Tasks, Planner, Habits) show no spotlight, only a centred card describing UI the user has to go and find. On desktop and phone, the Atlas stop's card covers the orb it introduces. |
| 7 | Flexibility and Efficiency | 3 | Arrow keys and Escape drive the tour. Setup can be skipped in one click. The `N` shortcut is taught in context (step 2 `<kbd>`). The tour can be replayed from Settings and from the command palette. |
| 8 | Aesthetic and Minimalist Design | 3 | Onboarding is a single focused card, one question per step. The tour card is compact. The noise is the glowing gradient Continue, the 12-chip wall on step 1 and the violet wash. |
| 9 | Error Recovery | 2 | The import prompt is a model ("Import stopped part-way… Anything already imported is safe"). Onboarding has no error copy at all, and the user's typed note, task or habit is silently dropped if a mutation fails. |
| 10 | Help and Documentation | 3 | The tour, the checklist with a direct action per item, and Replay tour in Settings and the palette are good contextual help. They are undercut by the phone tour and the covered Atlas stop. |
| **Total** | | **24/40** | **Acceptable** |

### Design Specificity Verdict

**Partly authored, partly category-interchangeable.**

**Authored:** the onboarding steps themselves are specific to Daybloom and genuinely good product thinking. Each step creates something real in the capture-then-organise loop (a Brain Dump note, a task that becomes one of today's top 3, a habit). The copy teaches the real mental model ("you'll sort it later", "press N anywhere") and the task step reuses the actual quick-add parser (Onboarding.tsx:55). The checklist is computed only from real data. That is "honest by default" made concrete.

**Interchangeable:** the visual shell is the generic SaaS first-run kit.
- A segmented progress bar over a centred card.
- A wall of pill chips.
- A violet→indigo→blue gradient CTA with a coloured glow.
- A spotlight tour with a violet ring and "A quick tour 👋".

None of it expresses "The Clear Head". The glow and gradient are exactly what DESIGN.md's direction removes. The tour card is a hard-coded violet-tinted `#15121f` (Tour.tsx:98), which is neither the panel token (`#13111f`) nor the planned neutral near-black.

**Missed opportunity:** the first-run moment is the place where "crisp, precise, quick" should be felt. The onboarding page has no brand mark, no app frame and no sense of arriving anywhere. It renders bare, without the shell (AppShell.tsx:93–98), and on phone it runs edge to edge with zero gutter.

### What's Working

1. **Every step produces real value, and every step after the first is skippable.** The brain-dump → task → habit sequence walks the user through the actual product loop in under a minute. When they land on the dashboard, their own note, top-3 task and habit are already there. This is "useful in the first minute" (Principle 4) done right. Undated first tasks become a top-3 item (Onboarding.tsx:54–56), a thoughtful touch.
2. **The checklist is honest and actionable.** Every item is derived from data (`notes.length`, `processed_at`, `sched_date`, Atlas message count; Checklist.tsx:30–38). Every unchecked item has a one-tap action (Capture, Process, Ask, Start). It has screen-reader "Done: / To do:" prefixes (:63) and removes itself when complete.
3. **The import prompt's copy is a small model of data-control writing.** It says exactly what was found ("Found 12 tasks, 3 habits…"). It explains that demo data is skipped and offers a precise opt-out for the pre-filled mood data. On failure it tells the user what is safe. That matches PRODUCT.md's "your data is yours" commitment.

### Priority Issues

**[P1] The tour is a blind slideshow on phones**
- **What:** at 390px, the stops Capture, Brain Dump, Tasks, Planner and "Habits, goals & more" all fall back to a centred card with no spotlight. The probe confirmed `spot:false` for steps 2–6.
  - The cause: their `data-tour` targets exist only in the desktop TopBar capture field (`hidden … sm:flex`, TopBar.tsx:21–26) and the Sidebar (Sidebar.tsx:58).
  - `MobileNav.tsx` carries no `data-tour` attributes, and neither does the + FAB (AppShell.tsx:127).
  - The copy then refers to "the sidebar" (Tour.tsx:17) and "⌘J" (:18), neither of which exists on a phone.
- **Why it matters:** phones are a primary device (PRODUCT.md: "short bursts between other things"). Casey gets 6 of 8 cards with nothing highlighted and has to map words to icons in the bottom bar from memory.
- **Fix:**
  - Add `data-tour` to the mobile surfaces: `nav-brain-dump`, `nav-tasks` and `nav-planner` on the MobileNav tabs; `capture` on the + FAB; `nav-habits` → the "More" tab. `visibleTarget()` already picks the visible match, so no tour logic change is needed.
  - Make the step body device-aware: "the + button" / "the More tab" on phone, "N" / "the sidebar" on desktop. Show "Ctrl+J" off-Mac, using the `isMac` helper from TopBar, and drop the shortcut on touch devices.
- **Suggested command:** `/impeccable adapt` (then `/impeccable onboard`)

**[P1] The tour card covers the thing it is pointing at (Atlas stop), and the last stop points at nothing once the checklist is gone**
- **What:**
  - Placement assumes the card is 180px (below) or 200px (above) tall (Tour.tsx:72,79). The Atlas card measures 234px. On desktop (card y 616–850) and phone (y 504–738), it overlaps the orb it spotlights. The screenshot shows only the orb's lower edge peeking out under the card.
  - Step 8 targets `checklist`, which renders `null` once dismissed or complete (Checklist.tsx:28,40). Every replay by an established user (like Maya) ends on "This checklist tracks your first steps" over an unspotlit dashboard.
- **Why it matters:** the tour's single job is "look here". Hiding Atlas behind its own introduction defeats the most important stop. An orphan final stop ends the tour on a non sequitur, which hurts the peak-end moment.
- **Fix:**
  - Measure the card (`card.current.getBoundingClientRect().height`) in the layout effect and place it with real height. Prefer the left side for targets hugging the right edge (the orb is fixed at the bottom right).
  - Filter `STEPS` at mount to those whose target is visible (keep the intro).
  - When the checklist is absent, end on a closing card that says where to replay the tour, instead of describing a missing checklist.
- **Suggested command:** `/impeccable harden`

**[P1] Back → Continue in setup silently duplicates the user's note and task**
- **What:** `next()` creates the note on every Continue from step 1 and the task on every Continue from step 2 (Onboarding.tsx:52–57). A user who goes Back to fix a typo and continues again ends up with two notes and two top-3 tasks. The edited text is not applied to the first copy. Both mutations are also fire-and-forget, so a failure loses the text silently.
- **Why it matters:**
  - Duplicate data on day one undermines trust in a "capture first" app.
  - The first dashboard shows "2 tasks for today" with the same task twice.
  - It breaks "honest numbers" on the checklist and greeting.
- **Fix:**
  - Track created ids per step: `const [created, setCreated] = useState<{note?: string; task?: string}>({})`. Update instead of insert when the id exists, or create everything once in `finish()`.
  - Await each mutation and show an inline error under the field if it fails, keeping the text.
- **Suggested command:** `/impeccable harden`

**[P1] The import offer can stack under the tour, and any dismissal destroys it for good**
- **What:**
  - `<LocalImportPrompt>` mounts in the app shell (AppShell.tsx:147) but not on `/app/welcome` (bare `<Outlet/>`, :93–98).
  - A legacy user therefore sees it for the first time on `/app?tour=1`, simultaneously with the tour. The tour is `z-[70]`; the Modal is `z-50` (Modal.tsx:19), so the import dialog sits dimmed under the tour while the Modal's focus trap competes with the tour card for focus.
  - One Escape fires both window listeners (Tour.tsx:59, Modal.tsx:25). The tour finishes and `close()` → `markImportHandled(uid)` (LocalImportPrompt.tsx:23–26) permanently hides the import.
  - Even without the tour, ×, Escape or a backdrop tap equal "Don't import" forever. There is no Settings entry to bring it back: `importLocalData` is referenced only here.
- **Why it matters:** these are exactly the returning users with real data. PRODUCT.md's "Your data is yours" commitment fails silently for them.
- **Fix:**
  - Don't start the tour while the import prompt is pending; queue it after.
  - Treat ×, Escape and backdrop as "Ask me later" (no `markImportHandled`). Only the explicit "Don't import" button marks it handled.
  - Add "Import data from this device" under Settings → Data whenever `localDataSummary()` is non-null.
  - Block close while `busy`.
- **Suggested command:** `/impeccable harden` (then `/impeccable clarify` for the button copy)

**[P2] First-run visuals contradict the confirmed direction: violet everywhere, a gradient-and-glow CTA, a tinted card**
- **What:** violet carries all the emphasis on this surface:
  - Onboarding: the progress fill `bg-violet-600` (Onboarding.tsx:77); `.btn-primary`'s violet→indigo→blue gradient with `shadow-[0_8px_30px_-8px_rgba(124,58,237,0.7)]` (index.css:78–81), very visible as a glowing pill even when disabled (light screenshots); `chip-on` violet; the `.link` "Skip setup" in violet; the EmojiPicker selected ring `ring-violet-400` (EmojiPicker.tsx:13).
  - Tour: spotlight `ring-violet-400` (Tour.tsx:86), card `border-violet-400/40 … dark:bg-[#15121f]` (:98), scrim `rgba(3,2,10,0.65)` (violet-tinted, :87).
  - Checklist: progress fill `bg-violet-600` (Checklist.tsx:54).
  - Import prompt: `accent-violet-600` (LocalImportPrompt.tsx:53).
- **Why it matters:** first run sets the user's sense of the brand. Today it reads as a generic AI-SaaS onboarding, not "The Clear Head". The direction is confirmed, so every violet token here is planned debt.
- **Fix:**
  - Progress fills, the spotlight ring and the selected emoji ring move to the neutral near-white emphasis token. The primary button becomes a solid near-white (dark) / near-black (light) fill with no glow, and stays visibly inert when disabled.
  - The tour card uses the shared modal surface token. The scrim becomes neutral black.
  - Keep the 🌸 in the welcome heading as the one warm note.
- **Suggested command:** `/impeccable quieter`

**[P2] The checklist can only be finished by spending AI, and hiding it is irreversible**
- **What:**
  - "Ask Atlas something" is one of the 7 items (Checklist.tsx:36). The card only disappears by itself when all 7 are done (:40), so finishing it requires spending a daily ✨ use.
  - The × (:46) sets `checklist_dismissed_at`, and nothing in the app clears it. Settings has Replay tour but no "Show getting started".
- **Why it matters:** PRODUCT.md Principle 3: "AI is a helper, never a requirement… every feature still works without it." A completion mechanic that requires AI quietly contradicts that. Users who hide the checklist by accident lose it.
- **Fix:**
  - Label the Atlas item as optional ("Optional: ask Atlas something · uses 1 ✨") and exclude it from the completion condition (`done === required.length`).
  - Add "Show the getting started checklist" next to Replay tour in Settings (Settings.tsx:167), clearing `checklist_dismissed_at`.
- **Suggested command:** `/impeccable clarify`

### Persona Red Flags

**Casey (distracted mobile user, the primary case for this product):**
- Onboarding on a 390px phone has **no side gutter**: the progress bar and the card run to x=0/x=390 (probe: `ol {x:0,w:390}`; phone screenshots show the card border touching both edges). The page renders outside AppShell's padded `<main>`.
- The tour's buttons are 32–34px tall and "Skip tour" is a 60×20 text target (probe), all under the 44px thumb guideline.
- Five tour stops point at nothing (above). The Atlas stop tells her to press ⌘J on a phone.
- If she's interrupted mid-setup and the tab reloads, `step` is component state: she restarts at step 1 with an empty form. The note and task she already submitted are still created, and re-entering them duplicates them.

**Jordan (confused first-timer):**
- Step 1 shows **12 unordered area chips** with no grouping. It's optional, but it's the first decision on the first screen of the product.
- The tour intro says "Seven stops" and the counter immediately says "Step 1 of 8".
- The last tour stop describes a checklist he may not see (if it hasn't loaded, or on replay).
- On phone, "Habits, goals & more … all in the sidebar" names a sidebar that doesn't exist; the actual place is the "More" tab.
- If Finish fails, the button simply re-enables with no message, so he will press it again or leave.

**Sam (keyboard / screen reader):**
- The tour card has `role="dialog" aria-modal="true"` but **no focus trap**. The probe's Tab sequence from step 1: Skip tour → Next → `BODY` → "Skip to content" → Dashboard nav link. Focus walks out behind the 65% scrim, where focused elements are obscured.
- Initial focus lands on the card `<div>` (Tour.tsx:57 overrides the Next button's `autoFocus`), so Enter does nothing until he finds Next.
- The `aria-live="polite"` on the whole overlay container (:83) re-announces the full card on every step, including button labels.
- The emoji picker's selected state is visual only (no `aria-pressed`, EmojiPicker.tsx:7–17).

### Cognitive Load

Checklist failures (3, moderate):
- **Minimal choices:** onboarding step 1 offers 12 focus-area chips at once (Onboarding.tsx:13), and the Getting started card shows 7 items, each with its own action link.
- **Chunking:** the 12 chips are an undifferentiated wrap; the 7 checklist items are a flat 2-column grid with no "next up" emphasis.
- **Working memory (phone tour):** with no spotlight, the user must hold "Brain Dump / Tasks / Planner / habits are in the sidebar" in mind and map it to the bottom tab bar later.

Decision points with more than 4 options:
- Onboarding step 1 "What do you want to organise?": 12 chips, plus Skip setup and Continue.
- Onboarding step 4 habit emoji: 10 emoji, plus a text field, Back, Skip this step and Finish.
- Getting started: 7 items with up to 7 action links, plus Hide.

Passes: single focus per onboarding step, one thing at a time, progressive disclosure (one question per step) and clear hierarchy inside the setup card.

### Minor Observations

- The welcome subtitle says "Two quick questions, then we'll set up your first note, task and habit", but step 1 already holds both questions and the next three steps *are* the setup. It's accurate, but reads like five steps; "Four short steps, about a minute" is plainer.
- Onboarding has no Daybloom mark or app frame and no `<main>` landmark (probe: `main:false`). There is also no way to sign out from `/app/welcome`.
- **Skip setup** (Onboarding.tsx:62–66) drops the focus areas the user just picked: `areas` isn't in the payload. It also skips the tour, without saying so.
- "Skip this step" on step 2 (Brain dump) throws away typed text without a word. The label could become "Skip" only when the field is empty, and "Save & continue" otherwise.
- Tour step "Planner" says "Drag tasks onto a day/week timeline"; on a phone, dragging is not the primary gesture.
- Settings → Replay tour uses `navigate('/app'); setTimeout(startTour, 300)` (Settings.tsx:168), but `startTour` already navigates (AppShell.tsx:43–46). The timeout is a redundant race.
- The checklist item "Ask Atlas something" briefly renders unchecked until the `atlas_count` query resolves (Checklist.tsx:23–27). The progress bar then jumps.
- Habit step: `<EmojiPicker>` has no label telling the user it's the habit's icon.


## Audit

The audit was written after the critique, and is the first place the detector JSON was opened.

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | Tour dialog has `aria-modal` but no focus trap (Tab leaves to the obscured page). The `faint` 11–12px labels fail AA in dark (3.9–4.2:1). White on the gradient Next/Continue is 3.5–4.1:1. The emoji picker hides its selected state from assistive tech. Labels, `aria-pressed` chips, `aria-current` step and sr-only Done/To-do prefixes are good. |
| 2 | Performance | 3 | The tour is lazy-loaded and measures only on step change and resize. The spotlight animates `left/top/width/height` plus a 9999px box-shadow via `transition-all` (full-viewport repaint per frame, 200ms). Glass `backdrop-blur-xl` under the scrim. Minor overall. |
| 3 | Theming | 2 | Hard-coded surface `dark:bg-[#15121f]` (Tour.tsx:98) and scrim `rgba(3,2,10,0.65)` (:87), neither tokenised. Violet literals throughout (`bg-violet-600`, `ring-violet-400`, `accent-violet-600`). Both themes render correctly. |
| 4 | Responsive Design | 2 | Onboarding has 0px side gutter at 390px. 5 of 6 targeted tour stops have no phone target. The tour card overlaps the Atlas orb at both sizes. Tour buttons are 32–34px tall and "Skip tour" is 60×20. |
| 5 | Implementation Integrity | 2 | Several verified bugs: duplicate note/task on Back→Continue; the import prompt stacking under the tour and being permanently dismissed by Escape; a hard-coded card height in tour placement; an orphan checklist stop; irreversible checklist hide. "Seven stops" vs 8. |
| **Total** | | **11/20** | **Acceptable** |

**Implementation Integrity Verdict: fail (narrowly).** The product logic is specific and honest: real-data checklist, real creation in setup, truthful import copy. But the implementation has verified state bugs on the two paths a first-run surface must get right, going back and dismissing. The visual layer is the shared violet/glass system, not a product-specific one.

### Detector findings

The scans cover 8 page captures (onboarding and tour × dark/light × desktop/phone) with **81 findings**. The tour captures are taken over the dashboard, so most tour-capture findings belong to the dashboard and shell behind the scrim, not to this surface.

| Rule | Onboarding (4 captures) | Tour (4 captures) | Verdict for this surface |
|------|------|------|------|
| low-contrast | 10 | 23 | **Real (this surface):** step labels `span.text-[11px]` 4.2:1 dark / 4.3:1 light (Onboarding.tsx:78); hint `p.faint.mt-2` 3.9:1 dark (:112); tour "Step N of 8" `div.faint.text-[11px]` 3.9:1 on `#15121f` (Tour.tsx:101); tour Next `button.btn-primary.!px-3` white on gradient 4.1:1 (desktop) / 3.5:1 (phone). **Real but minor:** placeholder "Your first name" 3.4:1 dark / 2.5:1 light. It's a hint with a visible label, so it's handled under `.input` globally. **Not this surface:** task priority chips, `CtrlK` kbd, Process inbox button, logo tile, `span.faint.inline-flex` on the dashboard. |
| dark-glow | 2 | 8 | **Real:** `.btn-primary` violet glow on Continue (onboarding) and the tour Next button. It is already slated for removal per DESIGN.md. **Not this surface:** Process inbox, the + FAB (`button.flex.h-12`), the Atlas orb glow (`#164e63`, cyan, Atlas-owned). |
| ai-color-palette | 0 | 16 | **False positive / not this surface:** the cyan gradient on the Atlas orb (`span.absolute.inset-[18%]`, cyan is reserved for Atlas). **Belongs to the shell:** the logo tiles `span.flex.h-9` and `span.flex.h-8`. The `body` "purple/violet accents" signal is real for this surface (progress fills, spotlight ring) and slated for removal. |
| gradient-text | 0 | 6 | Not this surface: the dashboard greeting `h1.gradient-text` and the sidebar logo wordmark. Slated for removal. |
| nested-cards | 0 | 8 | Not this surface: dashboard Top tasks rows inside the card. |
| overused-font | 4 | 4 | **False positive:** a single Inter family is the documented system choice and operate.md endorses one family for product UI. |

**Missed by the detector, found in review and live probe:**
- the tour focus escape;
- the emoji picker's missing state;
- 32–34px tour buttons;
- the zero phone gutter on onboarding;
- missing phone tour targets;
- the card covering the Atlas orb;
- every logic bug (duplicates, import collision, irreversible dismissals).

Also unflagged: the disabled Continue is rendered white on the gradient at 50% opacity. Disabled controls are exempt, but the enabled state carries the same 4.1:1 failure as Next.

### Findings by severity

**[P1] Tour dialog does not trap or place focus**
- **Location:** src/components/onboarding/Tour.tsx:56–66 (focus and keys), :92–99 (dialog)
- **Category:** Accessibility
- **Impact:** with `role="dialog" aria-modal="true"`, Tab from Next moves to `BODY`, then "Skip to content", then the sidebar links (probed). Those are behind a 65% scrim, so the focus ring is obscured. `card.current?.focus()` runs after the Next button's `autoFocus`, so initial focus is a non-interactive `div` and Enter does nothing.
- **WCAG:** 2.4.3 Focus Order, 2.4.11 Focus Not Obscured (AA)
- **Recommendation:** reuse Modal.tsx's Tab-wrap logic (or extract a `useFocusTrap`). Focus the primary button on each step, not the card. Mark the app root `inert` while the tour is open.
- **Suggested command:** /impeccable harden

**[P1] `faint` small text fails AA contrast in dark theme**
- **Location:** src/pages/app/Onboarding.tsx:78 (step labels, 11px, 4.2:1 on `#08070f`), :112 (hint, 12px, 3.9:1 on the glass card); src/components/onboarding/Tour.tsx:101 ("Step N of 8", 11px, 3.9:1 on `#15121f`); the `.faint` definition is in src/index.css:66–68
- **Category:** Accessibility
- **Impact:** progress labels and step counters are the user's orientation, and they are the least legible text on the surface. Light theme step labels are 4.3:1 (also failing).
- **WCAG:** 1.4.3 Contrast (Minimum)
- **Recommendation:** use `muted` (`slate-400` dark / `slate-600` light) for these, or retune `.faint` globally to ≥4.5:1 on the darkest card surface. Raise 11px to 12px.
- **Suggested command:** /impeccable typeset

**[P1] White text on the gradient primary button fails AA**
- **Location:** src/index.css:78–81 (`.btn-primary`), used at src/components/onboarding/Tour.tsx:119,123 and src/pages/app/Onboarding.tsx:169
- **Category:** Accessibility / Theming
- **Impact:** "Next", "Done", "Continue" and "Finish" have white text over the blue end of the gradient at 3.5–4.1:1 (detector, all four captures). These are the only forward actions in the flow.
- **WCAG:** 1.4.3
- **Recommendation:** fold into the direction change: a solid neutral near-white fill with near-black text (dark theme) and near-black with white (light), with no gradient or glow.
- **Suggested command:** /impeccable quieter

**[P1] Emoji picker selection not exposed**
- **Location:** src/components/ui/EmojiPicker.tsx:7–17 (used at Onboarding.tsx:149)
- **Category:** Accessibility
- **Impact:** ten buttons with only an emoji as the name. The selected one is indicated only by a violet ring, so screen-reader users can't tell which icon their habit will get.
- **WCAG:** 4.1.2 Name, Role, Value
- **Recommendation:** wrap the buttons in `role="radiogroup" aria-label="Habit icon"`. Give each button `role="radio" aria-checked`, or `aria-pressed`, and add a visible "Icon" label.
- **Suggested command:** /impeccable harden

**[P1] Tour placement uses assumed card heights; the card covers the Atlas orb**
- **Location:** src/components/onboarding/Tour.tsx:69–80
- **Category:** Responsive / Implementation Integrity
- **Impact:** `below` assumes 180px and "above" subtracts 200px. The real card is 186–234px tall, so on the Atlas stop it overlaps the orb on desktop (y 616–850) and phone (y 504–738). The same assumption will clip any longer copy or larger text setting.
- **Recommendation:** measure `card.current` after render (a second layout pass), clamp to the viewport, and add a left-of-target placement for right-edge targets.
- **Suggested command:** /impeccable harden

**[P1] Phone tour has no targets for 5 of 6 stops**
- **Location:** src/components/onboarding/Tour.tsx:13–17; src/components/layout/MobileNav.tsx:22–35 (no `data-tour`); src/components/layout/AppShell.tsx:127 (the + FAB has no `data-tour`); src/components/layout/TopBar.tsx:21–26 (capture target `hidden … sm:flex`)
- **Category:** Responsive
- **Impact:** see Critique P1. Probe: `spot:false` for steps 2–6 at 390px.
- **Recommendation:** add phone `data-tour` targets and device-aware copy.
- **Suggested command:** /impeccable adapt

**[P1] Setup duplicates the note and task on Back → Continue; failures are silent**
- **Location:** src/pages/app/Onboarding.tsx:47–60 (inserts on every Continue), :35–45 and :62–70 (silent `catch`)
- **Category:** Implementation Integrity
- **Impact:** duplicate records on day one. If the network drops, Finish or Skip just re-enables with no message.
- **Recommendation:** make step writes idempotent (store created ids, update on re-entry, or batch everything in `finish()`). Await mutations and render an inline `role="alert"` error that keeps the typed text.
- **Suggested command:** /impeccable harden

**[P1] Import prompt collides with the tour; dismissal is permanent with no recovery path**
- **Location:** src/components/onboarding/LocalImportPrompt.tsx:23–26 (`close` marks handled), :46 (Modal `onClose={close}` also fires while `busy`); src/components/layout/AppShell.tsx:147,160 (both mount on `/app?tour=1`); src/components/ui/Modal.tsx:19,25 (`z-50`, window Escape) vs Tour.tsx:59,83 (`z-[70]`, window Escape)
- **Category:** Implementation Integrity
- **Impact:** a legacy user's first view of their imported-data offer is under the tour scrim, with two focus managers fighting. One Escape ends the tour *and* permanently suppresses the offer. There is no Settings path back, which breaks the PRODUCT.md data-control commitment for exactly these users.
- **Recommendation:**
  - Gate `setTour(true)` on the import prompt being resolved.
  - Make ×, Escape and the backdrop "later" (no `markImportHandled`).
  - Ignore close while `busy`.
  - Add a Settings → Data "Import from this device" row.
- **Suggested command:** /impeccable harden

**[P2] Violet, gradient, glow and tinted surfaces on the first-run surface**
- **Location:** src/pages/app/Onboarding.tsx:77; src/components/onboarding/Tour.tsx:86–87,98; src/components/onboarding/Checklist.tsx:54; src/components/onboarding/LocalImportPrompt.tsx:53; src/components/ui/EmojiPicker.tsx:13; src/index.css:78–81
- **Category:** Theming
- **Impact:** contradicts the confirmed direction (neutral emphasis, untinted near-black, no glows). The detector's `dark-glow` and `body` violet-accent signals confirm it.
- **Recommendation:** move to neutral emphasis tokens. Use the shared modal surface for the tour card and a neutral black scrim.
- **Suggested command:** /impeccable quieter

**[P2] Checklist completion needs AI, and hiding it is irreversible**
- **Location:** src/components/onboarding/Checklist.tsx:36,40,46; src/pages/app/Settings.tsx:167–171
- **Category:** Implementation Integrity
- **Impact:** contradicts "AI is a helper, never a requirement". A mis-tap on × loses the checklist forever.
- **Recommendation:** make the Atlas item optional and excluded from completion. Add "Show getting started" in Settings.
- **Suggested command:** /impeccable clarify

**[P2] Onboarding renders outside the shell: no gutter on phone, no landmark, no brand**
- **Location:** src/components/layout/AppShell.tsx:93–98 (bare `<Outlet/>`); src/pages/app/Onboarding.tsx:73 (`mx-auto max-w-xl py-4`, no horizontal padding)
- **Category:** Responsive
- **Impact:** at 390px the progress bar and card touch both screen edges (probe: `ol {x:0, w:390}`), violating the 16px gutter used everywhere else. There's no `<main>`, no logo and no sign-out.
- **Recommendation:** wrap the welcome route in `<main id="main" className="px-4 sm:px-6">` with the compact Logo above the progress bar. Add a quiet "Sign out" link in the footer.
- **Suggested command:** /impeccable layout

**[P2] Tour controls are small touch targets**
- **Location:** src/components/onboarding/Tour.tsx:109 ("Skip tour", 60×20), :114,119,123 (Back/Next/Done `!px-3 !py-1.5`, 32–34px tall)
- **Category:** Responsive
- **Impact:** these pass WCAG 2.5.8 by spacing but are below the 44px thumb guideline on the device where this tour is weakest.
- **Recommendation:** drop the `!px-3 !py-1.5` overrides (use the standard 40px+ `.btn`). Give Skip tour `min-h-[44px] px-2` on touch.
- **Suggested command:** mobile-native

**[P3] `aria-live` on the whole overlay re-announces the full card every step**
- **Location:** src/components/onboarding/Tour.tsx:83
- **Category:** Accessibility
- **Impact:** verbose announcements that include button text. The dialog already gets focus.
- **Recommendation:** remove `aria-live` from the container. Put a visually hidden live region with just "Step N of 8: {title}" instead.
- **Suggested command:** /impeccable harden

**[P3] Tour copy numbers and shortcuts**
- **Location:** src/components/onboarding/Tour.tsx:12 ("Seven stops" vs `STEPS.length` 8), :17 ("in the sidebar"), :18 ("⌘J" on all platforms)
- **Category:** Implementation Integrity
- **Impact:** small honesty and platform mismatches on a "honest numbers" product.
- **Recommendation:** derive the count from the filtered steps (`${steps.length - 1} stops`) and render the shortcut from `isMac`.
- **Suggested command:** /impeccable clarify

**[P3] Spotlight glides while the card teleports**
- **Location:** src/components/onboarding/Tour.tsx:86 (`transition-all duration-200` on left/top/width/height + 9999px shadow), :92–99 (no transition)
- **Category:** Performance
- **Impact:** a disjointed hand-off between stops, plus layout and paint cost on every frame.
- **Recommendation:** see Motion below.
- **Suggested command:** improve-animations

**[P3] Skip paths quietly drop choices**
- **Location:** src/pages/app/Onboarding.tsx:65 (Skip setup omits `focus_areas` and doesn't start the tour); src/pages/app/Settings.tsx:168 (redundant `setTimeout(startTour, 300)` after `navigate`)
- **Category:** Implementation Integrity
- **Impact:** chips the user picked are lost. Replay works but is racy.
- **Recommendation:** include `areas` in `skipAll`. Call `startTour()` directly.
- **Suggested command:** /impeccable polish

### Positive findings

- **Labelled, semantic setup form:**
  - the real `<form>` with submit;
  - `<label>`-wrapped name input with `autoComplete="given-name"` and `required`;
  - a `<fieldset>`/`<legend>` for areas;
  - `aria-pressed` on the area chips (Onboarding.tsx:106);
  - `aria-current="step"` on the progress (:78);
  - per-step `autoFocus` so phone keyboards open on the right field.
- **The checklist is accessible and honest:** sr-only "Done:/To do:" prefixes (Checklist.tsx:63), a decorative progress bar `aria-hidden` with the count in the title text, a labelled hide button, and every item derived from real data.
- **The import prompt** uses the shared accessible Modal (focus in, Escape, focus return, Tab wrap). It has a `role="alert"` error with recovery copy, a busy state on both buttons, and a precise data summary.
- **Tour engineering basics are right:** it is lazy-loaded (AppShell.tsx:19), portalled, chooses the *visible* target among duplicates (Tour.tsx:22–26), re-measures on resize, works with arrow keys and Escape, and the global `N` shortcut is correctly suppressed while any `[role="dialog"]` is open (AppShell.tsx:59).
- **Reduced motion is honoured** by the global rule (index.css:32–40), which collapses every transition here.

## Motion on this surface

| Motion | Where | Trigger | Duration / easing | Earns its place? |
|---|---|---|---|---|
| Card fade-and-rise (opacity 0→1, translateY 4px) | `Card` src/components/ui/Card.tsx:16; keyframes tailwind.config.js:12,15 | Mount of the onboarding card (once; steps swap content inside the same card) and of the Getting started card on every dashboard visit | 250ms ease-out | **Marginal.** Fine once on the welcome card. On the checklist it repeats on every dashboard visit and adds nothing, so it is a candidate for removal with the global Card fade. |
| Spotlight move/resize | src/components/onboarding/Tour.tsx:86 `transition-all duration-200` | Each tour step change and resize | 200ms, default ease (Tailwind `cubic-bezier(0.4,0,0.2,1)`) | **Purpose yes, implementation no.** Gliding the spotlight shows where attention moved, which is legitimate state motion. But it animates `left/top/width/height` and a 9999px box-shadow (layout and full-viewport paint), and the card beside it jumps instantly (:92–99), so the pair feels unsynchronised. Animate a transform on the ring (or a clip-path on the scrim) and give the card the same 150–200ms `ease-out` translate. |
| Tour card | src/components/onboarding/Tour.tsx:92–99 | Step change | None (instant reposition) | Should move with the spotlight (see above). No entrance animation is needed: "quick" beats choreography. |
| Checklist progress fill | src/components/onboarding/Checklist.tsx:54 `transition-all` | Item completed (data refetch) | 150ms default | **Earns it** (state change), but it animates `width` and `transition-all`. Use `transform: scaleX()` with `origin-left`. |
| Onboarding progress segments | src/pages/app/Onboarding.tsx:77 | Step change | None (instant colour swap) | Fine. Crisp and quick, in line with the direction. |
| Button press scale | `.btn` src/index.css:74–76 `active:scale-[0.97] transition` | Press on Continue/Back/Next/Import | 150ms default | **Earns it.** This is the "tactile, pressable" direction. Narrow `transition` to `transform, background-color` rather than all properties. |
| Chip toggle | `.chip` src/index.css:132–134 `transition` | Hover/toggle of area chips | 150ms default | Fine (colour feedback only). |
| Emoji hover grow | src/components/ui/EmojiPicker.tsx:12 `transition hover:scale-110` | Hover | 150ms default | **Doesn't earn it.** Decorative, it sticks on touch devices after a tap, and it isn't selection feedback. Remove it. Selection is shown by the ring/fill. |
| Import modal fade-in + blurred backdrop | src/components/ui/Modal.tsx:55,63 (`animate-fade-in`, `backdrop-blur-sm`) | Prompt opens | 250ms ease-out | Acceptable as standard dialog entry. The blur goes away with the "solid surfaces" direction. |
| Target scroll | src/components/onboarding/Tour.tsx:44 `scrollIntoView({block:'nearest'})` | Step change | Instant | Correct. There is no smooth scroll to wait for. |
| Reduced motion | src/index.css:32–40 | `prefers-reduced-motion: reduce` | All durations to 0.01ms | Present. For this surface the global kill is acceptable: the spotlight simply jumps and no state is lost. |

## Machine-readable summary

```json
{"surface":"onboarding-tour","critique_total":24,"critique_max":40,"na_heuristics":[],"audit_total":11,
 "issues":[
  {"id":"onboarding-tour-1","severity":"P1","title":"Tour has no spotlight targets for 5 of 6 stops on phone; copy refers to sidebar and ⌘J","fix":"Add data-tour to MobileNav tabs (nav-brain-dump/tasks/planner, More for nav-habits) and the + FAB (capture); make step copy device-aware and show Ctrl+J off-Mac / no shortcut on touch","command":"/impeccable adapt","files":["src/components/onboarding/Tour.tsx:13","src/components/layout/MobileNav.tsx:22","src/components/layout/AppShell.tsx:127","src/components/layout/TopBar.tsx:21"],"source":"critique"},
  {"id":"onboarding-tour-2","severity":"P1","title":"Tour card placement assumes 180/200px height and covers the Atlas orb; final stop targets a checklist that may not exist","fix":"Measure the rendered card height before placing, add left-of-target placement for right-edge targets, filter steps to visible targets and end on a closing card when the checklist is absent","command":"/impeccable harden","files":["src/components/onboarding/Tour.tsx:69","src/components/onboarding/Tour.tsx:19","src/components/onboarding/Checklist.tsx:28"],"source":"both"},
  {"id":"onboarding-tour-3","severity":"P1","title":"Back then Continue in setup duplicates the note and task; setup failures are silent","fix":"Make step writes idempotent (store created ids or batch in finish()), await mutations and show an inline role=alert error that preserves typed text","command":"/impeccable harden","files":["src/pages/app/Onboarding.tsx:47","src/pages/app/Onboarding.tsx:42","src/pages/app/Onboarding.tsx:67"],"source":"both"},
  {"id":"onboarding-tour-4","severity":"P1","title":"Local import prompt stacks under the post-onboarding tour; Escape/×/backdrop permanently discard the offer with no recovery","fix":"Defer the tour until the import prompt resolves; only the explicit Don't import button marks it handled; ignore close while busy; add Settings → Data 'Import from this device'","command":"/impeccable harden","files":["src/components/onboarding/LocalImportPrompt.tsx:23","src/components/layout/AppShell.tsx:147","src/components/layout/AppShell.tsx:160","src/components/ui/Modal.tsx:25","src/components/onboarding/Tour.tsx:59"],"source":"both"},
  {"id":"onboarding-tour-5","severity":"P1","title":"Tour dialog has no focus trap and initial focus lands on a non-interactive div","fix":"Trap Tab inside the card (reuse Modal's logic or a useFocusTrap hook), focus the primary button each step, mark the app root inert while open","command":"/impeccable harden","files":["src/components/onboarding/Tour.tsx:56","src/components/onboarding/Tour.tsx:92"],"source":"both"},
  {"id":"onboarding-tour-6","severity":"P1","title":"Faint 11–12px progress labels, hint and tour step counter fail AA contrast (3.9–4.3:1)","fix":"Use the muted tier (or retune .faint to ≥4.5:1 on the darkest card) and raise 11px labels to 12px","command":"/impeccable typeset","files":["src/pages/app/Onboarding.tsx:78","src/pages/app/Onboarding.tsx:112","src/components/onboarding/Tour.tsx:101","src/index.css:66"],"source":"both"},
  {"id":"onboarding-tour-7","severity":"P1","title":"White on gradient primary (Next/Done/Continue/Finish) is 3.5–4.1:1","fix":"Replace the gradient .btn-primary with a solid neutral near-white (dark) / near-black (light) fill with contrasting text and no glow","command":"/impeccable quieter","files":["src/index.css:78","src/components/onboarding/Tour.tsx:119","src/pages/app/Onboarding.tsx:169"],"source":"audit"},
  {"id":"onboarding-tour-8","severity":"P1","title":"Emoji picker's selected state is visual only","fix":"role=radiogroup with aria-label 'Habit icon' and role=radio + aria-checked (or aria-pressed) per emoji; add a visible label","command":"/impeccable harden","files":["src/components/ui/EmojiPicker.tsx:7","src/pages/app/Onboarding.tsx:149"],"source":"audit"},
  {"id":"onboarding-tour-9","severity":"P2","title":"Violet progress fills, spotlight ring, tinted tour card, gradient-and-glow CTA contradict the neutral direction","fix":"Move progress fills, spotlight ring, selected emoji and checkbox accent to the neutral emphasis token; tour card uses the shared modal surface; neutral black scrim; no glow","command":"/impeccable quieter","files":["src/pages/app/Onboarding.tsx:77","src/components/onboarding/Tour.tsx:86","src/components/onboarding/Tour.tsx:98","src/components/onboarding/Checklist.tsx:54","src/components/onboarding/LocalImportPrompt.tsx:53","src/components/ui/EmojiPicker.tsx:13"],"source":"both"},
  {"id":"onboarding-tour-10","severity":"P2","title":"Checklist can only complete by spending AI; hiding it is irreversible","fix":"Mark 'Ask Atlas' optional (shows ✨ cost) and exclude it from completion; add 'Show getting started' next to Replay tour in Settings","command":"/impeccable clarify","files":["src/components/onboarding/Checklist.tsx:36","src/components/onboarding/Checklist.tsx:46","src/pages/app/Settings.tsx:167"],"source":"critique"},
  {"id":"onboarding-tour-11","severity":"P2","title":"Onboarding renders outside the shell: zero side gutter on phone, no main landmark, no brand mark or sign-out","fix":"Wrap /app/welcome in <main> with px-4 sm:px-6, show the compact Logo above progress, add a quiet Sign out link","command":"/impeccable layout","files":["src/components/layout/AppShell.tsx:93","src/pages/app/Onboarding.tsx:73"],"source":"both"},
  {"id":"onboarding-tour-12","severity":"P2","title":"Tour controls are small touch targets (Skip tour 60×20, Back/Next 32–34px)","fix":"Drop the !px-3 !py-1.5 overrides and give Skip tour a 44px min height on touch","command":"mobile-native","files":["src/components/onboarding/Tour.tsx:109","src/components/onboarding/Tour.tsx:114","src/components/onboarding/Tour.tsx:119"],"source":"audit"},
  {"id":"onboarding-tour-13","severity":"P3","title":"aria-live on the whole tour overlay re-announces the full card each step","fix":"Remove aria-live from the container; add a visually hidden live region announcing 'Step N of M: title'","command":"/impeccable harden","files":["src/components/onboarding/Tour.tsx:83"],"source":"audit"},
  {"id":"onboarding-tour-14","severity":"P3","title":"Tour intro says 'Seven stops' over 'Step 1 of 8'; ⌘J shown on every platform","fix":"Derive the stop count from the filtered steps; render the shortcut from isMac","command":"/impeccable clarify","files":["src/components/onboarding/Tour.tsx:12","src/components/onboarding/Tour.tsx:18"],"source":"critique"},
  {"id":"onboarding-tour-15","severity":"P3","title":"Spotlight animates layout properties and a 9999px shadow while the card jumps","fix":"Animate the ring via transform (or scrim clip-path) and move the card with the same 150–200ms ease-out; remove EmojiPicker hover:scale-110","command":"improve-animations","files":["src/components/onboarding/Tour.tsx:86","src/components/ui/EmojiPicker.tsx:12"],"source":"audit"},
  {"id":"onboarding-tour-16","severity":"P3","title":"Skip setup drops chosen focus areas; Settings replay uses a redundant setTimeout race","fix":"Include areas in skipAll; call startTour() directly from Settings","command":"/impeccable polish","files":["src/pages/app/Onboarding.tsx:65","src/pages/app/Settings.tsx:168"],"source":"critique"}
 ]}
```
