# Upgrade the existing Render app while preserving data

The normal workflow stays **edit → validate → push**. The frontend commands stay `npm run dev` and `npm run build`.

The upgrade copies the existing `public` schema's current app tables into `couples_app` in the **same database**. It keeps account IDs/password hashes, notes and scheduled delivery, wishes/photos, films/reviews, recipes/ingredients/steps, birthdays/inbox and existing gym/Agios records. Original rows remain in `public`. Older unused tables also remain there. Temporary memories keep their existing expiry; importing does not restart their lifetime. Media uses the existing private R2 bucket and object keys.

Only a source with exactly one OWNER and one RECIPIENT is supported. The two supplied emails are assigned to those existing accounts, with their existing passwords. They remain paired. During the private phase those approved accounts can sign in without email verification; their addresses remain unverified in the database. Public registration and email-based recovery stay off. Old device tokens/sessions are not reused; sign in and enable notifications again.

## 1. Prepared private files

At the repository root:

- `.render-upgrade.env`: the actual email mapping, a new random runtime database password, a new action-token secret and Render settings.
- `.render-upgrade.sql`: creates the matching database role and freezes writes to the old tables.

These files have permissions `0600` and are ignored by Git and Docker. Do not commit/share them or regenerate only one of them: their passwords must match. They do not change the live database until you execute the SQL.

For another installation, generate a matching pair with:

```sh
python3 scripts/prepare-render-upgrade.py \
  --owner-email YOUR_EMAIL \
  --recipient-email PARTNER_EMAIL \
  --public-url https://YOUR_SERVICE.onrender.com
```

## 2. Private access without SMTP

No email-provider account or SMTP credentials are needed now. The prepared file contains `COUPLES_EMAIL_ENABLED=false`, `COUPLES_REGISTRATION_ENABLED=false`, and `COUPLES_PRIVATE_ACCOUNT_EMAILS` listing the two supplied addresses.

Only approved existing accounts can sign in or reuse sessions. Email actions are rejected server-side and any old queued account emails are skipped. The UI hides registration and password recovery and allows the approved accounts through without a verification email. Account passwords, sessions, couple isolation and data ownership still apply.

At official launch, configure your chosen SMTP provider and sender, set `COUPLES_EMAIL_ENABLED=true`, and validate the email flows. Real verification then applies to the existing accounts too. Enable public registration separately when ready. Password recovery is unavailable until email delivery is enabled.

## 3. Prepare Render without deploying yet

Disable automatic deployment while preparing the cutover, then push the reviewed commit so the root Dockerfile is available without deploying it yet. Back up the existing PostgreSQL database and retain the current image/settings. Rehearse on an isolated database copy with a separate media bucket before the live cutover; starting a copied app against the live R2 bucket can run normal expiry/deletion jobs on real files.

In the **existing** Render web service:

