# Life Organizer — Screenshots and Visual Reference

These are browser captures of the existing React/Ionic interface using fictional sample content. No real account was accessed, no backend data was read or changed, and application source files were not modified.

- `overview.png`: a presentation board showing Home, Notes, Memory Timeline, and Gym Coach.
- `index.html`: a local gallery; switch between the overview and all 12 screens. Click a screen to open the full PNG.
- `01`–`12` PNGs: individual screens at 780 × 1688 pixels (390 × 844 CSS pixels, 2× density).

Upload `overview.png` alongside `PROJECT_CONTEXT.md` to give GPT both a written brief and a visual reference. Add individual screenshots when discussing a specific screen.

## Screens

- [Login](01-login.png) — `/login`; login.
- [Home](02-home.png) — `/home`; recipient interface.
- [Personal notes](03-notes.png) — `/notes`; recipient interface.
- [Write a note](04-compose.png) — `/notes/compose`; owner interface.
- [Memory timeline](05-memories.png) — `/memories`; recipient interface.
- [Gym Coach](06-gym.png) — `/gym`; recipient interface.
- [Workout session](07-session.png) — `/gym/day/d1`; recipient interface.
- [Progress](08-progress.png) — `/gym/progress`; recipient interface.
- [Profile](09-profile.png) — `/profile`; recipient interface.
- [Programmes](10-programmes.png) — `/gym/programmes`; owner interface.
- [Exercise library](11-exercise-library.png) — `/gym/exercises`; owner interface.
- [Programme editor](12-programme-editor.png) — `/gym/programmes/p1`; owner interface.

## Capture details

Captured October 7, 2026. Browser time was fixed to 09:41 Morocco-offset time for consistent previews. Authentication and JSON API responses were replaced in the capture browser with sample fixtures; the backend was not contacted. Sample landscape photos came from Unsplash. The screenshots show the current implementation, including its existing layout and wording, rather than a redesigned concept. Browser captures do not include the native Android status/navigation bars and are not proof of native-device behavior.

The gallery loads Fraunces and Inter from Google Fonts; individual PNGs need no network access.
