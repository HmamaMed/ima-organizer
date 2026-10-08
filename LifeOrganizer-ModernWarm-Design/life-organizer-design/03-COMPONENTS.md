# Reusable component specifications

These are design contracts. Proposed prop names express intent; inspect the existing TypeScript models and components before choosing actual types. Keep domain cards in their modules and share only genuinely common controls.

## Shared shell and controls

| Component | Proposed design inputs | Variants and behavior |
| --- | --- | --- |
| AppScreen | title, eyebrow, back action, header action, footer | One scroll region; title wraps; back/icon action has 48px hit area. Adapt existing Ionic shell. |
| HeartMark / BrandHeader | size, optional wordmark | Reuse current split-heart geometry. Logo may use the original rose/gold colors. Do not redraw brand identity from the mockup. |
| AppButton | label, leading icon, variant, busy, disabled | primary/plum, secondary/neutral, quiet/text, destructive/text. 52px minimum height. Busy preserves width and prevents duplicate submission. |
| IconButton | accessible label, icon, action, disabled | 48px area, visible focus/pressed state. Do not put clickable controls inside another clickable element. |
| FormField | label, value, error, hint, input type | Persistent label above field; 52px input minimum; error below. Password reveal is a separately named control. |
| SegmentedControl | labelled choices, selected value | equal-width or content-fit; visually selected surface; keyboard support. Use tabs only when it changes a panel, radio-group semantics for form choices. |
| FilterChip | label, selected, optional count | 40px visual height within 48px target. Wrap or horizontal scroll in a labelled region; never cut text without a scroll affordance. |
| SectionHeading | title, optional action | Action is a button/link with 48px area. Heading belongs to content, not a nested toolbar. |
| InfoRow | icon, title, description, trailing state/action | Divider only within a group; 64px minimum. A disabled future item gets explicit “Soon” text. |
| ConfirmSheet | title, explanation, confirm/cancel | Neutral cancel plus explicit destructive/committing action. Modal focus trap, Android-back closes, focus returns to launcher. |
| FeedbackState | kind, heading, detail, optional action | loading, empty, failure, success. Announce async errors politely. Do not imply success before the write completes. |
| StickyAction | primary action, optional secondary detail | Above bottom tabs, adjusts for keyboard and safe area; page can scroll to its final content. |

Input border is stronger than a decorative card line. Error message uses icon/text and --lo-danger. Spinners should not replace the whole page during background refresh. Keep saved content visible while indicating a refresh failure.

## Home

**ChapterTile** — title, description, chapter icon/accent, destination, optional badge. Two-column at normal widths; single-column when text scaling makes it cramped. 20px radius; quiet surface; readable title. Current chapters are navigable. A future chapter is visually marked “Soon” and has no misleading active CTA.

**PersonalNotePreview** — delivered content preview, delivered timestamp, destination. Rose-tinted feature with a small label, short Fraunces quote, and a clear open affordance. Limit preview to a few lines, retain full text on Notes. This is a presentation of an existing delivered note, not a new “featured note” field. Omit if no delivered note exists. Owner home uses sent/delivered content only, not a future note shown as already received.

**ActivitySummary** — authenticated user's weekly activity when that data is available. Short line plus optional link. Week grouping must use agreed local-date logic. If reliable per-user calculation is not already available, keep the existing verified summary and treat this variant as a follow-up, not a visual-only refactor.

## Notes

**NoteCard** — content, sent timestamp. Full text in normal Inter reading style, with Fraunces used only for a short leading note or quotation if the content fits. Avoid coloring all note text rose. A visual dot is decoration, never an invented unread state. Model has no read receipt.

**SchedulePicker** — selected date, selected whole hour, available slots, validation message. Use the existing 21-day window and current hourly rule. Date chips should include weekday/day/month across boundaries. Display the device's actual time-zone label; never hardcode Morocco as always UTC+1. Disabled occupied slot has a reason. Revalidate past time before submitting.

