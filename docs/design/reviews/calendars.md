# Calendars: critique & audit (Phase 1 baseline)

Method: design review (sub-agent, screenshots + source + live app) → then detector evidence (Phase 0 CDP scans, both themes, desktop + phone)

Evidence used for the critique: the four `calendars.jpg` screenshots (dark/light × desktop/phone), the source listed below, and a live Playwright pass against `http://localhost:5173/app/calendars` as Maya (fresh browser; every non-GET Supabase request aborted, so no data changed). The pass checked tab order and focus rings, the accessible name and size of every control at 390 and 1440 wide, typing into the Add calendar dialog, the New group dialog, the ICS help panel and the filter chips. The seeded account has no calendar with Sync turned on, so the synced, syncing and failed states were reviewed from source only.

Source: `src/pages/app/Calendars.tsx`, `src/components/calendars/{CalendarCard,CalendarModal,GroupModal,SyncToggle,SyncStatusPill,TypeBadge,ColorSwatches,IcsHelp}.tsx`, `src/lib/calendars.ts`, `src/hooks/useCalendarSync.ts`, plus `src/hooks/data/{calendars,cache}.ts`, `server/calendar/sync.ts`, `src/components/ui/{Modal,Switch,Card,PageHeader,States}.tsx`, `src/index.css`, `tailwind.config.js`.

