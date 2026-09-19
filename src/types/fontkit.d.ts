/**
 * fontkit-এর হালকা type declaration — শুধু PDF-এ বাংলা shaping-এর জন্য যতটুকু
 * API ব্যবহার হয় ততটুকু (fontkit নিজে TypeScript type পাঠায় না)।
 */
declare module 'fontkit' {
  export interface FontkitGlyphPosition {
    xAdvance: number
    yAdvance: number
    xOffset: number
    yOffset: number
  }
  export interface FontkitGlyph {
    id: number
    codePoints?: number[]
  }
  export interface FontkitLayoutRun {
    glyphs: FontkitGlyph[]
    positions: FontkitGlyphPosition[]
  }
  export interface FontkitFont {
    unitsPerEm: number
    numGlyphs: number
    layout(text: string): FontkitLayoutRun
  }
  export function create(buffer: ArrayBuffer | Uint8Array): FontkitFont
}
