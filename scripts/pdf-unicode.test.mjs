import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { create } from "fontkit";
import { normalizePdfText } from "../src/lib/reports/unicode.ts";

const root = new URL("../", import.meta.url);
const sample = [
  "পল্লি বিদ্যুৎ অফিসের পাশে, বুড়া মসজিদ রোড, আমুচিয়া, বোয়ালখালী, চট্টগ্রাম",
  "কোয়ালিটি লেয়ার",
  "কোয়ালিটি লেয়ার",
  "করিম মিয়া",
  "মিয়া মিয়া",
  "ক্রয় বিক্রয় রসিদ ক্ষ জ্ঞ ত্র কর্ম প্রাণী",
  "ক্ষুদ্র জ্ঞাতব্য স্ত্রী দৃষ্টি শ্রী কৃষ্ণ স্বাস্থ্য খাদ্য",
  "কোয়ালিটি ব্রয়লার স্টার্টার ৫০ কেজি",
  "০১২৩৪৫৬৭৮৯ ৳১,২৩৪.৫০ ABC 123",
];

for (const weight of ["Regular", "Bold"]) {
  const data = readFileSync(new URL(`src/assets/fonts/NotoSansBengali-${weight}.ttf`, root));
  test(`${weight}: reproduces the old mixed-Unicode glyph cache corruption`, () => {
    const font = create(data);
    const dottedCircle = font.glyphForCodePoint(0x25cc).id;
    font.layout(sample[0]);
    const run = font.layout("কোয়ালিটি লেয়ার");
    assert.ok(
      run.glyphs.some((glyph) => glyph.id === dottedCircle),
      "Fixture must exercise the original broken shaping",
    );
  });
  test(`${weight}: normalized Bengali has no spurious dotted circles or missing glyphs`, () => {
    const font = create(data);
    const dottedCircle = font.glyphForCodePoint(0x25cc).id;
    // Reuse the font across all strings, as pdfmake does for an entire PDF.
    for (const text of sample) {
      const run = font.layout(normalizePdfText(text));
      assert.ok(run.glyphs.length > 0);
      assert.ok(
        run.glyphs.every((glyph) => glyph.id !== dottedCircle && glyph.id !== 0),
        text,
      );
    }
    const glyphs = (text) => font.layout(normalizePdfText(text)).glyphs.map((glyph) => glyph.id);
    assert.deepEqual(glyphs("কোয়ালিটি লেয়ার"), glyphs("কোয়ালিটি লেয়ার"));
    assert.deepEqual(glyphs("মিয়া"), glyphs("মিয়া"));
  });
}

test("Unicode normalization preserves text, digits and joiner intent", () => {
  for (const text of sample.concat(["ক্\u200dষ", "ক্\u200cষ", "−৳৯৯,৯৯৯.৫০", "ABC 123"])) {
    assert.equal(normalizePdfText(text).normalize("NFD"), text.normalize("NFD"));
    assert.equal(normalizePdfText(normalizePdfText(text)), normalizePdfText(text));
  }
});

test("fonts are inlined from one checked-in folder, never fetched at PDF creation", () => {
  const css = readFileSync(new URL("src/styles.css", root), "utf8");
  const loader = readFileSync(new URL("src/assets/fonts/index.ts", root), "utf8");
  const pdf = readFileSync(new URL("src/lib/reports/pdf.ts", root), "utf8");
  for (const weight of ["Regular", "Bold"]) {
    assert.ok(css.includes(`./assets/fonts/NotoSansBengali-${weight}.ttf?inline`));
    assert.ok(loader.includes(`./NotoSansBengali-${weight}.ttf?inline`));
  }
  assert.doesNotMatch(css + loader + pdf, /https?:\/\/[^\s"']*(?:fonts|\.ttf|\.woff)/);
  assert.doesNotMatch(
    pdf.slice(pdf.indexOf("async function loadEngine"), pdf.indexOf("let logoPromise")),
    /\bfetch\s*\(/,
  );
});
