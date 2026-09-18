/**
 * রিপোর্ট এক্সপোর্ট — PDF ডাউনলোড ও WhatsApp শেয়ার (মোবাইল-বান্ধব; প্রিন্ট অপশন নেই).
 *
 * html2canvas + jsPDF dynamic import করা হয়, তাই রিপোর্ট পেজ না খুললে
 * এই ভারী লাইব্রেরিগুলো প্রথম লোডে ডাউনলোড হয় না (বান্ডল হালকা থাকে)।
 */

type Html2Canvas = typeof import('html2canvas').default
type JsPdf = InstanceType<typeof import('jspdf').jsPDF>

const loadHtml2Canvas = async (): Promise<Html2Canvas> => (await import('html2canvas')).default

const loadJsPDF = async () => (await import('jspdf')).jsPDF

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * ক্যাপচারের আগে `data-pdf-expand` দেওয়া স্ক্রল-করা টেবিলগুলো পুরো খুলে দেয়,
 * তারপর আগের অবস্থায় ফিরিয়ে আনে — নইলে PDF-এ কাটা টেবিল আসে।
 * রুট এলিমেন্ট নিজেও data-pdf-expand থাকলে সেটাও খোলে।
 */
async function withExpandedContent<T>(el: HTMLElement, run: () => Promise<T>): Promise<T> {
  const childNodes = Array.from(el.querySelectorAll<HTMLElement>('[data-pdf-expand]'))
  const nodes = el.hasAttribute('data-pdf-expand') ? [el, ...childNodes] : childNodes

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

/** স্ক্রিনে যা দেখা যায় তার পূর্ণ ছবি (লম্বা টেবিলসহ) */
export async function captureReport(el: HTMLElement, timeoutMs = 15000): Promise<HTMLCanvasElement> {
  const html2canvas = await withTimeout(loadHtml2Canvas(), 8000, 'PDF লাইব্রেরি লোড হয়নি, আবার চেষ্টা করুন')

  // width খুব বড় হলে html2canvas হ্যাং করে — ১২০০px-এ সীমাবদ্ধ
  const rawWidth = Math.max(el.scrollWidth, el.clientWidth || 0, 320)
  const width = Math.min(1200, rawWidth)
  const scale = rawWidth > 900 ? 1.5 : 2 // বড় রিপোর্টে scale কমিয়ে মেমোরি বাঁচানো

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

export async function downloadReportPdf(el: HTMLElement, filename: string): Promise<void> {
  const canvas = await captureReport(el)
  const pdf = await canvasToPdf(canvas)
  pdf.save(filename)
}

/** আগেই ক্যাপচার করা ক্যানভাস থেকে PDF (যেমন রসিদ) */
export async function downloadCanvasPdf(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const pdf = await canvasToPdf(canvas)
  pdf.save(filename)
}

/**
 * মোবাইলে PDF ফাইলটা সরাসরি WhatsApp/Share-এ পাঠানোর চেষ্টা করে
 * (Web Share API)। সাপোর্ট না থাকলে PDF ডাউনলোড + wa.me টেক্সট খোলে।
 */
export async function shareReportPdf(
  el: HTMLElement,
  filename: string,
  text: string,
): Promise<'shared' | 'downloaded'> {
  const canvas = await captureReport(el)
  const pdf = await canvasToPdf(canvas)
  const blob = pdf.output('blob') as Blob
  const file = new File([blob], filename, { type: 'application/pdf' })
  const canShareFile =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })

  if (canShareFile) {
    try {
      await navigator.share({ files: [file], text })
      return 'shared'
    } catch (err) {
      // ব্যবহারকারী বাতিল করলে চুপচাপ থামি
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared'
    }
  }

  pdf.save(filename)
  shareReportText(text)
  return 'downloaded'
}

/** শুধু টেক্সট (সারসংক্ষেপ) WhatsApp-এ পাঠানো */
export function shareReportText(text: string): void {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
}

export function pdfFileName(prefix: string, from: string, to: string): string {
  return `${prefix}-${from === to ? from : `${from}_${to}`}.pdf`
}
