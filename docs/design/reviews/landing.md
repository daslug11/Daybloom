# Landing (public site: landing, Terms, Privacy, 404): critique & audit (Phase 1 baseline)

Method: design review (sub-agent, screenshots + source + live app) → then detector evidence (Phase 0 CDP scans, both themes, desktop + phone)

Mode: **Persuade** for `/` (landing); **Read** for `/terms` and `/privacy`; the 404 is a recovery page. Evidence: `test-results/visual/phase0-before/{dark,light}-{desktop,phone}/{landing,terms,privacy,not-found}.jpg`; source listed per finding; live probes with Playwright against `http://localhost:5173` (logged out, fresh browser) at 390×844 and 1440×900. The critique below was written before the detector JSON was opened.

## Critique

### Design Health Score

Scored for the landing page as the primary surface; the legal pages and 404 feed heuristics 4, 9 and 10.

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Sticky header and clear FAQ open state (`+` rotates). No "you are here" in the header on Terms/Privacy, and nothing marks the previews as example data. |
| 2 | Match System / Real World | 3 | Copy is plain and honest. But the sample content is office-worker life ("Send the quarterly report", "Team sync", "Work calendar", "Renew car insurance") for an audience of students, and the FAQ leans on "iCal (ICS) address". |
| 3 | User Control and Freedom | 3 | Log in is always one click away, FAQ items collapse, 404 offers a way back. Phone loses the Features/FAQ jump links (`PublicLayout.tsx:13,16`, `hidden sm:inline`). |
| 4 | Consistency and Standards | 2 | Public header ignores auth state, so a signed-in user on the 404 sees "Log in / Sign up free" above "Back to your dashboard". Terms numbers its headings, Privacy doesn't. FAQ says the site-wide AI cap pauses "until the next day"; Terms says "when our monthly budget is reached". The whole page is on the violet/gradient system the owner has already rejected. |
| 5 | Error Prevention | n/a | No inputs, forms or destructive actions on these four pages. |
| 6 | Recognition Rather Than Recall | 3 | Real app components as previews make features recognisable. Each feature is introduced by a tiny violet eyebrow + h2, which works. |
| 7 | Flexibility and Efficiency | n/a | Persuade surface; no repeat-use workflow (allowed by critique.md mode rule). |
| 8 | Aesthetic and Minimalist Design | 2 | Gradient headline, gradient logo, gradient glowing buttons, background colour washes, seven equal-weight zig-zag sections; Brain Dump (the heart) gets the same weight as Calendars. Several previews float in large empty half-columns (habit grid uses ~35% of its card). |
| 9 | Error Recovery | 3 | 404 is honest ("That link doesn't go anywhere in Daybloom.") and auth-aware in its button. No search/jump or "report a broken link", which is fine at this scale. |
| 10 | Help and Documentation | 3 | FAQ answers the real objections (price, AI limit, data, calendars, voice browsers, phone). It never states the size of the daily AI allowance. |
| **Total** | | **22/32** | **Acceptable (69%)** |

### Design Specificity Verdict

**LLM assessment:** Half authored, half template. The *content* is specific and honest in a way most landing pages are not: previews are the real `NoteCard`, `TaskItem`, `HabitCard`, `GoalCard`, `TimerView` and `SyncRow` components fed with sample data (`Landing.tsx:17-62`), the copy names real mechanics ("Press N anywhere", "15-minute steps", "Each Atlas reply uses one from your daily ✨ allowance"), and there are no invented user counts, testimonials or logos. That honesty is the product's character and it shows.

The *structure and styling* are category-interchangeable: centred hero with gradient-text second clause and two pill buttons → seven alternating text/preview rows with uppercase eyebrows → three numbered "How it works" cards → FAQ accordion → "Ready to…?" CTA. Swap the screenshots and this is any 2023 productivity SaaS page. The violet→blue→pink gradient (headline, logo tile, wordmark, buttons, progress bar, timer ring, sync switch) plus violet/blue/pink body glows (`index.css:23-26`) is exactly the "AI purple" look the owner has moved away from.

**Missed opportunities for product character:**
- The hero never shows the one thing that makes Daybloom different: capture without deciding. A hero that *is* the capture bar (a thought typed in, landing in the Inbox) would be specific; a text-only hero is not.
- The voice HUD, the single permitted showpiece, appears only as an inline `Mic` icon and a sentence (`Landing.tsx:252-253`). The one surface allowed to be bold is invisible on the page meant to persuade.
- The audience (students, young adults) is never named and never reflected: no lecture, deadline, assignment or shift in any sample.

### What's Working

