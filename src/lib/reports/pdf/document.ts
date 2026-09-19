/**
 * ReportDocument → native A4 PDF (কোনো ছবি নয়, সব ভেক্টর টেক্সট ও টেবিল)।
 *
 * একই renderer দশটি রিপোর্ট, ক্রেতার স্টেটমেন্ট ও রসিদ — সবখানে ব্যবহার হয়;
 * রিপোর্ট-ভিত্তিক আলাদা PDF কোড নেই। যা যা থাকে:
 *   প্রতিষ্ঠানের নাম/লোগো/ঠিকানা/ফোন (প্যাড) → শিরোনাম → সময় → ফিল্টার নোট →
 *   সারসংক্ষেপ কার্ড → টেবিল (হেডার প্রতি পৃষ্ঠায় পুনরাবৃত্ত) → সর্বমোট →
 *   নোট → মালিকের স্বাক্ষর → পৃষ্ঠা নম্বর ও তৈরির সময়।
 *
 * পৃষ্ঠা ভাঙার নিয়ম (A4 portrait, ১২ মিমি মার্জিন):
 *  • কোনো সারি মাঝখানে কাটা যায় না — পুরো সারি পরের পৃষ্ঠায় যায়
 *  • লম্বা ক্রেতা/পণ্য/বিবরণ টেক্সট ঘরের ভিতরে wrap হয়, সারির উচ্চতা বাড়ে
 *  • কলামের প্রস্থ ReportColumn.width (যেমন '২৩%') অনুযায়ী
 *  • সর্বমোট, নোট ও স্বাক্ষর একসঙ্গে শেষ পৃষ্ঠায় থাকে
 *  • প্রতিটি পৃষ্ঠায় ফুটারে "পৃষ্ঠা ১ / ৫"
 *
 * শেয়ারের ছবি এখান থেকে 만들어 হয় না — সেটি আলাদা পথ (`imageShare.ts`)।
 */
import type { ReportColumn, ReportDocument } from '../core'
import { bnDateTime, bnNum } from '../core'
import { NativePdfEngine, PAGE_WIDTH_MM, sanitize } from './engine'

/* ── জ্যামিতি ও মাপ (মিমি/পয়েন্ট) ── */

const MARGIN = 12
const CONTENT_WIDTH = PAGE_WIDTH_MM - MARGIN * 2
const CONTENT_BOTTOM = 277
const FOOTER_RULE_Y = 280
const FOOTER_TEXT_Y = 284.5

const CELL_PAD_X = 1.5
/** সংখ্যার ঘর (৳ ৯,৮৭,৬৫৪.৩২) ন্যূনতম এই মাপ পর্যন্ত ছোট করা যায় — লাইন ভাঙে না */
const MIN_CELL_FONT = 6.4
const SHRINK_STEP = 0.4
const LINE_GAP = 0.6
const FONT = {
  name: 13.5,
  padLine: 8,
  title: 11.5,
  period: 8.6,
  filter: 7.4,
  summaryLabel: 6.6,
  summaryValue: 8.8,
  tableHead: 8,
  cell: 7.6,
  note: 7.2,
  signature: 8,
  footer: 7,
  hint: 9,
}
const LINE_HEIGHT = 3.15
const MIN_ROW_HEIGHT = LINE_HEIGHT + 2.1
const SUMMARY_HEIGHT = 10.5
const LOGO_MAX_WIDTH = 24
const LOGO_MAX_HEIGHT = 13

const COLOR = {
  ink: '#111827',
  text: '#374151',
  muted: '#6b7280',
  rule: '#111827',
  cellBorder: '#d1d5db',
  tableBorder: '#9ca3af',
  headBg: '#f3f4f6',
  zebraBg: '#f8f9fa',
  emphasisBg: '#eef0f2',
  totalBg: '#e5e7eb',
  summaryBg: '#f3f4f6',
}

type Align = 'left' | 'right'

export interface ReportPad {
  name?: string
  /** লোগো — আগেই PNG data URL-এ প্রস্তুত করা (দেখুন `prepareLogo`) */
  logo?: string
  /** লোগোর প্রস্থ ÷ উচ্চতা (আকার বিকৃত না করার জন্য) */
  logoAspect?: number
  address?: string
  phone?: string
  branchName?: string
}

