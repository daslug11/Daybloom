# Mood: critique & audit (Phase 1 baseline)

Method: design review (sub-agent, screenshots + source + live app) → then detector evidence (Phase 0 CDP scans, both themes, desktop + phone)

Evidence used for the critique: the four `phase0-before/{dark,light}-{desktop,phone}/mood.jpg` screenshots, the five source files plus `ui/Card.tsx`, `ui/Ai.tsx`, `ui/PageHeader.tsx`, `ui/States.tsx`, `hooks/data/cache.ts`, `hooks/useAi.ts`, `index.css` and `tailwind.config.js`, and a read-only Playwright probe of `/app/mood` (1440×900 and 390×844). The probe covered tab order, ARIA roles, arrow keys and element sizes. It did not tap a mood, type a note, press ✨ Reflect or toggle the theme, because each of those writes data or spends allowance. The detector JSON was opened only after this Critique section was written.

## Critique

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | The selected mood is clear (ring + title "Today: 🙂 Good"), but the optional note saves silently on blur (`Mood.tsx:46-49`). It shows no "Saved" state, and the user can't tell whether the note was kept. |
| 2 | Match System / Real World | 3 | Emoji plus a plain word (Rough…Amazing), and "One check-in per day — tap again to change it." All of it is plain language. Only the bare "3.5 / 5" uses an internal scale. |
| 3 | User Control and Freedom | 2 | Today's mood can be changed but never cleared. A missed yesterday can't be backfilled. A ✨ Reflect result that cost an allowance use lives in `useState` and vanishes on navigation. |
| 4 | Consistency and Standards | 2 | The card title and its button both say "Reflect". The AI suggestion panel is violet, not Atlas cyan. Review explains its "Average mood" ("1 = rough, 5 = amazing") but this page doesn't. The radiogroup doesn't follow the arrow-key radio pattern. |
| 5 | Error Prevention | 2 | A note typed and then abandoned (tab closed, app switched on phone) is never saved, because save happens only on `onBlur`. ✨ Reflect is enabled by ≥3 check-ins in the last **35** days, though it analyses only the last **14**. |
| 6 | Recognition Rather Than Recall | 3 | All five options are visible with labels. History is visible. The chart's y-axis shows only 3 of 5 emojis, so 2 and 4 must be inferred. |
| 7 | Flexibility and Efficiency | 2 | The Dashboard's small picker is a real accelerator. On this page there is no shortcut and no arrow-key movement in the picker (5 separate tab stops), and the chart adds a dead tab stop. |
| 8 | Aesthetic and Minimalist Design | 2 | Calm and uncluttered overall. But the history list sits unlabelled inside the Reflect card, violet carries every emphasis (title gradient, chart line, selected ring), and the "Today" axis label is clipped to "Toda". |
| 9 | Error Recovery | 2 | Save failures roll back and toast ("Your check-in could not be saved."), and AI errors toast. A lost note fails silently, though, and the toast can't retry. |
| 10 | Help and Documentation | 3 | The header sentence says what the page is for. There is a hint under the picker, a pre-Reflect explainer that changes below 3 check-ins, and a "Not medical advice" note on results. |
| **Total** | | **23/40** | **Acceptable** |

### Design Specificity Verdict

**LLM assessment:** The *content* is product-specific; the *visual language* is not.

What is product-specific:
- The ten-second framing.
- The one-per-day rule stated in plain words.
- The honest "Average 3.5 / 5 from 6 check-ins".
- A Reflect that is gated, explained and caveated.
- The note that turns history rows into a small diary ("Sat, Oct 24 · Exam stress").

All of that feels authored for a student organiser.

The composition, though, is the generic wellness-app template: five big emoji in a row, a smoothed violet line with dot markers, and a list of emoji+date rows. A mood screen in any habit app would look the same. It also sits outside the confirmed "Clear Head" direction:
- gradient page title;
- violet line, selection ring and AI panel;
- violet-bordered tooltip;
- a curved, decorative-feeling line where a crisp, precise per-day mark would carry the data better.

The missed opportunity is to make the mood record *legible and exact*: discrete per-day marks with visible gaps, a labelled 1–5 scale, and the history as its own titled section. That would match "crisp, precise, quick" and the "honest numbers" commitment.

**Deterministic scan:** see the Audit section (written after this critique).

### What's Working

