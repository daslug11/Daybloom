---
name: Daybloom
description: A free life organiser built around a Brain Dump — capture first, organise later.
colors:
  canvas-dark: "#0b0b0c"
  surface-dark: "#151517"
  raised-dark: "#1d1d20"
  overlay-dark: "#1a1a1d"
  line-dark: "#2a2a2e"
  line-strong-dark: "#3d3d43"
  control-dark: "#6b6b73"
  ink-dark: "#f4f4f5"
  muted-dark: "#a8a8b0"
  faint-dark: "#8d8d95"
  canvas-light: "#f3f3f4"
  surface-light: "#ffffff"
  raised-light: "#f6f6f7"
  line-light: "#e3e3e6"
  line-strong-light: "#cfcfd4"
  control-light: "#8c8c94"
  ink-light: "#18181b"
  muted-light: "#505058"
  faint-light: "#66666e"
  danger-dark: "#fb7185"
  danger-light: "#be123c"
  warning-dark: "#fbbf24"
  warning-light: "#a14c06"
  success-dark: "#4ade80"
  success-light: "#15803d"
  atlas-dark: "#5ee3f5"
  atlas-light: "#0e7490"
  hud-black: "#020409"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.29
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  control: "10px"
  card: "14px"
  sheet: "20px"
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
    backgroundColor: "{colors.ink-dark}"
    textColor: "{colors.canvas-dark}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.ink-dark}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-ai:
    backgroundColor: "rgba(94,227,245,0.10)"
    textColor: "{colors.atlas-dark}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-danger:
    backgroundColor: "rgba(251,113,133,0.10)"
    textColor: "{colors.danger-dark}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  input:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.ink-dark}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  chip-on:
    backgroundColor: "{colors.ink-dark}"
    textColor: "{colors.canvas-dark}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  chip-off:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.muted-dark}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  card:
    backgroundColor: "{colors.surface-dark}"
    rounded: "{rounded.card}"
    padding: "20px"
  modal:
    backgroundColor: "{colors.overlay-dark}"
    rounded: "{rounded.sheet}"
    padding: "24px"
---
# Design System: Daybloom

<!-- Updated 2026-10-30 (Phase 2, foundations). Tokens above describe what ships: neutral ink emphasis,
     semantic colour tokens in src/index.css, mapped to Tailwind in tailwind.config.js. -->

## Overview

**Creative North Star: "The Clear Head"**

Daybloom exists to get thoughts out of a student's head and into a clear, sorted place. The interface should feel like that moment: nothing competing for attention, the next action obvious, everything else quiet. The character is **crisp, precise and quick**: a tool you open between lectures, use for thirty seconds and close. Surfaces are **tactile and confident**: solid, clearly separated, with buttons that look and feel pressable.

The system is dark-first on an untinted near-black, with a complete light theme. Emphasis is **ink**: near-white in dark mode, near-black in light mode. There is no brand hue. Colour appears only when it means something: priority and status (danger, warning, success), a calendar's identity, or Atlas (cyan). The **voice HUD** is the one deliberately bold, theatrical surface and keeps its own palette.

**Key Characteristics:**
- Dark-first, light theme complete; both themes pass WCAG AA for every text role on every surface.
- One sans family (Inter) everywhere outside the HUD; the system monospace for keyboard hints and the HUD.
- Solid surfaces with shallow shadows; no blur, no glass, no gradients, no glows.
- Dense, card-based app screens (Operate mode); a marketing landing page (Persuade mode).

## Colors

Every colour is a CSS variable holding RGB channels (`--canvas: 11 11 12`), redefined under `.dark`, and exposed to Tailwind as `rgb(var(--x) / <alpha-value>)`, so `bg-ink/10` works in both themes. Components use roles, never raw palette names.

### Surfaces
- **Canvas** (`canvas`): page background.
- **Surface** (`surface`): cards, inputs, ghost buttons.
- **Raised** (`raised`): hover fills, inset wells, user-neutral bubbles.
- **Overlay** (`overlay`): modals, menus, the Atlas panel, the command palette.

### Lines
- **Line** (`line`): hairline borders between and around surfaces.
- **Line strong** (`line-strong`): chip and ghost-button borders, hover borders.
- **Control** (`control`): input and switch outlines (3:1 against their surface).

### Text
- **Ink** (`ink`): primary text and the emphasis colour (primary buttons, selected chips, badges, progress).
- **Muted** (`muted`): secondary text. ≥4.5:1 on every surface.
- **Faint** (`faint`): tertiary text (timestamps, hints). ≥4.5:1 on every surface.

