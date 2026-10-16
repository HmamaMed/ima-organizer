# Temporary memories and Cloudflare R2

[Gallery](index.html) · [Browser results](checks.json) · [Server setup and erasure guide](../../backend/R2-SETUP.md)

## Implemented

New memory categories last exactly 72 hours from creation. Cards show the remaining time; the timeline shows the deadline in Moroccan GMT. Creation explains that the category, photos and voice notes are deleted and that adding more content does not extend the time. The OWNER can delete a category early with a confirmation sheet. The RECIPIENT keeps read-only access. Existing timeline rotations/reveals, audio controls, warm palette, fonts and v1 brand assets are preserved.

Both category and memory API queries exclude expired/deleted data immediately. The UI removes an open category's content at its deadline, closes that category's lightbox/composer and stops audio; returning to the foreground also rechecks. Signed media links refresh every 5 minutes and last at most 15 minutes, capped at the category deadline.

Photo/audio uploads now go through an authenticated multipart endpoint on the backend to a private Cloudflare R2 bucket. The app receives tracked asset IDs, rather than sending arbitrary external URLs. Assets must belong to the same category, have the appropriate image/audio type and not already be attached. Uploads require OWNER and an active category. Supported files are capped at 25 MB. The Supabase frontend SDK and its unused dependencies were removed (8 packages total). There are no Supabase/R2 credentials or Supabase references in the new frontend bundle.

The AWS SDK upload body is prepared as a private temporary file so real, non-rewindable multipart streams can be signed and retried. Temporary files are removed in `finally`. Each upload is verified with R2 HEAD before success. An end-to-end browser run exposed the rewind requirement; the real SDK transport test now explicitly uses a non-rewindable input stream as a regression check.

The minute cleanup worker locks each category, deletes its exact R2 prefix (including interrupted or untracked writes), then deletes memory/asset/category rows. Partial storage deletion errors retain hidden DB references for retry. Upload and deletion use the same row lock so a late upload cannot recreate files after a successful purge. Hourly orphan cleanup removes unattached/untracked files older than 24 hours without deleting attached media.

## Existing memories: erase, no migration

The owner explicitly requested erasure of all existing memories. Null expiry marks categories created before this rollout. The updated backend queues those categories for deletion at startup; ungrouped old memories are moved into a hidden cleanup category so their file references can be tracked until deletion. They are excluded from the user feeds. No existing media is copied into R2.

The legacy deletion adapter only accepts files from the configured Supabase project's `media/memories/` prefix. It calls the Storage deletion API and verifies absence using the authenticated object-info endpoint, including Supabase's 400-with-404-body response. It refuses other origins/buckets and does not send credentials to them. Old DB records are removed only after deletion succeeds; missing service-role credentials leave hidden references queued for retry.

**Live erasure has not been performed.** At handoff, the R2 endpoint/bucket/access key/secret and the legacy Supabase service-role key are missing locally. The old Supabase project URL was copied into the server-only `.env` from existing configuration, and empty storage placeholders plus `.env.example` instructions were added. The backend/mobile pair must be deployed with these credentials to activate live R2 and finish old-file erasure. No hosted database or storage object was modified during implementation/testing.

## Verification performed

- Full backend `package` run: **37 tests passed**, including 15 memory tests, 5 storage-adapter tests and the existing 17 tests for app startup, Agios and Birthdays. All database tests used isolated H2, with test Firebase disabled.
- Memory tests cover exact 72-hour lifetime, role access, rejection of permanent URL-only writes, category/asset validation, unchanged deadlines after adding media, hidden expiry, early deletion, byte-cleanup failure/retry, legacy grouped/ungrouped erasure without migration, missing legacy permissions, orphan cleanup and concurrent upload/delete serialization.
- Storage-adapter tests use the real AWS SDK against a loopback server: non-rewindable upload, verified bytes/HEAD, private GET signing/expiry limits, exact category-prefix deletion, partial-delete errors and retryability. Separate real HTTP checks validate Supabase deletion/absence and refusal of untrusted URLs. No external credentials or accounts are used.
- Browser: **10 checks passed** using a real local backend, real SDK calls to `backend/scripts/r2-test-server.py`, synthetic owner/recipient accounts and synthetic media. A gallery photo and a browser-recorded synthetic audio clip produced exactly three objects; signed reads returned 200. A forced deletion failure hid the category but kept three objects and one pending category. Retrying deletion removed every object and DB record, and the old signed photo/audio URLs then returned 404.
- Browser also checks upload-failure draft retention and retry, read-only recipient access, cards at 320/390/768px, 200% text at 320px, and live removal at an accelerated UI-fixture deadline. Server expiry behavior is tested separately against real DB timestamps.
- Frontend production build and lint: passed, with existing Ionic CSS/bundle warnings and three existing lint warnings.
- Existing Agios and Morocco-time utility suite: **7 tests passed**.
- Capacitor copy and Android `assembleDebug`: passed. APK: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
- `git diff --check`: passed.

Real Cloudflare account connectivity, real old Supabase deletion and native Android camera/microphone behavior remain unverified because the new storage credentials are not configured and no device is connected. The browser recording uses Chromium's synthetic microphone.

## Changed areas

Backend: new `media` package, memory entities/requests/responses/repositories/service/controller, cleanup service/scheduler, upload error handling, S3 dependency, multipart/storage settings, backend environment example and isolated storage test helper.

Frontend: Memories category/timeline/creation/deletion UI and expiry handling, shared JSON/multipart API helper, authenticated upload helper, memory API types, package/lockfile removal of Supabase and `.env.example`.

Documentation: `backend/R2-SETUP.md`, the Memories module README, root README/architecture/setup/deployment/context references, this report/gallery and browser verification scripts. The old permanent-group fixture script now delegates to the temporary-memory verification script.