export interface ReportPdfOptions {
  /** প্রতিষ্ঠানের প্যাড (লোগো, নাম, ঠিকানা, ফোন) */
  pad: ReportPad
  /** প্যাডের নিচের লাইন — যেমন 'প্রধান শাখা' বা 'সব শাখা' */
  subtitle?: string
  /** শিরোনামের বদলে অন্য লেখা (না দিলে doc.title) */
  title?: string
  /** টেবিলের আগে অতিরিক্ত তথ্য সারি (রসিদে ব্যবহৃত) */
  details?: { label: string; value: string; strong?: boolean }[]
  /** স্বাক্ষরের লেবেল — false দিলে স্বাক্ষর ব্লক দেখানো হয় না */
  signatureLabel?: string | false
  /** টেবিল না থাকলেও দেখানোর মতো নোট (রসিদের ফুট-নোট) */
  footNote?: string
}

/* ── কলামের প্রস্থ ── */

const percentOf = (width?: string): number | null => {
  if (!width) return null
  const match = /^([\d.]+)\s*%$/.exec(width.trim())
  return match ? Number(match[1]) / 100 : null
}

/**
 * ReportColumn.width ('২৩%') মেনে কলামগুলোর প্রস্থ (মিমি) বের করা।
 *
 * `minimums`-এ কলামের শিরোনাম আঁকার মতো জায়গা দিলে কোনো কলাম এত সরু হয় না যে
 * শিরোনাম কেটে যায় ("বিক্রয় মূল্য" → "বিক্রয় মূ…")। বাকি জায়গা অনুপাত ধরে ভাগ হয়।
 */
export function columnWidths(
  columns: ReportColumn[],
  totalWidth = CONTENT_WIDTH,
  minimums: number[] = [],
): number[] {
  const count = columns.length
  if (!count) return []
  const fixed = columns.map((column) => percentOf(column.width))
  const fixedSum = fixed.reduce<number>((sum, value) => sum + (value ?? 0), 0)
  const free = fixed.filter((value) => value === null).length
  const shares = fixed.map((value) => value ?? (free ? Math.max(0.05, 1 - fixedSum) / free : 0))
  const shareSum = shares.reduce((total, value) => total + value, 0) || 1
  let widths = shares.map((share) => (share / shareSum) * totalWidth)

  const mins = columns.map((_column, index) => Math.min(minimums[index] ?? 0, totalWidth / count))
  // সরু কলামগুলোকে কমপক্ষে শিরোনামের সমান করা, আর বড় কলাম থেকে সমানুপাতে নেওয়া
  for (let pass = 0; pass < 5; pass++) {
    const deficit = widths.reduce((total, value, index) => total + Math.max(0, mins[index] - value), 0)
    if (deficit < 0.01) break
    const slack = widths.reduce((total, value, index) => total + Math.max(0, value - mins[index]), 0)
    if (slack < 0.01) break
    widths = widths.map((value, index) => {
      if (value < mins[index]) return mins[index]
      const drain = ((value - mins[index]) / slack) * deficit
      return value - Math.min(value - mins[index], drain)
    })
  }
  const total = widths.reduce((sum, value) => sum + value, 0) || 1
  return widths.map((value) => (value / total) * totalWidth)
}

/* ─────────────────────────────────────────────
   Painter
   ───────────────────────────────────────────── */

export class ReportPdfPainter {
  private y = MARGIN
  private readonly widths: number[]
  private readonly title: string

  constructor(
    private readonly pdf: NativePdfEngine,
    private readonly doc: ReportDocument,
    private readonly options: ReportPdfOptions,
  ) {
    /*
     * শিরোনাম যাতে কখনো কাটা না পড়ে ("ছাড় / সমন্বয়" → "ছাড়…") — হেডার bold-এ
     * আঁকা হয়, তাই bold-এ মাপ নিয়ে প্রতি কলামে ন্যূনতম প্রস্থ ঠিক করা হয়।
     * বড় শিরোনাম দুই লাইনে ভাঙতে পারে, তাই সবচেয়ে লম্বা শব্দটাই ন্যূনতম।
     */
    const minimums = doc.columns.map((column) => {
      pdf.bold(true).size(FONT.tableHead)
      const longestWord = column.label.split(/\s+/).reduce((longest, word) =>
        Math.max(longest, pdf.measure(word)), 0)
      const full = pdf.measure(column.label)
      pdf.bold(false)
      return Math.min(full, Math.max(longestWord, full * 0.62)) + CELL_PAD_X * 2 + 0.4
    })
    this.widths = columnWidths(doc.columns, CONTENT_WIDTH, minimums)
    this.title = options.title ?? doc.title
  }

