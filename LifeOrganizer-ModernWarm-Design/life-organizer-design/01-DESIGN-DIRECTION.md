# Design direction: Modern Warm

## The idea

Give the existing personal gift a quieter, more contemporary interface. Everyday controls should be clear and restrained; the emotional moments should come from actual messages, photos, voice, and familiar language.

Keep the Life Organizer name, split heart, Inter/Fraunces pairing, warm light appearance, and Notes/Rose, Memories/Plum, Gym/Gold identity. Rebalance their use rather than replacing the brand.

## Changes from the supplied screens

| Existing reference | Proposed design | Why |
| --- | --- | --- |
| Serif/icon/accent toolbar on almost every screen | Plain back control, small chapter label, clear sans title in the content | Gives long titles room and makes the content hierarchy easier to read. |
| Many borders, pill containers, and visible toolbar shadows | Tinted groups, fine separators where needed, mostly flat surfaces | Reduces visual clutter and makes primary actions more obvious. |
| Similar-looking white module rows | A personal note feature plus restrained chapter tiles | Makes Home feel like a place to return to, while keeping chapters easy to find. |
| Italic serif across many controls and long text | Inter for navigation and reading; Fraunces for greetings and short personal quotes | Keeps the warmth while improving scanning and dense editing screens. |
| Full-width high-emphasis controls competing on composer | One bottom primary action; text-based back/cancel action above | Clarifies which action commits the note. |
| Dense programme row with truncated names and narrow prescriptions | Two-line editor rows plus a focused prescription sheet | Lets the owner read the movement and its prescription before editing. |
| Large empty image placeholders in exercise library | Compact list with muscle label and a small media slot only when present | Works with the existing seeded library, which may have no images. |
| Daily streak as the strongest Gym signal | Programme first, weekly activity second, streak as a secondary statistic | Supports showing up without making every visit about maintaining a number. |
| Strong shadow/rotation on memory cards | Large, straight photos with a readable caption and optional audio control | Lets the actual shared moment carry the visual interest. |

## Composition

- At 390px: 24px content gutters; 16px gaps within groups; 28–32px between sections.
- A single clear heading per screen. Titles wrap rather than ellipsize.
- Primary action is easy to find. Use one prominent filled CTA per flow.
- Full-width note/memory/workout content; two columns only for short chapter tiles.
- Use a warm off-white page, opaque white cards, and subtle chapter tints. Do not use glass effects or blur behind reading content.
- Filled plum is the shared primary action. Rose/plum/gold still identify chapters. Gold is a readable dark ochre in text, with a softer amber surface.
- Screens scroll naturally. The 844px reference viewport is a composition example, not a hard content-height limit.

## Home and navigation

Retain Home and Profile bottom tabs. All chapters use ordinary back navigation. New chapters join the Home collection, rather than adding a tab each time.

Home should show: a greeting; the most recent delivered note when available; the existing chapter collection; a compact activity summary when data exists. Hide the personal-note feature if no delivered note exists, and use a friendly neutral empty state. Do not show a scheduled note to the recipient through the preview.

The owner sees role-specific creation/management entry points inside the same pages. Avoid building a separate admin shell.

## Language

Be familiar and useful: “A little note for you,” “Your next session,” “Take a slow walk,” “Saved for a rainy day.” Keep affectionate content in the owner's messages or appropriate empty states. Avoid making every system label a love letter.

Prefer descriptive actions: “Send note,” “Schedule note,” “Start session,” “Add exercises.” Use ordinary names for modules where practical. “Little plans” is proposed; the other existing module names stay.

The app should support rest and changing circumstances. No scolding copy, lost-streak warnings, invented engagement score, or public comparisons.

## Constraints

This proposal changes design, not account rules, API behavior, authentication, notification delivery, storage, or backend scheduling. Keep the present React/Ionic/Capacitor and Spring Boot architecture.

The current screenshot sample shows a 16-day streak with a three-day programme. The new mockup uses a fictional three-session week instead; neither is evidence of real activity. Implement whatever the verified data supports.

Do not quietly ship new settings that the app cannot save. Profile entries for edit/notification settings remain visibly “Soon” until those features are separately built. Exercise media remains optional. No audio-note creation is implied by the redesigned text composer.

## Acceptance

The redesign is successful if she can read a note, open a memory, and start a workout with very little effort; the owner can author without cramped fields; pages share a coherent component system; and the interface still feels made for her.
