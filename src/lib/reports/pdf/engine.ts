/**
 * Native PDF ইঞ্জিন — jsPDF দিয়ে সরাসরি টেক্সট/টেবিল আঁকা।
 *
 * এখানে কোনো ছবি (screenshot), html2canvas, canvas বা JPEG নেই। যা আঁকা হয় সবই
 * ভেক্টর টেক্সট ও রেখা:
 *
 *  ১. বাংলা টেক্সট fontkit-এ shape করে প্রতিটি গ্লিফ আলাদাভাবে বসানো হয়
 *     (ভিজিবল ফন্ট, PUA কোডপয়েন্ট)।
 *  ২. ঠিক সেই লাইনের উপরে একই জায়গায় একটি invisible টেক্সট স্তর বসানো হয়,
 *     যাতে PDF-এ select/copy/search হুবহু মূল বাংলা লেখা দেয়।
 *  ৩. ফুটার/হেডার/টেবিলের রেখা — সব vector।
 *
 * jsPDF কেবল PDF Download চাপলে dynamic import হয় (`createPdfEngine`)।
 */
import type { jsPDF } from 'jspdf'
import { hasBengali, PT_PER_MM, VisibleFontRegistry, type BengaliWeight } from './bengali'
import { loadBengaliFonts, type BengaliFontSet } from './fonts'

export const PAGE_WIDTH_MM = 210
export const PAGE_HEIGHT_MM = 297

const VISIBLE_FONT = 'SLBengaliVisible'
const TEXT_FONT = 'SLBengaliText'
const WEIGHTS: BengaliWeight[] = ['normal', 'bold']

/** jsPDF-এর ভিতরের font metadata (আমাদের দরকারি অংশটুকু) */
interface TtfMetadata {
  cmap?: { unicode?: { codeMap?: Record<number, number> } }
  toUnicode?: Record<number, number>
  characterToGlyph?: (code: number) => number
}
interface JsPdfInternals {
  getFont(fontName: string, fontStyle: string): { metadata: TtfMetadata }
}

const PDF_ENGINE_ERROR = 'PDF তৈরি করা যায়নি। আবার চেষ্টা করুন।'

export interface PdfBytes {
  blob: Blob
  buffer: ArrayBuffer
  size: number
}

export class NativePdfEngine {
  private readonly registry = new VisibleFontRegistry()
  private readonly visibleMeta: Partial<Record<BengaliWeight, TtfMetadata>> = {}
  private weight: BengaliWeight = 'normal'
  private sizePt = 9
  private using: 'visible' | 'text' = 'visible'

  private constructor(
    private readonly doc: jsPDF,
    private readonly fonts: BengaliFontSet,
  ) {
    const internals = doc.internal as unknown as JsPdfInternals
    for (const weight of WEIGHTS) {
      const meta = internals.getFont(VISIBLE_FONT, weight)?.metadata
      if (!meta?.cmap?.unicode?.codeMap || typeof meta.characterToGlyph !== 'function') {
        throw new Error(PDF_ENGINE_ERROR)
      }
      this.visibleMeta[weight] = meta
    }
    this.useFont('visible')
  }

  /** jsPDF + বাংলা ফন্ট প্রস্তুত (lazy: শুধু ডাউনলোড/টেস্টের সময়) */
  static async create(): Promise<NativePdfEngine> {
    const [{ jsPDF: JsPdf }, fonts] = await Promise.all([import('jspdf'), loadBengaliFonts()])
    const doc = new JsPdf({
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait',
      // ফন্ট নিজে এমবেড হয়, তাই প্রেসেট টুলের দরকার নেই; ফাইল ছোট রাখতে চাপা হয়
      compress: true,
      // ফন্ট একবার register হলে সবই embed হবে (visible + invisible স্তর)
      putOnlyUsedFonts: false,
    })
    try {
      for (const weight of WEIGHTS) {
        const file = `${weight === 'bold' ? 'Bold' : 'Regular'}.ttf`
        doc.addFileToVFS(file, fonts.files[weight].base64)
        doc.addFont(file, VISIBLE_FONT, weight)
        doc.addFont(file, TEXT_FONT, weight)
      }
      return new NativePdfEngine(doc, fonts)
    } catch {
      throw new Error(PDF_ENGINE_ERROR)
    }
  }

  /* ─────────────────────────────────────────────
     অবস্থা (font size, ওজন, রঙ)
     ───────────────────────────────────────────── */

  size(pt: number): this {
    this.sizePt = pt
    this.doc.setFontSize(pt)
    return this
  }

  bold(on: boolean): this {
    this.weight = on ? 'bold' : 'normal'
    this.useFont(this.using)
    return this
  }

  color(hex: string): this {
    const rgb = hexToRgb(hex)
    this.doc.setTextColor(rgb[0], rgb[1], rgb[2])
    return this
  }

  fillColor(hex: string): this {
    const rgb = hexToRgb(hex)
    this.doc.setFillColor(rgb[0], rgb[1], rgb[2])
    return this
  }

  strokeColor(hex: string): this {
    const rgb = hexToRgb(hex)
    this.doc.setDrawColor(rgb[0], rgb[1], rgb[2])
    return this
  }

