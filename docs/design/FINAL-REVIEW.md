# Final review (design Phase 9)

This is the closing check of the design upgrade, measured against the Phase 0 baseline ([`BASELINE.md`](BASELINE.md)) and the Phase 1 plan ([`DESIGN-PLAN.md`](../../DESIGN-PLAN.md)).

## How it was done, and how that differs from Phase 1
- **Automated checks:** the same as the baseline, plus an accessibility scan.
  - The Impeccable detector ran on all 26 screens × 2 themes × phone and desktop.
  - axe-core (WCAG 2.2 AA) ran on the same 104 combinations; this scan is new in this phase.
  - The full browser suite ran, including the worst-case data flow.
- **Critique scores: one reviewer, not seventeen.** In Phase 1 each surface was critiqued by its own isolated reviewer. For Phase 9, five reviewers were started with the same brief, but a usage limit stopped them before they wrote anything. The scores below therefore come from a single reviewer (the agent that ran the upgrade), using the same rubric:
  - 10 Nielsen heuristics, each 0–4, scored /40 (Landing /32 as in Phase 1);
  - an audit scored /20.

  This reviewer worked from the current screenshots, the live app and the source. Treat these scores as less independent than Phase 1's: the reviewer also made the changes. The automated numbers are the objective part.
- **Motion:** checked against the review-animations standards in Phase 5 and re-checked here. No `ease-in`, no `scale(0)`, no `transition-all`, no layout-property animation, and no UI duration over 300 ms. The only exception is the Planner now-line, which moves at a constant 1 s linear pace. The only motion that loops is loading spinners and skeletons. Browser flows `motion` and `motion-reduced` keep it that way.

## Automated results, before → after

| Check | Phase 0 / Phase 1 | Phase 9 |
|---|---|---|
| Detector, pages, dark theme | 940 | **87** |
| Detector, pages, light theme | 534 | **87** |
| Detector, source scan | 11 | **0** |
| Detector: low-contrast | 426 | **0** |
| Detector: gradient text / dark glow | 154 / 140 | **0 / 0** |
| Detector: tiny text / undersized UI text | 56 / 32 | **0 / 0** |
| Detector: nested cards | 62 | **4** |
| axe-core WCAG 2.2 AA violations (104 screen scans) | not measured | **0** |
| Browser flows | 18 | **30** (incl. worst-case data, keyboard-only Planner, motion, reduced motion, touch) |
| Unit tests | 64 | **86** |

**Detector findings left, all deliberate:**
- `overused-font` (88): Inter is the documented house face.
- `ai-color-palette` (76): the Atlas orb and the voice HUD core are cyan on purpose; cyan is reserved for Atlas.
- `line-length` (6): the legal pages' draft notice.
- `nested-cards` (4): the Planner's Plans section has session rows inside the plan card.

## Scores, Phase 1 → Phase 9

