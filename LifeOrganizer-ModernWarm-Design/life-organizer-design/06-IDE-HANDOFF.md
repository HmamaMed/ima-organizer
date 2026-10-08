# IDE agent implementation brief

Paste the following brief into your IDE agent and attach this entire handoff folder. It authorizes a frontend design implementation of the current app. Future modules remain proposals.

---

You are implementing a design refresh for Life Organizer, a private Android gift for the owner's partner. Read PROJECT_CONTEXT.md, then this handoff's README, 01–05 Markdown documents, tokens.css, mockups.html, ui-reference.html, and screens/. Inspect current repository source and applicable AGENTS.md before changing code.

## Goal

Implement the Modern Warm direction: calmer hierarchy, readable Inter UI, selective Fraunces personal moments, warm surfaces, chapter accents, reusable controls, generous spacing, and less visual clutter. Preserve Life Organizer's name and existing split-heart identity. This is a proposed redesign, not a screenshot of working new behavior.

Keep React 19 / TypeScript / Ionic / Capacitor and the existing Spring Boot architecture unless current source shows a newer setup. Do not install an additional design framework or replace routing, authentication, storage, or the native shell.

## Scope

Restyle current routes: login; Home; Notes feed + composer/scheduling; Memories timeline and existing creation/lightbox/countdown; Gym hub/session/progress/library/programmes/programme editor; Profile; existing More screen. Screens not drawn in this package must inherit the component system and preserve their existing behavior.

Keep Home/Profile as the only permanent bottom tabs. Preserve current role-specific authoring tools and server permission boundaries. Do not remove owner capabilities just because a reference shows the recipient variant.

Do not build Shopping together, Our calendar, Little plans, or other proposed modules. Keep suggestions marked Soon in the existing More experience. No backend schema or API additions are part of the visual refresh.

## First inspect

- Existing shared UI, App.tsx routing, Android back handling, AuthContext, module API wrappers, index.css/theme variables/App.css.
- Actual programme editor save cadence and day-exercise payloads before changing edit presentation.
- Current user filtering and completion logic before displaying person-specific gym metrics. The brief explicitly flags possible mixed-user calculations and duplicate completion concerns. Report/separate any correctness fix instead of presenting a visual change as proof it is solved.
- Existing font assets, icon system, and styles. Use Inter/Fraunces in the app; the HTML reference uses offline fallback fonts.

## Component approach

Extend HeartMark/BrandHeader where possible. Introduce AppScreen, AppButton, IconButton, FormField, SegmentedControl, FilterChip, InfoRow, FeedbackState, and ConfirmSheet only where duplication warrants them. Keep NoteCard/SchedulePicker in Notes, MemoryCard/AudioControl in Memories, and ExerciseRow/ProgrammeDayEditor in Gym. Follow 03-COMPONENTS.md.

Use semantic native/Ionic controls, visible focus, persistent field labels, and minimum 48px hit areas. Do not paste the reference's fixed phone shell or its gallery controls into the application. Ionic owns scroll, safe areas, keyboard, and modal lifecycle.

## Visual priorities

1. Merge tokens and typography without breaking existing Ionic styles.
2. Implement shared chrome and buttons/inputs/rows/states.
3. Implement login + Home + reading experiences so the brand direction is visible.
4. Implement the text composer and existing hourly schedule controls with one main submit action.
5. Implement Gym sessions/progress and owner library/programme editing. Full exercise names must remain readable; proposed prescription sheets use current contracts.
6. Bring Profile, existing memory authoring/lightbox/countdown, and More into the same system.

Use the mockups for hierarchy and component appearance; specifications and verified current behavior take priority over fictional screenshot values. Adapt to real content rather than copying sample names, counts, timestamps, photos, or messages.

## Preserve contracts

- Notes: 4,000-character limit; Send now vs future scheduledFor; next-21-days hourly UI; owner cancellation only; no invented note drafts/edit/audio/read state.
- Memories: JSON metadata after existing media upload; optional stored caption/audio; current owner composer mode; current birthday gate until separately approved.
- Gym: shared active programme; reusable exercises; textual reps; optional rest/note/media; authenticated-user ticks/logs; current activation/deletion semantics.
- Profile: Edit profile/Notifications are visibly Soon until real persistence exists; password help uses current personal instruction.
- Push and media behavior remain the current implementation. Do not claim a successful save means a push reached the phone.

## Data and feedback

Reuse verified APIs. Latest-note Home feature can use existing delivered-note feed; omit it gracefully when no delivered note exists. For the owner, do not treat a scheduled note as received content. Display real counts or omit them.

Each reading view needs loading/empty/failure states. Writes need busy/error/success states. Keep content visible on refresh failure. Workout success waits for a successful log write; optimistic ticks rollback on failure. New local interactions must not falsely persist. Any new unsaved-change confirmation or prescription modal remains frontend behavior using existing contracts.

## Validation and completion

Run repository-required lint/typecheck/build checks. Use existing meaningful tests when appropriate; do not add tests that merely duplicate CSS values. Verify roles, all routes, real long content, notes limit and scheduling boundaries, empty programme, missing media, and failed requests.

Visually inspect 320/360/390/430px and 200% text scaling. Check contrasts and 48px targets. Validate Android back, keyboard, safe areas, sticky action/footer, photo/voice flows, and reduced motion on emulator/device if available. Report any native checks that were not run.

Provide changed files, a concise before/after summary, screenshots of implemented screens, checks run, and any remaining limitations. Do not claim backend or device validation from browser-only mockups. Do not deploy or publish as part of this design task unless the owner separately asks.

---

## Acceptance checklist

- [ ] Existing account/role and navigation behavior is preserved.
- [ ] Shared tokens/components replace repetitive styling without creating a parallel UI framework.
- [ ] Name/heart/Inter/Fraunces/chapter identities remain recognizable.
- [ ] Every primary action is obvious; no competing composer submit actions.
- [ ] Long programme/exercise/note content wraps and remains readable.
- [ ] Current owner tools still exist; recipient screens have no authoring controls.
- [ ] Future modules stay proposals/Soon; no fake completed feature.
- [ ] Scheduled notes are not exposed as delivered content.
- [ ] Gym values use verified per-person data; unresolved correctness issues are explicit.
- [ ] Errors, empty states, pending writes, and success feedback are honest.
- [ ] Focus, contrast, 48px targets, scaling, reduced motion, safe areas, and keyboard behavior are checked.
- [ ] Lint/build and relevant current tests pass; actual validation limits are reported.