  /* ─────────────────────────────────────────────
     মাপ ও আঁকা
     ───────────────────────────────────────────── */

  private get shaper() {
    return this.fonts.shapers[this.weight]
  }

  private useFont(kind: 'visible' | 'text') {
    this.using = kind
    this.doc.setFont(kind === 'visible' ? VISIBLE_FONT : TEXT_FONT, this.weight)
  }

  /** টেক্সটের প্রস্থ (মিমি) — যা আঁকা হবে ঠিক তারই সমান */
  measure(text: string): number {
    if (!text) return 0
    if (hasBengali(text)) return this.shaper.widthMm(text, this.sizePt)
    this.useFont('text')
    return this.doc.getTextWidth(text)
  }

  /**
   * শুধু দৃশ্যমান লেখা আঁকে (বাংলা হলে shaped গ্লিফ, নইলে সাধারণ টেক্সট)।
   * একই ঘরের সব লাইন আঁকার পর `drawInvisibleText` দিয়ে পুরো লেখাটি একবারে
   * বসানো হয় — তাতে copy/search-এ শব্দ ভাঙে না।
   */
  drawGlyphs(text: string, x: number, y: number): number {
    if (!text) return 0
    // ইংরেজি/সংখ্যা: সাধারণ টেক্সটই আসল অক্ষর, তাই আলাদা স্তর লাগে না
    if (!hasBengali(text)) {
      this.useFont('text')
      this.doc.text(text, x, y)
      return this.doc.getTextWidth(text)
    }
    const shaped = this.shaper.shape(text)
    const scale = this.sizePt / this.shaper.unitsPerEm / PT_PER_MM
    this.useFont('visible')
    const codeMap = this.visibleMeta[this.weight]!.cmap!.unicode!.codeMap!

    // পরপর গ্লিফ যেগুলো ফন্টের নিজস্ব advance মেনেই বসেছে সেগুলো একসঙ্গে আঁকা হয়
    // (এক call-এ অনেক গ্লিফ) — বড় রিপোর্টে PDF অনেক দ্রুত তৈরি হয়, ফল একই থাকে।
    let run = ''
    let runX = 0
    let runY = 0
    let prev: { x: number; y: number; adv: number } | null = null

    const flush = () => {
      if (!run) return
      this.doc.text(run, x + runX * scale, y + runY * scale)
      run = ''
    }

    for (const glyph of shaped.glyphs) {
      const code = this.registry.cidFor(glyph.gid)
      codeMap[code] = glyph.gid
      const continues =
        glyph.gid !== 0 &&
        prev !== null &&
        glyph.y === prev.y &&
        Math.abs(glyph.x - (prev.x + prev.adv)) < 0.01
      if (!continues) {
        flush()
        runX = glyph.x
        runY = glyph.y
      }
      run += String.fromCodePoint(code)
      prev = glyph
    }
    flush()
    return shaped.width * this.sizePt / PT_PER_MM
  }

  /**
   * অদৃশ্য কিন্তু হুবহু টেক্সট স্তর — PDF viewer-এ select/copy/search এটিই পড়ে
   * (যুক্তবর্ণ অটুট থাকে, তাই "বিক্রয়" লিখে খুঁজে পাওয়া যায়)।
   */
  drawInvisibleText(text: string, x: number, y: number): void {
    if (!text || !hasBengali(text)) return
    this.useFont('text')
    this.doc.text(text, x, y, { renderingMode: 'invisible' })
    this.useFont('visible')
  }

  /**
   * (x, y) বাঁদিকের প্রান্ত ও বেসলাইন ধরে এক লাইনের টেক্সট আঁকে; ফেরত দেয় প্রস্থ।
   * বাংলা হলে shaped গ্লিফ + invisible সঠিক-টেক্সট স্তর — দুটোই বসে।
   */
  draw(text: string, x: number, y: number): number {
    const width = this.drawGlyphs(text, x, y)
    this.drawInvisibleText(text, x, y)
    return width
  }

  /** ডানে-সারিবদ্ধ টেক্সট (ডান প্রান্ত x = right) */
  drawRight(text: string, right: number, y: number): number {
    const width = this.measure(text)
    this.draw(text, right - width, y)
    return width
  }

  /** মাঝ-সারিবদ্ধ টেক্সট (কেন্দ্র x = center) */
  drawCenter(text: string, center: number, y: number): number {
    const width = this.measure(text)
    this.draw(text, center - width / 2, y)
    return width
  }

