# Admin: critique & audit (Phase 1 baseline)

Method: design review (sub-agent, screenshots + source + live app) → then detector evidence (Phase 0 CDP scans, both themes, desktop + phone)

Run notes:
- The admin login `boss-e2e@e2e.local` was rejected by the local stack twice ("That email and password don't match"), including after the restart.
- Live checks therefore used two setups:
  - **Maya** (`maya@visual.local`) for the real 403 "Admins only" state.
  - **Maya with `GET /api/admin` answered by a fixture inside Playwright** (route interception, nothing written) for the populated layout, Edit behaviour, focus and target sizes. The fixture is shaped like the Phase 0 screenshot data.
- Screenshots: all four `phase0-before/*/admin.jpg`.
- No user limits were changed. The one Save click in the probe went to the intercepted route and never reached the server.
- Scripts: `/home/user/Daybloom/.scratch/admin-review/`.

## Critique

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Spend against the caps is a 12px faint sub-line ("$0.0693 of $0.5000 daily cap"). There is no meter and no "AI is resting" state. Clicking **Edit** in the table shows nothing in view (the form opens about 230–290px above the viewport). |
| 2 | Match System / Real World | 3 | The copy is plain. Currency precision flips between `$0.5000` and `$5.00` on adjacent tiles. "Cost" and "Limit: Default" are terse. |
| 3 | User Control and Freedom | 2 | The found-user panel has no Cancel or close. A block takes effect on Save with no undo other than re-editing. Back to app works. |
| 4 | Consistency and Standards | 2 | Save is the violet gradient `btn-primary`, Find is ghost and Edit is a violet text link: three action styles in one flow. The Limit column says "Default", not the number. |
| 5 | Error Prevention | 2 | **Block AI** is a bare 13×13 native checkbox. It saves with no confirmation and no statement of what the user will experience. Decimals in the limit field are silently floored by the server. |
| 6 | Recognition Rather Than Recall | 3 | Most things are visible. "Default" makes the admin recall 15 from a tile at the top. Truncated emails have no full-text title. |
| 7 | Flexibility and Efficiency | 1 | The table is a fixed top 25 by cost, which is unlabelled. There is no sort, filter, paging or "blocked users" view. Finding anyone outside the top 25 needs their exact email. |
| 8 | Aesthetic and Minimalist Design | 3 | Calm and readable. The gradient logo, glass cards and 25 near-identical rows add noise without hierarchy, and the 30-day "chart" is a plain list. |
| 9 | Error Recovery | 2 | Lookup and save errors go only to a toast ("No user with that email."). Nothing appears inline next to the field. |
| 10 | Help and Documentation | 2 | The subtitle explains how costs are estimated, which is good. Nothing says what "Block AI" does, that limits reset at midnight UTC, or what happens when a cap is hit. |
| **Total** | | **22/40** | **Acceptable** |

### Design Specificity Verdict

**LLM assessment:**
- This is a generic admin page: four stat tiles, a search box, a table and a list. It could be the admin page of any SaaS. For an internal Operate tool, familiarity is fine.
- **The miss is that it doesn't answer the one question this page exists for.** That question is: "Is AI spend safe, and is anyone abusing the allowance?" PRODUCT.md makes the global caps a product feature ("AI is resting until tomorrow 🌙"). Yet this page:
  - never says whether AI is currently running or resting;
  - doesn't show how close the caps are, except as faint 12px arithmetic.
- **The "honest numbers" commitment is half-met.**
  - Good: the costs-are-estimates sentence.
  - Bad: the caps carry no visual weight, and the Top users table never says it is "top 25 by cost".
- **Brand chrome from the old system is still here:**
  - the gradient logo (`Logo.tsx:5–8`);
  - the gradient-text wordmark;
  - the violet gradient Save button;
  - violet Edit links.
- None of this carries meaning, and all of it contradicts the neutral-emphasis direction.

### What's Working

1. **Honest, explained numbers.**
   - The subtitle "Costs are estimates from token counts at the model's list price" (`Admin.tsx:89`) states the method.
   - Every tile pairs a count with its context ("+238 in 7 days", "AI open to all users").
   - `tabular-nums` keeps the figures aligned.
