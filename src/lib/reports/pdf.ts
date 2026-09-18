import { captureReport, shareImages } from '../reportExport'

const loadJsPDF = async () => (await import('jspdf')).jsPDF

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ])
}

/* ═════════════════════════════════════════════
   A4 শিট → PDF ফাইল ও ছবি
   ─────────────────────────────────────────────
   • PDF: ব্যবহারকারী নিজে "PDF ডাউনলোড" চাপলে তবেই তৈরি হয়
   • শেয়ার: সবসময় ছবি (JPEG) — রিপোর্ট আগে ছবি হয়, তারপর WhatsApp-এ যায়
   দুটোই একই পেজ-কাটিং লজিক ব্যবহার করে, তাই ছবি আর PDF-এর চেহারা হুবহু এক।
   ═════════════════════════════════════════════ */

export interface SheetPdfOptions {
  filename: string
  shareText?: string
}

const bnDigits = (n: number) => n.toLocaleString('bn-BD')

/** পেজ ভাঙার আগে কাছাকাছি সাদা সারি খুঁজে সারি/লাইন মাঝখানে কাটা এড়ায় */
function findBreak(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, startY: number, idealEnd: number): number {
  const search = 48
  const lowest = Math.max(startY + 20, idealEnd - search)
  for (let y = idealEnd; y > lowest; y--) {
    let row: Uint8ClampedArray
    try {
      row = ctx.getImageData(0, y, canvas.width, 1).data
    } catch {
      return idealEnd
    }
    let white = true
    for (let i = 0; i < row.length; i += 4) {
      if (row[i] < 246 || row[i + 1] < 246 || row[i + 2] < 246) {
        white = false
        break
      }
    }
    if (white) return y
  }
  return idealEnd
}

/** একটা A4 পেজ — PDF-এ বসানো হয়, আবার ছবি হিসেবেও পাঠানো যায় */
export interface SheetPage {
  canvas: HTMLCanvasElement
  /** প্রতি মিলিমিটারে কত পিক্সেল (A4 প্রস্থ ১৯০ মিমি) */
  pxPerMm: number
  /** A4-র কনটেন্ট প্রস্থ (১৯০ মিমি) */
  imageWidthMm: number
  /** ১-ভিত্তিক পেজ নম্বর */
  page: number
  total: number
}

/**
 * লম্বা রিপোর্টকে A4 পেজে ভাগ করে, প্রতিটি পেজের নিচে ফুটার (তৈরির তারিখ ও
 * পৃষ্ঠা নম্বর) বসায়। একই ক্যানভাস বারবার ব্যবহার হয় — ক্রমে ক্রমে পড়তে হয়।
 */
function* sheetPages(canvas: HTMLCanvasElement): Generator<SheetPage> {
  const margin = 10
  const pageWidth = 210
  const pageHeight = 297
  const imageWidthMm = pageWidth - margin * 2 // 190mm
  const pxPerMm = canvas.width / imageWidthMm
  const footerMm = 8
  const contentMm = pageHeight - margin * 2 - footerMm
  const contentPx = Math.max(50, Math.floor(contentMm * pxPerMm))
  const footerPx = Math.max(20, Math.round(footerMm * pxPerMm))

  // ── পেজ কাটার জায়গাগুলো আগে ঠিক করা হয়, যাতে মোট পেজ সংখ্যা জানা যায় ──
  const sourceCtx = canvas.getContext('2d')
  const cuts: { start: number; end: number }[] = []
  if (sourceCtx) {
    let y = 0
    while (y < canvas.height) {
      const ideal = Math.min(y + contentPx, canvas.height)
      const end = ideal >= canvas.height ? canvas.height : findBreak(canvas, sourceCtx, y, ideal)
      cuts.push({ start: y, end })
      y = end
    }
  }
  const total = Math.max(1, cuts.length)

  const slice = document.createElement('canvas')
  slice.width = canvas.width
  slice.height = contentPx + footerPx
  const ctx = slice.getContext('2d')
  if (!ctx) throw new Error('শিট তৈরি করতে ক্যানভাস পাওয়া যায়নি')

  const footerFont = `${Math.max(11, Math.round(2.6 * pxPerMm))}px "Noto Sans Bengali", system-ui, sans-serif`
  const lineY = contentPx + Math.round(footerPx * 0.22)
  const textY = contentPx + Math.round(footerPx * 0.62)
  const createdLabel = `তৈরি: ${new Date().toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' })}`

  for (let page = 0; page < total; page++) {
    const { start, end } = cuts[page] || { start: 0, end: canvas.height }
    const height = end - start

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, slice.width, slice.height)
    ctx.drawImage(canvas, 0, start, canvas.width, height, 0, 0, canvas.width, height)

    // ফুটার: তৈরির তারিখ (বাঁয়ে) • পেজ নম্বর (ডানে) — কোনো ব্র্যান্ডিং নয়
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = Math.max(1, Math.round(pxPerMm * 0.2))
    ctx.beginPath()
    ctx.moveTo(0, lineY)
    ctx.lineTo(slice.width, lineY)
    ctx.stroke()

    ctx.font = footerFont
    ctx.fillStyle = '#6b7280'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.fillText(createdLabel, 0, textY)
    ctx.textAlign = 'right'
    ctx.fillText(`পৃষ্ঠা ${bnDigits(page + 1)} / ${bnDigits(total)}`, slice.width, textY)

    yield { canvas: slice, pxPerMm, imageWidthMm, page: page + 1, total }
  }
}

