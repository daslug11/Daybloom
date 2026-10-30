# Performance (design Phase 8)

Measured on 2026-10-30, comparing `main` before Phase 8 (commit `8422330`) with the Phase 8 branch. Both are production builds (`vite build`) served by `vite preview`.

**Method:** `tests/perf/measure.mjs`.
- Headless Chromium at a 390×844 phone viewport.
- **4× CPU throttling** and a "fast 4G" network: 9 Mbit/s down, 60 ms latency.
- Cache disabled, so every load is cold.
- Each number is the **median of 7 loads**.
- Signed-in pages use the seeded demo account (Maya).
- "JS" is the script bytes transferred, gzip-compressed by the preview server.

Production on Vercel uses HTTP/2 and brotli, so absolute numbers there will be a little better. The comparison is like for like.

## What changed
1. **framer-motion left the first load.**
   - **Toasts:** now animate with two CSS keyframes (`toast-in`, `toast-out`) instead of framer-motion.
   - **Reduced motion:** the app-wide `MotionConfig` wrapper is gone; reduced motion is handled in CSS.
   - **Calendars:** the only page that still uses framer-motion (to slide calendar cards when you reorder them), so the library now loads only with that page.
   - **Calendar cards:** that slide is switched off under reduced motion.
2. **The signed-in shell is its own chunk.** Public pages (landing, login, sign-up, legal) no longer download the app shell, Capture, the command palette, the focus timer or the local-import prompt.
   - On `/app` URLs the shell and the current page start downloading together, straight away, so there's no extra wait.
3. **The date parser (chrono-node) is only loaded where you type a task.** The display helpers (`formatDue`, `formatTime`, `formatDuration`, `minutesFromTime`) moved to `src/lib/format.ts`, so pages that only *show* tasks don't download the parser.
4. **On-demand surfaces load when the browser is idle.** Capture (N), the command palette (⌘K) and the import prompt load at the first idle moment after the page appears, or immediately when you open one.
5. **Charts load after the numbers.** The Weekly Review and Mood charts (recharts, 112 kB gzip) are separate chunks. The page shows its numbers first, and the chart fills in a moment later in a box of the same size.
6. **One icon chunk.** Instead of about 30 tiny files, there is one 9 kB file, which means fewer requests on every page.
7. **One variable Inter font file** (`wght@400..800`) instead of six weights. Weight 900 was never used.
8. **Brain Dump:** a note's link counts (tasks, habits, goals) are computed in one pass over the data, not three scans per note on every render (brain-dump-14).

## Results (median of 7 cold loads, 4× CPU, fast 4G, 390px)

| Page | JS transferred | First contentful paint | Largest contentful paint | Heading visible |
|---|---|---|---|---|
| Landing | 249 → **168 kB** (−33%) | 564 → **488 ms** | 1096 → **964 ms** (−12%) | 1121 → **1049 ms** |
| Log in | 229 → **150 kB** (−34%) | 564 → **480 ms** | 776 → **692 ms** (−11%) | 787 → **706 ms** |
| Dashboard | 246 → **219 kB** (−11%) | 496 → **456 ms** | 936 → 988 ms (+6%, within run-to-run noise) | 993 → 1051 ms (+6%) |
| Planner | 266 → **237 kB** (−11%) | 488 → **448 ms** | 1032 → **1020 ms** | 1373 → **1340 ms** |
| Weekly Review | 345 → **323 kB** (−6%) | 496 → **432 ms** | 980 → **800 ms** (−18%) | 1559 → **907 ms** (−42%) |

First contentful paint is earlier on every page.

The Dashboard is the only page that didn't get faster. Its heading appears after the shell chunk *and* the page's data queries finish, and the data queries dominate. A +6% difference is within the variation of this setup: two measurement sessions of the *same* "before" build differed by up to 340 ms on the landing heading (1459 vs 1121 ms). It still downloads 27 kB less.

## Main chunks (gzip)

| Chunk | Before | After | Loaded by |
|---|---|---|---|
| entry (`index`) | 60.9 kB | **19.6 kB** | every page |
| framer-motion | 51.4 kB | **(only with Calendars)** | every page → Calendars only |
| react + router | 57.3 kB | 59.5 kB | every page |
| supabase-js | 59.0 kB | 59.0 kB | every page (auth session check) |
| app shell | (inside entry) | 6.4 kB | signed-in pages |
| icons (lucide) | ~30 tiny files | 8.9 kB, one file | as needed |
| date parser (quickAdd + chrono) | (inside entry) | 14.8 kB | Capture, Tasks quick add, Onboarding |
| recharts | 111.8 kB | 111.8 kB | Review and Mood, after first paint |

## Not changed, and why
- **recharts (112 kB gzip)** is the largest remaining dependency. It is now off the critical path. Replacing it with hand-drawn SVG charts would save the bytes, but would also change three charts' behaviour (tooltips, accessibility layer) late in the project. It's a good follow-up.
- **supabase-js (59 kB)** is needed on every page to check the session; public pages show "Open Daybloom" when you're signed in.
- **Inter from Google Fonts** stays render-blocking with `display=swap`. Self-hosting it would remove one cross-origin connection (~100 ms on slow networks), but the font files aren't in the repo yet.
