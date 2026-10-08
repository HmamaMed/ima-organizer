# Life Organizer — Modern Warm design handoff

Design proposal · 7 October 2026 · Android first · Design only

Life Organizer remains a private, personal gift for two people. This proposal modernizes its presentation while preserving its heart, chapter colors, affectionate voice, and existing stack. “Modern Warm” is the design direction, not a product rename.

## What to open

1. Open **mockups.html** in a browser. It works offline and contains 12 redesigned current screens, a scheduling state, three optional module concepts, and a component sheet. Gallery filters are presentation controls, outside the depicted app. App controls in the PNGs are static.
2. Open **overview.png** for a quick four-screen comparison of the proposed direction.
3. Give your IDE agent **06-IDE-HANDOFF.md**, the other Markdown files, **tokens.css**, and the **screens/** folder. The full ZIP contains everything.

## Files

| File | Purpose |
| --- | --- |
| 01-DESIGN-DIRECTION.md | Visual decisions, product constraints, and before/after reasoning. |
| 02-DESIGN-TOKENS.md | Colors, typography, spacing, surfaces, motion, and Android behavior. |
| 03-COMPONENTS.md | Reusable component boundaries, design props, variants, and states. |
| 04-SCREEN-SPECS.md | Screen layouts, role differences, interactions, and API boundaries. |
| 05-MODULE-PROPOSALS.md | Optional future chapters, their smallest useful scope, and permission decisions. |
| 06-IDE-HANDOFF.md | A ready-to-paste implementation brief and staged acceptance checklist. |
| tokens.css | Proposed token values; a reference to merge, not a global reset. |
| mockups.html | Offline gallery of the exact PNG references. |
| ui-reference.html | Editable HTML/CSS layout sketch; browser rendering may differ from the canonical PNGs. |
| overview.png | Home, Notes, Memories, and Gym design board. |
| screens/ | 17 individual PNGs at 780 × 1688, including the component sheet. |
| assets/ | Fictional memory-photo crop and embedded fallback fonts used by the reference. |

## Scope and evidence

These are proposed designs, not captures of a working redesign. They use the attached PROJECT_CONTEXT.md and October 7 screenshots. The application repository was not provided; no source, API, native project, or saved user data has been changed. Verify current source before implementation.

Existing routes and capabilities are reused wherever possible. Future modules, exercise-name editing sheets, unsaved-change protection, and a week-based encouragement summary are explicitly proposals. No future module is authorized for implementation by this handoff.

All personal names, messages, counts, activity, dates, and shopping/calendar entries in these designs are fictional. The optional layout sketch has local tick/chip examples; no state change saves anything. Mockups do not demonstrate authentication, media uploads, notifications, persistence, or native Android behavior.

## Fonts and assets

Production typography stays **Inter + Fraunces**. The offline reference uses embedded **Nimbus Sans** and **P052** fallbacks because the supplied files did not contain the project font assets. These preserve the intended sans/serif roles but are not pixel-identical font matches; use the actual repository fonts in implementation. Font licenses are included. The forest image is cropped from the supplied sample screenshot; replace it with real app content. No new external stock asset is required.

The mockup begins at the application viewport, without pretending to render native Android status/navigation bars. Safe-area handling belongs to the Ionic/Capacitor application.

## Recommended order

First implement the design system and current screens. Then evaluate **Shopping together**, **Our calendar**, and **Little plans** with the owner before adding domain models or endpoints. Keep Home and Profile as the only permanent tabs.
