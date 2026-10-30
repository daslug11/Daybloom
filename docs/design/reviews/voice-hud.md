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

_(Filled in after the critique; see below.)_
