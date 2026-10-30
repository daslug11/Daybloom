# Voice HUD: critique & audit (Phase 1 baseline)

Method: design review (sub-agent, screenshots + source + live app) → then detector evidence (Phase 0 CDP scans, both themes, desktop + phone)

Mode: **Experience** (the one deliberate showpiece), judged also as a working voice tool. Live checks used Playwright/Chromium at 1440×900 (motion on) and 390×844 (reduced motion emulated), logged in as Maya, opened through the command palette ("Voice mode"). No AI was called. Speech recognition and synthesis behaviour that needs a real microphone (barge-in, wake phrase, iOS/Android mic sharing) was reviewed from the code and is marked "from code".

## Critique

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | A clear status line (BOOTING / LISTENING / THINKING / SPEAKING / STANDING BY), but if you interrupt Atlas while it is speaking, the status falls back to STANDING BY while the mic is still live (VoiceHud.tsx:147–149). THINKING has no progress or elapsed time. |
| 2 | Match System / Real World | 3 | The copy is plain ("Tap the orb or press Space, then speak.") and the speech errors are friendly. "Next up" shows a time with no day, so an event next week reads as later today (VoiceHud.tsx:307). |
| 3 | User Control and Freedom | 2 | Esc and Exit work. There is no way to cancel THINKING (the orb is disabled) and no explicit "stop talking" control. Pressing Space on a focused Exit button starts listening instead of exiting (verified live). |
| 4 | Consistency and Standards | 2 | The plan card inside the HUD uses the app's violet gradient `btn-primary` and violet `btn-ai`, which breaks the Atlas cyan rule. The global Space hijack overrides native button activation. |
| 5 | Error Prevention | 2 | The orb stays enabled at 0 AI uses left, so you only learn after speaking. In wake-phrase mode, recognition dies silently after any error (VoiceHud.tsx:210). |
| 6 | Recognition Rather Than Recall | 3 | The hint line names the orb and Space. The typed fallback is an unlabelled keyboard icon, and the "Space" hint also shows on touch phones. |
| 7 | Flexibility and Efficiency | 3 | Space to talk, a typed fallback, the wake phrase, Esc to exit. No direct shortcut opens voice mode (only the palette or the panel). |
| 8 | Aesthetic and Minimalist Design | 3 | A confident, well-composed instrument on desktop. On phones, the EXIT pill collides with the clock, and a large dead band sits between the transcript and the readouts. |
| 9 | Error Recovery | 3 | Mic, network and unsupported-browser errors are mapped to plain amber notices with a next step (speech.ts:48–56). |
| 10 | Help and Documentation | 2 | The cost per reply and browser support are explained in Settings and on Landing, not on the HUD itself. You only learn about them after a failure. |
| **Total** | | **25/40** | **Acceptable** |

All ten heuristics were scored. Experience mode would allow n/a on 7 and 10, but this surface is also a working voice tool, so both apply.

### Design Specificity Verdict

**Strongly authored, but on a borrowed trope.** The HUD is unmistakably a deliberate piece. It has:
- an orb, three counter-rotating rings (60s / 38s / 14s), 72 tick marks with every sixth one long;
- a dashed segmented arc and a 96-bar canvas waveform that responds to the mic and to speech boundaries;
- monospace readouts that use **real data** (tasks left today, AI uses left, next event), which fits the "honest numbers" commitment.

The composition holds together. On desktop, the four corner readouts frame a centred instrument with good negative space, and the cyan-on-near-black palette is disciplined (one hue, opacity steps only).

What keeps it from feeling fully *Daybloom's* is that the visual vocabulary is stock "JARVIS HUD": grid, scanlines, ticks, BOOTING, STANDING BY. An unrelated assistant app could ship it unchanged. Nothing ties it to the product's heart, the Brain Dump. There is no sign that what you say lands in your inbox, and no 🌸 mark. The orb is a generic glowing sphere rather than the Atlas orb from the panel.

Missed opportunities:
- An "I've added that to your inbox" moment rendered in the HUD language.
- Readouts that link to the screen they summarise.
- Making the AI cost part of the instrument, for example a segmented allowance arc.

### What's Working

1. **Real-data readouts with honest fallbacks.** Tasks left today (VoiceHud.tsx:60), AI uses left with "—" while loading (VoiceHud.tsx:316), and "Nothing scheduled" when empty. The bold surface carries true numbers, not decoration, which is exactly the PRODUCT.md promise.
2. **Motion is tied to state, and reduced motion is respected.**
   - The waveform breathes at idle, follows mic loudness while listening, pulses on word boundaries while speaking, and oscillates while thinking (VoiceHud.tsx:254–265).
   - Under `prefers-reduced-motion` the rings stop, the boot line appears instantly, the caret stops blinking, and the canvas wobble is flattened (VoiceHud.tsx:57, 84–86, 271, 459–462). This was verified live: the three ring animations report `none` with reduced motion.
