# Life Organizer

The updated app uses the normal commands: `cd mobile && npm run dev` for development and `npm run build` for deployment or Android packaging. Accounts, pairing, two-way notes/memories, shared notebooks and privacy flows are part of this app; there is no separate frontend mode.

Keep `VITE_API_URL` pointed at the backend you are validating. [Deploy to Render](DEPLOY.md) using the existing database and private account settings; SMTP is deferred until official launch. [Local setup and implementation](backend/COUPLES_FOUNDATION.md) describes the development stack. Changes follow the usual edit, validate, then push workflow. Android updates also require rebuilding/installing the APK.

The active app supports French and English through the flag selector beside the logo. Notes use a conversation view with the latest 10 messages, cursor-based loading of older messages and seven-day retention from delivery; private drafts and scheduled notes remain until sent. Wishes have separate personal/partner lists and a reversible fulfilled state.

See the [architecture and launch roadmap](COUPLES_PRODUCT_ROADMAP.md) for the public release plan.

## Original personal app reference

The sections below describe the original app. The current account system and deployment requirements are documented in the setup guide linked above.

A private, modular mobile app built as a birthday gift. Not a generic utility app —
every module is written for one specific person. The initial three modules now
sit alongside shared everyday notebooks, with more chapters added over time.

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Mobile shell | React + Vite + TypeScript | Your current daily framework |
| UI components | Ionic React (`@ionic/react`) | Native-feeling components (tabs, cards, lists) without hand-building UI/UX |
| Native wrapper | Capacitor | Packages the web app into an installable Android APK, sideloadable — no Play Store review needed |
| Backend | Spring Boot (Java) | Your daily backend tool, zero new learning |
| Database | PostgreSQL (via JPA/Hibernate) | Same territory as your Cosy work |
| Push notifications | Firebase Cloud Messaging + `@capacitor/push-notifications` | Native-level delivery on Android, free tier |
| Media storage | Private Cloudflare R2 | Authenticated backend uploads, temporary signed reads, 72-hour memory categories and automatic file deletion |
| Auth | Spring Security + JWT, 2 seeded users | Only two users ever (OWNER = you, RECIPIENT = her) — no need for open registration |

> Current storage setup and existing-memory erasure: [Cloudflare R2 setup](backend/R2-SETUP.md).

## Mes envies 🎁

A shared gift-idea notebook: she adds, edits and removes objects, books and experiences; you can browse her list. Each wish has a title and category, with an optional photo, HTTP/HTTPS link and short details. The French interface includes category filters, photo previews and deletion confirmation, using the existing Life Organizer design.

Wishes stay until she removes them. Photos use the same private Cloudflare R2 bucket under `wishes/`, separately from the 72-hour memory categories. Replaced/deleted photos are removed by a retryable backend worker; unused uploads are cleaned after 24 hours. No new credentials are needed beyond the existing R2 configuration. Both updated backend and mobile builds must be deployed.

[Module/API details](mobile/src/modules/wishes/README.md) · [Screenshots and verification](design-validation/wishes/README.md)

## On regarde quoi ? 🎬

A shared film and series selection that both accounts can manage. Titles move between **À voir**, **En cours** and **Vu**, with optional notes, search and format/status filters. Once a title is marked Vu, each person can leave their own 1–5 star rating and comment, edit it or remove it. One person's review never replaces the other's. Removing a title removes its reviews after confirmation.

## Nos recettes 🍝

A shared recipe notebook that both accounts can manage, with **À essayer** and **Nos favoris**. Each recipe stores servings, optional duration, ordered ingredients with separate quantities, ordered preparation steps and personal tips. A reading sheet keeps the ingredients and steps easy to follow; search includes ingredient names. These structured ingredients can support a future shopping-list feature.

Both modules use the current database and authentication, with no extra API key or storage setup. Deploy the updated backend and mobile build together. [Cinema API](mobile/src/modules/watchlist/README.md) · [Recipe API](mobile/src/modules/recipes/README.md) · [Verification and screenshots](design-validation/shared-notebooks/README.md)

## Modules — v1 (birthday launch)

1. **Notes** — you write a note (now or scheduled for later) from your dashboard; she
   gets a push notification and can scroll back through every note ever sent, in a feed.
2. **Memory Timeline** — a scrollable feed of photo entries. Each entry: a photo,
   an optional short caption, an optional short audio clip (your voice). Designed to be
   scrolled slowly, ~5 minutes, like a walk through memories.
3. **Gym Coach** — a simple structured home-workout plan you curate (which days train
   which muscle groups, which exercises, how many sets/reps, short instructions). She
   opens it, sees today's workout, checks it off when done.

## Coming Soon (post-launch, not in v1)

- Shopping list module
- Whatever comes after that — the module-picker UI is built to support adding entries
  without touching existing modules

## Timeline (8 weeks)

| Weeks | Focus | Ships |
|---|---|---|
| 1 | Backend foundation: auth, DB schema for all 3 modules, Firebase/FCM wired end-to-end with one test push | Nothing user-facing yet, but the highest-risk piece (push delivery) is proven early |
| 2 | Notes module, full: dashboard send/schedule, her feed, push on send | **Notes module fully working** — first real win |
| 3-4 | Memory Timeline: photo + audio upload, feed UI, playback | **Memory Timeline working** |
| 5-6 | Gym Coach: your workout content entered, plan display, check-off UI | **Gym Coach working** |
| 7 | Integration pass: "coming soon" placeholder for future modules, real-device testing across all 3, battery-optimization prompt for reliable push | Full app, polish pass |
| 8 | Buffer only — no new features. Testing, signing the release APK, prepping the reveal | Final APK ready |

**If week 6 arrives and Gym Coach isn't done:** simplify it, don't cut it — a static
weekly plan with a checklist is still a real module. It's the easiest of the three to
descope without it feeling unfinished, because it doesn't depend on push notifications
or media upload working correctly.

## Folder Structure

```
life-organizer/
├── README.md
├── ARCHITECTURE.md
├── SETUP.md
├── AGENT_PROMPT.md
├── mobile/                        # React + Vite + Ionic + Capacitor
│   ├── src/
│   │   ├── modules/
│   │   │   ├── notes/
│   │   │   ├── memories/
│   │   │   └── gym/
│   │   ├── shared/                # shared components, API client, auth context
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── android/                   # generated by `npx cap add android`
│   ├── capacitor.config.ts
│   └── package.json
└── backend/                       # Spring Boot
    ├── src/main/java/com/lifeorganizer/
    │   ├── auth/
    │   ├── notes/
    │   ├── memories/
    │   ├── gym/
    │   └── LifeOrganizerApplication.java
    ├── src/main/resources/application.yml
    └── pom.xml
```

See `ARCHITECTURE.md` for data models and API design, `SETUP.md` for exact commands
to scaffold the project, and `AGENT_PROMPT.md` for a ready-to-paste brief for your
agent IDE.