### Emphasis
- **Accent** (`accent`, `accent-ink`): the same as ink and its inverse. Primary buttons, switches on.

### Meaning
- **Danger** (`danger`): high priority, overdue, destructive actions, errors, the Planner's now-line.
- **Warning** (`warning`): medium priority, pinned stars, pending confirmations.
- **Success** (`success`): low priority, completed states, reached goals.
- **Atlas** (`atlas`): cyan. Atlas, AI buttons and plan cards only.
- **Calendar colours** (`CALENDAR_COLORS` in `src/lib/calendars.ts`): eight solid hues (Grape, Ocean, Bubblegum, Sunset, Mint, Plum, Graphite, Ember) used only to identify a calendar: a 15% tint tile with a 35% inset ring, and the border of its events in the Planner.

### Named Rules
**The Atlas Colour Rule.** Cyan appears only where Atlas or AI is present. Manual repeating blocks, the time chip and type badges are neutral.

**The Meaning-Only Rule.** Outside the voice HUD, colour must mean something: priority, status, calendar identity or Atlas. Decorative colour is removed.

## Typography

**Font:** Inter (Google Fonts), with `cv11` and `ss01` features on. **Mono:** the system monospace (nothing to download).

Headings use `text-wrap: balance`; paragraphs use `text-wrap: pretty`.

### Hierarchy
- **Display** (800, 36px → 60px, 1.0): landing hero only.
- **Headline** (`.page-title`: 600, 24px → 28px, −0.02em): page titles and the dashboard greeting. Solid ink.
- **Title** (600, 16px): card and dialog titles (`text-lg` in dialogs).
- **Body** (400, 14px, 1.5): almost all app text.
- **Label** (`.label`: 500, 12px, muted, sentence case): form labels and small section headings.
- **Small** (12px): chips, timestamps, Planner block text. Nothing is smaller than 12px.

Inputs use 16px text on phones (stops iOS zooming on focus) and 14px from 640px up.

### Named Rules
**The No-Ornament Type Rule.** Headings are solid colour. Hierarchy comes from size and weight, never gradients, and labels are never uppercase-tracked.

## Layout

- **App shell:** a 240px left sidebar (72px collapsed) from 768px up; on phones, a bottom tab bar (Today, Brain Dump, Tasks, Planner, More), with a top bar on both. Content sits in a centred column, padded 16px on phones and 24–32px on desktop.
- **Pages:** a page header (title, one-line purpose, actions) followed by cards in a one-column (phone) or two-column (≥1024px) grid with 16px gaps.
- **Rhythm:** a 4px base step. Common steps are 8px and 12px gaps and 20px card padding.
- **Planner:** 15-minute rows at 14px each, with a 56px hour gutter.
- **Breakpoints:** 640px (sm), 768px (md, sidebar appears), 1024px (lg, two-column grids).

## Elevation & Depth

Depth comes from solid surface steps (canvas → surface → raised / overlay), hairline borders and one shadow scale. Shadows are CSS variables so dark mode can use deeper, blacker shadows plus a 1px top highlight.

### Shadow Vocabulary
- **card** (`shadow-card`): cards, ghost buttons, Planner blocks.
- **button** (`shadow-button`): primary buttons; an inset top highlight makes them feel pressable.
- **pop** (`shadow-pop`): menus, toasts, the floating capture button, the active Planner block.
- **modal** (`shadow-modal`): dialogs, the Atlas panel, the command palette, the tour card.

Backdrops are a plain black scrim (60% for dialogs, 40% for the Atlas side panel), never blurred.

## Shapes

- **control** (10px): buttons, inputs, icon buttons, small tiles.
- **card** (14px): cards, menus, toasts.
- **sheet** (20px): dialogs (top corners only on phones, where they sit as bottom sheets).
- **full**: chips, badges, avatars, switches.

## Motion

