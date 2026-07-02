---
name: xPortal
description: White-label client portal for agencies — project status, deliverables, billing, and communication in one branded workspace.
colors:
  # Light theme (default). Dark values are the .dark override — see prose.
  # Both live as CSS custom properties in globals.css; never hardcode hex.
  bg-primary: "#f5f5f9"
  bg-secondary: "#ffffff"
  bg-tertiary: "#efeff5"
  accent: "#5b48ee"      # indigo — client portal primary, per-client overridable
  accent-2: "#059669"    # emerald — admin console primary, confirmation/success
  ink: "#16161d"
  ink-soft: "#4d4d59"
  ink-muted: "#6e6e7a"
  line: "#e5e5ee"
  warn: "#b45309"
  danger: "#be123c"
  dispute: "#7e22ce"
typography:
  serif:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontWeight: 400
    usage: "h1 page-title hero + big KPI numbers only — one editorial moment per page"
  sans:
    fontFamily: "Geist, system-ui, sans-serif"
    usage: "everything else — h2/h3, body, UI, labels, buttons"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    usage: "data — dates, IDs, units, caps eyebrow labels"
  display:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    usage: "the xPortal wordmark only"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "32px"
shadow:
  card: "0 1px 2px rgb(22 22 29 / 0.04), 0 12px 32px -16px rgb(22 22 29 / 0.14)"
  card-dark: "none — borders carry the separation in dark mode"
  button: "inset 0 1px 0 rgb(255 255 255 / 0.16), 0 1px 2px rgb(22 22 29 / 0.24)"
components:
  button-primary-admin:
    backgroundColor: "{colors.accent-2}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  button-primary-client:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  button-destructive:
    backgroundColor: "{colors.danger}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  input:
    backgroundColor: "{colors.bg-tertiary}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.bg-secondary}"
    rounded: "{rounded.xl}"
    padding: "20px 24px"
    shadow: "{shadow.card}"
  kpi-card:
    backgroundColor: "{colors.bg-secondary}"
    rounded: "{rounded.lg}"
    padding: "16px"
    shadow: "{shadow.card}"
  chip:
    backgroundColor: "tinted (color/10-14%)"
    rounded: "{rounded.full}"
    padding: "2px 8px"
---

# Design System: xPortal

## 1. Overview

xPortal is two apps under one brand, split by who's looking:

- **Admin console** (`/admin/*`) — the operator's tool. Light canvas, **emerald**
  (`accent-2`) as the primary interactive color, dense information, no
  editorial flourish. It's the cockpit.
- **Client portal** (`/portal/*`) — what clients see. Light canvas, an
  **always-dark sidebar**, **indigo** (`accent`, per-client overridable) as
  the primary color, and one deliberate serif moment per page. It's the
  presentation.

Both surfaces share the same token system (colors, shadows, radii) so they
never diverge accidentally — only the *role* each token plays changes.

**Creative point of view:** precise, editorial, quietly expensive. Not a
generic SaaS dashboard (Asana/Jira flatness), not a startup-landing-page
(gradients, glassmorphism), not a brochure (stock photography, decorative
serif everywhere). One serif headline, one dark sidebar, soft real shadows,
mono data — restraint is the signal, not decoration.

**Key characteristics:**
- Light canvas by default; full dark-mode palette via the `.dark` class
  (client sidebar is dark *regardless* of theme — see Navigation).
- Two-role accent vocabulary: indigo = client-portal primary / notification
  badges everywhere; emerald = admin-console primary / success-confirmation
  everywhere.
- One restrained serif moment per page (page-title hero, KPI numbers) —
  never a section heading, never body text.
- Soft, layered card shadow (not flat) in light mode; borders alone carry
  separation in dark mode.
- Per-client branding via CSS custom property override — `accent` cascades
  into every surface that carries brand signal, on the client side only.

## 2. Colors

