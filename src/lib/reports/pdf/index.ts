/**
 * রিপোর্ট PDF — public API।
 *
 *   Preview : React HTML (আগের মতোই, কিছু বদলায়নি)
 *   PDF     : native/vector টেক্সট PDF (এই ফোল্ডারের renderer) — ছবি নয়
 *   Share   : HTML → html2canvas → JPEG → Web Share (`imageShare.ts`)
 *
 * jsPDF, fontkit ও বাংলা ফন্ট — তিনটিই শুধু PDF Download চাপলে lazy load হয়
 * (Report Center খোলার সময় কিছুই ডাউনলোড হয় না)।
 */
import type { ReportDocument } from '../core'
import { downloadBlob } from '../../reportExport'
import { NativePdfEngine, type PdfBytes } from './engine'
import { renderReportPdf, type ReportPad, type ReportPdfOptions } from './document'

// শেয়ার = ছবি (PDF থেকে আলাদা পথ)
export { shareSheetImage, sheetImageName } from './imageShare'
export type { SheetShareOptions } from './imageShare'
export type { ReportPad } from './document'

export interface ReportPdfInput {
  /** ফাইল-নাম (`.pdf`) — `sheetFileName` দিয়ে তৈরি */
  filename: string
  pad?: ReportPad
  /** প্যাডে নাম না থাকলে এই নামই ব্যবহৃত হয় */
  businessName?: string
  /** প্যাডের নিচের লাইন (শাখা / সব শাখা) */
  subtitle?: string
  title?: string
  /** টেবিলের আগে অতিরিক্ত তথ্য (রসিদে ব্যবহৃত) */
  details?: { label: string; value: string; strong?: boolean }[]
  /** মালিকের স্বাক্ষরের বদলে অন্য লেখা; `false` দিলে স্বাক্ষর ব্লক থাকবে না */
  signatureLabel?: string | false
  footNote?: string
}

/* ─────────────────────────────────────────────
   ফাইল-নাম (আগের নিয়ম অপরিবর্তিত, সংখ্যা সবসময় ইংরেজিতে)
   ───────────────────────────────────────────── */

/** ফাইল-নাম: sales-report-2026-09-01_2026-09-30.pdf */
export const sheetFileName = (prefix: string, key: string): string => {
  const clean = key
    .replace(/[^0-9A-Za-z_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${prefix}-${clean || 'report'}.pdf`
}

/** profit-loss-2026-09-01_2026-09-30.pdf (লাভ-ক্ষতি পেজের জন্য) */
export const pdfFileName = (prefix: string, from: string, to: string): string =>
  `${prefix}-${from === to ? from : `${from}_${to}`}.pdf`

/* ─────────────────────────────────────────────
   লোগো প্রস্তুতি (SVG হলেও PDF-এ বসতে পারে)
   ───────────────────────────────────────────── */

export interface PreparedLogo {
  dataUrl: string
  aspect: number
}

const logoCache = new Map<string, PreparedLogo | null>()
const LOGO_PIXEL_WIDTH = 600

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('লোগো লোড হয়নি'))
    image.src = src
  })
}

/**
 * লোগোকে PDF-এ বসানোর মতো করে তৈরি করে: আকার (aspect) বের করে, SVG হলে
 * canvas-এ রূপান্তর করে। কোনো কারণে না পারলে `null` — PDF তবু তৈরি হয়, শুধু
 * লোগোটা বাদ যায় (রিপোর্ট আটকে যায় না)।
 */
export async function prepareLogo(logo?: string): Promise<PreparedLogo | null> {
  if (!logo || typeof document === 'undefined') return null
  if (logoCache.has(logo)) return logoCache.get(logo) ?? null
  let prepared: PreparedLogo | null = null
  try {
    const image = await loadImage(logo)
    const width = image.naturalWidth || image.width
    const height = image.naturalHeight || image.height
    if (width && height) {
      // সব লোগোই একবার PNG-তে রূপান্তরিত হয় (SVG-ও) — jsPDF-এ বসানো সহজ ও নিরাপদ
      const scale = Math.min(1, LOGO_PIXEL_WIDTH / Math.max(1, width))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(width * scale))
      canvas.height = Math.max(1, Math.round(height * scale))
      const context = canvas.getContext('2d')
      if (context) {
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        prepared = { dataUrl: canvas.toDataURL('image/png'), aspect: width / height }
      }
    }
  } catch {
    prepared = null
  }
  logoCache.set(logo, prepared)
  return prepared
}

/* ─────────────────────────────────────────────
   PDF তৈরি
   ───────────────────────────────────────────── */

const PDF_ERROR = 'PDF তৈরি করা যায়নি। আবার চেষ্টা করুন।'

/** একটি রিপোর্ট → native PDF (canvas/html2canvas ছাড়া, একই pass-এ) */
export async function buildReportPdf(doc: ReportDocument, input: ReportPdfInput): Promise<PdfBytes> {
  if (!doc || !Array.isArray(doc.columns) || !Array.isArray(doc.rows)) throw new Error(PDF_ERROR)
  if (!doc.title && !input.title) throw new Error(PDF_ERROR)

  const logo = await prepareLogo(input.pad?.logo)
  const pad: ReportPad = {
    ...input.pad,
    name: input.pad?.name?.trim() || input.businessName,
    logo: logo?.dataUrl,
    logoAspect: logo?.aspect,
  }
  const options: ReportPdfOptions = {
    pad,
    subtitle: input.subtitle,
    title: input.title,
    details: input.details,
    signatureLabel: input.signatureLabel,
    footNote: input.footNote,
  }

  const pdf = await NativePdfEngine.create()
  renderReportPdf(pdf, doc, options)
  return pdf.output()
}

/** রিপোর্টের PDF ডাউনলোড — ফাইল-নাম আগের নিয়মেই থাকে */
export async function downloadReportPdf(doc: ReportDocument, input: ReportPdfInput): Promise<void> {
  const bytes = await buildReportPdf(doc, input)
  downloadBlob(bytes.blob, input.filename)
}
