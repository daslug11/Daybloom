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