3. **Graceful degradation.**
   - Browsers without SpeechRecognition open with the typed field already visible (VoiceHud.tsx:48).
   - Speech-output failures resolve silently (speech.ts:122).
   - The voice picker leans into the British Atlas character (en-GB male first, speech.ts:88–103).

### Priority Issues

**[P1] Focus is never moved into the HUD, Tab escapes into the app behind it, and focus is not restored on exit**
- **What:** The HUD is `role="dialog" aria-modal="true"` (VoiceHud.tsx:294), but on open `document.activeElement` stays on `<body>`. After three Tabs (Exit → orb → keyboard), focus walks into the hidden app ("Skip to content", "Dashboard"). After Esc, focus is left on `<body>`. All of this was verified live at both sizes.
- **Why it matters:** Screen-reader and keyboard users (Sam) are told this is a modal, yet they navigate invisible controls underneath a full-screen overlay. On close they lose their place entirely. This breaks the PRODUCT.md promise of "focus management in dialogs".
- **Fix:**
  - On mount, focus the orb button. It is the primary action and is already labelled "Talk to Atlas (Space)".
  - Trap Tab within `root`, or set `inert` on the app root while the HUD is open.
  - Save `document.activeElement` before opening and restore it in `close()`.
- **Suggested command:** `/impeccable harden`

**[P1] Space is hijacked globally, so a focused button can't be activated by Space**
- **What:** The keydown handler calls `preventDefault()` on every Space keypress, except when the target is an `<input>` (VoiceHud.tsx:219–222). Live: focusing EXIT and pressing Space left the HUD open with status "LISTENING". The same happens on the keyboard toggle, the plan-card buttons and the "✕ hide plan" button.
- **Why it matters:** Space is the standard activation key for buttons (WCAG 2.1.1 keyboard expectations). A keyboard user trying to leave turns the microphone on instead, which is a privacy surprise.
- **Fix:** Only treat Space as push-to-talk when `e.target` is the dialog root, `<body>`, or the orb itself. Skip when it is any `button`, `a`, `textarea`, `select` or `[contenteditable]`. Alternatively, scope the shortcut to the orb and let the orb's native Space do the work.
- **Suggested command:** `/impeccable harden`

**[P1] Interrupting Atlas mid-speech leaves the HUD showing the wrong state (from code)**
- **What:** Tapping the orb (or pressing Space) during SPEAKING calls `listen()`, which calls `stopSpeaking()` → `speechSynthesis.cancel()`. The cancelled utterance resolves `speak()` asynchronously through `onend`/`onerror`, and `ask()` then runs `setPhase('idle')` (VoiceHud.tsx:147–149). The result:
  - the mic is live, but the status reads STANDING BY;
  - the orb shows the Mic icon instead of MicOff, with the "Talk to Atlas" label;
  - the waveform stops following the mic, because it only reads the analyser when `phase === 'listening'` (VoiceHud.tsx:256).
- **Why it matters:** Barge-in is the most natural voice interaction. The HUD lies about whether it is listening, which is a privacy and trust problem on the one surface built around listening.
- **Fix:** Give each `ask()` a run id (or check `abort.current.signal`), and only set `idle` after speaking if the phase is still `speaking` (`if (phaseRef.current === 'speaking') setPhase('idle')`).
- **Suggested command:** `/impeccable harden`

**[P1] Phone layout: EXIT collides with the clock, and long replies overflow onto the readouts and the input**
- **What:**
  - At 390px the clock spans x 16–214, and the centred EXIT pill sits at x 157–234 on the same row. The text visibly overprints ("09:44:13 ✕PEXIT", screenshots dark-phone and light-phone).
  - The transcript block starts at `top: calc(44% + min(39vw,230px) + 12px)` (about 535px on an 844px phone) with only `min-h-[5.5rem]` and no max height or scroll (VoiceHud.tsx:369–373). A reply of about 300+ characters (around 38 mono characters per line) runs over "Tasks left today / AI uses left" at `bottom-24` and down to the keyboard button (from code).
- **Why it matters:** Phones are a primary device. The exit control is the escape hatch (there is no Esc key on a phone), and Atlas replies are routinely several sentences long.
- **Fix:**
  - On phones, move the clock and date below EXIT, or put EXIT in the top-right corner and the "Next up" readout under the clock.
  - Lay the HUD out as a flex column (top bar, orb, transcript that grows with `overflow-y:auto`, bottom bar) instead of stacked absolute percentages.
  - Cap the transcript at roughly 30vh with scroll, and keep the latest line in view.
- **Suggested command:** `/impeccable adapt`

