# Design — Life Organizer

## Direction (v2 — revised after feedback)

First pass went dark/moody and it read wrong — that's a "mysterious" register, not a
"romantic and joyful" one. Rebuilt around a light, warm palette instead: bright
enough to feel like something you'd actually enjoy opening every day, warm enough
to feel romantic, and kept out of pastel/cartoon territory by using confident,
saturated jewel tones rather than soft candy colors, plus a deep wine-toned ink
for text instead of flat black or gray.

Still avoiding the generic AI-design default (cream background + terracotta accent
+ high-contrast serif) — the background here leans blush-white rather than
yellow-cream, the primary accent is a raspberry-rose rather than orange-terracotta,
and the serif is used sparingly (logo and headings only) rather than carrying the
whole UI.

**Signature element**: a two-tone geometric heart mark — split down the middle,
rose on one half, gold on the other. Flat, precise, no outline or cartoon
detailing, so it reads as a modern mark rather than a literal cartoon heart.
It's the logo, and a miniature version anchors the home screen header.

## Palette

| Token | Hex | Role |
|---|---|---|
| `bg` | `#FDF4F6` | Primary background — warm blush-white |
| `surface` | `#FFFFFF` | Card / raised surface |
| `line` | `#F3DFE3` | Hairline dividers, borders |
| `ink` | `#3B1224` | Primary text — deep wine-plum, not flat black |
| `ink-muted` | `#9C7B86` | Secondary text — timestamps, captions, hints |
| `rose` | `#E14F73` | Accent 1 — **Notes** module, logo, primary actions |
| `gold` | `#EAA857` | Accent 2 — **Memories** module |
| `emerald` | `#1E7F63` | Accent 3 — **Gym Coach** module |

Each module keeps its own accent so the three feel distinct while the shared
light, warm base keeps everything cohesive. Module tiles on the home screen use
a soft tint of their accent (roughly 10% strength) as a fill, with the full
accent color reserved for icons and text — that's what keeps the palette feeling
joyful rather than loud.

## Typography

| Role | Face | Use |
|---|---|---|
| Display | **Fraunces** (soft-contrast serif) | Logo wordmark, screen greetings/titles only — used sparingly, so it stays special |
| UI / body | **Plus Jakarta Sans** | Everything else — a rounded, modern geometric sans that carries most of the "joyful/contemporary" feeling |

Google Fonts import:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet">
```

```css
--font-display: 'Fraunces', ui-serif, Georgia, serif;
--font-ui: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
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
  --ion-color-primary: #E14F73;
  --ion-color-primary-rgb: 225, 79, 115;
  --ion-color-primary-contrast: #FFFFFF;
  --ion-color-primary-contrast-rgb: 255, 255, 255;
  --ion-color-primary-shade: #c6465f;
  --ion-color-primary-tint: #e56185;

  --ion-color-secondary: #EAA857;
  --ion-color-secondary-rgb: 234, 168, 87;
  --ion-color-secondary-contrast: #3B1224;
  --ion-color-secondary-contrast-rgb: 59, 18, 36;
  --ion-color-secondary-shade: #ce944c;
  --ion-color-secondary-tint: #ecb167;

  --ion-color-tertiary: #1E7F63;
  --ion-color-tertiary-rgb: 30, 127, 99;
  --ion-color-tertiary-contrast: #FFFFFF;
  --ion-color-tertiary-contrast-rgb: 255, 255, 255;
  --ion-color-tertiary-shade: #1a7057;
  --ion-color-tertiary-tint: #348c72;

  --ion-background-color: #FDF4F6;
  --ion-background-color-rgb: 253, 244, 246;
  --ion-text-color: #3B1224;
  --ion-text-color-rgb: 59, 18, 36;

  --ion-card-background: #FFFFFF;
  --ion-item-background: #FFFFFF;
  --ion-border-color: #F3DFE3;
  --ion-toolbar-background: #FDF4F6;

  --ion-font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}
```

`<IonButton color="primary">` → rose, `color="secondary"` → gold, `color="tertiary"`
→ emerald — matches the module colors with no per-component overrides.

## Screens mocked up

See `mockups.html` — Splash, Home (module picker), Notes feed, Memory Timeline,
and today's Gym Coach view, all built from the tokens above.
