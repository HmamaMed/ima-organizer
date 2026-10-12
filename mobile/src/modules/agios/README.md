# Agios Tracker

A shared tracker for savings interest credited by the bank and money withdrawn from those earnings. Open it from Home or `/agios`.

- **My agios** belongs to the authenticated user; **Your agios** belongs to the other participant. Names appear under both labels.
- Both accounts can add, edit and delete entries for either person. Adding uses the currently selected person, whose name also appears in the form. Editing cannot move an entry between accounts.
- **Add agios** records earned interest; **Withdraw** records money taken out. Both forms accept a positive amount and a calendar date. The withdrawal form saves the amount with a negative sign, and editing preserves the entry's kind. Dot and comma decimal inputs are accepted, with at most two decimal places. Future dates and zero amounts are rejected.
- History is newest first, grouped by month, with named interest credits and withdrawals. The main figure is **Remaining agios** (earned minus withdrawn). Total earned, total withdrawn and current-year earned interest remain separate for each person. For example, three 100 credits and a 200 withdrawal leave 100, with all four entries retained.
- Delete removes a mistaken entry. It is not used to record taking money out. Balances reflect all recorded activity and can be negative if withdrawals exceed recorded interest.
- Entries live in the backend database and reload when the screen opens or when pulled down to refresh. Failed refreshes retain the loaded data; failed writes retain the form or confirmation for retry.
- Currency is MAD, configured by `AGIOS_CURRENCY` in `agiosUtils.ts`. This tracker uses one currency for all entries.

## API

All endpoints require authentication. `GET /api/agios` returns `participants` (public identity fields only) and `entries`. `POST /api/agios` and `PUT /api/agios/{id}` accept `{ "userId": "UUID", "amount": "125.55", "date": "2026-09-30" }` for interest or a negative amount such as `"-200.00"` for a withdrawal. `DELETE /api/agios/{id}` removes an entry. Amounts are stored as `BigDecimal` / `numeric(14,2)` and returned as decimal strings. The frontend sums signed integer cents.

The `agios` table already supports signed amounts, so withdrawals need no schema migration. Existing positive entries remain interest credits. Deploy the backend and rebuild the mobile app together.

## Checks

Run `npm run test:agios`, `npm run lint` and `npm run build` in `mobile`. Backend integration coverage is in `AgiosIntegrationTests` (both roles, attribution, decimal persistence, date ordering, validation, missing records and anonymous access). Use an isolated H2 database for backend tests, as described in `design-validation/agios-checks.json`.
