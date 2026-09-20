/**
 * Bengali য়/ড়/ঢ় have canonically equivalent precomposed and decomposed forms.
 * Mixing them in one fontkit font instance corrupts cached glyph clusters (e.g.
 * an address containing "মিয়া" followed by the product "কোয়ালিটি লেয়ার").
 * Normalize EVERY PDF string before measuring/rendering, not just item names.
 * NFC preserves the language/text; it does not strip vowel signs, nukta, ZWJ,
 * or ZWNJ. Stored records are never rewritten.
 */
export function normalizePdfText(text: string): string {
  return text.normalize("NFC");
}
