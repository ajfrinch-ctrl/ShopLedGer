/**
 * বাংলা টেক্সট → PDF গ্লিফ (native/vector PDF-এর ভিত্তি)।
 *
 * কেন দরকার: jsPDF বাংলা যুক্তবর্ণ নিজে গঠন করতে পারে না (HarfBuzz-এর মতো shaping
 * engine নেই)। তাই `fontkit` দিয়ে বাস্তব shaping করে প্রতিটি গ্লিফ আলাদা করে বসানো
 * হয় — এতে "বিক্রয়", "ক্ষ", "জ্ঞ", "মো" ইত্যাদি সঠিক আকারে আঁকা হয় এবং গ্লিফগুলো
 * ভেক্টর থাকে (zoom করলেও ঝকঝকে, ছবি নয়)।
 *
 * পাঠযোগ্যতা/খোঁজার জন্য visual গ্লিফগুলোর উপরে একটি invisible কিন্তু সঠিক টেক্সট
 * স্তর বসানো হয় (দেখুন `engine.ts`) — তাই PDF-এর টেক্সট select/copy/search করা যায়।
 */

export type BengaliWeight = 'normal' | 'bold'

/** একটি গ্লিফ: font units-এ অবস্থান (বাম-থেকে-ডানে চিত্রক্রমে) */
export interface ShapedGlyph {
  gid: number
  x: number
  y: number
  /** ফন্টের নিজস্ব অ্যাডভান্স (font units) — একসঙ্গে বসানো যায় কি না তা বুঝতে */
  adv: number
}

export interface ShapedText {
  /** visual order-এ (বাঁ থেকে ডানে) গ্লিফ */
  glyphs: ShapedGlyph[]
  /** মোট প্রস্থ (em এককে, অর্থাৎ font units ÷ unitsPerEm) */
  width: number
  text: string
}

/** GPU-মুক্ত shaping-এর জন্য fontkit-এর যতটুকু দরকার */
export interface FontkitFontLike {
  unitsPerEm: number
  /** glyph id → ভৌগলিক মেট্রিক (hmtx advance) */
  getGlyph(id: number): { advanceWidth?: number }
  layout(text: string): {
    glyphs: { id: number; codePoints?: number[] }[]
    positions: { xAdvance: number; yAdvance: number; xOffset: number; yOffset: number }[]
  }
}

const BENGALI_FIRST = 0x0980
const BENGALI_LAST = 0x09ff

/** টেক্সটে বাংলা অক্ষর আছে কি না (থাকলে shaping + text layer লাগবে) */
export function hasBengali(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code >= BENGALI_FIRST && code <= BENGALI_LAST) return true
  }
  return false
}

const SHAPE_CACHE_LIMIT = 4000

/** শুধু শূন্যস্থান (স্পেস, ট্যাব, নতুন লাইন) — শব্দ নয় */
const WHITESPACE = /^\s+$/

/**
 * একটি নির্দিষ্ট ওজন (regular/bold) ও font instance-এর জন্য shaping + মাপ।
 * ফলাফল ক্যাশে রাখা হয় — একই নাম/লেবেল বারবার এলে (হাজার সারির টেবিলে)
 * shaping শুধু একবারই হয়, তাই PDF দ্রুত তৈরি হয়।
 */
export class BengaliShaper {
  readonly unitsPerEm: number
  private readonly cache = new Map<string, ShapedText>()
  private readonly advances = new Map<number, number>()
  private readonly spaces = new Map<string, ShapedText>()

  constructor(private readonly font: FontkitFontLike) {
    this.unitsPerEm = font.unitsPerEm || 1000
  }

  /** UTF-16 string → visual order-এর গ্লিফ (font units-এ absolute অবস্থান) */
  shape(text: string): ShapedText {
    const cached = this.cache.get(text)
    if (cached) return cached
    const shaped = this.shapeComposed(text)
    if (this.cache.size >= SHAPE_CACHE_LIMIT) this.cache.clear()
    this.cache.set(text, shaped)
    return shaped
  }

  /** টেক্সটের প্রস্থ (মিলিমিটার), নির্দিষ্ট font size-এ — shaping-এর হুবহু অ্যাডভান্স */
  widthMm(text: string, sizePt: number): number {
    if (!text) return 0
    return (this.shape(text).width * sizePt) / PT_PER_MM
  }

  /** অক্ষরের সংখ্যা জানা না থাকলে (ফন্ট লোড হয়নি) আনুমানিক প্রস্থ */
  static approximateWidthMm(text: string, sizePt: number): number {
    // বাংলায় অক্ষরপ্রতি গড়ে প্রায় ০.৬ em — শুধু ফলব্যাক মাপে ব্যবহৃত হয়
    return (text.length * 0.6 * sizePt) / PT_PER_MM
  }

