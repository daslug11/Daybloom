# 006 — Missed opportunities: completion feedback, sheets that come from somewhere

- **Status**: DONE (Phase 5)
- **Commit**: 9799a50
- **Severity**: LOW (additive)
- **Category**: Missed opportunities
- **Estimated scope**: 4–5 files

## Problem

Four state changes currently teleport, though a short movement would explain them:

1. **Checking things off** has no tactile feedback. This covers a task's circle (`src/components/tasks/TaskItem.tsx`, the toggle button), a habit's day cell (`src/components/habits/HabitCard.tsx`), and a plan session checkbox (`src/components/plans/PlansSection.tsx`). These are the app's most rewarding moments. The task toggle only swaps the circle for a filled check, and the row jumps to the done list on the next render.
2. **The phone "More" sheet** (`src/components/layout/MobileNav.tsx:37`) reuses the generic `Modal`. On phones it docks to the bottom (`rounded-t-3xl`), but it only fades and rises 4px, so it doesn't feel like it comes from the tab bar.
3. **The Atlas panel** (`src/components/atlas/AtlasPanel.tsx:135`) is a side sheet anchored to the right edge. With plan 002 it appears instantly; when opened by pointer (the orb), a slide from the right would explain where it lives.
4. **Process inbox** (`src/components/notes/ProcessInbox.tsx`) swaps one note for the next with no transition. The change is easy to miss when two notes look alike.

## Target

1. **Check-off press.** Each checkbox-like control gets `active:scale-[0.9] transition-transform duration-press ease-out`. When it becomes checked, the check icon scales in from `scale(0.6)` with `opacity: 0` to `scale(1)` with `opacity: 1` over 160ms, using `ease-out` (`cubic-bezier(0.23, 1, 0.32, 1)`).
   - Implement as a small CSS keyframe `check-pop` in `tailwind.config.js`: `{ from: { transform: 'scale(0.6)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } }` and `animation: 'check-pop 160ms cubic-bezier(0.23, 1, 0.32, 1) both'`.
   - Apply it to the check icon only when checked.
2. **Bottom sheet on phones.** `Modal` gets `variant?: 'dialog' | 'sheet'`. `sheet` uses the keyframe `sheet-up` (`from { transform: 'translateY(100%)' } to { transform: 'translateY(0)' }`) at `260ms cubic-bezier(0.32, 0.72, 0, 1)` below the `sm` breakpoint, and the normal fade above it. `MobileNav` passes `variant="sheet"`.
3. **Atlas side panel.** Keyframe `panel-in` (`from { transform: 'translateX(100%)' } to { transform: 'translateX(0)' }`) at `240ms cubic-bezier(0.32, 0.72, 0, 1)`. It applies only when the panel was opened by pointer. `AppShell` passes `animate` when the orb or a button opened it, and not when ⌘J did.
4. **Process inbox.** Key the note body by note id and give it the shared `animate-fade-in` (200ms ease-out, from plan 001), so the next note visibly arrives.

All four respect plan 003: under reduced motion, only opacity remains.

## Repo conventions to follow

- Keyframes and animations live in `tailwind.config.js` `theme.extend.keyframes` and `animation` (see `fade-in`).

## Steps

1. Add the `check-pop`, `sheet-up` and `panel-in` keyframes and animations to `tailwind.config.js` with the exact values above.
2. `TaskItem.tsx`, `HabitCard.tsx`, `PlansSection.tsx`: add the press scale to the toggle control, and `animate-check-pop` to the check icon when checked.
3. `Modal.tsx`: add the `variant` prop; for `sheet`, use `animate-sheet-up sm:animate-fade-in`. In `MobileNav.tsx`, pass `variant="sheet"`.
4. `AtlasPanel.tsx`: accept `animateIn?: boolean`; add `animate-panel-in` when true. In `AppShell.tsx`, track whether the panel was opened by pointer (`openAtlas` called from the orb or buttons → `true`; the ⌘J handler → `false`).
5. `ProcessInbox.tsx`: wrap the current note's body in an element with `key={current.id}` and `className="animate-fade-in"`.

## Boundaries

- No new dependencies.
- No change to what any control does, only how its state change looks.
- Do NOT touch `VoiceHud.tsx`.

## Verification

- **Mechanical:** typecheck, build and the full e2e suite pass. The suite clicks task, habit and session checkboxes and opens the More sheet.
- **Feel check:**
  - Tick a task: the circle dips under the finger and the check pops in. Nothing bounces.
  - On a phone viewport, More rises from the bottom edge.
  - Clicking the orb slides Atlas in from the right; ⌘J shows it instantly.
  - Processing the inbox: each next note fades in.
- **Done when:** all four behaviours are visible, and reduced motion leaves only fades.
