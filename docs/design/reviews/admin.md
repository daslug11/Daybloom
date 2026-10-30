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

