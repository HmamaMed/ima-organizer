# Shared notebooks — implementation and validation

Status checked on October 17, 2026 after the IDE crash: both modules are implemented and connected to Home and authenticated routes. No missing functional piece was found within the original scope.

- **Nos recettes**: both accounts can create, read, edit and delete shared recipes, use À essayer/Nos favoris, and search titles, ingredients and tips. Recipes contain servings, optional duration, ordered ingredients with quantities, ordered preparation steps and tips. Ingredient transfer to a shopping list remains future work.
- **On regarde quoi ?**: both accounts can manage films/series, search and filter, and switch between À voir, En cours and Vu. Once a title is Vu, each account can add, edit and remove its own 1–5 star review/comment while reading both opinions.

Data persists in the existing database until deleted. Both modules include loading, empty and error states, retry, delete confirmation and refresh on entry/foreground. No new external API keys or storage configuration are needed. Deploy the backend and updated mobile application together; Hibernate update creates the new tables. See the [recipe API](../../mobile/src/modules/recipes/README.md) and [watchlist API](../../mobile/src/modules/watchlist/README.md).

## Verification

Recovery checks rerun successfully:

- `cd mobile && npm run build`: TypeScript and production build pass. Existing Ionic CSS and bundle-size warnings remain.
- `cd mobile && npm run lint`: passes with three existing warnings outside these modules (AuthContext, BirthdayCountdownPage and useInView).
- `cd backend && ./mvnw test`: **60 tests pass**, with no failures, errors or skips. The 12 shared-notebook integration tests cover authentication, both accounts' access, validation, separate reviews, concurrent review writes, status changes, ordered recipe collections and deletion cleanup.
- `git diff --check`: passes.

The completed browser run from before the crash is preserved in [checks.json](checks.json) and the screenshots in this directory. Its four check groups cover Home navigation, save failure/retry, shared data, filters/search, independent reviews, review removal, recipe creation/detail/editing, delete cancellation/failure/retry and persistence after reload. Layout checks cover 320px, 390px, 768px and 200% text without horizontal overflow. Representative captures: [recipe detail](recipes-detail.png), [recipe form](recipes-create.png), [both reviews](watch-two-reviews.png), [watchlist form](watch-create.png).

The previous Android build log also records successful Capacitor sync and `assembleDebug`. Browser and Android builds were not rerun during this recovery; no feature code changed. Hosted deployment and real-device behavior have not been verified. The implementation is still uncommitted in the working tree.

## Reproduce the browser checks

Start the disposable backend in one terminal:

```bash
cd backend
./mvnw -q test-compile dependency:build-classpath -Dmdep.includeScope=test -Dmdep.outputFile=/tmp/life-notebooks-classpath
java --class-path "target/classes:$(cat /tmp/life-notebooks-classpath)" scripts/SharedNotebooksPreview.java
```

This launcher uses an in-memory H2 database, synthetic accounts, disabled scheduled jobs and loopback port 8087. Restart it before each browser run to reset test data.

From `mobile/`, in separate terminals:

```bash
VITE_API_URL=http://127.0.0.1:8087 npm run dev -- --host 127.0.0.1 --port 5175
node scripts/verify-shared-notebooks.mjs
```

Supply Puppeteer and Chromium through the environment if needed: `LIFE_ORGANIZER_PUPPETEER_MODULE` accepts a module path and `LIFE_ORGANIZER_CHROME` an executable path. The browser check refuses non-local API/app origins.