| Surface | Critique | Audit | Open P0 / P1 / P2 / P3 (Phase 1 → now) |
|---|---|---|---|
| Landing (+ legal, 404) | 22/32 → **27/32** | 11 → **17** | 0/4/7/3 → 0/0/1/0 |
| Auth | 25 → **32** | 12 → **18** | 0/2/7/2 → 0/0/0/0 |
| Onboarding + tour | 24 → **31** | 11 → **17** | 0/8/4/4 → 0/0/0/0 |
| Dashboard + shell | 25 → **32** | 11 → **17** | 0/5/7/4 → 0/0/0/0 |
| Brain Dump | 25 → **33** | 11 → **17** | 1/5/10/4 → 0/0/0/1 |
| Tasks | 24 → **32** | 11 → **17** | 1/3/6/3 → 0/0/0/0 |
| Planner + Plans | 24 → **31** | 11 → **16** | 0/6/7/5 → 0/0/0/2 |
| Calendars | 25 → **31** | 11 → **17** | 0/5/8/2 → 0/0/0/0 |
| Habits | 21 → **31** | 11 → **17** | 0/4/5/3 → 0/0/0/0 |
| Goals | 21 → **31** | 10 → **17** | 1/4/5/2 → 0/0/0/0 |
| Focus | 22 → **31** | 11 → **17** | 0/5/4/2 → 0/0/0/1 |
| Mood | 23 → **31** | 12 → **17** | 0/4/7/3 → 0/0/0/0 |
| Weekly Review | 22 → **33** | 12 → **18** | 0/3/7/2 → 0/0/0/1 |
| Settings | 25 → **32** | 12 → **18** | 0/3/6/4 → 0/0/0/0 |
| Admin | 22 → **30** | 11 → **17** | 0/4/4/3 → 0/0/0/0 |
| Atlas panel | 26 → **32** | 12 → **17** | 0/3/8/3 → 0/0/0/1 |
| Voice HUD | 25 → **31** | 10 → **16** | 0/4/8/2 → 0/0/1/0 |
| **All (excluding Landing's /32)** | avg 23.9/40 → **avg 31.5/40** | avg 11.2/20 → **avg 17.1/20** | **3/72/110/51 → 0/0/2/6** |

Every surface moves from the "Acceptable" band into "Good". None reaches "Excellent" (36+). What's left is mostly product decisions and things that need a real device, not bugs.

## Still open

| ID | Sev | Issue | Why it's open / what to do |
|---|---|---|---|
| landing-7 | P2 | Terms and Privacy still contain `[placeholders]`: company name, region, liability, retention. | Only the owner can fill these. Until then they're shown as visibly pending, dashed amber and read aloud as "Not filled in yet". |
| voice-hud-f1 | P2 | The voice HUD's listening state (live mic ring and canvas waveform) was measured at 50–61 fps in throttled headless Chromium, where the canvas is drawn in software. It has not been checked on a real phone. | Needs a real mid-range phone. If it drops frames, reduce the waveform bar count or the canvas size. |
| atlas-f1 / brain-dump-f1 | P3 | Notes and Atlas replies don't render Markdown tables or fenced code blocks. They show as plain text and wrap. | Would need a Markdown parser dependency. |
| planner-f1 | P3 | In week view, short blocks show only a few letters of their title ("Finis…"). The full title and time are in the tooltip and in "Change time". | Consider a two-line layout for blocks of 30 min or more. |
| planner-f2 | P3 | On phones, a ✨ suggested block's Accept/Dismiss buttons are 24px visible, with 44px invisible hit areas that overlap each other. | A bottom action bar for the selected suggestion (from planner-plans-6) wasn't built. |
| focus-f1 | P3 | When a block finishes in a background tab, the "done" tab title clears on the next tick instead of waiting until you return. | Small follow-up in `useTimer`. |
| review-f1 | P3 | recharts (112 kB gzip) is still the chart library on Review and Mood. It's lazy and off the critical path. | Hand-drawn SVG charts would remove it. |
| — | — | Email templates were redesigned in Phase 3. | The owner must paste them into the Supabase dashboard; see the final report. |

## Fixed in this phase
- **Light-theme contrast (axe):** success and Atlas cyan text on their own tints was 4.38 and 4.22:1. Both tones are slightly deeper now, at ≥5.1:1.
- **Planner block target size (axe):** the block controls (check box, ×) are now real 24 px targets (WCAG 2.5.8). They look the same at 14 px and get 44 px on touch.
- **Focus chart labels:** they wrapped mid-word ("Toda/y") after the Phase 7 rule that lets long words wrap. They now use short weekday names that never wrap, and today is marked by weight and a dot. A scan of every app page at 390, 1024 and 1440 px found no other word wrapping mid-word.
- **Fake tabs:** the Capture dialog's Note/Task switch and the calendar help's app picker declared themselves tabs without tab keyboard behaviour. They're now labelled groups of pressed-state buttons (finishes X12).
- **Admin:** the "Last 30 days" list shows readable dates instead of ISO strings.
- **The `plans` browser flow:** it no longer depends on the weekday it runs on.