1. **Honest previews from real components.** `Feature` wraps the actual app components in a `role="img"` region with `pointer-events-none` (`Landing.tsx:72-76`), so the page cannot drift from the product, and the numbers in the review preview each carry their method ("16 of 21 habit-days", "From finished blocks"), which models the "honest numbers" commitment on the marketing page itself.
2. **Copy that answers objections plainly.** The reassurance line under the CTA ("Free. No card needed. Export or delete your data any time.", `Landing.tsx:122`) and the FAQ entries on AI limits and data (`Landing.tsx:84-98`) say exactly what happens, including the limits. No vague marketing words anywhere.
3. **Legal pages that are readable and self-aware.** Plain-English Terms/Privacy, single column at `max-w-3xl`, clear h2s, and an explicit amber "Placeholder — review before launch" note (`PublicLayout.tsx:68-71`) rather than pretending to be final. The 404 button text switches between "Back to your dashboard" and "Go to the home page" by auth state (`NotFound.tsx:15-17`).

### Priority Issues

**[P1] The phone landing page scrolls sideways (25px horizontal overflow).**
- *Why it matters:* At 390px the document is 415px wide (live probe: `scrollWidth 415`, `clientWidth 390`; the phone screenshots are 830px wide instead of 780px). The Calendars preview card is 399px wide inside a 358px column, so on a phone the whole page wobbles horizontally and the card's right edge and the "14 events · just now" status are cut off. Casey's first impression of a product that promises "works as well on a phone" is a broken layout.
- *Cause:* The `Feature` section is a CSS grid with no explicit single column below `md` (`Landing.tsx:66`), so the implicit `auto` track sizes to the min-content of the Calendars preview (the `whitespace-nowrap` `TypeBadge` + "Work calendar" row, `Landing.tsx:183-193`), and grid items keep `min-width: auto`.
- *Fix:* Add `grid-cols-1` (and keep `md:grid-cols-2`) on the `Feature` section, and `min-w-0` on both grid children. Let the `TypeBadge` wrap under the title below `sm`.
- *Suggested command:* `/impeccable adapt`

**[P1] Thirteen focusable buttons hide inside `aria-hidden` previews.**
- *Why it matters:* The previews are `aria-hidden` and `pointer-events-none`, but the real components inside still render `<button>`s: task checkboxes and "Open task" buttons, the habit toggle, the sync switch, the timer's Focus/Break tabs and Reset/Pause/Skip (live probe lists all 13). Keyboard users tab through 13 invisible-to-screen-reader stops that do nothing before reaching "How it works"; screen reader users land on focus with nothing announced. This fails WCAG 4.1.2 (aria-hidden must not contain focusable content) and makes keyboard travel through the page twice as long (31 focus stops, 13 of them dead).
- *Fix:* Put `inert` on the preview wrapper (`Landing.tsx:73`) instead of (or alongside) `aria-hidden` + `pointer-events-none`; `inert` removes focus, pointer and AT access in one attribute. Keep `role="img"` + `aria-label` on the outer div, and make the label describe the picture ("Example inbox note with a checklist") rather than "Brain Dump preview".
- *Suggested command:* `/impeccable harden`

**[P1] The landing is the clearest expression of the rejected violet/gradient system.**
- *Why it matters:* The confirmed direction is neutral near-white emphasis, cyan only for Atlas, untinted near-black, no glows. The landing is the first thing anyone sees and it carries every retired trait at once: gradient text on the hero's "Get it done." (`Landing.tsx:109`), gradient wordmark and gradient logo tile (`Logo.tsx:6,9`), gradient primary buttons with a violet glow (`index.css:78-81`) used three times, violet eyebrows (`Landing.tsx:68`), violet step numbers (`Landing.tsx:268`), a violet planner block and a violet user bubble in the Atlas chat (`Landing.tsx:156,236`), violet habit grid, gradient goal bar and timer ring, and three colour washes behind everything (`index.css:23-26`). Beyond direction, it also costs contrast: white text on the blue end of the CTA gradient is 3.68:1 (see Audit).
- *Fix:* When the foundations land, the landing should be the first surface converted: solid near-white (dark) / near-black (light) primary button with no glow; hero headline in one solid colour (use weight or a line break for "Get it done.", not a gradient); eyebrows in neutral muted ink; step numbers as neutral outlined numerals; planner block and user bubble in neutral fills; keep cyan only on the orb and the "What Atlas did" chips (already correct, `Landing.tsx:242-243`). The 🌸 mark can sit on a solid neutral tile.
- *Suggested command:* `/impeccable quieter` then `/impeccable colorize` (for the neutral emphasis + Atlas-only cyan pass)

**[P2] Seven equal-weight feature rows bury the Brain Dump and hide the showpiece.**
- *Why it matters:* PRODUCT.md positions Daybloom as "Brain Dump first", but the page gives Brain Dump, Tasks, Habits, Goals, Calendars, Focus, Mood/Review and Atlas the same template and the same visual weight. Jordan reads a feature catalogue, not a point of view, and the only thing allowed to be bold (voice mode) never appears. The hero has no visual at all, so the first screen on a phone is 100% text (dark-phone landing, first 520px).
- *Fix:* Make the hero demonstrate capture: a large, static-but-real capture bar with a typed thought and the resulting Inbox note beneath it (reuse `NoteCard`). Give Brain Dump + Process inbox a full-width section of its own. Collapse Habits, Goals, Focus, Calendars and Review into one compact "and the rest" grid of small previews. Give Atlas a section that shows a still of the voice HUD (near-black, cyan orb) as the page's one dramatic moment.
- *Suggested command:* `/impeccable layout`