2. **The 403 state is clear and safe.** Non-admins get one centred message, "Admins only — this page is for the account set as ADMIN_EMAIL.", plus Back to app. Nothing leaks, and the server enforces it in `server/admin.ts:11`.
3. **The server sets sensible guard-rails, and the UI mirrors them.**
   - The limit is clamped to 0–10000, and an empty field means the default (`server/admin.ts:36–37`).
   - The input has the matching `min`/`max` and the placeholder `Default (15)` (`Admin.tsx:52`).
   - Leaving the field blank to fall back to the default is a good, low-error pattern.

### Priority Issues

**[P1] Edit in the Top users table opens the editor off-screen and leaves focus behind**
- **What:**
  - The **Edit** link (`Admin.tsx:160`) calls `setFound(...)`, which renders `UserControls` inside the **Find a user** card (`Admin.tsx:126–133`), far above the table.
  - Measured live: after clicking the last row's Edit, the limit input sat at y = −231 (desktop) and y = −287 (phone).
  - Focus stayed on the Edit button.
- **Why it matters:**
  - Editing someone from the table is the main path to "set their limit or block them". It looks broken: you click and nothing happens.
  - A keyboard or screen-reader user gets no announcement at all.
  - The admin may click Edit again on another row, which silently swaps the user in the panel above.
- **Fix:**
  - Preferred: render `UserControls` inline as an expandable row under the clicked `<tr>`, with Cancel.
  - Alternative: keep one editor, then `scrollIntoView({block:'center'})` and focus the "Daily AI limit" input, label the panel "Editing burst-…@test.local", and set `aria-live="polite"` on it.
- **Suggested command:** `/impeccable harden`

**[P1] On phones the table hides Cost, Limit and Edit behind an unmarked horizontal scroll**
- **What:**
  - At 390px the `overflow-x-auto` wrapper (`Admin.tsx:139`) holds a 496px table inside a 316px box.
  - The screenshot cuts off at "MONTH". Cost, Limit and **Edit** sit at x ≈ 510, off the screen.
  - There is no scroll shadow or hint.
  - Edit itself is 22×16px (`link text-xs`, `Admin.tsx:160`), well under 44×44.
- **Why it matters:**
  - On a phone, the admin can't see who is blocked or what anyone costs without discovering a sideways scroll.
  - The action is a 22×16 target at the far edge.
- **Fix:**
  - Below `sm`, render each top user as a stacked row: email, then "4 today · 4 month · $0.0028", then the limit badge, with a full-width row tap or a 44px Edit button.
  - Keep the table at `sm` and up.
  - Give the email cell `title={u.email}`.
- **Suggested command:** `/impeccable adapt`

**[P1] Spend against the caps, the page's key status, is the least prominent text on it**
- **What:**
  - The daily and monthly cap figures live in the tiles' `faint mt-0.5 text-xs` sub-line (`Admin.tsx:100–101, 107`). That is slate-500 on near-black, 3.86:1, below AA for 12px text.
  - The big number in those tiles is *request count*, not spend.
  - Currency precision varies: `usd()` (`Admin.tsx:28`) prints 4 decimals under $1, so `$0.5000` sits next to `$5.00`.
  - Nothing shows whether AI is currently paused for everyone.
- **Why it matters:**
  - The global caps are a product promise. The admin has to do mental division to know if users are about to see "AI is resting until tomorrow 🌙".
  - It also fails WCAG 1.4.3.
- **Fix:**
  - Make spend the headline of those tiles: "$0.07 of $0.50 · 14%", with a thin neutral meter that turns amber at 80% and rose at 100%.
  - Add one status line under the title: "AI running · resets 00:00 UTC", or "AI resting: daily cap reached".
  - Format currency with 2 decimals, falling back to 4 only for non-zero amounts under $0.01.
  - Move sub-lines to the `muted` tier.
- **Suggested command:** `/impeccable clarify`

**[P2] Block AI is an unexplained, unconfirmed native checkbox saved by a violet gradient button**
- **What:**
  - `<input type="checkbox"> Block AI` (`Admin.tsx:54–56`) renders as a 13×13 browser-default box, unstyled in both themes.
  - Save (`Admin.tsx:57`) is the glowing violet gradient primary.
  - There is no Cancel and no text saying what a blocked user experiences.
  - After saving, the panel stays open with stale props.
