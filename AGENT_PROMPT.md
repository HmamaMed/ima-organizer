
I'm building "Life Organizer" — a private, modular mobile app that's a birthday
gift for one specific person, not a public product. Two users only, ever: me
(OWNER) and her (RECIPIENT). Read `README.md`, `ARCHITECTURE.md`, and `DESIGN.md` in this repo first — they
contain the full module specs, data models, API design, and the visual design
system (color palette, typography, logo assets `icon.svg` / `logo.svg`). Follow
them exactly rather than inventing your own structure or your own colors/fonts.

## Tech stack (fixed, do not substitute)

- Frontend: React + Vite + TypeScript + Ionic React (`@ionic/react`) + Capacitor
  (Android target)
- Backend: Spring Boot (Java 21), Spring Security + JWT, Spring Data JPA
- Database: PostgreSQL
- Push: Firebase Cloud Messaging via `@capacitor/push-notifications` (client) and
  firebase-admin (server)
- Media: Firebase Storage, uploaded directly from the client
- Design tokens: from `DESIGN.md` — Ionic theme variables (blush background,
  rose/gold/emerald module accents), Fraunces + Plus Jakarta Sans fonts,
  `icon.svg` / `logo.svg` for the app icon and splash screen

## Build order — please build in exactly this sequence, and stop for my review
## at the end of each numbered step rather than continuing to the next

1. **Backend foundation**: project structure per `ARCHITECTURE.md`, `User` entity
    + JWT auth (login endpoint only, no public registration — two users will be
      seeded directly via a data migration/seed script), empty module packages for
      `notes`, `memories`, `gym`.

2. **Frontend foundation**: Vite + Ionic + Capacitor scaffold, bottom tab
   navigation with placeholders for Notes / Memories / Gym / "More coming soon",
   a login screen, an auth context that stores the JWT and attaches it to API
   calls. As part of this step: apply `DESIGN.md`'s Ionic theme variables to
   `theme/variables.css`, load the Fraunces + Plus Jakarta Sans Google Fonts,
   and set up the app icon and splash screen from `icon.svg` / `logo.svg`
   (see `DESIGN.md` for the `@capacitor/assets` generation command) — get the
   whole app on-brand before building module UI on top of it.

3. **Push proof-of-concept, end to end, before building any module UI**: wire
   Firebase into both frontend and backend, get ONE test push notification
   travelling from a hardcoded backend trigger to the device. This is the
   highest-risk piece technically — prove it works before investing in module
   UI on top of it.

4. **Notes module**, full stack: entity + endpoints from `ARCHITECTURE.md`, the
   `@Scheduled` job for deferred sends, dashboard screen (OWNER role) to write/
   schedule notes, feed screen (RECIPIENT role) to read them, push firing on
   send.

5. **Memory Timeline module**, full stack: entity + endpoints, OWNER-side upload
   flow (photo via `@capacitor/camera`, optional audio via
   `capacitor-voice-recorder`, caption, date) uploading directly to Firebase
   Storage, RECIPIENT-side scrollable feed with photo + caption + audio playback.

6. **Gym Coach module**, full stack: `WorkoutDay`/`Exercise`/`WorkoutLog`
   entities + endpoints, an OWNER-side simple content entry (can be a basic
   form or even direct DB seeding to start), RECIPIENT-side "today's workout"
   view with a complete/check-off action and simple history.

7. **"Coming soon" module slot**: a visibly locked/greyed tile in the module
   navigation for future modules (starting with a shopping list), so the app
   communicates it's still growing without those modules existing yet.

## Constraints while building

- Keep modules genuinely separable — a `modules/notes`, `modules/memories`,
  `modules/gym` folder structure on the frontend, and `notes`, `memories`, `gym`
  packages on the backend, each with their own entities/controllers/services.
  No shared "god" files.
- Follow standard Spring Boot conventions (layered: controller → service →
  repository) and clean React component structure — no shortcuts that would
  make this harder to extend after launch.
- Don't add scope beyond what's specified here or in `ARCHITECTURE.md` — if
  something seems missing or ambiguous, ask me rather than assuming.
- Use only the colors and fonts defined in `DESIGN.md` — no ad hoc hex values,
  no alternate fonts, even for one-off states like errors or empty screens.
- This is a real production app for daily use by one real person — write it
  with the same care you'd use professionally, not as a throwaway prototype.