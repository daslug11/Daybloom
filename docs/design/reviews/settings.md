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
