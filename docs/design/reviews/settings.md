# Settings: critique & audit (Phase 1 baseline)

Method: design review (sub-agent, screenshots + source + live app) → then detector evidence (Phase 0 CDP scans, both themes, desktop + phone)

Evidence used for the critique: the four Phase 0 screenshots (`test-results/visual/phase0-before/{dark,light}-{desktop,phone}/settings.jpg`), the source (`src/pages/app/Settings.tsx`, `src/components/ui/{Switch,Modal,Card,PageHeader}.tsx`, `src/lib/speech.ts`, `src/hooks/{useProfile,useToast}.ts(x)`, `src/index.css`, `tailwind.config.js`) and live Playwright probes against http://localhost:5173 as Maya (desktop 1440×900 and phone 390×844, dark). The probes only opened and cancelled the delete dialog. Nothing was saved, toggled or deleted. Scripts are in `.scratch/settings-review/probe*.cjs`. The detector JSON was opened only after this section was written.

## Critique

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Name, time zone, voice and switch changes save silently (`Settings.tsx:136,140,66`). Failed saves roll back with no message (`useProfile.ts:40`). The toasts that do appear are not announced to screen readers and vanish after 3 s. |
| 2 | Match System / Real World | 3 | Plain, honest hints on almost every row. "Download JSON", "Pitch · 0.85" and "Speed · 1.00×" are raw technical values with no human anchor ("Lower" / "Higher", "Normal"). |
| 3 | User Control and Freedom | 2 | The delete dialog has Cancel, Esc and ✕, but closing it drops keyboard focus onto `<body>` (verified live). Name, voice, sliders and switches apply instantly with no undo or "reset to default". |
| 4 | Consistency and Standards | 2 | Some rows save on blur or change, while Email and Password need a button. Row `<label>`s are clickable for inputs but not for switches. The Theme `role=radio` chips are two Tab stops with no arrow-key behaviour. Emphasis is still violet/gradient, against the confirmed direction. |
| 5 | Error Prevention | 3 | Good: typed DELETE gate, email changes confirmed from both addresses, 8-character minimum. Gaps: a new password is set from a single field with no confirm or show toggle, and no current password is asked for. |
| 6 | Recognition Rather Than Recall | 3 | Current email and allowance are shown inline. The time zone is a 419-option native select with no "use this device's zone" suggestion. |
| 7 | Flexibility and Efficiency | 2 | No device time zone shortcut, no search, no "reset voice to default". Each slider step fires a server write. |
| 8 | Aesthetic and Minimalist Design | 3 | A calm, well-grouped card stack. Noise comes from the gradient "Settings" title, emoji in the Theme chips and ✨ label, the redundant "Log out" label next to a "Log out" button, and the Delete account row sitting at the same weight as Export. |
| 9 | Error Recovery | 2 | Errors surface as raw Supabase `error.message` strings in a 3 s toast (`Settings.tsx:74,84`). Profile write errors show nothing at all. The DELETE gate silently stays disabled for "delete" (case-sensitive, no hint). |
| 10 | Help and Documentation | 3 | Nearly every row has a one-line "what this does" hint (wake phrase mic warning, email double-confirmation, allowance reset time). No link to help from here. |
| **Total** | | **25/40** | **Acceptable** |

### Design Specificity Verdict

**LLM assessment:** The *content* is product-specific and honest, which is where this page earns its keep. The copy states the email double-confirmation, the wake phrase mic warning ("Your mic stays on while the HUD is open"), the shared AI allowance resetting at midnight UTC, and an export hint that names every data type. A student reading it learns exactly what Daybloom does with their data. The *form* is category-interchangeable: a title, four identical glass cards, and label-left/control-right rows with hairline dividers. It could be any SaaS settings page. That is acceptable for an Operate surface (earned familiarity), but three things undercut the "Clear Head" direction:
- The violet→blue→pink gradient `h1`, the violet→blue gradient switch and the `accent-violet-600` sliders are exactly the emphasis the owner has asked to move to neutral near-white.
- The **Atlas voice** card is the one place where Atlas's identity could legitimately appear (cyan is reserved for Atlas). Today it looks identical to "Account". There is no preview of the voice beyond a plain "Test" button, and the sliders don't speak while you drag.
- The irreversible action (Delete account) has no visual separation from the harmless one (Export), which works against the "Your data is yours" commitment's sense of control.

**Deterministic scan:** See the Audit section. This verdict was written before the detector file was opened.

### What's Working

