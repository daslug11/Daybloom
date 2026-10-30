# Atlas panel: critique & audit (Phase 1 baseline)

Method: design review (sub-agent, screenshots + source + live app) → then detector evidence (Phase 0 CDP scans, both themes, desktop + phone)

Evidence used for the critique: the four `atlas.jpg` screenshots (dark/light × desktop/phone), the source files listed below, and a read-only Playwright probe of the live app (`.scratch/atlas-review/probe.cjs`). The probe only intercepted network responses in the browser (empty history, 0 allowance, one fake pending deletion) to see the empty, limit-reached and confirm states. It sent no messages, made no AI calls and changed no data.

Source: `src/components/atlas/AtlasPanel.tsx`, `src/components/atlas/AtlasOrb.tsx`, `src/components/plans/PlanCard.tsx`, `src/components/notes/Markdown.tsx`, `src/hooks/data/atlas.ts`, `src/lib/api.ts` (`atlasStream`), plus `src/components/layout/AppShell.tsx`, `src/components/ui/Ai.tsx`, `src/components/ui/Modal.tsx`, `src/index.css`, `tailwind.config.js`, `server/ai/atlas/handler.ts`.

## Critique

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | The pulsing orb with "Atlas is thinking…", the cyan streaming caret, the "What Atlas did" lines and the allowance pill are all good. But a **failed** action still shows a ✓ tick, only coloured rose (`AtlasPanel.tsx:276-277`). |
| 2 | Match System / Real World | 3 | The copy is plain and honest ("Each reply uses one of your daily AI actions"). The confirm card reads awkwardly: "Confirm: Delete the task "…"?" (`:198`). |
| 3 | User Control and Freedom | 2 | You can't stop a reply while it streams. Pressing Esc inside the Add to Planner dialog also closes the whole Atlas panel. On an error, the message you typed disappears. Clearing the conversation can't be undone. |
| 4 | Consistency and Standards | 2 | Most of the panel's colour is violet (user bubbles, gradient Send, allowance pill, Regenerate, input ring) even though cyan is Atlas's colour. A ✓ icon appears on failed actions and on the destructive Confirm button. Disabled suggestion chips look enabled. |
| 5 | Error Prevention | 3 | Deletions are confirmed first and clearing uses an inline confirm strip, both good. But Confirm/Cancel have no busy state, so a double tap sends the request twice, and Esc in a nested dialog throws away the panel. |
| 6 | Recognition Rather Than Recall | 3 | The empty state's four suggestions teach what Atlas can do. They disappear for good once any history exists, and there's no "what can you do?" path after that. |
| 7 | Flexibility and Efficiency | 3 | ⌘/Ctrl+J toggles the panel, Enter sends, Shift+Enter adds a line, Esc closes, and the dashboard "Ask" pre-fills a message. There's no stop shortcut and no "retry last". |
| 8 | Aesthetic and Minimalist Design | 2 | The gradient + glow "Add to Planner" button is the loudest thing in the panel. The header's trust sentence is cut off ("can read a…" on phone). The plan card's four buttons wrap and leave Dismiss alone on its own row (desktop). |
| 9 | Error Recovery | 2 | An error shows a clear rose `role="alert"` box. But the user's message is dropped from view and from the input, and there's no Retry (`AtlasPanel.tsx:93-99`). |
| 10 | Help and Documentation | 3 | The empty state explains what Atlas can do and what each reply costs, and the footer gives keyboard hints. The hints show on phones, where they don't apply. |
| **Total** | | **26/40** | **Acceptable** |

### Design Specificity Verdict

The panel is **partly authored, partly generic**. Two pieces are specific to Daybloom: the plan card (a real draft plan with sessions, start date, and "Add to Planner / Edit / Regenerate / Dismiss") and the "What Atlas did" receipts under each reply (e.g. "✓ Drafted plan "Stats exam revision""). Together they deliver PRODUCT.md's promise that Atlas "acts on the user's real data, confirms before deleting, and says what it changed". The amber confirm-before-delete card and the always-visible allowance pill make "optional, limited AI" concrete.

The chat shell around them is the stock AI-chat layout: a right slide-over, coloured right-aligned user bubbles, grey left-aligned assistant bubbles, a pill composer, and a centred orb + greeting + suggestion chips. Swap the orb and this could be any SaaS copilot. The biggest missed opportunity is colour identity. Atlas is supposed to *be* cyan, but in the screenshots cyan only appears in the 28px header orb, the streaming caret and the plan card's border and bullets. The user's own bubbles (`bg-violet-600`, `AtlasPanel.tsx:259`), the gradient Send button (`:241`, `.btn-primary`), the violet allowance pill and the violet input focus ring dominate the panel. The visual voice is "the generic violet app" with a cyan dot, not "Atlas". The refined, quietly witty British character only comes through in Atlas's written replies, not in the UI.

### What's Working

