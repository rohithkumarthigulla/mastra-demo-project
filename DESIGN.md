---
name: EquipmentExchange
colors:
  background-light: '#f6f7f9'
  surface-light: '#ffffff'
  text-light: '#14171c'
  text-muted-light: '#5b6472'
  border-light: '#d5d9e0'
  border-strong-light: '#737c8a'
  primary-light: '#e0761a'
  on-primary-light: '#14171c'
  link-light: '#a8520c'
  danger-light: '#c62828'
  background-dark: '#101317'
  surface-dark: '#1a1e24'
  text-dark: '#eef0f3'
  text-muted-dark: '#9aa3b1'
  border-dark: '#2f353e'
  border-strong-dark: '#6b7380'
  primary-dark: '#f08a2e'
  on-primary-dark: '#14171c'
  link-dark: '#f08a2e'
  danger-dark: '#ef5350'
  tone-neutral-bg-light: '#e7eaef'
  tone-neutral-text-light: '#3b4350'
  tone-positive-bg-light: '#dcf2e1'
  tone-positive-text-light: '#1b6b32'
  tone-warning-bg-light: '#fdecd9'
  tone-warning-text-light: '#8a4a0c'
  tone-neutral-bg-dark: '#2a3039'
  tone-neutral-text-dark: '#c4cad4'
  tone-positive-bg-dark: '#173823'
  tone-positive-text-dark: '#7fd897'
  tone-warning-bg-dark: '#3d2a14'
  tone-warning-text-dark: '#f5b56e'
  brand-blue: '#1f4e79'
typography:
  heading:
    fontFamily: system-ui
    fontSize: 28px
    fontWeight: 700
  title:
    fontFamily: system-ui
    fontSize: 20px
    fontWeight: 600
  body:
    fontFamily: system-ui
    fontSize: 16px
    fontWeight: 400
  label:
    fontFamily: system-ui
    fontSize: 13px
    fontWeight: 500
  caption:
    fontFamily: system-ui
    fontSize: 11px
    fontWeight: 600
rounded:
  sm: 6px
  md: 10px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  button-primary:
    backgroundColor: '{colors.primary-light}'
    textColor: '{colors.on-primary-light}'
    rounded: '{rounded.md}'
    padding: 16px
    height: 48px
  button-secondary:
    backgroundColor: transparent
    textColor: '{colors.text-light}'
    rounded: '{rounded.md}'
    padding: 16px
    height: 48px
  chip-selected:
    backgroundColor: '{colors.primary-light}'
    textColor: '{colors.on-primary-light}'
    rounded: '{rounded.md}'
    height: 44px
  chip:
    backgroundColor: transparent
    textColor: '{colors.text-light}'
    rounded: '{rounded.md}'
    height: 44px
  input:
    backgroundColor: '{colors.surface-light}'
    textColor: '{colors.text-light}'
    rounded: '{rounded.sm}'
    padding: 12px
  card:
    backgroundColor: '{colors.surface-light}'
    textColor: '{colors.text-light}'
    rounded: '{rounded.md}'
    padding: '{spacing.md}'
---

# EquipmentExchange design system

Source of truth is code: `apps/client/features/theme/tokens.ts` (tokens), `apps/client/features/ui/` (primitives). The frontmatter above mirrors the light/dark token values; if they disagree, the code wins and this file should be updated.

## Overview

**North star: the site office clipboard.** A plain, dependable work tool for people booking machines between other jobs — on a phone at a construction site, or at a desk. Every screen answers "where is this rental, and what do I do next?" before anything else.

The interface is calm and flat: neutral greys carry structure, a single construction-orange accent marks the one thing to act on, and status is always spelled out in words as well as color. Density is moderate — lists of requests, quotes and bookings must scan quickly, but tap targets stay generous for gloved or hurried thumbs.

Key characteristics:

- Operate-mode app UI on iOS, Android and web from one React Native codebase.
- Light and dark themes follow the OS; every color comes from `useTheme()`.
- System fonts only (San Francisco / Roboto / platform sans on web).
- One primary action per screen; everything else is a secondary (outlined) button or a link.
- Flat surfaces separated by 1px borders, no shadows.

## Colors

A neutral grey scaffold with one warm accent. Orange is a fill color: it sits behind dark text on buttons, selected chips and progress markers. When orange has to be text on the page (links, prices), use `link`, a deeper orange that keeps 4.5:1.

### Primary

