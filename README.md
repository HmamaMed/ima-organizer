# Between Us

*Nos mots, nos moments, notre quotidien.*

*Our words, our moments, our everyday life.*

Between Us is a private, mobile-first space for two partners to share everyday life. It combines conversations, temporary photo/audio moments and shared notebooks with personal birthday reminders. The same React app runs in a browser and inside an Android app through Capacitor. French and English are supported.

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

Shared data is scoped to the current couple. Unsent notes remain private to their author. Wish photos persist independently of temporary moments. Sign-in survives app restarts within the server's 30-day session lifetime: Android saves only the rotating refresh token using Android Keystore encryption in a file excluded from backup; browsers use an HttpOnly session cookie. Passwords and access tokens are never saved to persistent app storage. Logout, device/session revocation, password reset and account deletion invalidate the session.

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

For Android, run `npm run build` and `npx cap sync android` in `mobile`, then build/sign/install through the existing Android project. The Android application ID and Java namespace are `com.betweenus.briolab`. This is a new installation identity relative to the former package; use a matching Firebase Android registration and download its `google-services.json` into `mobile/android/app/`. Do not hand-edit an old Firebase client config to pretend it is registered for the new package. Native builds require the Android SDK and local Firebase client configuration. A backend deployment does not update an installed APK. Run `npm run assets` to synchronize the checked-in SVG logo exports.

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

Validate changes before deploying. After startup, check `/api/privacy/policy`, `/api/identity/config` and the changed feature with approved accounts. Final App Links/signing, real-device push and session checks, monitoring, backup/restore drills and public-release validation remain release work. Billing is not implemented.

### SMTP setup and public registration

The existing Spring Mail integration sends verification and password-reset messages through durable database jobs. Emails use a shared Between Us HTML design with personalized French/English copy, the embedded heart mark, an action button, the real link expiry in UTC, a fallback URL and a plain-text alternative. The sender stays controlled by `COUPLES_MAIL_FROM`. No email SDK is required. [Resend SMTP](https://resend.com/docs/send-with-smtp) is one supported option:

1. Create your provider account, add a domain you own and publish the provider's DNS verification records (SPF/DKIM). Wait for verification. Create a sending API key scoped to the domain when supported. Use an address on that verified domain for the sender, and an address you actually monitor for support.
2. In Render's backend service **Environment**, add the following values, replacing every placeholder. Do not add these credentials to the Android app, `VITE_*` variables or Git. Render's form takes the sender value without shell quotes.

   ```dotenv
   COUPLES_SMTP_HOST=smtp.resend.com
   COUPLES_SMTP_PORT=2587
   COUPLES_SMTP_USERNAME=resend
   COUPLES_SMTP_PASSWORD=YOUR_RESEND_API_KEY
   COUPLES_SMTP_AUTH=true
   COUPLES_SMTP_STARTTLS=true
   COUPLES_SMTP_SSL=false
   COUPLES_MAIL_FROM=Between Us <accounts@YOUR_VERIFIED_DOMAIN>
   COUPLES_SUPPORT_EMAIL=YOUR_MONITORED_SUPPORT_ADDRESS
   COUPLES_PUBLIC_URL=https://YOUR_PUBLIC_APP_HOST
   COUPLES_EMAIL_ENABLED=true
   COUPLES_REGISTRATION_ENABLED=false
   ```

   [Render Free blocks outbound ports 25, 465 and 587](https://render.com/docs/free#other-limitations). Resend documents 2587 as an alternative STARTTLS port; verify delivery from your deployment. Paid Render services can use 587 with these same STARTTLS settings. A free service also sleeps when idle, delaying background email jobs; use an appropriate always-on service for launch.
3. Redeploy with registration still disabled. Enabling email restores verification requirements for existing private accounts too. For an existing account, request a verification email from the sign-in verification screen; confirm delivery, correct branding and a working `/verify#token=...` link. Test password recovery and its `/reset#token=...` link. Check provider delivery events and job failures without logging message bodies or secret tokens. The public URL must serve the real frontend, including those routes, rather than an API-only endpoint.
4. After both flows work, set `COUPLES_REGISTRATION_ENABLED=true` and redeploy. Confirm `/api/identity/config` reports email and registration enabled; create a synthetic account, verify it, sign in, reset its password and pair it with a second test account. Resetting a password must revoke existing sessions. Verify expired/used links are rejected. Keep registration disabled if any step fails.

For another SMTP provider, use its host, port, username/password and verified sender. Port 587 normally uses STARTTLS (`STARTTLS=true`, `SSL=false`); implicit TLS on 465 uses `STARTTLS=false`, `SSL=true`, and is blocked on Render Free. Never disable TLS certificate checks to resolve a delivery problem.

To edit email appearance, change `backend/src/main/resources/mail/identity.html`; localized email copy lives in `IdentityEmailTemplate.java`. After compiling the backend, generate synthetic previews without sending email: from the repository root run `java -cp backend/target/classes backend/scripts/preview-emails.java artifacts/email-previews`, then open `artifacts/email-previews/index.html`. Redeploy the backend to apply template changes; an Android rebuild is not needed. Browser previews do not replace checking a delivered message in the email clients you support.

### Persistent sign-in deployment and checks

Deploy the backend before rebuilding/installing the mobile app: the frontend uses the new `/api/identity/end-session` endpoint and browser cookie transport. Existing explicit-token clients remain supported. Build with Node 24, then run `npm run build` and `npx cap sync android` in `mobile`. The local `SessionVault` Capacitor plugin must be compiled into a new APK/AAB; updating only the web assets of an older installed APK cannot add it. Only Android has a native vault implementation; another native platform needs its own secure adapter.

The browser uses `HttpOnly`, `SameSite=Strict` cookies, `Secure` on HTTPS deployments, and explicit allowed-origin/JSON checks on cookie session requests. Keep the web app and API on the same origin (the current Docker deployment does this), or the same site with exact CORS origins; unrelated frontend/API sites are not supported by these cookies. Set `CORS_ALLOWED_ORIGINS` to explicit origins, never `*`. Browser tabs coordinate rotations with Web Locks where available. Browser storage contains only a non-secret sign-out marker, not credentials. A connection failure during restoration shows a retry screen and preserves the saved session; it does not expose cached account content.

Before launch, sign in on Android, force-stop and reopen, then reboot and reopen. Repeat in a browser after reload/restart. Wait beyond the 15-minute access-token lifetime and confirm automatic renewal. Test logout/reopen, revocation from another device, password reset, offline startup/retry and account switching. Logout removes the saved login even if the backend is offline; server-side revocation requires connectivity. Sessions expire 30 days after the original login, without extending on refresh. Device-specific Keystore behavior and the full signed-release flow still require testing on a real device.

## Play Store assets

The project-local [Play Store asset skill](skills/play-store-assets/SKILL.md) prepares real screenshots, listing graphics and optional preview videos using synthetic data. Ask an AI to read that file, or invoke `$play-store-assets` if its agent discovers project-local skills. Helpers support Playwright capture, phone image validation and narrated motion promos with a spoken hook, animated layers, music and captions. A screenshot montage is available only as a rough-cut option. Generated packs go in ignored `artifacts/play-store/`; uploading to YouTube or Play Console is a separate action.