1. **Action receipts and plan cards make the AI accountable.** Every tool call is listed under the reply (`AtlasPanel.tsx:273-281`), and any plan Atlas drafted appears inline as a live card that reads its current status ("On your Planner", "Dismissed" with Restore; `PlanCard.tsx:55-98`). That is the "honest by default" commitment done properly: the user sees exactly what changed and can act on it without leaving the chat.
2. **Deletions are confirmed separately from the conversation, on the server.** Destructive tools create an `atlas_pending_actions` row and the panel renders an amber card with "This can't be undone." and an explicit Confirm/Cancel (`:196-209`). Atlas can't delete anything without a click from the user. Clearing the conversation uses a lightweight inline strip ("Clear your whole conversation with Atlas?" Clear / Keep, `:155-165`) instead of a modal, which fits Operate mode.
3. **The cost and limit states are honest and non-blocking.** The empty state says "Each reply uses one of your daily AI actions". The composer footer always shows "✨ N left today". At zero, the textarea is disabled with "AI is unavailable right now" and an amber line explains "You've used today's AI allowance. It resets at midnight UTC." (`:219`). Nothing breaks and nothing nags.

### Priority Issues

**[P1] Esc in a dialog opened from a plan card also closes the whole Atlas panel**
- *What*: `AtlasPanel` listens for Escape on `window` (`AtlasPanel.tsx:62-69`), and so does `Modal` (`Modal.tsx:24-25`). Neither stops propagation. In the live app, opening "Add to Planner" from the plan card and pressing Esc closed **both** the dialog and the Atlas panel (2 dialogs → 0). The same happens with Esc while the "Clear conversation?" strip is open: the whole panel closes instead of just cancelling the strip.
- *Why it matters*: Esc is the standard "go back one step". Here it throws away the chat and any half-typed message, and it lands the user on the dashboard. It also aborts a streaming reply (`abort.current?.abort()` on unmount).
- *Fix*: Close only the topmost layer. In the panel's handler, return early if `e.defaultPrevented` or if a nested `[role=dialog]` other than the panel exists. Have `Modal` call `e.preventDefault(); e.stopPropagation()` when it handles Escape. Make Esc cancel `confirmClear` first when it's open.
- *Suggested command*: `/impeccable harden`

**[P1] The panel says it's modal but doesn't keep or return focus**
- *What*: The panel has `role="dialog" aria-modal="true"` (`:133`), but it has no focus trap and doesn't restore focus. In the live probe, Tab from the composer moved focus to `<body>`, then to "Skip to content" and through the sidebar links *behind the backdrop*. Closing with Esc or ⌘J left focus on `<body>`, not on the orb that opened it. `Modal.tsx` already does both of these correctly.
- *Why it matters*: Keyboard and screen-reader users lose their place, and `aria-modal` tells assistive tech that the rest of the page is inert when it isn't. PRODUCT.md commits to "focus management in dialogs" (WCAG 2.4.3 Focus Order).
- *Fix*: Reuse the focus trap and restore from `Modal`: pull it into a `useDialogFocus(ref)` hook used by both, record `document.activeElement` on mount and refocus it on unmount. Mark the app root `inert` while the panel is open.
- *Suggested command*: `/impeccable harden`

**[P2] The panel's emphasis is violet, so Atlas's own colour barely shows**
- *What*: User bubbles are `bg-violet-600` (`:259`). Send is `.btn-primary`, a violet→indigo→blue gradient with a violet glow (`:241`, `index.css:78-81`). "Add to Planner" in the plan card is the same gradient button (`PlanCard.tsx:74`). The allowance pill is violet (`Ai.tsx:16`), Regenerate is `.btn-ai` violet, and the input focus ring is violet. Cyan appears only in the orb, the caret and the plan card border.
- *Why it matters*: This goes against both confirmed rules: emphasis should be neutral near-white, and cyan should mean Atlas. The panel is meant to be *Atlas's* room, but the user's own words are the most saturated thing in it, and the glowing gradient CTA competes with the content.
- *Fix*: Make user bubbles a solid neutral (dark theme: `#f1f5f9`-ish near-white fill with near-black text, or a raised neutral grey; light theme: a near-black fill with white text). Make Send and "Add to Planner" the new solid near-white/near-black primary with no glow. Give Atlas's side its cyan through a thin cyan left rule or tiny orb avatar on assistant turns, the caret and the plan card (already cyan). Keep emerald/rose for the action lines because they carry meaning.
- *Suggested command*: `/impeccable colorize` (then `/impeccable quieter` for the glow)

**[P2] A failed or interrupted send loses the user's message and offers no retry**
- *What*: `send()` clears the input immediately (`:78`) and shows the message as a temporary `sending` bubble. In the `catch` branch it calls `setSending(null)` (`:98`), so the bubble disappears and only the error box remains ("Can't reach Atlas right now. Check your connection."). The server saves the user turn only after its pre-checks pass (`server/ai/atlas/handler.ts:49`), so after a limit or network error the text is gone everywhere. There's also no Stop button while a reply streams: the `AbortController` is only used on unmount (`:67`).
- *Why it matters*: On a phone between lectures (Casey), retyping a long request is the moment people give up. Not being able to stop a wrong or long reply undermines "AI runs only on request".
- *Fix*: On error, keep the user bubble (marked "Not sent") and put the text back in the composer, or show a "Retry" button in the error box that calls `send(lastMessage)`. While `sending`, swap the Send icon for a Stop (square) button that calls `abort.current.abort()`, with the label "Stop".
- *Suggested command*: `/impeccable harden`