**[P2] The plan card inside the HUD drags in violet and light-theme styles**
- **What:** PlanCard's hud variant only restyles the container (PlanCard.tsx:43). The actions are the global `btn-primary` (violet→indigo→blue gradient with violet glow), `btn-ghost` and `btn-ai` (violet) (PlanCard.tsx:74–85), and the emerald status badge uses `text-emerald-700` in light theme (PlanCard.tsx:56).
  - In light theme, `btn-ghost` becomes `bg-white/50`, with the card's inherited `text-cyan-50` on top of it.
  - In light theme, `btn-ai` becomes `text-violet-700` on the dark cyan card. Both are near-unreadable, because the HUD is always dark but these buttons follow the app theme.
- **Why it matters:** It breaks the Atlas Colour Rule and the confirmed direction, and the primary action ("Add to Planner") on this card fails contrast for light-theme users.
- **Fix:** Give the HUD variant its own button set: a cyan outline and a solid cyan-300 primary with `text-cyan-950`, pinned to dark regardless of theme. One option is wrapping the HUD in a `.dark` scope so `dark:` variants always apply.
- **Suggested command:** `/impeccable colorize`

**[P2] The wake phrase "Hey Atlas" stops listening for good after any recognition error (from code)**
- **What:** In wake mode, an error such as Chrome's routine `no-speech` after a silence sets `notice` and `phase='idle'` (VoiceHud.tsx:186–189). The auto-restart effect only fires when `!notice` (VoiceHud.tsx:210), and it is keyed on `phase === 'idle'` flipping, so listening never resumes. The status shows STANDING BY with "I didn't catch anything — try again." The user believes the HUD is still waiting for "Hey Atlas".
- **Why it matters:** This is a hands-free feature that silently stops being hands-free, and Settings promises "Your mic stays on while the HUD is open".
- **Fix:** In wake mode, treat `no-speech` and `aborted` as benign: restart without a notice, with backoff. Show a persistent "Wake phrase paused — tap to resume" state for real errors (`not-allowed`, `audio-capture`).
- **Suggested command:** `/impeccable harden`

### Persona Red Flags

**Sam (screen reader / keyboard)**
- Focus starts on `<body>` and Tab leaves the modal (verified live).
- Space on EXIT turns the mic on (verified live).
- The transcript is `aria-live="polite"` (VoiceHud.tsx:373), so the boot line is re-announced on every typed character (a state update every 38ms), and a streamed reply is re-announced on every token (VoiceHud.tsx:128). With "Speak replies aloud" on, the screen reader and speech synthesis talk over each other.
- The decorative caret "▍" is inside the live region.
- Exit returns focus to nowhere.

**Casey (distracted, one-handed phone)**
- EXIT is at the very top centre, overprinted by the clock, and 77×30px (under 44px).
- "Type instead" is a 34×34 unlabelled icon in the bottom-left corner.
- The hint says "press Space" on a touch device.
- The plan card opens over the orb and transcript (`inset-x-3 bottom-20 max-h-[45vh]`). Its "✕" hide button is about 14×16px (VoiceHud.tsx:396).
- No `env(safe-area-inset-*)` padding, so EXIT and the bottom controls sit under the notch and home indicator in a standalone PWA.
- The orb itself (103×103px, mid-screen) is fine to reach.

**Jordan (first-timer)**
- Nothing on the HUD says each reply uses one ✨ AI action. The readout "AI uses left 15" is there, but the cost link is not.
- At 0 uses the orb still invites you to speak, and you only find out afterwards.
- "Next up 09:00 AM · Lecture" doesn't say *which day*.
- The boot theatre ("Systems online") is charming once; it plays in full (about 2s) on every open.

### Cognitive Load

Checklist failures (2 of 8, moderate):
- **Single focus:** fails on phone when a plan card is open. The card, transcript, orb and readouts all compete, and the card overlaps the transcript.
- **Progressive disclosure:** partial fail. The typed input is hidden behind an unlabelled icon, but the cost of a request is never disclosed at the moment of use.

Decision points with more than 4 options: the draft plan card shows 4 actions plus the hide ✕ (Add to Planner, Edit, Regenerate, Dismiss, hide), which is 5 at once on a small overlay. Everywhere else the HUD offers 1 primary (orb) and 2 secondary (Exit, Type), which is excellent.

### Minor Observations

