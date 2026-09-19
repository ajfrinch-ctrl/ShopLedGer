/**
 * রিপোর্টের ছবি — html2canvas capture ও শেয়ার (PDF-এর সঙ্গে কোনো সম্পর্ক নেই)।
 *
 * এখানে শুধু:
 *   • স্ক্রিনের রিপোর্ট/রসিদ → Canvas (html2canvas)
 *   • ছবি ডাউনলোড (PNG/JPEG)
 *   • ছবি শেয়ার → Web Share API (WhatsApp); সাপোর্ট না থাকলে ডাউনলোড + wa.me
 *
 * PDF এখন native/vector টেক্সট হিসেবে তৈরি হয় (`lib/reports/pdf`) — সেই পথে
 * html2canvas, canvas বা JPEG ব্যবহার হয় না; শেয়ারের পথে jsPDF ব্যবহার হয় না।
 */

type Html2Canvas = typeof import('html2canvas').default

const loadHtml2Canvas = async (): Promise<Html2Canvas> => (await import('html2canvas')).default

/**
 * ক্যাপচারের আগে `data-pdf-expand` দেওয়া স্ক্রল-করা টেবিলগুলো পুরো খুলে দেয়,
 * তারপর আগের অবস্থায় ফিরিয়ে আনে — নইলে ছবিতে কাটা টেবিল আসে।
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
   * মোবাইলে প্রিভিউ স্ক্রিনের প্রস্থে দেখানো হয়, কিন্তু ছবি A4-র সমান চওড়া চাই —
   * তাই ক্যাপচারের সময়ই এলিমেন্টটিকে নির্দিষ্ট প্রস্থে বসানো হয় (স্ক্রিনে কিছুই
   * বদলায় না, ক্যাপচার শেষে আগের অবস্থায় ফিরে যায়)।
   */
  const fixedWidth = Number(el.getAttribute('data-pdf-width') || '')
  if (Number.isFinite(fixedWidth) && fixedWidth > 0) {
    el.style.width = `${fixedWidth}px`
    el.style.minWidth = `${fixedWidth}px`
    el.style.maxWidth = 'none'
  }

  try {
    if (document.fonts?.ready) {
      // ফন্ট লোডে আটকে থাকলে ২ সেকেন্ড পর এগিয়ে যাই — নইলে শেয়ার লোডিংয়ে আটকে থাকে
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

interface CaptureOptions {
  /** html2canvas scale — না দিলে এলিমেন্টের আকার/লম্বা অনুযায়ী নিজেই ঠিক করে নেয় */
  scale?: number
}

/**
 * ক্যানভাস কত পিক্সেলের হলে নিরাপদ — বড় রিপোর্টে scale কমিয়ে
 * মোবাইল ব্রাউজারে ক্যানভাস-লিমিট ছাড়িয়ে ছবি ফাঁকা হয়ে যাওয়া আটকায়।
 */
const captureScaleFor = (el: HTMLElement, maxPixels = 12_000_000): number => {
  const w = Math.max(el.scrollWidth || el.clientWidth || 320, 320)
  const h = Math.max(el.scrollHeight || el.clientHeight || 400, 200)
  const byArea = Math.sqrt(maxPixels / (w * h))
  return Math.max(0.8, Math.min(2, Number.isFinite(byArea) ? byArea : 2))
}

/** স্ক্রিনে যা দেখা যায় তার পূর্ণ ছবি (লম্বা টেবিলসহ) — শেয়ার/ছবি ডাউনলোডের জন্য */
export async function captureReport(
  el: HTMLElement,
  timeoutMs = 15000,
  opts: CaptureOptions = {},
): Promise<HTMLCanvasElement> {
  const html2canvas = await withTimeout(loadHtml2Canvas(), 8000, 'ছবি তৈরির লাইব্রেরি লোড হয়নি, আবার চেষ্টা করুন')

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
      onclone: (doc) => {
        doc.querySelectorAll<HTMLElement>('[data-pdf-expand]').forEach((n) => {
          n.style.overflow = 'visible'
          n.style.maxHeight = 'none'
        })
      },
    }),
  )

  return withTimeout(task, timeoutMs, 'ছবি তৈরি করতে সময় শেষ হয়েছে, আবার চেষ্টা করুন')
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

/** ক্যানভাস → PNG ছবি ডাউনলোড (রসিদের "ছবি ডাউনলোড" বোতাম) */
export async function downloadCanvasImage(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('ছবি তৈরি হয়নি'))), 'image/png'),
  )
  downloadBlob(blob, filename)
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
