# 002 — Stop animating keyboard-opened surfaces and every card mount

- **Status**: DONE (Phase 3)
- **Commit**: 9799a50
- **Severity**: HIGH
- **Category**: Purpose & frequency
- **Estimated scope**: 4 files, ~10 lines

## Problem

Surfaces opened by keyboard shortcuts many times a day animate every time, and every card on every page fades and rises each time a page mounts:

```tsx
// src/components/layout/CommandPalette.tsx:106 — opened with ⌘K
<div role="dialog" aria-modal="true" aria-label="Command palette" className="relative w-full max-w-xl animate-fade-in overflow-hidden rounded-2xl ...">
```

```tsx
// src/components/ui/Card.tsx:16 — every Card in the app (dashboard, tasks, habits…), on every navigation
<Tag className={cn('glass relative animate-fade-in p-5', interactive && 'glass-hover', className)} {...rest}>
```

```tsx
// src/components/ui/Modal.tsx:63 — every dialog, including the Capture dialog opened with N dozens of times a day
'relative max-h-[92vh] w-full max-w-lg animate-fade-in overflow-y-auto rounded-t-3xl ...'
```

```tsx
// src/components/atlas/AtlasPanel.tsx:135 — opened with ⌘J
<aside className="relative flex h-full w-full max-w-md animate-fade-in flex-col ...">
```

Keyboard-initiated actions should feel instant (Raycast's palette has no open animation). Card mounts are decorative motion repeated tens of times a day; they make page changes feel slower than they are.

## Target

- **Command palette:** no animation class at all.
- **Card:** no animation class.
- **Modal:** keeps its 200ms fade for pointer-opened dialogs, but takes a new prop `instant?: boolean` that drops the class. The Capture composer passes `instant` (it opens from N and the + buttons; instant is right for both).
- **Atlas panel:** handled in plan 006 (a slide from the right, used only when opened by pointer). In this plan, simply remove `animate-fade-in` from the `<aside>`.

```tsx
// target — src/components/ui/Modal.tsx
export function Modal({ open, onClose, title, description, children, className, layer = 'z-50', instant = false }: ModalProps) {
  ...
  className={cn('relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl ...', !instant && 'animate-fade-in', className)}
```

## Repo conventions to follow

- Optional props are documented with a `/** … */` comment in the props interface (see `layer?: string` in `src/components/ui/Modal.tsx`).

## Steps

1. `src/components/layout/CommandPalette.tsx:106`: delete `animate-fade-in` from the className.
2. `src/components/ui/Card.tsx:16`: delete `animate-fade-in` from the className.
3. `src/components/ui/Modal.tsx`:
   - Add `instant?: boolean` to `ModalProps`, with the comment `/** Skip the open animation (dialogs opened from keyboard shortcuts). */`.
   - Destructure it with default `false`.
   - Move `animate-fade-in` out of the literal class string into `!instant && 'animate-fade-in'` inside `cn(...)`.
4. `src/components/capture/CaptureComposer.tsx`: on its `<Modal …>`, add `instant`.
5. `src/components/atlas/AtlasPanel.tsx:135`: delete `animate-fade-in` from the `<aside>` className.

## Boundaries

- Do NOT touch `src/components/atlas/VoiceHud.tsx`.
- Do NOT change dropdown menus (`TopBar.tsx:74`, `NoteCard.tsx:53`); their 200ms fade is within budget for pointer-opened menus.
- Do NOT add dependencies.

## Verification

- **Mechanical:** `npm run typecheck && npx vite build`, then `npm run test:e2e` (the brain-dump and atlas flows open these surfaces).
- **Feel check:**
  - Press ⌘K, N and ⌘J repeatedly. Each surface appears fully formed on the next frame.
  - Navigate Dashboard → Tasks → Habits. The cards are simply there; nothing fades or rises.
  - Open a settings dialog with the mouse (e.g. Delete account). It still fades in over 200ms.
- **Done when:** `grep -rn "animate-fade-in" src` lists only `Modal.tsx` (conditional), `TopBar.tsx` and `NoteCard.tsx`.
