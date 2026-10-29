---
name: Daybloom
description: A free life organiser built around a Brain Dump — capture first, organise later.
colors:
  violet-accent: "#7c3aed"
  violet-accent-soft: "#8b5cf6"
  violet-ink-dark: "#c4b5fd"
  indigo-mid: "#6366f1"
  blue-end: "#3b82f6"
  pink-glow: "#ec4899"
  atlas-cyan: "#22d3ee"
  atlas-cyan-deep: "#0e7490"
  ink-night: "#08070f"
  panel-night: "#13111f"
  hud-black: "#020409"
  paper-mist: "#f1f5f9"
  ink-slate: "#1e293b"
  muted-slate: "#475569"
  faint-slate: "#64748b"
  muted-slate-dark: "#94a3b8"
  danger-rose: "#f43f5e"
  caution-amber: "#f59e0b"
  done-emerald: "#059669"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0.025em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "0.05em"
  micro:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.3
  mono:
    fontFamily: "\"JetBrains Mono\", ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.875rem"
    fontWeight: 300
    lineHeight: 1.6
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  2xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.violet-accent}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
    typography: "{typography.title}"
  button-ghost:
    backgroundColor: "rgba(255,255,255,0.05)"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
  button-ai:
    backgroundColor: "rgba(139,92,246,0.10)"
    textColor: "{colors.violet-ink-dark}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
  button-danger:
    backgroundColor: "rgba(244,63,94,0.15)"
    textColor: "{colors.danger-rose}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
  input:
    backgroundColor: "rgba(255,255,255,0.05)"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.lg}"
    padding: "10px 14px"
  chip-on:
    backgroundColor: "rgba(139,92,246,0.20)"
    textColor: "{colors.violet-ink-dark}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  chip-off:
    backgroundColor: "rgba(255,255,255,0.05)"
    textColor: "{colors.muted-slate-dark}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  card:
    backgroundColor: "rgba(255,255,255,0.05)"
    rounded: "{rounded.xl}"
    padding: "20px"
  modal:
    backgroundColor: "{colors.panel-night}"
    rounded: "{rounded.2xl}"
    padding: "24px"
---

# Design System: Daybloom

<!-- Captured from the code on 2026-10-29 (Phase 0 baseline). Tokens above describe what ships today.
     "Direction" notes are the owner's confirmed choices for the foundations phase; they are not implemented yet. -->

## Overview

**Creative North Star: "The Clear Head"**

Daybloom exists to get thoughts out of a student's head and into a clear, sorted place. The interface should feel like that moment: nothing competing for attention, the next action obvious, everything else quiet. The confirmed character is **crisp, precise and quick**: a tool you open between lectures, use for thirty seconds and close, never a mood board. Surfaces should feel **tactile and confident**: solid, clearly separated, with buttons that look and feel pressable.

Today's implementation is dark-first and built on translucent "glass" cards over a violet-tinted near-black with faint violet, blue and pink glows. Violet drives almost everything that carries emphasis, often as a violet→indigo→blue (buttons) or violet→blue→pink (headings, logo) gradient. Cyan belongs to Atlas. The **voice HUD** is the one deliberately bold, theatrical surface: near-black, scanlines, a cyan orb and rotating rings.

**Direction (confirmed by the owner, to implement in the foundations phase):**
- **Neutral, near-white emphasis instead of violet.** Primary actions, selection and focus move toward white and neutral greys; violet, purple and multi-hue gradients leave the everyday UI.
- **Cyan means Atlas, and only Atlas.** Orb, plan cards, AI result panels and the HUD.
- **A neutral (untinted) near-black** for the dark theme, with no background glows.
- **Tactile surfaces:** solid fills and clear, shallow shadows in place of blur-heavy glass.
- **The voice HUD stays the single showpiece.** Everything else is calm, clear and focused.

**Key Characteristics:**
- Dark-first, with a complete light theme.
- One sans family (Inter) for everything outside the HUD; monospace only in the HUD.
- Dense, card-based app screens (Operate mode); a marketing landing page (Persuade mode).
- Colour reserved for meaning: priority, status, calendar identity and Atlas.

## Colors

