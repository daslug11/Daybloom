# 001 — Add strong easing and duration tokens, use them for the shared fade and button press

- **Status**: DONE (Phase 2)
- **Commit**: 9799a50
- **Severity**: MEDIUM
- **Category**: Cohesion & tokens / Easing & duration
- **Estimated scope**: 2 files (`tailwind.config.js`, `src/index.css`), ~20 lines

## Problem

The app has no motion tokens. The only shared animation and the button press both use weak built-in curves:

```js
// tailwind.config.js:11-16 — current
keyframes: {
  'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
},
animation: {
  'fade-in': 'fade-in 0.25s ease-out both',
},
```

```css
/* src/index.css — .btn, current */
.btn {
  @apply inline-flex ... rounded-xl px-4 py-2.5 text-sm font-semibold transition
    active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50;
}
```

Tailwind's bare `transition` uses `150ms cubic-bezier(0.4, 0, 0.2, 1)` on twelve properties. Every component hand-picks durations (`duration-200`, `duration-500`, `duration-1000`), so nothing feels like one system.

## Target

Add these as Tailwind theme tokens:

```js
// tailwind.config.js — theme.extend (target)
transitionTimingFunction: {
  out: 'cubic-bezier(0.23, 1, 0.32, 1)',        // strong ease-out for UI
  'in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',  // on-screen movement
  drawer: 'cubic-bezier(0.32, 0.72, 0, 1)',     // sheets and side panels
},
transitionDuration: { press: '160ms', fast: '150ms', base: '200ms' },
keyframes: {
  'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
},
animation: {
  'fade-in': 'fade-in 200ms cubic-bezier(0.23, 1, 0.32, 1) both',
},
```

Note: the Tailwind keys `ease-out` and `ease-in-out` replace Tailwind's defaults, on purpose.

```css
/* src/index.css — .btn target: only transform/colors/opacity transition; the press is a crisp 160ms ease-out */
.btn {
  @apply inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold
    transition-[transform,background-color,border-color,color,opacity,filter] duration-press ease-out
    active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50;
}
```

## Repo conventions to follow

- Theme tokens live in `tailwind.config.js` → `theme.extend` (see the existing `fontFamily`, `keyframes` and `animation` keys there).
- Component classes live in `src/index.css` under `@layer components`.

## Steps

1. In `tailwind.config.js`, add `transitionTimingFunction` and `transitionDuration` exactly as in Target, and change `animation['fade-in']` to `'fade-in 200ms cubic-bezier(0.23, 1, 0.32, 1) both'`.
2. In `src/index.css`, replace the `.btn` rule's `transition` with `transition-[transform,background-color,border-color,color,opacity,filter] duration-press ease-out`, as in Target.

## Boundaries

- Do NOT touch the voice HUD (`src/components/atlas/VoiceHud.tsx` and its `HUD_CSS`). It has its own motion language.
- Do NOT change colours, sizes or markup.
- Do NOT add dependencies.

## Verification

- **Mechanical:** `npm run typecheck && npx vite build` passes. `grep -n "ease-out" tailwind.config.js` shows the new curve.
- **Feel check:** press and hold any button. It should shrink to 97% at once (no slow start) and spring back crisply on release. At 10% playback (DevTools → Animations), the press reaches 0.97 within the first third of the duration.
- **Done when:** both files match Target and the build passes.
