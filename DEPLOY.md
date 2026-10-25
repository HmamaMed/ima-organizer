# Deploy Life Organizer

The one-time database import is complete. Normal updates follow **edit → validate → push → deploy**. The existing Neon database and account passwords stay in use; the app reads and writes the `couples_app` schema.

## Render configuration

Keep the current settings in the existing Render service. The private, Git-ignored `.render.env` contains the ongoing settings; credentials have not changed. It can be imported through **Environment → Add from .env** if needed. Keep the existing `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `R2_*` and `FIREBASE_SERVICE_ACCOUNT_PATH` settings too.

| Setting | Value |
| --- | --- |
| Root Directory | Empty: repository root |
| Runtime | Docker |
| Dockerfile Path | `./Dockerfile` |
| Docker Build Context Directory | `.` |
| Health Check Path | `/api/privacy/policy` |

Keep these application settings:

```dotenv
SPRING_PROFILES_ACTIVE=couples,couples-production
COUPLES_DB_SCHEMA=couples_app
COUPLES_EMAIL_ENABLED=false
COUPLES_REGISTRATION_ENABLED=false
COUPLES_PRIVATE_ACCOUNT_EMAILS=medhmama4@gmail.com,imane.abdenaimm2001@gmail.com
```

Keep `COUPLES_DB_USERNAME`, `COUPLES_DB_PASSWORD` and `COUPLES_TOKEN_SECRET` at their existing values. The runtime database role uses `COUPLES_DB_USERNAME`/`COUPLES_DB_PASSWORD`; Flyway uses the existing schema-owner credentials in `DB_USERNAME`/`DB_PASSWORD`. Keep the current public URL, support address, retention and CORS settings. [Configuration reference](backend/.env.production.example).

Remove all six obsolete import settings from Render:

```text
COUPLES_IMPORT_PERSONAL
COUPLES_IMPORT_SOURCE_SCHEMA
COUPLES_IMPORT_OWNER_EMAIL
COUPLES_IMPORT_RECIPIENT_EMAIL
COUPLES_IMPORT_SHARED_AUTHOR
COUPLES_IMPORT_TIME_ZONE
```

The one-time importer, generator and cutover SQL files have been removed. No upgrade SQL needs to be run again. Keep the versioned Flyway SQL files in the repository: they define the schema and are validated at startup. Future migrations and runtime table permissions are applied automatically.

The original `public` tables remain a frozen snapshot in Neon. This code cleanup does not delete or modify them. New app changes are saved only in `couples_app`.

## Normal updates

1. Make and review the changes, then commit and push.
2. Deploy the latest commit in the existing Render service, or let automatic deployment handle it if enabled.
3. Check successful startup in Render logs and open `https://ima-organizer.onrender.com`.
4. Sign in with either approved email and its existing app password, then check the changed feature.

`GET /api/identity/config` should return HTTP 200 with `{"emailEnabled":false,"registrationEnabled":false}`. `GET /api/privacy/policy` should also return HTTP 200. Protected APIs require sign-in.

No SMTP provider is required. Public registration, verification emails and email-based password recovery are disabled. Addresses remain unverified in the database; private access is approved through configuration.

## Local frontend and Android

Keep `mobile/.env`'s `VITE_API_URL` pointed at the Render backend:

```sh
cd mobile
npm run dev
```

Restart Vite after changing its environment settings. Local development uses the same hosted API and database.

For an Android update, run `npm run build`, then `npx cap sync android`, and rebuild/sign/install the APK using the existing Android project. A backend deployment does not update an installed APK. Sign-in currently stays in memory, so reloading/reopening requires login.

## Email at official launch

When ready, configure your chosen SMTP provider and verified sender on Render, set `COUPLES_EMAIL_ENABLED=true`, and validate verification and password recovery. Existing accounts will then require real email verification. Enable public registration separately when ready.