1. **The primary task really is one tap, and the tap target is generous.** Each picker button is 53×92 CSS px at both desktop and 390px phone width (measured live). The row sits at the top of the first card on phones. The emoji carries the label as text (`MoodPicker.tsx:23`) and `aria-label`, and the card title changes to "Today: 🙂 Good" once picked (`Mood.tsx:34`). The same `MoodPicker` is reused on the Dashboard (`Dashboard.tsx:263`), so the check-in is consistent wherever it appears.
2. **The average is honest and self-describing.** "Average **3.5 / 5** from 6 check-ins" (`Mood.tsx:60`) states its sample size. It shows "No check-ins this week yet." rather than a zero. It uses the same rolling 7-day window as the chart (`day > today-7` vs `today-6…today`), and the screenshot data checks out: (3+2+5+4+3+4)/6 = 3.5. The chart's `role="img"` summary is a real text alternative listing every logged day ("Fri Okay, Sat Meh, Sun Amazing…").
3. **AI is optional, gated and caveated.** Reflect is disabled below 3 check-ins, with copy that says exactly when it unlocks (`Mood.tsx:85`). The button's title names the cost ("Uses 1 of your 15 AI actions left today"). Results carry a "Not medical advice… talk to someone you trust" line, which is the right reassurance at a sensitive moment.

### Priority Issues

**[P1] The chart invents mood on days you didn't check in.**
- **Why it matters:**
  - `MoodChart.tsx:26` draws `type="monotone"` with `connectNulls`. A skipped day is bridged by a smooth curve, so the chart shows a mood that was never logged.
  - The curve also implies in-between values ("2.7 on a Saturday afternoon").
  - The component's own doc comment promises "gaps where you didn't check in" (`MoodChart.tsx:6`).
  - This breaks the "honest numbers" commitment ("Every number says how it was calculated").
- **Fix:**
  - Remove `connectNulls` and use `type="linear"`, or better, render discrete per-day marks (a dot or short bar per day) so a gap reads as a gap.
  - Optionally add a faint "no check-in" tick on empty days.
  - Keep the emoji mark per point.
- **Suggested command:** `/impeccable clarify` (with the `dataviz` skill for mark choice)

**[P1] The chart's accessibility is self-contradictory: a focusable `role="application"` inside `role="img"`.**
- **Why it matters:**
  - Recharts 3.10 turns on `accessibilityLayer` by default. Live, the `<svg>` has `role="application" tabindex="0"` inside the wrapper `div role="img"` (`MoodChart.tsx:16`). Its focus name concatenates to "FriSatSunMonTueWedToday😫😐🤩".
  - Keyboard users get a dead tab stop between the picker and Reflect.
  - Screen readers enter "application" mode inside an image whose children are meant to be presentational. Depending on the reader, that hides or duplicates the good `aria-label` summary.
- **Fix:**
  - Pass `accessibilityLayer={false}` to `<LineChart>` and keep the wrapper's `role="img"` + `aria-label` as the single accessible name.
  - Or drop `role="img"` and let Recharts' layer stand, with a proper `title`/`desc`. Don't do both.
  - Add "(1 = Rough, 5 = Amazing)" to the label.
- **Suggested command:** `/impeccable harden`

**[P1] History rows hide the mood itself whenever a note exists.**
- **Why it matters:**
  - `Mood.tsx:92-94` marks the emoji `aria-hidden` and then prints `m.note || label`. When a note exists, the label disappears.
  - A screen reader hears "Sat, Oct 24, Exam stress" with no mood at all. Sighted users must decode 😕 vs 😐 at 16px.
  - This loses the one datum the row exists to show (WCAG 1.1.1 / 1.3.1).
- **Fix:**
  - Always render the label next to the emoji ("😕 Meh"), with the note as secondary text after it.
  - Or give the emoji `role="img" aria-label={label}`.
- **Suggested command:** `/impeccable harden`

**[P2] The scale behind "3.5 / 5" is never shown, and the y-axis has only three unlabelled emoji ticks.**
- **Why it matters:**
  - `MoodChart.tsx:21` sets `ticks={[1, 3, 5]}` with emoji-only labels, so Meh (2) and Good (4) have no gridline or label.
  - "3.5 / 5" (`Mood.tsx:60`) gives no definition of what 1 and 5 mean. Weekly Review already explains the same number ("Mean of your daily mood check-ins (1 = rough, 5 = amazing).", `Review.tsx:99`), but this page drops it.
  - Honest numbers need the method next to the number.
- **Fix:**
  - Use ticks `[1,2,3,4,5]`.
  - Add a one-line method under the average: "Mean of your check-ins in the last 7 days (1 = Rough, 5 = Amazing)."
  - Optionally show the nearest label: "3.5 / 5 · between Okay and Good".