**[P2] Failed actions and destructive confirms use a ✓ tick**
- *What*: Every "What Atlas did" line renders `<Check>` whatever the outcome; failures are only recoloured `text-rose-600` (`:276-277`). That colour has no dark variant and measures **4.13:1** on `#0d0c16`, below AA for 12px text. The deletion card's red "Confirm" button also leads with a `<Check>` (`:202`).
- *Why it matters*: A tick means "done". For a colour-blind user, a failed "Delete …" or "Add task …" reads as success, which breaks the honest-numbers/honest-status commitment. A tick on a destructive button makes it look like the safe choice.
- *Fix*: Use `X`/`AlertCircle` plus a "Didn't work:" prefix for `ok === false`, coloured `text-rose-600 dark:text-rose-300`. Label the button "Delete" (with a `Trash2` icon or none) instead of "✓ Confirm", and reword the card as "Delete the task "Book a dentist appointment"?" / "This can't be undone." / [Delete] [Keep].
- *Suggested command*: `/impeccable clarify`

**[P2] Phone: the keyboard opens on launch, the input zooms, and the header's trust line is cut off**
- *What*: The textarea has `autoFocus` (`:226`), so on a phone opening Atlas immediately raises the keyboard over the conversation and plan card. It's 14px (`.input` → `text-sm`) and `index.html` has no maximum-scale, so iOS Safari zooms the page on focus. The header subtitle "Your assistant — can read and change your Daybloom data." is `truncate`d (`:140`) to "can read a…" at 390px, so the one sentence that sets expectations about data access is the one that gets cut. The footer still says "Enter to send · Esc to close" on touch devices.
- *Why it matters*: Casey opens Atlas to *read* the answer or tap "Add to Planner" and has to dismiss the keyboard first. The page zoom breaks the layout. The truncated disclosure undercuts the "your data is yours" message.
- *Fix*: Autofocus only when `(pointer: fine)`. Use `text-base sm:text-sm` on the textarea. Shorten the subtitle to "Can read and change your Daybloom data" and let it wrap to two lines (`line-clamp-2`) instead of truncating. Hide the keyboard hint below `md` or under `(hover: none)`.
- *Suggested command*: `mobile-native`

### Persona Red Flags

**Casey (distracted mobile user):** On a 390px phone the panel takes the full screen, so the backdrop can't be tapped and the only way out is the 36×36 ✕ in the top-right corner, the hardest spot to reach with a thumb. There's no swipe-to-dismiss. `autoFocus` raises the keyboard immediately and, at 14px, iOS zooms in. In the limit-reached state the four suggestion chips still look tappable (`.chip-off` has no `disabled:` style), so tapping them does nothing with no explanation. If the connection drops mid-send, Casey's typed message disappears. The plan card's buttons are about 30px tall (`!py-1.5 text-xs`) and the suggestion chips 26px: above the AA 24px minimum but below a comfortable 44px.

**Sam (keyboard / screen-reader user):** Tab leaves the "modal" panel and walks the sidebar behind the backdrop, and focus isn't returned to the orb on close. The whole message list is one `aria-live="polite"` region (`:167`): it announces the full history when it loads after opening, then re-announces as every streamed token is appended. The streaming caret is correctly `aria-hidden`, but there's no "Atlas replied" summary announcement. "What Atlas did" exists only as an `aria-label` on the `<ul>`; sighted users get no visible heading for it, which is fine, but a failed action is announced exactly like a success because the icon is `aria-hidden` and the text has no "failed" wording.

**Jordan (first-timer):** The empty state is good: a greeting by name, what Atlas can do, what it costs, and four starter prompts. Once one message exists, the suggestions are gone for good and the only explanation is the truncated header line. "Regenerate" on the plan card spends an AI action, but that's only shown in a hover `title`, which isn't visible on touch.

### Cognitive Load

Checklist failures (2 of 8, **moderate**):
- **Visual hierarchy**: the gradient + glow "Add to Planner" button and the violet user bubbles out-shout Atlas's actual answer, so the most important content (the reply and what changed) isn't the most prominent.
- **Minimal choices**: the plan card in chat has 4 actions (Add to Planner, Edit, Regenerate, Dismiss). That's at the limit on its own, but when a pending-delete card follows it (Confirm, Cancel), the composer and three header icons, the bottom of the panel has 9+ actionable targets in one view.

Decision points with more than 4 options: the empty state shows 4 suggestion chips plus the composer, mic, close = 7 choices (acceptable because the chips are examples, not required choices). The header has 3 icon buttons (voice, clear, close) and passes.

### Minor Observations

