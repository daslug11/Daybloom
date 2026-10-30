# Animations Daybloom doesn't need (remove-animations: list only)

Written by the `remove-animations` skill during design Phase 1 at commit `9799a50`. **Nothing was edited in Phase 1**; these removals are executed in Phase 3. The voice HUD (`src/components/atlas/VoiceHud.tsx`) is the deliberate showpiece and out of scope.

Recon:
- **Motion lives in:** Tailwind utilities, one shared keyframe (`fade-in`, `tailwind.config.js:11-16`), Framer Motion in 3 files (toasts, calendar cards, the calendar dialog), and the HUD's own CSS.
- **Personality:** crisp, precise, quick (DESIGN.md), so the gate is applied strictly.

## Part 1 — To remove or reduce (Phase 3)

Ordered by how often a user hits it.

| # | Location | Was | Verdict | Deciding branch |
|---|---|---|---|---|
| 1 | `components/ui/Card.tsx:16` | `animate-fade-in` (opacity + 4px rise, 250ms) on every Card, on every page mount | **Delete** | Seen 100+ times a day (every navigation) |
| 2 | `components/layout/CommandPalette.tsx:106` | `animate-fade-in` on open (⌘K) | **Delete** | Keyboard-triggered |
| 3 | `components/capture/CaptureComposer.tsx` → `components/ui/Modal.tsx:63` | Capture dialog fades and rises on N / + | **Delete for Capture** (Modal gets an `instant` option) | Keyboard-triggered, dozens of times a day |
| 4 | `components/atlas/AtlasPanel.tsx:135` | `animate-fade-in` on the side panel (⌘J) | **Delete** (a pointer-only slide-in is a separate, additive decision; see `plans/006`) | Keyboard-triggered |
| 5 | `components/calendars/CalendarCard.tsx:47` | Every calendar card rises 12px and fades in on each visit to Calendars | **Delete the mount entrance** (`initial={false}`); keep `exit` and `layout` | Seen every visit, no purpose |
| 6 | `components/ui/EmojiPicker.tsx:12`, `components/calendars/ColorSwatches.tsx:18` | `hover:scale-110` on every swatch and emoji | **Reduce** to a ring/background colour change, ≤150ms `ease` | Tens/day hover; scale adds nothing |
| 7 | `components/calendars/CalendarModal.tsx:103-105` | URL error slides open (height 0 → auto) | **Reduce** to an opacity fade at 150ms (height animation removed) | A fade carries the same meaning |
| 8 | `components/notes/NoteCard.tsx:156` | Infinite `animate-pulse` on the ✨ icon while AI works | **Reduce**: show a spinner (a real loading indicator), not a pulsing sparkle | Infinite loop on a persistent element |

## Part 2 — Kept on purpose

These keep their motion. Badly built ones are flagged for `improve-animations` (plans 001–006).

- **Toasts** (`hooks/useToast.tsx:47-52`): enter from the bottom.
  - **Kept:** prevents a jarring change; occasional. Flagged: uses `y`/`scale` shorthands (plan 005).
- **Dialogs opened by pointer** (`components/ui/Modal.tsx:63`): a 200ms fade.
  - **Kept:** a dialog appearing over the page needs a moment to read as "on top".
- **Dropdown menus** (`components/layout/TopBar.tsx:74`, `components/notes/NoteCard.tsx:53`).
  - **Kept:** pointer-opened, occasional, within budget.
- **Button press** (`index.css` `.btn` → `active:scale-[0.97]`).
  - **Kept:** feedback. Flagged: weak curve (plan 001).
- **Goal-reached confetti** (`lib/confetti.ts`, `pages/app/Goals.tsx:51`).
  - **Kept:** a rare celebration. It already uses `disableForReducedMotion`.
- **Loading indicators**: spinners (`ui/States.tsx:36`, `ui/Ai.tsx:51`, `calendars/SyncToggle.tsx:17`, `calendars/SyncStatusPill.tsx:32,44`) and the skeleton pulse (`ui/States.tsx:43`).
  - **Kept:** they show that work is happening. Check on a real network: if most loads resolve in under 300ms, the skeleton flash should get a short delay before showing.
- **Atlas thinking/streaming indicators**: the orb pulse while active (`atlas/AtlasOrb.tsx:7`) and the streaming caret (`atlas/AtlasPanel.tsx:270`).
  - **Kept:** state indication while work is in progress; both stop when it ends.
- **Planner now-line movement** (`pages/app/Planner.tsx:518`).
  - **Kept:** shows time passing. Flagged: animates `top` (plan 004).
- **Switch knob, goal progress bar, tour spotlight, sidebar collapse** (`ui/Switch.tsx:17`, `goals/GoalCard.tsx:52`, `onboarding/Tour.tsx:86`, `layout/Sidebar.tsx:48`).
  - **Kept:** state indication or spatial consistency. Flagged: layout-property animation (plan 004).
- **Smooth scroll to Planner → Plans** (`pages/app/Planner.tsx:120`).
  - **Kept:** shows where the plan card's link took you.

## Part 3 — Cleanup and verdict

**Cleanup to do in Phase 3:**
- After items 5 and 7, check whether `CalendarModal.tsx` still needs `AnimatePresence`.
- If nothing remains, drop it and the `motion` import there.
- Framer Motion stays a dependency: toasts and the calendar card exit and reorder still use it. No dependency removal is proposed.

**Verdict:** moderately over-animated for a tool used in short bursts. The biggest cost is that every page "arrives" (the card fade on every mount), and the three keyboard surfaces animate. Those make navigation feel slower than it is. The removals are small; after them the app should feel instant to move around, with motion reserved for feedback (presses, toasts, check-offs) and the HUD.

**Needs a human to check on a real device:** whether the skeleton flash is noticeable on a real network, and whether the hover feel on the colour swatches is still clear without the scale.