- **Suggested command:** `/impeccable clarify`

**[P2] History is buried, unlabelled, inside the Reflect card, which also says "Reflect" twice.**
- **Why it matters:**
  - The page promises a check-in, a weekly chart and history, but history has no heading (`Mood.tsx:88-98`). It reads as part of the AI feature.
  - The card title "Reflect" duplicates the button label "✨ Reflect" (`Mood.tsx:71-75`).
  - On phones the Reflect card is the third card, and its header is the part the bottom tab bar covers when scrolled (`dark-phone/mood.jpg`).
- **Fix:**
  - Split into two cards: **"Recent check-ins"** (its own `h2`, full width, the list) and a smaller **"Patterns"** card holding the ✨ Reflect button and its result.
  - Or keep one card but title it "Recent check-ins" and put ✨ Reflect as its action.
- **Suggested command:** `/impeccable layout`

**[P2] Notes can silently fail to save, with no confirmation.**
- **Why it matters:**
  - The note saves only in `onBlur` (`Mood.tsx:46-49`). Typing a note on a phone and then locking the screen, switching apps or closing the tab never fires blur, so the note is lost.
  - When it does save, nothing confirms it.
  - Casey, the most likely user of a "ten-second check-in", is the one most likely to be interrupted.
- **Fix:**
  - Debounce-save on change (e.g. 800 ms) and also save on `visibilitychange`/`pagehide`.
  - Show a quiet "Saved" / "Saving…" status in the hint line under the textarea (`Mood.tsx:52`).
- **Suggested command:** `/impeccable harden`

### Persona Red Flags

**Casey (distracted mobile user)**
- The one-tap check-in works: big targets near the top of the first card. But the note field is a blur-to-save textarea. Casey's interrupt-and-leave pattern loses it, and nothing says "Saved".
- ✨ Reflect is a 30px-tall button (live: 84×30) at the far right of the third card's header. It is far from the thumb, and its cost lives only in a `title` tooltip (`Ai.tsx:42`), which touch never shows.
- A Reflect result disappears on the next tab switch (local `useState`, `Mood.tsx:19`). Casey pays an allowance use and can lose the answer by glancing at Tasks.
- The "Today" x-axis label is clipped to "To…" at 390px (`dark-phone/mood.jpg`). The Atlas orb and + FAB float over the chart's right edge mid-scroll.

**Sam (screen-reader / keyboard user)**
- The picker announces as a radiogroup but behaves like five buttons. ArrowRight on "Rough" stays on "Rough" (live), and all five are separate tab stops.
- After the picker, Tab lands on an unnamed-ish "application" (the Recharts svg) inside an image.
- History rows that have notes never announce the mood (emoji `aria-hidden`, label replaced by the note).
- Dates in history and the hint "One check-in per day…" use `.faint` (slate-500) on the dark card. That is about 3.9:1 at 12px, below AA.

**Jordan (first-timer)**
- Lands on an empty-ish page. The chart shows three emoji and a flat grid, and "No check-ins this week yet." is clear. But "3.5 / 5" later appears without a scale.
- "Reflect" appears as a heading and as a button. A first-timer can't tell whether the list under it is AI output or their own history.

### Cognitive Load

Checklist failures (2 of 8, so moderate):
- **Grouping:** the history list is grouped with the AI Reflect feature instead of under its own heading. Two unrelated things share one card.
- **Working memory:** reading the chart needs the user to remember which emoji means 2 vs 4 (only 1/3/5 are drawn). Reading "3.5 / 5" needs them to recall the scale from the picker card.

Passing: single focus (the picker leads), chunking, visual hierarchy, one thing at a time, progressive disclosure (the note is disabled until a mood is picked; Reflect is explained before it unlocks).

Decision points with >4 visible options: the mood picker has **5** options. This is acceptable and intrinsic: it is a single, familiar Likert-style choice, every option is labelled, and collapsing it would hurt the one-tap goal. No change recommended.

### Minor Observations

- Picker labels are 11px (`MoodPicker.tsx:23`, `text-[11px]`). After a pick, the unselected options drop to `opacity-50`, which pushes their `.muted` labels to roughly 2.6:1 in dark.
- The `+ FAB` and Atlas orb overlap the chart's right edge on phone (`*-phone/mood.jpg`). This is a shell concern, but this page has no extra bottom padding for it.
- The textarea placeholder "Pick a mood first" is correct, but the disabled textarea looks almost identical to the enabled one in dark mode (`dark-desktop/mood.jpg`).
- `Mood.tsx:34`, `:92` and `:94` index `MOODS[score - 1]` without a guard. A bad row would crash the page instead of falling back (`moodEmoji` already has a fallback).
- History shows the last 14 *check-ins* (`Mood.tsx:25`), not 14 days, and there's no way to see older ones even though 35 days are fetched (`moods.ts:16`).
- The "Not medical advice" disclaimer (`Mood.tsx:81`) uses `.faint` 12px, the lowest-contrast text on the page, for the most safety-relevant sentence.