- The panel's dark surface is a one-off `dark:bg-[#0d0c16]` (`:135`), different from both the page `#08070f` and the modal `#13111f`. One more off-token near-black, and violet-tinted.
- `OrbGlyph` has a blurred cyan halo (`blur-[6px]`, `AtlasOrb.tsx:7`) and the orb button a `shadow-cyan-900/30`. They're small, but they're glows outside the HUD. A crisp cyan ring would read as "tactile, confident" and keep the identity.
- On every screen, the orb sits *below* the violet capture "+" (`AppShell.tsx:126-136`), not above it as DESIGN.md describes. On phones the larger, louder violet "+" is the first thing the thumb reaches. That's arguably right (capture first), but DESIGN.md should then be updated.
- The auto-scroll effect (`:71-73`) jumps to the bottom on every token, so the user can't scroll up to reread an earlier answer while a reply is streaming.
- `#hashtags` inside Atlas replies render pink (`Markdown.tsx:35`), and Markdown checklists use `accent-violet-600` (`:86`): two more decorative hues in Atlas text.
- "Loading conversation…" is a bare line of muted text (`:168`); a two-bubble skeleton would avoid layout jump.
- "Keep" vs "Cancel": the clear strip says Keep, the delete card says Cancel. Pick one wording for "don't do the destructive thing".

## Audit

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | The `aria-modal` panel has no focus trap or focus restore. White on the gradient "Add to Planner" is 3.8:1. Light-theme Confirm/Clear danger buttons are about 3.6–3.8:1. The placeholder is 2.6:1 (light). The whole transcript is one live region that re-announces streamed tokens. |
| 2 | Performance | 3 | The panel is lazy-loaded (`AppShell.tsx:17`) and only mounted while open. Each streamed token re-renders the whole history, re-parses the reply's Markdown and forces a scroll; acceptable at 50 messages but unbounded. |
| 3 | Theming | 2 | Dark variants mostly exist, but the panel uses one-off hex values (`#0d0c16`, `#0b1220`, the orb's inline radial-gradient hexes). Emphasis is hard-coded violet. `text-rose-600` on failed actions has no dark variant. |
| 4 | Responsive Design | 3 | The panel goes full-width on phones with the composer in the thumb zone and no horizontal overflow (probe at 390px). The 14px textarea triggers iOS zoom, `autoFocus` raises the keyboard, header icons are 36×36 and chips 26px tall. |
| 5 | Implementation Integrity | 2 | Esc closes both the nested dialog and the panel (verified live). A ✓ shows on failed actions. Disabled suggestion chips have no disabled style. The violet primary/AI tokens contradict the confirmed direction inside Atlas's own surface. |
| **Total** | | **12/20** | **Acceptable** |

**Implementation Integrity verdict: fail (narrowly).** The content model is product-specific and honest (receipts, plan cards, server-side confirmation, visible allowance). But the layer-handling bug, the misleading ✓ on failures and the violet emphasis mean the implementation doesn't yet express the "Atlas = cyan, everything else calm and neutral" system.

### Detector findings

74 findings across the four variants (dark-desktop 27, dark-phone 22, light-desktop 14, light-phone 11). By rule: `low-contrast` 22, `ai-color-palette` 20, `dark-glow` 10, `nested-cards` 8, `gradient-text` 6, `tiny-text` 4, `overused-font` 4. The scan covers the whole viewport, so **most findings belong to the dashboard behind the backdrop, not to the panel**.

| Rule | Selector (panel) | Count | Verdict |
|------|------------------|-------|---------|
| `low-contrast` | `div.mt-3.flex > button.btn-primary.!px-3` (plan card "Add to Planner"): white on the `#437df5` gradient stop, 3.8:1 | 4 (all variants) | **Real.** WCAG 1.4.3 fail at 12px semibold. Fixed for free by the neutral-primary direction. |
| `low-contrast` | `#atlas-input` placeholder "Ask Atlas…": 3.7:1 dark, 2.6:1 light | 4 | **Real.** Placeholder isn't the label (there's an sr-only label), but it's the only visible instruction; use `slate-500` (light) / `slate-400` (dark). |
| `low-contrast` | `div.mt-2.flex > span.faint.text-[11px]` ("Enter to send · Esc to close"): 4.1:1 on `#0d0c16` | 2 (dark) | **Real**, matches the known `faint` tier failure in DESIGN.md. |
| `tiny-text` | same 11px hint | 4 | **Real but low impact** (a hint, not content); fold into the phone fix (hide on touch) and a 12px minimum. |
| `dark-glow` | `div.mt-3.flex > button.btn-primary` and `div.flex.items-end > button.btn-primary` (Send): violet `#7c3aed` glow | 4 (dark) | **Real**, already slated for removal per DESIGN.md. |
| `dark-glow` | `button.group.flex` (Atlas orb): `shadow-cyan-900/30` | 2 (dark) | **Partly a false positive.** It's Atlas's cyan and it's subtle, but "no glows" still applies outside the HUD; swap for a crisp 1px cyan ring (P3). |
| `ai-color-palette` | `… span.absolute.inset-[18%]` "Cyan gradient background" (orb button + header orb) | 8 | **False positive.** Cyan is intentionally reserved for Atlas, and the radial gradient *is* the orb. |
| `ai-color-palette` | `body` "Purple/violet accent colors detected" | 4 | **Real and systemic**; inside the panel it's the user bubbles, Send, allowance pill, `.btn-ai`, focus ring. Slated for removal. |
| `overused-font` | `body` Inter 100% | 4 | **False positive** for Operate mode: one well-tuned sans is the documented, intended choice (operate.md "One family is often right"). |
| out of surface | Logo/sidebar gradients (`span.flex.h-9`, `span.flex.h-8`), `gradient-text` headings, `p.faint.mb-1`, `span.faint.inline-flex`, `a.btn-primary.mt-3` (dashboard "Process inbox"), `nested-cards` (dashboard Top tasks), `kbd.kbd`, the capture "+" glow `#4c1d95` | ~44 | Belong to the dashboard/shell reviews; not counted against this surface. |

