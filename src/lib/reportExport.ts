/**
 * রিপোর্ট এক্সপোর্ট — PDF ডাউনলোড, ছবি তৈরি ও শেয়ার (মোবাইল-বান্ধব; প্রিন্ট অপশন নেই)।
 *
 * নিয়ম: শেয়ার সবসময় **ছবি (JPEG) হিসেবে** হয় — আগে ছবি তৈরি হয়, তারপর Web Share
 * API-তে WhatsApp/অন্য অ্যাপে যায়; সাপোর্ট না থাকলে ছবি ডাউনলোড + `wa.me` খোলে।
 * PDF কেবল তখনই তৈরি হয় যখন ব্যবহারকারী নিজে "PDF ডাউনলোড" চাপেন।
 *
 * html2canvas + jsPDF dynamic import করা হয়, তাই রিপোর্ট পেজ না খুললে
 * এই ভারী লাইব্রেরিগুলো প্রথম লোডে ডাউনলোড হয় না (বান্ডল হালকা থাকে)।
 */

type Html2Canvas = typeof import('html2canvas').default
type JsPdf = InstanceType<typeof import('jspdf').jsPDF>

const loadHtml2Canvas = async (): Promise<Html2Canvas> => (await import('html2canvas')).default

const loadJsPDF = async () => (await import('jspdf')).jsPDF

/**
 * ক্যাপচারের আগে `data-pdf-expand` দেওয়া স্ক্রল-করা টেবিলগুলো পুরো খুলে দেয়,
 * তারপর আগের অবস্থায় ফিরিয়ে আনে — নইলে PDF-এ কাটা টেবিল আসে।
 * রুট এলিমেন্ট নিজেও data-pdf-expand থাকলে সেটাও খোলে।
 */
async function withExpandedContent<T>(el: HTMLElement, run: () => Promise<T>): Promise<T> {
  const childNodes = Array.from(el.querySelectorAll<HTMLElement>('[data-pdf-expand]'))
  const nodes =
    el.hasAttribute('data-pdf-expand') || el.hasAttribute('data-pdf-width')
      ? [el, ...childNodes]
      : childNodes

  const previous = nodes.map((n) => ({
    el: n,
    style: n.getAttribute('style'),
    scrollTop: n.scrollTop,
    scrollLeft: n.scrollLeft,
  }))

  nodes.forEach((n) => {
    // overflow ও max-height খুলে দিই, কিন্তু width: max-content নয় — নইলে ক্যানভাস বিশাল হয়ে হ্যাং করে
    n.style.overflow = 'visible'
    n.style.maxHeight = 'none'
    n.style.height = 'auto'
    n.style.maxWidth = 'none'
  })

  /*
   * মোবাইলে প্রিভিউ স্ক্রিনের প্রস্থে দেখানো হয়, কিন্তু PDF-এ A4-র সমান
   * চওড়া চাই — তাই ক্যাপচারের সময়ই এলিমেন্টটিকে নির্দিষ্ট প্রস্থে বসানো হয়
   * (স্ক্রিনে কিছুই বদলায় না, ক্যাপচার শেষে আগের অবস্থায় ফিরে যায়)।
   */
  const fixedWidth = Number(el.getAttribute('data-pdf-width') || '')
  if (Number.isFinite(fixedWidth) && fixedWidth > 0) {
    el.style.width = `${fixedWidth}px`
    el.style.minWidth = `${fixedWidth}px`
    el.style.maxWidth = 'none'
  }

  try {
    if (document.fonts?.ready) {
      // ফন্ট লোডে আটকে থাকলে ২ সেকেন্ড পর এগিয়ে যাই — নইলে PDF লোডিংয়ে আটকে থাকে
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ])
    }
    // লেআউট সেটল হওয়ার জন্য ছোট বিরতি
    await new Promise((r) => setTimeout(r, 80))
    return await run()
  } finally {
    previous.forEach(({ el, style, scrollTop, scrollLeft }) => {
      if (style === null) el.removeAttribute('style')
      else el.setAttribute('style', style)
      el.scrollTop = scrollTop
      el.scrollLeft = scrollLeft
    })
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ])
}

export interface CaptureOptions {
  /** html2canvas scale — না দিলে এলিমেন্টের আকার/লম্বা অনুযায়ী নিজেই ঠিক করে নেয় */
  scale?: number
}

/**
 * ক্যানভাস কত পিক্সেলের হলে নিরাপদ — বড় রিপোর্টে scale কমিয়ে
 * মোবাইল ব্রাউজারে ক্যানভাস-লিমিট ছাড়িয়ে PDF/ছবি ফাঁকা হয়ে যাওয়া আটকায়।
 */