## Audit

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | A focusable `role="application"` svg sits inside `role="img"` (`MoodChart.tsx:16`). History rows hide the mood when a note exists (`Mood.tsx:92-94`). `.faint` text is 3.9:1 in dark. The radiogroup has no arrow keys. |
| 2 | Performance | 3 | The route is lazy (`App.tsx:28`), so Recharts loads only on Mood/Review. The line animation is off. Minor: `backdrop-blur-xl` on three cards, and Recharts is heavy for 7 points. |
| 3 | Theming | 2 | The chart hard-codes hex (`#8b5cf6`, `#14112a`, `#94a3b8`, `#475569`) and reads `document.documentElement.classList` once per render instead of using tokens. The selected picker state and Reflect panel are hard-coded violet. |
| 4 | Responsive Design | 3 | Works at 390px. The picker is 53×92. "Today" is clipped on every size. ✨ Reflect is 84×30 (passes AA 2.5.8 but is under 44px). |
| 5 | Implementation Integrity | 2 | The chart contradicts its own doc comment (`connectNulls` vs "gaps where you didn't check in"). Violet emphasis runs against the confirmed direction. The ARIA radio pattern is only half implemented. |
| **Total** | | **12/20** | **Acceptable** |

**Implementation Integrity verdict: fail (narrowly).** The data layer is sound:
- optimistic upsert with rollback and toast (`moods.ts:20-27`, `cache.ts:19-31`);
- a consistent 7-day window shared with Review (`Review.tsx:28`);
- the average states its sample size.

But the one visualization on the page misrepresents gaps, and its accessible name conflicts with Recharts' own accessibility layer. On a page whose purpose is an honest record, that's the failure that counts.

### Detector findings

Totals: dark-desktop 12, dark-phone 11, light-desktop 8, light-phone 7. Counts by rule are summed across the four scans; the right column says what each one is.