- **JetBrains Mono is named but never loaded.** index.html only loads Inter, so the HUD's character depends on whichever monospace the device has (Menlo, Consolas, DejaVu…).
- **The segmented arcs snap from solid to dashed when boot ends.** `.hud-boot .hud-draw { stroke-dasharray: 1200 }` overrides the arcs' `strokeDasharray` attribute during boot (VoiceHud.tsx:347, 351, 456).
- **The keyboard toggle floats oddly on desktop.** It sits at x≈448 in an otherwise empty `max-w-xl` row, aligned to nothing on screen.
- **AI-disabled state.** When AI is disabled (`enabled:false`), "AI uses left" shows 0 rather than the honest "AI is resting until tomorrow 🌙" message (VoiceHud.tsx:287).
- **"Plan" kicker size.** The "Plan" kicker is 10px (VoiceHud.tsx:394); DESIGN.md says no 10px text for anything a user reads.
- **"See it in Planner → Plans" leaves the HUD open.** The link inside the HUD card navigates underneath the HUD (PlanCard.tsx:89), so the user sees no change.
- **Focus ring colour.** Exit and the keyboard toggle get the global violet focus ring with a slate-100 offset in light theme (index.css:29–31), which is off-palette inside the HUD.

## Audit

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 1 | No focus entry, focus trap or focus return in an `aria-modal` dialog. Space hijack on buttons. A chatty live region. Placeholder at 3.8:1. Targets under 24px. |
| 2 | Performance | 2 | Infinite rAF loop with 96 separate strokes per frame. The canvas is re-allocated every frame at fractional DPR. Three rotating SVG groups (not composited). A full re-render every second. A blur over animated content. |
| 3 | Theming | 2 | The HUD is self-contained (raw hex is acceptable for a one-off showpiece), but the embedded PlanCard and focus ring follow the app theme and break in light mode. |
| 4 | Responsive Design | 2 | Clock/EXIT overlap at 390px. Unbounded transcript. Plan card covers the orb and transcript on phones and at 768–1000px. No safe-area insets. Targets of 30px and 34px. |
| 5 | Implementation Integrity | 3 | A coherent, intentional, real-data HUD. Drift is isolated to the PlanCard buttons (violet), the unloaded mono font and the barge-in and wake-phrase state bugs. |
| **Total** | | **10/20** | **Acceptable** |

### Detector findings

Detector totals: 21 (dark-desktop), 21 (dark-phone), 14 (light-desktop), 13 (light-phone), plus a source scan. **Most of these findings are not about the HUD.** The HUD is a `createPortal` overlay on `document.body`, and the scan walked the whole DOM, including the dashboard rendered underneath. That fact is itself evidence for the P1 focus/`inert` issue: the background app is still live in the accessibility tree.

| Rule | Count per variant (dark/light) | Element | Verdict |
|---|---|---|---|
| low-contrast 4.49:1 `#058197` on `#020409` | 4 / 4 | `.text-cyan-500/70` labels "Next up", "Tasks left today", "AI uses left" and the idle hint `p.text-cyan-500/70` (VoiceHud.tsx:305, 311, 315, 384) | **Real (HUD).** Matches my own 4.47:1 calculation. 11px uppercase text, so the 4.5:1 requirement applies. It fails by a hair; raise it to `cyan-400/80` or `cyan-300/70`. |
| repeating-stripes-gradient | 1 / 1 | `.hud-scan` (VoiceHud.tsx:445) | **False positive in context.** Scanlines are part of the specified showpiece. |
| codex-grid-background | 1 / 1, plus the src scan VoiceHud.tsx:438 | `.hud-grid` | **False positive in context** (an intended part of the brief). It does confirm the critique's point that the vocabulary is stock sci-fi. |
| ai-color-palette "Cyan gradient background" | 1 / 1 | `span.absolute.inset-[18%]`, the Atlas orb FAB behind the HUD, not the HUD core | **False positive.** Cyan is reserved for Atlas, and the element is outside this surface anyway. |
| ai-color-palette violet gradient (logo `span.flex.h-9`, top-bar `span.flex.h-8`), body-level violet accent | 3 / 3 | sidebar logo, top bar, body | **Background app.** Real, but it belongs to the shell/dashboard reviews and is already slated for removal per DESIGN.md. |
| gradient-text | 2 / 1–2 | `h1.gradient-text`, logo text | **Background app.** Slated for removal. |
| low-contrast 3.9:1 white on `btn-primary` gradient; dark-glow (`#7c3aed`, `#4c1d95`, `#164e63`) | 1 + 3 (dark) / 1 (light) | dashboard `a.btn-primary`, capture "+", Atlas FAB | **Background app.** Slated for removal. It does matter here indirectly, because the *same* `btn-primary` is used inside the HUD plan card (Priority issue: plan card). |
| low-contrast 3.5:1 `.faint` (dark-phone only) | 1 / 0 | dashboard chip | **Background app.** |
| nested-cards | 4 / 0 | dashboard list rows | **Background app.** |
| overused-font Inter 98% | 1 / 1 | body | **False positive for this surface.** The count is dominated by the hidden app; the HUD itself is entirely `font-mono`. The related real issue is that JetBrains Mono is never loaded. |