**ScheduledNoteRow** — content preview, local date/time, cancel action. Show Scheduled explicitly. Cancelling uses the existing endpoint and confirms intent. Pending push delivery is a separate backend status; do not display “Read” or “Delivered to phone.”

## Memories

**MemoryCard** — photo, memory date, optional caption, optional audio. Straight 20px photo corner; large photo; date above, caption below; 48px playback control when audio exists. Preserve photo aspect ratio using reasonable cropping in thumbnail only; show original in the lightbox. Voice and caption UI depends on the stored fields, not invented placeholders.

**AudioControl** — audio source, loading, playing, duration if known. Button gets “Play voice note” / “Pause voice note.” Duration must come from media metadata; fictional 0:24 is only a sample. Respect the existing playback behavior and stop competing audio when appropriate. No animated waveform requirement.

**MemoryLightbox** — existing full-screen presentation, accessible close, original image, optional caption/audio. Keep Android back and focus behavior. Large memory photo should not become a decorative cover hiding the actual image.

## Gym

**ProgrammeFeature** — active programme title/description, session count, entry action. Gold-tinted surface with quiet eyebrow and prominent session action. No “next recommended workout” logic is invented: render an existing day or say “Choose a session” unless reliable session selection already exists.

**WorkoutDayCard** — label, movement count, optional verified progress/last completion, open action. One large row; no nested check control. Empty day is labelled and cannot claim a completable workout.

**ExerciseRow** — full movement name, prescription, completion state, info action. Checked row gets a gold check, lighter surface, and optional Completed label; do not strike through and dim the name into unreadability. Whole completion control and details action are separate, sibling hit targets. Tapping info never changes the tick.

**SessionProgress** — checked count / total, linear visual, textual count. No invented remaining-minutes estimate; zero exercises means “No exercises yet,” not 100% complete. Track has no decorative border.

**WeekActivity** — labelled dates and completion states. Per-user input only, current week in actual local date semantics. Today marker is distinguishable from Completed. Screen reader can read each date/state. Calendar view represents activity, not an instruction to train daily.

**ProgressHeatmap** — local-date cells with a compact legend, accessible date/state alternative, and text scaling fallback. Keep the source's existing roughly 12-week scope unless deliberately changed. No fake day intensity if data only says complete/incomplete.

**ExerciseLibraryRow** — name, muscle group, optional thumbnail, overflow action. Prefer readable list to empty large media tiles. Editor/delete menu is owner-only. Referenced exercise delete failure has a clear message rather than silently disappearing.

**ProgrammeDayEditor / PrescriptionRow** — full exercise name on one line that may wrap, prescription on another, details/editor action. Do not pack sets/reps, reorder arrows, and delete across 342px. Reordering is an explicit mode or an overflow sheet with Move up/Move down/Remove; do not require drag as the only input.

**PrescriptionSheet (proposed UI)** — exercise label, sets, textual reps, optional rest seconds, optional coaching note. Keep reps text so “30 sec” and “10 per leg” work. Buttons: Cancel / Apply. Apply updates the day editor's local state; the editor's existing save pattern must be inspected before deciding when to persist. New UI needs no new server endpoint if current replace-list contract supports it.

## Component state matrix

| Family | Required states |
| --- | --- |
| Buttons/fields | default, hover where relevant, pressed, focus-visible, disabled, busy/error. |
| Reading feeds | initial loading, loaded, empty, refresh failure, long text, missing optional media. |
| Composer/editor | blank, filled, invalid, saving, write failure, saved, unsaved navigation. |
| Workout | none checked, partial, all checked/write pending, write failed, confirmed saved. |
| Sheets | open/closed, keyboard shown, large text, Android back, focus restoration. |

The component-sheet PNG illustrates selected normal/disabled/error states. This table is the complete implementation requirement; the static reference does not simulate every state.
