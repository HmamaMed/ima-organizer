# Design tokens

Merge the values in tokens.css into the existing theme. Inspect mobile/src/index.css, theme/variables.css, App.css, and the shared components first. Prefix new tokens with lo-. Do not install a second UI framework or overwrite Ionic resets.

## Colors

| Token | Value | Use |
| --- | --- | --- |
| --lo-bg | #F8F6F3 | Main warm page. |
| --lo-surface | #FFFFFF | Opaque card/sheet surface. |
| --lo-ink | #29232A | Titles and normal text. |
| --lo-muted | #6C636F | Secondary text. |
| --lo-line | #E5DFE5 | Decorative dividers and card boundaries. |
| --lo-control-border | #968B98 | Input boundaries when no other cue identifies the control. |
| --lo-plum | #482541 | Shared CTA and Memories. |
| --lo-plum-soft | #EDE6EF | Memory/selected backgrounds. |
| --lo-rose | #AA4566 | Notes icon, text, and emphasis. |
| --lo-rose-soft | #F4E5EB | Note feature and note groups. |
| --lo-gold | #89642C | Gym text and icons. |
| --lo-gold-soft | #F3EBDD | Workout surface. |
| --lo-success | #366A55 | Success text/icon. |
| --lo-success-soft | #E6F0E9 | Success surface. |
| --lo-danger | #AE334B | Errors/destructive text. |
| --lo-focus | #AA4566 | Visible focus outline. |

Use ink/muted for reading. Pair accent text with white/bg or its own soft surface. Use white text on plum or rose; do not use white body-size text on gold. --lo-line is decorative and should not be the only indication of an input. Status always has words/icons as well as color.

The static palette was contrast-checked for body text pairs at 4.5:1, and control outlines/focus against adjacent page/card backgrounds at 3:1. Verify contrast again on the actual components, including disabled, error, selected, and photo-overlay states.

Ionic primary may remain mapped to rose to preserve existing behavior during migration. New primary AppButton uses --lo-plum explicitly. Map secondary to --lo-gold and tertiary to --lo-plum only after checking all current usage; token meaning and button prominence are separate decisions.

## Type

| Role | Font | Size / line height | Weight |
| --- | --- | --- | --- |
| Display/greeting | Fraunces | 32 / 36px | 500 |
| Screen title | Inter | 28 / 34px | 600 |
| Section title | Inter | 18 / 24px | 600 |
| Personal quotation | Fraunces | 23 / 31px | 400 or 500 |
| Body | Inter | 16 / 24px | 400 |
| Control label | Inter | 15 / 20px | 600 |
| Secondary detail | Inter | 14 / 20px | 400 |
| Eyebrow / short date | Inter | 12 / 16px | 600 |

Use slight negative tracking only on large headings. Avoid uppercase for long labels. Metadata stays at least 12px. Use tabular numerals for a live timer and aligned numerical values. Never force application-wide italic text.

At larger system text sizes, labels wrap, containers grow, and horizontally crowded layouts become single-column. Support 200% text scaling without hiding the primary action or removing content. Do not disable text zoom.

## Layout and surfaces

Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48px. Screen gutter is 24px at 390px, 20px at 360px, and 16px at 320px.

Radii: controls 12px; cards 20px; feature cards 24px; top of bottom sheets 28px; pills 999px. Prefer one or two radii in a view.

Shadows: none on standard cards; optional 0 8px 24px rgba(41,35,42,.06) for overlays only. Cards may use a very faint 1px separator. Avoid heavy Android toolbar shadows.

Minimum tappable area: 48 × 48 CSS px for icon controls, including reorder, overflow, info, and delete. Artwork can be 20–24px inside that area. Use Ionicons already in the project with a consistent outline style; the mockup's line SVGs are visual approximations, not a new icon library.

## Android and Ionic

Use IonPage, IonContent, IonHeader where appropriate, and IonModal for sheets. Let Ionic own scroll regions and keyboard behavior. Do not copy the reference's phone frame, fake clock, fixed 844px viewport, or CSS scroll shell into the app.

Respect env(safe-area-inset-top/bottom) with the existing Capacitor configuration. One main scroll region per page. Bottom tabs reserve their own space; a sticky action footer goes above them with safe-area/keyboard behavior verified. Use the existing Android-back integration and restore focus after sheets close.

## Motion

Use 160ms pressed/selection feedback and 220ms sheet transitions. A single restrained celebration may appear after a confirmed workout write. Content reveals may use opacity/translate up to 8px, once, without staggered delays that block reading.

Under prefers-reduced-motion: reduce transforms, skip decorative reveals/confetti, and preserve a readable static completion message. No endless pulsing, parallax photos, or decorative wave animation.

## Themes

Light appearance is the deliverable. A future dark theme needs separately chosen and tested tokens; do not invert this palette automatically or claim dark-mode coverage.