Today the palette is a violet-led gradient brand on a tinted near-black, with semantic status colours and a reserved cyan for Atlas.

### Primary
- **Brand Violet** (`violet-accent`): primary buttons (as the start of a gradient), active nav item tint, selected chips, focus rings, links, inbox badge, AI buttons. Used far beyond 10% of most screens today. *Direction: replace with neutral near-white emphasis.*
- **Soft Violet / Violet Ink** (`violet-accent-soft`, `violet-ink-dark`): progress bars, light-on-dark link and chip text.

### Secondary
- **Gradient Companions** (`indigo-mid`, `blue-end`, `pink-glow`): the second and third stops of the button and heading gradients, and the pink "now" line in the Planner. *Direction: remove from everyday UI; the now-line keeps a single non-violet signal colour.*

### Tertiary
- **Atlas Cyan** (`atlas-cyan`, `atlas-cyan-deep`): the Atlas orb, plan cards, repeating blocks and the voice HUD.

### Neutral
- **Night Ink** (`ink-night`): dark theme page background. *Direction: neutral near-black, no tint, no glows.*
- **Panel Night** (`panel-night`): modal and dialog surface in dark mode.
- **HUD Black** (`hud-black`): voice HUD background only.
- **Paper Mist** (`paper-mist`): light theme page background.
- **Ink Slate** (`ink-slate`): light theme body text.
- **Muted Slate / Faint Slate** (`muted-slate`, `faint-slate`, `muted-slate-dark`): secondary and tertiary text. The faint tier fails WCAG AA on dark surfaces today.

### Semantic
- **Danger Rose** (`danger-rose`): high priority, overdue, destructive actions, errors.
- **Caution Amber** (`caution-amber`): medium priority, warnings, pending confirmations.
- **Done Emerald** (`done-emerald`): completed states and the "all done" moments.

### Named Rules
**The Atlas Colour Rule.** Cyan appears only where Atlas or AI is present. Anything else that is cyan today (including manual repeating blocks) is a bug to fix.

**The Meaning-Only Rule.** Outside the voice HUD, colour must mean something: priority, status, calendar identity or Atlas. Decorative colour is removed.

## Typography

**Display / Body Font:** Inter (400–900, loaded from Google Fonts), falling back to the system UI font.
**Mono Font:** JetBrains Mono is named in the config but **not loaded**, so the voice HUD falls back to the system monospace today.

**Character:** One workhorse sans in many weights. Hierarchy comes from weight and size; gradient text on page titles adds decoration rather than hierarchy.

### Hierarchy
- **Display** (800, 36px → 60px, 1.0): landing hero only.
- **Headline** (800, 24px → 30px, tight tracking): page titles (rendered as gradient text today) and the dashboard greeting.
- **Title** (600, 14px, slight tracking): card titles.
- **Body** (400, 14px, 1.5): almost all app text. Most-used size by a wide margin.
- **Label** (600, 12px, uppercase, wide tracking): form labels and small section kickers.
- **Micro** (500, 11px and 10px): chips, timestamps, Planner block text and hints. Used 53 times; the 10px tier is below a comfortable reading size.

### Named Rules
**The No-Ornament Type Rule.** Headings are solid colour. Hierarchy comes from size and weight, never gradients. (Today: 77 gradient-text findings per theme.)

## Layout

- **App shell:** a 240px left sidebar (72px collapsed) from 768px up; on phones, a bottom tab bar (Today, Brain Dump, Tasks, Planner, More), with a sticky top bar on both. Content sits in a centred column, padded 16px on phones and 24–32px on desktop.
- **Pages:** a page header (title, one-line purpose, actions) followed by cards in a one-column (phone) or two-column (≥1024px) grid with 16px gaps.
- **Rhythm:** a 4px base step. Common steps are 8px and 12px gaps and 20px card padding; page headers have 24px below.
- **Planner:** 15-minute rows at 14px each, with a 56px hour gutter. The week view needs at least 760px and scrolls horizontally below that.
- **Breakpoints:** Tailwind defaults: 640px (sm), 768px (md, sidebar appears), 1024px (lg, two-column grids).

## Elevation & Depth

