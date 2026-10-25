# Existing-app upgrade verification

Initial upgrade verified locally on 2026-10-25. Production received only read-only schema/count inspection: exactly one OWNER and one RECIPIENT, no memories missing private group/photo assets. No live rows, roles, triggers, Render settings or emails were changed by this work.

The subsequent SMTP-optional changes were resumed after an IDE crash. At the owner's request, no tests, builds or container/browser rehearsals were launched during that resumed turn. The earlier results below describe the initial email-enabled upgrade; they do not validate the latest private account behavior. The latest changes received source/configuration review and lightweight diff checks only.

## Automated checks

- Full backend suite: 108 tests passed with no failures/errors/skips. Follow-up checks added coverage for unfilled SMTP credentials and source accounts pending deletion: all four production-guard tests and all ten PostgreSQL import tests passed. The current verified total is 110 tests.
- Import tests compare source fingerprints and copied values, test old-password login and scoped reads, preserve expiry/scheduled jobs, reject ambiguous accounts/nonempty targets, roll back invalid media imports, verify exact media provenance on deletion, test runtime grants, and prevent both late source writes and repeated import after account erasure.
- Root Docker image built successfully, including the normal frontend production build and FFmpeg.
- Prepared private settings/SQL use matching generated credentials, permissions `0600`, Git/Docker exclusions, and both supplied account emails. No credentials are in these artifacts.
- Python generator syntax and `git diff --check` passed.

## Packaged production rehearsal

An isolated PostgreSQL container contained synthetic original accounts, a BCrypt password, a sent note and a wish. The generated cutover SQL and root image ran with **both production profiles**, a separate runtime role, a new `couples_app` schema and fake offline provider configuration. Background jobs were disabled so no provider message could be sent.

The rehearsal checked:

- Production startup and schema validation after migration/import.
- Public policy, login validation, root web page, `/verify`, `/reset`, `/join`, `/delete-account`, `/privacy`, bundled assets, fonts and favicon routes.
- Existing-password login through `/api/identity/login`, then authenticated account/couple/note/wish reads.
- Anonymous protected reads still return 401.
- Verification challenge consumption using an offline synthetic token; provider email delivery was not exercised.
- Restart with the import flag still enabled: one import ledger, no duplicate accounts, and changed account settings retained.
- Original source rows remain unchanged.

## Browser

Chrome opened the packaged image at a 390×844 mobile viewport. Login with the imported account's existing password reached the paired home. `/api/identity/login`, `/api/identity/me` and `/api/couples/current` returned 200 from the same hosted origin. No console errors were reported.

[Paired home screenshot](home.png) contains synthetic accounts only. Resizing/reloading requires login again because credentials remain in memory.

## External configuration still required

The deployment owner must back up the database, execute the prepared cutover SQL and apply/deploy the Render settings in [DEPLOY.md](../../DEPLOY.md). The current private setup requires no SMTP credentials or email provider: only the two approved existing accounts can sign in, with email actions and public registration disabled. Production cutover and Android APK installation were not performed.