- **Why it matters:**
  - Blocking is the most consequential action on the page. It gets the least explanation and the weakest control.
  - The gradient contradicts the confirmed neutral-emphasis direction.
- **Fix:**
  - Use a labelled switch row: "Block AI for this user: they keep full access to Daybloom, but ✨ buttons and Atlas are off."
  - Make Save a neutral near-white primary and add Cancel.
  - When `blocked` changes from false to true, change the Save label to "Block user".
  - Collapse the panel on success and show the saved state in the table row.
- **Suggested command:** `/impeccable harden`

**[P2] The Top users table hides its rule and its defaults**
- **What:**
  - The heading says "Top users this month" (`Admin.tsx:137`), but the RPC returns the top 25 ordered by cost (`supabase/migrations/20261028000002_ai_limits.sql:226–239`). In the screenshot, 5-request users rank below 4-request users, which looks wrong without that rule.
  - The Limit column prints "Default" instead of the actual value (`Admin.tsx:158`).
  - The empty last `<th>` has no accessible name.
  - Names (`u.name`) are fetched but never shown.
- **Why it matters:**
  - The "honest numbers" principle: every number should say how it was calculated.
  - The admin can't tell whether a heavy user is missing from the list because it is capped at 25.
- **Fix:**
  - Retitle it "Top 25 by cost this month".
  - Print limits as "15 (default)" or "40".
  - Add `<th><span className="sr-only">Actions</span></th>`.
  - Show the name above the email as muted text when present.
- **Suggested command:** `/impeccable clarify`

**[P3] "Last 30 days" is a bare list of only the days that had usage**
- **What:** `Admin.tsx:174–190` lists `day · N requests · $cost` newest-first. Days with no usage are omitted by the RPC, so gaps are invisible, and there is no total or peak.
- **Why it matters:** A trend view that can't show a trend. Today it is one row.
- **Fix:** Fill in zero-days client-side and render 30 thin neutral bars (requests) with a day/cost tooltip and a "30-day total $X" line. Keep the list behind "Show table" for screen readers, or render the list as the accessible fallback.
- **Suggested command:** `/impeccable layout`

### Persona Red Flags

**Alex (Power User, the owner checking costs between lectures):**
- Clicks **Edit** on row 18 and nothing visibly happens (the form opens above the fold).
- Can't sort by Today or Month, or filter to blocked users.
- Must type an exact full email to find anyone outside the top 25. No partial match: the server does `lower(email) = lower(p_email)`.
- No keyboard shortcut. Back to app is the only way out.

**Sam (Accessibility-dependent):**
- Edit gives no focus move and no live announcement.
- The table's action column header is empty.
- The cap figures and the `faint` table header are 3.86:1 on dark (below AA).
- `text-rose-600` "Blocked" is 3.91:1 on dark.
- The find field has only an `aria-label` and a placeholder; the placeholder is 2.39:1 in light.
- The 13px native checkbox is a small target for low-vision or motor users.
- On the plus side, the focus ring shows on Edit links (violet ring, an off-direction colour), and the heading order (h1, then h2s) is clean.

**Casey (Distracted mobile):**
- On a phone the only actionable column, Edit, is off-screen behind a sideways scroll with no hint, and it is 22×16px.
- Back to app is at the top right, out of thumb reach.
- The stat tiles wrap labels onto two lines ("AI REQUESTS THIS / MONTH").
- The one thing Casey wants on the go is "are we near the cap?", and it is the smallest text on screen.

### Cognitive Load

Checklist failures (3, moderate):
- **Visual hierarchy:** request counts are loudest, while spend against the cap (the real status) is faintest.
- **Working memory:** "Limit: Default" means recalling 15 from the top tile, and Edit sends you to a form you can't see.
- **One thing at a time:** Find-a-user and table-Edit share one panel, so a second Edit silently replaces the first edit in progress.

