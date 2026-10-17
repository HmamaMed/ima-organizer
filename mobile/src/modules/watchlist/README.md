# On regarde quoi ?

Home → `/watchlist` opens a French shared film/series list. Both authenticated accounts can create, edit, change status and delete titles. The screen uses the app's plum palette, shared chrome, forms, feedback and confirmation sheet. It includes title/notes search, format and status filters, and pull-to-refresh. Lists refresh on entry, foreground and every minute while visible.

## API

| Method | Endpoint | Request/behavior |
| --- | --- | --- |
| GET | `/api/watchlist` | Newest-first shared titles and both reviews |
| POST | `/api/watchlist` | `title`, `kind`, `status`, optional `notes` |
| PUT | `/api/watchlist/{id}` | Replace title fields |
| PATCH | `/api/watchlist/{id}/status` | `{ status }`, preserving notes and reviews |
| PUT | `/api/watchlist/{id}/review` | Current user's `{ rating, comment? }` |
| DELETE | `/api/watchlist/{id}/review` | Remove only the current user's review; return updated title |
| DELETE | `/api/watchlist/{id}` | Delete title and associated reviews |

Title: 1–150 characters after trimming. Kind: `FILM` or `SERIES`. Status: `TO_WATCH` (À voir), `IN_PROGRESS` (En cours), `WATCHED` (Vu). Notes/comments allow 2,000 characters. Reviews require WATCHED and an integer rating 1–5. Review identity comes from the JWT principal; clients cannot choose an author. Both users can read each other's opinions. A unique item/user constraint and item row lock prevent concurrent duplicate reviews. Status changes retain existing reviews, including when rewatching. Deleting a title removes both reviews in the same transaction.

No movie catalog, external metadata fetch, image provider, or API key is required. Data persists in the current database; the existing Hibernate update setting creates `watch_items` and `watch_reviews`. Deploy the backend and mobile build together.

[Checks, screenshots and reproduction](../../../../design-validation/shared-notebooks/README.md).
