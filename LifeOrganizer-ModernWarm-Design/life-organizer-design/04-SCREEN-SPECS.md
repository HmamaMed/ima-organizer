# Screen specifications

Screens 01–12 redesign existing destinations. Screen 13 shows the existing scheduling capability with a proposed layout. Screens 14–16 are optional future module concepts. Screen 17 is a component sheet, never an app route.

Mockups are 390 × 844 CSS px. Actual screens must grow and scroll. Static images may show only the initial portion of long feeds/editors; ui-reference.html contains a scrollable HTML/CSS sketch. The canonical mockups.html gallery displays the PNGs. Its filters work locally; app controls in the images are inert. The separate ui-reference.html sketch is unverified in a browser and is not a functional prototype.

## Current screens

| PNG / route | Role | Layout and actions |
| --- | --- | --- |
| 01-login.png / /login | Both | Small heart and wordmark; “Your little corner”; warm explanatory copy; labelled username/password fields; one Sign in CTA; quiet existing password-help action. No public registration. |
| 02-home.png / /home | Recipient reference; owner variant required | Small identity row; date + personal greeting; latest delivered-note preview; chapter tiles; conditional workout activity summary; Home/Profile tabs. Owner adds current authoring controls inside chapters. |
| 03-notes.png / /notes | Recipient reference | Back; Notes label/title; one latest-note feature; remaining delivered notes as quieter cards with timestamps. No “unread” badge or read receipts. Owner gets Sent/Scheduled sections and a Write note action. |
| 04-compose.png / /notes/compose | Owner | Cancel/back; title; labelled multiline text; character count; Send now/Schedule form choice; bottom Send note. Remove the duplicate header Send action. No drafts/audio/editing claim. |
| 05-memories.png / /memories | Recipient reference | Back; Memories title + short invitation; newest month first; full-width photo card with date, caption, optional audio; older months below. Owner has the existing add-memory entry. |
| 06-gym.png / /gym | Both | Active programme feature; ordered session cards; weekly activity; progress link. Owner also sees manage programmes/exercises actions. Keep active programme shared; do not create separate owner/recipient programmes. |
| 07-session.png / /gym/day/:dayId | Both | Session title wraps; progress bar + textual count; optional coach note; exercise rows with tick and info as sibling controls. Completion shows only after successful existing log write. |
| 08-progress.png / /gym/progress | Recipient reference | Leading weekly count; secondary streak/session count; weekly strip; 12-week activity heatmap; compact achievements list. Owner gets Hers/Mine selector, recipient does not. |
| 09-profile.png / /profile | Both | Avatar/name; quieter role label; content counts; grouped settings rows. Unimplemented Edit profile and Notifications carry “Soon.” About and Log out use current behavior. Profile tab selected. |
| 10-programmes.png / /gym/programmes | Owner | Back; title; New programme action; active card with explicit Active status; remaining cards with activation/edit controls via details/overflow. Deletion confirmation describes current fallback promotion behavior. |
| 11-exercise-library.png / /gym/exercises | Owner | Back; title; New exercise action; muscle filters; readable list with optional thumbnail and overflow. Keep image/video URL creation/edit capability available in existing editor. |
| 12-programme-editor.png / /gym/programmes/:programmeId | Owner | Wrapping programme title; session cards; full names and prescriptions; Add exercises; Add session; quiet editor guidance. Proposed row sheet replaces cramped inline controls while preserving ordered-list API. |
| 13-schedule.png / /notes/compose, Schedule state | Owner | Short note preview; next-21-days date strip; labelled whole-hour choices; selected date/time summary and actual device time zone; one Schedule note action. |

## Capability boundaries and role behavior

### Login

Use existing AuthContext/login request and 401 logout behavior. Busy and credentials-failure states are visible. The mockup username “Love” is sample content, not a seeded-account change. “Ask me for help” still triggers the existing owner-help message, not a reset API.

### Home