All colors are CSS custom properties in `src/app/globals.css`, consumed via
Tailwind utilities (`bg-accent`, `text-ink-soft`, `border-line`, and opacity
variants like `bg-accent-2/12`). **Never hardcode a hex value in a component**
— it silently breaks dark mode and per-client branding.

| Token | Light | Dark | Role |
|---|---|---|---|
| `bg-primary` | `#f5f5f9` | `#0b0f19` | Page canvas |
| `bg-secondary` | `#ffffff` | `#111827` | Cards, panels |
| `bg-tertiary` | `#efeff5` | `#1f2937` | Inputs, nested wells |
| `accent` | `#5b48ee` | `#7c6cf6` | Client portal primary; per-client overridable |
| `accent-2` | `#059669` | `#10b981` | Admin primary; success/confirmation everywhere |
| `ink` / `ink-soft` / `ink-muted` | `#16161d` / `#4d4d59` / `#6e6e7a` | `#f3f4f6` / `#9ca3af` / `#6b7280` | Text, 3-step hierarchy |
| `line` | `#e5e5ee` | `#374151` | Borders, dividers |
| `warn` | `#b45309` | `#fbbf24` | Warning state |
| `danger` | `#be123c` | `#fb7185` | Error, destructive, blocked |
| `dispute` | `#7e22ce` | `#c084fc` | Invoice dispute state only |

### Named Rules

**The Two-Accent Split.** `accent` (indigo) is the client portal's primary
color and the *only* one clients ever see recolored per-client. `accent-2`
(emerald) is the admin console's primary color — buttons, active tab
underline, active nav icon. Indigo notification-badge counts appear on
*both* surfaces (including inside admin) — that's intentional, not a leak:
badges are "something happened," which is always indigo regardless of whose
console you're in.

**The Per-Client Override.** `client.accent_color` overrides `--accent`
inline at `src/app/portal/layout.jsx`'s root. Every `bg-accent`/`text-accent`
utility in the client portal — including inside the always-dark sidebar —
reflects the client's brand automatically. `accent-2` is never
client-overridable; it stays the operator's confirmation color everywhere.

**The Ink Floor Rule.** `ink-muted` is the minimum text contrast allowed on
any surface — it meets WCAG AA against both `bg-secondary` and
`bg-tertiary` in both themes. Do not go dimmer.

## 3. Typography

Four families, each with exactly one job. Mixing jobs (serif on a section
heading, mono on prose) is the fastest way to make this look generic again.

- **Instrument Serif** (`font-serif`, weight 400) — the page-title `<h1>`
  hero and large KPI numbers. Nowhere else. This is deliberately the *only*
  serif moment on a page; that restraint is what reads premium instead of
  "serif slapped everywhere."
- **Geist** (`font-sans`, default) — everything else: `h2`/`h3` section
  headings, body copy, buttons, form labels, nav labels.
- **Geist Mono** (`font-mono`) — data: dates, IDs, dollar amounts, percentages,
  and every caps "eyebrow" label (`text-[10.5px] uppercase tracking-[0.14em]`).
- **Space Grotesk** (`font-display`) — the xPortal wordmark only, in
  `Logo.jsx`/`LogoMark`. Never used for page content.

Global rule (`globals.css`): semantic `h1` gets Instrument Serif at its
natural weight (400); `h2`/`h3` get Geist at 600. `text-wrap: balance` is
applied to all three so multi-word headings never leave a widow.

### Named Rules

