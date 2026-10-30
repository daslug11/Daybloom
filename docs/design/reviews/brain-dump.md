# Brain Dump: critique & audit (Phase 1 baseline)

Method: design review (sub-agent, screenshots + source + live app) → then detector evidence (Phase 0 CDP scans, both themes, desktop + phone)

Scope: the Brain Dump page (`/app/brain-dump`: inline capture, Inbox / Ideas / All notes / Archive views, search, tag filters, note cards and their menus), the Capture dialog (N key / + button / top-bar quick-add / dictation), Process inbox, the Convert dialog, and the ✨ result panels (Organize, Extract actions, Summarize, Find patterns, Turn into a plan). Mode: Operate.

Evidence: the Phase 0 screenshots `test-results/visual/phase0-before/{dark,light}-{desktop,phone}/{brain-dump,process-inbox,capture}.jpg`, the source files listed below, and read-only Playwright runs against `http://localhost:5173` as Maya. All write requests (POST/PATCH/DELETE) were blocked in the browser, and no ✨ action was pressed. The live checks were: menu stacking, keyboard order inside menus, nested-dialog Escape, the tag-filter state, touch-target sizes at 390px, the cold `?process=1` load, and focus stability while typing in Capture.

## Critique

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Card state changes toast with Undo, Process shows "Note 1 of 4" and a bar, search says "N results across all notes". Gaps: a per-note ✨ action shows only a pulsing 15px sparkle (`NoteCard.tsx:156`) with no text or live region, and Process actions (idea / archive / note / delete) confirm nothing. |
| 2 | Match System / Real World | 3 | The copy is plain and student-friendly ("Empty your head here"). But the outcome vocabulary is fuzzy: what separates "Keep as note", "Keep as idea" and "Archive"? And Organize brings in a fourth set of words (Reminder, Journal, Reference). |
| 3 | User Control and Freedom | 2 | Delete in Process inbox is instant and permanent, with no undo (`ProcessInbox.tsx:73`). One Escape in a Convert dialog opened from Process closes both dialogs and ends the session. Escape or a backdrop click throws away a paid ✨ result. Process has no Back button. |
| 4 | Consistency and Standards | 2 | The same "what is this?" decision is offered three ways with three vocabularies and icon styles (Convert menu with emoji, Process grid with lucide icons plus one 📄 emoji, Organize kind select). Buttons in one row have different heights (Process inbox 36px vs ✨ buttons 42px). The primary and AI buttons are both violet. |
| 5 | Error Prevention | 2 | Card menus open *under* the next card, so clicks land on the wrong note (live-verified). A tag filter can stay active while its chip is hidden. Escape or a backdrop click in Capture discards the typed thought. |
| 6 | Recognition Rather Than Recall | 2 | The two most important card actions, Convert (⇄) and ✨ AI, are unlabeled 32px icons, while the less important "💡 Keep as idea" gets a text chip. Double-click-to-edit is invisible (there is a pencil). |
| 7 | Flexibility and Efficiency | 3 | Good accelerators: N from anywhere, Ctrl/⌘+Enter, natural-language task parsing, select-text-then-Convert, dictation. Missing: no shortcut keys in Process inbox (the place power users repeat most), and no arrow keys in the card menus. |
| 8 | Aesthetic and Minimalist Design | 2 | Violet gradient title, violet gradient primary, three violet-outlined ✨ buttons and violet tabs all compete. On phone the first note starts at 687px of an 844px viewport, under the tab bar, + FAB and Atlas orb. Grid rows stretch short cards into large empty boxes. |
| 9 | Error Recovery | 3 | Optimistic updates roll back with a plain toast ("Your note could not be saved. Please try again."). Voice errors are inline with `role="alert"`. AI limit errors toast and update the pill. But the "No notes match" empty state offers no way to clear filters. |
| 10 | Help and Documentation | 3 | The page description says what the page is for. Every view has a teaching empty state, and the inline hints are task-focused (Markdown and checklists work; "Select text first to use just that part"; "Each uses 1 of your daily ✨ AI actions"). |
| **Total** | | **25/40** | **Acceptable** |

### Design Specificity Verdict

**LLM assessment: half authored, half interchangeable.**

The *flow* is specific to Daybloom:
- capture without deciding;
- a frozen, oldest-first, one-at-a-time Process inbox that ends at "Inbox zero";
- Convert that keeps a link back to the note ("→ 1 task");
- select a fragment, then convert only that;
- ✨ results that are always editable before anything is created.

That is a real point of view: capture first, organise later.

The *surface* says almost none of it. With the logo removed, the page could belong to any AI notes SaaS from 2024:
- a gradient title;
- translucent glass cards on a violet-tinted wash;
- violet pills everywhere;
- a masonry-ish grid of identical cards, each with a seven-icon toolbar.

The page meant to be "the heart of the app" has no focal point. The inline capture box, the tabs and search, the four-button action row and the tag row all carry similar weight, and the inbox count (the number that matters) is a small chip inside a tab. The confirmed "Clear Head" direction (crisp, neutral near-white emphasis, tactile surfaces) is not yet visible anywhere on this surface.

The missed opportunity is the inbox itself. The count and the next action ("4 to sort → Process") should be the one confident, tactile thing on the page, with notes reading as calm paper rather than seven-button widgets.

### What's Working

1. **Process inbox is the right shape.**
   - One note at a time, oldest first, in a queue frozen at start so items don't reshuffle (`ProcessInbox.tsx:15`).
   - A big, readable note preview, then one question: "What is it?".
   - Converting goes through the Convert dialog with "Archive the note afterwards (it stays linked)" preselected for inbox notes.
   - The end state ("Inbox zero! You processed 3 notes.") is an honest peak-end moment.
   - On phone it becomes a bottom sheet with two-column 44px buttons, which works well in the thumb zone.
2. **AI is optional, reviewable and honestly priced.**
   - Every ✨ entry point says what it costs ("Each uses 1 of your daily ✨ AI actions", and an AiButton tooltip with the remaining count) and disables itself at zero (`Ai.tsx:37`).
   - Every result panel is a draft: Organize lets you change the kind, title and date per note before Accept; Extract and Plan let you untick or rename steps.
   - Nothing is created behind your back. This is the PRODUCT.md "AI is a helper, never a requirement" principle done properly.
