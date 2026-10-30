# 004 — Animate transform, not layout properties

- **Status**: TODO
- **Commit**: 9799a50
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 5 files, ~25 lines

## Problem

Several transitions animate layout properties (`left`, `top`, `width`, `height`), which re-run layout and paint every frame:

```tsx
// src/components/ui/Switch.tsx:17 — current: transition-all animates `left`
<span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
```

```tsx
// src/components/goals/GoalCard.tsx:52 — current: animates width over 500ms
<div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-blue-500 to-pink-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
```

```tsx
// src/pages/app/Planner.tsx:518 — current: animates `top` over 1000ms every 15s
<div className="pointer-events-none absolute inset-x-0 z-30 transition-[top] duration-1000 ease-linear" style={{ top: nowMinutes * PX_PER_MIN }} aria-hidden>
```

```tsx
// src/components/calendars/CalendarCard.tsx:133 — current: animates an iframe container's height 0 → 420px
<motion.div initial={{ height: 0 }} animate={{ height: 420 }} exit={{ height: 0 }} className="relative overflow-hidden ...">
```

```tsx
// src/components/onboarding/Tour.tsx:86 — current: transition-all over left/top/width/height (rare surface)
className="pointer-events-none absolute rounded-2xl ring-2 ring-violet-400 transition-all duration-200"
```

## Target

- **Switch knob:** fixed `left-0.5`, moved with `translateX(16px)` when checked.
  `className={cn('absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-fast ease-out', checked && 'translate-x-4')}`
- **Goal progress:** full-width bar scaled on X from the left.
  `className="h-full w-full origin-left rounded-full bg-… transition-transform duration-base ease-out" style={{ transform: \`scaleX(${pct / 100})\` }}`
  Keep the existing colour classes; the colour change is plan-independent (Phase 2).
- **Planner now-line:** `top: 0` plus `style={{ transform: \`translateY(${nowMinutes * PX_PER_MIN}px)\` }}` with `transition-transform duration-1000 ease-linear`. Linear is correct for constant motion.
- **Calendar preview:** no height animation. Mount the iframe container at full height with a 150ms opacity fade:
  `initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}`.
- **Tour spotlight:** restrict to `transition-[left,top,width,height] duration-base ease-out`.
  This one keeps layout properties on purpose: it's a rare, once-per-user surface, and the ring must track a resizing rectangle. That's acceptable at this frequency; note it in a code comment.

## Repo conventions to follow

- Tailwind utility classes on the element; tokens `duration-fast`, `duration-base` and `ease-out` come from plan 001. Execute 001 first.

## Steps

1. `Switch.tsx:17`: replace the span className as in Target.
2. `GoalCard.tsx:52`: replace width-based styling with the scaleX version.
3. `Planner.tsx:518`: move the position into `transform: translateY(...)`, with `top-0`.
4. `CalendarCard.tsx:133`: replace `initial/animate/exit` height props with the opacity ones; add `h-[420px]` to the container.
5. `Tour.tsx:86`: narrow the transition list and add the comment `/* Rare first-run surface: animating the box is acceptable here. */`.

## Boundaries

- Do NOT change colours or gradients here (Phase 2 handles colour).
- Do NOT touch `VoiceHud.tsx`.

## Verification

- **Mechanical:** typecheck and build pass; e2e flows `planner-ai`, `plans`, `goals-habits-ai` and `onboarding-tour` pass.
- **Feel check:**
  - Toggle a Settings switch: the knob slides with no wobble.
  - Bump a goal: the bar grows from the left.
  - In DevTools → Performance, record a switch toggle: no "Layout" entries during the transition.
- **Done when:** `grep -rnE "transition-\[(width|top)\]|transition-all" src` returns only the tour (by design) and nothing else.
