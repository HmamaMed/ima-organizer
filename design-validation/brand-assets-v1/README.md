# Life Organizer asset v1 integration

Integrated from `LifeOrganizer-Assets-v1/life-organizer-assets/` using the root `INTEGRATION-IDE.md`. The supplied pack and handoff were preserved.

[Open screenshot gallery](index.html) · [Changed files](changed-files.txt)

## Integrated usages

- Shared `HeartMark` now displays the canonical two-page SVG with decorative accessibility semantics and clear space. Its existing uses in the password-help modal and birthday screen inherit the update.
- New shared `BrandLogo` displays outlined SVG lettering: stacked color on Login, horizontal color on Home, stacked white on the plum React splash. Each full logo has one `Life Organizer` alternative name. Inter/Fraunces remain the functional text fonts.
- Home uses the provided Notes, Memories and Gym artwork. Agios and command icons retain Ionicons. Chapter navigation, touch targets, future chapters and roles are preserved. `BrandHeader` already displays chapter navigation icons rather than the old brand symbol, so it needed no change.
- Notes and Memories illustrations accompany their existing successful empty responses. Gym artwork appears only when no programme exists. Copy remains HTML; owner creation actions remain available. Error and loading states retain their own feedback.
- Root `icon.svg`/`logo.svg`, mobile asset aliases and web favicon now use the pack. The wordmark font license is included alongside the SVGs.

## Native route B

Merged the supplied `lo_` Android resources into the existing resource tree. Manifest launcher references use `lo_launcher` and `lo_launcher_round`, including v26 adaptive and v33 monochrome variants. The supplied notification VectorDrawable serves every density; optional PNG notification fallbacks are omitted because minSdk is 24.

The existing AndroidX `Theme.SplashScreen` now references the supplied white symbol and dark plum background explicitly, matching the React launch screen. `MainActivity` installs the existing AndroidX splash library before Capacitor's activity startup; the theme specifies `AppTheme.NoActionBar` after splash. No icon background or additional launch delay was added. The existing React duration remains 900ms.

The theme attributes and installation order follow [Android's splash migration documentation](https://developer.android.com/develop/ui/views/launch/splash-screen/migrate). Default notification icon/color metadata follows [Firebase's receive-message documentation](https://firebase.google.com/docs/cloud-messaging/android/receive-messages). The existing backend sends notification title/body without overriding icon/color; both background FCM and Capacitor's foreground notification builder can use these defaults. Delivery and permissions were not changed.

`cd mobile && npm run assets` now runs `scripts/sync-brand-assets.mjs`. It recopies the integrated UI/web assets, licenses and aliases from the canonical pack and merges the supplied native resources. This deliberately replaces the old Capacitor generator command, which could restore different artwork. No package versions or lockfile changed, and the alternative Capacitor PNG generation route was not combined with this route. Existing unrelated Android resources were preserved.

## Verification actually performed

- `cd mobile && npm run assets`: passed, including a second run after extending the script to cover UI/web aliases.
- `cd mobile && npm run build`: passed. Existing Ionic `:host-context` minification and bundle-size warnings remain.
- `cd mobile && npm run lint`: passed with three existing warnings in AuthContext, BirthdayCountdownPage and useInView.
- `cd mobile && npx cap copy android`: passed.
- `cd mobile && ./android/gradlew -p android assembleDebug`: passed, including Java compilation, manifest/resource merging and APK packaging. Existing Gradle/plugin deprecation warnings remain.
- Inspected the merged debug manifest: both launcher references and both FCM default metadata references resolve to the new `lo_` resources.
- Browser via chrome-devtools CLI and installed Chromium: Login, Home, Notes, Memories and Gym screenshots captured at 390 × 844. Authenticated screenshots use a synthetic recipient with isolated empty API fixtures; no real account, API write or backend change was involved.
- Home at 320px, 390px and 430px: no broken images or document horizontal overflow. At 320px with 200% root text (32px), those checks also passed. Home logo proportions remain 1500:380 with automatic height.
- Accessibility snapshots show one named logo on Login/Home and hide decorative chapter/empty-state artwork.
- Color/white symbols loaded at 24/32/48px on light/plum backgrounds. Screenshots were visually inspected for proportions and transparent backgrounds.
- Canonical asset copies were compared byte-for-byte; `git diff --check` passed.

The APK is at `mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

## Remaining device checks

`adb devices` reported no connected device or emulator. Actual launcher masks/themed icons, native cold/warm splash transitions and safe areas, and foreground/background notification appearance in light/dark system UI still need device validation. The build and browser screenshots do not certify these runtime behaviors.