**What the detector missed** (found in critique/probe): the missing focus trap and focus restore; the Esc layering bug; `text-rose-600` failed-action lines at 4.13:1 in dark mode; light-theme `btn-danger` Confirm (rose-600 on rose/amber tint ≈3.6:1) and Clear (≈3.8:1); the unstyled disabled suggestion chips; the ✓ on failures. None of the pending, error or limit states existed in the seeded screenshot, so the detector never saw them.

### Findings by severity

**[P1] Esc closes the Atlas panel along with any nested dialog or the clear-confirm strip**
- Location: `src/components/atlas/AtlasPanel.tsx:62-69`, `src/components/ui/Modal.tsx:24-25`, triggered from `src/components/plans/PlanCard.tsx:101-102`
- Category: Implementation Integrity
- Impact: Verified live: Add to Planner open → Esc → both dialogs gone. The panel state, a streaming reply (aborted on unmount) and any draft are lost.
- WCAG: n/a (bug)
- Recommendation: Handle Escape only in the topmost layer. `Modal` should `preventDefault()`/`stopPropagation()`; the panel should ignore `e.defaultPrevented` and cancel `confirmClear` before closing.
- Suggested command: `/impeccable harden`

**[P1] No focus trap or focus restore on an `aria-modal` dialog**
- Location: `src/components/atlas/AtlasPanel.tsx:133-135`
- Category: Accessibility
- Impact: Tab escapes to the page behind the backdrop (probe: textarea → body → Skip link → sidebar links). After closing, focus lands on `<body>` instead of the orb.
- WCAG: 2.4.3 Focus Order (A); `aria-modal` misrepresents the page.
- Recommendation: Extract the trap and restore logic from `Modal.tsx:21-50` into a shared hook, use it here, and set `inert` on the app root while open.
- Suggested command: `/impeccable harden`

**[P1] Text contrast below AA on the panel's buttons**
- Location: `src/components/plans/PlanCard.tsx:74` (`.btn-primary`, 3.8:1, detector); `src/components/atlas/AtlasPanel.tsx:158,201` (`.btn-danger` light theme on the rose/amber tints, ≈3.6–3.8:1, computed); `AtlasPanel.tsx:276` failed action `text-rose-600` on `#0d0c16`, 4.13:1
- Category: Accessibility
- Impact: The primary plan action and the destructive confirm, the two most consequential buttons in the panel, are the hardest to read.
- WCAG: 1.4.3 Contrast (Minimum)
- Recommendation: New neutral solid primary (near-white on dark / near-black on light). `.btn-danger` text `rose-700` in light. Failed action `text-rose-700 dark:text-rose-300`.
- Suggested command: `/impeccable colorize`

**[P2] Streaming transcript is one big polite live region**
- Location: `src/components/atlas/AtlasPanel.tsx:167`, nested `role="status"` at `:192`
- Category: Accessibility
- Impact: Screen readers may read the whole history once it loads after opening, then re-announce fragments as tokens stream in. The "thinking" status is nested inside another live region.
- WCAG: 4.1.3 Status Messages (best practice)
- Recommendation: Remove `aria-live` from the scroller. Add a separate visually hidden `role="status"` that says "Atlas is thinking…" and then, on `done`, "Atlas replied" (optionally with the action summaries). Keep `role="alert"` for errors.
- Suggested command: `/impeccable harden`

**[P2] Failed action lines and the destructive Confirm use a ✓ icon**
- Location: `src/components/atlas/AtlasPanel.tsx:276-277`, `:202`
- Category: Implementation Integrity
- Impact: Colour is the only signal of failure (WCAG 1.4.1 Use of Color); success-looking receipts for failed actions break "honest by default".
- WCAG: 1.4.1 Use of Color
- Recommendation: Use an `X`/`AlertCircle` icon plus "Didn't work:" text for `ok === false`; label the button "Delete" with no tick.
- Suggested command: `/impeccable clarify`

**[P2] Errors drop the user's message; there's no Stop or Retry**
- Location: `src/components/atlas/AtlasPanel.tsx:75-105` (`setInput('')` at `:78`, `setSending(null)` at `:98`); `server/ai/atlas/handler.ts:49`
- Category: Implementation Integrity
- Impact: After a network, limit or pause error the text the user typed is gone. A long or wrong reply can't be stopped.
- Recommendation: Restore the input or keep a "Not sent · Retry" bubble on error. Swap Send for Stop while `sending` and call `abort.current.abort()`.
- Suggested command: `/impeccable harden`