  render(): void {
    this.drawPad()
    this.drawTitleBlock()
    if (this.doc.summary?.length) this.drawSummary(this.doc.summary)
    if (this.options.details?.length) this.drawDetails(this.options.details)
    this.drawTable()
    this.drawTail()
    this.drawFooters()
  }

  /* ── লেখা আঁকার কেন্দ্রীয় helper ── */

  /**
   * লাইনগুলো একে একে (দৃশ্যমান) আঁকে, তারপর পুরো লেখাটি একবারে invisible স্তর
   * হিসেবে বসায় — তাই copy/search-এ শব্দ ভাঙে না, wrap-এর জায়গায় স্পেসও হারায় না।
   */
  private drawBlock(options: {
    lines: string[]
    /** মূল লেখা (কাটা না হলে হুবহু এটাই search হবে) */
    text?: string
    baseline: number
    /** বাঁয়ে-সারিবদ্ধ হলে বাঁ প্রান্ত; ডানে হলে ডান প্রান্ত */
    anchor: number
    align: Align
    lineGap?: number
    centered?: boolean
  }): void {
    const { lines, baseline, anchor, align } = options
    const lineGap = options.lineGap ?? LINE_HEIGHT
    lines.forEach((line, index) => {
      const width = this.pdf.measure(line)
      const x = options.centered ? anchor - width / 2 : align === 'right' ? anchor - width : anchor
      this.pdf.drawGlyphs(line, x, baseline + index * lineGap)
    })
    const joined = lines.join(' ').replace(/\s{2,}/g, ' ').trim()
    // কাটা পড়লে যা দেখা যাচ্ছে তাই search হবে; নইলে মূল লেখাটাই
    const searchable = joined.includes('…') || !options.text ? joined : sanitize(options.text)
    const first = lines[0] ?? ''
    const firstWidth = this.pdf.measure(first)
    const x = options.centered ? anchor - firstWidth / 2 : align === 'right' ? anchor - firstWidth : anchor
    this.pdf.drawInvisibleText(searchable, x, baseline)
  }

  /* ── প্যাড: লোগো, নাম, শাখা, ঠিকানা, ফোন (পৃষ্ঠার মাঝখানে) ── */

  private drawPad(): void {
    const { pad } = this.options
    const name = sanitize(pad.name || '')
    const center = PAGE_WIDTH_MM / 2
    this.y = MARGIN

    if (pad.logo) {
      const aspect = pad.logoAspect && pad.logoAspect > 0 ? pad.logoAspect : 2.4
      const width = Math.min(LOGO_MAX_WIDTH, LOGO_MAX_HEIGHT * aspect)
      const height = width / aspect
      this.pdf.image(pad.logo, center - width / 2, this.y, width, height)
      this.y += height + 2.2
    }
    const centered = (text: string, size: number, maxLines: number, color: string, bold: boolean) => {
      this.pdf.bold(bold).size(size).color(color)
      const lines = this.pdf.fit(text, CONTENT_WIDTH, maxLines)
      const baseline = this.y + size * 0.36
      this.drawBlock({ lines, text, baseline, anchor: center, align: 'left', centered: true, lineGap: size * 0.46 })
      this.y += lines.length * size * 0.46
      this.pdf.bold(false)
    }
    if (name) centered(name, FONT.name, 2, COLOR.ink, true)
    const branch = sanitize(pad.branchName || '') || sanitize(this.options.subtitle || '')
    if (branch) { this.y += 0.6; centered(branch, FONT.padLine, 1, COLOR.text, false) }
    if (pad.address) centered(sanitize(pad.address), FONT.padLine, 2, COLOR.text, false)
    if (pad.phone) centered(`মোবাইল: ${sanitize(pad.phone)}`, FONT.padLine, 1, COLOR.text, false)

    this.y += 2.4
    this.pdf.strokeColor(COLOR.rule).line(MARGIN, this.y, PAGE_WIDTH_MM - MARGIN, this.y, 0.5)
    this.y += 5.5
  }

