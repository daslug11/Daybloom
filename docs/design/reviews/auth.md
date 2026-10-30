# Auth: critique & audit (Phase 1 baseline)

Method: design review (sub-agent, screenshots + source + live app) → then detector evidence (Phase 0 CDP scans, both themes, desktop + phone)

Scope: `/signup`, `/login` (password + magic-link modes), `/forgot-password`, plus the email-link landing states `/reset-password` and `/auth/callback` (visited logged out on the live app) and the four branded emails in `supabase/templates/`. Evidence: 12 Phase 0 screenshots (dark/light × desktop/phone × 3 screens), the six files in `src/pages/auth/`, `src/components/layout/Logo.tsx`, `src/components/ui/States.tsx`, `src/index.css`, and a Playwright probe of the live app (tab order, focus rings, target sizes, input font size, validation and error states, link-landing timeouts). The critique below was written before the detector JSON was opened.

## Critique

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Busy labels ("Creating your account…", "One moment…") and clear "Check your email" states. But "Resend the link" has no busy state, and a successful password reset drops you on `/app` with no confirmation. |
| 2 | Match System / Real World | 3 | Supabase errors are mapped to plain language (`authMessage`, AuthLayout.tsx:41–54). A few lines read oddly: "Log in to your Daybloom." (LogIn.tsx:46) and "Repeat it" (ResetPassword.tsx:62). |
| 3 | User Control and Freedom | 3 | There is always a way back ("Back to log in", "Use a different method", logo → home). The "That link didn't work" page tells you to "Request a new one" but only offers "Go to log in" (AuthCallback.tsx:44–48). No show-password toggle anywhere. |
| 4 | Consistency and Standards | 2 | Sign-up validates in JS (`noValidate`) and shows the rose alert box; Log in and Forgot password use the browser's native tooltip bubble. Three different emojis for the same "Check your email" moment (📬 ✉️ 🔑). The resend *success* message renders in the rose error box. |
| 5 | Error Prevention | 2 | Single password field on sign-up with no reveal and no confirm. Validation runs one rule at a time (password length first, then the Terms box), so a user can hit two errors in a row. The submit button sits disabled at 50% opacity with no reason given. |
| 6 | Recognition Rather Than Recall | 3 | Persistent labels and the "At least 8 characters" hint. The "Email me a link" mode doesn't say what the link does until after you send it. |
| 7 | Flexibility and Efficiency | 3 | Password and magic-link sign-in; correct `autocomplete` tokens (`email`, `new-password`, `current-password`) so password managers work; `next` is preserved through login and the magic link. Sign-up drops `next`. |
| 8 | Aesthetic and Minimalist Design | 2 | The layout is calm and spare: logo, one card, one footer. But almost all emphasis is decorative violet: gradient logo tile and gradient wordmark, gradient primary button with a violet glow, a solid violet segmented control, violet links, violet checkbox accent and violet radial background washes. It's the opposite of the confirmed "Clear Head" direction. |
| 9 | Error Recovery | 2 | The messages are good ("That email and password don't match. Try again, or reset your password."), but they aren't tied to the field (`aria-invalid`/`aria-describedby` missing), focus isn't moved, and the link-expired pages give no one-tap way to get a new link. |
| 10 | Help and Documentation | 2 | Good help in the sign-up "sent" state (spam folder, open on this device, resend). The magic-link and forgot-password "sent" states have no resend and no "didn't get it?" help. |
| **Total** | | **25/40** | **Acceptable** |

### Design Specificity Verdict

**LLM assessment:** This is the category-default auth card: logo above, one centred glass card, h1 + subtitle, stacked uppercase labels, a gradient CTA, and a "New here? Sign up" footer. Swap the 🌸 and the word "Daybloom" and it could front any SaaS product. The only product-grounded line is the sign-up subtitle ("Capture everything, plan your day, build habits"), and even that is generic; the Brain Dump, the product's heart, isn't named. The copy is the strongest specific asset: honest and plainly worded ("If there's an account for … a reset link is on its way", "Open the link on this device", "Links only work once"). That honesty is very Daybloom, and it's what a redesign should keep.

