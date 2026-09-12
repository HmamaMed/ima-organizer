# Deploying the backend (Render + Neon, free)

Fly.io no longer has a usable free tier (2-hour/7-day trial, then card + billing).
This uses Render (web service) + Neon (Postgres), both free with no card required.
Cold start after 15 min idle is fine for a 2-user app.

`backend/Dockerfile` and `backend/.dockerignore` are already in the repo — Render
builds straight from them.

## 1. Neon — free Postgres

1. Go to neon.tech → sign up → **Create a project** (name it `lifeorganizer`).
2. Copy the connection string from the dashboard, e.g.:
   `postgresql://user:password@ep-xxx.region.aws.neon.tech/lifeorganizer?sslmode=require`
3. Convert to JDBC form for later:
   `jdbc:postgresql://ep-xxx.region.aws.neon.tech/lifeorganizer?sslmode=require`
   Keep the username and password from the connection string separately.

## 2. Push the repo to GitHub

Render deploys from GitHub. `origin` is already `github.com/HmamaMed/ima-organizer.git`.
Commit and push whatever you want deployed — Render builds whatever's on the
branch you point it at.

## 3. Render — the web service

1. render.com → sign up (no card) → **New +** → **Web Service**.
2. Connect GitHub, pick the `ima-organizer` repo.
3. Settings:
   - **Root Directory**: `backend`
   - **Runtime**: Docker (auto-detects `backend/Dockerfile`)
   - **Instance Type**: Free
4. Environment variables:

   | Key | Value |
   |---|---|
   | `DB_URL` | `jdbc:postgresql://ep-xxx....neon.tech/lifeorganizer?sslmode=require` |
   | `DB_USERNAME` | your Neon username |
   | `DB_PASSWORD` | your Neon password |
   | `JWT_SECRET` | output of `openssl rand -base64 48` |
   | `JWT_EXPIRATION_MS` | `604800000` (optional, this is the default) |
   | `SEED_OWNER_USERNAME` / `SEED_OWNER_PASSWORD` | real credentials, not the repo defaults |
   | `SEED_RECIPIENT_USERNAME` / `SEED_RECIPIENT_PASSWORD` | same |
   | `CORS_ALLOWED_ORIGINS` | `https://localhost` (Capacitor's WebView origin); add `http://localhost:5173` too if also testing from a browser |

5. Firebase push notifications are optional at boot — the app logs a warning and
   keeps running if the service-account file is missing (`FirebaseConfig.java`).
   Add it later via Render's **Secret Files** (mount the JSON, point
   `FIREBASE_SERVICE_ACCOUNT_PATH` at the mounted path).
6. **Create Web Service** and wait for the first build (Maven build inside the
   container takes a few minutes).

## 4. Verify

Render gives a URL like `https://ima-organizer.onrender.com`.

```bash
curl -X POST https://ima-organizer.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"<seed owner username>","password":"<seed owner password>"}'
```

Should return a JWT.

## 5. Point the mobile app at it

`mobile/src/shared/api/client.ts` reads `VITE_API_URL`, defaulting to
`localhost:8080`. Build for Capacitor with the Render URL:

```bash
VITE_API_URL=https://ima-organizer.onrender.com npm run build
npx cap sync android
```

Then continue with the normal Android Studio signed-APK steps from `SETUP.md`.
