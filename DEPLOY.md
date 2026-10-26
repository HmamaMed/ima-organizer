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

Use the **direct Neon connection URL** for `DB_URL`. In Neon → Connect, turn **Connection pooling off** and use the hostname without `-pooler`, retaining the same database, `jdbc:postgresql://` prefix and TLS parameters. The private `.render.env` now includes this direct `DB_URL`. If `COUPLES_DB_URL`, `SPRING_DATASOURCE_URL` or `SPRING_FLYWAY_URL` are set, remove stale overrides or give them the same direct URL. Keep `COUPLES_DB_SCHEMA=couples_app`.

The app already pools its connections through Hikari (at most five runtime connections). Neon's transaction pooler can lose the selected schema between queries, causing intermittent missing-table errors such as `outbox_jobs`, even though those tables exist. [Neon documents the schema limitation and direct-connection solution](https://neon.com/docs/connect/connection-pooling#connection-pooling-in-transaction-mode). Changing the connection hostname does not copy or delete data.

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

## Conversation, wishes and languages

Deploy the backend and frontend together using the normal root Docker image. Flyway automatically applies `V9__conversation_and_wish_completion.sql`; no manual SQL or additional Render variables are needed.

- Sent notes are available for seven days from their actual sending time. This also applies to existing sent notes: older messages disappear from the active app and are physically deleted in batches of 500 by the normal background scheduler (every 15 minutes). Their partner notifications and delivery/push jobs are removed too. Drafts and future scheduled notes are preserved. Independently retained database snapshots/backups are unchanged.
- Conversation reads use a stable `(sent_at,id)` cursor, return the latest 10 messages initially, and load earlier messages on request. While open and visible, the conversation checks for new messages every five seconds. It updates near the bottom or offers a new-messages button while reading earlier messages, preserving the reading position.
- Wishes keep their existing IDs, photos and ownership. `completed_at` starts empty. Each person has a separate list; both current partners may mark wishes fulfilled or undo that action, while editing/deletion remain restricted to the wish owner.
- French/English selection is stored on the device and synced to the signed-in account for future system notifications. Changing language preserves screen/form state. User-written messages, names and notebook content keep their original text.

At the owner's request, tests and builds were not run locally for these changes. Regression cases are included for cursors, retention, ownership and completion; they still need execution in CI or another suitable environment.
