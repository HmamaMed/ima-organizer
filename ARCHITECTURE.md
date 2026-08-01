# Architecture

## Users & Auth

Only two accounts will ever exist. Seed them directly in the database — no public
registration flow needed.

```
User
- id: UUID
- role: enum [OWNER, RECIPIENT]
- name: string
- passwordHash: string
- fcmToken: string (nullable)   -- her device's push token, set on login
```

Spring Security + JWT, same pattern you already use. OWNER sees the dashboard
(send/schedule notes, upload memories, edit gym plan). RECIPIENT sees the
consumer app (feed, memory timeline, today's workout). Same codebase, role-gated
routes/screens — not two separate apps.

## Module 1 — Notes

```
Note
- id: UUID
- content: text
- audioUrl: string (nullable)      -- optional, for future voice-note support
- status: enum [DRAFT, SCHEDULED, SENT]
- scheduledFor: timestamp (nullable)
- sentAt: timestamp (nullable)
- createdAt: timestamp
```

**API:**
- `POST /api/notes` — create (immediate send if no `scheduledFor`, else SCHEDULED)
- `GET /api/notes` — feed, paginated, newest first
- `PATCH /api/notes/{id}` — edit before it's sent
- `DELETE /api/notes/{id}` — cancel a scheduled note

**Scheduling:** a `@Scheduled` job polling every 60s for `SCHEDULED` notes where
`scheduledFor <= now()`, flips them to `SENT`, triggers the push. This is a standard
Spring Boot pattern — nothing new to learn here.

## Module 2 — Memory Timeline

```
Memory
- id: UUID
- photoUrl: string                 -- Firebase Storage URL
- caption: text (nullable)
- audioUrl: string (nullable)      -- Firebase Storage URL
- memoryDate: date                 -- date the memory happened (for ordering)
- createdAt: timestamp
```

**API:**
- `POST /api/memories` — multipart upload (photo required, audio optional) + caption + date
- `GET /api/memories` — feed ordered by `memoryDate`

**Media handling:** upload photo/audio directly from the mobile app to Firebase
Storage (client SDK), then send just the resulting URL + metadata to the Spring Boot
API. Keeps the backend lean — it never touches raw file bytes.

**Audio recording on-device:** Capacitor doesn't have an official first-party
recording plugin. Use the community plugin `capacitor-voice-recorder`, or the
browser `MediaRecorder` API directly (works fine inside Capacitor's WebView). Either
way, add `RECORD_AUDIO` permission in `android/app/src/main/AndroidManifest.xml`.

**Photo capture/pick:** `@capacitor/camera` (official plugin) — lets her... actually,
this side is upload-only from your dashboard for launch (you curate the memories),
so this plugin is used on *your* side to attach photos when creating entries.

## Module 3 — Gym Coach

```
WorkoutDay
- id: UUID
- dayLabel: string          -- e.g. "Day 1 — Legs & Core"
- notes: text (nullable)    -- general guidance for the day

Exercise
- id: UUID
- workoutDayId: UUID (FK)
- name: string
- sets: int
- reps: string               -- string, not int: supports "12" or "30 sec" or "AMRAP"
- instructions: text
- videoUrl: string (nullable)

WorkoutLog
- id: UUID
- workoutDayId: UUID (FK)
- completedAt: timestamp
```

**API:**
- `GET /api/gym/plan` — full plan, all days + exercises
- `POST /api/gym/log` — mark a day complete
- `GET /api/gym/log` — completion history (simple streak/consistency view)

This module is pure content + a checklist — no push dependency, no media handling.
It's the safest one to simplify if the timeline gets tight.

## Push Notification Flow

```
Dashboard (you) → POST /api/notes (or memory created)
     → Backend saves to Postgres
     → Backend calls Firebase Admin SDK → sends to her fcmToken
     → Her device (Capacitor app, even if closed/backgrounded) receives push
     → @capacitor/push-notifications plugin surfaces the OS notification
     → Tapping it opens the app to the relevant feed
```

Backend needs the Firebase **service account JSON** (from Firebase Console →
Project Settings → Service Accounts) to call the Admin SDK — keep this out of
git, load via environment variable or `application-local.yml` (gitignored).

**Known caveat, not Capacitor-specific:** aggressive Android battery optimizers
(Xiaomi/Huawei/some Samsung modes) can delay background notifications on *any*
app, native included. Mitigation: prompt her once, on first login, to disable
battery optimization for the app.

## Deployment target (so pushes actually reach her phone)

The backend needs a public URL for the mobile app to call and for the scheduler to
run continuously. Recommended, in order of simplicity:

1. **Railway** — simplest Spring Boot + Postgres deploy, generous free trial credit
2. **Render (web service) + Neon (Postgres free tier)** — both have no-cost tiers
   that don't require a credit card to start

Either works fine at this scale (2 users, low traffic). Don't over-think this
choice — pick one in week 1 and move on.