**What the detector missed (verified by hand):**
- the placeholder `text-cyan-700` at 3.83:1 (the input is hidden by default, so it was not scanned);
- input and button borders `cyan-400/30` at 1.86:1, below the 3:1 non-text contrast (SC 1.4.11) for the input boundary;
- touch targets: Exit 77×30, keyboard toggle 34×34, plan "✕" about 14×16;
- the clock/EXIT overlap;
- all keyboard and focus failures;
- the light-theme PlanCard buttons, which were not on screen.

### Findings by severity

**[P1] No focus entry, trap or return in the voice dialog**
- **Location:** src/components/atlas/VoiceHud.tsx:294 (dialog root), 200–206 (`close`); src/components/layout/AppShell.tsx:159.
- **Category:** Accessibility.
- **Impact:** Keyboard and screen-reader users start on `<body>`, tab into the hidden app, and lose their place on exit. This was verified live.
- **WCAG:** 2.4.3 Focus Order, 2.1.2 (modal expectation), ARIA APG dialog pattern.
- **Recommendation:**
  - Focus the orb on mount.
  - Make the app root `inert` while the HUD is open, or trap Tab.
  - Restore the opener's focus in `close()`.
- **Suggested command:** `/impeccable harden`

**[P1] Global Space handler swallows button activation**
- **Location:** src/components/atlas/VoiceHud.tsx:219–223.
- **Category:** Accessibility.
- **Impact:** Space on EXIT, the keyboard toggle, the plan buttons or the ✕ starts the microphone instead (verified live on Exit).
- **WCAG:** 2.1.1 Keyboard. It also conflicts with native button semantics.
- **Recommendation:** Ignore Space when `e.target` is any interactive element other than the orb; only use push-to-talk from the dialog root or `<body>`.
- **Suggested command:** `/impeccable harden`

**[P1] Barge-in leaves phase at `idle` while the mic is live**
- **Location:** src/components/atlas/VoiceHud.tsx:145–149 (with speech.ts:121–122 resolving on cancel).
- **Category:** Implementation Integrity.
- **Impact:** The status, orb icon, aria-label and waveform all claim the HUD is not listening while it is. A trust and privacy mismatch (from code).
- **Recommendation:** After `await speak(...)`, set `idle` only if `phaseRef.current === 'speaking'` and this run wasn't superseded.
- **Suggested command:** `/impeccable harden`

**[P1] Phone header collision and unbounded transcript**
- **Location:** src/components/atlas/VoiceHud.tsx:300–301 (clock), 319 (EXIT), 369–373 (transcript), 310 and 314 (bottom readouts).
- **Category:** Responsive.
- **Impact:**
  - At 390px the clock (x 16–214) overprints EXIT (x 157–234); visible in both phone screenshots.
  - Long replies run over the readouts and the input.
- **Recommendation:** Rebuild the HUD as a flex column (header row, orb, scrollable transcript with a max height, footer row). On phones, put EXIT at top-right and the clock under it, or shrink the clock to `text-lg` below `sm`.
- **Suggested command:** `/impeccable adapt`

**[P2] PlanCard hud variant uses violet and theme-following buttons**
- **Location:** src/components/plans/PlanCard.tsx:56, 74–85; src/index.css:78–96.
- **Category:** Theming.
- **Impact:** A violet gradient with a glow inside the cyan HUD, against the Atlas Colour Rule. In light theme, `btn-ghost` (white/50 with cyan-50 text), `btn-ai` (violet-700) and the emerald-700 badge become near-unreadable on the always-dark card.
- **WCAG:** 1.4.3 Contrast (light theme).
- **Recommendation:** A dedicated HUD button set in cyan, or a forced `.dark` scope around the HUD.
- **Suggested command:** `/impeccable colorize`

**[P2] Wake-phrase mode dies after the first recognition error**
- **Location:** src/components/atlas/VoiceHud.tsx:186–189, 208–212.
- **Category:** Implementation Integrity.
- **Impact:** "Hey Atlas" silently stops working after a silence timeout (`no-speech`). From code.
- **Recommendation:** Auto-restart on benign errors, and show an explicit "wake phrase paused" state otherwise.
- **Suggested command:** `/impeccable harden`

**[P2] Live region re-announces per character and per token, and collides with spoken replies**
- **Location:** src/components/atlas/VoiceHud.tsx:76–86, 127–128, 373–378.
- **Category:** Accessibility.
- **Impact:** Screen readers stutter through the boot line and the streamed text, then talk over speechSynthesis.
- **WCAG:** 4.1.3 Status Messages (noise).
- **Recommendation:**
  - Keep the boot line and the caret out of the live region (`aria-hidden` on the typing span, plus one sr-only "Voice mode ready").
  - Announce the reply once, on `done`, and only when "Speak replies aloud" is off or a screen-reader preference is set.
- **Suggested command:** `/impeccable harden`