Decision points with more than 4 options:
- The Top users table shows 25 identical **Edit** links, with no grouping and no indication of which rows are unusual (blocked, custom limit, near the limit).
- Highlight exceptions (a blocked badge, a custom-limit badge, today ≥ limit) so the eye goes to the 1–2 rows that matter.

### Minor Observations

- The page has no `<main>` landmark (`Admin.tsx:81` is a plain `div`).
- `document.title` stays "Daybloom ✨" instead of "Admin · Daybloom".
- "+238 in 7 days" equals the total. That is honest for a new deployment, but the tile could say "all new this week" when they are equal.
- In the screenshot, the date column in "Last 30 days" renders with wide letter-spacing ("2026 - 10 - 29"), which reads oddly. Use a short human date ("Thu 29 Oct").
- The found-user label "— · email" shows an em dash placeholder when there is no name. Show only the email.
- `ErrorState` for the 403 uses a rose warning triangle. For an expected "not for you" state, a neutral lock icon would be calmer.
- The Spinner on load is violet (`States.tsx:36`). A skeleton of the four tiles would avoid layout jump.

## Audit

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | `faint` sub-lines and the table header are 3.9:1 on dark (detector, 6 per dark viewport). Toasts, the only success and error feedback, have no live region. Table Edit moves no focus. The action column header is empty and there is no `<main>`. |
| 2 | Performance | 3 | A small page. Six `backdrop-blur-xl` glass cards sit over a fixed multi-gradient body. Cost is minor at this size, and the blur is slated for removal. |
| 3 | Theming | 2 | Raw Tailwind palette everywhere and no semantic tokens. `text-rose-600` "Blocked" has no dark variant (3.9:1). The native checkbox ignores the theme. Violet is used for links, focus, spinner and Save. |
| 4 | Responsive Design | 2 | At 390px the table is 496px wide in a 316px box, so Cost, Limit and Edit are off-screen with no affordance. Edit is 22×16px. |
| 5 | Implementation Integrity | 2 | Gradient logo, gradient-text wordmark and the violet gradient primary contradict DESIGN.md. Several verified issues, plus a broken Edit → editor connection. |
| **Total** | | **11/20** | **Acceptable** |

**Implementation integrity verdict: Fail (soft).**
- The structure is sound and honest: real RPC data, a stated cost method, server-side enforcement.
- The page still wears the old violet/gradient chrome.
- It has one interaction that functionally breaks: table Edit opens an off-screen editor.

### Detector findings

Source: Phase 0 CDP scans, `admin-detector.json`.

| Rule | dark-desktop | dark-phone | light-desktop | light-phone | Verdict |
|------|---|---|---|---|---|
| `low-contrast` | 6 | 6 | 1 | 1 | **Real.** In dark, four tile sub-lines are `p.faint` #64748b on #14131b, 3.9:1 (`Admin.tsx:107`). The `<thead>` (`faint`, `Admin.tsx:141`) is 3.9:1; the detector reports only the first `th`, but all six inherit it. The find-field placeholder is 3.4:1 in dark and 2.5:1 in light (`index.css:71–72`), which matters because the placeholder is the field's only visible label. |
| `ai-color-palette` | 2 | 2 | 2 | 2 | **Real** under the confirmed direction. One is the logo tile gradient `from-violet-500 via-blue-500 to-pink-500` (`Logo.tsx:5`). The other is the body-level "violet accents" (the `.link` Edit buttons `index.css:98`, focus ring `index.css:30`, Spinner `States.tsx:36`, `btn-primary` Save `index.css:79`). None of this is Atlas cyan, so it is not the known false positive. All of it is already slated for removal. |
| `gradient-text` | 1 | 1 | 1 | 1 | **Real.** The "Daybloom" wordmark `.gradient-text` (`Logo.tsx:8`, `index.css:59–61`). Slated for removal (No-Ornament Type Rule). |
| `overused-font` | 1 | 1 | 1 | 1 | **False positive for this product.** Inter at 100% is the documented single-family choice, and operate.md says "one family is often right" for product UI. |
| **Total** | 10 | 10 | 5 | 5 | 30 findings; 26 real, 4 false positive. |