1. Prepare these Docker settings, but apply them during step 4 below because saving them can trigger deployment: clear `backend` from **Root Directory**, set **Dockerfile Path** to `./Dockerfile` and **Docker Build Context Directory** to `.`. The root image includes both backend and built frontend. Keep the existing service/domain.
2. Under **Environment → Add from .env**, import `.render-upgrade.env`, then choose **Save only** while preparing the release.
3. **Keep the existing** `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `FIREBASE_SERVICE_ACCOUNT_PATH`. The updated configuration reuses them. `DB_USERNAME`/`DB_PASSWORD` remain the schema-owner/migration credentials; the generated `COUPLES_DB_*` username/password are the separate runtime role. If old `COUPLES_DB_URL`, `COUPLES_MIGRATION_*`, `COUPLES_JWT_SECRET`, `COUPLES_R2_*` or `COUPLES_FIREBASE_SERVICE_ACCOUNT_PATH` overrides exist, remove stale/local values so they cannot override the retained production settings.
4. Ensure the existing Firebase secret file is still uploaded and `FIREBASE_SERVICE_ACCOUNT_PATH` points to it (normally `/etc/secrets/firebase-service-account.json`).
5. The updated app listens on Render's `PORT` and serves the web UI at the existing service URL. After successful startup, use `/api/privacy/policy` as the health check path; the old backend returns 401 for that route, so do not use it to judge the old deployment.

Render details: [environment import/save options](https://render.com/docs/configure-environment-variables), [root-relative Docker settings](https://render.com/docs/monorepo-support), [runtime secret file paths](https://render.com/docs/docker-secrets).

## 4. Cut over

Have both people stop using the old app during this short maintenance window.

1. In your existing PostgreSQL provider's SQL console, connected to the **existing app database as its owner**, execute the entire `.render-upgrade.sql` file once. It creates `lifeorganizer_runtime` and installs write fences on the old app tables. It does not delete/update their rows. The old app may report read-only errors during this window, including from old scheduled jobs.
2. Apply the prepared repository-root/Docker settings, then deploy the latest reviewed commit on Render using the saved environment settings. If saving the Docker settings starts the deploy automatically, monitor that deploy.
3. In Render logs, look for `Personal import verified into schema couples_app`, followed by successful application startup. The importer compares source and copied row counts/content, preserves original IDs, and commits the import as one transaction. A validation failure rolls back imported rows and prevents startup. The original data stays frozen/intact for investigation or rollback. Never enable Flyway baseline/clean to bypass an error.
4. Open `https://YOUR_SERVICE.onrender.com/api/privacy/policy`: it must return JSON with HTTP 200. Open the service root: it must show the app. An empty login submission now returns validation HTTP 400 rather than security HTTP 401; protected APIs still require a real session.
5. Run `cd mobile && npm run dev` locally as usual. Keep `mobile/.env`'s existing `VITE_API_URL` pointed at the Render service. Restart Vite after any local environment change.
6. Each person signs in with their mapped email and **existing app password**. No verification email is required in this private configuration. Confirm the existing space/content. Do not register replacement accounts.
7. After validation, set `COUPLES_IMPORT_PERSONAL=false` on Render and redeploy. Keep `COUPLES_DB_SCHEMA=couples_app` and `COUPLES_PRIVATE_ACCOUNT_EMAILS` configured. The import ledger also prevents a repeated import if the flag is accidentally left enabled, including after account deletion.

For Android, run `npm run build`, `npx cap sync android`, then rebuild/sign/install the APK through the existing Android project. A backend deploy alone does not update an installed APK. Credentials currently stay in memory, so reopening/reloading still requires sign-in.

## Attribution, limits and rollback

The old system tracked notes/memories as OWNER contributions and wishes as RECIPIENT contributions. Films/recipes had no complete historical author record. The prepared settings explicitly attribute unclassified films/recipes to OWNER (`COUPLES_IMPORT_SHARED_AUTHOR=OWNER`); set RECIPIENT before the first import if that attribution is more accurate. Both partners can still use these shared notebooks. Author values that were actually recorded for films are retained.

Gym/Agios records are retained, but the updated couples UI/API does not yet expose those legacy modules. URL-only pre-R2 memories without private asset/group references cause a safe import failure rather than being silently discarded. Existing private R2 memories are supported, including old object keys and their normal cleanup.

If deployment fails before you use the updated app, restore the previous Render image/settings and run [unfreeze-personal.sql](scripts/unfreeze-personal.sql) in the same database to remove the old-table fences. Leave `couples_app` intact while investigating. Once anyone has made changes in the updated app, rollback requires reconciling those new writes first; the original schema is a snapshot and will not contain them automatically.

Treat the frozen source schema as a backup, outside the active runtime app. Set an explicit retention/retirement date and include it in backup/deletion handling; deleting an account in the updated app cannot erase independently retained backups. Do not expose the frozen schema through the old application after cutover. The existing deletion-marker/restore procedure still applies.
