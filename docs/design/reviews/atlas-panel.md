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