Source scan (`src_scan_all`): no findings in `Admin.tsx` itself. The relevant shared hits are:
- `Logo.tsx:6` (violet gradient);
- `index.css:60–61` (gradient-text);
- `index.css:79` (btn-primary gradient);
- `Switch.tsx:14` (violet gradient). This matters because Switch is the component I recommend for Block AI.

What the detector did not catch, found by the review and live probe:
- Edit opens the editor off-screen.
- Phone table overflow hides the actions.
- Toasts aren't announced.
- The empty `<th>`.
- No `<main>`.
- `text-rose-600` "Blocked" at 3.9:1 on dark. It never rendered in the screenshot data because nobody was blocked.
- The 22×16 Edit target.

The review's P1 contrast finding matches the detector exactly (3.86 measured vs 3.9 reported).

### Findings by severity

**[P1] Table Edit opens an off-screen editor; focus is not moved**
- **Location:** `src/pages/Admin.tsx:160`, `src/pages/Admin.tsx:126–133`
- **Category:** Accessibility / Implementation Integrity
- **Impact:**
  - Measured live: the limit input lands at y = −231 (desktop) and −287 (phone) after Edit on the last row.
  - Focus stays on Edit. Sighted users see nothing happen, and AT users hear nothing.
- **WCAG:** 2.4.3 Focus Order and 3.2.2-adjacent (an unexpected context change out of view). Advisory.
- **Recommendation:** Expand the editor inline under the row, or scroll it into view and focus the limit input. Add Cancel.
- **Suggested command:** `/impeccable harden`

**[P1] Cap figures and table header below AA contrast in dark**
- **Location:** `src/pages/Admin.tsx:107` (`p.faint`), `src/pages/Admin.tsx:141` (`thead.faint`), `src/index.css:66–68`
- **Category:** Accessibility / Theming
- **Impact:** The spend-vs-cap line, the page's key status, is the lowest-contrast text: #64748b on #14131b, 3.9:1.
- **WCAG:** 1.4.3 Contrast (Minimum), AA
- **Recommendation:** Use `muted` (slate-400 in dark, 7.2:1) for the sub-lines and the header. Promote spend to the tile headline with a neutral meter (see critique P1).
- **Suggested command:** `/impeccable clarify`

**[P1] Save and lookup results are only in toasts, which aren't announced**
- **Location:** `src/hooks/useToast.tsx:44` (the container has no `role="status"`/`aria-live`), `src/pages/Admin.tsx:37–40`, `src/pages/Admin.tsx:74`
- **Category:** Accessibility
- **Impact:**
  - "Saved for …", "No user with that email." and "Daily limit must be 0–10000…" vanish after 3s and are silent to screen readers.
  - Validation errors aren't shown next to the field.
- **WCAG:** 4.1.3 Status Messages (AA); 3.3.1 Error Identification
- **Recommendation:** Add `role="status" aria-live="polite"` to the toast stack. In Admin, also render find and save errors inline under the relevant field with `aria-describedby`.
- **Suggested command:** `/impeccable harden`

**[P1] Phone: table actions off-screen behind unmarked horizontal scroll**
- **Location:** `src/pages/Admin.tsx:139–167`
- **Category:** Responsive
- **Impact:** At 390px: `scrollWidth` 496 vs `clientWidth` 316. Cost, Limit and Edit are hidden, and there is no scroll cue.
- **Recommendation:** Below `sm`, use a stacked list layout with a 44px tap target per user. Keep the table at `sm` and up.
- **Suggested command:** `/impeccable adapt`

**[P2] Block AI uses an unstyled native checkbox; Save is the violet gradient; no Cancel**
- **Location:** `src/pages/Admin.tsx:54–59`
- **Category:** Implementation Integrity / Theming
- **Impact:**
  - The checkbox is 13×13 and ignores the theme.
  - The most consequential action carries no explanation or confirmation.
  - Save glows violet against the direction.
- **Recommendation:**
  - Use `Switch` (`src/components/ui/Switch.tsx`) once its gradient is neutralised, in a labelled row with an effect description.
  - Make Save neutral, add Cancel, and label it "Block user" when blocking.
- **Suggested command:** `/impeccable harden`

