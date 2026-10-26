# FX Studio

Kanvas includes 70 independently implemented raster effects. Open **Filter** from the tool menu or desktop toolbar, or search for **FX:** in the command palette.

Select an effect, tune its controls and Mix, and use View original to compare. Preview never changes layer pixels. Apply renders at document resolution and adds one undo step. Cancel or Escape discards the preview, including a render in progress. Applying to an editable text layer rasterizes it; undo restores both its pixels and editable text.

Effects target the active layer, respect an existing selection, and preserve original transparency when alpha lock is enabled. Generated gradients and clouds replace that layer within the selection; lines and solid frames overlay its original pixels. Duplicate a layer first when you want a separate effects layer.

Preview resolution is bounded to 640 pixels on the longest side. Workers keep raster processing off the UI thread and are terminated when superseded or cancelled. If Workers cannot be created (for example, some local-file environments), a local fallback remains available; a heavy full-resolution fallback render can temporarily block the UI. Large canvases remain limited by device memory.

Autosave records committed source pixels and thumbnails, excluding an uncommitted preview. Changing documents or layers while the FX window is open is blocked; applying also validates the target document, layer and edit revision.

## Catalog

| Category | Filters |
| --- | --- |
| Color adjustment | Brightness & contrast; Hue, saturation & lightness; Color balance; Tone curve; Levels; Grayscale; Black & white; Invert color; Posterize; Gradient map; Change drawing color; Mono color; Replace color; Extract line drawing; Find edges; Sepia |
| Blur | Gaussian blur; Moving blur; Zooming blur; Spin blur; Lens blur; Unsharp mask; Frosted glass |
| Style | Stroke (outer); Stroke (inner); Stroke (both); Glow (outer); Glow (inner); Bevel (inner); Bevel (outer); Wet edge; Satin; Extrude; Drop shadow; Emboss; Relief; Stained glass |
| Draw | Parallel gradation; Concentric gradation; Radial line gradation; Radial lines; Speed lines; Clouds |
| Art | Chromatic aberration; Glitch; Noise; Retro game; Anime-style background; Manga-style background; Chrome; Bloom; Cross filter; Sheer |
| Pixelate | Square pixelate; Hexagonal pixelate; Triangular pixelate; Crystallize; Pointillize; Dots (square); Dots (hexagonal) |
| Transform | Expansion; Fisheye lens; Sphere lens; Wave; Ripple; Twirl; Polar coordinates |
| Frame | Table; Blur frame; Solid frame |

## Reference and differences

Requested reference: [ibisPaint FX Filter List by Haruto](https://note.com/haru_to2005/n/n5d10321dab54?hl=en). The category organization was informed by that list and checked against [ibisPaint's official filter tutorials](https://ibispaint.com/lecture/index.jsp?lang=en&no=0). No screenshots, proprietary code, or filter presets were copied.

These are Kanvas algorithms with their own defaults and controls. Results are not guaranteed to match ibisPaint numerically. Gaussian blur uses a three-box approximation; lens, spin and motion blurs use bounded sampling; anime/manga effects are local tonal/edge/halftone processing rather than learned models.

The reference is broader than this release: AI/Smart watercolor, AI automatic painting and AI subject segmentation/background removal are not implemented. No images are sent to an AI service. QR generation, god rays and waterdrop styling are also outside this catalog; existing brush-QR import remains available. Those entries are not shown as pretend working buttons.

## Validation

Run npm test. The engine suite exercises all 70 filters and checks determinism, source preservation, pixel values, selection masks, alpha lock, blending, premultiplied blur and invalid parameters. Browser integration tests exercise both the new FX workflow and the existing painting workflow, including cancellation of late worker responses, autosave during preview, worker fallback and a phone-sized FX window.