**The One-Serif-Moment Rule.** A page gets exactly one serif element: its
`<h1>`. KPI values are the one sanctioned *second* use (they read as "the
number that matters," which earns the same weight as a headline). Card
titles, tab labels, button text, and body copy are always Geist.

**The Eyebrow Convention.** Mono caps labels (`Phase timeline`, `Key
metrics`, `Halden Aerospace`) sit above section content as context, not as a
heading — they're `text-ink-muted`, never colored, never bold beyond the
font's own weight.

## 4. Elevation

Light mode uses a **soft, layered card shadow** (`--shadow-card`) on every
`rounded-xl`/`rounded-2xl` panel sitting on `bg-secondary` — this is a real
shadow, not flat borders-only. Dark mode sets `--shadow-card: none` and lets
borders (`border-line`) carry the separation instead, since shadows read
poorly against dark surfaces.

Buttons get their own `--shadow-button` (an inset highlight + a grounded
drop shadow) and lift 1px on hover/press for solid (`bg-accent`/`bg-accent-2`)
variants — see the `button.bg-accent` rules in `globals.css`.

### Named Rules

**The Card Shadow Rule.** Any card-level container (`rounded-xl` or
`rounded-2xl` on `bg-secondary`) should carry `shadow-card` in light mode —
either via the global `.rounded-xl.bg-bg-secondary` rule or an explicit
`shadow-[...]` utility matching its curve. Don't add a shadow to
inline/inset elements (badges, chips, table rows).

**The Dark Mode Exception.** Never hardcode a shadow that's meant to survive
dark mode — `--shadow-card` already resolves to `none` there by design.
Trust the token, don't fight it with an explicit dark: override.

## 5. Components

### Buttons
- **Shape:** `rounded-lg` (8–9px). Nothing pill-shaped except chips/badges.
- **Primary:** Solid `bg-accent-2` (admin) or `bg-accent` (client), white
  text, `px-4 py-2`, font-medium/semibold. Carries `--shadow-button` +
  1px hover lift. Used for "Save", "Create", "Send", "Approve".
- **Ghost/Secondary:** `border border-line`, `bg-bg-secondary`,
  `text-ink-soft`; hover moves border to the surface's accent and text to
  `ink`. Used for "Cancel", "Preview", secondary actions.
- **Destructive:** `bg-danger`, white text. Used for "Delete client",
  "Request revisions", "Dispute". High-consequence actions (client delete)
  require typing a confirmation string, not just a second click.
- **Disabled:** 50% opacity, no pointer events.

### Chips / Status Pills
Colored-glass style throughout: `border-{color}/30 bg-{color}/10
text-{color}`, `rounded-full`, small caps or mono text. Used for deliverable
status, invoice status, KPI health, client health chips, "on track"/"needs
attention" pills. Never solid-fill — the tint plus matching text color is
the whole language.

### Cards / Containers
- **Section panels:** `rounded-xl`/`rounded-2xl`, `bg-bg-secondary`,
  `border border-line`, `shadow-card`, `p-5`–`p-6`.
- **List rows** (Plan, Documents, Billing, KPI rows): flat `div` rows inside
  a `divide-y divide-line` container with a single outer border — not
  `<table>`. This replaced the earlier plain-table pattern app-wide.
- **Stat ribbons:** one bordered box, internal columns via
  `border-r border-line`, each with a mono caps label + large value.

### Inputs / Fields
- `bg-bg-tertiary`, `border border-line`, `rounded-lg`, `px-3 py-2`.
- Focus: `focus:border-accent` (client) or `focus:border-accent-2` (admin).
  No glow/ring — the border color shift is the whole signal.
- Error: border shifts to `border-danger`; message below in
  `text-danger text-xs`.

### Navigation

**Client sidebar (desktop):** 250px fixed left panel, **always dark**
(`#0b0d13`) regardless of the light/dark theme toggle — this is a deliberate
brand frame, not a themed surface. xPortal mark + "Client portal" mono
subtitle at top; nav items are caps mono-tracked labels with an indigo
active state and a right-edge 3px accent tab; user chip (avatar-gradient +
name + sign-out) pinned at the bottom, alongside the theme toggle.

**Client top bar (mobile):** same dark surface, icon-only nav.

**Admin sidebar (desktop):** light surface (`bg-bg-secondary`), 240–260px,
`border-r border-line`. Section eyebrows ("Clients", "Console") in mono
caps above nav groups. Active state: `bg-accent-2/10` tint + emerald icon +
right-edge accent tab, same mechanism as the client sidebar but emerald and
on a light surface.

**Top bar (both):** sticky, `bg-{surface}/80` + `backdrop-blur` (glass),
breadcrumb on the left, date/status on the right.

### Signature Components

**Phase timeline** (`ProjectStatus.jsx`): a connected, single-row segmented
bar — one flex-1 segment per phase, `border-r border-line` between
segments, tinted by status (`bg-accent-2/25` done, `bg-accent/12` active
with a diagonal accent-tinted stripe overlay, `bg-danger/15` blocked,
`bg-bg-secondary` upcoming). Labels centered beneath each segment. Below
the bar: a slim progress track + percentage + target date, and an
"up next" / "blocked — needs attention" line.

**KpiGrid:** `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`. Each card: tinted
icon tile top-left, health-status chip top-right (`text-[10px] uppercase`,
tinted), the value in **Instrument Serif** at `text-[2rem]`, mono caps name
label, mono goal line. Health tint (good/close/off) drives the icon color
and chip only — the card border stays neutral `border-line`.

**Timeline (Gantt, `Timeline.jsx`):** phase bars + milestone diamonds,
scoped to a fixed minimum width (`overflow-x-auto` beyond it, not
crushed). Dates are **always visible** — a real weekly/monthly tick ruler,
a date range under every phase bar, a date under every milestone — nothing
is hover-only. A legend explains the color/shape language, and there's a
client-side Hide/Show-milestones toggle. "Today" is a distinct danger-red
line, deliberately not the same color as milestone markers (warn/amber).

## 6. Do's and Don'ts

### Do:
- **Do** route every color through the CSS custom properties — `bg-accent`,
  `text-ink-soft`, etc. — never a raw hex value in a component.
- **Do** keep the serif to exactly one page-title `<h1>` (+ KPI numbers).
  Section headings, card titles, and body text are always Geist.
- **Do** give card-level containers `shadow-card` in light mode; trust the
  token to disable itself in dark mode.
- **Do** use `accent-2` (emerald) for admin's primary actions and `accent`
  (indigo) for the client portal's — badges are the one place indigo
  appears on both.
- **Do** override `--accent` at the portal layout root for per-client
  branding; never touch `accent-2`.
- **Do** use list-row patterns (`divide-y` div rows) instead of `<table>`
  for Plan/Documents/Billing/KPI-editor style data.
- **Do** apply `text-wrap: balance` to headings (already global for h1–h3).
- **Do** match button text to the specific action ("Approve deliverable",
  "Save branding") — never generic "Submit" or "OK."

### Don't:
- **Don't** use a serif or display face on anything but the page `<h1>` and
  KPI numbers. A second serif moment on a page reads as inconsistent, not
  premium.
- **Don't** add `box-shadow` ad hoc — use `shadow-card`/`shadow-button` or
  the equivalent explicit utility that matches them; don't invent a new
  shadow recipe per component.
- **Don't** solid-fill status chips — tinted background + matching text
  color only (`bg-accent-2/10 text-accent-2`), never a saturated fill.
- **Don't** use `dispute` (`#7e22ce`/`#c084fc`) for anything but invoice
  disputes — it's a narrow, specific state color, not a general purple accent.
- **Don't** let `accent-2` bleed into the client portal as a primary color,
  or `accent` into admin as a primary — badges are the sanctioned exception,
  not a precedent for anything else.
- **Don't** build a generic SaaS dashboard: flat, overcrowded, no identity.
  Every screen should carry a point of view.
- **Don't** use gradient text, glassmorphism panels, or hero-metric-plus-
  gradient layouts — these read as template-generated, which is exactly
  what this system exists to avoid.
- **Don't** go dimmer than `ink-muted` for any displayed text.
