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
Latin glyphs, numerals and the taka symbol are retained. Fonts are served
locally for browser printing and embedded by pdfmake for PDF downloads.
