# Design baseline (Phase 0)

Captured on 2026-10-29, before any design changes, so every later phase has something to compare against.

## How it was measured

- **Pages:** 26 screens, each at desktop (1440×900) and phone (390×844), in dark and light theme: 104 screenshots in all.
- **Demo data:** a realistic account seeded by `tests/visual/seed.mjs`. It's a student called Maya with an inbox, today's tasks, an active workout plan, habits with 60 days of history, goals, moods and an Atlas conversation.
- **Screenshots:** [gallery on the `claude/design-screenshots` branch](https://github.com/daslug11/Daybloom/blob/claude/design-screenshots/phase-0/README.md). Re-create them with `node tests/visual/capture.mjs --label <name> --seed`.
- **Detector:** Impeccable `detect` (engine 0.1.18), run on `src/` and on every logged-in page through Chrome's debugging port (`--detect`).
  - Runs with `--no-design-system`, so later phases are compared like for like even after DESIGN.md exists.
  - Advisory findings are excluded from the counts.
- **AI:** none spent. The daily briefing comes from the seeded cache, and Atlas answers come from the local mock server.

## Detector results

| Scope | Findings |
|---|---|
| Pages, dark theme (26 pages × desktop + phone) | 940 |
| Pages, light theme | 534 |
| Source scan (`src/`) | 11 |

**Page findings by rule** (both themes, advisories excluded):

| Rule | Count |
|---|---|
| low-contrast | 426 |
| ai-color-palette | 400 |
| gradient-text | 154 |
| dark-glow | 140 |
| overused-font | 88 |
| nested-cards | 62 |
| heading-rhythm | 58 |
| tiny-text | 56 |
| kicker-above-heading | 32 |
| undersized-ui-text | 32 |
| line-length | 16 |
| skipped-heading | 8 |
| body-text-viewport-edge | 2 |

**By page** (dark + light, desktop + phone):

| Page | Findings |
|---|---|
| landing | 78 |
| signup | 16 |
| login | 14 |
| forgot-password | 14 |
| terms | 62 |
| privacy | 72 |
| not-found | 32 |
| onboarding | 8 |
| tour | 64 |
| dashboard | 56 |
| capture | 60 |
| brain-dump | 58 |
| process-inbox | 54 |
| tasks | 46 |
| planner | 152 |
| planner-plans | 152 |
| calendars | 60 |
| habits | 66 |
| goals | 66 |
| focus | 38 |
| mood | 38 |
| review | 62 |
| settings | 57 |
| admin | 30 |
| atlas | 74 |
| voice-hud | 45 |

## What the numbers mean

- **low-contrast:** text below the WCAG AA contrast ratio, mostly the `faint` grey tier and tinted chips. It's far worse in dark theme (315 vs 111 per pass).
- **ai-color-palette / gradient-text / dark-glow:** the violet→blue→pink gradients, gradient headings and coloured glows. The owner already chose to move away from these (see DESIGN.md → Direction).
- **overused-font:** Inter everywhere.
- **nested-cards:** cards inside cards (task rows inside cards, plan cards inside the Atlas panel).
- **tiny-text / undersized-ui-text:** the 10–11px micro text on chips, timestamps and Planner blocks.
- **heading-rhythm / kicker-above-heading / skipped-heading:** heading levels and spacing that don't follow a consistent scale.