| Rule | Count (4 scans) | Element | Verdict |
|------|-----------------|---------|---------|
| `low-contrast` (#64748b on #14131b, 3.9:1) | 4 (dark only, 2 per scan) | `p.faint.mt-2` = the hint "One check-in per day…" (`Mood.tsx:52`). `span.faint.w-24` = history dates (`Mood.tsx:93`). | **Real, on this surface.** It also applies to the "Not medical advice" line (`Mood.tsx:81`), which isn't rendered until Reflect runs, so the detector didn't see it. The root cause is `.faint` → `dark:text-slate-500` (`index.css:66-67`). WCAG 1.4.3. |
| `gradient-text` (`h1.gradient-text`) | 4 | The "Mood" page title (`PageHeader.tsx:8`, `index.css:59-60`) | **Real**, systemic, already slated for removal per DESIGN.md (No-Ornament Type Rule). |
| `gradient-text` (`span.gradient-text.text-lg`) | 2 (desktop) | The sidebar "Daybloom" wordmark | Real, but shell (not this surface). Already slated. |
| `low-contrast` (#fff on #cc4fb7) | 4 | The avatar "M" in the top bar (`TopBar.tsx:70`) | Real (3.9:1), shell. Violet→pink gradient already slated. |
| `ai-color-palette` (purple gradient) | 8 | The logo tile (`Logo.tsx:6`) and avatar (`TopBar.tsx:70`) | Real drift, shell, already slated. |
| `ai-color-palette` (purple accents, `body`) | 4 | Page-wide violet. On this surface: chart line/dots `#8b5cf6` (`MoodChart.tsx:26`), tooltip border (`:23`), selected mood ring (`MoodPicker.tsx:19`), `.btn-ai` Reflect, suggestion panel `bg-violet-500/10` (`Mood.tsx:80`). | **Real**, against the confirmed neutral-emphasis direction. |
| `ai-color-palette` (cyan gradient, `span.absolute.inset-[18%]`) | 4 | The Atlas orb core (`AtlasOrb.tsx:8`) | **False positive.** Cyan is reserved for Atlas by design. |
| `dark-glow` (#164e63) | 2 (dark) | The Atlas orb button shadow (`AtlasOrb.tsx:18`) | Mostly a false positive: cyan on the orb is intended. The "no glows" direction may still want it flattened to a neutral shadow. Shell. |
| `dark-glow` (#4c1d95) | 2 (dark) | The capture "+" FAB, `shadow-violet-900/30` (`AppShell.tsx:129`) | Real, shell, slated with violet. |
| `overused-font` (Inter 100%) | 4 | `body` | **False positive** for an Operate surface. operate.md allows "one family is often right", and DESIGN.md chooses Inter deliberately. |

`src_scan_all` reported **nothing in the five Mood source files**. Its hits are all elsewhere (VoiceHud grid, CalendarCard/GoalCard/Logo/TopBar/Switch gradients, `index.css:60,61,79`, Planner).

**What the detector missed and the critique caught:**
- the `role="application"`-inside-`role="img"` chart;
- the chart's `connectNulls` gap-bridging;
- the clipped "Today" tick;
- mood labels lost in history;
- the incomplete radiogroup keyboard pattern;
- hard-coded chart colours. They live in an SVG `stroke` attribute and an inline `contentStyle`, which the class-based scanner doesn't read.

### Findings by severity

**[P1] Focusable `role="application"` svg nested inside `role="img"`**
- **Location:** `src/components/mood/MoodChart.tsx:16-18` (Recharts 3.10.1 `accessibilityLayer` default)
- **Category:** Accessibility
- **Impact:**
  - Keyboard users get a dead Tab stop named "FriSatSunMonTueWedToday😫😐🤩" (verified live on desktop and phone).
  - Screen readers get conflicting semantics: an image with an interactive application inside.
- **WCAG:** 4.1.2 Name, Role, Value; 1.3.1 Info and Relationships
- **Recommendation:** Pass `accessibilityLayer={false}` to `<LineChart>`. Keep the wrapper's `aria-label` and extend it with the scale ("1 = Rough, 5 = Amazing") and the "no check-in" days.
- **Suggested command:** `/impeccable harden`

**[P1] Chart bridges missed days with an interpolated curve**
- **Location:** `src/components/mood/MoodChart.tsx:26` (`type="monotone"`, `connectNulls`), contradicting the doc comment at `:6`
- **Category:** Implementation Integrity
- **Impact:** Shows mood values that were never recorded, against PRODUCT.md's "Honest by default".
- **Recommendation:** `connectNulls={false}` and `type="linear"`, or discrete per-day dots/bars. Show empty days as empty.
- **Suggested command:** `/impeccable clarify`

**[P1] Mood value missing from history rows that have a note**
- **Location:** `src/pages/app/Mood.tsx:92-94`
- **Category:** Accessibility
- **Impact:** The emoji is `aria-hidden` and the label is replaced by the note, so assistive tech never hears the mood.
- **WCAG:** 1.1.1 Non-text Content; 1.3.1
- **Recommendation:** Render `{emoji} {label}` always, with the note as secondary muted text.
- **Suggested command:** `/impeccable harden`

**[P1] `.faint` text below AA in dark theme**
- **Location:**
  - `src/index.css:66-67`, used at `src/pages/app/Mood.tsx:52` (hint), `:81` (medical disclaimer) and `:93` (history dates)
- **Category:** Accessibility (detector: `low-contrast` 3.9:1, verified)
- **Impact:** Dates, the how-to hint and the safety disclaimer are hard to read on a dark card.
- **WCAG:** 1.4.3 Contrast (Minimum)
- **Recommendation:** Map `.faint` in dark to slate-400 (#94a3b8, about 7:1), or retire the faint tier for readable text. Promote the disclaimer to `.muted`.
- **Suggested command:** `/impeccable colorize`

**[P2] Radiogroup without the radio keyboard pattern**
- **Location:** `src/components/mood/MoodPicker.tsx:7-15`
- **Category:** Accessibility
- **Impact:**
  - It announces "radio, 1 of 5", but ArrowRight does nothing (verified live) and all five options are separate Tab stops.
  - Screen-reader users following the announced role get stuck.
- **WCAG:** 4.1.2 (ARIA Authoring Practices radio pattern)
- **Recommendation:**
  - Roving `tabIndex` (checked item, or the first, gets 0).
  - Arrow/Home/End move focus and select.
  - Or drop `role="radio"` and use plain buttons with `aria-pressed`.
- **Suggested command:** `/impeccable harden`

**[P2] "Today" x-axis tick clipped**
- **Location:** `src/components/mood/MoodChart.tsx:18` (`margin.right: 8`) and `:20` (`interval={0}`)
- **Category:** Responsive
- **Impact:** The most important day reads "Toda" (desktop) or "To…" (phone) in all four screenshots.
- **Recommendation:** Increase the right margin (≈24px) or set `padding={{ left: 12, right: 12 }}` on `XAxis`.
- **Suggested command:** `/impeccable polish`

**[P2] Hard-coded, violet, theme-fragile chart and selection colours**
- **Location:**
  - `src/components/mood/MoodChart.tsx:8,19-26`
  - `src/components/mood/MoodPicker.tsx:19`
  - `src/pages/app/Mood.tsx:80`
  - `src/components/ui/PageHeader.tsx:8`
- **Category:** Theming
- **Impact:**
  - The hex values bypass tokens.
  - `dark` is read from the DOM during render, so the chart only updates on theme change if a parent happens to re-render. This is fragile; it wasn't toggled live, to avoid writing the profile.
  - Violet emphasis contradicts the confirmed direction. The AI suggestion panel isn't Atlas cyan.
- **Recommendation:**
  - Read colours from CSS variables (`stroke="var(--chart-line)"`).
  - Selected mood: neutral near-white ring/fill.
  - Chart line: neutral ink.
  - Reflect result panel: the Atlas cyan treatment.
  - Remove the gradient title.
- **Suggested command:** `/impeccable colorize`

**[P2] Scale undefined for the average and the y-axis**
- **Location:** `src/pages/app/Mood.tsx:57-65`, `src/components/mood/MoodChart.tsx:21`
- **Category:** Implementation Integrity
- **Impact:** "3.5 / 5" lacks the "how" line that Review provides (`Review.tsx:99`). Only 3 of 5 levels are on the axis.
- **Recommendation:** Ticks 1–5, plus "Mean of your check-ins in the last 7 days (1 = Rough, 5 = Amazing)."
- **Suggested command:** `/impeccable clarify`

**[P2] Note persisted only on blur, no saved state**
- **Location:** `src/pages/app/Mood.tsx:38-50`
- **Category:** Implementation Integrity
- **Impact:** Interrupted mobile sessions lose the note silently.
- **Recommendation:** Debounced save plus a `pagehide` flush, and a "Saved" status in the hint line.
- **Suggested command:** `/impeccable harden`

**[P2] History merged into the Reflect card, with a duplicate "Reflect" label**
- **Location:** `src/pages/app/Mood.tsx:67-98`
- **Category:** Implementation Integrity (IA)
- **Impact:** The user's own record reads as AI output, and the section has no heading for screen-reader navigation.
- **Recommendation:** Split into a "Recent check-ins" card with an `h2` and a "Patterns" card with ✨ Reflect.
- **Suggested command:** `/impeccable layout`

**[P2] ✨ Reflect result is ephemeral; its cost is shown only in a tooltip**
- **Location:** `src/pages/app/Mood.tsx:19,70`, `src/components/ui/Ai.tsx:42`
- **Category:** Implementation Integrity
- **Impact:**
  - An allowance use is spent on a result that is lost on navigation.
  - Touch users never see "Uses 1 of your N AI actions left today".
- **Recommendation:**
  - Cache the last reflection, e.g. in the React Query cache keyed by day, with "Reflected today at 14:02".
  - Show the cost visibly near the button ("uses 1 of 15").
- **Suggested command:** `/impeccable clarify`

**[P3] 11px picker labels dimmed to `opacity-50` after a pick**
- **Location:** `src/components/mood/MoodPicker.tsx:19,23`
- **Category:** Accessibility
- **Impact:** Unselected labels drop to about 2.6:1 in dark.
- **Recommendation:** Dim the emoji only, not the label. Use 12px labels.
- **Suggested command:** `/impeccable typeset`

**[P3] Reflect enablement doesn't match what it analyses**
- **Location:** `src/pages/app/Mood.tsx:70` (`list.length < 3` over the 35-day fetch, `moods.ts:16`)
- **Category:** Implementation Integrity
- **Impact:** The button can spend allowance on a window with fewer than 3 check-ins.
- **Recommendation:** Count only check-ins in the last 14 days.
- **Suggested command:** `/impeccable harden`

**[P3] Unguarded `MOODS[score - 1]` lookups**
- **Location:** `src/pages/app/Mood.tsx:34,92,94`
- **Category:** Implementation Integrity
- **Impact:** An out-of-range score crashes the page.
- **Recommendation:** Use a `moodFor(score)` helper with a fallback, like `moodEmoji` in `lib/moods.ts:9`.
- **Suggested command:** `/impeccable harden`

### Positive findings

- **Optimistic, recoverable writes.** `useSetMood` upserts on `user_id,day`, updates the cache instantly, rolls back on error and toasts a specific message (`moods.ts:20-27`, `cache.ts:19-31`). The one-per-day rule is enforced by the database, not just the UI.
- **Honest, consistent averaging.** It uses the same rolling `today-6…today` window as the Weekly Review (`Review.tsx:28`). The sample size is shown, and empty weeks say so instead of showing 0.
- **The chart has a real text alternative.** The `aria-label` lists every logged day by name (`MoodChart.tsx:16`), and line animation is disabled (`isAnimationActive={false}`), so nothing moves for no reason.
- **Lazy route.** Recharts ships only with Mood and Review (`App.tsx:28`).
- **Clear headings and focus.** Heading structure is clean (h1 Mood → three h2s), and every Tab stop shows a visible focus ring (verified live).
- **Good touch targets.** The picker's 53×92 targets exceed 44×44 on phones.

## Motion on this surface

| Motion | Where | Trigger | Duration / easing | Earns its place? |
|---|---|---|---|---|
| Card fade-in + 4px rise | `src/components/ui/Card.tsx:16` (`animate-fade-in`), keyframes `tailwind.config.js:12,15` | Mount of each of the 3 cards | 250ms ease-out, all at once | **Marginal.** It replays on every visit to a page opened many times a day. operate.md says product loads into a task. Consider dropping it or limiting it to first data load (`remove-animations`). |
| Mood option state change | `src/components/mood/MoodPicker.tsx:17` (`transition`) | Hover / select (bg, ring, opacity) | Tailwind default 150ms `cubic-bezier(0.4,0,0.2,1)` | **Yes.** It is the feedback for the one primary action. Could add a brief press scale (`active:scale-95`) for tactility. |
| Button press scale | `src/index.css:75` (`.btn`: `transition`, `active:scale-[0.97]`), via `.btn-ai` Reflect | Press | 150ms default | **Yes.** It is tactile feedback, in line with the "pressable" direction. |
| Reflect spinner | `src/components/ui/Ai.tsx:51` (`animate-spin`) | While the AI request is pending | 1s linear, infinite | **Yes.** It shows status, and replaces the icon in place. |
| Textarea focus border/ring | `src/index.css:70-71` (`.input` `transition`) | Focus | 150ms default | **Yes.** It shows focus state. The ring is violet today and should become neutral. |
| Recharts tooltip movement | `src/components/mood/MoodChart.tsx:22` (Recharts `Tooltip` default `isAnimationActive`) | Hover / keyboard over points | Recharts default ~400ms ease | **No.** It is a slow, floaty follow on a 7-point chart. Set `isAnimationActive={false}` on `Tooltip` for a crisp feel. |
| Line draw | `src/components/mood/MoodChart.tsx:26` | n/a | Disabled (`isAnimationActive={false}`) | Correctly off. |
| Loading skeleton pulse | `src/components/ui/States.tsx:57` (`animate-pulse`, via `QueryState`) | While moods load | 2s infinite | **Yes.** It shows loading status. |

Reduced motion: the global rule (`index.css:32-40`) sets every duration to 0.01ms. On this surface nothing essential depends on motion (the selection ring and spinner icon still show state), so the blanket kill does no harm here.

## Machine-readable summary

```json
{"surface":"mood","critique_total":23,"critique_max":40,"na_heuristics":[],"audit_total":12,
 "issues":[
  {"id":"mood-1","severity":"P1","title":"Chart bridges missed days with an interpolated curve (connectNulls + monotone)","fix":"Remove connectNulls, use linear or discrete per-day marks so skipped days show as gaps","command":"/impeccable clarify","files":["src/components/mood/MoodChart.tsx:26","src/components/mood/MoodChart.tsx:6"],"source":"both"},
  {"id":"mood-2","severity":"P1","title":"Recharts svg role=application tabindex=0 nested inside role=img wrapper","fix":"Set accessibilityLayer={false} on LineChart; keep one aria-label summary including the 1-5 scale","command":"/impeccable harden","files":["src/components/mood/MoodChart.tsx:16","src/components/mood/MoodChart.tsx:18"],"source":"both"},
  {"id":"mood-3","severity":"P1","title":"History rows with a note never expose the mood (emoji aria-hidden, label replaced)","fix":"Always render emoji + label; show the note as secondary text","command":"/impeccable harden","files":["src/pages/app/Mood.tsx:92","src/pages/app/Mood.tsx:94"],"source":"both"},
  {"id":"mood-4","severity":"P1","title":".faint text is 3.9:1 in dark (hint, history dates, medical disclaimer)","fix":"Map .faint dark to slate-400 or retire the tier for readable text; promote the disclaimer to .muted","command":"/impeccable colorize","files":["src/index.css:66","src/pages/app/Mood.tsx:52","src/pages/app/Mood.tsx:81","src/pages/app/Mood.tsx:93"],"source":"both"},
  {"id":"mood-5","severity":"P2","title":"Mood picker uses role=radio without arrow-key/roving-tabindex behaviour","fix":"Implement the ARIA radio pattern (roving tabIndex, arrows/Home/End) or use buttons with aria-pressed","command":"/impeccable harden","files":["src/components/mood/MoodPicker.tsx:7","src/components/mood/MoodPicker.tsx:9"],"source":"both"},
  {"id":"mood-6","severity":"P2","title":"'Today' x-axis tick clipped to 'Toda' on all sizes","fix":"Raise LineChart right margin to ~24px or add XAxis padding","command":"/impeccable polish","files":["src/components/mood/MoodChart.tsx:18","src/components/mood/MoodChart.tsx:20"],"source":"both"},
  {"id":"mood-7","severity":"P2","title":"Hard-coded violet chart/selection/AI-panel colours, chart reads theme from DOM at render","fix":"Use CSS-variable tokens; neutral near-white selection and line; Atlas cyan for the Reflect result; remove gradient title","command":"/impeccable colorize","files":["src/components/mood/MoodChart.tsx:8","src/components/mood/MoodChart.tsx:19","src/components/mood/MoodChart.tsx:23","src/components/mood/MoodChart.tsx:26","src/components/mood/MoodPicker.tsx:19","src/pages/app/Mood.tsx:80","src/components/ui/PageHeader.tsx:8"],"source":"both"},
  {"id":"mood-8","severity":"P2","title":"Average '3.5 / 5' and y-axis lack the scale definition (only 1/3/5 ticks)","fix":"Ticks 1-5 and a method line: 'Mean of your check-ins in the last 7 days (1 = Rough, 5 = Amazing)'","command":"/impeccable clarify","files":["src/pages/app/Mood.tsx:60","src/components/mood/MoodChart.tsx:21"],"source":"both"},
  {"id":"mood-9","severity":"P2","title":"Note saves only on blur and shows no saved state","fix":"Debounced save plus pagehide flush; 'Saving…/Saved' in the hint line","command":"/impeccable harden","files":["src/pages/app/Mood.tsx:46","src/pages/app/Mood.tsx:52"],"source":"both"},
  {"id":"mood-10","severity":"P2","title":"History is unlabelled inside the Reflect card; 'Reflect' title duplicates the button","fix":"Split into 'Recent check-ins' (own h2) and a 'Patterns' card holding ✨ Reflect","command":"/impeccable layout","files":["src/pages/app/Mood.tsx:67","src/pages/app/Mood.tsx:75","src/pages/app/Mood.tsx:88"],"source":"both"},
  {"id":"mood-11","severity":"P2","title":"✨ Reflect result is lost on navigation; cost shown only in a tooltip","fix":"Persist the last reflection (query cache keyed by day) and show the allowance cost visibly","command":"/impeccable clarify","files":["src/pages/app/Mood.tsx:19","src/pages/app/Mood.tsx:70","src/components/ui/Ai.tsx:42"],"source":"both"},
  {"id":"mood-12","severity":"P3","title":"11px picker labels dimmed to opacity-50 after a pick (~2.6:1)","fix":"Dim the emoji only, keep labels at full .muted; use 12px","command":"/impeccable typeset","files":["src/components/mood/MoodPicker.tsx:19","src/components/mood/MoodPicker.tsx:23"],"source":"critique"},
  {"id":"mood-13","severity":"P3","title":"Reflect enabled by 3 check-ins in 35 days though it analyses 14","fix":"Gate on check-ins within the last 14 days","command":"/impeccable harden","files":["src/pages/app/Mood.tsx:70","src/hooks/data/moods.ts:16"],"source":"audit"},
  {"id":"mood-14","severity":"P3","title":"Unguarded MOODS[score - 1] lookups can crash the page","fix":"Add a moodFor(score) helper with a fallback","command":"/impeccable harden","files":["src/pages/app/Mood.tsx:34","src/pages/app/Mood.tsx:92","src/pages/app/Mood.tsx:94"],"source":"audit"}
 ]}
```