**[P2] Sample content speaks to office workers, not students.**
- *Why it matters:* The primary users are students and young adults. Every sample is from a desk job: "Send the quarterly report" (appears three times: task, planner block, timer, `Landing.tsx:52,156,200`), "Team sync", "Work calendar 💼", "Renew car insurance". Even the quick-add example is "Send report friday 3pm !high #work" (`Landing.tsx:163`). A student scanning the page doesn't see their life in it, and the hero calls it a "personal organiser" without saying who for.
- *Fix:* Re-cast the samples: "Finish lab report", "Psych 101 lecture · from your calendar", "Uni timetable" calendar, "Shift at the café", quick-add "essay draft fri 5pm !high #history". Add the audience to the hero sub-line ("for classes, deadlines, side projects and new routines").
- *Suggested command:* `/impeccable clarify`

**[P2] Public legal pages are visibly unfinished and the public header ignores sign-in.**
- *Why it matters:* `/terms` and `/privacy` ship to the public with "[COMPANY / YOUR NAME]", "[DATE]", "[16]", "[REGION]", "[X] days" and an all-caps "[LIMITATION OF LIABILITY CLAUSE…]" (`Terms.tsx:6,8,13,40,44`; `Privacy.tsx:7,19,25,44,47`). The placeholder banner is honest, but for a product whose pitch is "your data is yours", a privacy policy that can't say where data is stored is a trust gap at exactly the moment someone checks. Separately, `PublicHeader` (`PublicLayout.tsx:5-29`) always shows "Log in / Sign up free", so a signed-in user who hits a 404 or opens Terms sees sign-up prompts.
- *Fix:* Content: fill the brackets (owner task, not design). Design: until they are filled, render bracketed tokens with a visible "to be completed" style so the page reads as a draft on purpose; give Privacy numbered headings like Terms. Make `PublicHeader` auth-aware (show "Open Daybloom" when signed in).
- *Suggested command:* `/impeccable clarify` (copy) and `/impeccable harden` (auth-aware header)

### Persona Red Flags

**Jordan (first-timer, a student who heard about it from a friend):** The hero is a 3-line paragraph with "Brain Dump" and "Atlas" introduced as proper nouns before anything shows what they look like. The first visual is ~650px down on desktop and below the fold on a phone. Every example is about quarterly reports and car insurance, so Jordan concludes "this is for working adults". The ✨ sign appears 11 times in feature copy before the FAQ explains that ✨ means limited AI uses.

**Riley (stress tester, checking the honesty claims):** Opens Privacy to see where data is stored and finds "[REGION]"; opens Terms and finds "[LIMITATION OF LIABILITY CLAUSE…]". Notes that FAQ and Terms describe the site-wide AI pause differently (next day vs monthly budget). Notices the review preview's numbers ("18 tasks", "76%", "3.9/5") are not labelled as example data. Tabs through the page and hits 13 silent focus stops in the previews.

**Casey (phone, one-handed, between lectures):** The page scrolls sideways by 25px. The Features/FAQ links are hidden below `sm`, so there's no way to jump to the FAQ. FAQ rows look like 56px cards but only the 24px-tall `<summary>` line responds to a tap; the padding around it is dead (`Landing.tsx:281-282`). The final CTA is fine (48px tall), but the header "Sign up free" and "Log in" are 36px tall, under the 44px comfort size.

### Cognitive Load

Checklist failures (3 of 8, **moderate**):
- **Visual hierarchy:** fails. Every feature row has the same eyebrow + 30px h2 + 2-3 paragraphs + preview weight; the product's core loop is not visually privileged over secondary features.
- **Chunking:** fails. Seven feature sections plus three steps plus six FAQ entries is a long, flat list; the seven features are not grouped (core loop vs. supporting tools vs. assistant).
- **Progressive disclosure:** fails. Every feature paragraph also lists its ✨ AI actions (9 named AI actions across the page) before the reader knows what the base feature is.

Passes: single focus (one CTA pair), grouping within sections, one thing at a time, working memory, minimal choices at each decision point.

Decision points with >4 options: none. The header has 4 (Features, FAQ, Log in, Sign up) on desktop and 2 on phone; the hero has 2.

### Minor Observations

- The `Feature` region label is `"${eyebrow} preview"` (`Landing.tsx:72`), e.g. "Tasks & Planner preview", which tells a screen reader user nothing about what's in the picture.
- The habit preview fills only the left third of its card at desktop; the 12-week grid at `h-3.5 w-3.5` looks lost in a 527px card (dark-desktop landing, Habits row).
- The Focus timer preview is centred in its half while every other preview fills it, so the zig-zag rhythm breaks there.
- "Anything else, Alex?" in the Atlas sample: fine, but this name is also the critique persona and the other samples use Sam and Jo; harmless.
- `GoalCard` heading reads "Read 24 books 📚 – 38%": emoji in the middle of the title plus an en dash before the percentage; the percentage is violet (`GoalCard.tsx:38`).
- The "+" FAQ indicator is a text glyph at 16px in faint grey; it's small and low-contrast as the only affordance that the rows open.
- Hero sub-line runs ~80 characters per line at desktop; fine, but `max-w-2xl` at 18px is at the upper limit.
- Legal pages: `max-w-3xl` at 15px gives ~90 characters per line, longer than the 65-75ch reading measure for Read mode.
- `index.html` title is "Daybloom ✨" on every route; Terms, Privacy and the 404 have no page-specific title (see Audit).
- On the 404, the footer sits at the bottom with ~450px of empty space above it on desktop; acceptable, but a "popular places" list (Brain Dump, Tasks, Planner for signed-in users) would use it.