**[P2] Top users table: unstated rule, hidden defaults, unnamed action column, low-contrast "Blocked"**
- **Location:**
  - `src/pages/Admin.tsx:137` (title);
  - `src/pages/Admin.tsx:148` (empty `<th />`);
  - `src/pages/Admin.tsx:154` (truncate without title);
  - `src/pages/Admin.tsx:158` ("Default", `text-rose-600` without a dark variant);
  - `supabase/migrations/20261028000002_ai_limits.sql:226–239` (top 25 by cost)
- **Category:** Accessibility / Implementation Integrity
- **Impact:**
  - The ranking looks wrong (5-request rows below 4-request rows).
  - The limit value is hidden.
  - Screen readers announce an unnamed column.
  - "Blocked" is 3.9:1 on dark.
- **WCAG:** 1.3.1 Info and Relationships (empty header), 1.4.3 (Blocked)
- **Recommendation:**
  - Retitle it "Top 25 by cost this month".
  - Show "15 (default)".
  - Add `sr-only` "Actions".
  - Add `title={u.email}`.
  - Use `text-rose-600 dark:text-rose-300` or a badge.
- **Suggested command:** `/impeccable clarify`

**[P2] Violet/gradient chrome on an Operate tool**
- **Location:** `src/components/layout/Logo.tsx:5–8`, `src/index.css:30` (focus ring), `src/index.css:79` (btn-primary), `src/index.css:98` (link), `src/components/ui/States.tsx:36` (spinner), `src/hooks/useToast.tsx:53` (violet toast glow)
- **Category:** Theming / Implementation Integrity
- **Impact:** Emphasis carries no meaning and contradicts the confirmed neutral near-white direction. Detector: `ai-color-palette` and `gradient-text` in all four variants.
- **Recommendation:**
  - Make these neutral near-white: primary, focus ring, link and spinner.
  - Use a solid mark for the logo tile and a solid wordmark.
  - Handle this in the shared tokens pass, not per page.
- **Suggested command:** `/impeccable quieter`

**[P2] Find field has no visible label; placeholder fails contrast**
- **Location:** `src/pages/Admin.tsx:121`, `src/index.css:71–72`
- **Category:** Accessibility
- **Impact:**
  - "user@example.com" is the only visible cue: 2.5:1 in light and 3.4:1 in dark.
  - It disappears on typing.
  - It doesn't say that an exact full email is required (the server does `lower(email) = lower(p_email)`).
- **WCAG:** 1.4.3, 3.3.2 Labels or Instructions
- **Recommendation:** Add a visible `label` "User email (exact)" and raise the placeholder to slate-500/slate-400.
- **Suggested command:** `/impeccable polish`

**[P3] Last 30 days is a list of only the days with usage**
- **Location:** `src/pages/Admin.tsx:174–190`
- **Category:** Implementation Integrity
- **Impact:** No visible trend, invisible gaps and no total.
- **Recommendation:** Fill in zero-days and show neutral bars plus a 30-day total, keeping an accessible list.
- **Suggested command:** `/impeccable layout`

**[P3] No `<main>` landmark; generic document title**
- **Location:** `src/pages/Admin.tsx:81`
- **Category:** Accessibility
- **Impact:** Landmark navigation and tab titles don't identify the page ("Daybloom ✨").
- **WCAG:** 1.3.1 (landmarks, best practice), 2.4.2 Page Titled
- **Recommendation:** Wrap the content in `<main>` and set the title to "Admin · Daybloom".
- **Suggested command:** `/impeccable polish`

**[P3] Card mount fade on an Operate tool; toasts ignore reduced motion**
- **Location:** `src/components/ui/Card.tsx:16`, `tailwind.config.js:12–15`, `src/hooks/useToast.tsx:47–52`
- **Category:** Performance / Accessibility
- **Impact:**
  - Six cards fade and rise 4px together on load, which is decoration on a data page.
  - Framer-motion toasts aren't covered by the CSS reduced-motion rule (there is no `MotionConfig reducedMotion="user"` anywhere in `src`).
- **Recommendation:** Drop the card mount animation on data surfaces, and add `<MotionConfig reducedMotion="user">` at the root.
- **Suggested command:** `remove-animations`