Everything visual comes from the old violet-gradient system that DESIGN.md has already slated for removal. For "crisp, precise, quick", auth is the ideal place to show the new direction first. It should be a solid, neutral near-black surface, a near-white primary button with dark text, a plain wordmark, and no washes. These screens are the first five seconds of the product, and right now they introduce the brand the owner is moving away from.

### What's Working

1. **Plain, honest copy that answers "what happens next".** Every "sent" and failure state says where the link went, how long it lasts and where to open it (SignUp.tsx:32, LogIn.tsx:38, ForgotPassword.tsx:29, ResetPassword.tsx:47, AuthCallback.tsx:48). The forgot-password confirmation deliberately avoids leaking whether an account exists. `authMessage()` turns raw Supabase errors into human sentences.
2. **Minimal, focused structure.** One card, one primary action per screen, at most two fields (three controls on sign-up). The phone layout keeps the full form above the fold with the CTA in the thumb half of the screen (dark-phone/login.jpg: button at ~y=1110 of 1688).
3. **Solid fundamentals for password managers and keyboard users.** It uses real `<form>`s, `<label htmlFor>`, correct `autocomplete` tokens and `type="email"`, and has a visible focus ring on every interactive element (verified live: every tab stop gets the `ring-2` focus-visible style). The link-landing pages handle expired links, timeouts and the two-step email-change "halfway" case.

### Priority Issues

**[P1] Emphasis is decorative violet everywhere, and the gradient CTA fails contrast at its blue end**
- **What:** The first screens a new user sees carry every element the direction removes. The Logo tile is a `from-violet-500 via-blue-500 to-pink-500` gradient and the wordmark is `.gradient-text` (Logo.tsx:6, 9). `.btn-primary` is a violet→indigo→blue gradient with a `0 8px 30px -8px rgba(124,58,237,.7)` glow (index.css:78–81). The selected login mode is solid `bg-violet-600` (LogIn.tsx:60). "Forgot password?" and `.link` are violet (LogIn.tsx:78, index.css:97–99). The checkbox uses `accent-violet-600` (SignUp.tsx:77), the spinner `text-violet-500` (States.tsx:36), and the body has three violet/blue/pink radial washes (index.css:23–26). White button text measures 3.68:1 against the `blue-500` end and 4.47:1 against the indigo middle, so the 14px semibold label fails AA across much of the button.
- **Why it matters:** Auth is the brand's handshake. It currently introduces the identity the owner has decided to retire, and the CTA label is partly below AA.
- **Fix:** Use a solid near-white `btn-primary` with near-black text and a shallow neutral shadow. Make the selected segment a raised neutral surface (e.g. `bg-white/10` dark, white with a shadow in light) with full-contrast text. Make links neutral near-white with an underline, and the wordmark solid ink with the 🌸 on a neutral tile. Remove the body washes and use a neutral spinner. Do this in `index.css` and `Logo.tsx` so the whole app follows.
- **Suggested command:** `/impeccable quieter`

**[P1] Helper and footer text fails WCAG AA in the dark theme**
- **What:** "At least 8 characters." (SignUp.tsx:72, `faint text-xs`) and the "Terms · Privacy" footer (AuthLayout.tsx:18, `faint text-xs`) use `slate-500` on the dark card/page: 3.83:1 on the card and 4.16:1 on the page, at 12px. Light theme passes (4.55:1, marginal).
- **Why it matters:** The password rule is the one piece of guidance a user needs to get past this form, and it's the least legible text on the screen. This fails SC 1.4.3.
- **Fix:** Move both to the `muted` tier (`slate-400` dark, 7.1:1). Better, retire `.faint` for any readable text app-wide and keep it only for disabled states.
- **Suggested command:** `/impeccable typeset`

**[P2] Inconsistent validation and errors that aren't tied to fields**
- **What:** Sign-up is `noValidate` with custom messages checked one at a time (SignUp.tsx:18–19). Login and Forgot password rely on the browser's native bubble (verified live: "Please include an '@'…"). `FormError` is a general `role="alert"` box; no input gets `aria-invalid` or `aria-describedby` pointing to it, and focus stays on the submit button (verified live after a short-password error). The sign-up "Resend the link" success message ("Sent again — check your inbox.") is routed through `FormError` and so shows in the rose error box (SignUp.tsx:37–38, 44).
- **Why it matters:** The same mistake looks different on each screen, screen-reader users hear an error with no field context, and a success that looks like an error makes people think resending failed.
- **Fix:** Use one validation model across all auth forms: validate everything on submit, show inline errors under the relevant field (`aria-invalid`, `aria-describedby`), and focus the first invalid field. Keep the summary `FormError` only for server errors. Add a separate neutral or emerald `role="status"` message for "Sent again".
- **Suggested command:** `/impeccable harden`