3. **Capture is fast from anywhere, and voice degrades gracefully.**
   - N, the + FAB, the top-bar field and the inline box all go to one composer.
   - Dictation shows "● Listening… speak naturally, tap the mic to stop." as `role="status"` and errors as `role="alert"` (`CaptureComposer.tsx:178-179`).
   - On unsupported browsers the mic is disabled and the textarea still works.
   - Task mode previews the parse live ("Will be saved as" plus chips) before saving. That is exactly the right amount of "decide later".

### Priority Issues

**[P0] Note-card menus open underneath the next card, so their lower items can't be clicked**
- **What:** The Convert (⇄) and ✨ AI menus render as `absolute z-20` children inside the card `<article class="glass">` (`NoteCard.tsx:53`). `.glass` applies `backdrop-blur-xl`, so every card is its own stacking context, and the next card in DOM order paints over the open menu. In the live app, opening Convert on the top-left card ("Email Prof. Okafor…") leaves "Add to a goal", "Make habit" and "Make goal" hidden under the "Idea: a study group…" card. `elementFromPoint` at the centre of the last menu item returns the *other* card's `<article>`.
- **Why it matters:** "Make habit" and "Make goal" exist only in this menu (Process inbox doesn't offer them), so for any card that isn't last in its column, those conversions are blocked for mouse and touch users. A click meant for "Make goal" can instead hit the other card's controls. This breaks the core "organise later" loop.
- **Fix:** Render the menu outside the card: a portal with `position: fixed`, or the native popover API, positioned from the trigger's rect and flipped upward near the viewport bottom. A stopgap is to set `relative z-30` on the article while a menu is open. Once moved, add proper menu keyboard behaviour (see the audit).
- **Suggested command:** /impeccable harden

**[P1] Escape and backdrop clicks destroy work: nested dialogs, ✨ results and capture drafts**
- **What:** `Modal` listens for Escape on `window` with no notion of which dialog is on top (`Modal.tsx:25`). Live: in Process inbox, choose "Make task" (Convert opens on top), press Escape once, and **both** dialogs close (2 → 0). The processing session ends and its frozen queue is lost. The same handler, plus the backdrop `onClick={onClose}` (`Modal.tsx:55`):
  - discards an Organize, Extract, Summary, Patterns or Plan result that already cost an AI use (the panel state lives only in `BrainDump.tsx:61`);
  - discards a half-typed or half-dictated thought in Capture, because the text is reset on the next open (`CaptureComposer.tsx:52`).
- **Why it matters:** Capture is the product's first promise and the daily ✨ allowance is scarce. One stray Escape or tap outside the sheet on a phone loses the thought or the paid result, with no way back. Busy, interrupted students (Casey) are exactly the users who will trigger this.
- **Fix:**
  - Keep a modal stack: only the topmost dialog handles Escape (call `stopPropagation`, or check a stack counter). Then Escape in Convert returns to Process.
  - Keep the Capture draft between openings (clear it only on save). If text is present, make the backdrop click a no-op.
  - Keep the last ✨ result in page state so it can be reopened ("Show last result") instead of being thrown away. Backdrop clicks should not close result panels that have unsaved edits.
- **Suggested command:** /impeccable harden

**[P1] Process inbox decisions have no undo, no Back, and Delete is instant**
- **What:**
  - "Delete" in Process calls `del.mutate` immediately, with no confirmation and no Undo toast (`ProcessInbox.tsx:73`). Compare the card's Delete, which at least offers Undo (`BrainDump.tsx:149`).
  - "Keep as idea", "Archive" and "Keep as note" advance silently (`ProcessInbox.tsx:62-70`).
  - There is no Back to revisit the previous note, and Skip is the only non-committing move.
- **Why it matters:** Process is a rapid-fire flow, so mis-taps are expected, especially in the phone sheet where Delete sits right under "Archive". A permanently deleted thought breaks the "your data is yours" promise. The session also gives no running feedback about what you did.
- **Fix:**
  - Route every Process action through the page's `changeNote` / `remove` helpers so each shows "Archived · Undo" (or similar).
  - Add a Back button next to Skip.
  - Move Delete out of the main grid, behind "More" or as a small text button with Undo.
  - Add 1–6 shortcut keys shown on the buttons for keyboard users.
- **Suggested command:** /impeccable harden

**[P1] A tag filter can stay active while its chip is hidden, leaving an empty list with no way out**
- **What:** `tag` state is never cleared when the view changes (`BrainDump.tsx:57`, `:109`), but the chip row only lists tags present in the *current* view (`:100`). Live: select #study on Inbox, then open Archive. The chip row is empty, the list shows "🔍 No notes match", and the tab still says "Archive 1". The `EmptyState` has no "Clear filters" action (`:270`).
- **Why it matters:** The user sees "1" archived note on the tab and an empty list below it. The only escape is to go back to a view where #study exists and untoggle it, which nobody will figure out. The numbers don't match the list, which runs against the honest-numbers commitment.
- **Fix:** Reset `tag` in `setView`, or always render the active tag chip (with an ×) even when it's absent from the view. Give the "No notes match" empty state a "Clear search and filters" button.
- **Suggested command:** /impeccable harden

**[P2] One decision, three vocabularies**
- **What:** "What is this note?" is asked in three places with different options, words and icons:
  - card Convert menu (`NoteCard.tsx:146-150`): ✅ Make task · 🗓️ Schedule in Planner · 🎯 Add to a goal · 🔁 Make habit · 🏁 Make goal, as emoji;
  - Process grid (`ProcessInbox.tsx:53-70`): Make task · Schedule · Add to goal · Keep as idea · Archive · 📄 Keep as note, as lucide icons in four colours plus one emoji, and no habit or goal;
  - Organize (`AiNotePanels.tsx:24`): ✅ Task · ⏰ Reminder · 💡 Idea · 📓 Journal · 📄 Reference. Reminder means the same as Task; Journal and Reference both mean "note".
  
  The "note" state has no tab of its own; it appears only under All notes with a sky "Note" badge.
- **Why it matters:** Students who "won't learn a system" now have to learn four overlapping ones. "Keep as note" vs "Keep as idea" vs "Archive" is the hardest distinction on the page, and nothing explains it.
- **Fix:**
  - Define one outcome list in one module and use it everywhere: label, icon (lucide, monochrome, no emoji) and order. For example: Task · Schedule · Goal step · Habit · Goal · Idea · Reference · Archive.
  - Rename "Keep as note" to "Keep as reference" with a one-line hint ("Stays in All notes, out of your inbox"), and make Organize's kinds map to the same words.
  - Give Process a "More…" for habit and goal.
- **Suggested command:** /impeccable clarify

**[P2] No focal point; on phone the notes start below the fold**
- **What:**
  - Above the first note, the page stacks: header (3 lines) → AI allowance pill → a 3-row capture box → tabs → search → hint → **four** action buttons (Process inbox plus three ✨ buttons that wrap to two rows) → tag row.
  - At 390×844 the first card's top is at **687px** (measured), and its title is covered by the + FAB and Atlas orb (`dark-phone/brain-dump.jpg`).
  - On desktop, the violet gradient "Process inbox (4)" and three violet-outlined ✨ buttons read as four equal choices. In light theme the lavender ✨ fills are nearly as loud as the primary.
  - Desktop also shows three capture inputs at once: the top bar, the inline textarea and the FAB.
- **Why it matters:** The heart of the app opens to chrome, not to your notes or the one obvious next step. That runs against "Clear Head: nothing competing, next action obvious".
- **Fix:**
  - On phones, collapse the inline capture to a one-line field (or drop it, since the FAB and N already capture) and move the AI allowance pill into the ✨ menu.
  - Merge "Summarize week" and "Find patterns" (and Organize) into one quiet "✨ Atlas" menu button using the Atlas cyan accent, per the direction. That leaves exactly one primary: "Process 4 notes", in neutral near-white.
  - Make the inbox count part of the page's lead line rather than a tab badge.
  - Align the grid items to the start (`items-start`) so short cards don't stretch.
- **Suggested command:** /impeccable layout (then /impeccable quieter for the violet and gradients)

### Persona Red Flags

**Casey (distracted mobile user, one thumb, between lectures)**
- Opens Brain Dump and sees no notes in the first viewport: the first card starts at 687px, behind the bottom bar, and its title is under the FAB and orb.
- Card controls are 32×32px (Convert, ✨, Pin, Edit, Archive, More) and "💡 Keep as idea" is 26px tall. Checklist boxes are **14×14px**, and tapping the item text ("oats") does nothing because the text isn't a `<label>`. All 43 measured controls in `main` are under 44px.
- Mid-dictation in the Capture sheet, a thumb brushes the dimmed backdrop and the sheet closes. The next open is blank, so the thought is gone.
- In the Process sheet, Delete sits directly below Archive with no undo.

**Alex (power user who processes the inbox weekly)**
- Process inbox has no keyboard shortcuts: every decision is Tab-Tab-Tab-Enter or a mouse trip.
- Pressing Escape to back out of a Convert form kills the whole processing session.
- Card menus declare `role="menu"` but don't move focus into the menu and ignore arrow keys (live: focus stays on the trigger after opening and after ArrowDown). Menu users have to Tab through them.
- There is no bulk select or multi-archive on the grid, and search covers note bodies only, not tags.

**Sam (keyboard / screen-reader user)**
- A per-note ✨ request's only progress signal is a pulsing icon inside a closed menu trigger. Nothing is announced and the result simply appears as a dialog.
- The view switcher uses `role="tab"` without `tabpanel`, `aria-controls` or arrow-key roving. While searching, no tab is selected and nothing says the view filter is suspended.
- Checklist checkboxes are labelled only by their item text and sit in tab order between cards: four extra stops ("oats, bananas, coffee, rice") between one card's More button and the next card's Convert.
- The Convert and AI menus are visually hidden under the next card (P0), and that is still where keyboard focus goes.

### Cognitive Load

Checklist failures (3 of 8: **moderate**):
- **Single focus: fail.** On desktop, three capture entry points are visible at once (top-bar field, inline textarea, + FAB), plus the Atlas orb, all competing with the inbox.
- **Visual hierarchy: fail.** Four action buttons of near-equal weight, violet on the title, primary, tabs, chips, AI buttons and inbox badge. Nothing says "start here".
- **Minimal choices: fail.** See the decision points below.
- Passes: chunking (views / search / actions are separate rows), grouping (card toolbar split left and right), one thing at a time (Process inbox is exemplary), working memory (Organize and Process show the note text beside the decision), progressive disclosure (Convert and AI live in menus).

Decision points with more than 4 visible options:
- **Process inbox:** 8 (Make task, Schedule, Add to goal, Keep as idea, Archive, Keep as note, Delete, Skip).
- **Note card toolbar:** 7 controls per card (Convert, ✨, Keep as idea, Pin, Edit, Archive, More), repeated on every card.
- **Convert menu:** 5 (task, schedule, goal step, habit, goal).
- **Organize kind select:** 5 (Task, Reminder, Idea, Journal, Reference), where two pairs are synonyms.
- **Page action row (Inbox view):** exactly 4 (Process, Organize, Summarize week, Find patterns). It sits at the limit, and all four look equally primary.

### Minor Observations

- Grid rows stretch: the one-line "Email Prof. Okafor…" card is as tall as the four-item grocery checklist next to it (`BrainDump.tsx:273`, default `align-items: stretch`).
- "→ 1 task" on a card is plain text. It should link to the task(s) it created, since that link-back is a selling point.
- "More" (`…`) opens a menu with a single item, Delete note (`NoteCard.tsx:199-205`).
- Hashtags render pink (`Markdown.tsx:35`, `text-pink-700 dark:text-pink-300`), which is decorative colour from the old gradient family.
- In SummaryPanel, "Save as note" is the ghost button and "Close" is the primary (`AiNotePanels.tsx:194-206`). The useful action is visually demoted.
- PlanPanel's toast reads "Added 1 tasks from your plan" when one step is kept (`AiNotePanels.tsx:257`).
- ExtractPanel shows raw ISO dates ("2026-10-30") that can't be edited (`AiNotePanels.tsx:152`), and drops the priority it received.
- The "Ctrl/⌘ + Enter" hint shows both platforms' keys instead of detecting the platform.
- The inline "● Listening…" label on the page (`BrainDump.tsx:199`) lacks the `role="status"` that the Capture dialog's version has.
- In Process inbox the progress bar is `aria-hidden` and starts empty on "Note 1 of 4". That's accurate, but it would feel better to show "0 sorted · 4 left".
- The Capture dialog's "Brain dump note | Task" switch asks a question at capture time. It defaults correctly to note, but the violet segmented control makes it look like a required choice.

## Audit

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | The `.faint` tier is 3.5–3.9:1 on dark (timestamps, hints, "Captured 1d ago"). Process "Delete" is 3.5:1. White on the primary gradient's blue end is 3.9:1. Card menus claim `role="menu"` without menu keyboard behaviour. `Modal` itself is solid (focus in, trap, restore). |
| 2 | Performance | 3 | Fine at Maya's scale. But every note card is a `backdrop-blur-xl` layer, the list isn't virtualized (up to 2000 notes), and `linkText` scans tasks, habits and goals for every card on every render. |
| 3 | Theming | 2 | Dark and light are both complete. But violet is hard-coded across the surface (tabs, segmented control, checkboxes, progress bar, pinned border, AI buttons), surfaces use literal hexes (`#17142a`, `#13111f`), and hashtags are decorative pink. There are no semantic tokens. |
| 4 | Responsive Design | 2 | Works at 390px with bottom-sheet dialogs. All 43 measured controls in `main` are under 44px (card icons 32px, chips 26px, checklist boxes 14px). The first note starts at 687px of 844px and sits under the FAB and orb. |
| 5 | Implementation Integrity | 2 | Several verified defects: a stacking-context bug hides menu items, a single global Escape closes every dialog, the tag filter has orphaned state, and "Undo" after delete creates a *different* note. The same decision appears in three vocabularies. |
| **Total** | | **11/20** | **Acceptable** |

**Implementation integrity verdict: fail (narrowly).** The architecture is sound:
- optimistic list mutations with rollback and plain-language error toasts (`hooks/data/cache.ts`);
- safe Markdown built as React nodes with no `innerHTML` (`Markdown.tsx`);
- one accessible `Modal`, and one `AiButton` that always states its cost.

But on the product's core surface, four verified behavioural bugs (findings 1, 2, 4 and 6) break the capture → organise loop or its promises.

### Detector findings

Scope: 12 scans (brain-dump, process-inbox and capture × dark/light × desktop/phone), 170 findings in total. The "capture" scans show the Capture dialog over the **Dashboard**, so some findings there belong to the dashboard behind it.

| Rule | Count | Verdict |
|------|------:|---------|
| `low-contrast` | 63 | **Mostly real.** <br>(a) `.faint` = slate-500 `#64748b` on dark card or dialog surfaces, 3.5–3.9:1: card timestamps (`time.faint`, `NoteCard.tsx:93`), the "→ 1 task" link text (`:101`), "Ctrl/⌘ + Enter" (`BrainDump.tsx:200`), the Capture hint (`CaptureComposer.tsx:205`), "Captured 1d ago" (`ProcessInbox.tsx:48`) and the checklist count (`NoteCard.tsx:97`). **Real, WCAG 1.4.3.** <br>(b) White on the `.btn-primary` gradient's blue end `#447cf5`, 3.9:1 ("Process inbox (4)", "Save to inbox"). **Real**, and resolved by the planned neutral primary. <br>(c) Process "Delete": `text-rose-600` with no dark variant, `#e11d48` on `#1f1d2a`, 3.5:1 (`ProcessInbox.tsx:73`). **Real.** <br>(d) Placeholders: the inline capture placeholder (3.9:1 dark) and "Search all notes" (3.9:1 dark, **2.5:1 light**, slate-400 `index.css:71`). **Real**, and the capture placeholder carries instructions. <br>(e) The white-on-`#cc4fb7` logo and avatar gradient is real but belongs to the shell, not this surface. <br>(f) TaskChips rose and amber at 3.8 and 4.45:1 in light/capture are on the Dashboard behind the dialog: out of scope here. |
| `ai-color-palette` | 48 | 4 per scan. The **Atlas orb's cyan gradient** (`span.absolute.inset-[18%]`) is a **false positive**: cyan is reserved for Atlas. The logo and avatar violet gradients and the "purple/violet accent colors detected" on `body` are real but already slated for removal per DESIGN.md. |
| `dark-glow` | 24 | `.btn-primary` violet glow (`index.css:80`) and the + FAB's `shadow-violet-900/30`: real, slated for removal. The Atlas orb's cyan glow (`#164e63`, `button.group.flex`) is the Atlas signature: treat as intentional pending the owner's call (**false positive** for this surface). |
| `gradient-text` | 18 | The `h1.gradient-text` "Brain Dump" title (`PageHeader.tsx:8`, `index.css:59-62`) and the logo wordmark. Real, slated (The No-Ornament Type Rule). |
| `overused-font` | 12 | **False positive.** One sans family (Inter) is the documented choice and is right for Operate surfaces (operate.md, "One family is often right"). |
| `nested-cards` | 8 | **False positive for this surface.** All 8 are the Dashboard task list behind the Capture dialog (`li > div.group.flex`). Nothing on the Brain Dump nests cards. |

**What the detector missed** (found by review and live checks): the menu stacking bug (P0), Escape closing stacked dialogs, the orphaned tag filter, menu/tab ARIA gaps, touch target sizes, AI status not announced (and invisible under reduced motion), and the fake undo after delete.

### Findings by severity

**[P0] 1. Card menus are painted under the next note card**
- **Location:** `src/components/notes/NoteCard.tsx:53` (menu `absolute z-20` inside the card); `src/index.css:52-54` (`.glass` → `backdrop-blur-xl` creates a stacking context per card); grid in `src/pages/app/BrainDump.tsx:273`.
- **Category:** Implementation Integrity
- **Impact:** Lower menu items on any card that has a card below it can't be clicked. Live: the last Convert item's hit-test returns the next `<article>`. "Make habit" and "Make goal" have no other entry point.
- **WCAG:** none directly. It's a functional defect, though keyboard users can still reach the hidden items while sighted users can't see them.
- **Recommendation:** Portal the menu to `document.body` with `position: fixed` from the trigger rect (or use the popover API), with flip-up near the viewport bottom. Interim fix: `relative z-30` on the article while a menu is open.
- **Suggested command:** /impeccable harden

**[P1] 2. One Escape closes every open dialog; dismissing throws away drafts and paid ✨ results**
- **Location:** `src/components/ui/Modal.tsx:24-25` (a `window` keydown listener per modal, with no stack), `:55` (backdrop click closes); `src/components/notes/ProcessInbox.tsx:83-92` (Convert stacked on Process); `src/components/capture/CaptureComposer.tsx:49-58, 86-90` (text reset on reopen); `src/pages/app/BrainDump.tsx:61, 300-304` (✨ result only in transient state).
- **Category:** Implementation Integrity / Accessibility
- **Impact:** Live: Process → Make task → Esc closes both dialogs (count went from 2 to 0) and ends the session. A stray Escape or tap outside loses a typed or dictated thought, or a result that already used an AI action.
- **WCAG:** none directly (it relates to 3.3.4 Error Prevention in spirit).
- **Recommendation:** Keep a module-level modal stack so only the top dialog handles Escape. Keep the capture draft until save. Keep the last ✨ result per action and let users reopen it. Ignore backdrop clicks when a dialog has unsaved input.
- **Suggested command:** /impeccable harden

**[P1] 3. Process inbox: instant permanent delete, silent decisions, no Back**
- **Location:** `src/components/notes/ProcessInbox.tsx:62-79`
- **Category:** Implementation Integrity
- **Impact:** A mis-tap on Delete (adjacent to Archive in the phone sheet) destroys a note with no recovery. Idea, Archive and Note decisions advance with no confirmation. There is no way back to the previous note. Delete's label is also 3.5:1 on dark.
- **WCAG:** 1.4.3 for the Delete label.
- **Recommendation:** Reuse `changeNote` / `remove` from `BrainDump.tsx:138-150` so each action toasts with Undo. Add Back. Move Delete to a secondary position. Use `dark:text-rose-300`. Add 1–6 key shortcuts.
- **Suggested command:** /impeccable harden

**[P1] 4. Orphaned tag filter: empty list, no visible way to clear it**
- **Location:** `src/pages/app/BrainDump.tsx:57, 99-100, 109, 259-270`
- **Category:** Implementation Integrity
- **Impact:** Live: #study on Inbox → Archive tab gives no chips and "No notes match" while the tab says "Archive 1". Counts and list disagree, and the user is stuck.
- **WCAG:** none directly.
- **Recommendation:** Clear `tag` in `setView`, or always render the active tag chip. Add a "Clear search and filters" action to the empty state.
- **Suggested command:** /impeccable harden

**[P1] 5. Secondary text tier fails AA on dark surfaces**
- **Location:** `src/index.css:66-68` (`.faint` = slate-500 in both themes), used at `NoteCard.tsx:93, 97, 101, 145, 159`, `BrainDump.tsx:200`, `CaptureComposer.tsx:186, 196, 205`, `ProcessInbox.tsx:48`, `AiNotePanels.tsx:102, 152, 277-279`.
- **Category:** Accessibility
- **Impact:** Timestamps, hints and AI reasons are 3.5–3.9:1, and the menu hints are 11px. These are exactly the "when did I capture this?" cues.
- **WCAG:** 1.4.3 Contrast (Minimum)
- **Recommendation:** Set `.faint` to `dark:text-slate-400` (about 7:1 on `#14131b`). Once the neutral palette lands, keep the tertiary tier at ≥4.5:1 on every surface level. Make the menu hints 12px.
- **Suggested command:** /impeccable polish

**[P1] 6. White text on the primary gradient is 3.9:1**
- **Location:** `src/index.css:78-80` (`.btn-primary` violet→indigo→blue); on this surface: "Process inbox (4)" `BrainDump.tsx:238`, "Save to inbox" `:201`, Capture "Save to inbox" `CaptureComposer.tsx:212`, and every panel's Accept/Create button.
- **Category:** Accessibility / Theming
- **Impact:** The label of the single most important action fails contrast at its right half.
- **WCAG:** 1.4.3
- **Recommendation:** Implement the confirmed direction: a solid neutral near-white primary with near-black text in dark (and the reverse in light). No gradient, no glow.
- **Suggested command:** /impeccable quieter

**[P2] 7. "Undo" after deleting a note creates a different note**
- **Location:** `src/pages/app/BrainDump.tsx:147-150`
- **Category:** Implementation Integrity (honesty / data control)
- **Impact:** Undo re-inserts `{body, state}` with a new id and `created_at`. The note loses its pin and capture date ("1d ago" becomes "just now"), and tasks, habits or goals whose `source_note_id` pointed at it lose their link-back ("→ 1 task" disappears). Users believe the note was restored.
- **WCAG:** none.
- **Recommendation:** Delay the delete until the toast expires (soft delete), or restore with the original id and all fields.
- **Suggested command:** /impeccable harden

**[P2] 8. Menu and tab ARIA patterns are declared but not implemented**
- **Location:** `NoteCard.tsx:33-60` (`role="menu"` and `menuitem`, but focus isn't moved in and there are no arrow, Home or End keys; live: ArrowDown leaves focus on the trigger); `BrainDump.tsx:208-219` and `CaptureComposer.tsx:127-143` (`role="tab"` with no `tabpanel` or `aria-controls`, no roving tabindex, and no selected tab during search).
- **Category:** Accessibility
- **Impact:** Screen-reader users are told menu or tab semantics and then the expected keys don't work.
- **WCAG:** 4.1.2 Name, Role, Value; 2.1.1 Keyboard (expected pattern).
- **Recommendation:** Either implement the full APG patterns, or downgrade honestly: plain disclosure buttons with `aria-expanded` for the menus, and `aria-pressed` toggle buttons (or a radiogroup) for the view switcher and capture mode.
- **Suggested command:** /impeccable harden

**[P2] 9. Touch targets under 44px across the surface; first note below the fold on phone**
- **Location:** `NoteCard.tsx:49, 180-195` (`h-8 w-8` = 32px), `:174` (chip 26px), `Markdown.tsx:79-90` (14px checkbox; the item text is a `<span>`, not a `<label>`), `BrainDump.tsx:201, 238` (32px and 36px buttons next to 42px ✨ buttons), FAB and orb `AppShell.tsx:126` overlapping the first card.
- **Category:** Responsive
- **Impact:** Thumb mis-taps on dense card toolbars, and the checklist is hard to tick on a phone. The 32px controls pass WCAG 2.5.8 (≥24px). The 14px checkboxes rely on the spacing exception and pass only narrowly.
- **WCAG:** 2.5.8 Target Size (Minimum), borderline for the checkboxes.
- **Recommendation:** Make each checklist row a `<label>` (the whole row toggles). Use ≥40–44px hit areas on phone (padding, not bigger icons). Add bottom padding to the list equal to the FAB stack height. Use one button height per row.
- **Suggested command:** mobile-native

**[P2] 10. Placeholder text contrast**
- **Location:** `index.css:71` (`placeholder:text-slate-400` light, `dark:placeholder:text-slate-500`); `BrainDump.tsx:184-185` (inline capture uses its own `placeholder:text-slate-500`).
- **Category:** Accessibility
- **Impact:** "Search all notes" is 2.5:1 in light. The inline capture placeholder, which holds the only "Markdown and checklists work" instruction on the page, is 3.9:1 in dark.
- **WCAG:** 1.4.3 (placeholder text)
- **Recommendation:** Placeholders at ≥4.5:1. Move the Markdown/checklist instruction to persistent helper text, as Capture already does.
- **Suggested command:** /impeccable polish

**[P2] 11. Hard-coded violet and tinted surfaces instead of tokens**
- **Location:** `NoteCard.tsx:53` (`dark:bg-[#17142a]`), `Modal.tsx:63` (`dark:bg-[#13111f]`), `BrainDump.tsx:215` and `CaptureComposer.tsx:139` (`bg-violet-600` selection), `Markdown.tsx:35` (pink hashtags), `Markdown.tsx:86`, `ConvertDialog.tsx:179`, `AiNotePanels.tsx:150, 276` (`accent-violet-600`), `ProcessInbox.tsx:45` (violet bar), `ProcessInbox.tsx:54-60` (violet, blue and emerald icons), `NoteCard.tsx:87, 91` (violet pinned and highlight), `Ai.tsx:20-23` and `.btn-ai` `index.css:93-95` (AI is violet, but the direction says cyan = Atlas/AI).
- **Category:** Theming
- **Impact:** The planned neutral migration has to edit about 15 call sites on this surface alone. Today the surface violates The Meaning-Only Rule (decorative pink tags and coloured outcome icons) and The Atlas Colour Rule (AI isn't cyan).
- **WCAG:** none.
- **Recommendation:** Introduce semantic tokens (`--surface-raised`, `--accent`, `--selected`, `--atlas`) and replace the literals. Make ✨ buttons, panels and allowance pills use the Atlas cyan token, quietly. Use neutral selection for tabs and segments, and neutral hashtags (weight, not colour).
- **Suggested command:** /impeccable colorize

**[P2] 12. Every note card is a backdrop-blur layer in an unvirtualized list**
- **Location:** `index.css:52-54` via `NoteCard.tsx:87`; `hooks/data/notes.ts:17` (`limit(2000)`); `BrainDump.tsx:99-107` (`shown`, `tags` and `linkText` recomputed each render, `linkText` is O(notes × (tasks + habits + goals))).
- **Category:** Performance
- **Impact:** Scroll and repaint cost grows with every note on mid-range phones. The blur is also what creates the stacking contexts behind finding 1.
- **WCAG:** none.
- **Recommendation:** Solid card surfaces (the confirmed "tactile" direction) with no per-card blur. Memoize a `noteId → counts` map once. Paginate or virtualize past about 100 notes.
- **Suggested command:** /impeccable optimize

**[P2] 13. ✨ progress isn't announced, and disappears under reduced motion**
- **Location:** `NoteCard.tsx:156` (busy state is only `animate-pulse` on the trigger icon); `Ai.tsx:39-46` (no `aria-busy` or status text); `index.css:32-40` (the global 0.01ms rule turns the pulse into a static icon).
- **Category:** Accessibility
- **Impact:** After choosing "✨ Summarize" on a note, screen-reader users hear nothing until a dialog appears. Reduced-motion users see *no* change at all while a request runs.
- **WCAG:** 4.1.3 Status Messages
- **Recommendation:** Show a visible text state on the card ("✨ Summarizing…") inside a `role="status"` region, and set `aria-busy` on the button. Under reduced motion, keep a non-animated indicator (text or a filled icon).
- **Suggested command:** /impeccable harden

**[P2] 14. Plan panel can create duplicates and fails silently**
- **Location:** `src/components/notes/AiNotePanels.tsx:254-265, 300`
- **Category:** Implementation Integrity
- **Impact:** `create` awaits `addGoal.mutateAsync` with no pending state, so a double click creates two goals. There's no `try/catch`, so a failure leaves the panel open with no message beyond the generic toast. "Added 1 tasks" isn't pluralized. The inbox note is silently moved to Ideas.
- **WCAG:** none.
- **Recommendation:** Disable Create while pending and catch errors. Pluralize. Say in the toast that the note moved to Ideas.
- **Suggested command:** /impeccable harden

**[P3] 15. Grid rows stretch short cards into empty boxes**
- **Location:** `BrainDump.tsx:273`
- **Category:** Responsive / layout
- **Impact:** Visual noise: the one-line "Email Prof. Okafor…" card is about 230px tall.
- **WCAG:** none.
- **Recommendation:** `items-start`, or a CSS columns masonry layout.
- **Suggested command:** /impeccable layout

**[P3] 16. ✨ result panels de-emphasize the useful action**
- **Location:** `AiNotePanels.tsx:194-206` ("Save as note" is ghost, "Close" is primary), `:152` (raw ISO date, priority dropped), `:24` (emoji kind labels).
- **Category:** Implementation Integrity
- **Impact:** Users are more likely to close a result than to keep it.
- **WCAG:** none.
- **Recommendation:** Make "Save as note" the primary. Use friendly dates ("Fri 30 Oct") through the same date picker as Convert. Show priority chips.
- **Suggested command:** /impeccable polish

**[P3] 17. Process inbox queue is captured once from possibly-unloaded data**
- **Location:** `ProcessInbox.tsx:15`
- **Category:** Implementation Integrity
- **Impact:** A latent risk: on a cold `?process=1` deep link (Dashboard card `Dashboard.tsx:251`, command palette, onboarding checklist), if `useNotes` hasn't resolved when the dialog mounts, the frozen queue is `[]` and the dialog says "Your inbox is already empty." **Not reproduced** in the live check, where the queue loaded correctly, but nothing guards it.
- **WCAG:** none.
- **Recommendation:** Initialize the queue in an effect once `notes.data` is defined, or render a loading state until it is.
- **Suggested command:** /impeccable harden

### Positive findings

- **`Modal` is a good base:** it portals to `body`, moves focus in (honouring `autoFocus`), traps Tab, restores focus on close, and renders as a bottom sheet on phones (`Modal.tsx`). Fixing the stack issue makes it excellent.
- **Optimistic mutations with rollback and human error copy** for every note change (`cache.ts`): capture feels instant and failures are honest.
- **Safe Markdown:** React nodes only, links `rel="noopener noreferrer nofollow"`, and checkboxes labelled by their item text (`Markdown.tsx`).
- **AI cost transparency is wired through one component:** `AiButton` always states "Uses 1 of your N AI actions left today" and disables itself when the allowance is spent or AI is paused (`Ai.tsx:31-46`).
- **Voice input** uses `aria-pressed`, a `role="status"` listening line and a `role="alert"` error, and falls back cleanly when unsupported (`CaptureComposer.tsx:166-179`).
- **Visible focus** comes globally from `:focus-visible` (`index.css:29-31`). Every icon-only control on the card has an `aria-label` and a `title`.

## Motion on this surface

| # | Motion | Where | Trigger | Duration / easing | Earns its place? |
|---|--------|-------|---------|-------------------|------------------|
| 1 | Dialog / sheet fade + 4px rise | `Modal.tsx:63` (`animate-fade-in`, `tailwind.config.js` keyframes) | Opening Capture, Process inbox, Convert, every ✨ panel | 250ms ease-out | **Mostly.** It confirms the layer change. But Capture opens many times a day: 150–180ms would feel quicker. On phone the sheet should rise from the bottom edge (translateY 100% → 0, about 220ms ease-out) rather than nudge 4px, so the bottom-sheet relationship reads. The backdrop (`Modal.tsx:55`) appears instantly with a full-screen `backdrop-blur-sm`, which is costly; fade it at 150ms and drop the blur. |
| 2 | Menu fade + 4px rise | `NoteCard.tsx:53` (`animate-fade-in`) | Opening Convert, ✨ or More on a card | 250ms ease-out | **Too slow for a high-frequency menu.** Use 120–150ms, or none. Fix the stacking bug first. |
| 3 | Button press scale 0.97 | `.btn` `index.css:74-76` (`active:scale-[0.97]` + `transition`) | Pressing any button | about 150ms (Tailwind default `transition`, cubic-bezier(.4,0,.2,1)) | **Yes.** It's the tactile, confident press the direction asks for. Keep it. Note `transition` also animates colour, shadow and filter, so scope it to `transform, background-color` when the glow goes. |
| 4 | Tab / segmented background colour swap | `BrainDump.tsx:215`, `CaptureComposer.tsx:139` | Changing view or capture mode | about 150ms colour transition | **Yes**, as a minimal state change. A sliding indicator isn't needed. |
| 5 | Process progress bar width | `ProcessInbox.tsx:45` (`transition-all`) | Each decision or Skip | about 150ms on `width` | **Earns its place** (progress), but it animates a layout property. Use `transform: scaleX()` with `origin-left`. |
| 6 | Sparkle pulse while a per-note ✨ request runs | `NoteCard.tsx:156` (`animate-pulse`) | ✨ Extract / Summarize / Plan | 2s infinite opacity | **Purpose is right, execution is too weak.** It's the *only* busy signal, it's tiny, and the global reduced-motion rule makes it static, so the state disappears. Pair it with text (finding 13). |
| 7 | Spinner in ✨ buttons | `Ai.tsx:42` (`animate-spin` Loader2) | Organize / Summarize week / Find patterns pending | 1s linear infinite | **Yes.** Under reduced motion it freezes into a static loader icon, which still reads as "busy". Acceptable. |
| 8 | Skeleton pulse | `States.tsx:42` via `QueryState` (`BrainDump.tsx:269`) | Initial notes load | 2s infinite | **Yes**, standard loading affordance. |
| 9 | Hover colour transitions | `.icon-btn`, `.chip-*`, `.input`, menu items (`index.css:69-95, 133-142`; `NoteCard.tsx:63`) | Hover / focus | about 150ms | **Yes**: quiet and expected. |
| 10 | Card `transition` | `NoteCard.tsx:87` | Nothing animates in practice (the highlight ring and pinned border change rarely) | about 150ms | **Remove.** It's a dead transition on every card. The `group` class is also unused. |

**Missing motion that would carry state:**
- **Process inbox note change.** After Skip or a decision, the note text swaps in place with an identical layout, so it's easy to miss that you're on a new note. A 120–160ms crossfade or 8px slide of the preview card would signal "next".
- **A note leaving the Inbox** (archive, idea) vanishes instantly. A short collapse would show where it went, with the existing toast for Undo.
- **The "● Listening…" dot** is static. A subtle opacity pulse with a static fallback would show the mic is live. This is the everyday echo of the voice HUD showpiece, kept calm.

**Reduced motion:** the global rule (`index.css:32-40`) cuts every animation to 0.01ms. That's safe for the dialog and menu, but it removes the per-note ✨ busy state entirely (row 6), and the review flags a blanket kill that destroys feedback. Swap the blanket rule for per-component reduced-motion alternatives where the animation *is* the status.

## Machine-readable summary

```json
{"surface":"brain-dump","critique_total":25,"critique_max":40,"na_heuristics":[],"audit_total":11,
 "issues":[
  {"id":"brain-dump-1","severity":"P0","title":"Note-card Convert/AI menus render underneath the next card; lower items (Make habit, Make goal) unclickable","fix":"Portal the menu (position:fixed or popover API) anchored to the trigger with flip-up; interim: raise the open card's z-index","command":"/impeccable harden","files":["src/components/notes/NoteCard.tsx:53","src/index.css:52"],"source":"both"},
  {"id":"brain-dump-2","severity":"P1","title":"One Escape closes all stacked dialogs; Escape/backdrop discards capture drafts and paid AI results","fix":"Modal stack so only the top dialog handles Escape; persist the capture draft until save; keep and allow reopening the last AI result; ignore backdrop clicks when input is unsaved","command":"/impeccable harden","files":["src/components/ui/Modal.tsx:24","src/components/ui/Modal.tsx:55","src/components/notes/ProcessInbox.tsx:83","src/components/capture/CaptureComposer.tsx:49","src/pages/app/BrainDump.tsx:61"],"source":"both"},
  {"id":"brain-dump-3","severity":"P1","title":"Process inbox: Delete is instant and permanent, other decisions are silent, no Back; Delete label 3.5:1 on dark","fix":"Route actions through changeNote/remove with Undo toasts, add Back, demote Delete, dark:text-rose-300, add 1-6 shortcuts","command":"/impeccable harden","files":["src/components/notes/ProcessInbox.tsx:62","src/components/notes/ProcessInbox.tsx:73"],"source":"both"},
  {"id":"brain-dump-4","severity":"P1","title":"Tag filter persists across views while its chip is hidden: empty list with no way to clear","fix":"Reset tag on view change or always render the active tag chip; add a Clear search and filters action to the empty state","command":"/impeccable harden","files":["src/pages/app/BrainDump.tsx:57","src/pages/app/BrainDump.tsx:100","src/pages/app/BrainDump.tsx:270"],"source":"both"},
  {"id":"brain-dump-5","severity":"P1","title":"Faint text tier (timestamps, hints) is 3.5-3.9:1 on dark surfaces","fix":"Set .faint to dark:text-slate-400 (and keep tertiary text at >=4.5:1 in the neutral palette); raise 11px menu hints to 12px","command":"/impeccable polish","files":["src/index.css:66","src/components/notes/NoteCard.tsx:93","src/components/notes/ProcessInbox.tsx:48","src/components/capture/CaptureComposer.tsx:205"],"source":"audit"},
  {"id":"brain-dump-6","severity":"P1","title":"White label on the violet-to-blue primary gradient is 3.9:1 (Process inbox, Save to inbox)","fix":"Solid neutral near-white primary with near-black text, no gradient or glow, per the confirmed direction","command":"/impeccable quieter","files":["src/index.css:78","src/pages/app/BrainDump.tsx:238"],"source":"audit"},
  {"id":"brain-dump-7","severity":"P2","title":"One 'what is it?' decision in three vocabularies (Convert menu, Process grid, Organize kinds); 'Keep as note' unexplained","fix":"One shared outcome list (label, lucide icon, order) used everywhere; rename Keep as note to Keep as reference with a hint; map Organize kinds to it; add habit/goal to Process via More","command":"/impeccable clarify","files":["src/components/notes/NoteCard.tsx:146","src/components/notes/ProcessInbox.tsx:53","src/components/notes/AiNotePanels.tsx:24"],"source":"critique"},
  {"id":"brain-dump-8","severity":"P2","title":"No focal point: four equal-weight actions, three capture inputs, first note at 687px of 844 on phone under FAB/orb","fix":"Collapse inline capture on phone; merge Organize/Summarize week/Find patterns into one quiet Atlas-cyan menu; single neutral primary 'Process 4 notes'; bottom padding for the FAB stack","command":"/impeccable layout","files":["src/pages/app/BrainDump.tsx:165","src/pages/app/BrainDump.tsx:171","src/pages/app/BrainDump.tsx:233"],"source":"critique"},
  {"id":"brain-dump-9","severity":"P2","title":"Undo after delete re-inserts a new note: loses id, date, pin and task/habit/goal link-backs","fix":"Soft-delete until the toast expires, or restore with the original id and fields","command":"/impeccable harden","files":["src/pages/app/BrainDump.tsx:147"],"source":"audit"},
  {"id":"brain-dump-10","severity":"P2","title":"role=menu and role=tab declared without the keyboard patterns (no focus move, no arrow keys, no tabpanel)","fix":"Implement APG menu/tabs or downgrade to disclosure buttons with aria-expanded and aria-pressed toggles","command":"/impeccable harden","files":["src/components/notes/NoteCard.tsx:33","src/pages/app/BrainDump.tsx:208","src/components/capture/CaptureComposer.tsx:127"],"source":"audit"},
  {"id":"brain-dump-11","severity":"P2","title":"Touch targets under 44px (32px card icons, 26px chips, 14px checklist boxes with non-label text); mixed button heights","fix":"Whole checklist row as a label; 40-44px hit areas on phone via padding; one button height per row","command":"mobile-native","files":["src/components/notes/NoteCard.tsx:180","src/components/notes/Markdown.tsx:79","src/pages/app/BrainDump.tsx:238"],"source":"audit"},
  {"id":"brain-dump-12","severity":"P2","title":"Placeholder contrast: search 2.5:1 light, inline capture instructions 3.9:1 dark","fix":"Placeholders at >=4.5:1; move the Markdown/checklist instruction to persistent helper text","command":"/impeccable polish","files":["src/index.css:71","src/pages/app/BrainDump.tsx:184"],"source":"audit"},
  {"id":"brain-dump-13","severity":"P2","title":"Hard-coded violet/pink and tinted hex surfaces; AI styled violet instead of Atlas cyan","fix":"Semantic tokens (surface-raised, accent, selected, atlas); neutral selection; neutral hashtags; AI buttons/panels on the Atlas cyan token","command":"/impeccable colorize","files":["src/components/notes/NoteCard.tsx:53","src/components/ui/Modal.tsx:63","src/components/notes/Markdown.tsx:35","src/index.css:93","src/components/ui/Ai.tsx:20"],"source":"both"},
  {"id":"brain-dump-14","severity":"P2","title":"Per-card backdrop blur in an unvirtualized list; linkText recomputed per card per render","fix":"Solid tactile card surfaces; memoize a note-to-links map; paginate or virtualize past ~100 notes","command":"/impeccable optimize","files":["src/index.css:52","src/pages/app/BrainDump.tsx:102","src/hooks/data/notes.ts:17"],"source":"audit"},
  {"id":"brain-dump-15","severity":"P2","title":"Per-note AI progress is only a pulsing icon: not announced, invisible under reduced motion","fix":"Visible 'Summarizing...' text in a role=status region and aria-busy; static indicator under reduced motion","command":"/impeccable harden","files":["src/components/notes/NoteCard.tsx:156","src/components/ui/Ai.tsx:39","src/index.css:32"],"source":"audit"},
  {"id":"brain-dump-16","severity":"P2","title":"Plan panel Create can double-submit, has no error handling, mis-pluralizes, silently moves note to Ideas","fix":"Pending/disabled state, try/catch, pluralize, mention the move in the toast","command":"/impeccable harden","files":["src/components/notes/AiNotePanels.tsx:254"],"source":"audit"},
  {"id":"brain-dump-17","severity":"P3","title":"Grid rows stretch one-line notes into tall empty cards","fix":"items-start or CSS columns","command":"/impeccable layout","files":["src/pages/app/BrainDump.tsx:273"],"source":"both"},
  {"id":"brain-dump-18","severity":"P3","title":"AI result panels: Save as note is secondary to Close; Extract shows raw ISO dates and drops priority","fix":"Make Save as note primary; friendly editable dates; show priority chips","command":"/impeccable polish","files":["src/components/notes/AiNotePanels.tsx:194","src/components/notes/AiNotePanels.tsx:152"],"source":"both"},
  {"id":"brain-dump-19","severity":"P3","title":"Process inbox note changes in place with no transition; easy to miss that a new note loaded","fix":"120-160ms crossfade/slide of the preview card (static under reduced motion); dialog/menu entrances 150ms","command":"improve-animations","files":["src/components/notes/ProcessInbox.tsx:47","src/components/notes/NoteCard.tsx:53","src/components/ui/Modal.tsx:63"],"source":"audit"},
  {"id":"brain-dump-20","severity":"P3","title":"Process queue frozen from possibly-unloaded notes on cold ?process=1 deep link (latent, not reproduced)","fix":"Build the queue once notes.data is defined; show loading until then","command":"/impeccable harden","files":["src/components/notes/ProcessInbox.tsx:15"],"source":"audit"}
 ]}
```