  /**
   * নির্দিষ্ট প্রস্থে টেক্সট ভাগ করা (শব্দ ধরে; এক শব্দই বড় হলে ভেঙে ফেলা)।
   * `maxLines` ছাড়ালে শেষ লাইনে "…" বসে — টেবিলের সারি কখনো উপচে পড়ে না।
   */
  fit(text: string, maxWidthMm: number, maxLines = 1): string[] {
    const clean = sanitize(text)
    if (!clean) return ['']
    if (maxWidthMm <= 0) return ['']
    if (this.measure(clean) <= maxWidthMm) return [clean]

    const words = clean.split(' ')
    const lines: string[] = []
    let current = ''
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (this.measure(candidate) <= maxWidthMm) { current = candidate; continue }
      if (current) lines.push(current)
      if (this.measure(word) <= maxWidthMm) { current = word; continue }
      const pieces = this.breakWord(word, maxWidthMm)
      lines.push(...pieces.slice(0, -1))
      current = pieces[pieces.length - 1]
    }
    if (current) lines.push(current)
    if (lines.length <= maxLines) return lines
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = this.ellipsize(kept[maxLines - 1], maxWidthMm)
    return kept
  }

  /**
   * এক লাইনে না আঁটলে শেষে "…" বসিয়ে ছোট করা।
   * বাংলা দাঁড়ি/যতিচিহ্ন একা পড়ে গেলে সেটিও বাদ যায় (নোটের শেষ লাইনে "।" আটকে আছে
   * দেখতে খারাপ লাগে)।
   */
  private ellipsize(text: string, maxWidthMm: number): string {
    const chars = [...text.replace(/[।.,;:\s]+$/u, '')]
    while (chars.length > 1) {
      chars.pop()
      const candidate = `${chars.join('').trimEnd()}…`
      if (this.measure(candidate) <= maxWidthMm) return candidate
    }
    return '…'
  }

  /** শব্দের ভিতরে ভাঙা (লম্বা নাম/কোড) */
  private breakWord(word: string, maxWidthMm: number): string[] {
    const pieces: string[] = []
    let rest = word
    let guard = 0
    while (rest && guard++ < 200) {
      if (this.measure(rest) <= maxWidthMm) { pieces.push(rest); break }
      let low = 1
      let high = rest.length
      while (low < high) {
        const mid = Math.ceil((low + high) / 2)
        if (this.measure(rest.slice(0, mid)) <= maxWidthMm) low = mid
        else high = mid - 1
      }
      const take = Math.max(1, low)
      pieces.push(rest.slice(0, take))
      rest = rest.slice(take)
    }
    return pieces.length ? pieces : ['']
  }

  /* ─────────────────────────────────────────────
     রেখা / আয়তক্ষেত্র / ছবি
     ───────────────────────────────────────────── */

  /** সরল রেখা (মিমিতে বেধ) */
  line(x1: number, y1: number, x2: number, y2: number, widthMm = 0.2): void {
    this.doc.setLineWidth(widthMm)
    this.doc.line(x1, y1, x2, y2)
  }

  rect(x: number, y: number, width: number, height: number, mode: 'F' | 'S' | 'FD' = 'F'): void {
    this.doc.rect(x, y, width, height, mode)
  }

  /** লোগো (PNG data URL) — ব্যর্থ হলে লোগো বাদ যায়, PDF তবু তৈরি হয় */
  image(dataUrl: string, x: number, y: number, width: number, height: number): boolean {
    try {
      this.doc.addImage(dataUrl, 'PNG', x, y, width, height, `logo-${width}x${height}`, 'FAST')
      return true
    } catch {
      return false
    }
  }

  /* ─────────────────────────────────────────────
     পৃষ্ঠা ও আউটপুট
     ───────────────────────────────────────────── */

  get pageCount(): number {
    return this.doc.getNumberOfPages()
  }

  get currentPage(): number {
    return this.doc.getCurrentPageInfo().pageNumber
  }

  addPage(): void {
    this.doc.addPage('a4', 'portrait')
    this.useFont('visible')
  }

  goToPage(page: number): void {
    this.doc.setPage(page)
    this.useFont('visible')
  }

  /**
   * PDF ফাইল।
   *
   * আউটপুটের আগে ভিজিবল ফন্টের ToUnicode-এ প্রতিটি CID-কে শূন্য-প্রস্থ স্পেসে
   * (U+200B) বাঁধা হয়। কারণ: shape করা গ্লিফগুলো visual ক্রমে বসানো, তাই আসল
   * টেক্সট হিসেবে পড়লে শব্দ ভেঙে যায়। extractable সব লেখা আসে invisible
   * স্তর থেকে (আসল Unicode, যুক্তবর্ণ অটুট), আর ভিজিবল গ্লিফগুলো copy-তে কিছু
   * যোগ করে না — ফলে select/copy/search হুবহু শব্দ দেয়, দুইবার নয়।
   */
  output(): PdfBytes {
    const zeroWidth = 0x200b
    for (const weight of WEIGHTS) {
      const meta = this.visibleMeta[weight]
      if (!meta) continue
      meta.toUnicode = {}
      for (const glyph of this.registry.glyphs()) meta.toUnicode[glyph] = zeroWidth
    }
    const buffer = this.doc.output('arraybuffer') as ArrayBuffer
    return { blob: new Blob([buffer], { type: 'application/pdf' }), buffer, size: buffer.byteLength }
  }
}

export function sanitize(text: string): string {
  return text.replace(/[\r\n\t\u00a0]/g, ' ').replace(/\s{2,}/g, ' ').trim()
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const value = Number.parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16)
  if (!Number.isFinite(value)) return [17, 24, 39]
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}
