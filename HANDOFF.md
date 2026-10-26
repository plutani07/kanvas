# Kanvas Studio handoff

Kanvas is a phone-first drawing application wrapped in an Android WebView, with a responsive desktop painting workspace. See README.md for current setup, shortcuts, validation, and feature limitations.

## Source layout

- `web/index.html`: stamp-based painting engine, selections/transforms, text, gallery, document storage and native bridge calls.
- `web/studio.js`: direct tool rail, application menus, command search, desktop inspector, gallery search/sorting and keyboard/mouse navigation.
- `web/studio.css`: responsive Studio layout and purple accent theme. The existing system UI font stack is retained.
- `web/fx-engine.js`, `fx-worker.js`, `fx.js`, `fx.css`: deterministic raster effects and the searchable FX browser. Sources are snapshotted; previews are bounded and cancellable; Apply creates one undo entry at document resolution. See docs/fx-filters.md.
- `web/jsQR.js`: vendored QR decoder; its license is in `web/jsQR.LICENSE.txt`.
- `android/`: Java 17 / SDK 34 Android WebView host. Gradle copies web assets into the APK before each build.
- `tests/studio.cjs`: Chromium integration tests, including phone-sized touch input and injected storage failures.

`web/` is authoritative. Run `npm run sync:android` after changing web assets to update the checked-in Android copies.

## Native host

The WebView serves assets from `https://appassets.androidplatform.net/assets/` using WebViewAssetLoader so IndexedDB is available. Image, project and font file inputs use the native file chooser.

`window.KanvasNative.saveFile(name, mime, base64)` writes images to Pictures/Kanvas and project files to Download/Kanvas through MediaStore. Back calls `window.kanvasBack()`, and pause requests an autosave.

Android deliberately ships an empty `FONTS_API_KEY` compatibility field. Do not embed a font-service API credential in a distributable application. The curated font list, loading Google Fonts by family name, and uploaded fonts work without that credential. Existing optional full-catalog code has no key in this build.

Use Android Studio or `bash gradlew :app:assembleDebug` from `android/` for a debug APK. Pull-request CI builds a debug review artifact. Main-branch release CI retains the existing optional signing configuration; keep signing material outside source control.

## Storage and compatibility

IndexedDB database `kanvas`, object store `kv`:

- `arts`: gallery metadata and thumbnails.
- `art:<id>`: document dimensions, active layer, title, per-layer metadata and PNG blobs.
- `trash`: metadata for recently deleted artworks; the original layer data is retained until permanent deletion.
- `prefs`, `brushes`, `fonts`: user settings, presets and uploaded font data.
- Legacy v0.2 `doc` is migrated once into the gallery and retained as a backup.

Artwork saves share a queue. Each save captures metadata and starts all canvas encodes before yielding, then commits artwork and gallery metadata in one IndexedDB transaction. Edits made during encoding trigger another save. Failures preserve the dirty flag and prevent switching to another artwork. Project imports validate dimensions, layers and embedded PNG payloads before allocation. Documents decode before replacing the live layer stack.

Kanvas project JSON remains version 1 with per-layer PNG data URLs. Browser exports download directly; Android uses MediaStore. No cloud account is required.

## Validation and remaining work

Run `npm ci`, `npx playwright install chromium`, then `npm test`. Browser CI also checks that Android assets match `web/`. Screenshots are generated in the ignored `tests/artifacts/` directory.

The integration suite covers drawing pixels, undo/redo, layer properties and ordering, selections/fill, mouse navigation, command/history navigation, brushes/text/transforms/adjustments, downloads, project re-import, save/reload, malformed projects, concurrent edits during saves, storage failure, gallery restore, and phone touch input.

Physical Android testing remains necessary for stylus pressure, palm rejection, keyboard/file-picker behavior, lifecycle persistence and memory/performance. Existing ibisPaint QR support maps known brush fields only; custom tip images are not contained in the QR payload. Full PSD/CMYK/vector support, animation/timelapse and cloud sync are not implemented.