## Critique

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | There is plenty of status: a page-level pill, a per-card line ("12 events · 3m ago"), toasts and an error list. Some of it is not true. "Sync now" refetches, but the server returns its 10-minute cache (`server/calendar/sync.ts:28`), and the pill then says "Synced just now" from the client fetch time (`useCalendarSync.ts:63`) while the card says the feed was fetched 9 minutes ago. Toasts like "Lecture timetable added" fire before the save succeeds. |
| 2 | Match System / Real World | 2 | The page's core idea depends on jargon: "ICS feed", "secret iCal address", "webcal", "feed", "Sync". The help panel translates it well, but the main flow assumes it. The Add dialog's URL placeholder suggests a Google *embed* link (`CalendarModal.tsx:91`), which is the one kind of Google link that cannot sync. |
| 3 | User Control and Freedom | 3 | Deleting a calendar or a group gives an Undo toast. Dialogs close on Escape, the ✕ and the backdrop without saving. Search has a clear button and collapsed groups are remembered. Group delete has no confirmation; it relies on a 6-second Undo. |
| 4 | Consistency and Standards | 2 | The same calendar appears twice in two different card designs (the Pinned strip and its group). "Add calendar" is offered in three places with three looks. Three different violet link styles are used (help toggle, card "Open", the dialog's "How do I find…"). The dialog titles carry emoji ("Add calendar 📅", "Edit group 🗂️"), and other app dialogs do not. |
| 5 | Error Prevention | 3 | URL validation is inline with plain messages. Sync switches itself on when the link looks like a feed (`CalendarModal.tsx:93`), and a warning appears when Sync is on for a link that is not a feed (`CalendarModal.tsx:136-140`). That is good prevention. Weak spots: the embed placeholder, and deleting a group with no confirmation. |
| 6 | Recognition Rather Than Recall | 3 | The type badge, host name and colour identify each calendar. Filter chips list only the groups and types that exist. The live preview in the dialog shows what you are making. |
| 7 | Flexibility and Efficiency | 2 | Search, filters, pinning and drag-and-drop exist. Moving and reordering work only by mouse drag: there is no keyboard path and no touch path. Reordering is impossible on a phone. There are no shortcuts. |
| 8 | Aesthetic and Minimalist Design | 2 | Each card has a blurred colour glow, a gradient side stripe, a gradient emoji tile with a drop shadow, and a coloured type badge (seven hues, including fuchsia and indigo). The drop indicator is a glowing violet→blue bar. With three calendars, the page still shows a sync card, a search field and two rows of filter chips before the first calendar. |
| 9 | Error Recovery | 3 | Feed failures show the server's message per card (`SyncToggle.tsx:32-36`) and as a list in the sync card (`Calendars.tsx:191-207`), with a retry button. The same error is shown twice, both as `role="alert"`, so screen readers hear it twice. |
| 10 | Help and Documentation | 3 | `IcsHelp` is genuinely useful: per-provider steps with example addresses, available both on the page and inside the dialog. It also contains a false privacy statement (Priority Issue 1). |
| **Total** | | **25/40** | **Acceptable** |

### Design Specificity Verdict

**LLM assessment:** The structure is product-specific and the skin is not. The ideas belong to Daybloom: a quick-launch shelf for calendars a student already uses, read-only ICS sync that puts events "locked" in the Planner, a feed-sniffing switch that turns Sync on for you, and a provider-by-provider guide to the secret iCal address. These follow PRODUCT.md exactly (read-only, never connecting to an account). The visual layer is generic "colourful SaaS dashboard": gradient emoji tiles, a blurred colour glow in each card's corner, a rainbow of provider badges, emoji in every title and button ("Add calendar 📅"), a gradient H1 and gradient buttons. Without the copy it could be any link-in-bio or bookmark manager, and it works against "The Clear Head". The missed opportunity is sync status. It is this surface's one real job and its most honest number, and it is styled as a small grey pill in a corner. A confident version would make "3 feeds · 41 events · checked 4 min ago" the calm, central fact of the page, and turn the calendar list into a quiet list.

### What's Working

1. **Feed-aware defaults in the Add dialog** (`CalendarModal.tsx:93`, `lib/calendars.ts:72-83`). Paste a `webcal://` or `.ics` link and Sync turns itself on, until you touch the switch yourself. Turn Sync on for a non-feed link and you get "This doesn't look like an ICS feed (it's a Google embed link). Sync may fail — use the secret iCal address." This prevents errors without asking the user to understand ICS first.
2. **The ICS help guide** (`IcsHelp.tsx`). Tabs for Google / Outlook / iCloud / Others, numbered steps naming the real menu items ("Settings and sharing → Integrate calendar → Secret address in iCal format"), an example of what a correct address looks like, and honest warnings ("the *embed* link is for previews, not syncing"; "Calendly booking pages aren't feeds"). It is the right help at the right moment, and it is reachable from the dialog where the user needs it.
3. **Per-feed sync status with real error messages** (`SyncToggle.tsx`, `useCalendarSync.ts:45-57`). Each synced card says either "12 events · 4m ago" or "Sync failed", with the server's reason underneath. Failures are tracked per calendar, not as one global "something went wrong", so a single broken feed does not hide the others.

### Priority Issues

**[P1] The ICS help tells users their secret addresses stay "in this browser". They are stored on the server.**
- **What:** `IcsHelp.tsx:72-73` says: "Daybloom keeps them in this browser; the sync server only fetches them … and never stores them." In fact every calendar row, URL included, is inserted into the Supabase `calendars` table (`hooks/data/calendars.ts:34`), and the sync endpoint reads the URLs from those rows (`server/calendar/sync.ts`, `syncUserCalendars`). The text is shown right next to "Secret addresses work like passwords".
- **Why it matters:** This breaks two binding commitments: honest by default, and "your data is yours". It is a privacy claim made at the exact moment the user decides whether to paste a password-equivalent link. A student who trusts it might paste a work calendar they would not otherwise share.
- **Fix:** Replace it with something true: "Secret addresses work like passwords — anyone with the link can read your calendar. Daybloom saves the link in your account (only you can read it) so it can fetch your events. The fetched calendar is cached in memory for up to 10 minutes and is never written to disk. Delete the calendar here to remove the link." Have someone who knows the server confirm the exact wording.
- **Suggested command:** `/impeccable clarify`

**[P1] "Sync now" and "Synced just now" misreport freshness**
- **What:** The refresh button (`SyncStatusPill.tsx:43`) calls `query.refetch()`. The server serves any feed fetched in the last 10 minutes from memory (`server/calendar/sync.ts:28`), so pressing it usually fetches nothing new. The pill then shows `timeAgo(lastSync)`, where `lastSync` is the client's `dataUpdatedAt` (`useCalendarSync.ts:63`). It reads "Synced just now" while each card's own `fetchedAt` correctly reads "9m ago".
- **Why it matters:** "Honest numbers" is a binding commitment, and this is the number the user acts on. They add an event in Google, press Sync now, see "Synced just now", and the event is not there. Their conclusion is "sync is broken", not "the cache is warm".
- **Fix:** Drive the pill from the oldest per-feed `fetchedAt` ("Checked 9m ago · 24 events"). Either give the request a `force` flag that skips the cache for this user's feeds, rate-limited to about one per minute, or rename the button "Check again" with the tooltip "Feeds refresh at most every 10 minutes". Fire the "added" and "updated" toasts in `onSuccess`, not before the request.
- **Suggested command:** `/impeccable clarify`

**[P1] Moving and reordering calendars is drag-only, so phone and keyboard users cannot do it**
- **What:** Reordering and moving between groups use HTML5 `draggable` (`CalendarCard.tsx:53-71`). This does not fire on touch screens. The grip icon is `hidden … sm:block` (`CalendarCard.tsx:79`), and the card is not focusable. The empty-group placeholder still tells phone users "Empty group — drag a calendar here or add one." (`Calendars.tsx:347`, visible in both phone screenshots). Moving to another group is possible only by opening Edit and changing the Group select, which nothing on the page mentions. Reordering has no alternative at all.
- **Why it matters:** PRODUCT.md promises the app works as well on a phone as on a desktop and is fully usable by keyboard. Grouping is half of this page's purpose, and on the device students use most it works through a hidden side door.
- **Fix:** Add a "Move to…" action on each card (a small menu listing the groups, plus "Move up" and "Move down") as a keyboard and touch equivalent of drag. Keep drag as the mouse shortcut. Change the empty-group copy by input type: "Add a calendar, or move one here from its ⋯ menu."
- **Suggested command:** `/impeccable adapt`

**[P2] Decorative colour and glow everywhere, against the confirmed direction**
- **What:** Per card: a blurred gradient glow in the top-right corner (`CalendarCard.tsx:74-77`, brightens on hover), a gradient side stripe (`:73`), a gradient emoji tile with `shadow-lg` (`:80`), and a coloured `TypeBadge` (`TypeBadge.tsx:5-13`: blue, sky, slate, stone, indigo, amber, fuchsia). The drop indicator is a violet→blue bar with a violet glow (`CalendarCard.tsx:52`). The section drop highlight is a violet ring (`Calendars.tsx:319`). The Sync switch is a violet→blue gradient when on (`Switch.tsx`). The colour palette itself is eight two-stop gradients (`lib/calendars.ts:3-12`). "Grape" and "Aurora" are violet, and "Ocean" (`#3b82f6 → #06b6d4`) and "Lagoon" end in cyan, which is reserved for Atlas.
- **Why it matters:** DESIGN.md allows colour on this page for one thing, calendar identity, and asks for no glows. Here identity colour is repeated four times per card, provider badges add a second competing colour system, and glows turn a quiet launcher into a mood board. In the light theme the corner glows look like smudges.
- **Fix:** Give each calendar colour a single solid value (no gradients) and drop violet and cyan from the palette (for example slate, blue, rose, orange, amber, green, teal-green, red). Show identity once: a solid 4px left edge or the emoji tile, not both. Delete the glow `div`. Make `TypeBadge` neutral (muted text, hairline border; the provider name is enough). Make the drop indicator a solid 2px near-white line with no shadow, and make the switch's on state neutral near-white.
- **Suggested command:** `/impeccable quieter`

**[P2] Too many controls per card and too much chrome before the content**
- **What:** Each card offers Sync, Open, Preview (Google embeds), Copy, Edit, Pin and Delete: seven actions, five of them identical 32px icons in a row. Above the list, even for three calendars, are the sync card, a full-width search field, a "Group" chip row and a "Type" chip row (`Calendars.tsx:178-258`). On the phone the first calendar card starts below the bottom tab bar (dark-phone and light-phone screenshots), so the screen's job, "open my calendar", needs a scroll.
- **Why it matters:** The page is meant to work "in one click". Each card's decision point is above the working-memory limit, and on a phone Delete sits 8px from Pin.
- **Fix:** Make "Open" the card's primary action, keep the Sync switch, and move Copy, Edit, Pin, Move and Delete into one ⋯ menu. Show search and the filter rows only when there are more than about 8 calendars or more than 2 groups. On phone, collapse the sync card to a single status row.
- **Suggested command:** `/impeccable distill`

**[P2] The Add calendar dialog asks for things in the wrong order and points at the wrong link**
- **What:** The dialog asks for Name first, then URL (`CalendarModal.tsx:69-119`). The URL placeholder is `https://calendar.google.com/calendar/embed?src=…`, which is exactly the link IcsHelp says will not sync. Then come Sync, 16 emoji buttons, 8 colour swatches and Group, all expanded before the submit button. The submit label adds the chosen emoji ("Add calendar 📅").
- **Why it matters:** The real task is "paste a link". Students arrive with a link in their clipboard and must first invent a name. The placeholder teaches the one link format that breaks the headline feature. Twenty-four decorative choices sit between the user and Save.
- **Fix:** Put URL first, autofocused, with an ICS-shaped placeholder (`webcal://… or https://…/basic.ics`). Prefill Name from the detected type and host ("Google Calendar", "Outlook") so it can be accepted as is. Collapse Emoji and Colour under one "Appearance" disclosure, showing the current choice. Plain submit label: "Add calendar".
- **Suggested command:** `/impeccable clarify`

### Persona Red Flags

**Casey (distracted mobile user):**
- Cannot reorder calendars or drag one into a group. The grip is hidden below 640px, HTML5 drag does not fire on touch, and the empty-group copy still says "drag a calendar here".
- The first calendar card starts below the fold, behind the sync card, the search field and two chip rows (dark-phone screenshot: only the Pinned strip is visible above the tab bar).
- Card actions are 32×32 (measured live: Copy, Edit, Pin, Delete, and the three group-header icons), with Delete right beside Pin. The Sync switch is 36×20. Filter chips are 26px tall.
- The "New group" header button is icon-only on phone and has no accessible name, and no tooltip to explain the folder-plus icon.
- Tapping "Open" on an ICS feed (Maya's "Lecture timetable" is a `…/basic.ics` URL) downloads a raw `.ics` file instead of opening a calendar.

**Sam (keyboard and screen reader):**
- No keyboard way to reorder; moving between groups is possible only through Edit → Group.
- On phone width the "New group" button is announced as just "button" (live: its text is in a `hidden sm:inline` span, so it has no name).
- Feed errors are announced twice: the sync card's list and the card's own message are both `role="alert"`.
- Group headings are `<h2>` elements inside a `<button>` (`Calendars.tsx:322-327`; 3 found live). Many screen readers flatten the button, so heading navigation skips the groups.
- Filter chips (`Calendars.tsx:232-254`) show their selected state by colour only, with no `aria-pressed` (live: `null`).

**Jordan (first-timer):**
- The page description and the sync card lead with "ICS feed", "Sync", "feeds" and "secret ICS address" before saying, in plain words, "to see your Google Calendar events in your Planner".
- Following the dialog's placeholder (an embed link), Jordan adds a link that cannot sync and has to find out from a warning.
- "Lecture timetable" is labelled "Google Calendar" but its link is an `.ics` feed with Sync off. Nothing tells Jordan that turning Sync on would bring their lectures into the Planner, the most valuable thing on the page.

### Cognitive Load

Checklist failures (3, moderate):
- **Single focus:** fails. The sync card, search, two filter rows, the Pinned strip and the groups all compete before the user reaches a calendar.
- **Minimal choices:** fails. Each card has 7 actions (Sync, Open, Preview, Copy, Edit, Pin, Delete). The Add dialog shows 16 emoji, 8 colours, a group select and a sync switch at once. The New group dialog shows 6 suggestion chips and 8 colours.
- **Progressive disclosure:** fails. Search and filters appear at 3 calendars. Emoji and colour pickers are always expanded.
- Passes: chunking (groups), grouping, visual hierarchy of the primary "Add calendar" button, one thing at a time inside the dialogs, working memory.

Decision points with more than 4 options: a calendar card (7), the Add calendar dialog's emoji grid (16) and colour row (8), the New group dialog (6 suggestions + 8 colours), the Group filter row (All + n groups + Ungrouped = 4 for Maya, unbounded in general).

### Minor Observations

- Pinned calendars appear twice (the Pinned strip and their group), and the two cards look different. The Pinned strip could be the same row component, or pinning could simply sort to the top of each group.
- Emoji in functional copy: "Give it a name so future-you knows what it is ✍️", "Hmm, that doesn't look like a valid link 🤔", "Links should start with https:// … 🙏", "🕵️ How do I find…", "✨ Google embed link detected". The ✨ sparkle means AI elsewhere in the app and is misleading here.
- "Name (emojis encouraged)" on the group label (`GroupModal.tsx:35`) is whimsy in a label.
- The "Off" label on each card repeats the switch state, and "Sync" sits next to a switch whose accessible name is "Sync events into the Planner". Fine for screen readers, but redundant visually.
- The section headers' item counts ("2", "0", "1") are unlabelled `faint` text with low contrast.
- The URL input uses `text-xs` monospace (12px), and the host line on cards is `text-[11px]`.
- The Pinned card's `ExternalLink` icon has `aria-label="opens in a new tab"` on an SVG with no role, so the hint may not be announced. Add visually hidden text instead.
- The Add dialog's colour defaults to `Math.random()` (`CalendarModal.tsx:40`, `GroupModal.tsx:22`), so the preview colour changes each time the dialog opens.
- When the parent re-renders, `Modal`'s effect re-runs because `onClose` is an inline arrow (`Calendars.tsx:383,387`), and focus jumps back to the first field. Typing alone does not trigger it (draft state is local; verified live), but a background refetch on window focus can. This is the same root cause as the Tasks P0.

## Audit

Detector input: `.scratch/review-input/calendars-detector.json`, 4 page scans (dark/light × desktop/phone, 66 findings in total) plus the repo-wide source scan (12 findings, 2 of them in this surface's files). Every finding was checked against the screenshots, the DOM and the source. Live checks from the critique pass are reused here: control sizes and names at 390 and 1440 wide, tab order, and focus ring after transition.

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | The phone "New group" button has no accessible name. The primary button and the GROUP/TYPE labels fail AA contrast. Reordering is drag-only. Group headings are nested inside buttons. Framer Motion animations ignore reduced motion. Focus rings are visible on every control (verified live), and the dialogs trap and return focus. |
| 2 | Performance | 3 | Every card stacks `backdrop-blur-xl` with a `blur-2xl` glow layer (`CalendarCard.tsx:71-77`), and every card is a Framer `layout` node. This is fine at Maya's 3 calendars; it costs more at 30. The embed iframe is lazy-loaded. Sync polls every 10 minutes and the server caches feeds. |
| 3 | Theming | 2 | Both themes render correctly. Colour is hard-coded throughout: an 8-entry hex gradient palette (`lib/calendars.ts:3-12`), seven raw Tailwind hues in `TypeBadge.tsx:5-13`, `rgba(148,163,184,0.6)` (`Calendars.tsx:324`), and `dark:ring-offset-[#12101f]` (`ColorSwatches.tsx:19`), which does not match the modal's `#13111f`. Violet is the selection, focus, link and drag colour. |
| 4 | Responsive Design | 2 | No horizontal scroll, and the grid goes 1→2→3 columns. On touch, drag-and-drop does not work and nothing replaces it. Card actions are 32×32, filter chips 26px tall and the Sync switch 36×20: below 44px, but passing WCAG 2.5.8 through spacing. The first calendar sits below the fold on phone. |
| 5 | Implementation Integrity | 2 | The privacy statement in `IcsHelp` is false. "Synced just now" ignores the server cache. "Open" on an `.ics` feed downloads a file. The calendar palette uses cyan (reserved for Atlas) and violet. Decorative glows are used throughout. |
| **Total** | | **11/20** | **Acceptable** |

### Detector findings

Counts by rule for the calendars screen (dark-desktop / dark-phone / light-desktop / light-phone):

| Rule | Counts | Verdict |
|------|--------|---------|
| `ai-color-palette` | 7 / 7 / 7 / 7 | **Mixed.** Real for this surface: the cyan gradient on the Pinned "Lecture timetable" tile (`span.flex.h-10`, Ocean = blue→cyan) and on its group card (stripe, tile and glow), which breaks the Atlas Colour Rule; the violet gradient on the "Office hours (Calendly)" card (Aurora); and `CalendarCard.tsx:52` (violet→blue drop line, source scan). Real but shared and already slated for removal: the logo `span.flex.h-9`, the avatar `span.flex.h-8`, `Switch.tsx:14`, `index.css:60,61,79` and the body-level "purple/violet accents". **False positive:** `span.absolute.inset-[18%]`, the Atlas orb's cyan core, which is intentionally cyan. |
| `gradient-text` | 2 / 1 / 2 / 1 | Real, shared, slated: the page `h1` (`PageHeader.tsx:8` → `index.css:58-61`) and the sidebar logo (desktop only). |
| `low-contrast` | 4 / 4 / 4 / 4 | **Real.** White on the `btn-primary` gradient's blue end is 3.9:1 ("Add calendar"). The "GROUP"/"TYPE" `faint` labels are 4.2:1 dark and 4.3:1 light, at 11px (`Calendars.tsx:231,246`). The search placeholder is 3.9:1 dark and **2.5:1 light**; the field has an `aria-label`, so this is a legibility problem rather than a strict 1.4.3 fail. The avatar's white "M" on pink (3.9:1) is in the shared top bar. |
| `dark-glow` | 3 / 3 / 0 / 0 | `btn-primary` violet glow: real, slated. `button.flex.h-12` (the capture FAB, `#4c1d95`): real, shared shell. `button.group.flex` (`#164e63`, the Atlas orb): **false positive**, Atlas's glow is cyan by design. The detector **misses** the per-card `blur-2xl` gradient glow (`CalendarCard.tsx:74-77`), because it is a blurred element, not a box-shadow; it shows in both themes. |
| `tiny-text` | 1 / 1 / 1 / 1 | Real: the 11px host line on cards (`CalendarCard.tsx:90`). The same 11px size is used by TypeBadge, the filter labels and the IcsHelp example. |
| `overused-font` | 1 / 1 / 1 / 1 | **False positive.** One Inter family is the documented choice for Operate surfaces (DESIGN.md, operate.md). |
| `straggler` | 0 / 1 / 0 / 1 | Real, P3: "dashboard." alone on the last line of the page description on phone. Shortening the description fixes it. |

The detector caught one thing my critique did not name directly: the 3.9:1 contrast of white text on the primary gradient. Things it cannot see, which this review found: the unnamed phone button, the 32px targets, drag-only reordering, nested headings in buttons, duplicate alerts, the false privacy copy and the misleading sync timestamp.

### Findings by severity

**[P1] False privacy statement about secret ICS addresses**
- **Location:** `src/components/calendars/IcsHelp.tsx:72-73` (shown on the page and inside the Add/Edit dialog); compare `src/hooks/data/calendars.ts:34` and `server/calendar/sync.ts` (`syncUserCalendars`).
- **Category:** Implementation Integrity
- **Impact:** Users are told the link stays in their browser, but it is stored in their account and read by the server. This breaks the "honest by default" and "your data is yours" commitments, at the moment of a security decision.
- **Recommendation:** Replace it with a true statement (wording in Critique, Priority Issue 1), and say how to remove the link.
- **Suggested command:** `/impeccable clarify`

**[P1] "Sync now" / "Synced just now" misreport freshness**
- **Location:** `src/components/calendars/SyncStatusPill.tsx:40,43`; `src/hooks/useCalendarSync.ts:63,66`; `server/calendar/sync.ts:8,28`; optimistic toasts at `src/pages/app/Calendars.tsx:111,114`.
- **Category:** Implementation Integrity
- **Impact:** The headline number on the page claims freshness the data does not have.
- **Recommendation:** Show the oldest per-feed `fetchedAt`. Either add a rate-limited `force` refresh or relabel the button "Check again" and explain the 10-minute cache. Fire the save toasts on success.
- **Suggested command:** `/impeccable clarify`

**[P1] Reordering and moving calendars has no keyboard or touch path**
- **Location:** `src/components/calendars/CalendarCard.tsx:53-71,79`; `src/pages/app/Calendars.tsx:308-320,347`
- **Category:** Accessibility / Responsive
- **Impact:** Phone and keyboard users cannot reorder, and can move a calendar to a group only through Edit → Group, which nothing on the page mentions.
- **WCAG:** 2.1.1 Keyboard (A), 2.5.7 Dragging Movements (AA)
- **Recommendation:** Add a "Move to group…" / "Move up" / "Move down" menu on each card. Change the empty-group copy so it stops telling touch users to drag.
- **Suggested command:** `/impeccable adapt`

**[P1] The "New group" button has no accessible name on phone**
- **Location:** `src/pages/app/Calendars.tsx:168-170`. The label is in `<span className="hidden sm:inline">`, so below 640px the button's name is empty (verified live: 50×38, name "").
- **Category:** Accessibility
- **Impact:** Screen readers announce "button". Sighted phone users get a bare folder-plus icon with no tooltip.
- **WCAG:** 4.1.2 Name, Role, Value (A)
- **Recommendation:** Add `aria-label="New group"` and `title="New group"` to the button. Better, keep the visible label on phone; the header row has room.
- **Suggested command:** `/impeccable harden`

**[P1] Text contrast below AA**
- **Location:** `src/index.css:78-80` (`btn-primary`: white on the gradient's `#447cf5` end, 3.9:1, on "Add calendar" in the header, empty state and dialog); `src/pages/app/Calendars.tsx:231,246` ("GROUP"/"TYPE", `faint` 11px, 4.2:1 dark and 4.3:1 light); `Calendars.tsx:326` (group counts, `faint text-xs`); the search placeholder (`index.css:69-72`, 2.5:1 light).
- **Category:** Accessibility
- **Impact:** Primary action and filter labels are hard to read in bright light, which is a common phone context.
- **WCAG:** 1.4.3 Contrast (Minimum) (AA)
- **Recommendation:** The confirmed direction already removes the gradient button: a near-white button with near-black text passes easily. Move `.faint` to `slate-400` in dark and `slate-600` in light, and use `placeholder:text-slate-500` in light.
- **Suggested command:** `/impeccable colorize`

**[P2] Framer Motion animations ignore `prefers-reduced-motion`**
- **Location:** `src/components/calendars/CalendarCard.tsx:45-50,133`, `src/components/calendars/CalendarModal.tsx:101-104`. There is no `MotionConfig reducedMotion="user"` anywhere in `src/`. The global CSS rule in `index.css:32-40` reaches only CSS transitions and animations.
- **Category:** Accessibility
- **Impact:** Card entrance rises, layout shifts during reorder and the 420px preview expansion still animate for users who asked for less motion. This contradicts PRODUCT.md's accessibility promise.
- **WCAG:** 2.3.3 Animation from Interactions (AAA), PRODUCT.md commitment
- **Recommendation:** Wrap the app in `<MotionConfig reducedMotion="user">`. Also remove the mount entrance (see Motion).
- **Suggested command:** `improve-animations`

**[P2] Group headings nested inside toggle buttons; filter chips have no pressed state**
- **Location:** `src/pages/app/Calendars.tsx:322-327` (`<h2>` inside `<button>`, 3 found live); `Calendars.tsx:232-254` (chips toggle without `aria-pressed`, live value `null`).
- **Category:** Accessibility
- **Impact:** Heading navigation can skip groups. The selected filter is shown by colour only.
- **WCAG:** 1.3.1 Info and Relationships (A), 4.1.2 (A)
- **Recommendation:** `<h2><button aria-expanded>…</button></h2>` (heading outside the button). Add `aria-pressed={groupFilter === g.id}` and so on to the chips.
- **Suggested command:** `/impeccable harden`

**[P2] Feed errors are announced twice**
- **Location:** `src/pages/app/Calendars.tsx:192` and `src/components/calendars/SyncToggle.tsx:33` are both `role="alert"`, and the pill (`SyncStatusPill.tsx:22-23`) is `aria-live` too.
- **Category:** Accessibility
- **Impact:** Each failed feed interrupts screen-reader users two or three times per sync, every 10 minutes.
- **Recommendation:** Keep one live region (the pill or the summary list). Make the per-card error a plain paragraph linked to the switch with `aria-describedby`.
- **Suggested command:** `/impeccable harden`

**[P2] Touch targets under 44px, with Delete next to Pin**
- **Location:** `src/components/calendars/CalendarCard.tsx:42,99-128` (`icon-btn h-8 w-8`, 32×32); `Calendars.tsx:329-339` (group header icons, 32×32); `Switch.tsx` (36×20); chips 26px tall (`index.css:133-135`).
- **Category:** Responsive
- **Impact:** Mis-taps on phone. Delete is 4px from Pin, with only an Undo toast as a safety net.
- **WCAG:** 2.5.8 passes through spacing; misses the 44px platform guideline.
- **Recommendation:** Move secondary actions into a ⋯ menu (fewer, bigger targets). Use 44px row targets on phone. Give the Switch a 44px hit area through padding or a label wrapper.
- **Suggested command:** `mobile-native`

**[P2] "Open" on an ICS feed downloads a file**
- **Location:** `src/components/calendars/CalendarCard.tsx:100-102` and the Pinned card link `src/pages/app/Calendars.tsx:285`. Maya's "Lecture timetable" is `…/calendar/ical/…/basic.ics`.
- **Category:** Implementation Integrity
- **Impact:** The page promises "open them in one click", but for feed links that click downloads a raw `.ics` file, or does nothing for `webcal:`.
- **Recommendation:** When `looksLikeFeed(url)`, replace "Open" with "View in Planner" (deep link to the Planner) and keep "Copy link".
- **Suggested command:** `/impeccable clarify`

**[P2] Decorative glows, gradients and cyan/violet in the calendar palette**
- **Location:** `src/components/calendars/CalendarCard.tsx:52,73-77,80`; `src/lib/calendars.ts:3-12` (Grape, Aurora violet; Ocean, Lagoon cyan); `TypeBadge.tsx:5-13`; `Switch.tsx:14`; `Calendars.tsx:319`; `ColorSwatches.tsx:18-19`.
- **Category:** Theming / Implementation Integrity
- **Impact:** Breaks the Atlas Colour Rule and the no-glow direction, and adds visual noise (see Critique, Priority Issue 4).
- **Recommendation:** Use solid single-value calendar colours without violet or cyan, remove the glow div and the shadowed tile, use a neutral TypeBadge, and a neutral drop indicator and switch.
- **Suggested command:** `/impeccable quieter`

**[P3] Hard-coded colour values outside tokens**
- **Location:** `src/components/calendars/ColorSwatches.tsx:19` (`ring-offset-violet-500/40`, `dark:ring-offset-[#12101f]`, which does not match the modal's `#13111f` in `Modal.tsx:63`); `src/pages/app/Calendars.tsx:324` (`rgba(148,163,184,0.6)`); `IcsHelp.tsx:63` (violet step numbers).
- **Category:** Theming
- **Impact:** The foundations pass will miss these when it swaps tokens.
- **Recommendation:** Route them through the new neutral tokens when the foundations land.
- **Suggested command:** `/impeccable polish`

**[P3] Card mount animation runs on every page load; the exit animation never plays**
- **Location:** `src/components/calendars/CalendarCard.tsx:45-49`. `initial={{opacity:0,y:12}}` fires for every card on every visit. `exit` is set, but `Calendars.tsx:350-375` does not wrap the list in `AnimatePresence`, so it is dead code.
- **Category:** Performance / Implementation Integrity
- **Impact:** A small page-load choreography on a "quick" surface, plus misleading code.
- **Recommendation:** Drop `initial` and `exit` and keep `layout` for reorder feedback. Add a short exit only if the list is wrapped in `AnimatePresence`.
- **Suggested command:** `remove-animations`

### Positive findings

- **Focus is handled well.** Every control on the page shows a visible 2px focus ring once the transition settles (verified live at both widths). `Modal` moves focus in, traps Tab, closes on Escape and returns focus (`Modal.tsx:21-50`).
- **Labelled icon buttons.** Card and group actions carry specific `aria-label`s ("Delete group University", "Add calendar to Ungrouped", "Copy link"), and the Sync switch is a real `role="switch"` with `aria-checked`.
- **Form semantics in the dialog.** `label`/`htmlFor` on every field, `aria-invalid`, `aria-describedby="cal-url-help"` on the URL, `noValidate` with custom inline messages, and `inputMode="url"`.
- **Undo for destructive actions.** Deleting a calendar or a group gives an Undo toast. Group delete moves calendars to Ungrouped rather than deleting them, and says so ("· 2 moved to Ungrouped").
- **Server safety.** The server reads feed URLs from the user's own rows, never from the request (`server/calendar/sync.ts`, `syncUserCalendars`). Feeds are capped at 25 and the window at 120 days, and failed fetches are cached for only 60 seconds.
- **Optimistic mutations with rollback** (`hooks/data/cache.ts`) keep pinning, sync toggles and reordering instant.

## Motion on this surface

| # | What | Where | Trigger | Duration / easing | Earns its place? |
|---|------|-------|---------|-------------------|------------------|
| 1 | Card entrance: fade in + 12px rise | `CalendarCard.tsx:47-48` | Mount (every page visit, every card) | Framer default tween (~0.3s) | **No.** Page-load choreography on an Operate surface; ignores reduced motion. Remove. |
| 2 | Card `layout` animation | `CalendarCard.tsx:46` | Reorder, move between groups, preview expand/collapse, filter changes | Framer default spring | **Yes, for drag-and-drop:** it shows where the card went. Gate with `MotionConfig reducedMotion="user"`. |
| 3 | Dragging card fades to 40% | `CalendarCard.tsx:48` | Drag start/end | Framer default | Yes. Shows what is being moved. |
| 4 | Card exit: fade + scale to 0.95 | `CalendarCard.tsx:49` | Delete (intended) | — | **Never runs.** No `AnimatePresence` parent. Dead code; remove it or wrap the list. |
| 5 | Corner glow brightens on hover (opacity 25%→50%) | `CalendarCard.tsx:74-77` | Hover | Tailwind `transition` 150ms | **No.** Decorative glow; remove along with the glow. |
| 6 | Card border tint on hover | `index.css:56-57` (`glass-hover`) | Hover | `transition-colors` 200ms | Yes, as a hover affordance, but the violet tint should become neutral. |
| 7 | Embed preview expands, height 0→420px | `CalendarCard.tsx:131-142` | Preview button | Framer default; animates `height` (a layout property), and the grid `col-span` changes instantly at the same time | **Marginal.** Expanding an iframe by height causes reflow and jank, and the col-span jump fights it. Use an instant reveal, or a short opacity fade, under 200ms. |
| 8 | URL error message height + opacity | `CalendarModal.tsx:99-118` | Validation error appears or clears | Framer default | Yes, lightly: it softens the layout shift. Fine, but gate on reduced motion. |
| 9 | Chevron rotation (help toggle, group collapse) | `Calendars.tsx:210,323` | Click | Tailwind `transition` 150ms | Yes. State feedback. |
| 10 | Spinners (`Loader2`, `RefreshCw`) | `SyncStatusPill.tsx:32,44`; `SyncToggle.tsx:17` | While syncing | `animate-spin` 1s linear | Yes. Real progress state. |
| 11 | Colour swatch hover scale to 110% | `ColorSwatches.tsx:18` | Hover | Tailwind `transition` 150ms | Weak. Decorative; a ring on hover is enough. |
| 12 | Switch knob slide | `Switch.tsx` (`transition-all` on `left`) | Toggle | 150ms | Yes, but it animates `left`. Use `transform: translateX` and `transition-transform`. |
| 13 | Button press scale to 0.97 | `index.css:74-76` (`.btn`) | Active/press | 150ms | Yes. Tactile press, in line with the direction. |
| 14 | Sync card fade-in | `Card.tsx:17` (`animate-fade-in`) | Mount | 250ms ease-out, 4px rise | No. Page-load fade; app-wide pattern slated with the foundations. |
| 15 | Modal fade-in, backdrop blur | `Modal.tsx:55,63` | Dialog open | 250ms ease-out | Acceptable. Could be 150–200ms for "quick". |

## Machine-readable summary

```json
{"surface":"calendars","critique_total":25,"critique_max":40,"na_heuristics":[],"audit_total":11,
 "issues":[
  {"id":"calendars-1","severity":"P1","title":"ICS help falsely says secret calendar addresses stay in the browser","fix":"Replace IcsHelp privacy line with a true statement: the link is saved in the user's account (RLS), fetched by the sync server, cached in memory up to 10 minutes, removed when the calendar is deleted","command":"/impeccable clarify","files":["src/components/calendars/IcsHelp.tsx:72","src/hooks/data/calendars.ts:34","server/calendar/sync.ts:28"],"source":"critique"},
  {"id":"calendars-2","severity":"P1","title":"'Sync now' hits the 10-minute server cache while the pill says 'Synced just now'","fix":"Drive the pill from the oldest per-feed fetchedAt; add a rate-limited force refresh or relabel to 'Check again' with a cache note; fire add/update toasts on success","command":"/impeccable clarify","files":["src/components/calendars/SyncStatusPill.tsx:40","src/hooks/useCalendarSync.ts:63","server/calendar/sync.ts:28","src/pages/app/Calendars.tsx:111"],"source":"critique"},
  {"id":"calendars-3","severity":"P1","title":"Reorder and move-to-group are drag-only (no touch or keyboard path); empty group tells phone users to drag","fix":"Add a per-card 'Move to group / Move up / Move down' menu; keep drag as mouse shortcut; rewrite empty-group copy","command":"/impeccable adapt","files":["src/components/calendars/CalendarCard.tsx:53","src/components/calendars/CalendarCard.tsx:79","src/pages/app/Calendars.tsx:347"],"source":"both"},
  {"id":"calendars-4","severity":"P1","title":"Phone 'New group' header button has no accessible name","fix":"Add aria-label and title 'New group', or keep the visible label on phone","command":"/impeccable harden","files":["src/pages/app/Calendars.tsx:168"],"source":"audit"},
  {"id":"calendars-5","severity":"P1","title":"Text contrast below AA: primary gradient button 3.9:1, GROUP/TYPE labels 4.2-4.3:1, group counts, light search placeholder 2.5:1","fix":"Neutral near-white primary button with dark text; .faint to slate-400 dark / slate-600 light; light placeholder slate-500","command":"/impeccable colorize","files":["src/index.css:78","src/pages/app/Calendars.tsx:231","src/pages/app/Calendars.tsx:246","src/pages/app/Calendars.tsx:326"],"source":"audit"},
  {"id":"calendars-6","severity":"P2","title":"Decorative glows, gradients and cyan/violet calendar colours break the Atlas Colour Rule and no-glow direction","fix":"Solid single-value calendar colours without violet or cyan; remove card glow div and tile shadow; neutral TypeBadge; neutral 2px drop line and switch","command":"/impeccable quieter","files":["src/components/calendars/CalendarCard.tsx:52","src/components/calendars/CalendarCard.tsx:74","src/lib/calendars.ts:3","src/components/calendars/TypeBadge.tsx:5","src/components/ui/Switch.tsx:14"],"source":"both"},
  {"id":"calendars-7","severity":"P2","title":"Seven actions per card and search/filters/sync card push calendars below the fold on phone","fix":"Open as primary + Sync switch; Copy/Edit/Pin/Move/Delete into a single overflow menu; show search and filters only past ~8 calendars or 2 groups; compact sync status on phone","command":"/impeccable distill","files":["src/components/calendars/CalendarCard.tsx:99","src/pages/app/Calendars.tsx:178","src/pages/app/Calendars.tsx:219"],"source":"critique"},
  {"id":"calendars-8","severity":"P2","title":"Add calendar dialog asks for Name before URL and its placeholder suggests a non-syncing Google embed link","fix":"URL first with an ICS-shaped placeholder, prefill name from detected type/host, collapse emoji and colour under 'Appearance', plain submit label","command":"/impeccable clarify","files":["src/components/calendars/CalendarModal.tsx:69","src/components/calendars/CalendarModal.tsx:91","src/components/calendars/CalendarModal.tsx:151"],"source":"critique"},
  {"id":"calendars-9","severity":"P2","title":"Framer Motion animations ignore prefers-reduced-motion","fix":"Wrap app in MotionConfig reducedMotion='user'; drop the card mount entrance","command":"improve-animations","files":["src/components/calendars/CalendarCard.tsx:45","src/components/calendars/CalendarCard.tsx:133","src/components/calendars/CalendarModal.tsx:101"],"source":"audit"},
  {"id":"calendars-10","severity":"P2","title":"Group h2 nested inside toggle button; filter chips lack aria-pressed","fix":"Put the button inside the h2; add aria-pressed to group and type chips","command":"/impeccable harden","files":["src/pages/app/Calendars.tsx:322","src/pages/app/Calendars.tsx:232"],"source":"audit"},
  {"id":"calendars-11","severity":"P2","title":"Feed errors announced twice (summary list and per-card both role=alert)","fix":"Keep one live region; make per-card error a described-by paragraph","command":"/impeccable harden","files":["src/pages/app/Calendars.tsx:192","src/components/calendars/SyncToggle.tsx:33"],"source":"audit"},
  {"id":"calendars-12","severity":"P2","title":"Touch targets 32px (card and group actions), 26px chips, 36x20 switch; Delete adjacent to Pin","fix":"Overflow menu with 44px rows on phone; 44px hit area for Switch and chips","command":"mobile-native","files":["src/components/calendars/CalendarCard.tsx:42","src/pages/app/Calendars.tsx:329","src/components/ui/Switch.tsx:14"],"source":"both"},
  {"id":"calendars-13","severity":"P2","title":"'Open' on an ICS feed link downloads a raw .ics file","fix":"For feed URLs replace Open with 'View in Planner' and keep Copy link","command":"/impeccable clarify","files":["src/components/calendars/CalendarCard.tsx:100","src/pages/app/Calendars.tsx:285"],"source":"audit"},
  {"id":"calendars-14","severity":"P3","title":"Hard-coded colours outside tokens (swatch ring offset #12101f vs modal #13111f, raw rgba, violet step numbers)","fix":"Route through neutral tokens in the foundations pass","command":"/impeccable polish","files":["src/components/calendars/ColorSwatches.tsx:19","src/pages/app/Calendars.tsx:324","src/components/calendars/IcsHelp.tsx:63"],"source":"audit"},
  {"id":"calendars-15","severity":"P3","title":"Card mount entrance on every visit; exit animation is dead code (no AnimatePresence)","fix":"Remove initial and exit, keep layout for reorder feedback","command":"remove-animations","files":["src/components/calendars/CalendarCard.tsx:45"],"source":"audit"}
 ]}
```
