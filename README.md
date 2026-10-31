# Entre Nous

*Nos mots, nos moments, notre quotidien.*

*Our words, our moments, our everyday life.*

Entre Nous is a private, mobile-first space for two partners to share everyday life. It combines conversations, temporary photo/audio moments and shared notebooks with personal birthday reminders. The same React app runs in a browser and inside an Android app through Capacitor. French and English are supported.

## What the app contains

| Area | What it does |
| --- | --- |
| Accounts and pairing | Sign in, manage your account and invite a partner into a shared space. Registration, email verification and password recovery depend on server configuration. |
| Notes | A two-way conversation with drafts, scheduled messages and loading older messages. Delivered messages expire after seven days; drafts and future scheduled notes remain until sent. |
| Moments | Share photos, captions and optional uploaded audio in groups. Each group and its media expire 72 hours after the group is created. |
| Wishes | Separate personal and partner wish lists, categories, photos, links and a reversible fulfilled state. Each author controls editing and deletion. |
| Watchlist | Shared films and series, viewing status, search and filters, with separate ratings and reviews for each partner. |
| Recipes | Shared recipes with servings, duration, ordered ingredients and steps, tips and favorites. |
| Birthdays | Personal birthday reminders and a personal notification inbox, independent of the shared space. |
| Partner inbox | Partner activity notifications, notification preferences and Android push delivery through Firebase. |
| Account and privacy | Name, language and timezone settings, sessions/devices, data export, disconnect, reporting and account deletion. |

Shared data is scoped to the current couple. Unsent notes remain private to their author. Wish photos persist independently of temporary moments. Sessions are kept in memory: reloading or restarting the app requires signing in again.

The current interface starts at `mobile/src/App.tsx` and uses `mobile/src/couples/CouplesRoot.tsx`. It replaces an earlier personal birthday-gift app; the retired gym, interest tracker, countdown and original personal screens are no longer part of the frontend. Backend compatibility endpoints remain alongside the current APIs.

## Design

The visual style is warm, calm and personal, with an off-white background, white cards, rounded corners and generous spacing. Plum, rose and gold identify shared actions and different chapters.

| Element | Choice |
| --- | --- |
| Background / text | `#f8f6f3` / `#29232a` |
| Plum / rose / gold | `#482541` / `#aa4566` / `#89642c` |
| Typography | Locally hosted Inter for interface text; Fraunces for display headings |
| Layout | Mobile-first cards and forms; Home and Profile bottom navigation |
| Interaction | Confirmation sheets, loading/empty/error states, visible focus and reduced-motion support |

Shared styles live in `mobile/src/index.css`, `mobile/src/theme/variables.css`, `mobile/src/App.css` and the couples/module stylesheets. Reusable controls live in `mobile/src/shared/ui/`; canonical logos live in `mobile/src/assets/brand/`. Font and wordmark licenses are retained with the assets.

## Technologies

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript 6, Vite 8 |
| UI and routing | Ionic React 8, React Router 5, Ionicons |
| Android | Capacitor 8, native app lifecycle, keyboard and push-notification plugins |
| Backend | Java 21, Spring Boot 4.1, Spring Web MVC, Spring Security, Bean Validation |
| Authentication | BCrypt passwords, JWT access tokens and rotating refresh sessions |
| Database | PostgreSQL, Spring Data JPA/Hibernate, Flyway migrations |
| Media | Private Cloudflare R2 through the AWS S3 SDK; signed reads; FFmpeg/ffprobe for audio validation |
| Notifications / email | Firebase Cloud Messaging, Spring Mail and durable database-backed background jobs |
| Development and checks | npm, Oxlint, Node test runner, Maven Wrapper, JUnit, H2 and PostgreSQL/Testcontainers |
| Deployment | Docker, Render; GitHub Actions for backend tests, frontend build, lint and runtime dependency audit |

## Repository