async function buildSheetPdf(
  el: HTMLElement,
  opts: SheetPdfOptions,
): Promise<{ pdf: unknown; blob: Blob; filename: string }> {
  const canvas = await captureReport(el)
  const JsPDF = await withTimeout(loadJsPDF(), 8000, 'PDF লাইব্রেরি লোড হয়নি')
  const pdf = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  const margin = 10
  let written = 0
  for (const page of sheetPages(canvas)) {
    if (written > 0) pdf.addPage()
    pdf.addImage(
      page.canvas.toDataURL('image/jpeg', 0.95),
      'JPEG',
      margin,
      margin,
      page.imageWidthMm,
      page.canvas.height / page.pxPerMm,
    )
    written++
  }

  const blob = pdf.output('blob') as Blob
  return { pdf, blob, filename: opts.filename }
}

/** একটা রিপোর্ট = একটা PDF ফাইল (আলাদা ডাউনলোড) */
export async function downloadSheetPdf(el: HTMLElement, opts: SheetPdfOptions): Promise<void> {
  const { pdf, filename } = await buildSheetPdf(el, opts)
  ;(pdf as { save: (name: string) => void }).save(filename)
}

const canvasToJpeg = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('ছবি তৈরি হয়নি, আবার চেষ্টা করুন'))),
      'image/jpeg',
      quality,
    ),
  )

/**
 * রিপোর্টের A4 পেজগুলো **ছবি** হিসেবে (লম্বা রিপোর্ট হলে একাধিক ছবি)।
 * WhatsApp-এ ছবি হিসেবেই যাবে — তাই আগে এই ছবিগুলো তৈরি হয়, পরে শেয়ার।
 */
export async function buildSheetImages(
  el: HTMLElement,
  opts: SheetPdfOptions,
): Promise<File[]> {
  const canvas = await captureReport(el)
  const files: File[] = []
  for (const page of sheetPages(canvas)) {
    const blob = await canvasToJpeg(page.canvas, 0.92)
    files.push(new File([blob], sheetImageName(opts.filename, page.page, page.total), { type: 'image/jpeg' }))
  }
  if (!files.length) throw new Error('ছবি তৈরি হয়নি, আবার চেষ্টা করুন')
  return files
}

/**
 * শেয়ার — **সবসময় ছবি ফরম্যাটে**।
 * আগে রিপোর্টের ছবি (প্রয়োজনে একাধিক A4 পেজ) তৈরি হয়, তারপর Web Share API-তে
 * WhatsApp/অন্য অ্যাপে যায়; ব্রাউজারে ফাইল-শেয়ার না থাকলে ছবি ডাউনলোড হয়ে
 * WhatsApp খোলে (সেখানে ছবিটি সংযুক্ত করতে হয়)।
 */
export async function shareSheetImage(
  el: HTMLElement,
  opts: SheetPdfOptions,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const files = await buildSheetImages(el, opts)
  return shareImages(files, opts.shareText)
}

/** ফাইল-নাম: sales-report-2026-09-01_2026-09-30.pdf (তারিখ সবসময় ইংরেজি সংখ্যায়) */
export const sheetFileName = (prefix: string, key: string) => {
  const clean = key
    .replace(/[^0-9A-Za-z_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${prefix}-${clean || 'report'}.pdf`
}

/**
 * শেয়ার করা ছবির নাম: `.pdf` নামটাই নেওয়া হয়, শেষে `.jpg` বসে।
 * একাধিক পেজ হলে `-1`, `-2`… যোগ হয় (নহলে WhatsApp-এ সব এক নামে মিশে যায়)।
 */
export const sheetImageName = (fileName: string, page: number, total: number) => {
  const base = fileName.replace(/\.pdf$/i, '')
  return `${base}${total > 1 ? `-${page}` : ''}.jpg`
}