**[P2] The canvas is re-allocated every frame at fractional device pixel ratios, and the rAF loop never idles**
- **Location:** src/components/atlas/VoiceHud.tsx:244–283.
- **Category:** Performance.
- **Impact:**
  - `el.width !== size * dpr` is always true when `size*dpr` is not an integer (DPR 1.25/1.5/2.625, which is common on Windows laptops and Android). The canvas backing store is reset and re-allocated 60 times a second.
  - The loop also redraws 96 individually stroked lines and builds a new `rgba()` string per bar every frame, forever, even at idle and under reduced motion.
  - This drains battery and risks jank on older laptops and phones.
- **Recommendation:**
  - Compare against `Math.round(size*dpr)`, and resize only from a ResizeObserver.
  - Batch all bars into one path with one stroke.
  - At idle or reduced motion, throttle to about 15fps, or stop the loop once `level` has settled.
- **Suggested command:** `animation-performance`

**[P2] Expensive always-on layers: rotating SVG groups, a full re-render every second, and a blur over motion**
- **Location:** src/components/atlas/VoiceHud.tsx:30 (`useToday(1000)`), 336–353, 453–455; PlanCard.tsx:43 (`backdrop-blur`).
- **Category:** Performance.
- **Impact:**
  - CSS rotation of SVG `<g>` elements (one with 72 child lines) is generally repainted on the main thread rather than composited.
  - The 1s clock tick re-renders the whole HUD tree, including the 72 ticks and the PlanCard.
  - The plan card blurs live animated content beneath it.
- **Recommendation:**
  - Split the rings into three absolutely positioned SVGs (or divs), each rotated with `transform` on an HTML wrapper so they composite.
  - Memoise the static ring markup.
  - Move the clock into its own small component.
  - Drop the `backdrop-blur` (the card is 60% opaque already).
- **Suggested command:** `animation-performance`

**[P2] Touch targets and safe areas**
- **Location:** src/components/atlas/VoiceHud.tsx:319 (Exit 77×30), 406 (keyboard 34×34), 396 (plan ✕ about 14×16), 300/304/405 (no `env(safe-area-inset-*)`).
- **Category:** Responsive.
- **Impact:** Hard one-handed exit; the ✕ fails the 24px minimum; controls sit under the notch and home indicator in a standalone PWA.
- **WCAG:** 2.5.8 Target Size (Minimum) for the ✕.
- **Recommendation:** At least 44px hit areas (padding or ::after), and pad the top and bottom with `max(1rem, env(safe-area-inset-*))`.
- **Suggested command:** `mobile-native`

**[P2] The AI cost is not stated at the point of use, and the orb stays enabled at 0 uses**
- **Location:** src/components/atlas/VoiceHud.tsx:358–365, 383–385, 287.
- **Category:** Implementation Integrity (PRODUCT.md principle 3).
- **Impact:** Users spend an action without being told on the HUD, or speak into a dead end at 0. When AI is paused globally, the readout shows "0" instead of the resting message.
- **Recommendation:**
  - Extend the hint to "Tap the orb or press Space, then speak · each reply uses 1 ✨".
  - At 0, or when disabled, disable the orb and show the server's message ("AI is resting until tomorrow 🌙" or "You've used today's AI allowance") in the transcript area.
- **Suggested command:** `/impeccable clarify`

**[P2] Low-contrast HUD labels and placeholder**
- **Location:** src/components/atlas/VoiceHud.tsx:305, 311, 315, 384 (`cyan-500/70`, 4.49:1); 427 (`placeholder:text-cyan-700`, 3.83:1; border `cyan-400/30`, 1.86:1).
- **Category:** Accessibility.
- **WCAG:** 1.4.3, 1.4.11.
- **Recommendation:** Labels to `cyan-400/80` (about 7:1), placeholder to `cyan-500`, and the input border to at least `cyan-400/60`.
- **Suggested command:** `/impeccable polish`

**[P3] "Next up" has no day**
- **Location:** src/components/atlas/VoiceHud.tsx:61–73, 307.
- **Category:** Implementation Integrity.
- **Impact:** An event several days away reads as later today, which conflicts with honest numbers.
- **Recommendation:** Add "Tomorrow" or a weekday when the item is not today, or limit the readout to the next 24 hours with "Nothing else today".
- **Suggested command:** `/impeccable clarify`

**[P3] JetBrains Mono not loaded; the boot dash snap**
- **Location:** index.html:9; tailwind.config.js:9; VoiceHud.tsx:456.
- **Category:** Implementation Integrity.
- **Impact:** The showpiece typography varies by OS. The segmented arcs pop from solid to dashed when BOOTING ends.
- **Recommendation:**
  - Self-host or load JetBrains Mono (300/400) only in the lazy HUD chunk.
  - Animate `stroke-dashoffset` on a separate overlay circle instead of overriding `stroke-dasharray` on the dashed rings.