**[P2] Phone friction: iOS zoom, no password reveal, tiny "Forgot password?" target, a dead-looking CTA**
- **What:** `.input` is `text-sm` (14px, verified live), so iOS Safari zooms the page on focus (index.css:70). There's no show-password toggle on any password field (SignUp.tsx:71, LogIn.tsx:82, ResetPassword.tsx:58, 64). "Forgot password?" is a 104×16px target (verified at 390px; LogIn.tsx:78). The primary button is `disabled` until fields are filled, so on arrival it's a washed-out 50%-opacity gradient (see light-phone/forgot-password.jpg). In light mode it reads as broken, and it never says why it's disabled.
- **Why it matters:** Casey signs up on a phone between lectures. The page jumping on zoom, mistyping a password they can't see, and missing a 16px link are the ways this flow gets abandoned.
- **Fix:** Use `text-base` (16px) inputs below `sm`. Add an eye toggle button (`aria-pressed`, `aria-label="Show password"`) in each password field. Pad "Forgot password?" to at least 44px tall (`py-3 -my-3`) or move it under the field as a full-width text row. Keep submit enabled and validate on press.
- **Suggested command:** `mobile-native`

**[P2] Dead ends after the email goes out**
- **What:** The magic-link "sent" state (LogIn.tsx:35–41) and the forgot-password "sent" state (ForgotPassword.tsx:27–30) have no resend and no "didn't get it?" guidance; only sign-up has a resend. The callback failure page says "Request a new one" but only links to log in (AuthCallback.tsx:44–48). After a successful reset, `navigate('/app')` (ResetPassword.tsx:34) shows nothing to confirm the password changed.
- **Why it matters:** Waiting for an email is the most anxious moment in auth. With no resend, users go back and start over, or give up.
- **Fix:** Add a "Send it again" ghost button with a 30–60s cooldown to every "sent" state, plus a line about the spam folder. On link failure, make the primary action "Send a new link" (prefilled email when known) and keep "Go to log in" secondary. After a reset, show a "Password updated" toast on the dashboard.
- **Suggested command:** `/impeccable clarify`

### Persona Red Flags

**Jordan (First-Timer)**: On `/signup`, Jordan types a 6-character password and ticks nothing. The first press says "Use at least 8 characters"; after fixing that, the second press says "Please agree to the Terms". Two round trips for one form. The disabled-looking "Sign up free" button doesn't explain itself. On `/login`, "Email me a link" is a mode switch, but Jordan can't tell whether it creates an account. It doesn't (`shouldCreateUser: false`), and the error then says "No account with that email yet."

**Sam (Accessibility-dependent)**: The login mode switch is `role="tablist"`/`role="tab"`, but there's no `tabpanel`, no `aria-controls`, and ArrowRight does nothing (verified live). A screen reader announces "tab, 1 of 2" and then the keyboard model doesn't match the announcement. Errors are announced via `role="alert"` but no field is marked invalid. The password hint is 3.83:1. Focus is visible everywhere (good), but the ring is violet.

**Casey (Distracted mobile)**: Tapping Email on iPhone zooms the page (14px input). "Forgot password?" is a 16px-tall target in the top-right of the field, out of thumb reach. If Casey switches to the mail app for a magic link and the email doesn't arrive, there's no resend on the "Check your email ✉️" screen. The only way back is "Use a different method", which actually returns to the magic-link form with the email kept, so a resend is possible, but the label hides it. The link must also be opened "on this device", which Casey may not notice.

### Cognitive Load

Checklist failures (2/8, moderate):
- **Progressive disclosure (misapplied):** sign-up hides the "agree to Terms" requirement behind a second failed submit (SignUp.tsx:18–19). Requirements are disclosed *after* failure rather than up front, so the user fixes errors serially.
- **Visual hierarchy:** on light theme the disabled gradient CTA and the solid violet "Password" segment compete. The segment is the most saturated element on the login card, so the mode switch outranks the primary action (light-desktop/login.jpg).