**[P2] Confirm/Cancel and Clear have no pending state or error handling**
- Location: `src/components/atlas/AtlasPanel.tsx:112-126`
- Category: Implementation Integrity
- Impact: Double-tapping Confirm sends two confirm requests. `clearHistory` ignores Supabase errors and always closes the strip, so a failed clear looks like it worked until the list refetches.
- Recommendation: Keep a `deciding` id state (disable both buttons with a spinner). Check `{ error }` from the delete, and toast "Couldn't clear the conversation." on failure.
- Suggested command: `/impeccable harden`

**[P2] Phone: autofocus keyboard, 14px input zoom, truncated header disclosure**
- Location: `src/components/atlas/AtlasPanel.tsx:226`, `:239` (`.input` = `text-sm`, `src/index.css:69-73`), `:140`, `:247`
- Category: Responsive
- Impact: The keyboard covers the answer on open, iOS zooms the page, and "can read and change your Daybloom data" is cut to "can read a…".
- Recommendation: Autofocus only on `(pointer: fine)`; `text-base md:text-sm`; let the subtitle wrap (`line-clamp-2`); hide the keyboard hint on touch.
- Suggested command: `mobile-native`

**[P2] Placeholder and footer hint contrast**
- Location: `src/components/atlas/AtlasPanel.tsx:237` (placeholder 2.6:1 light / 3.7:1 dark), `:247` (`faint text-[11px]`, 4.1:1 dark)
- Category: Accessibility
- Impact: The composer's only visible instruction and the shortcut hint are faint.
- WCAG: 1.4.3 Contrast (Minimum)
- Recommendation: Placeholder `slate-500`/`dark:slate-400`. Make the hint `muted` at 12px, and fix the `.faint` token globally.
- Suggested command: `/impeccable typeset`

**[P2] Violet emphasis and one-off hexes inside Atlas's surface**
- Location: `src/components/atlas/AtlasPanel.tsx:135` (`dark:bg-[#0d0c16]`), `:241`, `:259` (`bg-violet-600`); `src/components/atlas/AtlasOrb.tsx:8,18` (`#0b1220`, inline hexes); `src/components/ui/Ai.tsx:16`; `src/components/plans/PlanCard.tsx:74,80`
- Category: Theming
- Impact: Contradicts "neutral near-white emphasis" and "cyan means Atlas". The panel surface is a third, violet-tinted near-black.
- Recommendation: Use the panel/overlay surface token from the foundations phase. Neutral user bubbles and primary buttons. Introduce `--atlas` / `--atlas-deep` tokens for the orb, caret, plan card and an assistant-turn accent.
- Suggested command: `/impeccable colorize`

**[P2] Disabled suggestion chips look enabled**
- Location: `src/components/atlas/AtlasPanel.tsx:178`; `.chip`/`.chip-off` in `src/index.css:133-139` (no `disabled:` styles)
- Category: Implementation Integrity
- Impact: At 0 allowance (verified with a mocked `/api/ai`), the four chips look normal and do nothing when tapped.
- Recommendation: Add `disabled:opacity-50 disabled:cursor-not-allowed` to `.chip`, or hide the chips and show the reset message in their place.
- Suggested command: `/impeccable polish`

**[P3] Header icon buttons are 36×36 and plan-card buttons ~30px on phones**
- Location: `.icon-btn` (`src/index.css:89-92`) at `AtlasPanel.tsx:142-152`; `PlanCard.tsx:74-96` (`!py-1.5 text-xs`)
- Category: Responsive
- Impact: These pass the AA 24px minimum but fall short of 44px, with the ✕ in the hardest thumb corner.
- WCAG: 2.5.8 passes; 2.5.5 (AAA) fails
- Recommendation: Use `h-11 w-11` for icon buttons below `md`, and `py-2` plan buttons on touch.
- Suggested command: `/impeccable adapt`

**[P3] Orb halo and orb-button shadow are glows**
- Location: `src/components/atlas/AtlasOrb.tsx:7,18`
- Category: Theming
- Impact: Small, but it's a glow outside the HUD and on every screen.
- Recommendation: Replace with a crisp 1px `cyan-300/60` ring and a solid inner sphere. Keep the pulse only while active.
- Suggested command: `/impeccable quieter`

### Positive findings

- **Safe Markdown.** `Markdown.tsx` builds React nodes and never uses `innerHTML`, and links get `rel="noopener noreferrer nofollow"`. Model output can't inject markup.
- **Correct labelling.** The composer has a real (sr-only) `<label>`, every icon button has an `aria-label`, the orb label names the shortcut ("Ask Atlas (Ctrl/⌘ + J)"), the streaming caret is `aria-hidden`, and errors use `role="alert"`.
- **Abort and lazy loading.** The `AtlasPanel` chunk is lazy-loaded and only mounted while open. The stream aborts cleanly on unmount (`:67`), and `atlasStream` treats `AbortError` as a quiet return (`api.ts:74`).
- **Server-side confirmation.** Deletions can only happen through `atlas_pending_actions` + an explicit `confirm` call, and pending items expire after an hour (`:56`).
- **Limit state degrades gracefully**, with honest copy, a disabled composer and a neutral "0 left today" pill.
- **Reduced motion** is respected by the global rule (`src/index.css:32-38`). The pulses stop, but the caret and "Atlas is thinking…" text still convey the state.

