---
name: play-store-assets
description: Prepare Google Play listing screenshots, icons, feature graphics and narrated app promotional videos for Play Store, YouTube and social media. Use real app captures, a persuasive hook, animated storytelling, voiceover and music; publishing is separate.
---

# Play Store assets

Prepare a reviewable local asset pack from the app that actually exists. Read the app's README, routes, brand assets and relevant feature code. Identify the package/version, listing locale, supported device types, core benefits and available synthetic test data. Ask about missing branding or capture access only when it prevents useful work.

## Plan and capture

Check the live [Google Play asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en). Read [references/workflow.md](references/workflow.md) for tools, commands and the distinction between required assets and optional video.

Choose a short screen sequence showing the core journey. Prefer populated useful states over login screens, errors or empty pages. Use isolated synthetic accounts/content; never expose personal conversations, emails, invitation tokens, storage URLs or credentials. Match the actual app's locale, theme, permissions and released functionality. Do not invent testimonials, prices, rankings or unfinished features.

For Capacitor apps, prefer screenshots/recording from the current Android build or emulator. Browser captures are useful for reproducible WebView UI, but label them as browser captures and verify navigation, safe areas, keyboard and native-only features on Android. Never present a browser-only mock as a verified native feature.

Use Playwright when available. The bundled `scripts/capture.mjs` captures real routes and selector-based actions from a plan (see assets/capture-plan.example.json), optionally recording a WebM. It defaults to a loopback app, preserves one in-memory browser session, disables screenshot animations and waits for fonts. Existing signed-in browser tools or Android adb capture are valid alternatives. Do not persist capture credentials in the repository.

## Graphics

Use canonical brand assets and existing font licenses. Build layout/type in HTML/CSS/SVG and rasterize with browser tooling; use an available image-generation skill only when new raster artwork is useful. Generated artwork may support branding; it must not replace actual app screenshots. Preserve unmodified raw captures for traceability.

Aim for four to eight useful phone screenshots. A practical canvas is 1080×1920; fit the capture proportionally, without stretching or clipping UI. Captions should be brief and secondary. Create the feature graphic separately in the app's visual language, with important content away from crop zones. Reuse the icon's canonical source; do not silently redraw an established mark.

## Promotional video

For an app promo, social ad or YouTube-style video, read [references/promo-video.md](references/promo-video.md). Default to a short persuasive story: a relatable hook, the user's problem, the app's payoff, feature proof using the real interface and a branded ending. Use voiceover, music, sound design and synchronized animated captions when sound/promotion is requested. Match the user's language/tone; a useful default is the listing locale and a warm conversational voice.

Design motion around the story: animated type, message bubbles, purposeful UI close-ups, screen movement, edits on the beat and varied scene lengths. A sequence of static listing screenshots with music is not a finished promotional video. Do not silently substitute one when narration or a social-media treatment was requested.

Create a timed script/storyboard first, then generate or use an authorized voice, measure each spoken segment and cut visuals around it. Use original or appropriately licensed music, duck it under speech and retain credits. Preserve the real UI; clearly distinguish marketing overlays from app screens. Render actual audio/video and verify both. If a required voice/render tool is unavailable, report the limitation rather than describing an unrendered script or silent video as complete.

Separate distribution profiles: social promos can use a suitable truthful invitation/CTA; a Play Store version follows current listing-video rules and omits restricted promotional claims/CTAs. Do not claim public availability while access is private. The regular Play preview field takes a YouTube link after the owner uploads the reviewed video.

The older `scripts/make_video.py` is only a screenshot-montage helper for explicitly requested rough cuts/contact reels. It is not the default promo renderer. Use [scripts/render_promo.py](scripts/render_promo.py) with separate visual layers, measured narration, music and a scene plan for a motion promo; see the reference for the plan schema.

## Validate and hand off

Use `scripts/validate_assets.py` for phone pack dimensions, encoding, alpha rules and screenshot count. Then inspect every image visually at full size and thumbnail size; automated checks cannot prove truthful content, readability or overall policy compliance. Watch the complete video and inspect it with ffprobe. Do not call assets upload-ready while required checks remain unresolved.

Save under `artifacts/play-store/<locale>/` with `raw/`, `screenshots/`, `icon.png`, `feature-graphic.png`, optional `video/` and `manifest.json`. Include source commit/build, capture platform, locale, synthetic-data provenance, screenshot ordering, alt text, dimensions and tools/checks actually run. Add an HTML contact sheet when it helps review. Keep generated files out of Git by default; the user can choose to track a final pack.

Prepare a concise upload handoff. Google Play's regular preview video field takes a YouTube URL; local generation does not upload it. Do not sign in to Play Console/YouTube, upload, publish or change store settings unless the user requests that action. No extra approval is needed to prepare local files within the authorized workspace.