Decision points with >4 options: none. The largest is the sign-up card's 7 interactive elements (two inputs, checkbox, two policy links, submit, "Log in"), which is fine, but the Terms and Privacy links are duplicated in the footer (AuthLayout.tsx:18–26), adding noise.

### Minor Observations

- Three emojis for one moment: "Check your email 📬" (SignUp.tsx:31), "✉️" (LogIn.tsx:37), "🔑" (ForgotPassword.tsx:23), plus "Email updated ✅" (AuthCallback.tsx:54). Pick one or drop them; "crisp, precise" suggests dropping them.
- "Log in to your Daybloom." reads like a missing noun. Try "Pick up where you left off." or simply drop the subtitle.
- ResetPassword's "Repeat it" label and lack of the "At least 8 characters" hint (ResetPassword.tsx:55–65); the inputs also lack `required`/`minLength`.
- Sign-up doesn't carry `?next=` through, so a deep link → sign-up → confirm lands on `/app`, not the intended page.
- The Terms/Privacy links inside the checkbox label open a new tab (`target="_blank"`, SignUp.tsx:80, 84) with no indication.
- Sign-up subtitle uses an em dash; the copy elsewhere is short and plain. Consider naming the Brain Dump: "Get everything out of your head, then get it done."
- Emails (`supabase/templates/*.html`) are dark-only with hard-coded violet: wordmark `#c4b5fd`, CTA `linear-gradient(90deg,#7c3aed,#3b82f6)`, links `#a5b4fc`, and a violet-tinted card `#14112a`/`#2a2547`. They declare `color-scheme: dark light` but provide no light styles, and the footer `#475569` on `#0b0a14` is 2.6:1. They should move to the neutral direction with the app.

## Audit

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | `.faint` 12px text fails AA in both themes (helper 3.9:1 dark; footer 4.2:1 dark, 4.3:1 light). White CTA label on the gradient drops to 3.7:1. `role="tab"` without tab semantics. Errors not linked to fields. Focus rings and labels are good. |
| 2 | Performance | 3 | Auth routes are lazy-loaded (App.tsx:9–13) and the background is a static wash, not animated blobs. One `backdrop-blur-xl` card over a `background-attachment: fixed` body is the only cost. |
| 3 | Theming | 2 | Both themes work, but colour is utility-hardcoded rather than tokenised: `dark:bg-[#08070f]`, `bg-violet-600` (LogIn.tsx:60), `text-violet-700` (LogIn.tsx:78), `accent-violet-600` (SignUp.tsx:77). The emails are dark-only hex. |
| 4 | Responsive Design | 3 | No overflow at 390px; the card fills the width with a 16px gutter. 14px inputs trigger iOS zoom; "Forgot password?" is 104×16px; the native checkbox is 13×13 (the wrapping label rescues it). |
| 5 | Implementation Integrity | 2 | Verified drift from the confirmed direction (violet gradients, glow, gradient text). Two validation models. Success message rendered through the error component. Unsanitised `?error=` reflected into an alert. |
| **Total** | | **12/20** | **Acceptable** |

