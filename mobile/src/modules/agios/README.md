# Agios Tracker

A shared tracker for savings interest credited by the bank. Open it from Home or `/agios`.

- **My agios** belongs to the authenticated user; **Your agios** belongs to the other participant. Names appear under both labels.
- Both accounts can add, edit and delete entries for either person. Adding uses the currently selected person, whose name also appears in the form. Editing cannot move an entry between accounts.
- Every entry contains a positive amount and a credited calendar date. Dot and comma decimal inputs are accepted, with at most two decimal places. Future dates are rejected.
- History is newest first, grouped by month. All-time interest, current-year interest and credit count are calculated separately for each person.
- Entries live in the backend database and reload when the screen opens or when pulled down to refresh. Failed refreshes retain the loaded data; failed writes retain the form or confirmation for retry.
- Currency is MAD, configured by `AGIOS_CURRENCY` in `agiosUtils.ts`. This tracker uses one currency for all entries.

## API

All endpoints require authentication. `GET /api/agios` returns `participants` (public identity fields only) and `entries`. `POST /api/agios` and `PUT /api/agios/{id}` accept `{ "userId": "UUID", "amount": "125.55", "date": "2026-09-30" }`. `DELETE /api/agios/{id}` removes an entry. Amounts are stored as `BigDecimal` / `numeric(14,2)` and returned as decimal strings. The frontend sums integer cents.

The new `agios` table and its user/date index are created by the existing Hibernate schema-update configuration when the updated backend starts. Deploy the backend and rebuild the mobile app together.

## Checks

Run `npm run test:agios`, `npm run lint` and `npm run build` in `mobile`. Backend integration coverage is in `AgiosIntegrationTests` (both roles, attribution, decimal persistence, date ordering, validation, missing records and anonymous access). Use an isolated H2 database for backend tests, as described in `design-validation/agios-checks.json`.