Reuse notes feed for the delivered note preview and existing gym endpoints only where verified. No required new home aggregation API. On slow networks, do not hold the entire Home greeting/navigation hostage to a note request. Omit an unavailable preview and offer entry into the chapter. Counts should come from current APIs or be omitted; never use sample numbers in production.

Do not introduce multiple unrelated creation buttons on recipient Home. Owner tools remain inside Notes, Memories, and Gym.

### Notes and scheduling

Backend content limit stays 4,000. No scheduledFor means immediate send. Scheduled notes are owner-only feed items. API supports cancellation only, not editing. Replace the duplicate header action with a safe Cancel/back control. Unsaved-change confirmation is proposed local UI behavior, not saved drafts.

Use current local-to-UTC conversion. The schedule chips are a display layer over the existing next-21-days rule and whole-hour selections; API accepts instants but UI should keep that rule. Revalidate the slot on the server's current contract and show any conflict error inline. Do not promise minute-precise delivery: the present scheduler is hourly and claims one due note per run. “Scheduled” confirms persistence, not push receipt.

No starred notes, favorites, categories, read state, retries, or notification tap routing are added by this design.

### Memories

Newest month first fixes the chronological inconsistency in the sample reference, in line with the brief's intended newest-first ordering. Photo/audio content uses existing URLs; no new storage system or authorization scheme is implied. If a caption and audio both exist in a stored record, display both; keep current single-mode authoring unless separately changed.

Retain the existing countdown behavior until the owner decides otherwise. The current birthday timestamp is already past in the source snapshot. Changing server authorization or dates is outside visual scope. Owner-only add affordance does not substitute for backend permissions.

### Gym and progress

UI consumes the authenticated user's ticks for session progress and own progress. The context flags that endpoints return both users and some calculations combine them: inspect the source before restyling derived values. This is a pre-existing correctness concern. If fixes are necessary, separate them from the visual change and validate before showing per-user statistics.

The mockup's “3 sessions this week” is based on fictional logs and introduces no weekly-goal model. No planned-days goal, exercise duration estimate, rest timer, weight tracking, or “recommended next workout” algorithm is added. Existing streak/badges remain available as quieter elements.

Tick updates may remain optimistic, but rollback and readable error feedback are required. Do not announce session saved while the log write is pending or failed. Existing once-per-day completion behavior needs source verification; design does not fix it through wording. An empty session never completes automatically.

### Owner programme editing

Preserve create/update/activate/delete behaviors and active-programme fallback. A non-active card can have Make active in details/overflow with explicit feedback. Move delete into an overflow/confirmation flow to avoid accidental taps next to navigation.

The proposed PrescriptionSheet uses the existing sets/reps/rest/note fields. Confirm current controller DTOs before implementing. Keep original save cadence or deliberately choose one coherent local-edit + Save model after source inspection; do not introduce a footer Save button that has no connection to persistence. The reference does not pretend to resolve this unseen behavior.

## Optional concept screens

| PNG | Proposal | Purpose and design scope |
| --- | --- | --- |
| 14-shopping.png | Shopping together | Shared categorized list; item completion/add; soft practical green accent. Future CRUD and permissions required. |
| 15-calendar.png | Our calendar | Compact selected week with agenda; personal/shared event distinction; warm blue accent. No sync or reminder delivery claim. |
| 16-little-plans.png | Little plans | Small collection of ideas to do together, with simple Idea/Planned/Done status. Future CRUD required. |
| 17-components.png | Component sheet | Buttons, chips, input error, chapter tile, exercise row, and empty-state sample. Reference only. |

Future screens intentionally have no permanent bottom tab of their own. They would launch from Home once approved and implemented. In the current redesign, Home's “More chapters” points to the existing More destination and future ideas stay explicitly marked Soon.

## Layout checks

Check 320, 360, 390, and 430px widths, plus 200% text scaling. Verify 4,000-character notes, long programme/exercise titles, many programme days, cross-month scheduling, missing images, failed audio, empty feeds, empty library, and no active programme.

Use native device/emulator checks for keyboard, Android back, safe areas, scrolling beneath sticky controls, and voice/photo flows. Browser screenshots alone cannot verify those behaviors.