Depth today comes mostly from **translucency and blur** (`backdrop-blur-xl` on cards, the top bar and the sidebar), with thin borders. Shadows are rare and inconsistent.

### Shadow Vocabulary
- **Violet button glow** (`0 8px 30px -8px rgba(124,58,237,0.7)`): primary buttons. Decorative.
- **Card lift (light theme)** (`shadow-sm`): glass cards in light mode only.
- **Overlay** (`shadow-2xl`): modals, the Atlas panel and toasts.
- **Now-line glow** (`0 0 8px 1px rgba(236,72,153,0.7)`): the Planner's current-time line.

*Direction: replace blur-based glass with solid surfaces and one consistent, shallow shadow scale. Remove the coloured glows.*

## Shapes

Soft, consistently rounded geometry:
- Pills for chips, badges and avatars (`full`).
- 12px for buttons, inputs and list rows (`lg`).
- 16px for cards (`xl`).
- 24px for modals (`2xl`).
- 8px for Planner blocks (`md`).
- 6px for kbd keys (`sm`).

Borders are hairline: 10% ink in light, 10% white in dark.

## Components

### Buttons
Today: soft and glowing. Direction: tactile and confident.
- **Shape:** gently rounded (12px).
- **Primary:** a violet→indigo→blue gradient with white text and a violet glow; brightens on hover; scales to 97% when pressed.
- **Ghost:** a translucent fill with a hairline border.
- **Danger:** a rose-tinted fill with rose text.
- **AI (✨):** a violet-tinted fill, violet border and sparkle icon. It shows the remaining allowance in its tooltip and disables itself at zero.
- **Icon button:** 36px square, hover tint only.

### Chips
- **Style:** pill, 12px medium text. Off: neutral translucent fill. On: violet tint with violet text.
- **Use:** filters, focus areas, priority and date chips on tasks (coloured by meaning).

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** translucent white (60% in light, 5% in dark) with backdrop blur and a hairline border.
- **Internal Padding:** 20px. Every card fades in (250ms, 4px rise) on mount.
- **Nesting:** cards inside cards are common (the detector flags 62 nested cards in dark mode).

### Inputs / Fields
- **Style:** a translucent fill with a hairline border, 12px radius and 14px text.
- **Focus:** a violet border plus a soft violet ring.

### Navigation
- **Sidebar:** icon plus label rows. The active row has a violet tint and ring. The Brain Dump row shows a violet inbox-count badge.
- **Mobile:** a bottom tab bar with 4 primary tabs plus "More", which opens a sheet.
- **Top bar:** capture field (N), Jump to (⌘K), AI allowance pill, theme toggle and account menu.

### Atlas Orb and Panel (signature)
- **Orb:** a cyan glowing orb button, fixed at the bottom right above the capture "+". It opens a slide-over panel that is 448px wide.
- **Panel:** user messages in violet bubbles and Atlas messages in neutral bubbles, with "What Atlas did" action lines, confirm cards and plan cards.

### Voice HUD (signature, the one showpiece)
Full-screen, near-black and monospace:
- A grid and scanlines.
- A cyan radial orb inside three counter-rotating rings, with tick marks and segmented arcs.
- A waveform canvas.
- Corner readouts: time, date, next event, tasks left and AI uses left.
- A boot line typed out letter by letter.

It respects reduced motion.

## Do's and Don'ts

### Do:
- **Do** keep the dark theme as the default and keep the light theme complete.
- **Do** keep every page's header as title + one plain sentence saying what the page is for.
- **Do** use cyan only for Atlas and AI (The Atlas Colour Rule).
- **Do** respect `prefers-reduced-motion`: the global rule in `index.css` reduces all motion to 0.01ms.
- **Do** keep the voice HUD as the single bold surface.

### Don't:
- **Don't** use gradient text, gradient buttons or coloured glows in the everyday UI (confirmed direction).
- **Don't** add violet or purple emphasis; emphasis moves to neutral near-white (confirmed direction).
- **Don't** tint the dark background or add background glows (confirmed direction).
- **Don't** use 10px text for anything a user needs to read.
- **Don't** invent numbers, testimonials or "insights" in any design (PRODUCT.md commitment).
