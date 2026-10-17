# Mes envies

Home → Mes envies (`/wishes`) opens the recipient's shared wishlist. RECIPIENT authors the list; OWNER reads it to find gift ideas. Authentication and role checks are enforced by the backend, including uploads. This role choice follows the brief's focus on things she would like.

Title (150 characters) and category (`OBJECT`, `BOOK`, `EXPERIENCE`) are required. Photo, link and details are optional; details and links allow 2,000 characters. Links must use HTTP/HTTPS and contain no credentials; the server never fetches external link previews. External links open with `noopener noreferrer`.

## API

| Method | Endpoint | Access | Behavior |
| --- | --- | --- | --- |
| GET | `/api/wishes` | Both accounts | Shared list, newest first, temporary signed photo URLs |
| POST | `/api/wishes` | RECIPIENT | Create with `title`, `category`, optional `details`, `link`, `photoId` |
| PUT | `/api/wishes/{id}` | RECIPIENT | Replace fields; retain the current `photoId` to keep its photo, send null to remove |
| DELETE | `/api/wishes/{id}` | RECIPIENT | Remove wish and queue its photo for deletion |
| POST | `/api/wishes/photos` | RECIPIENT | Multipart `file`; return upload `{ id }` |

Photos accept JPEG/PNG/WebP up to 10 MiB. Uploads use authenticated backend requests and the existing private R2 bucket/credentials. `wishes/` keys are generated server-side. Signed reads last 15 minutes; the visible page refreshes every 5 minutes and on return to the foreground.

Wishes and attached photos have no automatic expiry. Upload reservations are committed before R2 writes, ensuring partial/failed uploads remain tracked. Only ready, unused, unexpired uploads belonging to the current author can be attached. Duplicate attachment is rejected. Photo replacement/removal atomically queues old uploads for deletion. The cleanup worker runs every minute (`app.wishes.cleanup-cron`), retries storage failures, and sweeps unused uploads after 24 hours. File deletion must succeed before the ledger row is removed. Memory cleanup never scans `wishes/`.

The existing Hibernate update configuration adds `wishes` and `wish_photos`. Deploy the backend before using the mobile module against the hosted API. Text-only wishes work without R2; photo upload requires it. [R2 configuration](../../../../backend/R2-SETUP.md).

[Validation and screenshots](../../../../design-validation/wishes/README.md).