1. **Honest, specific row hints.** Every consequential row says what it does and what it costs: the wake phrase hint (`Settings.tsx:206`) discloses that the mic stays on, the email hint (`:213`) shows the current address and the two-address confirmation, and the allowance row (`:229`) says "resets at midnight UTC". This directly serves PRODUCT.md's "Every page answers what is this for" and "Honest by default".
2. **A real, well-gated delete flow.** Account deletion sits behind a dialog that explains there is no undo, offers export first, requires typing DELETE, disables the destructive button until it matches, and shows "Deleting…" while busy (`Settings.tsx:264-289`). On phones the Modal becomes a bottom sheet (`Modal.tsx:74,83`), within thumb reach.
3. **Graceful degradation for voice.** Browsers without speech output or recognition get plain notices that voice mode still works with typing (`Settings.tsx:176-177`). The voice picker only lists English voices and labels the automatic choice with the actual voice name (`:181`).

### Priority Issues

**[P1] Closing the delete dialog throws keyboard focus to the top of the document**
- **What:** After opening "Delete account…" and pressing Esc, Cancel or ✕, focus lands on `<body>`, not on the "Delete account…" button (verified live on desktop and phone with a focusin trace). Cause: the confirm input has `autoFocus` (`Settings.tsx:278`). React focuses it during commit, *before* `Modal`'s `useEffect` runs, so `previous = document.activeElement` (`Modal.tsx:43`) captures the dialog's own input. On close, `previous.focus()` (`:68`) targets a detached node. The Modal's docstring promises "focus returns on close". The same bug affects any Modal whose child uses `autoFocus`.
- **Why it matters:** Keyboard and screen-reader users (Sam) are thrown to the top of the page at the most anxious moment on the surface, right after backing out of deleting their account. WCAG 2.4.3 Focus Order.
- **Fix:** Remove `autoFocus` from `Settings.tsx:278` (Modal already focuses the first input at `Modal.tsx:62-65`). Then harden Modal: capture the opener in a `useRef` during render when `open` flips to true (or in `useLayoutEffect` on the parent), and in the cleanup skip `previous` if it is inside the panel or no longer `isConnected`. Also stop the effect from re-running on every render: `onClose` is a fresh arrow each render (`Settings.tsx:265`), so keep it in a ref and depend only on `open`.
- **Suggested command:** `/impeccable harden`

**[P1] Every confirmation and error is a 3-second, unannounced toast, and most saves give no feedback at all**
- **What:** `ToastProvider` renders toasts in a plain `div` with no `role="status"`/`aria-live` (`useToast.tsx:44`), dismissing after 3000 ms (`:36`). Settings sends its most important messages through it: the ~120-character email confirmation instructions (`Settings.tsx:76`), "Password updated." (`:86`) and raw Supabase errors (`:74,84`). Name (`:136`), time zone (`:140`), theme, voice, sliders and switches save with no "Saved" signal, and `useUpdateProfile` rolls back failures silently (`useProfile.ts:40`).
- **Why it matters:** A student changing email has 3 seconds to read that they must click *two* links, or they will think it failed. Screen-reader users hear nothing. A failed name save reverts the field without telling anyone.
- **Fix:** Give the toast container `role="status" aria-live="polite"` (`role="alert"` for errors). Scale the timeout to length (≈ 60 ms per character, minimum 4 s) and pause on hover/focus. For the email change, replace the toast with a persistent inline note under the Email row ("Pending: confirm from maya@… and new@…") until the change lands. Add a quiet inline "Saved" tick per row for auto-saving fields, and an error toast in `useUpdateProfile.onError`.
- **Suggested command:** `/impeccable harden`