  /* ── শিরোনাম, সময়, ফিল্টার ── */

  private drawTitleBlock(): void {
    const center = PAGE_WIDTH_MM / 2
    const centered = (text: string, size: number, maxLines: number, color: string, bold: boolean) => {
      this.pdf.bold(bold).size(size).color(color)
      const lines = this.pdf.fit(text, CONTENT_WIDTH, maxLines)
      const baseline = this.y + size * 0.36
      this.drawBlock({ lines, text, baseline, anchor: center, align: 'left', centered: true, lineGap: size * 0.5 })
      this.y += lines.length * size * 0.5
      this.pdf.bold(false)
    }
    centered(this.title, FONT.title, 2, COLOR.ink, true)
    centered(`সময়: ${this.doc.period}`, FONT.period, 1, COLOR.muted, false)
    if (this.doc.filterNote) centered(`ফিল্টার: ${this.doc.filterNote}`, FONT.filter, 2, COLOR.muted, false)
    this.y += 3
  }

  /* ── সারসংক্ষেপ কার্ড ── */

  private drawSummary(summary: { label: string; value: string }[]): void {
    const gap = 3
    const count = Math.min(summary.length, 3)
    const cardWidth = (CONTENT_WIDTH - gap * (count - 1)) / count
    const baseline = this.y + 4.1
    summary.slice(0, count).forEach((item, index) => {
      const x = MARGIN + index * (cardWidth + gap)
      this.pdf.fillColor(COLOR.summaryBg).rect(x, this.y, cardWidth, SUMMARY_HEIGHT, 'F')
      this.pdf.bold(false).size(FONT.summaryLabel).color(COLOR.muted)
      this.drawBlock({ lines: this.pdf.fit(item.label, cardWidth - 3), text: item.label, baseline, anchor: x + 1.5, align: 'left' })
      this.pdf.bold(true).size(FONT.summaryValue).color(COLOR.ink)
      this.drawBlock({ lines: this.pdf.fit(item.value, cardWidth - 3), text: item.value, baseline: baseline + 4.3, anchor: x + 1.5, align: 'left' })
      this.pdf.bold(false)
    })
    this.y += SUMMARY_HEIGHT + 3
  }

  /* ── রসিদের তথ্য সারি (লেবেল → মান) ── */

  private drawDetails(details: { label: string; value: string; strong?: boolean }[]): void {
    const labelWidth = CONTENT_WIDTH * 0.34
    for (const detail of details) {
      this.pdf.bold(!!detail.strong).size(FONT.cell)
      const valueLines = this.pdf.fit(detail.value, CONTENT_WIDTH - labelWidth - 2, 3)
      const height = rowHeight(valueLines.length)
      if (this.y + height > CONTENT_BOTTOM) { this.pdf.addPage(); this.y = MARGIN }
      this.pdf.bold(true).size(FONT.cell).color(COLOR.muted)
      this.drawBlock({ lines: this.pdf.fit(detail.label, labelWidth - 2), text: detail.label, baseline: this.y + LINE_HEIGHT, anchor: MARGIN, align: 'left' })
      this.pdf.bold(false).color(detail.strong ? COLOR.ink : COLOR.text)
      this.drawBlock({ lines: valueLines, text: detail.value, baseline: this.y + LINE_HEIGHT, anchor: MARGIN + labelWidth, align: 'left' })
      this.y += height
      this.pdf.strokeColor(COLOR.cellBorder).line(MARGIN, this.y, PAGE_WIDTH_MM - MARGIN, this.y, 0.1)
    }
    this.pdf.bold(false)
    this.y += 3
  }

  /* ── টেবিল (প্রতি পৃষ্ঠায় হেডার পুনরাবৃত্ত) ── */

