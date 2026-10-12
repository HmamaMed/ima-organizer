# Modern Warm implementation

Implemented in the existing React / TypeScript / Ionic / Capacitor app. The Life Organizer name, split heart, accounts, two bottom tabs, existing endpoints, storage provider, push flow, and configured birthday instant are preserved. Future chapters remain Soon. Memory groups add backend persistence and additive API fields/endpoints; H2 is a test-only dependency. Nothing was deployed.

## What changed

| Before | Now |
| --- | --- |
| Large serif chapter toolbars and shadows | Quiet chapter chrome, wrapping Inter screen headings, visible focus, 48px controls. |
| Similar module rows and mixed activity | Personal greeting, sent-note preview, responsive chapter tiles, authenticated-user activity. |
| Notes presented as a timeline; competing Send controls | Reading cards, one composer action, persistent labels, 4,000-character limit and count. |
| Near-term date/hour picker without month or timezone context | Same 21-day/hourly scheduling contract; month labels, device timezone, occupied-slot reasons, submit-time past-hour validation. |
| A single memory timeline | The original chronological snake, alternating rotations, scroll reveals, and photo/lightbox effects are restored inside group cards. Existing memories remain in Our story. New groups contain their own photos, captions, and voice notes. |
| Streak-first gym and cramped prescription fields | Programme-first gym, linear session progress, readable full names, optional library thumbnails, focused prescription editor. |
| Profile settings look available | Edit profile and Notifications explicitly say Soon; future chapters use proposal language. |

Inter and Fraunces are bundled locally with their font licenses. Ionic still owns scrolling, keyboard resize, safe areas, and modal lifecycle. Programme Apply changes the local draft; the existing Save session action persists it. Reordering is an explicit mode. Creating or removing another session preserves other unsaved session drafts.

## Memory groups follow-up

At the user’s request, the original snake timeline and effects have replaced the straight photo feed. The Memories landing screen shows collection cards. The owner creates a named group (for example Birthday memories), optionally adds a description, and lands in its empty timeline to add memories. Each new memory sends that group’s ID. Both accounts can browse; only the owner can create. Cards use the newest available photo as their cover, or a paper-stack illustration until a photo is added.

Existing rows keep a nullable group relationship and remain together in Our story. No existing media, dates, captions, or audio are rewritten. The all-memories endpoint remains available for Home/Profile counts and older clients. Missing group IDs in older responses are treated as original-story memories. If the group endpoint is unavailable, the original timeline can still be opened.

The configured `.env` points to the hosted backend. **Deploy the updated backend before creating groups against that server.** The existing Hibernate `ddl-auto: update` configuration adds `memory_groups` and nullable `memories.group_id` on server startup. No live database schema was changed during this work. The UI never substitutes browser-only groups for shared server data.

API additions: authenticated GET `/api/memories/groups`; owner-only POST `/api/memories/groups` with name (1–100 characters) and optional description (up to 500 characters). POST `/api/memories` accepts optional `groupId`; responses include it. Unknown groups return 404 without creating a memory. Omitting the field preserves older clients.

Verification: `cd backend && ./mvnw -Dtest=MemoryGroupsIntegrationTests test` runs six integration tests using an isolated H2 database. The full seven-test backend suite also passes with isolated H2 datasource overrides. `cd mobile && node scripts/verify-memory-groups.mjs` checks group creation, membership, error retention, gallery upload payloads with isolated storage fixtures, legacy access, both roles, 320–430px layouts, 200% text, and normal/reduced motion. See [memory-group results](memory-groups-checks.json) and the gallery. Successful physical microphone capture and live hosted services remain unverified.

## Separate frontend correctness changes

- Home, Profile, Gym, and Session now use activity explicitly attributed to the authenticated user. Partner progress excludes unattributed legacy logs and explains their exclusion.
- Session completion uses only exercises in that session. A write lock prevents concurrent checks; a failed tick rolls back. A successful tick followed by a failed completion log remains checked with an explicit retry. Success waits for the log response. A saved session is not logged again by unticking/rechecking in that same UI.
- Background refresh failures retain previously loaded feed/programme content. Role-specific authoring routes redirect recipients; backend permissions still provide the actual authorization boundary.
- Notes shown on Home and recipient feeds are explicitly SENT. Profile labels its limited note-feed count as recent notes.
- The hardware-back handler attempts to close the top Ionic modal before navigating. The existing two-press Home exit behavior remains.

These frontend fixes do not establish backend idempotency. The current log endpoint can still accept duplicates from concurrent devices, or a retry after a lost response. Programme day metadata and exercise replacement still use two separate writes; replacing prescriptions retains the current server semantics, including new day-exercise IDs. No server correctness claim is made.

## Validation

Run from mobile:

```bash
npm run dev -- --host 127.0.0.1
npm run lint
npm run build
# In another terminal, with Playwright available:
node scripts/verify-modern-warm.mjs
```

The browser script can use an existing Playwright installation through LIFE_ORGANIZER_PLAYWRIGHT (path to index.mjs); it adds no application dependency. It intercepts API requests in isolated browser contexts, so it never writes to the real backend. Evidence is in browser-checks.json, interaction-checks.json, memory-groups-checks.json, text-scaling-checks.json, and the [screenshot gallery](index.html). All names, messages, photos, and values in those screenshots are fixtures, not real account data.

