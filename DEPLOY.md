# Deploy the existing app on Render

The app uses the normal commands: `npm run dev` and `npm run build` from `mobile`. The Render service runs the updated backend and serves the built web app using the repository-root `Dockerfile`.

**No SMTP provider is required for the current private app.** Only the two approved existing email addresses can sign in, using their existing app passwords. Verification emails, public registration and password recovery are disabled. Account email addresses remain unverified in the database; private access is explicitly approved through configuration instead.

## One-time upgrade of the existing database

Use the prepared private files at the repository root:

- `.render-upgrade.env`: ready-to-import Render settings, including the two supplied email addresses.
- `.render-upgrade.sql`: the matching database role and SQL that makes the old tables read-only during cutover.

Keep these files private and keep their generated credentials matched. `.couples-dev.env` belongs to the optional local Docker stack and is not the Render configuration.

1. Back up the existing Neon database. Disable Render automatic deployment while preparing the upgrade, then push the reviewed changes.
2. In the **existing Render service**, import `.render-upgrade.env` through **Environment → Add from .env** and choose **Save only**. Keep the existing `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `R2_*` credentials and Firebase secret-file setting. Remove stale `COUPLES_*` database/storage/Firebase overrides that point at local services; the private upgrade file provides the current overrides you need.
3. In the existing Neon database's SQL console, as the database owner, execute `.render-upgrade.sql` once. The old app becomes read-only during the upgrade; its rows are retained.
4. Apply the Render Docker settings below, then deploy the latest commit.
5. Confirm successful import/startup in the logs, sign in with each existing account, and check the saved content. After validation set `COUPLES_IMPORT_PERSONAL=false`; keep `COUPLES_DB_SCHEMA=couples_app` permanently.

| Render setting | Value |
| --- | --- |
| Root Directory | Empty: use the repository root |
| Runtime | Docker |
| Dockerfile Path | `./Dockerfile` |
| Docker Build Context Directory | `.` |
| Health Check Path, after the updated app starts | `/api/privacy/policy` |

The old backend returns 401 for the new public endpoints. The database copy and new backend configuration must be deployed together. The importer keeps original account IDs/password hashes and copies content into `couples_app`; the original `public` tables stay available for rollback. Follow [the detailed upgrade and rollback guide](backend/RENDER_UPGRADE.md) for the full cutover procedure and supported data shapes.

## Current account settings

The private settings file already contains the actual approved addresses:

```dotenv
SPRING_PROFILES_ACTIVE=couples,couples-production
COUPLES_EMAIL_ENABLED=false
COUPLES_REGISTRATION_ENABLED=false
COUPLES_PRIVATE_ACCOUNT_EMAILS=OWNER_EMAIL,RECIPIENT_EMAIL
```

Keep the private account list after the import is disabled. It restricts login and active sessions while email delivery is off. SMTP credentials and `COUPLES_MAIL_FROM` are not required in this configuration; old `COUPLES_SMTP_*` settings can be removed. Existing R2/Firebase configuration still applies to media and push notifications.

## Verify and use the app

Open `https://ima-organizer.onrender.com`. These public API checks should return HTTP 200:

```sh
curl -fsS https://ima-organizer.onrender.com/api/identity/config
# {"emailEnabled":false,"registrationEnabled":false}
curl -fsS https://ima-organizer.onrender.com/api/privacy/policy
```

Sign in with the supplied email and the existing **app password**. No verification email is needed. The current login API is `POST /api/identity/login` with `email`, `password` and `deviceName`; `/api/auth/login` belongs to the previous app.

For local frontend development, keep `mobile/.env`'s `VITE_API_URL` pointed at the Render service:

```sh
cd mobile
npm run dev
```

For an Android update, build the frontend with the hosted API URL, run `npx cap sync android`, then rebuild/sign/install the APK using the existing Android project. Credentials currently stay in memory, so reopening/reloading requires sign-in.

## SMTP at official launch

When ready, configure your chosen SMTP provider in Render, set `COUPLES_EMAIL_ENABLED=true`, and validate delivery/verification/password recovery. Real email verification will then apply to the existing accounts too. Enable `COUPLES_REGISTRATION_ENABLED=true` only when you are ready for public signups. No email provider is selected by the current deployment configuration.
