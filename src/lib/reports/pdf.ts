import { captureReport } from '../reportExport'
import type { ReportDocument } from './core'

const loadJsPDF = async () => (await import('jspdf')).jsPDF

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const CSS = `
  * { box-sizing: border-box; }
  body {
    font-family: 'Noto Sans Bengali', system-ui, -apple-system, 'Segoe UI', sans-serif;
    color: #111827;
    margin: 0;
    padding: 0;
    background: #fff;
  }
  .sheet { width: 190mm; margin: 0 auto; }
  .rpt-header { border-bottom: 2px solid #0f766e; padding-bottom: 6px; margin-bottom: 10px; }
  .rpt-shop { font-size: 17px; font-weight: 700; color: #0f766e; }
  .rpt-title { font-size: 13px; font-weight: 600; margin-top: 1px; }
  .rpt-meta { font-size: 10px; color: #4b5563; margin-top: 3px; }
  .rpt-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 10px;
    border: 1px solid #e5e7eb;
    border-radius: 5px;
    padding: 6px 8px;
  }
  .rpt-summary div { min-width: 32mm; font-size: 10px; }
  .rpt-summary span { color: #6b7280; }
  .rpt-summary b { display: block; font-size: 11.5px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th {
    background: #0f766e;
    color: #fff;
    font-size: 9.5px;
    font-weight: 600;
    padding: 4px 5px;
    text-align: right;
    border: 1px solid #0f766e;
  }
  th.left, td.left { text-align: left; }
  td {
    font-size: 9.5px;
    padding: 4px 5px;
    text-align: right;
    border: 1px solid #e5e7eb;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }
  tbody tr:nth-child(even) td { background: #f9fafb; }
  tr.emphasis td { font-weight: 700; background: #f0fdfa !important; }
  tfoot td { font-weight: 700; background: #ecfdf5; border-top: 1.5px solid #0f766e; }
  .rpt-total-label { text-align: right; }
  .rpt-notes { margin-top: 8px; font-size: 9px; color: #6b7280; }
  .rpt-notes p { margin: 2px 0; }
  .rpt-empty { padding: 18px; text-align: center; color: #6b7280; font-size: 11px; border: 1px dashed #d1d5db; border-radius: 6px; }
  .rpt-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    font-size: 8.5px;
    color: #6b7280;
    display: flex;
    justify-content: space-between;
    border-top: 1px solid #e5e7eb;
    padding-top: 3px;
  }
  .rpt-page-num::after { content: counter(page) " / " counter(pages); }
  .rpt-controls { display: flex; gap: 8px; justify-content: flex-end; padding: 0 0 10px; }
  .rpt-controls button { font-family: inherit; font-size: 12px; padding: 6px 14px; border-radius: 6px; border: 1px solid #0f766e; background: #0f766e; color: #fff; cursor: pointer; }
  .rpt-controls button.close { background: #fff; color: #0f766e; }
  @page { size: A4 portrait; margin: 10mm; }
  @media print {
    .rpt-controls { display: none !important; }
    th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tr { page-break-inside: avoid; }
  }
`

