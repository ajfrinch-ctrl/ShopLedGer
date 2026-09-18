/**
 * রিপোর্ট এক্সপোর্ট — PDF ডাউনলোড, প্রিন্ট ও WhatsApp শেয়ার।
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
 */
async function withExpandedContent<T>(el: HTMLElement, run: () => Promise<T>): Promise<T> {
  const nodes = Array.from(el.querySelectorAll<HTMLElement>('[data-pdf-expand]'))
  const previous = nodes.map((n) => n.getAttribute('style'))
  nodes.forEach((n) => {
    n.style.overflow = 'visible'
    n.style.maxHeight = 'none'
    n.style.width = 'max-content'
    n.style.maxWidth = 'none'
  })
  try {
    if (document.fonts?.ready) await document.fonts.ready
    return await run()
  } finally {
    nodes.forEach((n, i) => {
      if (previous[i] === null) n.removeAttribute('style')
      else n.setAttribute('style', previous[i] as string)
    })
  }
}

/** স্ক্রিনে যা দেখা যায় তার পূর্ণ ছবি (লম্বা টেবিলসহ) */
export async function captureReport(el: HTMLElement): Promise<HTMLCanvasElement> {
  const html2canvas = await loadHtml2Canvas()
  const width = Math.max(el.scrollWidth, document.documentElement.clientWidth)
  return withExpandedContent(el, () =>
    html2canvas(el, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      windowWidth: width + 32,
    }),
  )
}

/** multipage A4 PDF — লম্বা রিপোর্ট কেটে যায় না, নতুন পেজে যায় */
export async function canvasToPdf(canvas: HTMLCanvasElement): Promise<JsPdf> {
  const JsPDF = await loadJsPDF()
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
  const ctx = slice.getContext('2d')!

  for (let y = 0, page = 0; y < canvas.height; y += sliceHeight, page++) {
    const h = Math.min(sliceHeight, canvas.height - y)
    slice.height = h
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, h)
    ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h)
    if (page > 0) pdf.addPage()
    pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', margin, margin, imageWidth, h / pxPerMm)
  }
  return pdf
}

export async function downloadReportPdf(el: HTMLElement, filename: string): Promise<void> {
  const pdf = await canvasToPdf(await captureReport(el))
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
  const pdf = await canvasToPdf(await captureReport(el))
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

/**
 * প্রিন্ট — অ্যাপের স্টাইলশিট কপি করে নতুন উইন্ডোতে রিপোর্ট ছাপে,
 * তাই অফলাইনেও বাংলা ফন্ট/লেআউট ঠিক থাকে।
 */
export function printReport(el: HTMLElement, title: string): boolean {
  const win = window.open('', '_blank')
  if (!win) return false

  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((n) => n.outerHTML)
    .join('\n')

  const clone = el.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[data-no-print]').forEach((n) => n.remove())

  win.document.write(`<!doctype html>
<html lang="bn">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    ${styles}
    <style>
      @page { size: A4; margin: 10mm; }
      body { background: #fff; margin: 0; padding: 0; }
      [data-no-print] { display: none !important; }
      [data-pdf-expand] { overflow: visible !important; max-height: none !important; }
      .card { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    </style>
  </head>
  <body>${clone.outerHTML}</body>
</html>`)
  win.document.close()

  const go = () => {
    win.focus()
    win.print()
  }
  // স্টাইল লোড হওয়ার আগে প্রিন্ট ডায়ালগ খুললে ফরম্যাট নষ্ট হয় — তাই অপেক্ষা
  if (win.document.readyState === 'complete') setTimeout(go, 350)
  else win.addEventListener('load', () => setTimeout(go, 350))
  return true
}

export function pdfFileName(prefix: string, from: string, to: string): string {
  return `${prefix}-${from === to ? from : `${from}_${to}`}.pdf`
}