```text
mobile/
  src/couples/           Accounts, pairing, home, conversation, moments and privacy
  src/modules/           Birthdays, notifications, recipes, watchlist and wishes
  src/shared/            API client, session bridge, UI, navigation and translations
  src/assets/            Brand and empty-state illustrations
  public/                Fonts and browser icons
  android/               Native Android project and resources
  scripts/               Brand synchronization and timezone tests
backend/
  src/main/              Spring application, configuration and SQL migrations
  src/test/              Backend unit and integration tests
  scripts/couples-smoke.py  Isolated local API/media/lifecycle smoke test
scripts/couples-dev.sh   Local stack helper
compose.couples.yml      Local PostgreSQL, Mailpit and S3-compatible storage
Dockerfile              Combined frontend/backend production image
```

## Local development

Use Node.js 24, npm and Docker. Java 21 plus FFmpeg/ffprobe are needed when running the backend directly; the backend container includes these tools.

From the repository root:

```sh
./scripts/couples-dev.sh
```

The helper creates an ignored `.couples-dev.env` containing local credentials and starts isolated development services. It uses local Java when available; `./scripts/couples-dev.sh container` explicitly selects the container backend. Keep that environment file while retaining the local database/storage volumes.

In a second terminal:

```sh
cd mobile
npm ci
# Set VITE_API_URL=http://localhost:8082 in mobile/.env.local.
npm run dev
```

Open `http://localhost:5173`. Local email is captured at `http://localhost:8025`; the API runs at `http://localhost:8082`. Create two test accounts, verify them through the captured emails, then create and accept a partner invitation. Separate browser profiles allow testing both partners.

```sh
./scripts/couples-dev.sh status
./scripts/couples-dev.sh stop
```

Stopping retains local volumes. Avoid a local API override when building for a phone: `localhost` on a phone refers to the phone. `VITE_API_URL` is embedded at build time; restart Vite after changing it.

## Checks and Android builds

```sh
cd mobile
npm test
npm run lint
npm run build
npm run audit:runtime
```

```sh
cd backend
./mvnw test
```

PostgreSQL integration tests require Docker/Testcontainers. With the isolated local stack running, execute `python3 backend/scripts/couples-smoke.py` from the root to exercise accounts, pairing, notes, media, notebooks and deletion with synthetic accounts.

For Android, run `npm run build` and `npx cap sync android` in `mobile`, then build/sign/install through the existing Android project. Native builds require the Android SDK and local Firebase client configuration. A backend deployment does not update an installed APK. Run `npm run assets` to synchronize the checked-in SVG logo exports.

## Deployment and configuration

The root Docker image builds the frontend and serves it with the backend. Render uses the repository root, `./Dockerfile` and `/api/privacy/policy` as the health check. The image includes FFmpeg.

Use `backend/.env.production.example` as the configuration reference. Keep credentials in private environment settings or secret files. Configure:

- `SPRING_PROFILES_ACTIVE=couples,couples-production` and `COUPLES_DB_SCHEMA=couples_app` for the existing deployment.
- PostgreSQL connection settings and separate migration/runtime roles. For Neon, use a direct hostname without `-pooler`; Hikari manages runtime pooling and the app depends on consistent schema selection.
- Distinct JWT/action-token secrets, the public HTTPS URL, support address, retention settings and explicit browser/native CORS origins.
- Private R2 storage and the server-side Firebase service account.
- For private access, `COUPLES_EMAIL_ENABLED=false`, `COUPLES_REGISTRATION_ENABLED=false` and an explicit `COUPLES_PRIVATE_ACCOUNT_EMAILS` list. SMTP, verification emails and email-based recovery are disabled in this mode.
- For public launch, configure SMTP and its sender, enable email, validate verification/recovery, then enable registration separately.

Keep existing deployment secrets and schema settings. The one-time personal-data import is complete; do not rerun import SQL or reintroduce import environment variables. Retain all versioned Flyway migrations: startup validates and applies them. The legacy `public` schema remains separate from current data in `couples_app`.

The hosted Docker build uses same-origin API calls. Android/separate frontend builds need the hosted backend URL in `VITE_API_URL`; public/native links can use `VITE_APP_LINK_ORIGIN`. Do not put server credentials in `VITE_*` variables.

Validate changes before deploying. After startup, check `/api/privacy/policy`, `/api/identity/config` and the changed feature with approved accounts. Persistent Android sign-in, final App Links/signing, real-device push checks, monitoring, backup/restore drills and public-release validation remain release work. Billing is not implemented.