  /** টেবিলের হেডার — লম্বা শিরোনাম দুই লাইনে ভাঙে, কখনো "…" হয়ে কাটে না */
  private drawTableHeader(): void {
    this.pdf.bold(true).size(FONT.tableHead)
    const labels = this.doc.columns.map((column, index) =>
      this.pdf.fit(column.label, this.widths[index] - CELL_PAD_X * 2, 2))
    const lines = Math.max(1, ...labels.map((cell) => cell.length))
    const height = lines * LINE_HEIGHT + 2.2

    this.pdf.fillColor(COLOR.headBg).rect(MARGIN, this.y, CONTENT_WIDTH, height, 'F')
    this.pdf.color(COLOR.ink)
    let x = MARGIN
    this.doc.columns.forEach((column, index) => {
      const width = this.widths[index]
      const lineCount = labels[index].length
      labels[index].forEach((line, lineIndex) => {
        const baseline = this.y + LINE_HEIGHT + lineIndex * LINE_HEIGHT - (lines - lineCount) * LINE_HEIGHT * 0.5
        this.drawBlock({
          lines: [line],
          text: column.label,
          baseline,
          anchor: this.alignOf(column, index) === 'right' ? x + width - CELL_PAD_X : x + CELL_PAD_X,
          align: this.alignOf(column, index),
        })
      })
      x += width
    })
    this.pdf.strokeColor(COLOR.tableBorder)
    this.pdf.line(MARGIN, this.y, PAGE_WIDTH_MM - MARGIN, this.y, 0.25)
    this.y += height
    this.pdf.bold(false)
  }

  /**
   * একটি সারির wrap করা লাইন ও উচ্চতা — পৃষ্ঠা ভাঙার আগে একবারই হিসাব হয়।
   *
   * টাকার অঙ্ক (`৳ ৯,৮৭,৬৫৪.৩২`) সংকীর্ণ কলামে লাইন ধরে ভাঙলে দেখতে খারাপ লাগে
   * ("৳ / ৯,৮৭,৬৫৪.৩ / ২")। তাই সংখ্যার ঘরকে প্রথমে হালকা ছোট করা হয় (এক
   * লাইনেই থাকে); একেবারে না বসলে তবেই "…" হয়। বাকি লেখা আগের মতোই wrap করে।
   */
  /**
   * টাকার অঙ্ক দুই লাইনে ভাগ করা — ভাঙা হয় কমা/দশমিক/স্পেসের পরে, তাই দুটো
   * লাইনই অর্থপূর্ণ থাকে ("৳ ৯,৮৭,৬৫৪" / ".৩২")।
   */
  private splitAmount(text: string, maxWidthMm: number, maxLines: number): string[] {
    const lines: string[] = []
    let rest = text
    while (rest && lines.length < maxLines) {
      if (this.pdf.measure(rest) <= maxWidthMm) {
        lines.push(rest)
        rest = ''
        break
      }
      if (lines.length === maxLines - 1) break
      let cut = -1
      for (let index = 1; index < rest.length; index++) {
        const previous = rest[index - 1]
        if (previous === ' ' || previous === ',' || previous === '.' || previous === '-') {
          if (this.pdf.measure(rest.slice(0, index)) <= maxWidthMm) cut = index
        }
      }
      if (cut < 0) break
      lines.push(rest.slice(0, cut).trimEnd())
      rest = rest.slice(cut).trimStart()
    }
    if (rest) lines.push(...this.pdf.fit(rest, maxWidthMm, 1))
    return lines.length ? lines : this.pdf.fit(text, maxWidthMm, 1)
  }

  private planRow(cells: string[], emphasis = false): RowPlan {
    this.pdf.bold(emphasis).size(FONT.cell)
    const plans = this.doc.columns.map((_column, index) => {
      const available = this.widths[index] - CELL_PAD_X * 2
      const text = cells[index] ?? ''
      if (this.pdf.measure(text) <= available) return { lines: [text], size: FONT.cell }
      if (isCompactAmount(text)) {
        for (let size = FONT.cell - SHRINK_STEP; size >= MIN_CELL_FONT - 1e-6; size -= SHRINK_STEP) {
          this.pdf.size(size)
          if (this.pdf.measure(text) <= available) {
            this.pdf.size(FONT.cell)
            return { lines: [text], size }
          }
        }
        // একেবারে ছোট করেও এক লাইনে না বসলে অঙ্কটা দুই লাইনে ভাগ হয় — তবু
        // সংখ্যাটা পড়া যায় (কোনো দিন "…" দিয়ে সম্পূর্ণ অঙ্ক গায়েব হয় না)
        this.pdf.size(MIN_CELL_FONT)
        const lines = this.splitAmount(text, available, 2)
        this.pdf.size(FONT.cell)
        return { lines, size: MIN_CELL_FONT }
      }
      return { lines: this.pdf.fit(text, available, 4), size: FONT.cell }
    })
    const maxLines = Math.max(1, ...plans.map((plan) => plan.lines.length))
    return { cells: plans, maxLines, height: rowHeight(maxLines) }
  }

