# Temporary memories — Cloudflare R2 setup and old-file erasure

The owner requested **erasure of existing memories, with no migration**. On the updated backend, pre-rollout categories and ungrouped memories are hidden and queued for physical deletion. New categories last exactly 72 hours from creation; adding photos does not extend that deadline.

## Configure the private bucket

1. Create a **private Cloudflare R2 bucket**. Keep public access and the `r2.dev` URL disabled. A custom public domain is not needed.
2. Create an R2 **Object Read & Write** API token scoped to this bucket. Copy its Access Key ID and Secret Access Key.
3. Fill these server-only variables in `backend/.env` and on the backend hosting platform:

```dotenv
R2_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
R2_BUCKET=your-private-bucket
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
```

Use the endpoint shown by Cloudflare for your account/jurisdiction. The backend uses the S3-compatible API, region `auto`, with chunked upload signing and optional SDK checksums disabled for R2 compatibility. The dependency is AWS SDK for Java S3 2.56.0.

No Cloudflare secrets belong in `mobile/.env` or a `VITE_*` variable. The mobile app needs only `VITE_API_URL`. Uploads are authenticated multipart requests through the backend, so browser PUT CORS rules on R2 are not required. Images/audio are read using short-lived signed GET URLs, rather than public bucket URLs.

## Erase the old Supabase files

The old Supabase project URL was copied locally from the existing mobile configuration without exposing it. Add the **server-only service_role key** from that same Supabase project:

```dotenv
LEGACY_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
LEGACY_SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
```

This access is only for deletion and verification of previous files under `media/memories/`. It is not an upload fallback or a migration mechanism. Do not put this key in the mobile app.

The cleanup worker:

- Hides pre-rollout categories immediately, including old ungrouped memories.
- Deletes the old photos and optional audio via the Supabase Storage API. It does not delete storage metadata using SQL or remove unrelated buckets/files.
- Verifies absence through the authenticated Storage object-info endpoint, avoiding public CDN cache ambiguity.
- Deletes the memory/category DB rows only after file deletion succeeds. Missing credentials, network failures and denied deletion keep hidden references for retry.

After `pendingCategories` reaches zero and old objects have been verified absent, remove the legacy Supabase service-role key and URL from the hosting environment if they are no longer needed elsewhere. Old public `VITE_SUPABASE_*` settings can be removed from the mobile environment; the SDK and all new upload calls have already been removed from the app.

## Deploy and verify

Deploy the updated backend and rebuild/install the mobile app together. The old URL-only memory-write contract is deliberately rejected; older mobile builds cannot create permanent memories through it.

The existing Hibernate `ddl-auto: update` setup adds `expires_at` / `deleted_at` to `memory_groups`, the `media_assets` table, and nullable photo/audio asset references on `memories`. Old categories have null `expires_at` and are queued for erasure on startup. There is no copy or migration to R2.

Authenticated OWNER endpoints for checking completion:

- `GET /api/memories/cleanup-status` — booleans for storage configuration and the pending-category count; it never returns credentials.
- `POST /api/memories/cleanup` — run one cleanup pass now and return the remaining count.

Both endpoints require the existing owner Bearer token. Normal cleanup runs every minute. Expired/deleted categories are excluded from both group and memory feeds even if storage is offline. R2 files are deleted using the exact `memories/{category UUID}/` prefix, including interrupted uploads. The DB references are removed only after successful deletion. Failures retry on the next pass. Abandoned/untracked uploads are swept after 24 hours, hourly. Do not add a bucket-wide 3-day lifecycle rule: an object's upload time differs from the category's creation time.

New endpoints:

```text
POST   /api/memories/groups                  name, optional description → expiresAt
POST   /api/memories/groups/{id}/media       multipart file → { id: assetId }
POST   /api/memories                         photoAssetId, optional audioAssetId/caption, memoryDate, groupId
GET    /api/memories                         active memories with temporary read URLs
GET    /api/memories/groups                  active categories only
DELETE /api/memories/groups/{id}             OWNER only, 202; hides immediately and queues deletion
```

Photo types: JPEG, PNG, WebP. Audio: WebM, MP4/M4A, AAC, Ogg, MP3, WAV, 3GPP. Uploads are limited to 25 MB per file. Signed reads last at most 15 minutes and are capped by the category deadline; the app refreshes links every 5 minutes and when returning to the foreground. Both object and response headers request private/no-store caching.

The backend must be running for physical cleanup. Visibility and signed-link expiry do not depend on the cleanup pass succeeding; actual object deletion waits for storage connectivity and permissions. The native camera/microphone and real Cloudflare account still need device/live-account verification.

## Validation and local reproduction

[Report and screenshots](../design-validation/temporary-memories/README.md).

The full backend suite uses isolated H2 databases. `StorageAdaptersTests` exercises the real AWS SDK against a loopback HTTP server: upload, HEAD verification, signed GET, expiry limits, prefix deletion, partial-delete errors, and Supabase deletion/absence verification.

For browser checks, run `python3 backend/scripts/r2-test-server.py` (loopback only, port 8091), then start the backend with an isolated H2 database and synthetic `MemoryOwner` / `MemoryPartner` users with password `local-memory-password`. Set its R2 endpoint to `http://127.0.0.1:8091`, bucket `memory-test`, and dummy `test-key` / `test-secret` credentials. Disable birthday/memory scheduler crons for deterministic tests. Start the frontend on port 5175 with `VITE_API_URL=http://127.0.0.1:8087`.

`node mobile/scripts/verify-temporary-memories.mjs` runs the real local API and SDK flows. Set `LIFE_ORGANIZER_PUPPETEER_MODULE` and `LIFE_ORGANIZER_CHROME` if Puppeteer/Chrome are not available through normal resolution. The old `verify-memory-groups.mjs` entry point delegates to this new check. The test intentionally refuses a non-local API and uses synthetic media; it must never run against the hosted database.

## Official references

- [Cloudflare R2 — AWS SDK for Java](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-java/)
- [Cloudflare R2 — presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Cloudflare R2 — lifecycle behavior](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
- [Supabase — deleting objects through Storage](https://supabase.com/docs/guides/storage/management/delete-objects)
- [Supabase — Storage REST reference](https://supabase.com/docs/reference/self-hosting-storage/get-object-info)
