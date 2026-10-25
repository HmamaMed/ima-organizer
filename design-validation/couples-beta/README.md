# Couples beta verification

Verified locally on 2026-10-25 against the packaged backend, PostgreSQL 16, captured SMTP and private S3-compatible storage. All accounts and uploaded gradient images are synthetic. The personal deployment was not migrated.

## Automated results

| Check | Result |
| --- | --- |
| `cd backend && ./mvnw test` | 99 tests passed, no failures/errors/skips; includes 36 PostgreSQL integration tests and 3 production-configuration guard tests |
| `cd mobile && npm run build` | Passed again after making the updated app the only frontend; both original build modes passed during initial verification |
| `cd mobile && npm run lint` | Passed with three existing warnings in shared/personal components |
| `cd mobile && npm run audit:runtime` | Zero runtime vulnerabilities |
| `docker build -t life-organizer-couples:local ./backend` | Passed, runtime includes FFmpeg and ffprobe |
| `python3 backend/scripts/couples-smoke.py` | Passed against the running container and real local providers; synthetic accounts/media cleaned up |
| `bash -n scripts/couples-dev.sh`, Python syntax and `git diff --check` | Passed |

The live smoke registers/verifies four users, pairs two independent couples and checks both note directions, private drafts, scheduled delivery, signed photo/audio reads, rejection of 61-second audio, cross-couple access denial, wish ownership, recipes, personal birthdays and disconnect. Account deletion is verified by waiting until every issued synthetic media URL returns object-not-found.

The PostgreSQL suite additionally covers migration refusal/upgrade paths, concurrent invitation acceptance, stale relationship writes, session replay/revocation, author-only mutations, duplicate jobs, storage quotas across re-pairing, cleanup failure/retry and deletion-marker restoration.

## Browser checks

After removing the frontend mode switch, `cd mobile && npm run dev` served the updated email/password login and registration screen at `http://localhost:5173/`. The checked page had no console errors. This startup check did not submit credentials or call the deployed backend.

Two isolated browser contexts, at 390 × 844 with touch/mobile emulation:

- Registration, captured-email verification, invitation preview and explicit pairing.
- Bob's draft remains private, then arrives in Alice's received view after sending.
- Alice sends a reply that appears in Bob's received view.
- Both create their own memory group and upload/publish a real PNG through the UI.
- Both contributions appear in the same timeline. Only the creator sees edit/delete actions on their entry; Bob cannot publish into Alice's group.
- Reload requires sign-in because couples credentials currently stay in memory.

| Artifact | Content |
| --- | --- |
| [Home](home.png) | Paired home and feature navigation |
| [Alice's received notes](notes-received.png) | Bob's delivered note |
| [Bob's received notes](notes-received-by-bob.png) | Alice's delivered reply |
| [Shared memories](memories-both-partners.png) | Bob and Alice entries in Alice's timeline, scrolled to the entries |

No JavaScript exceptions were observed in the checked flows. During the backend replacement the already-open Alice context recorded expected connection-refused/expired-session resource responses; retry and sign-in recovered. Bob's final context had no console errors.

## Limits

This validates a local beta implementation. An Android APK, real FCM delivery/App Links, persistent Keystore sign-in, hosted deployment, load testing and the later launch/billing phases were not completed. Builds retain existing Ionic CSS/chunk-size notices; full npm audit retains three moderate development-tool entries. See the [implementation guide](../../backend/COUPLES_FOUNDATION.md) for setup and remaining release gates.