  private paintRow(plan: RowPlan, cells: string[], emphasis = false, background?: string): void {
    const fill = background ?? (emphasis ? COLOR.emphasisBg : undefined)
    if (fill) this.pdf.fillColor(fill).rect(MARGIN, this.y, CONTENT_WIDTH, plan.height, 'F')

    this.pdf.bold(emphasis).size(FONT.cell)
    let x = MARGIN
    this.doc.columns.forEach((column, index) => {
      const cell = plan.cells[index]
      this.pdf.color(index === 0 ? COLOR.ink : COLOR.text).size(cell.size)
      const align = this.alignOf(column, index)
      const anchor = align === 'right' ? x + this.widths[index] - CELL_PAD_X : x + CELL_PAD_X
      const baseline = this.y + LINE_HEIGHT - (plan.maxLines - cell.lines.length) * LINE_HEIGHT * 0.5
      this.drawBlock({ lines: cell.lines, text: cells[index] ?? '', baseline, anchor, align })
      x += this.widths[index]
    })
    this.pdf.size(FONT.cell)
    this.y += plan.height
    this.pdf.bold(false)
    this.pdf.strokeColor(COLOR.cellBorder).line(MARGIN, this.y, PAGE_WIDTH_MM - MARGIN, this.y, 0.1)
  }

  private drawTable(): void {
    if (!this.doc.columns.length) return
    if (!this.doc.rows.length) {
      this.pdf.bold(false).size(FONT.hint).color(COLOR.muted)
      this.drawBlock({
        lines: ['নির্বাচিত ফিল্টারে কোনো তথ্য পাওয়া যায়নি।'],
        baseline: this.y + 8,
        anchor: PAGE_WIDTH_MM / 2,
        align: 'left',
        centered: true,
      })
      this.y += 18
      return
    }
    // শেষ পৃষ্ঠায় সর্বমোট, নোট ও স্বাক্ষরের জায়গা রাখা হয়
    const reserve = this.tailHeight()
    this.drawTableHeader()
    this.doc.rows.forEach((row, index) => {
      const last = index === this.doc.rows.length - 1
      const plan = this.planRow(row.cells, row.emphasis)
      // সারি মাঝখানে কাটা যায় না — পুরো সারি পরের পৃষ্ঠায় যায়
      if (this.y + plan.height > (last ? CONTENT_BOTTOM - reserve : CONTENT_BOTTOM)) {
        this.pdf.addPage()
        this.y = MARGIN
        this.drawTableHeader()
      }
      this.paintRow(plan, row.cells, row.emphasis, row.emphasis ? undefined : index % 2 ? COLOR.zebraBg : undefined)
    })
    if (this.doc.totals) {
      const plan = this.planRow(this.doc.totals, true)
      if (this.y + plan.height > CONTENT_BOTTOM) {
        this.pdf.addPage()
        this.y = MARGIN
        this.drawTableHeader()
      }
      this.pdf.strokeColor(COLOR.rule).line(MARGIN, this.y, PAGE_WIDTH_MM - MARGIN, this.y, 0.4)
      this.paintRow(plan, this.doc.totals, true, COLOR.totalBg)
    }
  }

  /* ── শেষ অংশ: নোট, স্বাক্ষর ── */

  private notesLines(): string[] {
    const notes = [...(this.doc.notes ?? [])]
    if (this.options.footNote) notes.push(this.options.footNote)
    if (!notes.length) return []
    this.pdf.size(FONT.note)
    return notes.flatMap((note) => this.pdf.fit(`• ${note}`, CONTENT_WIDTH, 3))
  }

  private tailHeight(): number {
    const notes = this.notesLines()
    const notesHeight = notes.length ? notes.length * LINE_HEIGHT + 2 : 0
    const signatureHeight = this.options.signatureLabel === false ? 0 : 20
    return notesHeight + signatureHeight
  }

