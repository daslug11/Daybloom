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