## Audit

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | 13 focusable buttons inside `aria-hidden` previews (WCAG 4.1.2); primary CTA white-on-gradient 3.7–4.2:1 and `.faint` text 3.9–4.3:1 (WCAG 1.4.3); every public route titled "Daybloom ✨" (WCAG 2.4.2). Focus ring is visible (violet 2px ring with offset, verified live). |
| 2 | Performance | 3 | Route is lazy-loaded and has no images. Costs: sticky header `backdrop-blur-xl` over a scrolling page, `background-attachment: fixed` with three radial gradients (repaint on scroll), six Inter weights loaded (400–900; 900 unused here), `animate-fade-in` on every `Card` at mount. |
| 3 | Theming | 2 | Both themes render completely, but there are no semantic tokens: violet literals everywhere (`text-violet-600 dark:text-violet-300`, `bg-violet-600`), a hard-coded `dark:bg-[#08070f]/80` in the header (`PublicLayout.tsx:7`), hard-coded ring gradient hexes (`ProgressRing.tsx:19-21`). Switching to the neutral direction requires touching every file rather than a token. |
| 4 | Responsive Design | 2 | 25px horizontal overflow at 390px (Calendars preview). FAQ rows respond only on their 24px `<summary>` line. Header buttons 36px tall. Otherwise the single-column collapse is clean. |
| 5 | Implementation Integrity | 2 | Coherent honest content, but several verified issues: the retired gradient/violet system throughout, a CSS specificity bug that silently cancels legal-page heading spacing, template "kicker above heading" ×8, public placeholder legal copy, auth-unaware public header. |
| **Total** | | **11/20** | **Acceptable** |

**Implementation Integrity verdict: Fail (narrowly).** The content layer is product-specific and honest (real components, no fabricated proof), but the visual layer is the generic violet-gradient SaaS kit the owner has rejected, and two structural bugs (overflow, focus-in-hidden) ship on the most public page.

### Detector findings (counts by rule for this surface, what's real vs false positive)

296 findings across 16 page scans (4 screens × dark/light × desktop/phone), plus the shared source scan.

| Rule | Count | Verdict |
|------|------:|---------|
| heading-rhythm | 58 | **Real.** Legal h2s get 16px above and 16px below. Root cause verified live: `space-y-4` on `.legal` (`PublicLayout.tsx:74`) has higher specificity (`.space-y-4 > :not([hidden]) ~ :not([hidden])`) than the `[&_h2]:mt-8` variant, so the intended 32px top margin never applies (computed `margin-top: 16px`). |
| ai-color-palette | 52 | **Real, already slated for removal.** Fires on the gradient logo tile (`Logo.tsx:6`), `gradient-text` (`index.css:60-61`), `btn-primary` (`index.css:79`), the goal bar (`GoalCard.tsx:52`), the sync switch (`Switch.tsx:14`) and the body-level violet accent. It does **not** fire on any Atlas cyan on this surface (orb, "What Atlas did" chips), so no Atlas false positives here. |
| gradient-text | 36 | **Real, slated.** Hero "Get it done." (`Landing.tsx:109`) and the wordmark (`Logo.tsx:9`, header + footer on every page). Violates the No-Ornament Type Rule. |
| low-contrast | 36 | **Real.** (a) White text on the blue end of `btn-primary`: 3.8–3.9:1 for header "Sign up free" and the 404 button, 4.2:1 for the hero/footer CTAs; my own calc for pure `#3b82f6` is 3.68:1. On every public page. (b) `.faint` (`slate-500`) at 4.2:1 on the dark page, 4.3:1 on the light page, 3.9:1 on dark cards: hero reassurance line (`Landing.tsx:122`), note timestamp and checklist count in the `NoteCard` preview. |
| kicker-above-heading | 32 | **Real but low impact.** Eight identical uppercase violet eyebrows above eight h2s (`Landing.tsx:68`): a template tell that reinforces the equal-weight catalogue structure (critique P2). Fold into the layout rework rather than fix alone. |
| straggler | 22 | **Real, P3.** Single-word last lines ("calculated.", "yet.", "time.", "from.", "steps.", "diagnosis."). Fix globally with `text-wrap: pretty` on body copy. |
| dark-glow | 16 | **Real, slated.** Violet glow on every `btn-primary` (`index.css:80`) and the timer play button (`TimerDisplay.tsx:52`, `shadow-violet-900/30`). |
| line-length | 16 | **Real (Read mode).** Legal paragraphs run 95–103 characters per line at desktop (`max-w-3xl` at 15px, `PublicLayout.tsx:67`). Also confirms the critique's measure note. |
| overused-font | 12 | **False positive by design.** Inter for 100% of text is the documented system choice (DESIGN.md: one sans family outside the HUD). Not a defect; a display face on the landing would be a direction change, not a fix. |
| unbalanced-heading | 10 | **Real, P3; one is worth fixing.** The hero h1 breaks as "Get it out of your head. Get / it done." at 1440px, splitting the payoff phrase across lines (visible in dark-desktop landing). `text-wrap: balance` or a deliberate break before "Get it done." fixes it. Others (Brain Dump, Goals, Atlas h2s) are cosmetic. |
| repeating-stripes-gradient | 4 | **False positive.** It's `.striped` on the locked calendar event in the Planner preview (`index.css:144-152`, `Landing.tsx:153`): stripes mean "locked, from your calendar", which is meaning, not decoration. |
| body-text-viewport-edge | 2 | **Real, and the detector's view of the P1 overflow.** On phone, the Calendars paragraph's right edge reaches the viewport edge because the whole grid column was widened to 399px by the preview card (live probe: `#calendars` `scrollWidth 415`). |

