# Setup — Exact Commands

## Prerequisites

- Node.js 18+ and npm
- JDK 21
- Android Studio (for the emulator + building the APK)
- A Firebase account (free) — for push notifications + media storage
- A Postgres database — local via Docker, or a free hosted one (Neon.tech)

---

## 1. Frontend: React + Vite + Ionic + Capacitor

```bash
# Scaffold the React + TypeScript app
npm create vite@latest mobile -- --template react-ts
cd mobile
npm install

# Add Ionic React
npm install @ionic/react @ionic/react-router react-router-dom

# Add Capacitor
npm install @capacitor/core @capacitor/cli
npx cap init "Life Organizer" "com.lifeorganizer.app"
# (swap com.lifeorganizer.app for your own reverse-domain package id if you want)

# Add the Android platform
npm install @capacitor/android
npx cap add android

# Push notifications plugin
npm install @capacitor/push-notifications

# Camera (for attaching photos to memories, from your dashboard)
npm install @capacitor/camera

# Voice recording (community plugin, for audio notes/memories)
npm install capacitor-voice-recorder
```

After any change to native plugins or web build output:

```bash
npm run build
npx cap sync android
```

To open the native project (needed for permissions, signing, and running on a
device/emulator):

```bash
npx cap open android
```

---

## 2. Firebase Project (push notifications + media storage)

1. Go to the Firebase Console → Create a new project (e.g. "life-organizer")
2. Add an Android app inside the project, using the same package id you used in
   `npx cap init` above (e.g. `com.lifeorganizer.app`)
3. Download `google-services.json` → place it in `mobile/android/app/`
4. Enable **Cloud Messaging** (on by default for new projects)
5. Enable **Storage** → note the bucket name, you'll need it in the backend config
6. Project Settings → Service Accounts → Generate new private key → this JSON is
   what the **backend** uses to send pushes. Keep it out of git.

---

## 3. Backend: Spring Boot

```bash
curl https://start.spring.io/starter.zip \
  -d dependencies=web,data-jpa,postgresql,security,validation \
  -d name=life-organizer-backend \
  -d type=maven-project \
  -d javaVersion=21 \
  -o backend.zip

unzip backend.zip -d backend
cd backend
```

Add the Firebase Admin SDK to `pom.xml`:

```xml
<dependency>
    <groupId>com.google.firebase</groupId>
    <artifactId>firebase-admin</artifactId>
    <version>9.3.0</version>
</dependency>
```

`src/main/resources/application.yml`:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/lifeorganizer
    username: postgres
    password: postgres
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: false

firebase:
  service-account-path: ${FIREBASE_SERVICE_ACCOUNT_PATH:./firebase-service-account.json}
```

Run it:

```bash
./mvnw spring-boot:run
```

---

## 4. Local Postgres (fastest option for development)

```bash
docker run --name lifeorganizer-db \
  -e POSTGRES_DB=lifeorganizer \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:16
```

(For the deployed version later, use Neon.tech's free tier instead of managing
your own Postgres in production.)

---

## 5. Day-to-day dev loop

```bash
# Terminal 1 — backend
cd backend && ./mvnw spring-boot:run

# Terminal 2 — frontend, running in the browser for fast iteration
cd mobile && npm run dev

# When you need to test on an actual Android device/emulator:
cd mobile && npm run build && npx cap sync android && npx cap open android
```

Build in the browser as much as possible (fast refresh) — only sync to Android
when you need to test something native-specific (push, camera, audio recording).

---

## 6. Producing the final APK (week 8)

In Android Studio (opened via `npx cap open android`):
`Build → Generate Signed Bundle / APK → APK → create a new keystore → Release`

That `.apk` file is what you sideload onto her phone directly — no Play Store
needed.