function tableHtml(report: ReportDocument): string {
  if (!report.rows.length) return '<div class="rpt-empty">নির্বাচিত ফিল্টারে কোনো তথ্য পাওয়া যায়নি।</div>'
  const cols = report.columns
  const head = cols
    .map(
      (c) =>
        `<th class="${c.align === 'right' || !c.align ? '' : 'left'}"${c.width ? ` style="width:${c.width}"` : ''}>${escape(c.label)}</th>`,
    )
    .join('')

  // প্রথম কলাম সাধারণত string (নাম/তারিখ/পণ্য) — সেটা বাঁয়ে, বাকিগুলো ডানে
  const body = report.rows
    .map((r) => {
      const tds = cols
        .map((c, i) => {
          const align = c.align ? c.align : i === 0 ? 'left' : 'right'
          return `<td class="${align === 'left' ? 'left' : ''}">${escape(r.cells[i] ?? '')}</td>`
        })
        .join('')
      return `<tr${r.emphasis ? ' class="emphasis"' : ''}>${tds}</tr>`
    })
    .join('')

  const total = report.totals
    ? `<tfoot><tr>${report.totals
        .map((cell, i) => {
          if (i === 0) return `<td class="rpt-total-label">${escape(cell)}</td>`
          return `<td>${escape(cell)}</td>`
        })
        .join('')}</tr></tfoot>`
    : ''

  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${total}</table>`
}

/**
 * একটা সম্পূর্ণ রিপোর্টের নিজস্ব A4 ডকুমেন্ট (সব বাংলা)।
 * নিজস্ব উইন্ডোতে ছাপা/সেভ হয়, তাই অন্য রিপোর্টের সাথে মিশে যায় না।
 */
export function reportHtml(opts: {
  report: ReportDocument
  businessName: string
  subtitle?: string
  /** নতুন ট্যাবে খুললে সাথে সাথে প্রিন্ট ডায়ালগ দেখাবে */
  autoPrint?: boolean
}): string {
  const { report, businessName, subtitle, autoPrint = true } = opts

  const summary = report.summary
    .map(
      (s) =>
        `<div><span>${escape(s.label)}</span><b>${escape(s.value)}</b></div>`,
    )
    .join('')

  return `<!doctype html>
<html lang="bn">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escape(report.title)} — ${escape(report.period)}</title>
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;600;700&display=swap" rel="stylesheet" />
    <style>${CSS}</style>
  </head>
  <body>
    <div class="rpt-controls">
      <button type="button" id="rpt-print">প্রিন্ট</button>
      <button type="button" class="close" id="rpt-close">বন্ধ করুন</button>
    </div>
    <div class="sheet">
      <div class="rpt-header">
        <div class="rpt-shop">${escape(businessName)}</div>
        <div class="rpt-title">${escape(report.title)}</div>
        <div class="rpt-meta">
          সময়: ${escape(report.period)}
          ${subtitle ? ` • ${escape(subtitle)}` : ''}
          ${report.filterNote ? `<br />ফিল্টার: ${escape(report.filterNote)}` : ''}
        </div>
      </div>
      ${summary ? `<div class="rpt-summary">${summary}</div>` : ''}
      ${tableHtml(report)}
      ${
        report.notes?.length
          ? `<div class="rpt-notes">${report.notes.map((n) => `<p>• ${escape(n)}</p>`).join('')}</div>`
          : ''
      }
    </div>
    <div class="rpt-footer">
      <span>${escape(businessName)} • ShopLedGer দিয়ে তৈরি</span>
      <span>তৈরি: ${escape(new Date().toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' }))}</span>
      <span>পৃষ্ঠা <span class="rpt-page-num"></span></span>
    </div>
    <script>
      document.getElementById('rpt-print').addEventListener('click', function () { window.print(); });
      document.getElementById('rpt-close').addEventListener('click', function () { window.close(); });
      ${autoPrint ? `window.addEventListener('load', function () {
        var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
        fonts.then(function () { setTimeout(function () { window.print(); }, 300); });
      });` : ''}
    </script>
  </body>
</html>`
}

/**
 * একটি রিপোর্ট = একটি উইন্ডো = একটি PDF/প্রিন্ট।
 * উইন্ডো রেফারেন্স ফেরত দেয় (পপ-আপ ব্লক হলে null — তখন স্ট্যাটাস মেসেজ দেখান)।
 */
export function openReportPdf(opts: {
  report: ReportDocument
  businessName: string
  subtitle?: string
}): Window | null {
  const win = window.open('', '_blank')
  if (!win) return null
  win.document.write(reportHtml(opts))
  win.document.close()
  return win
}

/* ═════════════════════════════════════════════
   A4 PDF ফাইল তৈরি (পপ-আপ ছাড়াই) — পেজ নম্বর ও ফুটারসহ
   ═════════════════════════════════════════════ */

export interface SheetPdfOptions {
  filename: string
  /** ফুটারের বাঁয়ে (সাধারণত ব্যবসার নাম) */
  footerLeft: string
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
  const JsPDF = await loadJsPDF()
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

    // ফুটার: ব্যবসার নাম • তৈরি সময় • পেজ নম্বর
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
    ctx.fillText(`${opts.footerLeft} • ShopLedGer`, 0, textY)
    ctx.textAlign = 'center'
    ctx.fillText(createdLabel, slice.width / 2, textY)
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
