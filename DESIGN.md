# Design — Life Organizer

## Direction (v3 — "Kept" concept, see app-design.html)

Superseding the v2 rose/gold/emerald palette below with the deeper, more
intentional palette drafted in `app-design.html` and `implementation-guide.md`
at the repo root. Same warm, light, romantic-not-cartoonish brief as v2, but
built around a plum/rose/gold trio instead of rose/gold/emerald, with Inter
replacing Plus Jakarta Sans for UI text (Fraunces stays for display/headings,
now used in both upright and italic weights — italic for greetings, captions,
and other "personal moment" text; upright for section titles and labels).

**Signature element**: unchanged — the two-tone geometric heart mark (rose /
gold split), still the logo and the mini-mark on the splash and home screens.

## Palette

| Token | Hex | Role |
|---|---|---|
| `bg` / `paper` | `#FBF4EE` | Primary background — warm blush-white |
| `surface` | `#FFFFFF` | Card / raised surface |
| `mist` | `#F1E4E6` | Tinted surfaces — glance strips, tag pills |
| `line` | `rgba(43,30,36,.12)` | Hairline dividers, borders |
| `ink` | `#2B1E24` | Primary text |
| `ink-muted` (plum-soft) | `#8A6483` | Secondary text — timestamps, captions, hints |
| `rose` | `#C65D7B` | Accent 1 — **Notes** module, logo, primary actions |
| `plum` | `#4A1942` | Accent 2 — **Memories** module, headings |
| `gold` | `#B8935A` | Accent 3 — **Gym Coach** module |
| `plum-dark` | `#34102E` | Splash screen backdrop only |

Each module keeps its own accent so the three feel distinct while the shared
light, warm base keeps everything cohesive.

## Typography

| Role | Face | Use |
|---|---|---|
| Display | **Fraunces** (soft-contrast serif) | Logo wordmark, screen titles, greetings/captions (italic) — used sparingly, so it stays special |
| UI / body | **Inter** | Everything else |

Google Fonts import:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

```css
--font-display: 'Fraunces', ui-serif, Georgia, serif;
--font-ui: 'Inter', system-ui, -apple-system, sans-serif;
```

## Logo

Two files, ready to use:

- **`icon.svg`** — mark only, square, rose background with the two-tone heart
  centered. This is the source for the app icon / splash background.
- **`logo.svg`** — mark + "Life Organizer" wordmark, transparent background,
  for splash screens and anywhere the full lockup is useful.

The wordmark in `logo.svg` is live SVG `<text>` (font-family referenced, not
outlined) — that's fine for editing and for the in-app splash screen (where the
Fraunces webfont is actually loaded), but if you ever export this for print or a
context without the font available, convert the text to outlines first
(Figma/Illustrator: "Create outlines" / "Flatten to path") so it doesn't silently
fall back to a generic serif.

**Generating the full Android icon set from `icon.svg`**: use `@capacitor/assets`
rather than hand-exporting every size —

```bash
npm install -D @capacitor/assets
npx capacitor-assets generate --android
```

Point it at `icon.svg` as the source (see the package's README for the exact
config file it expects); it produces every adaptive-icon density Android needs
in one pass.

## Ready to paste — Ionic theme variables

Drop into `mobile/src/theme/variables.css`, replacing Ionic's default `:root`:

```css
:root {
  --ion-color-primary: #C65D7B;
  --ion-color-primary-rgb: 198, 93, 123;
  --ion-color-primary-contrast: #FFFFFF;
  --ion-color-primary-contrast-rgb: 255, 255, 255;
  --ion-color-primary-shade: #ae5169;
  --ion-color-primary-tint: #cb7086;

  --ion-color-secondary: #B8935A;
  --ion-color-secondary-rgb: 184, 147, 90;
  --ion-color-secondary-contrast: #2B1E24;
  --ion-color-secondary-contrast-rgb: 43, 30, 36;
  --ion-color-secondary-shade: #a1814f;
  --ion-color-secondary-tint: #bf9d6b;

  --ion-color-tertiary: #4A1942;
  --ion-color-tertiary-rgb: 74, 25, 66;
  --ion-color-tertiary-contrast: #FFFFFF;
  --ion-color-tertiary-contrast-rgb: 255, 255, 255;
  --ion-color-tertiary-shade: #41163a;
  --ion-color-tertiary-tint: #5c3055;

  --ion-background-color: #FBF4EE;
  --ion-background-color-rgb: 251, 244, 238;
  --ion-text-color: #2B1E24;
  --ion-text-color-rgb: 43, 30, 36;

  --ion-card-background: #FFFFFF;
  --ion-item-background: #FFFFFF;
  --ion-border-color: rgba(43, 30, 36, 0.12);
  --ion-toolbar-background: #FBF4EE;

  --ion-font-family: 'Inter', system-ui, -apple-system, sans-serif;
}
```

`<IonButton color="primary">` → rose, `color="secondary"` → gold, `color="tertiary"`
→ plum — matches the module colors with no per-component overrides.

## Screens mocked up

See `app-design.html` — Splash, Login, Home, Notes feed, Compose note, Memory
Timeline, Gym Coach, and Profile, all built from the tokens above. The older
`mockups.html` reflects the superseded v2 palette.
