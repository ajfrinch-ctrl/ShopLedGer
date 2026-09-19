/**
 * ছবি শেয়ার — PDF থেকে সম্পূর্ণ আলাদা পথ।
 *
 *   HTML রিপোর্ট → html2canvas → Canvas → JPEG → Web Share (WhatsApp)
 *
 * এখানে jsPDF বা PDF renderer ব্যবহার হয় না, আর PDF তৈরির সময় html2canvas
 * ব্যবহার হয় না। লম্বা রিপোর্ট ছোট ছোট block-এ ক্যাপচার হয়, তাই বড় রিপোর্টেও
 * ব্রাউজার আটকে যায় না।
 */
import { captureReport, shareImages } from '../../reportExport'

export interface SheetShareOptions {
  filename: string
  shareText?: string
}

const bnDigits = (n: number) => n.toLocaleString('bn-BD')

/** একটা A4 পৃষ্ঠা — ছবি হিসেবে শেয়ার হয় */
export interface SheetImagePage {
  canvas: HTMLCanvasElement
  /** প্রতি মিলিমিটারে কত পিক্সেল (A4 প্রস্থ ১৯০ মিমি) */
  pxPerMm: number
  /** A4-র কনটেন্ট প্রস্থ (১৯০ মিমি) */
  imageWidthMm: number
  /** ১-ভিত্তিক পৃষ্ঠা নম্বর */
  page: number
  total: number
}

/** পৃষ্ঠা ভাঙার আগে কাছাকাছি সাদা সারি খুঁজে সারি/লাইন মাঝখানে কাটা এড়ায় */
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

/**
 * লম্বা রিপোর্টকে A4 পৃষ্ঠায় ভাগ করে, প্রতিটি পৃষ্ঠার নিচে ফুটার (তৈরির তারিখ ও
 * পৃষ্ঠা নম্বর) বসায়। একই ক্যানভাস বারবার ব্যবহার হয় — ক্রমে ক্রমে পড়তে হয়।
 */
function* sheetPages(canvas: HTMLCanvasElement, offset = 0, numberedBlocks = false, rowEnds: number[] = []): Generator<SheetImagePage> {
  const margin = 10
  const pageWidth = 210
  const pageHeight = 297
  const imageWidthMm = pageWidth - margin * 2 // 190mm
  const pxPerMm = canvas.width / imageWidthMm
  const footerMm = 8
  const contentMm = pageHeight - margin * 2 - footerMm
  const contentPx = Math.max(50, Math.floor(contentMm * pxPerMm))
  const footerPx = Math.max(20, Math.round(footerMm * pxPerMm))

  // ── পৃষ্ঠা কাটার জায়গাগুলো আগে ঠিক করা হয়, যাতে মোট পৃষ্ঠা সংখ্যা জানা যায় ──
  const sourceCtx = canvas.getContext('2d')
  if (!sourceCtx || !canvas.width || !canvas.height) throw new Error('রিপোর্টের ছবি তৈরি হয়নি')
  const cuts: { start: number; end: number }[] = []
  let y = 0
  while (y < canvas.height) {
    const ideal = Math.min(y + contentPx, canvas.height)
    const rowEnd = [...rowEnds].reverse().find((end) => end > y + 20 && end <= ideal)
    const end = ideal >= canvas.height ? canvas.height : rowEnd || findBreak(canvas, sourceCtx, y, ideal)
    cuts.push({ start: y, end })
    y = end
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
    ctx.fillText(`পৃষ্ঠা ${bnDigits(offset + page + 1)}${numberedBlocks ? '' : ` / ${bnDigits(total)}`}`, slice.width, textY)

    yield {
      canvas: slice,
      pxPerMm,
      imageWidthMm,
      page: offset + page + 1,
      total: numberedBlocks ? Math.max(2, offset + total) : total,
    }
  }
}

/** Capture one bounded section at a time; never rasterize the entire long statement. */
async function* capturePages(el: HTMLElement): AsyncGenerator<SheetImagePage> {
  const blocks = [...el.querySelectorAll<HTMLElement>('[data-report-page]')]
  const targets = blocks.length ? blocks : [el]
  let offset = 0
  for (const target of targets) {
    const canvas = await captureReport(target)
    const bounds = target.getBoundingClientRect()
    const scale = bounds.height ? canvas.height / bounds.height : 1
    const rowEnds = [...target.querySelectorAll('tr')].map((row) => Math.round((row.getBoundingClientRect().bottom - bounds.top) * scale))
    try {
      for (const page of sheetPages(canvas, offset, targets.length > 1, rowEnds)) {
        yield page
        offset = page.page
      }
    } finally {
      canvas.width = 0
      canvas.height = 0
    }
  }
}

/** রিপোর্টের A4 পৃষ্ঠাগুলো ছবি হিসেবে (লম্বা রিপোর্ট হলে একাধিক ছবি) */
export async function sheetImagePages(el: HTMLElement): Promise<SheetImagePage[]> {
  const pages: SheetImagePage[] = []
  for await (const page of capturePages(el)) pages.push(page)
  if (!pages.length) throw new Error('ছবি তৈরি হয়নি, আবার চেষ্টা করুন')
  return pages
}

const canvasToJpeg = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('ছবি তৈরি হয়নি, আবার চেষ্টা করুন'))),
      'image/jpeg',
      quality,
    ),
  )

/** শেয়ার — সবসময় ছবি (JPEG), কখনো PDF নয় */
export async function buildSheetImages(el: HTMLElement, opts: SheetShareOptions): Promise<File[]> {
  const files: File[] = []
  for (const page of await sheetImagePages(el)) {
    const blob = await canvasToJpeg(page.canvas, 0.92)
    files.push(new File([blob], sheetImageName(opts.filename, page.page, page.total), { type: 'image/jpeg' }))
  }
  return files
}

/** ছবির নাম: `.pdf` → `.jpg` (একাধিক পৃষ্ঠা হলে -1, -2…) */
export function sheetImageName(fileName: string, page: number, total: number): string {
  const base = fileName.replace(/\.pdf$/i, '')
  return `${base}${total > 1 ? `-${page}` : ''}.jpg`
}

/**
 * শেয়ার — **সবসময় ছবি ফরম্যাটে**। আগে রিপোর্টের ছবি (প্রয়োজনে একাধিক A4 পৃষ্ঠা)
 * তৈরি হয়, তারপর Web Share API-তে WhatsApp/অন্য অ্যাপে যায়; ব্রাউজারে
 * ফাইল-শেয়ার না থাকলে ছবি ডাউনলোড হয়ে WhatsApp খোলে।
 */
export async function shareSheetImage(
  el: HTMLElement,
  opts: SheetShareOptions,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const files = await buildSheetImages(el, opts)
  return shareImages(files, opts.shareText)
}