  /**
   * পুরো লাইন শেপ করা — কিন্তু শব্দ ধরে ক্যাশে রাখা হয়।
   *
   * কেন: একটা ১০০০ সারির টেবিলে হাজারো আলাদা স্ট্রিং থাকে (প্রতিটা সারিতে
   * সংখ্যা আর নাম বদলায়), অথচ ভেতরের **শব্দগুলো** বারবার ফিরে আসে। লাইন
   * আলাদা করে শেপ করতে গেলে প্রতিটার জন্য fontkit-এর ভারী layout চলত (বড়
   * রিপোর্টে ১০+ সেকেন্ড)। ফন্টের GPOS/GSUB-এ স্পেস গ্লিফের কোনো নিয়ম নেই,
   * তাই শব্দ আলাদা করে শেপ করে স্পেসের advance যোগ করলে ফল হুবহু একই হয়।
   */
  private shapeComposed(text: string): ShapedText {
    const tokens = text.split(/(\s+)/)
    if (tokens.length <= 1) return this.layoutRun(text)

    let pen = 0
    const glyphs: ShapedGlyph[] = []
    for (const token of tokens) {
      if (!token) continue
      // শুধু স্পেস/ট্যাব হলে সরাসরি layout — নইলে নিজের উপরেই recursion হতো
      const piece = WHITESPACE.test(token) ? this.space(token) : this.shape(token)
      for (const glyph of piece.glyphs) {
        glyphs.push({ gid: glyph.gid, x: pen + glyph.x, y: glyph.y, adv: glyph.adv })
      }
      // font units-এ ফেরানো মাপ (em → units) পূর্ণসংখ্যায় ধরা হয়, নইলে ভাসমান
      // সংখ্যার সামান্য ভুল জমে গিয়ে শেষ গ্লিফগুলো একটু সরে যেত
      pen += Math.round(piece.width * this.unitsPerEm * 1e6) / 1e6
    }
    return { glyphs, width: pen / this.unitsPerEm, text }
  }

  /** স্পেস/ট্যাবের মতো এক টুকরো শূন্যস্থান (ক্যাশে রাখা হয়) */
  private space(token: string): ShapedText {
    const cached = this.spaces.get(token)
    if (cached) return cached
    const run = this.layoutRun(token)
    this.spaces.set(token, run)
    return run
  }

  /** fontkit দিয়ে এক টুকরো টেক্সটের গ্লিফ ও অবস্থান (font units-এ) */
  private layoutRun(text: string): ShapedText {
    if (!text) return { glyphs: [], width: 0, text }
    const run = this.font.layout(text)
    let pen = 0
    const glyphs: ShapedGlyph[] = []
    for (let index = 0; index < run.glyphs.length; index++) {
      const position = run.positions[index]
      const gid = run.glyphs[index].id
      glyphs.push({
        gid,
        x: pen + position.xOffset,
        y: -position.yOffset,
        adv: this.advanceOf(gid),
      })
      pen += position.xAdvance
    }
    return { glyphs, width: pen / this.unitsPerEm, text }
  }

  /** glyph id-র default advance (font units) — একবার পড়ে ক্যাশে রাখা হয় */
  private advanceOf(gid: number): number {
    const known = this.advances.get(gid)
    if (known !== undefined) return known
    let advance = 0
    try {
      advance = this.font.getGlyph(gid)?.advanceWidth ?? 0
    } catch {
      advance = 0
    }
    this.advances.set(gid, advance)
    return advance
  }
}

export const PT_PER_MM = 72 / 25.4

/**
 * একটি PDF ফাইলের ভিতরে ব্যবহৃত হওয়া "ভিজিবল" ফন্টের CID বরাদ্দ।
 *
 * প্রতিটি shaped গ্লিফকে একটি ব্যক্তিগত-ব্যবহার (PUA) কোডপয়েন্ট দেওয়া হয়; ঐ
 * কোডপয়েন্টকে jsPDF-এর নিজস্ব cmap-এ glyph id-র সঙ্গে বাঁধা হয়। এতে jsPDF
 * ভুল গ্লিফ (যেমন Latin অক্ষর) না এঁকে ঠিক গ্লিফটিই আঁকে।
 */
export class VisibleFontRegistry {
  private next = 0xe000
  private readonly byGlyph = new Map<number, number>()

  /** glyph id → রেজিস্ট্রি-কোডপয়েন্ট (একই গ্লিফ একবারই বরাদ্দ হয়) */
  cidFor(gid: number): number {
    const known = this.byGlyph.get(gid)
    if (known !== undefined) return known
    const code = this.next++
    this.byGlyph.set(gid, code)
    return code
  }

  /** এখন পর্যন্ত ব্যবহৃত সব গ্লিফ (ToUnicode প্রস্তুত করতে দরকার) */
  glyphs(): number[] {
    return [...this.byGlyph.keys()]
  }
}
