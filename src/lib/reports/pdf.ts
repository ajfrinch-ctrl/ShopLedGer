import { captureReport } from '../reportExport'

const loadJsPDF = async () => (await import('jspdf')).jsPDF

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ])
}

/* ═════════════════════════════════════════════
   A4 PDF ফাইল তৈরি — ফুটারে তৈরির তারিখ ও পেজ নম্বর
   (প্রিন্ট অপশন বাদ — অ্যাপটি মোবাইল থেকে ব্যবহার হয়)
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

async function buildSheetPdf(
  el: HTMLElement,
  opts: SheetPdfOptions,
): Promise<{ pdf: unknown; blob: Blob; filename: string }> {
  const canvas = await captureReport(el)
  const JsPDF = await withTimeout(loadJsPDF(), 8000, 'PDF লাইব্রেরি লোড হয়নি')
  const pdf = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  const margin = 10
  const pageWidth = 210
  const pageHeight = 297
  const imageWidth = pageWidth - margin * 2 // 190mm
  const pxPerMm = canvas.width / imageWidth
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
  const totalPages = Math.max(1, cuts.length)

  const slice = document.createElement('canvas')
  slice.width = canvas.width
  slice.height = contentPx + footerPx
  const ctx = slice.getContext('2d')!

  const footerFont = `${Math.max(11, Math.round(2.6 * pxPerMm))}px "Noto Sans Bengali", system-ui, sans-serif`
  const lineY = contentPx + Math.round(footerPx * 0.22)
  const textY = contentPx + Math.round(footerPx * 0.62)
  const createdLabel = `তৈরি: ${new Date().toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' })}`

  for (let page = 0; page < totalPages; page++) {
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
    ctx.fillText(`পৃষ্ঠা ${bnDigits(page + 1)} / ${bnDigits(totalPages)}`, slice.width, textY)

    if (page > 0) pdf.addPage()
    const sliceHeightMm = slice.height / pxPerMm
    pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', margin, margin, imageWidth, sliceHeightMm)
  }

  const blob = pdf.output('blob') as Blob
  return { pdf, blob, filename: opts.filename }
}

/** একটা রিপোর্ট = একটা PDF ফাইল (আলাদা ডাউনলোড) */
export async function downloadSheetPdf(el: HTMLElement, opts: SheetPdfOptions): Promise<void> {
  const { pdf, filename } = await buildSheetPdf(el, opts)
  ;(pdf as { save: (name: string) => void }).save(filename)
}

/**
 * PDF ফাইলটা সরাসরি শেয়ার/WhatsApp-এ পাঠানোর চেষ্টা করে (Web Share API)।
 * না পারলে ফাইল ডাউনলোড + wa.me টেক্সট খোলে।
 */
export async function shareSheetPdf(
  el: HTMLElement,
  opts: SheetPdfOptions,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const { pdf, blob, filename } = await buildSheetPdf(el, opts)
  const file = new File([blob], filename, { type: 'application/pdf' })
  const canShareFile =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })

  if (canShareFile) {
    try {
      await navigator.share({ files: [file], text: opts.shareText })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    }
  }

  ;(pdf as { save: (name: string) => void }).save(filename)
  if (opts.shareText) {
    window.open(`https://wa.me/?text=${encodeURIComponent(opts.shareText)}`, '_blank', 'noopener')
  }
  return 'downloaded'
}

/** ফাইল-নাম: sales-report-2026-09-01_2026-09-30.pdf (তারিখ সবসময় ইংরেজি সংখ্যায়) */
export const sheetFileName = (prefix: string, key: string) => {
  const clean = key
    .replace(/[^0-9A-Za-z_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${prefix}-${clean || 'report'}.pdf`
}
