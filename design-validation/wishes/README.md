# Mes envies — implementation and validation

Home now includes **Mes envies**, a French gift-idea notebook using the app's rose/plum palette, Fraunces/Inter fonts, shared header, controls and bottom tabs. The recipient manages the shared list; the owner reads it. This follows the brief's focus on things she would like.

Title and category are required. Photo, HTTP/HTTPS link and details are optional. Categories cover objects, books and experiences. The UI includes category filters, photo preview/removal, edit and delete confirmation, loading/empty/error states and pull-to-refresh. Text is rendered as text; external links use `noopener noreferrer` and are never fetched by the backend.

Wishes remain until removed. Their private R2 photos use `wishes/` and do not inherit the memory categories' 72-hour lifetime. A committed upload ledger tracks writes before they reach R2. Photo replacement/removal queues deletion; unused/failed uploads are swept after 24 hours. A minute worker retries storage failures and retains references until deletion succeeds. Current photos remain attached indefinitely. [API and storage details](../../mobile/src/modules/wishes/README.md).

## Checks actually performed

- **48 backend tests passed**, using isolated H2 databases. Eight new wishlist tests cover shared reads, recipient-only writes/uploads, validation, private photo URLs, persistent attachments, upload ownership/reuse/expiry checks, photo replacement/removal, cleanup retry, and failed uploads remaining tracked.
- **Five browser check groups passed** against a disposable local backend and the real AWS SDK talking to the loopback S3 stand-in. Verified Home navigation, French empty state, actual image upload/display, signed vs unsigned reads, failed-save retry without duplicate upload, editing while retaining a photo, category filters, owner read-only view and forbidden API writes, safe links, delete cancellation/failure/retry, persistence after reload, and eventual file erasure after a storage failure.
- Checked 320px, 390px, 768px and 200% text layouts for horizontal overflow. [Screenshot gallery](index.html).
- Frontend production build and lint passed. Existing warnings remain: AuthContext/BirthdayCountdownPage fast-refresh exports and useInView dependencies; existing build CSS/bundle warnings also remain.
- Capacitor sync and Android `assembleDebug` passed.

No hosted data was changed. Real Cloudflare credentials and an Android device were not used. Configure the existing R2 variables, deploy the updated backend, and install the updated mobile build for live use. Hibernate update creates `wishes` and `wish_photos`.

## Reproduce the browser checks

Start the loopback S3 fixture:

```bash
python3 backend/scripts/r2-test-server.py
```

In another terminal:

```bash
cd backend
./mvnw -q test-compile dependency:build-classpath -Dmdep.includeScope=test -Dmdep.outputFile=/tmp/life-wishes-classpath
java --class-path "target/classes:$(cat /tmp/life-wishes-classpath)" scripts/WishesPreview.java
```

The preview launcher uses a disposable H2 database and synthetic accounts, binds to loopback on port 8087, disables Firebase/birthday/memory jobs, and uses only the fake R2 server and dummy credentials. Its wishlist cleanup runs every second for these checks. Restart both fixtures for each run.

From `mobile/`, in separate terminals:

```bash
VITE_API_URL=http://127.0.0.1:8087 npm run dev -- --host 127.0.0.1 --port 5175
node scripts/verify-wishes.mjs
```

Puppeteer/Chromium must be supplied by the environment; `LIFE_ORGANIZER_PUPPETEER_MODULE` and `LIFE_ORGANIZER_CHROME` can point to the installed Chrome DevTools bundle/runtime. The test refuses hosted API/app origins. Its book-cover image is synthetic and created only as a test fixture.