- The memory follow-up reran all current route layouts (11 recipient / 15 owner routes) and text scaling, plus all interaction checks. The login-help assertion was aligned with the existing Forgot your password? button; login implementation was unchanged.
- Final composer/editor surface checks reran at all four widths after removing the native fieldset border and clipping the textarea to its rounded surface.
- Both roles across current routes at 320, 360, 390, and 430px: no audited content overflow; active native button targets at least 48px.
- 200% root text scaling (confirmed with 32px root and 56/64px headings after rendering): wrapping and scroll access; chapter tiles reflow to one column. Enlarged rendering is also checked after animation frames.
- Long notes/exercise names, empty feeds/library/programme, empty session, read/write failures, scheduled preview filtering, per-user checks, recipient route guards.
- Composer limit, 21 dates, occupied hours, future whole-hour UTC payload, failed-save content retention, and unsaved navigation.
- Prescription Apply stays local; Save carries ordered exercise IDs, textual reps, sets, optional rest, and note.
- Tick rollback; log failure/retry; no success before response; no duplicate log from untick/recheck in this UI.
- Sheet save/delete closure, referenced-exercise delete rejection, info control does not tick, lightbox, failed voice playback, refresh failure retains content, labelled login fields/password reveal/help.
- Additional browser inspection: future birthday countdown at 320px/200% text, filled scheduling state, prescription sheet, and actual 3px rose input focus.
- Theme contrast: ink on page 14.23:1; muted on page 5.33:1; white on plum 12.99:1; rose on soft rose 4.60:1; gold on soft gold 4.52:1. Control border on white 3.26:1; focus on page 5.19:1.
- Lint completes with three existing warnings in AuthContext, BirthdayCountdownPage, and useInView. TypeScript and production build pass. Ionic host-context CSS warnings and the existing large application-chunk warning remain.

## Native and live-service limits

adb devices returned no attached device or emulator. Android hardware back, status/navigation-bar safe areas, physical keyboard resize, camera/gallery selection, microphone recording/upload, haptics, and push receipt were not verified on a device. API and media failure checks use browser fixtures; no live backend/database/storage or notification-delivery validation was performed. Reduced-motion browser checks ran; successful microphone capture and real voice playback still need native validation. The configured birthday instant is unchanged and its old timezone comment is no longer presented as verified.

## Changed files

- `mobile/index.html`
- `mobile/src/App.tsx`
- `mobile/vite.config.ts`
- `mobile/src/App.css`
- `mobile/src/index.css`
- `mobile/src/modules/coming-soon/ComingSoonPage.tsx`
- `mobile/src/modules/gym/ExerciseLibraryPage.tsx`
- `mobile/src/modules/gym/GymPage.tsx`
- `mobile/src/modules/gym/ProgrammeEditorPage.tsx`
- `mobile/src/modules/gym/ProgrammesPage.tsx`
- `mobile/src/modules/gym/ProgressPage.tsx`
- `mobile/src/modules/gym/SessionPage.tsx`
- `mobile/src/modules/gym/components/ExerciseDetailSheet.tsx`
- `mobile/src/modules/gym/components/ExercisePickerSheet.tsx`
- `mobile/src/modules/gym/gym.css`
- `mobile/src/modules/home/HomePage.tsx`
- `mobile/src/modules/memories/BirthdayCountdownPage.css`
- `mobile/src/modules/memories/BirthdayCountdownPage.tsx`
- `mobile/src/modules/memories/MemoriesPage.tsx`
- `mobile/src/modules/memories/memoriesApi.ts`
- `mobile/src/modules/memories/memories.css`
- `mobile/src/modules/notes/ComposeNotePage.tsx`
- `mobile/src/modules/notes/NotesPage.tsx`
- `mobile/src/modules/profile/ProfilePage.tsx`
- `mobile/src/shared/auth/LoginPage.tsx`
- `mobile/src/shared/navigation/BackButtonHandler.tsx`
- `mobile/src/shared/ui/BrandHeader.tsx`
- `mobile/src/theme/variables.css`
- `mobile/src/shared/ui/ConfirmSheet.tsx`
- `mobile/src/shared/ui/FeedbackState.tsx`
- `mobile/src/shared/ui/AppScreen.tsx`
- `mobile/src/shared/ui/AppButton.tsx`
- `mobile/src/shared/navigation/useUnsavedChanges.tsx`
- `mobile/src/modules/gym/components/PrescriptionSheet.tsx`
- `mobile/public/fonts/`
- `mobile/scripts/verify-modern-warm.mjs`
- `mobile/scripts/verify-memory-groups.mjs`
- `backend/pom.xml` (H2, test-only)
- `backend/src/main/java/com/lifeorganizer/memories/` (group entity/repository/DTOs/endpoints, nullable group association)
- `backend/src/test/java/com/lifeorganizer/memories/MemoryGroupsIntegrationTests.java`

Screenshots and this report are under `design-validation/`. The supplied handoff and pre-existing previews remain untouched.

## Agios Tracker

The savings-interest module uses the existing warm surfaces, plum controls and a sage accent. Both authenticated accounts can see and maintain either person's entries; names clarify the viewer-relative **Your agios / My agios** sections.

Validation is recorded in [agios-checks.json](agios-checks.json). The production build, lint, three monetary/date utility tests and all twelve backend tests pass. Browser checks use a real local backend with an isolated in-memory H2 database and synthetic accounts. They cover shared persistence, account switching, add/edit/delete, correct all-time and yearly totals, date ordering, failed-write and failed-refresh recovery, duplicate-submit prevention and accessible modal closure. Content fits at 320, 390 and 768px, including 200% root text at 320px; the entry modal also fits at 200%. Native Android behavior and production deployment were not checked.

Previews: [My agios](screenshots/agios-my-interest.png), [Your agios](screenshots/agios-partner-interest.png), [Add agios](screenshots/agios-add-interest.png).
