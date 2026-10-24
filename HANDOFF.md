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
web/index.html       The whole app (one page, no build step); this is what the APK ships
android/             Gradle project (AGP 8.5.2, compileSdk 34, minSdk 29, Java 17, androidx.webkit 1.11.0)
  app/src/main/java/com/kvanie/kanvas/MainActivity.java   WebView host + JS bridge
  app/src/main/assets/index.html                          Copied from web/index.html by the syncWeb task
.github/workflows/android.yml   CI build that uploads the APK as an artifact
docs/ibis-qr-format.md          What's known about ibisPaint's brush QR payload
```

`web/index.html` is the only source (the old `index.src.html` artifact copy was dropped in v0.3).
Try it in a browser: `python -m http.server 5192` in `web/`, open http://127.0.0.1:5192/ at phone size.

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

## Layout of the app (v0.3, modelled on ibisPaint)

- **My Gallery** is the first screen: every artwork on the device as thumbnails. Tap one to select it, tap again (or Edit) to open.
  Bottom bar: New canvas, Artwork information (title, size, dates), Save image/project, ⋮ (duplicate, delete, new canvas
  from a picture, open a project file, Recently deleted, import ibisPaint brush, settings). Select mode deletes several.
  Delete goes to Recently deleted, which keeps the layers until "Delete for good".
- **Canvas**: undo/redo top left; View (mirror, grid, smooth/pixelated zoom, fit), Selection, Stabilizer top right.
  Above the bar, the current tool's sliders (size/opacity with −/+, or bucket tolerance, selection modes, the transform panel).
  Bottom bar: Brush/Eraser toggle, Tools popup (12 tools in two columns), Brush window, Color window, ↓ hide everything,
  Layer window, ← menu (back to gallery, save image/project, place photo, ibis QR, fonts, settings, how to use).
  One window at a time; the bar button of an open window shows ⌄ and closes it.
- **Windows**: Brush (preview, list, › for a brush's settings, Thickness/Opacity pinned), Color (hue ring + square, HSB or RGB
  sliders, palette with history), Layer (add/duplicate/photo left; clear, invert, move, flip, merge, delete, filter, ⋮ right;
  drag ≡ to reorder; clipping, alpha lock, blend, opacity at the bottom), Settings (gesture switches, eyedropper delay, pen pressure).
- **Storage** (IndexedDB `kanvas`): `arts` = gallery list with thumbnails, `art:<id>` = one artwork's layers, `trash`,
  `prefs`, `brushes`, `fonts`. All artwork writes go through one queue. The v0.2 `doc` key is copied into the gallery
  once on first run and left in place as a backup.

## Features in the page (v0.2, still there)

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

1. App opens to My Gallery. On a phone that had v0.2, the old canvas is there as one artwork. + makes a new canvas;
   the gesture tips card shows once.
2. Draw with Dip Pen; two-finger tap undoes; three-finger tap redoes.
3. Pinch/twist zooms and rotates; tapping the zoom chip refits.
4. Fill inside a closed line fills only that area.
5. Lasso a region → task bar appears → Transform → switch to Perspective and Mesh, drag points, Done.
6. Magic Wand selects a flat color region; Subtract mode removes from it.
7. Text: place text, change font (Fonts panel shows the full catalog if the API key is set), move/scale/rotate, edit again.
8. Canvas → Rotate right, then undo.
9. Export PNG → file appears in Gallery under Pictures/Kanvas. Save project → Download/Kanvas.
10. Import ibisPaint QR: pick a saved brush QR image → "Found a brush" → Add.
11. Kill the app and reopen: the artwork is still there with its new thumbnail (autosave).
12. Back button closes popups and windows first, then goes from the canvas to My Gallery, then exits.
13. Gallery: duplicate, delete, restore from Recently deleted, rename in Artwork information.

## Known gaps / ideas for next passes

- ibisPaint QR: only name, size and spacing are mapped. Kev can supply screenshots of each brush's ibisPaint settings to map the
  remaining float fields (see docs/ibis-qr-format.md). Custom brush-shape images aren't inside the QR.
- Export to ibisPaint QR (reverse direction) isn't built.
- Gallery: no drag-to-reorder or folders yet (ibisPaint has both). No time-lapse.
- Selection marching ants are drawn from a downsampled contour; very thin wand selections look dotted.
- Large canvases (over about 2500 px) plus many layers can run out of WebView memory on low-end phones; history caps at about 220 MB.
- Possible later: Firebase (Auth + Storage) to sync brushes/projects across devices. Not needed for v1.
- Kev prefers to be asked before fonts are picked or substituted in his designs, and to supply source assets rather than have them reconstructed.
