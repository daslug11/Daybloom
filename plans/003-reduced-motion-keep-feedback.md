# 003 — Reduced motion: drop movement, keep feedback

- **Status**: DONE (Phase 3)
- **Commit**: 9799a50
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file (`src/index.css`), plus checks in 2 components

## Problem

```css
/* src/index.css:37-46 — current */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

This kills *all* transitions, including colour, opacity and the toggle state change. People who ask for reduced motion lose feedback, not just movement. It also breaks loading indicators: the spinners (`animate-spin` in `States.tsx:36`, `Ai.tsx`, `SyncToggle.tsx`) freeze after one iteration, so "loading" looks like a stuck icon.

## Target

Reduced motion means **no movement, gentle opacity/colour kept**:

```css
/* src/index.css — target */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
  }
  /* Movement off: shared keyframes become a plain fade, and transforms don't animate. */
  .animate-fade-in { animation: rm-fade 150ms ease-out both !important; }
  .btn:active { transform: none !important; }
}
@keyframes rm-fade { from { opacity: 0; } to { opacity: 1; } }
```

- **Spinners** keep spinning; a rotating loader is a state indicator, not decorative movement. If a component needs a static alternative, use `motion-reduce:animate-none` plus a text label.
- **Framer Motion components** (`src/hooks/useToast.tsx`, `src/components/calendars/CalendarCard.tsx`) read `useReducedMotion()` and use opacity-only `initial`/`exit` when it's true. Toasts become a 150ms opacity fade; calendar cards lose their 12px rise.

## Repo conventions to follow

- Global CSS lives in `src/index.css` `@layer base`. The voice HUD already does the right thing in `src/components/atlas/VoiceHud.tsx` (its `HUD_CSS` `@media (prefers-reduced-motion: reduce)` block stops rotation but keeps the UI). Imitate that per-effect approach.

## Steps

1. Replace the `@media (prefers-reduced-motion: reduce)` block in `src/index.css` with the Target block, and add the `@keyframes rm-fade` rule at top level in the same file.
2. `src/hooks/useToast.tsx`:
   - `import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'`.
   - `const reduce = useReducedMotion();`.
   - When `reduce`: `initial={{ opacity: 0 }}`, `animate={{ opacity: 1 }}`, `exit={{ opacity: 0 }}`, `transition={{ duration: 0.15 }}`.
3. `src/components/calendars/CalendarCard.tsx`: the same pattern for the card's `initial`/`exit`.

## Boundaries

- Do NOT change `HUD_CSS` in `VoiceHud.tsx`; it's already correct.
- Do NOT remove any animation for users without reduced motion; that's plan 002's job.

## Verification

- **Mechanical:** typecheck and build pass.
- **Feel check:** in DevTools → Rendering, emulate `prefers-reduced-motion: reduce`.
  - The Settings switches still change colour smoothly.
  - Loading spinners keep turning.
  - Dialogs fade without rising.
  - Toasts fade without sliding.
  - Pressing a button does not shrink it.
- **Done when:** no `transition-duration: 0.01ms` remains in `src/index.css`.