Source scan (`src_scan_all`) hits relevant to this surface: `Logo.tsx:6`, `GoalCard.tsx:52`, `Switch.tsx:14`, `index.css:60,61,79`. The other hits (VoiceHud grid, Planner, CalendarCard, TopBar) belong to other surfaces.

**Caught by review, missed by the detector:** focusable controls in `aria-hidden` previews; missing per-route `<title>` and meta description; auth-unaware public header; FAQ tap target; placeholder legal content; student-audience mismatch in samples.

### Findings by severity

**[P1] Horizontal overflow on phone (Calendars preview)**
- Location: `src/pages/public/Landing.tsx:66` (grid without `grid-cols-1`), `src/pages/public/Landing.tsx:183-193` (Calendars preview), `src/components/calendars/TypeBadge.tsx:18` (`whitespace-nowrap`)
- Category: Responsive
- Impact: Page scrolls sideways by 25px at 390px; the card's right edge and sync status are clipped.
- WCAG: 1.4.10 Reflow (content requires two-dimensional scrolling at 320 CSS px equivalent)
- Recommendation: `grid-cols-1 md:grid-cols-2` on the `Feature` section and `min-w-0` on both children; let the badge wrap below `sm`.
- Suggested command: `/impeccable adapt`

**[P1] Focusable buttons inside `aria-hidden` previews**
- Location: `src/pages/public/Landing.tsx:72-76` (wrapper), rendering buttons from `TaskItem.tsx:27-37`, `HabitCard.tsx:26-36`, `Switch.tsx:5-19`, `TimerDisplay.tsx:25-59`
- Category: Accessibility
- Impact: 13 dead Tab stops (of 31 on the page) with nothing announced; keyboard users must tab through fake controls.
- WCAG: 4.1.2 Name, Role, Value; 2.4.3 Focus Order
- Recommendation: `inert` on the preview wrapper; descriptive `aria-label` on the `role="img"` container.
- Suggested command: `/impeccable harden`

**[P1] Primary CTA and faint text fail AA contrast**
- Location: `src/index.css:78-81` (`btn-primary` gradient ends at `blue-500`), `src/index.css:66-68` (`.faint` = `slate-500` both themes), `src/pages/public/Landing.tsx:122`, `src/components/notes/NoteCard.tsx:93-101`
- Category: Accessibility
- Impact: "Sign up free" (the conversion action, on every public page) is 3.7–4.2:1; the reassurance line "Free. No card needed…" is 4.2–4.3:1.
- WCAG: 1.4.3 Contrast (Minimum)
- Recommendation: The neutral solid primary button in the foundations phase resolves the CTA. Raise `.faint` to `slate-600` (light) / `slate-400` (dark), or reserve `.faint` for non-essential text ≥18px.
- Suggested command: `/impeccable colorize`

**[P1] Retired violet/gradient system on the most public surface**
- Location: `src/components/layout/Logo.tsx:6,9`; `src/pages/public/Landing.tsx:68,109,156,236,268`; `src/index.css:23-26,59-62,78-81`; `src/components/goals/GoalCard.tsx:52`; `src/components/ui/ProgressRing.tsx:18-22`; `src/components/ui/Switch.tsx:14`; `src/components/habits/ContributionGrid.tsx:4-10`
- Category: Implementation Integrity / Theming
- Impact: First impression contradicts the confirmed "Clear Head" direction; decorative colour everywhere breaks the Meaning-Only Rule.
- Recommendation: Convert with the foundations: neutral near-white emphasis, untinted background with no washes, solid headline, Atlas-only cyan.
- Suggested command: `/impeccable quieter`