  private drawTail(): void {
    const notes = this.notesLines()
    if (notes.length) {
      if (this.y + notes.length * LINE_HEIGHT + 4 > CONTENT_BOTTOM) { this.pdf.addPage(); this.y = MARGIN }
      this.y += 2
      this.pdf.bold(false).size(FONT.note).color(COLOR.muted)
      this.drawBlock({ lines: notes, baseline: this.y + LINE_HEIGHT * 0.7, anchor: MARGIN, align: 'left' })
      this.y += notes.length * LINE_HEIGHT
    }
    if (this.options.signatureLabel === false) return

    const label = typeof this.options.signatureLabel === 'string' ? this.options.signatureLabel : 'মালিকের স্বাক্ষর'
    const blockHeight = 20
    if (this.y + blockHeight > CONTENT_BOTTOM) { this.pdf.addPage(); this.y = MARGIN }
    this.y += 9
    const width = 58
    const right = PAGE_WIDTH_MM - MARGIN
    this.pdf.strokeColor(COLOR.rule).line(right - width, this.y, right, this.y, 0.3)
    this.pdf.bold(true).size(FONT.signature).color(COLOR.ink)
    this.drawBlock({ lines: [label], baseline: this.y + 4.6, anchor: right - width / 2, align: 'left', centered: true })
    this.pdf.bold(false).size(FONT.note).color(COLOR.muted)
    const dateLine = 'তারিখ: ____ / ____ / ________'
    this.drawBlock({ lines: [dateLine], baseline: this.y + 9.4, anchor: right - width / 2, align: 'left', centered: true })
    this.y += blockHeight
  }

  /* ── ফুটার: তৈরির সময় (বাঁয়ে) • পৃষ্ঠা নম্বর (ডানে) ── */

  private drawFooters(): void {
    const created = `তৈরি: ${bnDateTime()}`
    const total = this.pdf.pageCount
    for (let page = 1; page <= total; page++) {
      this.pdf.goToPage(page)
      this.pdf.bold(false).size(FONT.footer).color(COLOR.muted)
      this.pdf.strokeColor(COLOR.cellBorder).line(MARGIN, FOOTER_RULE_Y, PAGE_WIDTH_MM - MARGIN, FOOTER_RULE_Y, 0.15)
      this.drawBlock({ lines: this.pdf.fit(created, CONTENT_WIDTH * 0.6), baseline: FOOTER_TEXT_Y, anchor: MARGIN, align: 'left' })
      const numbering = `পৃষ্ঠা ${bnNum(page)} / ${bnNum(total)}`
      this.drawBlock({ lines: [numbering], baseline: FOOTER_TEXT_Y, anchor: PAGE_WIDTH_MM - MARGIN, align: 'right' })
    }
  }

  private alignOf(column: ReportColumn, index: number): Align {
    return column.align ?? (index === 0 ? 'left' : 'right')
  }
}

interface CellPlan {
  /** ঘরটির wrap হওয়া লাইন */
  lines: string[]
  /** এক লাইনে বসাতে ফন্ট ছোট করতে হলে সেই মাপ (নইলে FONT.cell) */
  size: number
}

interface RowPlan {
  /** প্রতি ঘরের লাইন ও মাপ */
  cells: CellPlan[]
  /** সবচেয়ে বড় ঘরের লাইন সংখ্যা */
  maxLines: number
  height: number
}

function rowHeight(lines: number): number {
  return Math.max(MIN_ROW_HEIGHT, lines * LINE_HEIGHT + LINE_GAP)
}

/** একটি ReportDocument → প্রস্তুত PDF (একই renderer সব রিপোর্টে) */
export function renderReportPdf(
  pdf: NativePdfEngine,
  doc: ReportDocument,
  options: ReportPdfOptions,
): NativePdfEngine {
  new ReportPdfPainter(pdf, doc, options).render()
  return pdf
}

/**
 * সংখ্যা/টাকার অঙ্কের মতো ছোট ঘর কি না: একটা অঙ্ক আছে, আর (টাকার চিহ্ন/একক বাদ
 * দিলে) ভিতরে কোনো স্পেস নেই — অর্থাৎ লাইন ধরে ভাঙার চেয়ে ছোট করাই ভালো।
 */
function isCompactAmount(text: string): boolean {
  const body = text.replace(/^[^\p{L}\p{N}]*\s*/u, '')
  return /\p{Nd}/u.test(body) && !/\s/.test(body)
}
