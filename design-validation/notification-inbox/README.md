# Birthday notification inbox

Profile → Notifications now opens an account-private inbox. Birthday alerts are saved at the existing 3-day and 1-day thresholds from 19:00 in the reminder's timezone, independently of FCM acceptance. New birthday push taps open the inbox.

Messages show their original text and arrival timestamp in Morocco time, newest first. Individual deletion has confirmation and retry feedback. A deleted message stays hidden across reloads, worker retries, and successful push delivery. Deletion preserves the saved birthday and its future alerts; birthday edits/deletion preserve previously received message snapshots. The backend retains a dismissed occurrence marker for deduplication, separately from successful FCM receipts.

## Verification performed

- Full isolated H2 backend suite: **40 tests passed**, including 12 birthday tests. New checks cover authentication, both account roles, cross-account deletion, ordering, pre-7pm suppression, snapshot retention, deleted-message suppression, failed-push retry, and future alert delivery. Concurrent worker checks also assert a single inbox message.
- Frontend production build and lint passed. Lint retains the same three existing warnings in AuthContext, BirthdayCountdownPage, and useInView; build retains existing Ionic CSS/bundle warnings.
- Capacitor sync and Android `assembleDebug` passed.
- Five browser check groups passed using real local API requests and disposable synthetic accounts. Covered Profile navigation, Morocco 7pm timestamps with Tokyo device timezone, private recipient inbox, cancellation, a simulated failed DELETE followed by retry, persistent deletion, empty state, and preservation of birthdays and the partner's messages.
- Screenshots checked at 320px, 390px, 768px and 200% text; no horizontal overflow. [Screenshot gallery](index.html).

No hosted data was changed. Live FCM delivery and notification taps on a physical Android device were not tested. Deploy the backend and mobile build together; `birthday_notifications` is created by the existing Hibernate update configuration.

## Reproduce browser checks

Compile the backend and build a test dependency classpath (H2 is test-scoped):

```bash
cd backend
./mvnw -q test-compile dependency:build-classpath -Dmdep.includeScope=test -Dmdep.outputFile=/tmp/life-notifications-classpath
java --class-path "target/classes:$(cat /tmp/life-notifications-classpath)" scripts/NotificationInboxPreview.java
```

This fixture binds to loopback on port 8087 and uses a disposable H2 database, synthetic usernames/passwords, disabled scheduler jobs and disabled Firebase. Restart it before each run because the browser check deletes its test messages.

In separate terminals, from `mobile/`:

```bash
VITE_API_URL=http://127.0.0.1:8087 npm run dev -- --host 127.0.0.1 --port 5175
node scripts/verify-notifications.mjs
```

The browser script needs Puppeteer supplied by the environment. Set `LIFE_ORGANIZER_PUPPETEER_MODULE` to the installed Chrome DevTools bundled module if needed, and `LIFE_ORGANIZER_CHROME` to the installed Chromium executable. It refuses non-local API/app origins.