**[P2] Legal heading spacing silently overridden; long measure**
- Location: `src/pages/public/PublicLayout.tsx:74` (`space-y-4` beats `[&_h2]:mt-8`), `PublicLayout.tsx:67` (`max-w-3xl`)
- Category: Implementation Integrity
- Impact: Section headings sit as close to the paragraph above as to their own (16/16px), so the Terms and Privacy read as one undivided block; lines run ~100 characters.
- Recommendation: Use `[&_h2]:!mt-8` or drop `space-y-4` for `[&>*+*]:mt-4` with `[&>h2]:mt-8`; cap the article at `max-w-[68ch]`.
- Suggested command: `/impeccable typeset`

**[P2] No per-route page titles or meta description**
- Location: `index.html:10` (only `<title>Daybloom ✨</title>`, no `<meta name="description">`); no `document.title` set in `Landing.tsx`, `Terms.tsx`, `Privacy.tsx`, `NotFound.tsx` (verified live: all four report "Daybloom ✨")
- Category: Accessibility / Implementation Integrity
- Impact: Screen reader and tab users can't tell Terms from Privacy from a 404; search results and link previews have no description for the one page meant to persuade.
- WCAG: 2.4.2 Page Titled
- Recommendation: Titles like "Daybloom: capture first, organise later", "Terms of Service · Daybloom", "Privacy Policy · Daybloom", "Page not found · Daybloom"; add a plain meta description from the hero sub-line.
- Suggested command: `/impeccable harden`

**[P2] Public header ignores sign-in**
- Location: `src/pages/public/PublicLayout.tsx:5-29`
- Category: Implementation Integrity
- Impact: Signed-in users on the 404, Terms or Privacy see "Log in / Sign up free", contradicting the 404 body's "Back to your dashboard" (`NotFound.tsx:15-17`).
- Recommendation: Read `useAuth()` in `PublicHeader`; when signed in show one "Open Daybloom" button to `/app`.
- Suggested command: `/impeccable harden`

