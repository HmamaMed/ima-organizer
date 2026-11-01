# Narrated promotional videos

## Creative brief

Use the product, audience, real features, language and brand already established in the task. Ask only for preferences that materially change the result (language/voice, audience or a reference style); continue script/layout work while waiting. For an app promo, default to 25–45 seconds in vertical 9:16 unless another destination is requested. A landscape YouTube export needs a recomposed layout, not a stretched vertical video.

Write a conversational hook in the opening two seconds. Make the viewer recognize a situation, then show what changes with this app. For a couples app, a natural arc is “Another evening asking what to do?” → “Your own space together” → notes, shared ideas and plans → the brand. Adapt the words to the product; do not reuse this domain example in every app.

Show the app early. Keep the story focused on two or three connected benefits instead of reading every menu entry. End with a memorable brand/payoff. A social CTA must match actual availability; a private beta cannot say “download now” or invent a store link. For Play Store delivery, check the current listing-video rules and produce a separate ending when necessary.

## Tools and audio

Prefer a callable speech tool or an existing authorized narration. Otherwise use a documented TTS provider or a local licensed voice such as Piper. Check voice/model usage terms, save attribution and identify synthesized speech; never impersonate a person or treat an unofficial service endpoint as guaranteed available. Keep provider keys out of plans/logs. Send only the public promo script to a speech service, not app/user data. If a provider fails, stop bounded retries and use a working authorized alternative.

Generate narration per scene and measure each audio file. Leave short breathing room. Edit/re-synthesize speech that does not fit; never truncate a sentence or hide missing voiceover with music. A technically audible but robotic placeholder needs to be called out rather than advertised as a natural professional voice. Include the spoken script and SRT/VTT captions for review.

Use original composed music, licensed stock or a user-provided track with known rights. Keep source/license/attribution in the handoff. Do not download a recognizable commercial song. Music should support speech: use sidechain ducking or a deliberately quiet bed, avoid clipped peaks and check integrated loudness/true peak. A practical mix target is around -16 LUFS with a -1.5 dBTP ceiling; this is a production target, not a Google policy. Inspect the actual loudness report, not just the filter settings. Test the mix at phone-speaker volume and with headphones when playback is available.

## Motion and export

Use code-native motion tools: Remotion where available, or a deterministic HTML/SVG layer renderer plus FFmpeg. Use real captured UI for product evidence. Do not invent controls, fake typing as a verified app interaction or introduce stock footage that implies an unsupported feature. Promotional message bubbles can illustrate a situation but must be visually distinct from real app footage.

Give layers independent movement, time text to spoken ideas, add brief transitions and tasteful sound effects. Avoid a static full-screen card slideshow. Keep important text clear of social UI crop zones; use generous top/bottom margins and check small-screen readability. Add synchronized captions even when narration is present.

`scripts/render_promo.py PLAN.json --output promo.mp4` composites pre-rendered layers using FFmpeg, narration WAV files and a music WAV. It makes an H.264/AAC vertical master, separate voice/music stems, SRT captions and a provenance manifest. FFmpeg is required; Pillow checks image inputs. The layout images should be generated from the project's brand/fonts with HTML/CSS/SVG, then visually inspected before encoding.

Plan paths are relative to the plan file:

```json
{
  "width": 1080, "height": 1920, "fps": 30,
  "music": "audio/original-music.wav",
  "music_credit": "Original composition created for this app promo",
  "voice_credit": "Tool, voice/model, source and applicable attribution",
  "profile": "social",
  "scenes": [{
    "id": "hook", "duration": 3.5,
    "spoken": "Your short spoken hook.",
    "voice": "audio/hook.wav",
    "background": "layers/hook-bg.png",
    "layers": [
      {"file": "layers/hook-type.png", "x": 0, "y": 0, "motion": "rise", "delay": 0},
      {"file": "layers/hook-ui.png", "x": 200, "y": 650, "motion": "float", "delay": 0.2}
    ]
  }]
}
```

Every narrated scene needs a voice file. The renderer rejects mismatched dimensions, missing inputs, nonfinite/negative timing and narration extending beyond the scene. Default render refuses to overwrite a final video. A dry run checks inputs and emits the scene commands without claiming a render. A caller can author a new plan using a changed final scene for a store/social variant.

Verify the output contains video and non-silent audio, plays from beginning to end, has no clipped/cut-off captions, and reaches a clean ending. Decode every frame and inspect representative frames plus every edit/ending. Record actual dimensions, codecs, duration, loudness, narration source, music rights and whether UI shots came from browser or Android. Keep the former silent montage as an explicitly labeled draft if retaining it; make the new promo the primary review link and update the pack ZIP/manifest.
