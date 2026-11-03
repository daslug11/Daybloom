# Daybloom design upgrade: final report

This is the plain-English summary of the nine-phase design, motion, mobile and robustness upgrade (October–November 2026). Every phase went out as its own pull request (#7–#16). Each passed type-checking, the unit tests and the full browser test suite, and was confirmed live on daybloom.online before the next phase started.

Before/after screenshots of every screen (phone and desktop, light and dark) are on the `claude/design-screenshots` branch, one folder per phase.

## In one paragraph
Daybloom used to look like a generic "AI product": violet everywhere, gradient text, glowing buttons and see-through glass cards. Several dialogs had real bugs, too: they stole focus while you typed, menus opened underneath other cards, and one Escape closed everything.

It's now calm, neutral and tactile:
- Near-black or near-white emphasis.
- Colour only where it means something: priority, status, a calendar's colour, and cyan for Atlas.
- Solid cards, and type that's always readable.
- The Brain Dump is still the heart of the app.
- The voice HUD is still the one bold showpiece, and it's now more alive than before.

Every number is honest: if something fails to load, you see an error, not a fake zero. It works by keyboard, by touch and with a screen reader. The first page load is about a third smaller.

## The numbers

| | Before | After |
|---|---|---|
| Automated design findings (Impeccable detector, 26 screens × 2 themes × phone/desktop) | 1,474 | **174** (all deliberate: the Inter font, Atlas's cyan) |
| Text contrast failures | 426 | **0** |
| Accessibility violations (axe-core, WCAG 2.2 AA, 104 scans) | not measured | **0** |
| Average design score (Nielsen's 10 heuristics) | 23.9 / 40 | **31.5 / 40** |
| Average technical audit | 11.2 / 20 | **17.1 / 20** |
| Open issues: blocking / major / minor / polish | 3 / 72 / 110 / 51 | **0 / 0 / 2 / 6** |
| Browser test flows | 18 | **30** |
| Unit tests | 64 | **86** |
| JavaScript downloaded, landing page | 249 kB | **168 kB** (−33%) |
| JavaScript downloaded, log in | 229 kB | **150 kB** (−34%) |
| Weekly Review heading visible (slow phone) | 1.56 s | **0.91 s** (−42%) |

The "after" design scores come from one reviewer: the same agent that made the changes. The "before" scores came from 17 independent reviewers. The reviewers planned for the final round were stopped by a usage limit, so treat the score gains as indicative. The automated numbers above don't depend on who reviewed. Details: [`FINAL-REVIEW.md`](FINAL-REVIEW.md).

## What changed, page by page

**Everywhere**
- A new colour system. Violet, gradients, glows and frosted glass are gone. Text passes contrast in both themes.
- Dialogs, menus, Atlas and the command palette share one "layer stack":
  - Escape closes only the top one.
  - Tab stays inside it.
  - Focus returns where it was.
  - Menus open above everything.
- Toasts are read out by screen readers, stay 5 seconds (8 with Undo) and pause while you hover.
- Long names, links and Arabic text wrap instead of breaking the layout. There's a test that seeds absurd data on every page to keep it that way.
- Motion:
  - Things you open with the keyboard appear instantly.
  - Check-offs get a small press-and-pop.
  - Menus grow from their button.
  - With reduced motion turned on, everything only fades. Spinners still turn.

**Landing**
- The hero now shows what Daybloom does: a typed thought becomes an Inbox note.
- The examples are student life.
- Five smaller tools sit in one compact section.
- No sideways scrolling on phones.
- Unfilled legal details are marked "pending".

**Sign up, log in and password reset**
- Errors appear under the field that's wrong.
- "Send it again" (with a cooldown) on every "check your email" screen.
- Unknown error text from links is never shown word for word.

**Onboarding and tour**
- Going Back and Continuing no longer creates duplicates.
- The tour works on phones and skips stops that aren't on screen.
- The "import from this device" offer isn't lost if you close it.

**Dashboard**
- Top tasks and Inbox come first.
- The ✨ briefing is a one-line invitation until you ask for it, and shows when it was written.
- Failed data shows "Couldn't load" with Try again.

**Brain Dump**
- Capture drafts survive closing.
- Process inbox has Undo, Back and 1–6 shortcuts, and ends on a calm "Inbox zero".
- Deleting a note can be undone exactly: links to tasks, habits and goals are kept.

**Tasks**
- The editor saves automatically and puts rarely used fields behind "More details".
- Quick add tells you when it will also block time in the Planner.
- Ctrl/⌘+Z undoes the last completion.

**Planner**
- Dragging and resizing snap to 15 minutes, with a live time label.
- On phones, you press and hold to move a block, so scrolling doesn't reschedule things.
- There's a full keyboard path, and Undo for every move.
- Synced events can be opened (read-only).
- On phones the timeline comes first.

**Calendars**
- One ⋯ menu per calendar.
- Move to group, Move up and Move down without dragging.
- Feed links open the Planner instead of downloading a file.
- The sync status tells the truth about when feeds were last fetched.

**Habits**
- "N of the last 7 days" instead of a mislabelled "this week".
- Streaks are no longer capped at about 120 days.
- The history grid works by keyboard.
- Archived habits can be restored.

**Goals**
- Milestones can be added and edited by hand.
- 100% only once you've reached the target.
- Deleting a goal can be undone.

**Focus**
- Logs the minutes the timer actually ran.
- Survives a reload.
- A timer pill in the top bar.
- The full-screen view fits phones in landscape.

**Mood**
- Skipped days are gaps in the chart, not invented lines.
- The note saves as you type.
- Arrow keys pick a mood.

**Weekly Review**
- One shared, tested calculation for habit numbers, so the tile, list and chart agree.
- Every section shows an error instead of zeros if it fails.
- The AI summary waits until all data has loaded.

**Settings**
- A "Saved" tick on each profile field.
- Export includes every row (no silent cap).
- Voice sliders don't snap back.
- Delete account has its own section.

**Admin**
- Spend against the cap as a meter.
- An "AI running / resting" status.
- Inline editing.
- Works on a phone.

**Atlas chat**
- A failed message is kept with Retry.
- A Stop button while Atlas replies.
- Delete confirmations are a plain question.
- No more occasional duplicate replies.
- Screen readers hear "Atlas replied" once, not every word.

**Voice HUD (the showpiece)**
- A boot sequence.
- Rings that react to listening (live mic level), thinking and speaking.
- Instrument-style readouts, including a countdown to your next item.
- A layout that fits phones.
- Far cheaper when idle: about 20 ms of main-thread work per second, down from about 620 ms.

**Speed**
- The animation library, the signed-in app shell, the date parser and the charts are no longer downloaded by pages that don't need them.
- Full method and numbers: [`PERFORMANCE.md`](PERFORMANCE.md).

## What was deliberately not changed
- **The database, AI usage limits and account security.**
  - The note "undo delete" works on the client, using links the database already had.
  - The only server change is two lines of Atlas's instructions, which now say "press Delete" to match the new button.
- **Inter** stays as the house font. The detector flags it as "overused", but it was a confirmed choice.
- **Cyan** stays for Atlas, and Atlas only.
- **Recharts** (the chart library) stays. It now loads after the page's numbers. Replacing it would change three charts' behaviour late in the project.
- **Markdown tables and code blocks** in notes and Atlas replies still aren't rendered. That would need a new dependency.

## What you should review or do
1. **Paste the four email templates** from `supabase/templates/` into Supabase → Authentication → Email Templates. Until then, real sign-up and reset emails stay violet.
2. **Fill in the legal placeholders** (company, region, liability, retention) in `src/pages/public/Terms.tsx` and `Privacy.tsx`, and have them checked.
3. **Try these on a real phone**: Planner press-and-hold dragging, the tab-bar + Capture button, the voice HUD while listening, and the voice sliders. Emulators can't judge how touch feels or real frame rates.
4. **Behaviour changes worth a look.** Each PR lists all of them; the notable ones:
   - Deleting a goal or note now hides it with Undo instead of asking first.
   - Focus settings lock while a block is running.
   - Capture moved into the tab bar on phones.
   - The task editor saves automatically.
   - "Keep as note" is now "Keep as reference".
   - On phones, opening Atlas no longer pops up the keyboard.
5. **Open polish items:** six small ones, listed in [`FINAL-REVIEW.md`](FINAL-REVIEW.md#still-open).