- **Suggested command:** `/impeccable typeset`

### Positive findings

- The HUD is lazy-loaded (AppShell.tsx:18), so its weight is only paid when used.
- Mic, analyser and recognition are torn down on close and unmount (VoiceHud.tsx:106–110, 229–234). An AbortController cancels in-flight Atlas streams on exit.
- Reduced motion is handled deliberately at two levels: the HUD's own media query and the JS `reduced` flag. Only the canvas loop keeps running.
- Speech errors map to plain-language, actionable messages (speech.ts:48–56). An unsupported browser starts in typed mode.
- The orb button has a visible cyan focus ring and a dynamic aria-label. The typed input has a real `<label>`. Decorative layers are `aria-hidden`.
- The readouts are computed from real data, not decoration.

## Motion on this surface

| Motion | Where | Trigger | Duration / easing | Earns its place? |
|---|---|---|---|---|
| Outer tick ring rotation | VoiceHud.tsx:336, 453 | Always | 60s linear infinite | Yes, as showpiece ambience. It is slow enough to read as "alive" rather than busy. Cost: it is a main-thread SVG repaint (see the Performance finding). Stops under reduced motion. |
| Segmented arc counter-rotation | VoiceHud.tsx:346, 454 | Always | 38s linear infinite, reverse | Yes. The counter-rotation is the signature move of the brief. Same cost caveat. |
| Inner dashed ring + bright arc | VoiceHud.tsx:350, 455 | Always | 14s linear infinite | Mostly. It is the fastest and most attention-grabbing element, and it says nothing about state. It could speed up while THINKING and slow down at idle to carry meaning. |
| Boot draw-on of rings | VoiceHud.tsx:326, 456 | On open (phase `booting`) | 1.6s ease-out | Yes, once. But it overrides the dash pattern, so the rings snap to dashed at the end of boot (P3). Disabled under reduced motion. |
| Boot line typewriter | VoiceHud.tsx:76–89 | On open | 38ms per character (about 1.5s) + 500ms hold | Charming the first time. It blocks talking for about 2s on every open, and it floods the live region. Suggest making it skippable (Space or tap skips to idle) and playing it in full only once per session. Instant under reduced motion. |
| Caret blink | VoiceHud.tsx:377, 458 | During boot | 1s steps(1) | Fine; stops under reduced motion. It should be `aria-hidden`. |
| Core pulse | VoiceHud.tsx:355, 457 | phase `thinking` | 1.2s ease-in-out opacity 1→0.7 | Yes. It is the only non-text THINKING cue. Under reduced motion there is no replacement, so consider a static ring colour change. |
| Waveform ring (canvas) | VoiceHud.tsx:237–285 | Always (rAF) | Per frame, with 0.25 smoothing on level | Yes, it is the functional heart: it shows the mic is hearing you and that Atlas is speaking. But it runs at 60fps forever, re-allocates the canvas at fractional DPR, and still animates the THINKING oscillation under reduced motion. Throttle at idle. |
| Button hover tints | VoiceHud.tsx:319, 396, 406 | Hover | Instant (no transition) | Fine. Note there is no `:active` press feedback on the Exit and keyboard buttons. |
| Plan dialogs (Modal) | PlanCard.tsx:101–102 | Edit / Add to Planner | Inherits Modal | Out of scope for this surface. They layer correctly above the HUD (`z-[95]`). |

## Machine-readable summary

