# Animation plans

Written by the `improve-animations` skill (Emil Kowalski's animation philosophy) during design Phase 1, at commit `9799a50`. Each plan is self-contained and executable by any agent.

## Audit summary (vetted at file:line)

| # | Severity | Category | Location | Finding | Fix summary |
|---|---|---|---|---|---|
| 1 | HIGH | Purpose & frequency | `CommandPalette.tsx:106`, `Modal.tsx:63` (Capture via N), `AtlasPanel.tsx:135` (⌘J) | Keyboard-opened surfaces animate on every open | No animation for keyboard-opened surfaces (plan 002) |
| 2 | HIGH | Purpose & frequency | `Card.tsx:16` | Every card fades and rises on every page mount, tens of times a day | Remove the card mount animation (plan 002) |
| 3 | MEDIUM | Accessibility | `index.css:37-46` | Reduced motion kills all transitions, including feedback, and freezes spinners | Drop movement, keep opacity/colour feedback (plan 003) |
| 4 | MEDIUM | Performance | `Switch.tsx:17`, `GoalCard.tsx:52`, `Planner.tsx:518`, `CalendarCard.tsx:133`, `Tour.tsx:86` | Layout properties (`left`, `width`, `top`, `height`) animated; `transition-all` | Animate transform instead (plan 004) |
| 5 | MEDIUM | Performance | `useToast.tsx:50-52`, `CalendarCard.tsx:47-49` | Framer Motion `y`/`scale` shorthands are not hardware-accelerated | Full transform strings, with a spring for toasts (plan 005) |
| 6 | MEDIUM | Cohesion & tokens | `tailwind.config.js:11-16`, `index.css` `.btn` | No motion tokens; weak built-in curves; hand-picked durations | Strong ease-out, drawer and in-out tokens (plan 001) |

**Missed opportunities** (additive, plan 006):
- Check-off feedback on tasks, habits and plan sessions.
- The phone "More" sheet rising from the tab bar.
- The Atlas panel sliding from its right edge when opened by pointer.
- Process inbox making the next note visibly arrive.

**Already right, left alone:**
- The voice HUD's motion (composited `transform: rotate`, linear for constant spin, with its own reduced-motion block).
- The Focus ring's `stroke-dashoffset 0.5s linear` (constant progress).
- Hover colour transitions.
- The 200ms dropdown fades in `TopBar.tsx:74` and `NoteCard.tsx:53` (pointer-opened, within budget).

## Plans

| # | Title | Severity | Status |
|---|---|---|---|
| 001 | [Motion tokens](001-motion-tokens.md) | MEDIUM | DONE (Phase 2) |
| 002 | [No motion on frequent/keyboard surfaces](002-no-motion-on-frequent-surfaces.md) | HIGH | DONE (Phase 3) |
| 003 | [Reduced motion keeps feedback](003-reduced-motion-keep-feedback.md) | MEDIUM | DONE (Phase 3) |
| 004 | [Transform, not layout properties](004-transform-not-layout.md) | MEDIUM | TODO |
| 005 | [Framer Motion transform strings](005-framer-transform-strings.md) | MEDIUM | TODO |
| 006 | [Missed opportunities](006-missed-opportunities.md) | LOW | TODO |

## Execution order

1. **001** first: the others use its tokens.
2. **002**, then **003**.
3. **004** and **005**, in either order.
4. **006** last; it needs 001, 002 and 003.

In the design roadmap (DESIGN-PLAN.md): 001–003 land with Phase 3 ("remove the junk") and Phase 5 (motion); 004–006 in Phase 5.
