# 005 — Use hardware-accelerated transforms in Framer Motion

- **Status**: TODO
- **Commit**: 9799a50
- **Severity**: MEDIUM
- **Category**: Performance / Interruptibility
- **Estimated scope**: 2 files

## Problem

Framer Motion's `y` and `scale` shorthands run on the main thread and can drop frames while the page is busy (toasts often appear right after a data mutation and refetch):

```tsx
// src/hooks/useToast.tsx:50-52 — current
initial={{ opacity: 0, y: 20, scale: 0.95 }}
animate={{ opacity: 1, y: 0, scale: 1 }}
exit={{ opacity: 0, y: 10, scale: 0.95 }}
```

```tsx
// src/components/calendars/CalendarCard.tsx:47-49 — current
initial={{ opacity: 0, y: 12 }}
animate={{ opacity: p.dragging ? 0.4 : 1, y: 0 }}
exit={{ opacity: 0, scale: 0.95 }}
```

## Target

```tsx
// useToast.tsx — target (spring kept for interruptibility when toasts stack)
initial={{ opacity: 0, transform: 'translateY(20px) scale(0.95)' }}
animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
exit={{ opacity: 0, transform: 'translateY(10px) scale(0.95)' }}
transition={{ type: 'spring', duration: 0.5, bounce: 0.2 }}
```

```tsx
// CalendarCard.tsx — target
initial={{ opacity: 0, transform: 'translateY(12px)' }}
animate={{ opacity: p.dragging ? 0.4 : 1, transform: 'translateY(0px)' }}
exit={{ opacity: 0, transform: 'scale(0.95)' }}
transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
```

Keep `layout` on both. Toasts reflow when one is dismissed, and calendar cards reorder on drop; `layout` uses FLIP transforms, so that's fine.

## Repo conventions to follow

- Plan 003 adds a `useReducedMotion()` branch to these same props. If 003 has run, apply these values to the non-reduced branch only.

## Steps

1. `src/hooks/useToast.tsx`: replace the three props with the Target values and add the `transition` prop.
2. `src/components/calendars/CalendarCard.tsx`: replace the three props with the Target values and add the `transition` prop.

## Boundaries

- Do NOT remove `layout`.
- Do NOT change toast styling (colour and shadow are Phase 2).

## Verification

- **Mechanical:** typecheck and build pass; the e2e flows (which wait for toast text) pass.
- **Feel check:**
  - Complete three tasks quickly: toasts stack and reflow without restarting.
  - At 10% playback, each toast rises 20px and settles with a barely visible overshoot.
- **Done when:** `grep -nE "\\by: |\\bscale: " src/hooks/useToast.tsx src/components/calendars/CalendarCard.tsx` returns nothing.
