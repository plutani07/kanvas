# ibisPaint brush QR payload (reverse-engineered notes)

Decoded from four of Kev's exported brush QR codes ("angry💢", "Harder Daddy 🥵", "second option for sketch", "◇").

## Envelope

- QR byte mode. Raw bytes start with ASCII `IPBZ`.
- Bytes 4–7: a 32-bit value (0x0001FBD0, 0x000222E2, 0x00022344). Not the payload length; possibly a version or app build number.
- Bytes 8…: **raw DEFLATE** (no zlib header). Inflate with `DecompressionStream('deflate-raw')` / `zlib.decompress(b, -15)`.
- Inflated payload is 317–385 bytes, big-endian.

## Inflated layout (best guess)

| Offset | Type | Observed | Guess |
|---|---|---|---|
| 0 | u8 | 1 | format version |
| 1 | u16 | 2 | ? |
| 3 | u8 | 2 | ? |
| 4 | u32 | 0x131–0x175 | remaining body length |
| 8 | u16 | 2 | ? |
| 10 | u16 | 0 / 3 | ? |
| 12 | u32 | 10001, 10052, 10074, 10295 | base brush / brush type id |
| 16 | u32 | 1, 3, 332 | ? (flags or count) |
| 20 | f32 | 188, 15, 5.8, 1000 | **thickness (px)** (mapped) |
| 24 | f32 | 1000, 500, 757, 1000 | max thickness for the slider |
| 28–40 | 4×f32 | e.g. 0.57 0.57 0.47 0.47 | likely start/end thickness & opacity or pressure curve |
| 44 | f32 | 0, 32, 0, 151 | maybe angle |
| 48 | f32 | 0.01, 0.0325, 0.01, 0.075 | **interval / spacing** (mapped as ×2 of brush size, min 0.03) |
| 52 | f32 | 0.5 / 1 | ? |
| 56 | u32 | 0xE8…… | packed flags |
| … | f32s | | remaining parameters (unmapped) |
| … | `00 00 00 10` + 16 bytes, repeated | | UUIDs; one (`a54f0041…`) is shared by three brushes, possibly default shape / author |
| … | u16 len + Java modified UTF-8 | | **brush name** (emoji encoded as surrogate pairs, 6 bytes each) |

The Halftone brush has an extra UUID near the end (`da56554a…`), which likely references its custom dot shape. Shape bitmaps are **not** in the QR.

## Next step to finish mapping

Import each brush in ibisPaint, screenshot every page of its brush-parameter screen, and line the visible values up
against the float list (`parseIbisBrush()` returns `raw`; dump floats from offset 20). ibisPaint's own reference:
https://ibispaint.com/lecture/index.jsp?no=152 ("Details of Brush Parameters" is linked from there).
