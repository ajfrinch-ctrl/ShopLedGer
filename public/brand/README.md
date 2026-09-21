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

## Installed app icons

The root `icon-180.png` (Apple touch), `icon-192.png` and `icon-512.png`
(Chrome/PWA) are opaque RGB PNGs resized from `karnaphuli-mark.jpg` — not the
old template placeholders. `icon-maskable-512.png` is a separate Android
adaptive icon: the circular logo is centered at 70% of the canvas width on an
opaque white background, keeping the mark inside the central 80%-diameter
safe circle. Do not mark the unpadded icons as maskable.

To regenerate from the repository root using ImageMagick 6 (`magick` on v7):

```sh
for size in 180 192 512; do
  convert public/brand/karnaphuli-mark.jpg -resize "${size}x${size}" \
    -strip -define png:color-type=2 "public/icon-${size}.png"
done
convert public/brand/karnaphuli-mark.jpg -resize 358x358 \
  -background white -gravity center -extent 512x512 \
  -strip -define png:color-type=2 public/icon-maskable-512.png
```

The manifest and icon links use `?v=2` to bypass cached placeholder assets;
keep that revision aligned in `src/routes/__root.tsx` and the manifest when
changing these assets again. Existing installations may retain their OS-cached
icon until Chrome refreshes their metadata or the shortcut is re-added. Do not
clear site data to refresh an icon: shop records are stored locally.