Patterns:
- `faint` (slate-500) fails AA on every dark glass surface. This is systemic, not admin-specific.
- Feedback relies on silent toasts across the app.

### Positive findings

- **Honest, server-enforced numbers.**
  - Costs are labelled as estimates (`Admin.tsx:89`).
  - The admin check is server-side (`server/admin.ts:11`).
  - The limit is validated on both client (`min`/`max`) and server (`server/admin.ts:37`), with a plain error message.
- **The empty field means default** (`Admin.tsx:35`), with the default shown in the placeholder `Default (15)`. This is a good low-error pattern.
- **`tabular-nums` and right-aligned numeric columns** (`Admin.tsx:155–157`) make the table scannable.
- **States are covered:**
  - loading (Spinner with `role="status"`);
  - 403 (a clear `role="alert"` message);
  - other errors (retry);
  - empty table ("No AI usage this month yet.");
  - empty history.
- **Keyboard:**
  - every control is a native `button`/`input`/`a`;
  - the focus ring renders on Edit links (verified live);
  - the heading order is h1 → h2 × 3;
  - both forms submit with Enter.

## Motion on this surface

| Motion | Where | Trigger | Duration / easing | Earns its place? |
|---|---|---|---|---|
| Card fade + 4px rise | `src/components/ui/Card.tsx:16` (`animate-fade-in`), keyframes `tailwind.config.js:12–15` | Mount of each of the 7 cards (4 tiles, Find, Top users, Last 30 days); all fire at once | 250ms `ease-out`, `both` | **No.** Decoration on an Operate data page. Operate guidance: no page-load choreography. Remove here. |
| Button press scale | `src/index.css:75–76` (`.btn` `transition`, `active:scale-[0.97]`) | Press on Back to app, Find, Save, Try again | Tailwind default `transition` (150ms, `cubic-bezier(0.4,0,0.2,1)`, many properties) | **Yes.** Tactile press feedback fits the confirmed direction. Narrow `transition` to `transform, background-color, opacity`. |
| Ghost hover fill / primary brightness | `src/index.css:79–84` | Hover | 150ms default | **Yes**, as state feedback. The primary's `brightness-110` on a gradient goes away with the gradient. |
| Input focus border/ring | `src/index.css:70–72` (`.input … transition`) | Focus on the find and limit fields | 150ms default | **Yes**, as state. The colour should become neutral. |
| Loading spinner | `src/components/ui/States.tsx:36` (`animate-spin`) | `overview.isLoading` (`Admin.tsx:91`) | 1s linear infinite | **Partly.** It conveys loading, but a 4-tile skeleton would avoid the layout jump. It should be neutral, not violet. |
| Toast enter/exit + layout | `src/hooks/useToast.tsx:47–52` (framer-motion; y 20→0, scale 0.95→1; exit y 10, scale 0.95) | Save success/error, lookup error | Framer default spring/tween | **Yes**, as feedback. It ignores `prefers-reduced-motion` because no `MotionConfig` is set, and it has a violet glow shadow. |
| Global reduced-motion kill | `src/index.css:32–41` | `prefers-reduced-motion: reduce` | All CSS animation/transition set to 0.01ms | Acceptable here, since none of this page's CSS motion carries state that is lost. It does not cover the framer toasts. |

## Machine-readable summary