export const captureScaleFor = (el: HTMLElement, maxPixels = 12_000_000): number => {
  const w = Math.max(el.scrollWidth || el.clientWidth || 320, 320)
  const h = Math.max(el.scrollHeight || el.clientHeight || 400, 200)
  const byArea = Math.sqrt(maxPixels / (w * h))
  return Math.max(0.8, Math.min(2, Number.isFinite(byArea) ? byArea : 2))
}

/** স্ক্রিনে যা দেখা যায় তার পূর্ণ ছবি (লম্বা টেবিলসহ) */
export async function captureReport(
  el: HTMLElement,
  timeoutMs = 15000,
  opts: CaptureOptions = {},
): Promise<HTMLCanvasElement> {
  const html2canvas = await withTimeout(loadHtml2Canvas(), 8000, 'PDF লাইব্রেরি লোড হয়নি, আবার চেষ্টা করুন')

  // width খুব বড় হলে html2canvas হ্যাং করে — ১২০০px-এ সীমাবদ্ধ
  const rawWidth = Math.max(el.scrollWidth, el.clientWidth || 0, 320)
  const width = Math.min(1200, rawWidth)
  // বড় রিপোর্টে scale নিজে থেকেই কমে (ক্যানভাস-সীমা), ছোট রিপোর্টে ১.৫–২
  const scale = opts.scale ?? Math.min(rawWidth > 900 ? 1.5 : 2, captureScaleFor(el))

  const task = withExpandedContent(el, () =>
    html2canvas(el, {
      scale,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      windowWidth: width + 32,
      // বিদেশি ফন্ট/ইমেজে CORS সমস্যা হলে ফাঁকা না রেখে চালিয়ে যাওয়া
      onclone: (doc) => {
        // ক্লোনে scrollbar লুকাই
        doc.querySelectorAll<HTMLElement>('[data-pdf-expand]').forEach((n) => {
          n.style.overflow = 'visible'
          n.style.maxHeight = 'none'
        })
      },
    }),
  )

  return withTimeout(task, timeoutMs, 'PDF ক্যাপচার সময় শেষ হয়েছে, আবার চেষ্টা করুন')
}

/** multipage A4 PDF — লম্বা রিপোর্ট কেটে যায় না, নতুন পেজে যায় */
export async function canvasToPdf(canvas: HTMLCanvasElement): Promise<JsPdf> {
  if (!canvas.width || !canvas.height) throw new Error('PDF-এর জন্য ছবি তৈরি হয়নি')
  const JsPDF = await withTimeout(loadJsPDF(), 8000, 'PDF লাইব্রেরি লোড হয়নি')
  const pdf = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  const margin = 8
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imageWidth = pageWidth - margin * 2
  const pxPerMm = canvas.width / imageWidth
  const sliceHeight = Math.max(1, Math.floor((pageHeight - margin * 2) * pxPerMm))

  const slice = document.createElement('canvas')
  slice.width = canvas.width
  slice.height = Math.min(sliceHeight, canvas.height)
  const ctx = slice.getContext('2d')
  if (!ctx) throw new Error('PDF তৈরি করতে ক্যানভাস পাওয়া যায়নি')

  for (let y = 0, page = 0; y < canvas.height; y += sliceHeight, page++) {
    const h = Math.min(sliceHeight, canvas.height - y)
    slice.height = h
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, h)
    ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h)
    if (page > 0) pdf.addPage()
    // JPEG 0.92 — সাইজ ছোট, মোবাইলে দ্রুত
    pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, imageWidth, h / pxPerMm)
  }
  return pdf
}

/** আগেই ক্যাপচার করা ক্যানভাস থেকে PDF (যেমন রসিদ) */
export async function downloadCanvasPdf(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const pdf = await canvasToPdf(canvas)
  pdf.save(filename)
}

/** ব্রাউজারে ফাইল সেভ */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/**
 * ছবিগুলো Web Share API-তে (WhatsApp-সহ যেকোনো অ্যাপে) পাঠায়;
 * না পারলে ছবি ডাউনলোড করে `wa.me` খোলে — যাতে শেয়ার সবসময় ছবি হিসেবেই হয়।
 */
export async function shareImages(
  files: File[],
  text?: string,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (!files.length) throw new Error('শেয়ার করার মতো ছবি তৈরি হয়নি')

  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files })

  if (canShareFiles) {
    try {
      await navigator.share({ files, text })
      return 'shared'
    } catch (err) {
      // ব্যবহারকারী বাতিল করলে চুপচাপ থামি
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    }
  }

  files.forEach((f) => downloadBlob(f, f.name))
  if (text) shareReportText(text)
  return 'downloaded'
}

/** শুধু টেক্সট (সারসংক্ষেপ) WhatsApp-এ পাঠানো */
export function shareReportText(text: string): void {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
}

export function pdfFileName(prefix: string, from: string, to: string): string {
  return `${prefix}-${from === to ? from : `${from}_${to}`}.pdf`
}