```json
{"surface":"voice-hud","critique_total":25,"critique_max":40,"na_heuristics":[],"audit_total":10,
 "issues":[
  {"id":"voice-hud-1","severity":"P1","title":"No focus entry, trap or return in the aria-modal voice dialog","fix":"Focus the orb on mount, make the app root inert (or trap Tab) while open, restore the opener's focus in close()","command":"/impeccable harden","files":["src/components/atlas/VoiceHud.tsx:294","src/components/atlas/VoiceHud.tsx:200","src/components/layout/AppShell.tsx:159"],"source":"both"},
  {"id":"voice-hud-2","severity":"P1","title":"Global Space push-to-talk swallows button activation (Space on EXIT turns the mic on)","fix":"Ignore Space when the event target is an interactive element other than the orb; only use push-to-talk from the dialog root/body","command":"/impeccable harden","files":["src/components/atlas/VoiceHud.tsx:219"],"source":"critique"},
  {"id":"voice-hud-3","severity":"P1","title":"Interrupting Atlas mid-speech sets phase to idle while the mic is live","fix":"After await speak(), only set idle if phaseRef.current === 'speaking' and the run was not superseded (run id or abort signal)","command":"/impeccable harden","files":["src/components/atlas/VoiceHud.tsx:145","src/lib/speech.ts:121"],"source":"critique"},
  {"id":"voice-hud-4","severity":"P1","title":"Phone layout: clock overprints EXIT and long replies overflow the readouts and input","fix":"Flex-column HUD layout (header, orb, scrollable max-height transcript, footer); on phones put EXIT top-right and shrink or move the clock","command":"/impeccable adapt","files":["src/components/atlas/VoiceHud.tsx:300","src/components/atlas/VoiceHud.tsx:319","src/components/atlas/VoiceHud.tsx:369"],"source":"critique"},
  {"id":"voice-hud-5","severity":"P2","title":"HUD plan card uses violet gradient and theme-following buttons that become unreadable in light theme","fix":"Give the hud variant its own cyan button set or force a .dark scope around the HUD; drop btn-primary/btn-ai violet there","command":"/impeccable colorize","files":["src/components/plans/PlanCard.tsx:56","src/components/plans/PlanCard.tsx:74","src/index.css:78"],"source":"both"},
  {"id":"voice-hud-6","severity":"P2","title":"Hey Atlas wake-phrase mode stops for good after any recognition error","fix":"Auto-restart on no-speech/aborted with backoff; show an explicit 'wake phrase paused, tap to resume' state for real errors","command":"/impeccable harden","files":["src/components/atlas/VoiceHud.tsx:186","src/components/atlas/VoiceHud.tsx:210"],"source":"critique"},
  {"id":"voice-hud-7","severity":"P2","title":"Live region re-announces the boot line per character and the reply per token, and talks over spoken replies","fix":"aria-hide the typing span and caret, announce 'Voice mode ready' once, announce the full reply once on done","command":"/impeccable harden","files":["src/components/atlas/VoiceHud.tsx:373","src/components/atlas/VoiceHud.tsx:128"],"source":"critique"},
  {"id":"voice-hud-8","severity":"P2","title":"Waveform canvas re-allocated every frame at fractional DPR; 60fps loop never idles","fix":"Compare with Math.round(size*dpr) via ResizeObserver, batch bars into one path, throttle or stop the loop at idle and under reduced motion","command":"animation-performance","files":["src/components/atlas/VoiceHud.tsx:244"],"source":"audit"},
  {"id":"voice-hud-9","severity":"P2","title":"Main-thread SVG ring rotation, whole-tree re-render every second, backdrop blur over motion","fix":"Rotate HTML wrappers around separate ring SVGs, memoise static ticks, isolate the clock component, remove backdrop-blur on the HUD plan card","command":"animation-performance","files":["src/components/atlas/VoiceHud.tsx:30","src/components/atlas/VoiceHud.tsx:336","src/components/plans/PlanCard.tsx:43"],"source":"audit"},
  {"id":"voice-hud-10","severity":"P2","title":"Small touch targets (Exit 77x30, keyboard 34x34, plan close about 14x16) and no safe-area insets","fix":"44px hit areas; pad top and bottom with max(1rem, env(safe-area-inset-*))","command":"mobile-native","files":["src/components/atlas/VoiceHud.tsx:319","src/components/atlas/VoiceHud.tsx:396","src/components/atlas/VoiceHud.tsx:406"],"source":"both"},
  {"id":"voice-hud-11","severity":"P2","title":"AI cost not stated at point of use; orb enabled at 0 uses; paused AI shows '0'","fix":"Hint '... each reply uses 1 ✨'; disable the orb and show the server message at 0 or when AI is paused","command":"/impeccable clarify","files":["src/components/atlas/VoiceHud.tsx:358","src/components/atlas/VoiceHud.tsx:384","src/components/atlas/VoiceHud.tsx:287"],"source":"critique"},
  {"id":"voice-hud-12","severity":"P2","title":"HUD labels at 4.49:1, placeholder at 3.83:1, input border at 1.86:1","fix":"Labels cyan-400/80, placeholder cyan-500, input border at least cyan-400/60","command":"/impeccable polish","files":["src/components/atlas/VoiceHud.tsx:305","src/components/atlas/VoiceHud.tsx:384","src/components/atlas/VoiceHud.tsx:427"],"source":"both"},
  {"id":"voice-hud-13","severity":"P3","title":"'Next up' shows a time with no day for future-day items","fix":"Prefix Tomorrow or a weekday when not today, or limit to the next 24h","command":"/impeccable clarify","files":["src/components/atlas/VoiceHud.tsx:307"],"source":"critique"},
  {"id":"voice-hud-14","severity":"P3","title":"JetBrains Mono never loaded; segmented arcs snap from solid to dashed after boot","fix":"Load JetBrains Mono in the lazy HUD chunk; animate draw-on with a separate overlay instead of overriding stroke-dasharray","command":"/impeccable typeset","files":["index.html:9","src/components/atlas/VoiceHud.tsx:456"],"source":"critique"}
 ]}
```
