# Tools and execution

The helper scripts are independent of the app's language/backend and do not change app dependencies. Narrated promos use render_promo.py; read promo-video.md for the creative/audio workflow. Python image checks need Pillow. Capture needs Node.js, Playwright and a Chromium installation. Video rendering needs FFmpeg with libx264; use ffprobe for final inspection. Inspect existing tools before installing anything. Keep additional tooling in an isolated directory/venv when possible.

## Phone listing specification snapshot

Checked 2026-11-01 against [Google Play's official guidance](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en). Recheck before release; the phone validator does not cover tablet/TV/Wear/XR requirements.

- Icon: 512×512, 32-bit PNG, maximum 1024 KB; also review Android's linked icon design rules.
- Feature graphic: 1024×500, JPEG or 24-bit PNG without alpha.
- Screenshots: at least two for a listing; up to eight per device type. JPEG or 24-bit PNG without alpha; dimensions 320–3840, longest side at most twice the shortest. For phone recommendation eligibility, aim for at least four 1080×1920 portrait or 1920×1080 landscape images.
- Preview video: optional for ordinary apps. Supply a public/unlisted, embeddable, non-age-restricted YouTube video URL with ads disabled. A local MP4 is not directly entered in this field.

Caption layout, truthful feature claims, device-specific requirements and visual quality need human/agent review beyond this numeric check.

## Reproducible browser capture

Copy assets/capture-plan.example.json into the project's ignored artifact directory and adapt routes/selectors to the real app. Paths passed as CLI arguments are relative to the working directory. Start the local app and isolated backend before capture. Never change the real product UI to satisfy a screenshot script.

```sh
node skills/play-store-assets/scripts/capture.mjs artifacts/play-store/en-US/capture-plan.json artifacts/play-store/en-US/raw
```

Playwright is dynamically imported. If already installed outside this project, set `PLAYWRIGHT_MODULE` to its absolute entrypoint path; `CHROME_EXECUTABLE` can select an existing compatible browser. The script does not install browsers. Add `--allow-remote` only for an authorized remote test environment with synthetic accounts. `--force` replaces existing named screenshots. Credentials for `fill` steps can use an environment-variable name, never a literal password in a committed plan.

The example's `record` option records browser interaction in raw/video/. Those files may include waits/navigation and require trimming. For native captures, select the correct emulator/device explicitly:

```sh
adb -s DEVICE_SERIAL exec-out screencap -p > artifacts/play-store/en-US/raw/home-android.png
adb -s DEVICE_SERIAL shell screenrecord --time-limit 30 /sdcard/store-demo.mp4
adb -s DEVICE_SERIAL pull /sdcard/store-demo.mp4 artifacts/play-store/en-US/video/interaction-raw.mp4
```

Do not use production accounts. Inspect captures for notifications and private data before reuse.

## Prepare and check images

For layouts, use HTML/CSS/SVG at the target pixel size and render with available browser tooling. Export feature/screenshot PNGs in RGB, not RGBA; export the icon in RGBA. Pillow can perform deterministic format conversion on exported layouts; do not use it to synthesize app UI.

```sh
python3 skills/play-store-assets/scripts/validate_assets.py artifacts/play-store/en-US
```

The validator expects icon.png, feature-graphic.png and screenshots/*.png or *.jpg. It reports hard format/dimension/count errors and separate recommendation warnings. A successful exit means only those mechanical checks passed. The written validation-report.json lists checked files and unresolved warnings.

## Narrated promo (default for promotional requests)

Read [promo-video.md](promo-video.md) and use the timed motion/voice/music workflow. A promo request requires an actual persuasive video with sound when requested, not the contact-reel helper below.

## Screenshot montage (only when explicitly requested)

The helper accepts ordered source paths, uses proportional scaling on a colored canvas, and produces a silent H.264 MP4. It refuses to overwrite unless --force is given. No music or image generation is required.

```sh
python3 skills/play-store-assets/scripts/make_video.py \
  --output artifacts/play-store/en-US/video/montage.mp4 \
  --seconds 4 --background f8f6f3 \
  artifacts/play-store/en-US/screenshots/01-home.png \
  artifacts/play-store/en-US/screenshots/02-detail.png
ffprobe -v error -show_entries stream=codec_name,width,height,pix_fmt -show_entries format=duration -of json artifacts/play-store/en-US/video/montage.mp4
```

Use --dry-run to print the encoding commands without FFmpeg. This validates source image inputs but is not a render test. Actual recordings should be trimmed/encoded separately, preserving real timing and gestures; report montage versus recorded interaction accurately.

## Manifest handoff

Include app ID/version/commit, locale, platform/device, source dimensions and paths, screen order/feature claims, short alt text for each image, output dimensions, actual tool versions, validation results and video type/duration. Distinguish raw screenshots, composed listing images, recorded interactions and generated branding. Flag missing Android verification or unavailable tools. Never include session files, secrets or signed media URLs in the manifest. Publishing remains separate from preparation.