## Motion on this surface

| Motion | Where | Trigger | Duration / easing | Earns its place? |
|---|---|---|---|---|
| Panel entrance: `animate-fade-in` (opacity 0→1, translateY 4px→0) | `AtlasPanel.tsx:135`; keyframes `tailwind.config.js:12,15` | Panel mounts (orb, ⌘J, dashboard "Ask") | 250ms `ease-out` | **Partly.** An entrance is useful, but a right-edge slide-over that rises 4px reads as a card fade, not a sheet. Use `translateX(16–24px)→0` at ~200ms ease-out to match where it comes from. The backdrop (`:134`) appears instantly, and there's **no exit animation** (unmounts immediately). Add a matching 150ms exit or keep both instant. |
| Orb halo pulse (`animate-pulse` on the blurred halo) | `AtlasOrb.tsx:7` (header orb `:137`, thinking line `:193`) | `active` while a reply is in flight | Tailwind pulse 2s `cubic-bezier(0.4,0,0.6,1)` infinite | **Yes.** It's the "Atlas is working" signal, but it animates the opacity of a blurred element. Pulse the ring's opacity instead once the blur is removed. |
| Streaming caret pulse | `AtlasPanel.tsx:270` | While text streams | 2s pulse infinite | **Yes, but slow.** A 2s fade feels sleepy for a "crisp, quick" caret. A ~1s `steps(2)` blink (or a solid caret) is crisper and cheaper. |
| Orb button hover border | `AtlasOrb.tsx:18` (`transition`) | Hover | 150ms default ease | Yes. It's the only hover feedback; add `active:scale-95` to match `.btn`'s press for the tactile direction. |
| Button press scale | `.btn` `active:scale-[0.97]` (`src/index.css:75-76`) on Send, Confirm/Cancel, Clear/Keep, plan buttons | Press | 150ms default | Yes. Tactile and short. |
| Chip / icon-button hover tints | `.chip`, `.icon-btn` `transition` (`src/index.css:89-92,133-139`) | Hover | 150ms | Yes. |
| Regenerate spinner | `Ai.tsx:51` (`Loader2 animate-spin`) | Plan regeneration pending | 1s linear infinite | Yes. Loading state. |
| Plan dialogs fade-in | `Modal.tsx:63` (`animate-fade-in`) for Add to Planner / Edit | Opened from the plan card | 250ms ease-out | Yes. Consistent with other dialogs. |
| Auto-scroll to bottom | `AtlasPanel.tsx:71-73` (`scrollTo`, instant) | Every history/live/pending change, including every token | instant | **Partly.** Instant is right, but it runs on every token and pulls the user back down. Only stick to the bottom if they were already near it. |

No decorative or choreographed motion; all motion maps to state. The Atlas panel is the right place for no extra flourish: the voice HUD remains the showpiece.

## Machine-readable summary

