# Kanvas: handoff to Claude Code

Kanvas is a phone-first drawing app (ibisPaint-style painting with an Adobe-style pro layout), built as a
single HTML/JS page and wrapped in an Android WebView. Owner: Kev (PLUTANI / Kani, dev team kvanie).
Target device: Kev's Android phone, finger drawing. Also has Android Studio on his Windows PC.

## Paste this into Claude Code

> Set up and ship the Kanvas Android app from this folder.
>
> 1. Create a **private** GitHub repo `plutani07/kanvas`, commit everything in this folder to `main`.
>    Do not commit secrets. `.gitignore` already excludes `android/local.properties` and `*.jks`.
> 2. Download jsQR for offline QR scanning:
>    `curl -fsSL https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js -o android/app/src/main/assets/jsQR.js` (commit it).
> 3. Add a Gradle wrapper in `android/` (`gradle wrapper --gradle-version 8.9`) so Android Studio opens it cleanly.
> 4. Create a release keystore **outside the repo** (`keytool -genkeypair -v -keystore kanvas-release.jks -alias kanvas -keyalg RSA -keysize 2048 -validity 10000`),
>    then write `android/local.properties` with `kanvas.storeFile`, `kanvas.storePassword`, `kanvas.keyAlias`, `kanvas.keyPassword`,
>    and `kanvas.fontsKey=<my Google Fonts API key, I'll paste it>`. Tell me where the keystore and passwords are so I can back them up.
>    Also add them as GitHub Actions secrets (`KANVAS_KEYSTORE_B64` = base64 of the .jks, `KANVAS_STORE_PASSWORD`, `KANVAS_KEY_ALIAS`, `KANVAS_KEY_PASSWORD`, `KANVAS_FONTS_KEY`).
> 5. Build `:app:assembleRelease` (locally with Android Studio's JDK/SDK, or via the included GitHub Actions workflow) and fix any build errors.
> 6. Give me the signed APK, and install it on my phone over USB with `adb install -r` if it's plugged in.
> 7. Smoke-test on a device or emulator using the checklist in HANDOFF.md, and fix anything broken.
>
> Read HANDOFF.md first. `web/index.html` is the single source of truth for the UI; the Gradle `syncWeb` task copies it into the APK.

## Layout

```
web/index.src.html   App source as an artifact body (no <html>/<head>); also published as a claude.ai artifact
web/index.html       Same page wrapped in a full HTML document; this is what the APK ships
android/             Gradle project (AGP 8.5.2, compileSdk 34, minSdk 29, Java 17, androidx.webkit 1.11.0)
  app/src/main/java/com/kvanie/kanvas/MainActivity.java   WebView host + JS bridge
  app/src/main/assets/index.html                          Copied from web/index.html by the syncWeb task
.github/workflows/android.yml   CI build that uploads the APK as an artifact
docs/ibis-qr-format.md          What's known about ibisPaint's brush QR payload
```

If you edit `web/index.src.html`, regenerate `web/index.html` by wrapping it:
`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,interactive-widget=resizes-content"></head><body>` + source + `</body></html>`.
(Or just treat `web/index.html` as the source from now on and drop the src file.)

## How the Android wrapper works

- Page is served from `https://appassets.androidplatform.net/assets/index.html` via `WebViewAssetLoader`, not `file://`,
  so IndexedDB autosave and Google Fonts work.
- File pickers (`<input type=file>`) go through `onShowFileChooser`.
- `window.KanvasNative` bridge:
  - `saveFile(name, mime, base64)` writes to `Pictures/Kanvas/` (images) or `Download/Kanvas/` (project .json) via MediaStore. No storage permission needed on API 29+.
  - `fontsKey()` returns `BuildConfig.FONTS_API_KEY` (from `local.properties` / CI secret). When present, the Fonts panel loads the full Google Fonts catalog (about 1,700 families) from the Web Fonts Developer API and caches it for a week. Without it, a curated list of about 150 fonts plus "type any Google Font name" still works.
  - `version()`.
- Back button calls `window.kanvasBack()`; the page closes panels / cancels transforms before the app exits.
- `onPause` triggers the page's autosave.

Google Fonts key: in Google Cloud Console, restrict it to the **Web Fonts Developer API** only (API restriction).
Don't add an Android-app restriction; the call comes from WebView `fetch`, not an Android SDK.

## Features in the page (v0.2)

- Tools: Move/Transform (Free, Perspective, Mesh warp), Selection (Lasso, Rectangle, Magic Wand; New/Add/Subtract),
  Brush, Eraser, Smudge, Blur, Fill (tolerance, expand, sample all layers), Eyedropper, Text (editable text layers, Google Fonts + uploaded fonts)
- Adjust: hue, saturation, brightness, contrast, Gaussian blur, B&W, invert, sepia (respects selection and alpha lock)
- Canvas: canvas size with anchor, trim to selection, resize image, rotate 90° L/R, flip H/V
- Layers: blend modes (16), opacity, clipping, alpha lock, duplicate, merge down, reorder, rename, select layer pixels
- Brush engine: stamp-based with stabilizer, start/end taper, speed thinning, jitter, scatter, tips (round, soft, air, grain, flat, halftone, spray); pen pressure if a stylus reports it
- Gestures: two-finger tap undo, three-finger tap redo, pinch/twist zoom-rotate, hold to sample color
- ibisPaint brush QR import (jsQR + DecompressionStream). Kev's four brushes are pre-seeded.
- Autosave to IndexedDB; export PNG/JPG; project file (.json with per-layer PNGs)

## Smoke-test checklist (on device)

1. App opens to a blank portrait canvas with the left toolbar; the gesture tips card shows once.
2. Draw with Dip Pen; two-finger tap undoes; three-finger tap redoes.
3. Pinch/twist zooms and rotates; tapping the zoom chip refits.
4. Fill inside a closed line fills only that area.
5. Lasso a region → task bar appears → Transform → switch to Perspective and Mesh, drag points, Done.
6. Magic Wand selects a flat color region; Subtract mode removes from it.
7. Text: place text, change font (Fonts panel shows the full catalog if the API key is set), move/scale/rotate, edit again.
8. Canvas → Rotate right, then undo.
9. Export PNG → file appears in Gallery under Pictures/Kanvas. Save project → Download/Kanvas.
10. Import ibisPaint QR: pick a saved brush QR image → "Found a brush" → Add.
11. Kill the app and reopen: the artwork is still there (autosave).
12. Back button closes open panels first, then exits.

## Known gaps / ideas for next passes

- ibisPaint QR: only name, size and spacing are mapped. Kev can supply screenshots of each brush's ibisPaint settings to map the
  remaining float fields (see docs/ibis-qr-format.md). Custom brush-shape images aren't inside the QR.
- Export to ibisPaint QR (reverse direction) isn't built.
- Selection marching ants are drawn from a downsampled contour; very thin wand selections look dotted.
- Large canvases (over about 2500 px) plus many layers can run out of WebView memory on low-end phones; history caps at about 220 MB.
- Possible later: Firebase (Auth + Storage) to sync brushes/projects across devices. Not needed for v1.
- Kev prefers to be asked before fonts are picked or substituted in his designs, and to supply source assets rather than have them reconstructed.
