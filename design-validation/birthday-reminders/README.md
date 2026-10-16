# Birthday Reminders and Morocco time

[Screen gallery](index.html) · [Browser results](checks.json)

## Behavior

Home now includes Birthday Reminders. Both accounts can create, edit and remove their own annual birthdays. The editor asks for a label such as “Sister’s birthday”, month and day. The next birthday is highlighted, followed by the list sorted by its next occurrence. The rose/plum palette, Inter/Fraunces, existing shared controls, Ionic safe areas/modals and v1 branding are preserved. The chapter uses Ionicons' gift symbol; the asset pack has no dedicated birthday symbol. Future Calendar, Shopping and Little plans remain Soon.

The API takes ownership from the authenticated user, never a supplied account ID. Lists are private and attempts to edit/delete another account's ID return 404. Invalid calendar dates, blank/overlong labels and unknown timezones are rejected. Birthdays repeat every year; February 29 uses February 28 in non-leap years, which the form explains.

## Reminder delivery

The backend checks every five minutes. On the local day 3 days before and 1 day before a birthday, delivery starts at 19:00. New reminders use Morocco time, currently GMT. If a run is delayed or sending fails, another attempt can occur later on that same day; it never sends a stale “in 3 days” message on a later day. Every due birthday is considered, independently of the scheduled-note worker.

Example push: title `Birthday reminder`, body `“Sister’s birthday” is in 3 days.` The existing FCM service sends to that reminder owner's registered device. Payload data opens `/birthdays` when tapped while authenticated. Successful FCM acceptance is recorded by reminder, actual birthday occurrence and lead time. A row lock and a database unique constraint prevent normal repeated/overlapping scheduler runs from duplicating alerts. A crash between FCM acceptance and database commit remains a possible duplicate window; this is not an exactly-once delivery protocol.

Signed-in native launches now refresh the current account's push token. The listener is installed before registration and cleaned up when unmounted. On a shared phone, assigning a token detaches that token from the previous account. Explicit logout attempts to clear that account's token. The existing single-device-token-per-account model remains; phone permissions and Firebase credentials must be configured.

## GMT correction

Morocco returned to GMT at 01:00Z on September 20, 2026. This is reflected in the [IANA Africa/Casablanca source](https://raw.githubusercontent.com/eggert/tz/main/africa) and the ministry's [decree listing](https://bdj.mmsp.gov.ma/Fr/Document/10664-D%C3%A9cret-n-2-26-530du-9-moharrem-1448-25-juin-2026.aspx?KeyPath=594%2F596%2F608%2F714%2F10664). During verification the operating system already used GMT, while JavaScript ICU and the JDK still projected Casablanca at GMT+1. Merely selecting `Africa/Casablanca` therefore did not correct the hour.

The frontend time helper and birthday backend apply the GMT rule explicitly after that transition, with IANA regional rules retained for historical instants before it. Home's clock/date/greeting, the latest-note timestamp, note date chips, hour selection, schedule summary and note-feed dates use Morocco time. The phone's current timezone no longer changes the scheduled UTC instant. A 19:00 choice sends `19:00Z`. Existing saved note instants are preserved. The date-picker grid also now constrains its width so the date chips scroll horizontally inside the phone instead of widening the entire composer.

## Backend integration

- New package `backend/src/main/java/com/lifeorganizer/birthdays/` contains calendar/date handling, validated requests, user-scoped CRUD, entities/repositories, scheduler and delivery service.
- New tables `birthday_reminders` and `birthday_deliveries` are added by the existing Hibernate `ddl-auto: update` deployment configuration. They do not replace existing data.
- `GET/POST /api/birthdays`, `PUT/DELETE /api/birthdays/{id}` require authentication for both roles.
- `PUT /api/auth/push-token` accepts `{ "token": "..." }`; `DELETE` clears the authenticated account's token.
- `app.birthdays.cron` defaults to `0 */5 * * * *`; `-` disables the birthday worker for isolated tests.

Deploy the updated backend before using this module against the hosted API, then install the rebuilt Android app. No deployment or live database changes were performed. A backend that sleeps or remains offline across the entire reminder day cannot send that day's alert.

## Validation

- Full backend suite: 23 tests passed (9 birthday tests plus the existing 14 tests), using isolated H2 databases and disabled test Firebase. Coverage includes both roles, private list/ID access, validation, annual/leap/year-boundary behavior, the GMT correction, 19:00 threshold, 3-day/1-day content and owner attribution, retry, persistent duplicate prevention, concurrent workers, deletion and token transfer/revocation.
- `node --test scripts/morocco-time.test.mjs`: 3 tests passed. Includes four different device timezones, the GMT transition, historical Ramadan/summer formatting, midnight and calendar boundaries.
- `npm run build` and `npm run lint`: passed. Existing Ionic CSS/bundle warnings and three pre-existing lint warnings remain.
- `npx cap copy android` and `./android/gradlew -p android assembleDebug`: passed. APK: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
- `./mvnw -DskipTests package`: passed after the full test suite.
- Browser verification uses real local API persistence and synthetic `BirthdayOwner` / `BirthdayPartner` accounts, not live data. It covers add/reload, edit failure/input retention/retry, cross-account privacy, confirmed delete, narrow/tablet/200% layouts, leap-day help, the GMT Home clock and a real scheduled-note payload with a Tokyo device timezone. The results are recorded in `checks.json`.
- `git diff --check`: passed.

Native FCM delivery, notification permissions, token rotation and tap behavior were not exercised on a phone: `adb devices` showed no connected device/emulator. The scheduler's push calls are mocked in backend tests; browser tests run with Firebase disabled.

## Files

Frontend: `mobile/src/modules/birthdays/`, Home and App routes, `App.css`, Notes composer/feed, `shared/utils/moroccoTime.ts`, `shared/push/PushRegistration.tsx`, `shared/push/usePushNotifications.ts`, and `shared/auth/AuthContext.tsx`.

Backend: the new birthdays package, auth controller/service/repository and push-token request, the User token comment, and the PushService data overload. Existing three-argument push calls remain compatible.

Checks: `backend/src/test/java/com/lifeorganizer/birthdays/BirthdayIntegrationTests.java`, `mobile/scripts/morocco-time.test.mjs`, `mobile/scripts/verify-birthdays.mjs`, and this report/gallery.

Run the browser check against an isolated local API at port 8087 and a frontend at port 5175 (`VITE_API_URL=http://127.0.0.1:8087`). It requires Puppeteer and an installed Chrome, supplied through `LIFE_ORGANIZER_PUPPETEER_MODULE` and `LIFE_ORGANIZER_CHROME` if not available normally. It deliberately refuses a non-local API URL because it creates synthetic records. The check's synthetic accounts use password `local-birthday-password`; seed them only in the isolated test database.