**[P2] FAQ rows only respond on the 24px summary line; small header targets**
- Location: `src/pages/public/Landing.tsx:281-282` (`p-4` on `<details>`, not on `<summary>`), `src/pages/public/PublicLayout.tsx:19-24` (36px header targets)
- Category: Responsive
- Impact: The card looks like a 56px tap target but the padding is dead; header "Log in" / "Sign up free" are 36px tall, under the 44px comfort size (they pass WCAG 2.5.8's 24px minimum).
- Recommendation: Move padding to `<summary>` (`block p-4`) and the answer's padding to its own div; header buttons `min-h-11` on phones.
- Suggested command: `mobile-native`

**[P2] Seven equal-weight feature rows; no hero visual; voice HUD absent** (critique)
- Location: `src/pages/public/Landing.tsx:64-79,107-256`
- Category: Implementation Integrity (structure)
- Impact: Brain Dump isn't privileged; the showpiece is missing; template eyebrows ×8.
- Recommendation: See critique P2. Hero = capture demo; one full-width Brain Dump section; compact grid for supporting tools; a voice HUD still for Atlas.
- Suggested command: `/impeccable layout`

**[P2] Office-worker sample content for a student audience** (critique)
- Location: `src/pages/public/Landing.tsx:52-56,154,163,187,200`
- Category: Implementation Integrity (content)
- Recommendation: Student-life samples; name the audience in the hero sub-line.
- Suggested command: `/impeccable clarify`

**[P2] Placeholder legal text is public** (critique)
- Location: `src/pages/public/Terms.tsx:6,8,13,40,44`; `src/pages/public/Privacy.tsx:7,19,25,44,47`
- Category: Implementation Integrity (content)
- Recommendation: Owner fills the brackets; meanwhile style unfilled tokens as visibly pending; number Privacy's headings to match Terms.
- Suggested command: `/impeccable clarify`

**[P3] Hero headline splits "Get / it done."; stragglers in body copy**
- Location: `src/pages/public/Landing.tsx:108-110`; body copy throughout
- Category: Implementation Integrity (typography)
- Recommendation: `text-wrap: balance` on h1/h2 and `text-wrap: pretty` on paragraphs; or force the break before "Get it done." from `sm` up.
- Suggested command: `/impeccable typeset`

**[P3] Mount animations and `transition-all` on static previews**
- Location: `src/components/ui/Card.tsx:16` (`animate-fade-in` on 9 landing cards), `src/components/ui/Switch.tsx:17` (`transition-all`)
- Category: Performance
- Recommendation: Don't animate cards on the landing (pass a `static` prop or render `.glass` directly); `transition-[left]` or a transform on the switch knob.
- Suggested command: `remove-animations`

**[P3] Preview labels are generic and not marked as examples**
- Location: `src/pages/public/Landing.tsx:72`; review stats `Landing.tsx:210-215`
- Category: Accessibility / Implementation Integrity
- Recommendation: Describe each picture in its `aria-label`; add a small visible "Example" caption under the previews so the sample numbers are never read as claims.
- Suggested command: `/impeccable clarify`

### Positive findings

- **Visible, consistent focus ring** on every focusable element (`index.css:29-31`, verified live: 2px violet ring with page-coloured offset). Its colour will move with the direction; its presence and offset are right.
- **Semantic structure**: one `h1`, h2 per section, `h3` in steps; `<header>`, `<main>`, `<footer>`, two labelled `<nav>`s ("Site", "Legal"); How it works is an `<ol>`; FAQ uses native `<details>/<summary>` (keyboard and screen reader support for free); `html lang="en"`.
- **Global reduced-motion rule** (`index.css:32-41`) covers everything on these pages.
- **Light theme is complete** on all four screens; nothing breaks or disappears between themes.
- **No fabricated proof** anywhere: no counts, logos, testimonials or pricing beyond "free", matching PRODUCT.md's "absent, never to be fabricated" list.
- **Route is code-split** (`App.tsx:8,14-16` lazy imports) and the page ships no images.

## Motion on this surface

| What | Where | Trigger | Duration / easing | Earns its place? |
|------|-------|---------|-------------------|------------------|
| Card fade-in + 4px rise | `tailwind.config.js:12-15`, applied by `Card.tsx:16` to 9 landing cards (planner strip, calendar card, 4 review stats, Atlas chat, 3 step cards) | On mount (page load), all at once, mostly off-screen | 250ms ease-out | **No.** Cards below the fold finish animating before anyone scrolls to them; on screen it's invisible noise. Remove on the landing. |
| Button press scale | `index.css:75-76` (`.btn` `active:scale-[0.97]`) | Pointer down on Sign up / Log in / 404 button | Tailwind `transition` default 150ms `cubic-bezier(0.4,0,0.2,1)` | **Yes.** Tactile press feedback fits "tactile, confident". Keep; narrow `transition` to `transform, background-color` when the glow goes. |
| Primary button hover brighten | `index.css:80` (`hover:brightness-110`) | Hover | 150ms default | Marginal. Filter transitions are cheap here; will be replaced by the neutral button's hover state. |
| Ghost button hover fill | `index.css:83-84` | Hover | 150ms default | Yes (state feedback). |
| FAQ "+" rotates to "×" | `Landing.tsx:285` (`transition group-open:rotate-45`) | Opening a `<details>` | 150ms default | **Yes.** Communicates open state. The answer itself appears instantly, which is fine for a FAQ. |
| Header nav / footer link hover | `PublicLayout.tsx:13-21,38-46` | Hover | Instant (no `transition`) | Fine as is. |
| Progress ring dash offset | `ProgressRing.tsx:35` (`0.5s linear`) | Prop change only; static on landing | 500ms linear | Inert here (no change after mount). |
| Goal bar width | `GoalCard.tsx:52` (`transition-[width] duration-500`) | Prop change only; static on landing | 500ms | Inert here; animates `width` (layout) in the app. |
| Switch knob | `Switch.tsx:17` (`transition-all`) | Toggle; static on landing | 150ms default | Inert here; `transition-all` animating `left` is a layout-property smell for the app. |
| Task row hover border, habit cell hover ring | `TaskItem.tsx:26`, `ContributionGrid.tsx:54` | Hover, but disabled by `pointer-events-none` on the landing | 150ms | Inert here. |
| Atlas orb pulse | `AtlasOrb.tsx:7` (`animate-pulse` only when `active`) | Not active on landing | n/a | Not shown. The orb's static blur halo is a glow, but Atlas-scoped and cyan, so within the direction. |
| Sticky header blur | `PublicLayout.tsx:7` (`backdrop-blur-xl`) | Continuous while scrolling | n/a | Not motion, but a per-frame compositing cost on scroll; the direction replaces glass with solid surfaces anyway. |
| Fixed background washes | `index.css:23-27` (`background-attachment: fixed`) | Scroll | n/a | **No.** Forces repaint on scroll in some browsers and is decoration the direction removes. |
| Reduced motion | `index.css:32-41` | `prefers-reduced-motion: reduce` | Everything to 0.01ms | Adequate for this surface (no motion here carries state that would be lost). |

## Machine-readable summary

```json
{"surface":"landing","critique_total":22,"critique_max":32,"na_heuristics":[5,7],"audit_total":11,
 "issues":[
  {"id":"landing-1","severity":"P1","title":"Phone landing scrolls sideways by 25px (Calendars preview widens the grid column)","fix":"Add grid-cols-1 md:grid-cols-2 to the Feature section and min-w-0 to both grid children; let TypeBadge wrap below sm","command":"/impeccable adapt","files":["src/pages/public/Landing.tsx:66","src/pages/public/Landing.tsx:183","src/components/calendars/TypeBadge.tsx:18"],"source":"both"},
  {"id":"landing-2","severity":"P1","title":"13 focusable buttons inside aria-hidden feature previews","fix":"Put inert on the preview wrapper and give the role=img container a descriptive aria-label","command":"/impeccable harden","files":["src/pages/public/Landing.tsx:72"],"source":"critique"},
  {"id":"landing-3","severity":"P1","title":"Primary CTA (white on violet-blue gradient, 3.7-4.2:1) and .faint text (3.9-4.3:1) fail AA contrast","fix":"Solid neutral primary button; raise .faint to slate-600 light / slate-400 dark","command":"/impeccable colorize","files":["src/index.css:78","src/index.css:66","src/pages/public/Landing.tsx:122","src/components/notes/NoteCard.tsx:93"],"source":"both"},
  {"id":"landing-4","severity":"P1","title":"Landing carries the retired violet/gradient system: gradient headline, logo, wordmark, glowing buttons, violet eyebrows/steps/bubbles, background washes","fix":"Neutral near-white emphasis, solid headline and wordmark, untinted background with no washes, cyan only on Atlas orb and action chips","command":"/impeccable quieter","files":["src/components/layout/Logo.tsx:6","src/components/layout/Logo.tsx:9","src/pages/public/Landing.tsx:109","src/pages/public/Landing.tsx:68","src/pages/public/Landing.tsx:236","src/pages/public/Landing.tsx:268","src/index.css:23","src/index.css:59","src/index.css:78"],"source":"both"},
  {"id":"landing-5","severity":"P2","title":"Seven equal-weight feature rows; text-only hero; voice HUD showpiece absent","fix":"Hero demonstrates capture (capture bar + resulting Inbox note); full-width Brain Dump section; compact grid for supporting tools; voice HUD still in the Atlas section; drop repeated eyebrows","command":"/impeccable layout","files":["src/pages/public/Landing.tsx:64","src/pages/public/Landing.tsx:107","src/pages/public/Landing.tsx:229"],"source":"both"},
  {"id":"landing-6","severity":"P2","title":"Sample content is office-worker life (quarterly report, team sync, work calendar) for a student audience","fix":"Re-cast samples to classes, deadlines, shifts; name the audience in the hero sub-line","command":"/impeccable clarify","files":["src/pages/public/Landing.tsx:52","src/pages/public/Landing.tsx:112","src/pages/public/Landing.tsx:163","src/pages/public/Landing.tsx:187"],"source":"critique"},
  {"id":"landing-7","severity":"P2","title":"Public Terms and Privacy show unfilled [placeholders] (company, date, region, liability, retention)","fix":"Owner fills the brackets; until then style unfilled tokens as visibly pending; number Privacy headings to match Terms","command":"/impeccable clarify","files":["src/pages/public/Terms.tsx:8","src/pages/public/Terms.tsx:40","src/pages/public/Privacy.tsx:19","src/pages/public/Privacy.tsx:47"],"source":"critique"},
  {"id":"landing-8","severity":"P2","title":"Public header shows Log in / Sign up to signed-in users on 404, Terms and Privacy","fix":"Make PublicHeader auth-aware: one 'Open Daybloom' button when signed in","command":"/impeccable harden","files":["src/pages/public/PublicLayout.tsx:5"],"source":"critique"},
  {"id":"landing-9","severity":"P2","title":"Legal h2 top margin silently overridden by space-y-4 (16px/16px); ~100-character lines","fix":"Use [&_h2]:!mt-8 (or replace space-y-4 with sibling selectors) and cap the article at max-w-[68ch]","command":"/impeccable typeset","files":["src/pages/public/PublicLayout.tsx:74","src/pages/public/PublicLayout.tsx:67"],"source":"audit"},
  {"id":"landing-10","severity":"P2","title":"Every public route is titled 'Daybloom ✨'; no meta description","fix":"Set per-route document titles and add a plain meta description from the hero sub-line","command":"/impeccable harden","files":["index.html:10","src/pages/public/Terms.tsx:4","src/pages/public/Privacy.tsx:3","src/pages/public/NotFound.tsx:5"],"source":"audit"},
  {"id":"landing-11","severity":"P2","title":"FAQ rows only respond on the 24px summary line; header buttons 36px tall on phone","fix":"Move padding onto <summary> as a block; min-h-11 on header buttons below sm","command":"mobile-native","files":["src/pages/public/Landing.tsx:281","src/pages/public/PublicLayout.tsx:19"],"source":"critique"},
  {"id":"landing-12","severity":"P3","title":"Hero headline breaks as 'Get / it done.'; single-word stragglers in body copy","fix":"text-wrap: balance on headings, text-wrap: pretty on paragraphs, or a deliberate break before 'Get it done.'","command":"/impeccable typeset","files":["src/pages/public/Landing.tsx:108"],"source":"audit"},
  {"id":"landing-13","severity":"P3","title":"Card fade-in runs on 9 mostly off-screen landing cards; transition-all on switch knob","fix":"Render landing previews without animate-fade-in; transition only transform on the knob","command":"remove-animations","files":["src/components/ui/Card.tsx:16","src/components/ui/Switch.tsx:17"],"source":"audit"},
  {"id":"landing-14","severity":"P3","title":"Preview regions labelled '<eyebrow> preview' and sample numbers not marked as examples","fix":"Descriptive aria-labels per preview; small visible 'Example' caption under previews","command":"/impeccable clarify","files":["src/pages/public/Landing.tsx:72","src/pages/public/Landing.tsx:210"],"source":"critique"}
 ]}
```