- **primary** — construction orange fill. Primary buttons, selected chips, progress dots, spinners, unread dots. Always paired with `onPrimary` text.
- **onPrimary** — near-black text on orange, in both themes (≥ 5.8:1).
- **link** — orange for text on `background`/`surface`. Light theme deepens to `#a8520c`; dark theme reuses the brighter primary, which already passes.

### Neutral

- **background** — page canvas. **surface** — cards, inputs, headers, sheets.
- **text** / **textMuted** — primary and supporting copy; both ≥ 4.5:1 on both page colors.
- **border** — decorative dividers and card outlines.
- **borderStrong** — outlines that identify a control (inputs, selects, checkboxes, unselected chips); ≥ 3:1 so the control is findable.

### Status

- **danger** — errors, destructive actions, closed/cancelled stages.
- **tones** (`neutral`, `positive`, `warning`) — background/text pairs for status badges. Text is ≥ 4.5:1 on its own background.
- **brand-blue** `#1f4e79` — splash and app icon only; not used in screens.

### Rules

- **Never hard-code a color in a screen.** Use `theme.colors.*` or `theme.tones.*`. `apps/client/features/theme/contrast.test.ts` enforces AA for every pair above.
- **Color never carries meaning alone.** Badges have a word, stages have a label, errors have text.

## Typography

System sans throughout, no custom fonts. Hierarchy comes from size and weight tokens (`theme.fontSize`, `theme.fontWeight`).

- **Heading** — `fontSize.xl` / `bold`; one per screen via `<Heading>`, `accessibilityRole="header"`.
- **Title** — `fontSize.lg` / `semibold`; section titles, empty-state titles, card titles on detail screens.
- **Body** — `fontSize.md` / `regular`; content, field values, button labels (`semibold`).
- **Label** — `fontSize.sm` / `medium`; form labels, metadata, timestamps (muted).
- **Caption** — `fontSize.xs` / `semibold`; badges and counters only.

## Layout

- Spacing scale `xs 4 · sm 8 · md 16 · lg 24 · xl 32`. Screens pad `lg`; stacks inside a section gap `sm`–`md`; sections gap `lg`.
- `<Screen>` wraps every route: safe-area + scroll + `background`.
- Narrow content (home menu, sign-in, centered errors) is capped at `size.column` (420).
- At `WIDE_BREAKPOINT` (768) filters and form fields go side-by-side; card grids wrap with a 220 minimum width.

## Elevation & Depth

Flat. Depth is expressed with `surface` on `background` plus a 1px `border`. No shadows — they render differently on every platform and add nothing for this audience. The only overlay is the `Select` sheet over a 45% black scrim.

## Shapes

Two radii: `radius.sm` (6) for inputs, select options and small controls; `radius.md` (10) for buttons, chips and cards. Badges and dots are pill/circle.

## Components

### Buttons

`<Button>` — `primary` (orange fill, dark label) or `secondary` (transparent, `borderStrong` outline, `text` label). Minimum height 48. Disabled and loading drop to 60% opacity and set `accessibilityState`. One primary per screen.

### Chips

`<Chips>` — single-select filter row. Selected = primary fill; unselected = `borderStrong` outline. Minimum height `size.touch`; exposes `accessibilityState.checked` (radio role).

### Cards

`Card` — `surface`, 1px `border`, `radius.md`, `spacing.md` padding; title row with an optional badge aside. The whole card is the tap target on list screens.

### Inputs

`<TextField>` / `<Select>` — label above (`label` style), `surface` fill, `borderStrong` outline, `danger` outline + message on error. Select opens a sheet with searchable options. `TextField` takes an optional `accessory` shown to the right of the input — the sign-in Password field uses it for a **Show** / **Hide** text button (`link` colour, 44×44 hit area, dims while pressed, labelled "Show password" / "Hide password").

### Status & progress

`<Badge>` with `tones`; `StageBar` (dots + label for current stage); `Timeline` for history. All pair color with text.

### States

Every async screen uses the same three primitives: `<LoadingIndicator>` while loading, `<ErrorMessage>` (`accessibilityRole="alert"`) on failure, `<EmptyState>` (title, message, optional action) when a list or section has nothing. Detail screens show not-found as a centered error.

## Do's and Don'ts

- **Do** take every color, size, radius and weight from `useTheme()`.
- **Do** give anything tappable a 44×44 hit area (`size.touch`, or `hitSlop` for small visuals).
- **Do** keep one primary action per screen; make the rest secondary.
- **Do** say the stage or status in words.
- **Don't** put white text on orange, or `primary` orange as body text — use `onPrimary` and `link`.
- **Don't** add shadows, gradients, custom fonts or a second accent color.
- **Don't** hard-code hex values or pixel sizes in screens.