**[P1] Row hints and the light-theme Delete button fail contrast**
- **What:** Every row hint uses `.faint` = `text-slate-500` (#64748b) at 12px (`Settings.tsx:28`, `index.css:66-67`). On the dark card (white 5% over #08070f ≈ #14131b) that is **3.88:1**. The hints carry the most important safety copy on the page ("This can't be undone", "Your mic stays on…"). In light mode the "Delete account…" button text (`text-rose-600` on `rose-500/15`, `index.css:86-87`) is **≈3.8:1** at 14px semibold.
- **Why it matters:** WCAG 1.4.3 AA failure on the exact text that warns users about irreversible or privacy-relevant actions, and DESIGN.md already notes the faint tier fails on dark.
- **Fix:** Use `.muted` (slate-400 on dark, 7.2:1) for row hints, or lift `.faint` to slate-400 in dark. For `.btn-danger` in light, use `text-rose-700` (#be123c), which clears 4.5:1 on the tint.
- **Suggested command:** `/impeccable polish`

**[P2] Undersized, inconsistent controls for thumbs: 36×20 switches, 26px theme chips, 16px sliders, labels that don't toggle**
- **What:** Measured live at 390px: `Switch` is 36×20 (`Switch.tsx:13`), Theme chips 71×26 / 73×26 (`Settings.tsx:150-164`, `.chip`), and range inputs 192×16 at a fixed `w-48` that leaves half the phone row empty (`:198,201`). The switch rows render a `<label>` with no `htmlFor` (`Settings.tsx:25` via `Row`), so tapping "Speak replies aloud" does nothing, unlike tapping "Name". The Theme `radiogroup` has two Tab stops and no arrow keys.
- **Why it matters:** Casey adjusts voice settings one-handed. 20px-tall switches and 16px slider tracks invite mis-taps and accidental slider jumps, each of which writes to the server.
- **Fix:** Make the whole switch row the hit target: give `Switch` an `id` and pass `htmlFor`, or render the Row as a `<label>` wrapping the switch. Grow the Switch to 44×24 with a ≥44px hit area. Make the sliders `w-full sm:w-48` with a taller track and a 24px thumb. Give the theme control a segmented-control treatment of ≥40px height, with roving tabindex and arrow keys.
- **Suggested command:** `mobile-native`

**[P2] Violet/gradient emphasis everywhere the direction says neutral**
- **What:** Gradient `h1` "Settings" (`PageHeader.tsx:40`, `.gradient-text`), violet→blue gradient switch track (`Switch.tsx:14`), `accent-violet-600` sliders (`Settings.tsx:198,201`), violet `chip-on` for the selected theme (`index.css:140-141`), violet `.link` for Terms/Privacy and "exporting your data", and a violet focus ring (`index.css:30`).
- **Why it matters:** This surface is pure Operate. The confirmed direction is neutral near-white emphasis, cyan only for Atlas, no gradients. As shipped, Settings reads as "brand moodboard", not "Clear Head".
- **Fix:** Solid near-white (dark) / near-black (light) for the switch "on" track, slider fill (`accent-slate-100` / custom thumb) and selected segment. Solid-ink `h1`. Neutral underline links. Optionally a single cyan Atlas mark on the "Atlas voice" card title, the only legitimate colour on the page.
- **Suggested command:** `/impeccable quieter`

**[P2] The danger zone isn't a zone, and the dialog's escape hatches are loose**
- **What:** "Delete account" is the second row of the "Your data" card (`Settings.tsx:253-257`), visually equal to "Export everything". In the dialog:
  - the "exporting your data" link (`:274`) starts an export with no progress shown inside the dialog (the "Preparing…" label is on the page button behind the overlay);
  - the confirm text persists after cancelling (typing "delete", closing and reopening still shows "delete", verified live; `confirmText` at `:57` is never reset);
  - lowercase "delete" leaves the button disabled with no explanation;
  - the dialog has no `aria-describedby`, so the "There is no undo" description isn't announced with the dialog name (`Modal.tsx:76-80`).
- **Why it matters:** The one irreversible action on the page deserves its own clearly separated, calm "Delete account" group (as the product brief describes it). Silent states in the dialog make users doubt whether export worked before they delete.
- **Fix:** Move Delete into its own last card with a hairline rose border and a one-line consequence. Reset `confirmText` on close. Accept a case-insensitive match, or say "Type DELETE in capitals". Show export progress inline in the dialog ("Preparing your file…" → "Downloaded ✓"). Wire `aria-describedby` to the description `<p>` in Modal.
- **Suggested command:** `/impeccable clarify`

### Persona Red Flags

**Casey (distracted mobile user):** The page is 2,383px tall at 390px (about 2.8 screens) with no section jump. The Atlas orb and "+" FAB float over the card's right edge (phone screenshot, Profile card at y≈1360). Speed and Pitch sliders are 16px-tall, fixed 192px tracks. Switches are 20px tall, and tapping their label does nothing. Choosing a time zone means scrolling a 419-item native list with no "Use my device's zone" shortcut. If Casey changes email and glances away, the 3-second toast with the two-link instructions is gone.

**Sam (keyboard / screen reader):** Toasts ("Password updated.", errors, email instructions) are never announced (no live region). Closing the delete dialog drops focus to `<body>`. The dialog's "no undo" description isn't programmatically linked. Row hints are 3.88:1 in dark. The Theme radiogroup breaks the ARIA radio pattern: two Tab stops, no arrows. On the plus side, both switches have `role="switch"` + `aria-checked` + `aria-label`, every text field has a real `<label for>`, and the focus ring is visible on every control (a 2px slate-100 offset plus a violet-400 ring, verified live).

**Jordan (first-timer student):** "Download JSON" means nothing to a student. "Export everything as one JSON file" doesn't say what they can do with it. "Pitch · 0.85" exposes a raw number with no idea of what's normal (and the default 0.85 isn't marked as default). After typing a new password and pressing Update there is no confirm field. A typo is only discoverable at the next login, via password reset.

### Cognitive Load

Checklist failures (3 of 8, moderate):
- **Chunking:** "Atlas voice" has 5 controls plus 2 conditional notices, and "Account" has 5 rows (6 for admins). Account mixes credentials, an AI quota readout, a session action and an admin link.
- **Visual hierarchy:** Every row has equal weight, so the irreversible Delete row is distinguished only by button colour.
- **Minimal choices:** The time zone select offers 419 flat options with no suggestion.

Decision points with more than 4 options: the time zone select (419), the voice select (all installed English voices, often 10–40 on macOS), and the Account card's 5–6 sibling rows.

### Minor Observations

- The "Log out" row label duplicates its button text "Log out" (`Settings.tsx:232-235`). Drop the label or say "Signed in as maya@…".
- "Replay tour" navigates to `/app` and starts the tour after a fixed `setTimeout(startTour, 300)` (`:168`). On a slow phone the lazy Dashboard may not be mounted yet, and the tour then anchors to missing targets.
- When there are no voices, the voice `<select>` is disabled but "Test" stays enabled (`:180,190`). When speech recognition is unsupported, the "Hey Atlas" switch can still be turned on (`:207`).
- Emoji in the Theme chips (🌙 / ☀️) and the ✨ in the "AI allowance" label add decoration to an otherwise plain page. The ✨ is at least consistent with the app-wide AI marker.
- There is no "Reset voice to defaults", and the default values (1.00×, 0.85) aren't marked.
- The AI allowance shows "—" while loading, with no skeleton. That's acceptable, but it reads as "no allowance".
- The Terms · Privacy links are 15px tall violet text (`:259-261`).

## Audit

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | Dark-theme row hints at 3.9:1 (11 detector hits per dark desktop scan). The light Delete button is 3.7:1. Focus is lost after the delete dialog closes. Toasts have no live region. |
| 2 | Performance | 3 | Each slider step fires a Supabase `update` (≈15 writes per drag, and out-of-order responses can snap the slider back). Otherwise light: one page, no images, export runs its queries one after another. |
| 3 | Theming | 2 | Both themes are complete, but colour comes from raw Tailwind literals, not tokens. The Modal hard-codes `dark:bg-[#13111f]`. Violet/gradient emphasis contradicts the direction. |
| 4 | Responsive Design | 3 | Rows stack cleanly at 390px with no horizontal scroll (scrollWidth 390). Switches are 36×20, chips 26px tall, sliders 16px tall and fixed at 192px. |
| 5 | Implementation Integrity | 2 | Several verified issues: Modal's "focus returns on close" promise is broken, "Export everything" silently caps each table at 50,000 rows, and gradient/violet drift is still in the shared primitives. |
| **Total** | | **12/20** | **Acceptable** |

**Implementation Integrity Verdict: fail (narrowly).** The page's structure and copy are product-specific and honest. Two shared primitives on this surface break their own contracts. `Modal` documents "focus returns on close" but loses focus whenever a child uses `autoFocus`. "Export everything" truncates at 50,000 rows per table without saying so (`Settings.tsx:94`), which runs against PRODUCT.md's "Honest by default" and "Your data is yours".

### Detector findings

Per-scan counts (rendered CDP scans):

| Rule | dark-desktop | dark-phone | light-desktop | light-phone | Verdict |
|---|---|---|---|---|---|
| low-contrast: `p.faint.text-xs` row hints (#64748b on #14131b, 3.9:1) | 11 | 10 | 0 | 0 | **Real (P1).** Matches my 3.88:1 calculation. Light passes at 4.59:1. |
| low-contrast: `#s-email` / `#s-pass` placeholders | 2 (3.4:1) | 2 | 2 (2.5:1) | 2 | **Real (P2).** Visible `<label>`s exist, so this isn't blocking, but the placeholder is the only example of the format. |
| low-contrast: `button.btn-danger` (#e11d48 on #f8dfe5, 3.7:1) | 0 | 0 | 1 | 1 | **Real (P1).** The light-theme "Delete account…" button. |
| low-contrast: `span.flex.h-8` (white on pink gradient avatar) | 1 | 1 | 1 | 1 | Real but **out of surface**: the TopBar avatar (`TopBar.tsx:70`). Slated for removal with gradients. |
| gradient-text: `h1.gradient-text` | 1 | 1 | 1 | 1 | **Real (P2).** The "Settings" title (`PageHeader.tsx:40`, `index.css:59-62`). Already slated for removal per DESIGN.md. |
| gradient-text: `span.gradient-text.text-lg` | 1 | 0 | 1 | 0 | Shell (sidebar logo wordmark). Out of surface, slated for removal. |
| ai-color-palette: violet gradient (logo mark, avatar) | 2 | 2 | 2 | 2 | Shell. Slated for removal per direction. |
| ai-color-palette: "Purple/violet accent colors detected" (`body`) | 1 | 1 | 1 | 1 | **Real.** On this surface it covers the violet switch, sliders, chip-on, links and focus ring. Slated for removal. |
| ai-color-palette: "Cyan gradient background" `span.absolute.inset-[18%]` | 1 | 1 | 1 | 1 | **False positive.** That is the Atlas orb, and cyan is intentionally reserved for Atlas. |
| dark-glow: `button.flex.h-12` (#4c1d95, the capture "+" FAB) | 1 | 1 | 0 | 0 | Real, shell-level. Violet glow slated for removal. |
| dark-glow: `button.group.flex` (#164e63, the Atlas orb) | 1 | 1 | 0 | 0 | **False positive under the direction.** The orb is Atlas, and its cyan halo is Atlas identity. Worth toning down, not removing. |
| overused-font: Inter 100% | 1 | 1 | 1 | 1 | **False positive / accepted.** DESIGN.md deliberately uses one sans for the product UI (operate.md: "One family is often right"). |
| straggler: "one." / "open." orphan words in hints | 0 | 2 | 0 | 2 | **Real, P3.** The export and wake phrase hints at 390px. |
| **Total** | **23** | **23** | **11** | **12** | |

Source scan (`src_scan_all`) hits relevant to this surface: `Switch.tsx:14` (violet→blue gradient, **real**, and not flagged by the rendered scans because the switch is a non-text element), `index.css:60-61` (gradient-text, real) and `index.css:79` (`.btn-primary` gradient, not used on Settings). The rest are other surfaces: the VoiceHud grid (intended showpiece), CalendarCard, GoalCard, Planner, Logo and TopBar.

**What the detector missed** (found in the critique and live probes): the Modal focus-loss bug, toasts with no live region, the 36×20 switches, 26px chips and 16px sliders, labels that don't toggle switches, the per-step slider writes, the silent 50,000-row export cap, and the stale DELETE confirm text.

### Findings by severity

**[P1] Focus is lost to `<body>` when the delete dialog closes**
- **Location:** `src/components/ui/Modal.tsx:43,68` (with `src/pages/app/Settings.tsx:278` `autoFocus`, and `:265` inline `onClose` that re-runs the effect every render)
- **Category:** Accessibility / Implementation Integrity
- **Impact:** Keyboard and screen-reader users are thrown to the top of the document after cancelling account deletion. Verified live with a focusin trace: no focus event fires on the opener.
- **WCAG:** 2.4.3 Focus Order (A)
- **Recommendation:** Drop `autoFocus`. In Modal, capture the opener before children commit (a ref set during render when `open` becomes true), ignore it if it is inside the panel or disconnected, keep `onClose` in a ref, and depend only on `open`.
- **Suggested command:** `/impeccable harden`

**[P1] Toasts are silent to assistive tech and too short for their content**
- **Location:** `src/hooks/useToast.tsx:36,44`. Consumers: `src/pages/app/Settings.tsx:74,76,80,84,86,105,118`. Silent profile errors: `src/hooks/useProfile.ts:40`
- **Category:** Accessibility
- **Impact:** "Password updated.", the two-link email instructions and every error go unannounced and disappear after 3 s.
- **WCAG:** 4.1.3 Status Messages (AA), 2.2.1 Timing Adjustable (A)
- **Recommendation:** `role="status" aria-live="polite"` on the container (`role="alert"` for errors). A length-scaled timeout of at least 4 s, paused on hover/focus. A persistent inline "pending email change" note. An error toast in `useUpdateProfile.onError`.
- **Suggested command:** `/impeccable harden`

**[P1] Row hints (dark) and the Delete button (light) fail text contrast**
- **Location:** `src/pages/app/Settings.tsx:28` (`.faint`), `src/index.css:66-67`, `src/index.css:86-87` (`.btn-danger`)
- **Category:** Accessibility
- **Impact:** The safety copy ("can't be undone", "mic stays on") is 3.9:1 at 12px on dark, and the destructive button label is 3.7:1 on light.
- **WCAG:** 1.4.3 Contrast (Minimum) (AA)
- **Recommendation:** Use `.muted` for hints (7.2:1 dark) or raise `.faint` to slate-400 in dark. Use `text-rose-700` for `.btn-danger` in light.
- **Suggested command:** `/impeccable polish`

**[P2] Placeholder text below 4.5:1 on the Email and Password fields**
- **Location:** `src/pages/app/Settings.tsx:215,223`, `src/index.css:69-72` (`placeholder:text-slate-400` / `dark:placeholder:text-slate-500`)
- **Category:** Accessibility
- **Impact:** 2.5:1 (light) and 3.4:1 (dark). Mitigated by the visible labels.
- **WCAG:** 1.4.3 (advisory for placeholders)
- **Recommendation:** Placeholder slate-500 in light and slate-400 in dark, or remove the placeholders and rely on the label plus the hint.
- **Suggested command:** `/impeccable polish`

**[P2] Touch targets and label hit areas are too small on phone**
- **Location:** `src/components/ui/Switch.tsx:13` (36×20), `src/pages/app/Settings.tsx:150-164` (chips 71×26), `:198,201` (`w-48` ranges, 16px tall), `:21-33` (`Row` renders `<label>` with no `htmlFor` for switches and the theme control), `:150` (radiogroup without roving tabindex / arrow keys)
- **Category:** Responsive / Accessibility
- **Impact:** Mis-taps on a page where every tap writes to the server. Switch labels aren't tappable. The radio pattern doesn't match ARIA expectations.
- **WCAG:** 2.5.8 Target Size (Minimum) passes on spacing, but this is below the 44px platform guidance. ARIA APG radio group pattern.
- **Recommendation:** Switch at least 44×24 with a full-row hit area via `htmlFor`/`id`. Sliders `w-full sm:w-48` with a 24px thumb. The theme control as a ≥40px segmented control with arrow keys.
- **Suggested command:** `mobile-native`

**[P2] Sliders write to the database on every step**
- **Location:** `src/pages/app/Settings.tsx:66,198,201`, `src/hooks/useProfile.ts:25-42`
- **Category:** Performance / Implementation Integrity
- **Impact:** Dragging Speed from 0.7 to 1.4 issues about 14 `profiles.update` calls. `onSuccess` writes each server response back into the cache, so a late older response can snap the thumb back. Nothing is spoken while adjusting.
- **Recommendation:** Keep local slider state. Commit on `pointerup`/`change` end (or debounce 300 ms). Preview the voice on release with the Test phrase.
- **Suggested command:** `/impeccable harden`

**[P2] "Export everything" silently caps each table at 50,000 rows**
- **Location:** `src/pages/app/Settings.tsx:19,94,248`
- **Category:** Implementation Integrity
- **Impact:** The hint promises every item. A long-time user's `habit_logs` or `atlas_messages` could be truncated with no warning. This breaks the "honest numbers / your data is yours" commitments. Export runs 15 queries one after another with only "Preparing…" as feedback, and none inside the delete dialog.
- **Recommendation:** Page through with `.range()` until exhausted (or run the export server-side), add a `counts` object to the file, and show "Exported N items" on completion, both inline and in the dialog.
- **Suggested command:** `/impeccable harden`

**[P2] Violet/gradient emphasis on Settings controls**
- **Location:** `src/components/ui/Switch.tsx:14`, `src/pages/app/Settings.tsx:198,201` (`accent-violet-600`), `src/components/ui/PageHeader.tsx:40` (`.gradient-text`), `src/index.css:30,97-98,140-141`
- **Category:** Theming
- **Impact:** Contradicts the confirmed direction (neutral near-white emphasis, no gradients, cyan only for Atlas).
- **Recommendation:** Neutral solid tokens for the on-state, slider fill, selected segment, links and focus ring. Solid `h1`.
- **Suggested command:** `/impeccable quieter`

**[P2] The danger zone isn't separated, and the dialog state is sticky**
- **Location:** `src/pages/app/Settings.tsx:253-257` (Delete inside "Your data"), `:57,265` (`confirmText` never reset), `:270,284` (case-sensitive match with no hint), `:274` (export link with no in-dialog progress), `src/components/ui/Modal.tsx:76-80` (no `aria-describedby`)
- **Category:** Implementation Integrity / Accessibility
- **Impact:** The irreversible action looks like a sibling of Export. A stale "delete" reappears on reopen. "There is no undo" isn't announced with the dialog name.
- **Recommendation:** Give Delete its own final card. Reset state on close. Add a capitals hint or accept case-insensitive input. Show export status in the dialog. Add `aria-describedby`.
- **Suggested command:** `/impeccable clarify`

**[P3] Orphaned last words in hints on phone**
- **Location:** `src/pages/app/Settings.tsx:28` (export hint "…one." and wake phrase hint "…open.")
- **Category:** Implementation Integrity (typography)
- **Impact:** Ragged two- and three-line hints.
- **Recommendation:** `text-wrap: pretty` on `.faint`/hint paragraphs.
- **Suggested command:** `/impeccable typeset`

**[P3] Modal and cards hard-code the tinted dark surface and blur glass**
- **Location:** `src/components/ui/Modal.tsx:75,83` (`dark:bg-[#13111f]`, `backdrop-blur-sm`), `src/components/ui/Card.tsx:16` / `src/index.css:52-54` (`.glass` with `backdrop-blur-xl`)
- **Category:** Theming / Performance
- **Impact:** A violet-tinted panel colour outside any token. Blur cost on every card. Both conflict with "neutral near-black, tactile solid surfaces".
- **Recommendation:** A `--surface-raised` token (neutral) and solid card fills with one shallow shadow.
- **Suggested command:** `/impeccable quieter`

**[P3] Password change has no confirmation field or reveal toggle**
- **Location:** `src/pages/app/Settings.tsx:221-228`
- **Category:** Implementation Integrity (error prevention)
- **Impact:** A typo in a masked field is only discovered at the next login.
- **Recommendation:** Add a show/hide toggle (preferred on mobile over a second field), and keep the 8-character check inline rather than in a toast.
- **Suggested command:** `/impeccable harden`

### Positive findings

- Every text field has a real `<label for>` (`Name`, `Time zone`, `Voice`, `Speed`, `Pitch`, `Email`, `Password`), and both switches expose `role="switch"`, `aria-checked` and `aria-label` (`Switch.tsx:5-9`).
- A visible focus ring on every control, verified live: a 2px offset plus a 2px ring (`index.css:29-31`). Tab order follows the visual order top to bottom, then the shell (verified at both sizes).
- Modal traps Tab, closes on Esc and the backdrop, and becomes a bottom sheet on phones (`Modal.tsx:44-58,74,83`).
- The destructive submit is disabled until the exact phrase is typed, with a busy label (`Settings.tsx:284-286`). Email change uses Supabase's secure double confirmation with a redirect back to `/auth/callback` (`:72`).
- No horizontal overflow at 390px (scrollWidth 390). Rows switch from side-by-side to stacked at `sm` (`:23`).
- Speech support is feature-detected, with honest fallbacks (`speech.ts:13-14`, `Settings.tsx:176-177`).

## Motion on this surface

| Animation | Where | Trigger | Duration / easing | Earns its place? |
|---|---|---|---|---|
| Card fade + 4px rise | `src/components/ui/Card.tsx:16` (`animate-fade-in`), `tailwind.config.js:12-15` | All four cards on every visit to Settings | 250ms `ease-out`, all at once | **No.** A page-load sequence on an Operate surface that conveys no state. Remove it for Settings cards (`remove-animations`). |
| Modal fade + rise | `src/components/ui/Modal.tsx:83` (`animate-fade-in`) | Opening "Delete account…" | 250ms `ease-out`. No exit animation, and the backdrop appears instantly | **Yes, mostly.** It signals the context change. Trim to ~180ms, and on phone a slide-up from the bottom would match the sheet shape. The missing exit makes close feel abrupt but quick, which is acceptable. |
| Switch thumb slide | `src/components/ui/Switch.tsx:17` (`transition-all`, `left` 2px→18px) | Toggling Speak replies / Hey Atlas | Tailwind default 150ms `cubic-bezier(0.4,0,0.2,1)` | **Yes**: state feedback. But it animates `left` (a layout property) via `transition-all`. Use `transform: translateX()` with `transition-transform` (`animation-performance`). The track's gradient↔grey swap doesn't interpolate (`transition` on a background-image). |
| Button press scale | `src/index.css:74-76` (`.btn` `active:scale-[0.97]` + `transition`) | Pressing Replay tour, Test, Change, Update, Log out, Download JSON, Delete | 150ms default | **Yes.** Tactile press feedback, in line with the "tactile, confident" direction. |
| Input focus border/ring | `src/index.css:69-72` (`.input` `transition`) | Focusing any field | 150ms | **Yes.** Subtle state change. |
| Chip hover / state | `src/index.css:132-141` (`.chip` `transition`) | Hover/select on the Theme chips | 150ms | Neutral. Fine. |
| Toast enter/exit with layout | `src/hooks/useToast.tsx:47-52` (framer-motion `initial {opacity 0, y 20, scale .95}`, `layout`) | Every save/error message on this page | Framer default spring | **Yes**, it announces arrival. But there is no `MotionConfig reducedMotion="user"` anywhere in `src`, and the global CSS kill (`index.css:32-40`) doesn't reach framer's JS animations, so toasts still move under reduced motion. Add `<MotionConfig reducedMotion="user">` at the root. |
| Theme switch | `applyTheme` (`useProfile.ts:66-67`) toggles `.dark` instantly | Clicking Dark/Light | Instant (every element's own `transition` briefly animates colours) | Acceptable. Instant is right for a theme swap. |
| Replay tour delay | `Settings.tsx:168` `setTimeout(startTour, 300)` | Replay tour | 300ms fixed wait | Not an animation but a timing hack. It should wait for the Dashboard's tour targets instead (`/impeccable harden`). |

The global reduced-motion rule (`index.css:32-40`) cuts every CSS animation and transition to 0.01ms. That is acceptable here because no Settings motion carries information that isn't also shown statically.

## Machine-readable summary

```json
{"surface":"settings","critique_total":25,"critique_max":40,"na_heuristics":[],"audit_total":12,
 "issues":[
  {"id":"settings-1","severity":"P1","title":"Delete dialog close drops keyboard focus to <body>","fix":"Remove autoFocus from the DELETE input; in Modal capture the opener before children commit, ignore it if inside the panel or disconnected, keep onClose in a ref and depend only on open","command":"/impeccable harden","files":["src/components/ui/Modal.tsx:43","src/components/ui/Modal.tsx:68","src/pages/app/Settings.tsx:278","src/pages/app/Settings.tsx:265"],"source":"both"},
  {"id":"settings-2","severity":"P1","title":"Toasts unannounced and 3 s long; profile saves silent, errors silent","fix":"role=status aria-live=polite (alert for errors), length-scaled timeout >=4s paused on hover/focus, persistent inline pending-email note, inline Saved tick, error toast in useUpdateProfile.onError","command":"/impeccable harden","files":["src/hooks/useToast.tsx:36","src/hooks/useToast.tsx:44","src/hooks/useProfile.ts:40","src/pages/app/Settings.tsx:76","src/pages/app/Settings.tsx:136"],"source":"both"},
  {"id":"settings-3","severity":"P1","title":"Row hints 3.9:1 in dark; light Delete button 3.7:1","fix":"Use .muted (slate-400 dark) for row hints; text-rose-700 for .btn-danger in light","command":"/impeccable polish","files":["src/pages/app/Settings.tsx:28","src/index.css:66","src/index.css:86"],"source":"both"},
  {"id":"settings-4","severity":"P2","title":"Email/password placeholders below 4.5:1","fix":"placeholder slate-500 light / slate-400 dark, or drop placeholders","command":"/impeccable polish","files":["src/index.css:69","src/pages/app/Settings.tsx:215","src/pages/app/Settings.tsx:223"],"source":"audit"},
  {"id":"settings-5","severity":"P2","title":"36x20 switches, 26px theme chips, 16px fixed-width sliders; switch labels not tappable; radiogroup lacks arrow keys","fix":"44x24 switch with full-row hit area via htmlFor/id; w-full sm:w-48 sliders with 24px thumb; >=40px segmented theme control with roving tabindex","command":"mobile-native","files":["src/components/ui/Switch.tsx:13","src/pages/app/Settings.tsx:21","src/pages/app/Settings.tsx:150","src/pages/app/Settings.tsx:198","src/pages/app/Settings.tsx:201"],"source":"both"},
  {"id":"settings-6","severity":"P2","title":"Speed/Pitch sliders write to Supabase on every step and can snap back","fix":"Local slider state, commit on release or 300ms debounce, speak a preview on release","command":"/impeccable harden","files":["src/pages/app/Settings.tsx:66","src/pages/app/Settings.tsx:198","src/pages/app/Settings.tsx:201","src/hooks/useProfile.ts:41"],"source":"audit"},
  {"id":"settings-7","severity":"P2","title":"Export everything silently caps each table at 50,000 rows","fix":"Page with .range() until exhausted or export server-side; include counts; confirm 'Exported N items' inline and in the delete dialog","command":"/impeccable harden","files":["src/pages/app/Settings.tsx:94","src/pages/app/Settings.tsx:248"],"source":"audit"},
  {"id":"settings-8","severity":"P2","title":"Violet/gradient emphasis (h1, switch, sliders, chip-on, links, focus ring) against neutral direction","fix":"Neutral near-white/near-black solid tokens for on-states, slider fill, selected segment, links, focus ring; solid h1","command":"/impeccable quieter","files":["src/components/ui/Switch.tsx:14","src/pages/app/Settings.tsx:198","src/components/ui/PageHeader.tsx:40","src/index.css:30","src/index.css:140"],"source":"both"},
  {"id":"settings-9","severity":"P2","title":"Delete account not separated from Export; dialog state sticky and under-described","fix":"Own final Delete card; reset confirmText on close; capitals hint or case-insensitive; in-dialog export status; aria-describedby on Modal","command":"/impeccable clarify","files":["src/pages/app/Settings.tsx:253","src/pages/app/Settings.tsx:57","src/pages/app/Settings.tsx:274","src/components/ui/Modal.tsx:76"],"source":"both"},
  {"id":"settings-10","severity":"P3","title":"Orphaned last words in hints on phone","fix":"text-wrap: pretty on hint paragraphs","command":"/impeccable typeset","files":["src/pages/app/Settings.tsx:28"],"source":"audit"},
  {"id":"settings-11","severity":"P3","title":"Tinted hard-coded modal surface and blur glass cards","fix":"Neutral --surface-raised token, solid card fills, one shallow shadow","command":"/impeccable quieter","files":["src/components/ui/Modal.tsx:83","src/components/ui/Card.tsx:16","src/index.css:52"],"source":"audit"},
  {"id":"settings-12","severity":"P3","title":"Password change has no reveal toggle or inline validation","fix":"Show/hide toggle and inline 8-character check","command":"/impeccable harden","files":["src/pages/app/Settings.tsx:221"],"source":"critique"},
  {"id":"settings-13","severity":"P3","title":"Cards fade in on every Settings visit; toasts ignore reduced motion","fix":"Remove card mount fade on Settings; add MotionConfig reducedMotion='user' at root; switch thumb via transform","command":"remove-animations","files":["src/components/ui/Card.tsx:16","src/hooks/useToast.tsx:47","src/components/ui/Switch.tsx:17"],"source":"audit"}
 ]}
```