Tokens (`tailwind.config.js`), from plan 001:
- **Easing:** `ease-out` = `cubic-bezier(0.23, 1, 0.32, 1)` (default for UI), `ease-in-out` = `cubic-bezier(0.77, 0, 0.175, 1)` (things moving on screen), `ease-drawer` = `cubic-bezier(0.32, 0.72, 0, 1)` (sheets and panels).
- **Duration:** `duration-press` 160ms (button press), `duration-fast` 150ms (hover, colour), `duration-base` 200ms (enter/exit).
- **Press feedback:** every `.btn` scales to 0.97 while pressed; check-off controls (task circle, habit tile) scale to 0.9.
- **Keyframes:** `animate-fade-in` (dialogs opened by pointer, Process inbox's next note), `animate-fade` (opacity only), `animate-check-pop` (a checked mark settles in, 160ms), `animate-menu-pop` (menus grow from the trigger's corner, 150ms), `animate-sheet-up` (the phone "More" sheet, 260ms drawer curve).
- **Instant on purpose:** cards, the command palette (⌘K), Capture (N), the Atlas panel when opened from the keyboard, and the sidebar collapse.
- **Only transform and opacity animate.** Progress bars use `scaleX`, the Planner now-line uses `translateY`, toasts use full `transform` strings with a spring.
- **Hover** styles apply only on devices with a real hover (`hoverOnlyWhenSupported`).
- **Reduced motion:** movement turns into a 150ms fade; colour changes and spinners stay. Framer Motion follows the OS setting (`MotionConfig reducedMotion="user"`).
- **The voice HUD** is the exception: a full boot sequence and state-driven rings, on the compositor, with no loops under reduced motion.

## Components

### Buttons
- **Primary** (`.btn-primary`): ink fill, inverse text, button shadow. One per area.
- **Ghost** (`.btn-ghost`): surface fill, strong hairline border, card shadow.
- **Danger** (`.btn-danger`): danger tint and text.
- **AI (✨)** (`.btn-ai`): cyan tint, border and text. Shows the remaining allowance in its tooltip and disables itself at zero.
- **Icon button** (`.icon-btn`): 36px square, muted icon, raised fill on hover.
- All are at least 40px tall.

### Chips
- **Off** (`.chip-off`): surface fill, strong hairline, muted text. **On** (`.chip-on`): ink fill, inverse text.
- Task chips (date, time, duration, tags) are neutral; only priority carries colour.

### Cards / Containers
- `.card`: 14px corners, surface fill, hairline border, card shadow. `.card-hover` strengthens the border on hover.

### Inputs / Fields
- `.input`: surface fill, control outline at 70%, 10px corners. Focus turns the border to ink with a soft ink ring.

### Overlays
- **Dialogs** (`Modal`), **menus** (`Menu`, rendered in a portal), the **Atlas panel**, the **command palette**, the **tour** and the **voice HUD** all register with one layer stack (`useOverlay`): Escape closes only the top-most layer, Tab stays inside it, and focus returns to the opener on close.
- **Toasts** live in a polite live region, stay 5s (8s with an action), pause on hover or focus, and have a close button.

### Navigation
- **Sidebar:** icon plus label rows; the active row is a raised fill with a hairline ring. The Brain Dump row shows an ink inbox-count badge.
- **Mobile:** a bottom tab bar with 4 primary tabs plus "More".
- **Top bar:** capture field (N), Jump to (Ctrl/⌘K), AI allowance pill, theme toggle and account menu.

### Atlas Orb and Panel (signature)
- **Orb:** a cyan orb button, fixed bottom right above the capture "+". Opens a 448px side panel.
- **Panel:** user messages in ink bubbles, Atlas messages in raised bubbles, "What Atlas did" lines in success/danger, plan cards with a cyan hairline.

### Voice HUD (signature, the one showpiece)
Full-screen, near-black and monospace: grid and scanlines, a cyan radial orb inside counter-rotating rings, a waveform, corner readouts and a typed boot line. It keeps its own cyan palette and is excluded from the neutral rules above. It respects reduced motion.

## Do's and Don'ts

### Do:
- **Do** use semantic roles (`bg-surface`, `text-muted`, `border-line`) and never raw palette classes.
- **Do** keep dark as the default and the light theme complete; check contrast in both.
- **Do** use cyan only for Atlas and AI.
- **Do** keep every page header as title + one plain sentence saying what the page is for.
- **Do** register any new overlay with `useOverlay`.
- **Do** respect `prefers-reduced-motion`.

### Don't:
- **Don't** use gradient text, gradient buttons, coloured glows or backdrop blur in the everyday UI.
- **Don't** add violet or any other brand hue; emphasis is ink.
- **Don't** tint the dark background or add background glows.
- **Don't** use text smaller than 12px or uppercase-tracked labels.
- **Don't** invent numbers, testimonials or "insights" in any design (PRODUCT.md commitment).
