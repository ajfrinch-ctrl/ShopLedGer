# Noto Sans Bengali

Source: https://github.com/google/fonts/tree/main/ofl/notosansbengali
Upstream file: `NotoSansBengali[wdth,wght].ttf` (downloaded 2026-09-20).
License: SIL Open Font License 1.1; see OFL.txt.

The bundled Regular (wght=400) and Bold (wght=700) fonts are static instances
of the upstream variable font, with wdth=100, generated with fontTools 4.65.0:

```python
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
font = TTFont("NotoSansBengali[wdth,wght].ttf")
instantiateVariableFont(font, {"wght": 400, "wdth": 100}, inplace=True)
font.save("NotoSansBengali-Regular.ttf")
```

Repeat with wght=700 for Bold. No glyph subsetting: Bengali shaping tables,
Latin glyphs, numerals and the taka symbol are retained.

## Local-only use

These are the existing repository font binaries, relocated from `public/fonts/`;
no new font was downloaded for this fix. Keep both TTFs and `OFL.txt` together
in this directory. No installation or runtime font-download script is needed.

- `index.ts` imports the TTFs with Vite's `?inline` flag for the PDF virtual FS.
- `src/styles.css` references these same files with `?inline`, embedding data
  URLs in the app stylesheet rather than requesting separate font files.
- pdfmake embeds the font subset in each PDF, so the reader need not have the
  font installed or connect to any font provider.
- Do not replace these imports with Google Fonts/CDN URLs or `fetch()` calls.

PDF text is normalized to NFC before layout (see `src/lib/reports/unicode.ts`).
This prevents fontkit's cached glyph clusters from mixing precomposed য়/ড়/ঢ়
with their decomposed equivalents. Do not strip nukta or vowel signs as a fix.