```json
{"surface":"atlas-panel","critique_total":26,"critique_max":40,"na_heuristics":[],"audit_total":12,
 "issues":[
  {"id":"atlas-panel-1","severity":"P1","title":"Esc closes the Atlas panel together with a nested dialog or the clear-confirm strip","fix":"Handle Escape only in the topmost layer: Modal calls preventDefault/stopPropagation; AtlasPanel ignores defaultPrevented events and cancels confirmClear before closing","command":"/impeccable harden","files":["src/components/atlas/AtlasPanel.tsx:62","src/components/ui/Modal.tsx:25","src/components/plans/PlanCard.tsx:101"],"source":"both"},
  {"id":"atlas-panel-2","severity":"P1","title":"aria-modal panel has no focus trap and does not restore focus to the orb","fix":"Extract Modal's trap/restore into a shared hook, use it in AtlasPanel, and mark the app root inert while open","command":"/impeccable harden","files":["src/components/atlas/AtlasPanel.tsx:133","src/components/ui/Modal.tsx:21"],"source":"both"},
  {"id":"atlas-panel-3","severity":"P1","title":"Below-AA contrast on Add to Planner (3.8:1), light-theme Confirm/Clear danger buttons (~3.6:1) and failed-action lines in dark (4.1:1)","fix":"Solid neutral primary; .btn-danger text rose-700 in light; failed action text-rose-700 dark:text-rose-300","command":"/impeccable colorize","files":["src/components/plans/PlanCard.tsx:74","src/components/atlas/AtlasPanel.tsx:158","src/components/atlas/AtlasPanel.tsx:201","src/components/atlas/AtlasPanel.tsx:276"],"source":"both"},
  {"id":"atlas-panel-4","severity":"P2","title":"Panel emphasis is violet (user bubbles, gradient Send/Add to Planner with glow, allowance pill, input ring); Atlas cyan barely present; one-off hex surfaces","fix":"Neutral user bubbles and solid near-white/near-black primary without glow; atlas cyan tokens for orb, caret, plan card and an assistant-turn accent; use the shared panel surface token","command":"/impeccable colorize","files":["src/components/atlas/AtlasPanel.tsx:135","src/components/atlas/AtlasPanel.tsx:241","src/components/atlas/AtlasPanel.tsx:259","src/components/ui/Ai.tsx:16","src/components/plans/PlanCard.tsx:74","src/components/atlas/AtlasOrb.tsx:18"],"source":"both"},
  {"id":"atlas-panel-5","severity":"P2","title":"A failed send loses the user's message; no Stop during streaming and no Retry","fix":"Keep a 'Not sent · Retry' bubble or restore the input on error; swap Send for a Stop button that aborts the stream while sending","command":"/impeccable harden","files":["src/components/atlas/AtlasPanel.tsx:78","src/components/atlas/AtlasPanel.tsx:98","src/components/atlas/AtlasPanel.tsx:241"],"source":"critique"},
  {"id":"atlas-panel-6","severity":"P2","title":"Failed actions and the destructive Confirm button show a check mark","fix":"X/AlertCircle icon plus 'Didn't work:' text for ok=false; relabel Confirm as 'Delete' without a tick and reword the card as a plain question","command":"/impeccable clarify","files":["src/components/atlas/AtlasPanel.tsx:277","src/components/atlas/AtlasPanel.tsx:198","src/components/atlas/AtlasPanel.tsx:202"],"source":"critique"},
  {"id":"atlas-panel-7","severity":"P2","title":"Phone: autofocus raises the keyboard on open, 14px textarea zooms iOS, header data-access line truncated, keyboard hint shown on touch","fix":"Autofocus only on pointer:fine; text-base md:text-sm on the textarea; line-clamp-2 subtitle 'Can read and change your Daybloom data'; hide the hint on touch","command":"mobile-native","files":["src/components/atlas/AtlasPanel.tsx:226","src/components/atlas/AtlasPanel.tsx:239","src/components/atlas/AtlasPanel.tsx:140","src/components/atlas/AtlasPanel.tsx:247"],"source":"both"},
  {"id":"atlas-panel-8","severity":"P2","title":"Whole transcript is a polite live region that re-announces streamed tokens","fix":"Drop aria-live from the scroller; add a dedicated sr-only status announcing 'Atlas is thinking…' then 'Atlas replied'","command":"/impeccable harden","files":["src/components/atlas/AtlasPanel.tsx:167","src/components/atlas/AtlasPanel.tsx:192"],"source":"audit"},
  {"id":"atlas-panel-9","severity":"P2","title":"Confirm/Cancel and Clear have no pending state or error handling (double submit, silent clear failure)","fix":"Track a deciding id and disable both buttons with a spinner; check the Supabase delete error and toast on failure","command":"/impeccable harden","files":["src/components/atlas/AtlasPanel.tsx:112","src/components/atlas/AtlasPanel.tsx:122"],"source":"audit"},
  {"id":"atlas-panel-10","severity":"P2","title":"Placeholder (2.6:1 light, 3.7:1 dark) and 11px faint footer hint (4.1:1 dark) contrast","fix":"Placeholder slate-500 / dark:slate-400; hint uses muted at 12px; fix the .faint token","command":"/impeccable typeset","files":["src/components/atlas/AtlasPanel.tsx:237","src/components/atlas/AtlasPanel.tsx:247","src/index.css:66"],"source":"audit"},
  {"id":"atlas-panel-11","severity":"P2","title":"Disabled suggestion chips look enabled at zero allowance","fix":"Add disabled:opacity-50 disabled:cursor-not-allowed to .chip, or replace the chips with the reset message when AI is off","command":"/impeccable polish","files":["src/components/atlas/AtlasPanel.tsx:178","src/index.css:133"],"source":"critique"},
  {"id":"atlas-panel-12","severity":"P3","title":"Auto-scroll jumps to the bottom on every token; panel entrance fades up instead of sliding from the right and has no exit","fix":"Stick to bottom only when already near it; translateX 16-24px entrance at ~200ms with a matching short exit; faster steps() caret blink","command":"improve-animations","files":["src/components/atlas/AtlasPanel.tsx:71","src/components/atlas/AtlasPanel.tsx:135","src/components/atlas/AtlasPanel.tsx:270"],"source":"critique"},
  {"id":"atlas-panel-13","severity":"P3","title":"Header icon buttons 36x36 and plan-card buttons ~30px on phones","fix":"h-11 w-11 icon buttons below md; py-2 plan buttons on touch","command":"/impeccable adapt","files":["src/index.css:89","src/components/plans/PlanCard.tsx:74"],"source":"audit"},
  {"id":"atlas-panel-14","severity":"P3","title":"Orb halo blur and orb-button cyan shadow are glows outside the HUD","fix":"Crisp 1px cyan ring and solid sphere; pulse only while active","command":"/impeccable quieter","files":["src/components/atlas/AtlasOrb.tsx:7","src/components/atlas/AtlasOrb.tsx:18"],"source":"both"}
 ]}
```
