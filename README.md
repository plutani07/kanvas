# Kanvas Studio

A drawing and painting app for Android and desktop browsers. Studio 0.4 keeps the existing stamp-based painting engine and adds a responsive workspace with direct tools, a persistent desktop inspector, and a cleaner phone layout.

## Run locally

No build step or account is required for the app:

```sh
python -m http.server 5192 --directory web
```

Open http://localhost:5192. Use a consistent origin and port to keep access to your browser's existing gallery. Artworks are stored locally in IndexedDB, not in a cloud account. Export Kanvas projects to keep portable backups.

## What works

- Pressure-aware brush and eraser, stabilization, taper, smudge, blur, fill, and eyedropper.
- Lasso, rectangular and magic-wand selections; add, subtract, invert and transform selections.
- Layer visibility, opacity, 16 blend modes, clipping, alpha lock, duplication, ordering and merging.
- Free, perspective and mesh transforms, editable text layers, uploaded fonts and optional Google Fonts.
- A searchable FX Studio with 70 offline filters, live previews, comparison, full-resolution Apply, mix and parameter controls, and selection/alpha-lock support.
- Image import, adjustments, canvas resizing and rotation, PNG/JPEG export and editable project round-trips.
- Local gallery, rename, duplicate, search, sort, delete and restore.
- Desktop Layers, Brushes, History and Navigator panels, full color mixer, and a searchable command palette.
- Touch pinch/twist, two-finger undo and three-finger redo. Mouse wheel zoom and Space-drag pan.
- Atomic artwork/metadata autosave, visible save state, and protection against switching away after a failed save.
- Offline ibisPaint brush QR reader. Brush QR support maps only known fields; custom brush tip images are not encoded in the QR payload.

The web app downloads image and project files directly. Android saves through the existing MediaStore bridge. The shipped QR decoder is vendored in `web/jsQR.js` (see `web/jsQR.LICENSE.txt` for its Apache-2.0 license).

## Shortcuts

| Action | Shortcut |
| --- | --- |
| Commands | Ctrl/Cmd + K |
| New canvas / Open project | Ctrl/Cmd + N / O |
| Save on this device | Ctrl/Cmd + S |
| Export | Ctrl/Cmd + Shift + S |
| Undo / Redo | Ctrl/Cmd + Z / Shift + Z |
| Brush / Eraser | B / E |
| Transform / Lasso / Fill | V / L / G |
| Eyedropper / Text | I / T |
| Brush size | [ / ] |
| Pan | Hold Space and drag, or middle-button drag |
| Fit / Actual size | Ctrl/Cmd + 0 / 1 |
| Select all / Deselect | Ctrl/Cmd + A / D |
| Focus workspace | Tab |

On a phone, Menu → Find a command provides command search without a keyboard.

## Source and Android

`web/index.html` contains the existing engine and document/storage commands. `web/studio.js` connects the workspace controls to those commands; `web/studio.css` contains its responsive design. `web/fx-engine.js` implements the raster effects; `web/fx-worker.js` runs them off the UI thread; `web/fx.js` and `web/fx.css` provide the FX browser. See [docs/fx-filters.md](docs/fx-filters.md) for the catalog and limits. `web/` is authoritative. Gradle's `syncWeb` copies all HTML, CSS and JS assets before Android builds. To refresh the checked-in Android assets manually:

```sh
npm run sync:android
```

Open `android/` in Android Studio (Java 17, SDK 34), or run:

```sh
cd android
bash gradlew :app:assembleDebug
```

The APK workflow builds a debug APK for pull requests; the existing main-branch release signing flow remains available. No release keys are needed for a review build. See [HANDOFF.md](HANDOFF.md) for the native bridge and signing setup.

## Tests

```sh
npm ci
npx playwright install chromium
npm test
```

The engine checks render every filter deterministically and verify source immutability, known pixel values, alpha handling, selection isolation, and mix. Integration checks exercise FX preview/compare/cancel/apply, late worker results, full-resolution selection/alpha-lock behavior, worker fallback, phone layout, and real painted pixels, undo/redo, layer controls, selections, navigation, command search, image/project downloads, save/reload, project validation, storage failure, concurrent edits during saves, gallery restore, and phone touch drawing. Screenshots are written to `tests/artifacts/` and uploaded by browser CI. `KANVAS_BROWSER_PATH` can select a preinstalled Chromium executable.

## Practical limits

This is a working Studio upgrade, not full ibisPaint/Photoshop feature parity. There is no PSD import/export, CMYK pipeline, vector engine, animation/timelapse or cloud sync. History is in-memory per editing session (60 actions / roughly 220 MB); large canvases and many layers remain limited by device memory. Android does not bundle a Google Fonts API key; the curated catalog, loading a font by name, and uploaded fonts remain available. Fonts from Google require internet, while system fonts and uploaded fonts work locally. Android pressure, palm rejection, keyboard/file-picker behavior and performance still need physical-device testing.