```json
{"surface":"admin","critique_total":22,"critique_max":40,"na_heuristics":[],"audit_total":11,
 "issues":[
  {"id":"admin-1","severity":"P1","title":"Table Edit opens the user editor off-screen and leaves focus on the link","fix":"Expand UserControls inline under the clicked row with Cancel, or scrollIntoView + focus the Daily AI limit input and label the panel 'Editing <email>' with aria-live","command":"/impeccable harden","files":["src/pages/Admin.tsx:160","src/pages/Admin.tsx:126"],"source":"both"},
  {"id":"admin-2","severity":"P1","title":"Phone: Cost, Limit and Edit columns hidden behind unmarked horizontal scroll; Edit is 22x16px","fix":"Below sm render top users as stacked rows (email / today·month·cost / limit badge) with a 44px Edit target; keep table at sm+; add title={email}","command":"/impeccable adapt","files":["src/pages/Admin.tsx:139","src/pages/Admin.tsx:160"],"source":"both"},
  {"id":"admin-3","severity":"P1","title":"Spend vs daily/monthly cap is faint 12px text at 3.9:1, with mixed $0.5000/$5.00 precision and no AI running/resting status","fix":"Make spend the tile headline with a neutral meter (amber 80%, rose 100%), add an 'AI running · resets 00:00 UTC' / 'AI resting' status line, format currency at 2 decimals (4 only under $0.01), move sub-lines and thead from faint to muted","command":"/impeccable clarify","files":["src/pages/Admin.tsx:28","src/pages/Admin.tsx:100","src/pages/Admin.tsx:107","src/pages/Admin.tsx:141","src/index.css:66"],"source":"both"},
  {"id":"admin-4","severity":"P1","title":"Save and lookup feedback exists only in toasts that have no live region","fix":"Add role=status aria-live=polite to the toast stack; render find/save errors inline under the field with aria-describedby","command":"/impeccable harden","files":["src/hooks/useToast.tsx:44","src/pages/Admin.tsx:40","src/pages/Admin.tsx:74"],"source":"audit"},
  {"id":"admin-5","severity":"P2","title":"Block AI is an unstyled 13px native checkbox with no explanation, no Cancel, saved by the violet gradient button","fix":"Use a labelled Switch row describing the effect on the user, neutral Save with Cancel, Save label becomes 'Block user' when blocking, collapse panel on success","command":"/impeccable harden","files":["src/pages/Admin.tsx:54","src/pages/Admin.tsx:57","src/components/ui/Switch.tsx:14"],"source":"critique"},
  {"id":"admin-6","severity":"P2","title":"Top users table hides its rule (top 25 by cost) and default limit value; empty action header; 'Blocked' 3.9:1 on dark","fix":"Retitle 'Top 25 by cost this month', show '15 (default)', add sr-only 'Actions' th, show name when present, dark:text-rose-300 or a badge for Blocked","command":"/impeccable clarify","files":["src/pages/Admin.tsx:137","src/pages/Admin.tsx:148","src/pages/Admin.tsx:158","supabase/migrations/20261028000002_ai_limits.sql:226"],"source":"both"},
  {"id":"admin-7","severity":"P2","title":"Violet/gradient chrome: gradient logo and wordmark, gradient Save, violet links, focus ring, spinner, toast glow","fix":"Neutral near-white primary, focus ring, link and spinner; solid logo tile and wordmark; do it in the shared tokens pass","command":"/impeccable quieter","files":["src/components/layout/Logo.tsx:5","src/index.css:30","src/index.css:59","src/index.css:79","src/index.css:98","src/components/ui/States.tsx:36","src/hooks/useToast.tsx:53"],"source":"both"},
  {"id":"admin-8","severity":"P2","title":"Find-a-user field has no visible label; placeholder is 2.5:1 light / 3.4:1 dark and doesn't say exact email is required","fix":"Add a visible label 'User email (exact)' and raise placeholder contrast in .input","command":"/impeccable polish","files":["src/pages/Admin.tsx:121","src/index.css:71"],"source":"both"},
  {"id":"admin-9","severity":"P3","title":"Last 30 days lists only days with usage, with no trend or total","fix":"Fill zero-days client-side, render 30 neutral bars with day/cost tooltip plus a 30-day total; keep an accessible list","command":"/impeccable layout","files":["src/pages/Admin.tsx:174"],"source":"critique"},
  {"id":"admin-10","severity":"P3","title":"No main landmark; document title stays 'Daybloom ✨'","fix":"Wrap content in <main> and set document.title to 'Admin · Daybloom'","command":"/impeccable polish","files":["src/pages/Admin.tsx:81"],"source":"audit"},
  {"id":"admin-11","severity":"P3","title":"Card mount fade on a data page; framer-motion toasts ignore reduced motion","fix":"Drop animate-fade-in on Operate data cards; add <MotionConfig reducedMotion=\"user\"> at the app root","command":"remove-animations","files":["src/components/ui/Card.tsx:16","tailwind.config.js:15","src/hooks/useToast.tsx:47"],"source":"audit"}
 ]}
```