**Implementation Integrity Verdict: fail (soft).** The auth flow is functionally careful (PKCE-aware copy, email-change halfway state, enumeration-safe reset), but the visual layer is entirely the retired violet-gradient system, and three verified code issues (the success-in-error-box resend, the reflected `?error=` text, the `tablist` that isn't one) show the components weren't held to one standard.

### Detector findings

Scope: 12 page scans (3 screens × dark/light × desktop/phone), 56 findings total, plus the app-wide source scan.

| Rule | Count | Where | Verdict |
|------|-------|-------|---------|
| `ai-color-palette` | 24 | 12× `span.flex.h-9` (Logo tile, Logo.tsx:6), 12× `body` (violet accents/washes, index.css:23–26 and the violet utilities) | **Real.** Not Atlas cyan; it's the brand violet the direction removes. Already slated in DESIGN.md. Not a false positive here. |
| `gradient-text` | 12 | `span.gradient-text` wordmark (Logo.tsx:9 → index.css:59–62), every scan | **Real.** Violates the No-Ornament Type Rule; already slated. |
| `low-contrast` | 14 | `#pw-help` 3.9:1 dark (×2: desktop + phone); footer Terms link 4.2:1 dark (×6) and 4.3:1 light (×6) | **Real.** Confirms critique P1. The detector also shows the light-theme footer fails (4.3:1 on the `#f1f5f9` page), which the critique missed because it measured against the white card. The footer is `text-xs`, so it is not large-text exempt. |
| `dark-glow` | 6 | `button.btn-primary` violet shadow, dark scans only | **Real**, already slated. The same `rgba(124,58,237,.7)` shadow also renders in light mode (visible as a lilac halo in light-desktop/login.jpg); the rule only fires on dark backgrounds. |

Source scan (app-wide) entries relevant to auth: `Logo.tsx:6` (violet gradient), `index.css:60–61` (gradient text), `index.css:79` (`btn-primary` gradient). The others (VoiceHud grid, Planner, Goal/Calendar cards, Switch, TopBar) belong to other surfaces. **False positives on this surface: none.** There is no Atlas cyan on auth, so the known cyan false positive doesn't arise.

**Detector blind spots (found by review + live probe, not by the detector):** white-on-gradient CTA contrast (the detector can't resolve a gradient background); `role="tab"` without `tabpanel`/arrow keys; 14px inputs (iOS zoom); the 16px-tall "Forgot password?" target; `?error=` reflection; the resend success shown as an error; inconsistent native vs custom validation; and the email templates (not rendered by the scan).

### Findings by severity

**[P1] Readable `.faint` text below AA in both themes**
- **Location:** SignUp.tsx:72 (`#pw-help`), AuthLayout.tsx:18 (Terms · Privacy footer); token in index.css:66–68
- **Category:** Accessibility
- **Impact:** The password rule and the legal links are hard to read for low-vision users, worst in dark (3.9:1).
- **WCAG:** 1.4.3 Contrast (Minimum), AA
- **Recommendation:** Use `muted` (`slate-600`/`slate-400`, ≥7:1) for the helper and footer. Restrict `.faint` to non-text/disabled use, or lift it to `slate-600` light / `slate-400` dark.
- **Suggested command:** `/impeccable typeset`

**[P1] Primary CTA label fails contrast on the gradient; violet glow and gradient system on every auth screen**
- **Location:** index.css:78–81 (`.btn-primary`), Logo.tsx:6, 9, index.css:23–26 (body washes), LogIn.tsx:60 (violet segment)
- **Category:** Accessibility / Theming
- **Impact:** "Log in", "Sign up free" and "Send reset link" are white 14px semibold on a gradient whose indigo/blue stops measure 4.47:1 and 3.68:1. Visually it's the retired brand on the first screen.
- **WCAG:** 1.4.3 Contrast (Minimum), AA
- **Recommendation:** A solid near-white primary with near-black text (≥12:1) and a shallow neutral shadow. Neutral wordmark. Remove the washes. Raised neutral selected segment. Apply this centrally in `index.css` so every surface inherits it.
- **Suggested command:** `/impeccable quieter`

**[P2] Login mode switch misuses tab semantics**
- **Location:** LogIn.tsx:53–64
- **Category:** Accessibility
- **Impact:** Screen readers announce a tab list. Arrow keys don't move selection (verified live: ArrowRight left `aria-selected` unchanged). There's no `tabpanel` or `aria-controls`, and both "tabs" sit in the Tab order, so the announced keyboard model is wrong.
- **WCAG:** 4.1.2 Name, Role, Value
- **Recommendation:** Make it a segmented control with no tab roles: two `<button type="button" aria-pressed>`, or a `radiogroup` of two radios labelled "Sign-in method". Alternatively, implement the full tabs pattern (roving tabindex, arrow keys, `tabpanel`).
- **Suggested command:** `/impeccable harden`

**[P2] Form errors not associated with fields; two validation models**
- **Location:** SignUp.tsx:18–19, 60 (`noValidate`); LogIn.tsx:65, ForgotPassword.tsx:32 (native validation); AuthLayout.tsx:31–38 (`FormError`); ResetPassword.tsx:58, 64 (no `required`/`minLength`)
- **Category:** Accessibility / Implementation Integrity
- **Impact:** Inputs never get `aria-invalid`, and the error isn't in `aria-describedby`, so a screen-reader user who returns to the field hears no error. Focus stays on the submit. The same mistake shows a native bubble on one screen and a rose box on another.
- **WCAG:** 3.3.1 Error Identification, 3.3.3 Error Suggestion (partially met)
- **Recommendation:** One shared `useAuthForm` pattern: `noValidate` on every auth form, validate all fields on submit, inline `<p id="x-error">` per field with `aria-invalid` and `aria-describedby`, focus the first invalid field, and keep `FormError` for server errors only.
- **Suggested command:** `/impeccable harden`

**[P2] Resend success shown as an error**
- **Location:** SignUp.tsx:37–38 (sets `error` to "Sent again — check your inbox."), rendered by `FormError` at SignUp.tsx:44
- **Category:** Implementation Integrity
- **Impact:** A successful resend appears in the rose `role="alert"` box, so users read it as a failure and resend again (which then hits the rate limit).
- **Recommendation:** Add a separate `notice` state rendered as `role="status"` in neutral or emerald. Disable the button while sending and for a 30–60s cooldown with a countdown ("Send again in 42s").
- **Suggested command:** `/impeccable harden`

**[P2] Arbitrary text from `?error=` reflected into the login alert**
- **Location:** LogIn.tsx:14 (`useState(params.get('error') ?? '')`)
- **Category:** Implementation Integrity (security-adjacent: content spoofing)
- **Impact:** `/login?error=Your account is locked. Call 555-0100` renders that sentence verbatim inside the official-looking error box (verified live). React escapes it, so there's no XSS, but it's a phishing aid on the login page.
- **Recommendation:** Accept only known error codes (e.g. `?error=link_expired`) and map them to fixed copy via `authMessage`. Ignore anything else.
- **Suggested command:** `/impeccable harden`

**[P2] Mobile input zoom and small targets**
- **Location:** index.css:70 (`.input` `text-sm`); LogIn.tsx:78 ("Forgot password?" 104×16px); SignUp.tsx:77 (13×13 checkbox); AuthLayout.tsx:18–26 (footer links 15px tall)
- **Category:** Responsive
- **Impact:** iOS Safari zooms on focus into any input under 16px, so the page jumps on the first tap. Small targets miss the 44px comfort size (they pass the WCAG 2.5.8 24px spacing exception, so this isn't an AA failure).
- **Recommendation:** `text-base sm:text-sm` on `.input`. Give "Forgot password?" `py-2.5` with a negative margin, or move it below the password field. Size the checkbox to 18–20px with `accent` in neutral ink.
- **Suggested command:** `mobile-native`

**[P2] Hard-coded violet and dark-only email templates**
- **Location:** supabase/templates/confirm-signup.html, magic-link.html, reset-password.html, change-email.html (wordmark `#c4b5fd`, CTA `linear-gradient(90deg,#7c3aed,#3b82f6)`, links `#a5b4fc`, card `#14112a`/`#2a2547`, footer `#475569` on `#0b0a14` = 2.6:1)
- **Category:** Theming
- **Impact:** The emails will keep the retired violet look after the app moves to neutral. They declare `color-scheme: dark light` without light styles, and the footer text is 2.6:1.
- **Recommendation:** Neutral near-black (`#0a0a0a`-ish, untinted) card, near-white solid CTA with dark text, neutral link colour, footer ≥4.5:1. Keep all four templates generated from one shared snippet so they stay in step.
- **Suggested command:** `/impeccable quieter`

**[P3] Inline violet utilities bypass component classes**
- **Location:** LogIn.tsx:60 (`bg-violet-600 text-white`), LogIn.tsx:78 (link styled inline instead of `.link`), SignUp.tsx:77 (`accent-violet-600`), States.tsx:36 (`text-violet-500` spinner)
- **Category:** Theming
- **Impact:** When the accent changes in `index.css`, these four spots won't follow.
- **Recommendation:** Route them through component classes (`.segmented`, `.link`, `.checkbox`, a neutral spinner colour) defined once.
- **Suggested command:** `/impeccable extract`

### Positive findings

- Auth routes are code-split (`lazy()` in App.tsx:9–13), so the login page doesn't download the app.
- The global `:focus-visible` ring (index.css:29–31) produced a visible ring on every tab stop in the live probe, and tab order follows visual order on all three screens.
- Correct `autocomplete` tokens and `type="email"` throughout. The password field on sign-up has `aria-describedby="pw-help"`.
- `FormError` uses `role="alert"` and the spinners use `role="status"` with an sr-only label (States.tsx:35–37).
- Enumeration-safe reset copy ("If there's an account for…") and Supabase's identity-less duplicate sign-up are handled (SignUp.tsx:24–25).
- `next` is validated to start with `/` (LogIn.tsx:9, AuthCallback.tsx:18), which prevents open redirects.

## Motion on this surface

| Motion | Location | Trigger | Duration / easing | Earns its place? |
|---|---|---|---|---|
| Button press scale to 97% | index.css:76 (`.btn` `active:scale-[0.97]`) | Pointer down on any button | Tailwind `transition` default: 150ms, `cubic-bezier(.4,0,.2,1)`, on all transitioned props | **Yes.** Tactile press feedback fits "tactile, confident". Narrow `transition` to `transform, background-color, box-shadow`; it currently animates every transitionable property. |
| Primary hover brighten | index.css:80 (`hover:brightness-110`) | Hover | 150ms (as above) | **Marginal.** A filter on a gradient + glow. Replace with a solid-colour hover when the button goes neutral. |
| Ghost hover fill | index.css:83–84 | Hover ("Resend the link") | 150ms | Yes. A plain state change. |
| Input focus border + ring | index.css:70–71 (`.input` `transition`) | Focus | 150ms | Yes, but the colour is violet; it should be a neutral ring. |
| Spinner rotation | States.tsx:36 (`animate-spin`) | `/reset-password` "Checking your link…" (min 2.5s, ResetPassword.tsx:19), `/auth/callback` "Signing you in…" (up to 6s), and the route `Suspense`/`PublicOnly` spinner | 1s linear, infinite | **Yes.** It signals waiting. Under reduced motion the global rule stops it after one 0.01ms cycle, and the h1 text still carries the state, so the fallback is acceptable. |
| Redirect delay after email change | AuthCallback.tsx:25 (1200ms `setTimeout`) | Valid email-change link | 1.2s pause on "Email updated ✅" with a spinner | Acceptable as a reading pause, but a spinner under a success title is contradictory. Show a check, not a spinner. |
| Link underline on hover | index.css:98, AuthLayout.tsx:19, 23 | Hover | Instant | Yes. |

No entrance animations, no page-load choreography, and no `fade-in` on the auth card. That's correct for an Operate surface.

## Machine-readable summary

```json
{"surface":"auth","critique_total":25,"critique_max":40,"na_heuristics":[],"audit_total":12,
 "issues":[
  {"id":"auth-1","severity":"P1","title":"Decorative violet/gradient emphasis everywhere; CTA label fails contrast on gradient","fix":"Solid near-white btn-primary with near-black text and neutral shallow shadow; neutral wordmark/logo tile; raised neutral selected segment; neutral underlined links; remove body radial washes; neutral spinner","command":"/impeccable quieter","files":["src/index.css:78","src/index.css:23","src/components/layout/Logo.tsx:6","src/components/layout/Logo.tsx:9","src/pages/auth/LogIn.tsx:60","src/pages/auth/LogIn.tsx:78","src/pages/auth/SignUp.tsx:77","src/components/ui/States.tsx:36"],"source":"both"},
  {"id":"auth-2","severity":"P1","title":"Faint 12px helper and footer text below AA in both themes","fix":"Use the muted tier (slate-600 light / slate-400 dark) for #pw-help and the Terms · Privacy footer; restrict .faint to non-text/disabled","command":"/impeccable typeset","files":["src/pages/auth/SignUp.tsx:72","src/pages/auth/AuthLayout.tsx:18","src/index.css:66"],"source":"both"},
  {"id":"auth-3","severity":"P2","title":"Inconsistent validation; errors not tied to fields; focus not moved","fix":"noValidate on all auth forms, validate all fields on submit, inline per-field errors with aria-invalid + aria-describedby, focus first invalid field, FormError for server errors only; add required/minLength + hint on ResetPassword","command":"/impeccable harden","files":["src/pages/auth/SignUp.tsx:18","src/pages/auth/LogIn.tsx:65","src/pages/auth/ForgotPassword.tsx:32","src/pages/auth/ResetPassword.tsx:58","src/pages/auth/AuthLayout.tsx:31"],"source":"both"},
  {"id":"auth-4","severity":"P2","title":"Phone friction: 14px inputs zoom on iOS, no show-password, 16px-tall Forgot password link, disabled-looking CTA","fix":"text-base sm:text-sm on .input; eye toggle (aria-pressed) on password fields; 44px-tall Forgot password target; keep submit enabled and validate on press","command":"mobile-native","files":["src/index.css:70","src/pages/auth/LogIn.tsx:78","src/pages/auth/SignUp.tsx:71","src/pages/auth/LogIn.tsx:82","src/pages/auth/SignUp.tsx:91"],"source":"both"},
  {"id":"auth-5","severity":"P2","title":"Dead ends after the email: no resend on magic-link/forgot sent states; link-failure page lacks 'Send a new link'; silent reset success","fix":"Send-again button with 30-60s cooldown on every sent state; primary 'Send a new link' on link-failure pages; 'Password updated' toast after reset","command":"/impeccable clarify","files":["src/pages/auth/LogIn.tsx:35","src/pages/auth/ForgotPassword.tsx:27","src/pages/auth/AuthCallback.tsx:44","src/pages/auth/ResetPassword.tsx:34"],"source":"critique"},
  {"id":"auth-6","severity":"P2","title":"Login mode switch uses role=tab without tab semantics or arrow keys","fix":"Replace with a segmented control of aria-pressed buttons or a radiogroup labelled 'Sign-in method'","command":"/impeccable harden","files":["src/pages/auth/LogIn.tsx:53"],"source":"audit"},
  {"id":"auth-7","severity":"P2","title":"Resend success message rendered in the rose error alert","fix":"Separate notice state rendered as role=status in neutral/emerald; busy + cooldown on the resend button","command":"/impeccable harden","files":["src/pages/auth/SignUp.tsx:37","src/pages/auth/SignUp.tsx:44"],"source":"both"},
  {"id":"auth-8","severity":"P2","title":"Arbitrary ?error= text reflected into the login alert (content spoofing)","fix":"Accept only known error codes and map them to fixed copy; ignore unknown values","command":"/impeccable harden","files":["src/pages/auth/LogIn.tsx:14"],"source":"audit"},
  {"id":"auth-9","severity":"P2","title":"Email templates hard-coded violet, dark-only, footer 2.6:1","fix":"Neutral untinted near-black card, near-white solid CTA with dark text, neutral links, footer >=4.5:1, one shared snippet for all four templates","command":"/impeccable quieter","files":["supabase/templates/confirm-signup.html","supabase/templates/magic-link.html","supabase/templates/reset-password.html","supabase/templates/change-email.html"],"source":"both"},
  {"id":"auth-10","severity":"P3","title":"Copy polish: three different emojis for 'Check your email', 'Log in to your Daybloom.', 'Repeat it', spinner under 'Email updated' success","fix":"Drop or unify emojis, rewrite the login subtitle, label 'Confirm new password', show a check instead of a spinner on success","command":"/impeccable clarify","files":["src/pages/auth/SignUp.tsx:31","src/pages/auth/LogIn.tsx:37","src/pages/auth/LogIn.tsx:46","src/pages/auth/ForgotPassword.tsx:23","src/pages/auth/ResetPassword.tsx:62","src/pages/auth/AuthCallback.tsx:54"],"source":"critique"},
  {"id":"auth-11","severity":"P3","title":"Inline violet utilities bypass component classes","fix":"Route segment, inline link, checkbox accent and spinner colour through shared component classes in index.css","command":"/impeccable extract","files":["src/pages/auth/LogIn.tsx:60","src/pages/auth/LogIn.tsx:78","src/pages/auth/SignUp.tsx:77","src/components/ui/States.tsx:36"],"source":"audit"}
 ]}
```
