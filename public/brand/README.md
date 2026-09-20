# Shop brand assets

- `karnaphuli-mark.jpg`: existing color logo used in the application UI.
- `karnaphuli-mark-mono.png`: local black/white variant for printed PDFs.

The print variant is derived from the existing JPG, not downloaded or generated
with AI. It is resized to 512 × 512, then each RGB pixel is converted using
luminance `0.2126 R + 0.7152 G + 0.0722 B` with a threshold of 160. Output pixels
are opaque black or white; this retains the cow mark while removing colored ink
and faint color-dependent detail. The original color file is not modified.

`SHOP.printLogo` points to the print asset with the same Vite base path as the
app. PDF browser regression checks decode the embedded image and verify its
pixels are black/white; UI and PDF text continue to use bundled Unicode fonts.
