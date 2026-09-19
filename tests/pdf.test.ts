/**
 * Native PDF ইঞ্জিনের টেস্ট — সব ১০টি রিপোর্ট, খালি/ছোট/বহু-পৃষ্ঠার রিপোর্ট,
 * বাংলা+ইংরেজি মিশ্রণ, লম্বা নাম, বড় অঙ্ক, পৃষ্ঠা নম্বর, হেডার পুনরাবৃত্তি।
 *
 * PDF থেকে টেক্সট সত্যিকারের extractor (pdf.js) দিয়ে পড়া হয় — অর্থাৎ যা যাচাই
 * হয় তা ঠিক তাই, যা একটি PDF viewer-এ select/copy/search করা যায়:
 *   • PDF-এ কোনো ছবি (image XObject) নেই — screenshot/JPEG নয়
 *   • বাংলা ফন্ট PDF-এর ভিতরে embed হয়েছে
 *   • টেক্সট হুবহু Unicode হিসেবে বেরোয় (যুক্তবর্ণসহ), হেডার প্রতি পৃষ্ঠায় আসে
 *   • সর্বমোট/নোট/স্বাক্ষর শেষ পৃষ্ঠায়, পৃষ্ঠা নম্বর "পৃষ্ঠা ১ / ৩"
 *   • লম্বা নাম কাটা পড়ে না, খালি রিপোর্টেও PDF তৈরি হয়
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { inflateSync } from 'node:zlib'
import { buildReport } from '../src/lib/reports/builders'
import { REPORT_CATALOG, type ReportData, type ReportKind } from '../src/lib/reports/core'
import { BengaliShaper } from '../src/lib/reports/pdf/bengali'
import { buildReportPdf, sheetFileName } from '../src/lib/reports/pdf'
import type { Product, Purchase, Sale, StockAdjustment } from '../src/types'
import type { DbBranch, DbCollection, DbCustomer, DbExpense, DbUser, LedgerEntry } from '../src/lib/db'

const require = createRequire(import.meta.url)

/* ── ব্রাউজার ছাড়া ফন্ট পড়ার ব্যবস্থা (টেস্টের জন্য) ── */
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: string | URL | Request) => {
  const url = String(input)
  const at = url.indexOf('/fonts/')
  if (at >= 0) {
    const bytes = readFileSync(`public${url.slice(at)}`)
    return {
      ok: true,
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    } as unknown as Response
  }
  return realFetch(input as never)
}) as typeof fetch

/* ── সত্যিকারের টেক্সট extraction (একই লাইব্রেরি যা PDF viewer-এ চলে) ── */
interface ExtractedPage {
  text: string
  hasImage: boolean
}
interface ExtractedPdf {
  pages: ExtractedPage[]
  raw: string
}

const standardFontsDir = `${require.resolve('pdfjs-dist/package.json').replace(/package\.json$/, '')}standard_fonts/`

async function extractPdf(bytes: ArrayBuffer): Promise<ExtractedPdf> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(bytes.slice(0))
  const document = await pdfjs.getDocument({
    data,
    useSystemFonts: false,
    disableFontFace: true,
    standardFontDataUrl: standardFontsDir,
  }).promise
  const pages: ExtractedPage[] = []
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number)
    const content = await page.getTextContent()
    const operators = await page.getOperatorList()
    pages.push({
      text: content.items.map((item: { str?: string }) => item.str ?? '').join(''),
      hasImage: operators.fnArray.includes(pdfjs.OPS.paintImageXObject) ||
        operators.fnArray.includes(pdfjs.OPS.paintInlineImageXObject),
    })
  }
  // কাঁচা ফাইল: ছবি/ফন্ট embed হয়েছে কি না দেখতে (streams চাপা থাকলে খুলে দেখা হয়)
  pages.forEach((page) => { page.text = page.text.replace(/\u200b/g, '') })
  const extracted: ExtractedPdf = { pages, raw: decompressAll(bytes) }
  return extracted
}

/** সব FlateDecode stream খুলে একসাথে — ফন্ট/ছবির চিহ্ন খুঁজতে */
function decompressAll(bytes: ArrayBuffer): string {
  const raw = Buffer.from(bytes).toString('latin1')
  let out = raw
  const pattern = /(\d+) 0 obj\s*<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(raw))) {
    if (!/FlateDecode/.test(match[2])) continue
    try {
      out += inflateSync(Buffer.from(match[3], 'latin1')).toString('latin1')
    } catch {
      /* খোলা না গেলে বাদ */
    }
  }
  return out
}

/* ── ডেটা ── */

const product = (o: Partial<Product> = {}): Product => ({
  id: 'p1', name: 'সয়াবিন তেল', unit: 'লিটার', opening_stock: 20, purchase_price: 100,
  sale_price: 120, branch_id: 'a', created_at: '', updated_at: '', ...o,
})
const sale = (o: Partial<Sale> = {}): Sale => ({
  id: 's1', date: '2026-09-18', items: [], total_amount: 1200, total_profit: 200,
  payment_type: 'নগদ', branch_id: 'a', created_by: 'u1', created_at: '', ...o,
})
const item = (o: Partial<Sale['items'][number]> = {}): Sale['items'][number] => ({
  product_id: 'p1', product_name: 'সয়াবিন তেল', quantity: 10, unit: 'লিটার',
  sale_price: 120, purchase_price: 100, total: 1200, profit: 200, ...o,
})
const purchase = (o: Partial<Purchase> = {}): Purchase => ({
  id: 'pu1', date: '2026-09-05', product_id: 'p1', product_name: 'সয়াবিন তেল', quantity: 50,
  unit: 'লিটার', purchase_price: 100, total: 5000, supplier: 'রহিম ট্রেডার্স', payment_type: 'নগদ',
  branch_id: 'a', created_at: '', ...o,
})
const expense = (o: Partial<DbExpense> = {}): DbExpense => ({
  id: 'e1', date: '2026-09-18', category: 'ভাড়া', amount: 500, kind: 'shop',
  branch_id: 'a', note: 'সেপ্টেম্বরের ভাড়া', created_at: '', ...o,
})
const entry = (o: Partial<LedgerEntry> = {}): LedgerEntry => ({
  id: 'le1', party_id: 'c1', party_name: 'ক্রেতা করিম', party_type: 'customer', kind: 'payment',
  amount: 400, date: '2026-09-15', branch_id: 'a', method: 'বিকাশ', reference: '', note: '',
  cancelled: false, created_at: '', created_by: 'u1', ...o,
})
const customer = (o: Partial<DbCustomer> = {}): DbCustomer => ({
  id: 'c1', name: 'ক্রেতা করিম', phone: '01700000000', branch_id: 'a', created_at: '', ...o,
})
const adjustment = (o: Partial<StockAdjustment> = {}): StockAdjustment => ({
  id: 'adj1', date: '2026-09-10', product_id: 'p1', product_name: 'সয়াবিন তেল', quantity: -2,
  unit: 'লিটার', reason: 'নষ্ট', branch_id: 'a', created_by: 'u1', created_at: '', ...o,
})
const collection = (o: Partial<DbCollection> = {}): DbCollection => ({
  id: 'col1', date: '2026-09-16', customer_id: 'c1', customer_name: 'ক্রেতা করিম', amount: 300,
  payment_method: 'বিকাশ', branch_id: 'a', created_at: '', ...o,
})
const branch = (o: Partial<DbBranch> = {}): DbBranch => ({
  id: 'a', name: 'প্রধান শাখা', organization: 'কর্ণফুলী সেলস সেন্টার', is_active: true, created_at: '', ...o,
})
const user = (o: Partial<DbUser> = {}): DbUser => ({
  id: 'u1', name: 'কর্মচারী রহিম', phone: '017', password_hash: '', role: 'staff',
  branch_id: 'a', is_active: true, created_at: '', updated_at: '', ...o,
})

const LONG_NAME = 'মোছাম্মৎ রেহেনা বেগম চৌধুরানী — চট্টগ্রাম শহরের আগ্রাবাদ এলাকার বাসিন্দা'
const LONG_PRODUCT = 'গবাদি পশুর খাদ্য — ড্রাগন ফিড ২৫ কেজি ব্যাগ (গরু মোটাতাজাকরণ)'

/** সব ১০টি রিপোর্টের ছোট ডেটাসেট */
function smallData(): ReportData {
  return {
    sales: [
      sale({ id: 's1', items: [item({})], total_amount: 1200, total_profit: 200 }),
      sale({
        id: 's2', date: '2026-09-12', payment_type: 'বাকি', customer_id: 'c1', customer_name: LONG_NAME,
        items: [item({ quantity: 5, total: 600, profit: 100, product_name: LONG_PRODUCT })],
        total_amount: 600, total_profit: 100,
      }),
    ],
    purchases: [purchase({})],
    products: [product({}), product({ id: 'p2', name: 'চাল', unit: 'কেজি', opening_stock: 20, purchase_price: 60, sale_price: 75 })],
    adjustments: [adjustment({})],
    expenses: [expense({}), expense({ id: 'e2', category: 'সংসার খরচ', kind: 'owner', amount: 3000, note: '' })],
    entries: [entry({}), entry({ id: 'le2', kind: 'opening', amount: 2000, date: '2026-09-01', method: 'নগদ টাকা' })],
    collections: [collection({})],
    customers: [customer({}), customer({ id: 'c2', name: LONG_NAME, phone: '01800000000' })],
    branches: [branch({}), branch({ id: 'b', name: 'দ্বিতীয় শাখা' })],
    users: [user({})],
  }
}

/** ২৫০+ সারির বড় ডেটাসেট (বহু-পৃষ্ঠার PDF, হেডার পুনরাবৃত্তি, বড় অঙ্ক) */
function bigData(): ReportData {
  const data = smallData()
  data.sales = Array.from({ length: 260 }, (_, i) => sale({
    id: `s${i}`,
    date: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`,
    payment_type: i % 2 ? 'বাকি' : 'নগদ',
    customer_id: 'c1',
    customer_name: i % 3 === 0 ? LONG_NAME : 'ক্রেতা করিম',
    items: [item({
      product_name: i % 4 === 0 ? LONG_PRODUCT : 'সয়াবিন তেল',
      quantity: (i % 40) + 1,
      total: 120000 + i * 913,
    })],
    total_amount: 120000 + i * 913,
    total_profit: 20000,
  }))
  return data
}

const inputFor = (kind: ReportKind, scope = { branchId: 'a' }) => ({
  from: '2026-09-01', to: '2026-09-30', month: '2026-09', scope, kind,
})

const buildFor = (kind: ReportKind, data: ReportData, scope = { branchId: 'a' }) =>
  buildReport(kind, inputFor(kind, scope) as never, data)

const PAD = {
  name: 'কর্ণফুলী সেলস সেন্টার',
  address: '১৫/এ, আগ্রাবাদ, চট্টগ্রাম',
  phone: '01800000000',
  branchName: 'প্রধান শাখা',
}

async function pdfFor(kind: ReportKind, data: ReportData) {
  const doc = buildFor(kind, data)
  const bytes = await buildReportPdf(doc, {
    filename: sheetFileName(`${kind}-report`, '2026-09-01_2026-09-30'),
    pad: PAD, businessName: PAD.name, subtitle: 'প্রধান শাখা',
  })
  return { doc, bytes, pdf: await extractPdf(bytes.buffer) }
}

/* ── টেস্ট ── */

test('সব ১০টি রিপোর্টের PDF: ছবি নেই, বাংলা ফন্ট embed করা, টেক্সট select/search করা যায়', async () => {
  assert.equal(REPORT_CATALOG.length, 10)
  for (const definition of REPORT_CATALOG) {
    const { doc, bytes, pdf } = await pdfFor(definition.kind, smallData())
    const label = `${definition.kind}: `
    assert.ok(bytes.size > 4000, `${label}PDF খুব ছোট`)
    assert.equal(pdf.raw.includes('/Subtype /Image'), false, `${label}PDF-এ ছবি (screenshot) ঢুকেছে`)
    assert.ok(pdf.pages.every((page) => page.hasImage === false), `${label}পৃষ্ঠায় ছবি আঁকা হয়েছে`)
    assert.ok(/\/BaseFont \/SLBengali/.test(pdf.raw), `${label}বাংলা ফন্ট embed হয়নি`)
    assert.ok((pdf.raw.match(/\/FontFile2/g) || []).length >= 2, `${label}বাংলা ফন্ট ফাইল নেই`)
    assert.equal(pdf.pages.length, 1, `${label}ছোট রিপোর্ট এক পৃষ্ঠার হওয়া উচিত`)

    const text = pdf.pages[0].text
    assert.ok(text.includes(doc.title), `${label}শিরোনাম extract হচ্ছে না`)
    assert.ok(text.includes(PAD.name), `${label}প্রতিষ্ঠানের নাম extract হচ্ছে না`)
    assert.ok(text.includes('প্রধান শাখা'), `${label}শাখার নাম extract হচ্ছে না`)
    assert.ok(text.includes('১৫/এ, আগ্রাবাদ, চট্টগ্রাম'), `${label}ঠিকানা extract হচ্ছে না`)
    assert.ok(text.includes('01800000000'), `${label}ফোন extract হচ্ছে না`)
    assert.ok(text.includes('পৃষ্ঠা ১ / ১'), `${label}পৃষ্ঠা নম্বর extract হচ্ছে না`)
    assert.ok(text.includes('তৈরি:'), `${label}তৈরির সময় extract হচ্ছে না`)
    for (const column of doc.columns) {
      assert.ok(text.includes(column.label), `${label}"${column.label}" শিরোনাম extract হচ্ছে না`)
    }
  }
})

test('টেক্সট layer হুবহু Unicode — যুক্তবর্ণ, টাকা, ইংরেজি মিশ্রণ সবই', async () => {
  const data = smallData()
  const { pdf } = await pdfFor('sales', data)
  const text = pdf.pages[0].text
  // যুক্তবর্ণ ভাঙা পড়ে না, বাংলা সংখ্যা/৳ অটুট, ইংরেজি অক্ষরও থাকে
  for (const token of ['বিক্রি রিপোর্ট', 'সয়াবিন তেল', 'সময়:', '৳ ১,২০০']) {
    assert.ok(text.includes(token), `"${token}" extract হচ্ছে না`)
  }
  // ফিল্টার নোট থাকলে সেটিও হুবহু আসে
  const filtered = buildReport('sales', {
    ...inputFor('sales'),
    paymentType: 'বাকি',
    customerId: 'c1',
  } as never, smallData())
  assert.ok(filtered.filterNote, 'ফিল্টার নোট প্রত্যাশিত')
  const bytes = await buildReportPdf(filtered, { filename: 'sales-report-filtered.pdf', pad: PAD })
  const extracted = await extractPdf(bytes.buffer)
  assert.ok(extracted.pages[0].text.includes(`ফিল্টার: ${filtered.filterNote}`), 'ফিল্টার নোট extract হচ্ছে না')

  // দুই লাইনে ভাঙা হেডার একবারই extract হয় (দুই লাইনের জন্য দুবার নয়)
  const wrapped = 'ছাড় / সমন্বয়'
  const occurrences = text.split(wrapped).length - 1
  assert.ok(occurrences >= 1, `হেডারের লেখা extract হচ্ছে না: ${wrapped}`)
  assert.equal(occurrences, 1, `হেডারের লেখা ${occurrences} বার extract হয়েছে`)

  // বাংলা দাঁড়ি (।) সহ পুরো নোট extract হয় — যুক্তবর্ণ/গাণিতিক চিহ্ন অটুট
  const stock = await pdfFor('stock', smallData())
  const note = stock.doc.notes![0]
  assert.ok(note.includes('।'), 'স্টক রিপোর্টের নোটে দাঁড়ি থাকা উচিত')
  assert.ok(stock.pdf.pages[0].text.includes(note), `নোট extract হচ্ছে না: ${note}`)
})

test('খালি রিপোর্টেও PDF তৈরি হয় — ছবি ছাড়া, বাংলা বার্তা সহ', async () => {
  const doc = buildFor('sales', smallData(), { branchId: 'বি-নেই' })
  assert.equal(doc.rows.length, 0)
  const bytes = await buildReportPdf(doc, { filename: 'sales-report-empty.pdf', pad: PAD })
  const pdf = await extractPdf(bytes.buffer)
  assert.equal(pdf.raw.includes('/Subtype /Image'), false)
  assert.equal(pdf.pages.length, 1)
  assert.ok(pdf.pages[0].text.includes('নির্বাচিত ফিল্টারে কোনো তথ্য পাওয়া যায়নি।'))
  assert.ok(pdf.pages[0].text.includes('পৃষ্ঠা ১ / ১'))
})

test('২৫০+ সারি ⇒ বহু পৃষ্ঠা; হেডার প্রতি পৃষ্ঠায়, সর্বমোট/স্বাক্ষর শেষ পৃষ্ঠায়', async () => {
  const { doc, pdf } = await pdfFor('sales', bigData())
  assert.ok(doc.rows.length > 250, 'ডেটাসেটে ২৫০+ সারি থাকা উচিত')
  assert.ok(pdf.pages.length >= 3, `বহু পৃষ্ঠা প্রত্যাশিত, পাওয়া গেল ${pdf.pages.length}`)

  pdf.pages.forEach((page, index) => {
    for (const column of doc.columns) {
      assert.ok(page.text.includes(column.label), `পৃষ্ঠা ${index + 1}-এ "${column.label}" হেডার নেই`)
    }
    const expected = `পৃষ্ঠা ${(index + 1).toLocaleString('bn-BD')} / ${pdf.pages.length.toLocaleString('bn-BD')}`
    assert.ok(page.text.includes(expected), `পৃষ্ঠা ${index + 1}-এ "${expected}" নেই`)
  })

  const totals = doc.totals!
  const totalPages = pdf.pages.filter((page) => page.text.includes(totals[0])).length
  assert.equal(totalPages, 1, 'সর্বমোট একবারই দেখানো উচিত')
  assert.ok(pdf.pages[pdf.pages.length - 1].text.includes(totals[0]), 'সর্বমোট শেষ পৃষ্ঠায় থাকা উচিত')
  assert.ok(pdf.pages[pdf.pages.length - 1].text.includes('সর্বমোট'))

  const signaturePages = pdf.pages.filter((page) => page.text.includes('মালিকের স্বাক্ষর'))
  assert.equal(signaturePages.length, 1, 'স্বাক্ষর কেবল শেষ পৃষ্ঠায় থাকা উচিত')
  assert.ok(pdf.pages[pdf.pages.length - 1].text.includes('মালিকের স্বাক্ষর'))
})

test('লম্বা ক্রেতা/পণ্যের নাম কাটা পড়ে না — পুরোটাই PDF-এ থাকে', async () => {
  const data = smallData()
  const { pdf } = await pdfFor('sales', data)
  const text = pdf.pages[0].text
  assert.ok(text.includes(LONG_NAME), 'লম্বা ক্রেতার নাম কাটা পড়েছে')
  assert.ok(text.includes(LONG_PRODUCT), 'লম্বা পণ্যের নাম কাটা পড়েছে')
  assert.ok(!text.includes('…'), 'টেবিলের কোনো লেখা "…" হয়ে কাটা পড়েছে')
})

test('রিপোর্টের হিসাব ও PDF — দুটো একই সংখ্যা দেয়, হিসাব অপরিবর্তিত', async () => {
  const data = smallData()
  const before = buildFor('sales', data)
  const { doc, pdf } = await pdfFor('sales', data)
  assert.deepEqual(doc.rows, before.rows)
  assert.deepEqual(doc.totals, before.totals)
  assert.deepEqual(doc.notes, before.notes)
  // টেবিলের প্রতিটি ঘর PDF-এর টেক্সটে আছে
  for (const row of doc.rows) {
    for (const cell of row.cells) {
      if (!cell) continue
      assert.ok(pdf.pages[0].text.includes(cell), `PDF-এ "${cell}" নেই`)
    }
  }
})

test('PDF দ্রুত তৈরি হয় (২৫০+ সারি, এক pass, ছবি capture ছাড়া)', async () => {
  const doc = buildFor('sales', bigData())
  const started = Date.now()
  const bytes = await buildReportPdf(doc, { filename: 'sales-report-large.pdf', pad: PAD, businessName: PAD.name })
  const elapsed = Date.now() - started
  assert.ok(bytes.size > 10000)
  assert.ok(elapsed < 15000, `PDF তৈরি হতে ${elapsed}ms লেগেছে`)
})

test('ফাইল-নাম আগের নিয়মেই — ইংরেজি সংখ্যা ও .pdf', () => {
  assert.equal(sheetFileName('sales-report', '2026-09-01_2026-09-30'), 'sales-report-2026-09-01_2026-09-30.pdf')
  assert.equal(sheetFileName('customer-statement', 'c1-2026-09-01_2026-09-30'), 'customer-statement-c1-2026-09-01_2026-09-30.pdf')
  assert.equal(sheetFileName('dailyProfit-report', '2026-09-18'), 'dailyProfit-report-2026-09-18.pdf')
})

test('ভিন্ন শাখা ও ভিন্ন সময়সীমায় PDF — শুধু সেই শাখার/সময়ের ডেটাই থাকে', async () => {
  const data = smallData()
  const branchA = buildFor('sales', data, { branchId: 'a' })
  const branchB = buildFor('sales', data, { branchId: 'b' })
  assert.ok(branchA.rows.some((row) => row.cells.some((cell) => cell.includes('সয়াবিন'))))
  assert.ok(branchB.rows.every((row) => !row.cells.some((cell) => cell.includes('সয়াবিন'))), 'শাখা b-তে শাখা a-র সারি ঢুকেছে')

  const pdfA = await buildReportPdf(branchA, { filename: 'sales-report-branch-a.pdf', pad: PAD })
  const pdfB = await buildReportPdf(branchB, { filename: 'sales-report-branch-b.pdf', pad: PAD })
  const textA = (await extractPdf(pdfA.buffer)).pages[0].text
  const textB = (await extractPdf(pdfB.buffer)).pages[0].text
  assert.ok(textA.includes('সয়াবিন তেল'), 'শাখা a-র পণ্য PDF-এ নেই')
  assert.ok(!textB.includes('সয়াবিন তেল'), 'শাখা b-এর PDF-এ শাখা a-র পণ্য এসেছে')
  assert.ok(textA !== textB)

  // ভিন্ন সময়সীমা: আগের মাসে কিছু নেই ⇒ খালি-রিপোর্ট বার্তা, তবু সঠিক পিরিয়ড লেখা
  const earlier = buildReport('sales', {
    from: '2026-08-01', to: '2026-08-31', month: '2026-08', scope: { branchId: 'a' },
  } as never, data)
  assert.equal(earlier.rows.length, 0)
  const pdfEarlier = await buildReportPdf(earlier, { filename: 'sales-report-2026-08-01_2026-08-31.pdf', pad: PAD })
  const textEarlier = (await extractPdf(pdfEarlier.buffer)).pages[0].text
  assert.ok(textEarlier.includes('১/৮/২০২৬ থেকে ৩১/৮/২০২৬'))
  assert.ok(textEarlier.includes('নির্বাচিত ফিল্টারে কোনো তথ্য পাওয়া যায়নি'))
})

test('দ্রুত shaping: শব্দ ধরে composition ও সরাসরি layout-এর ফল হুবহু এক', async () => {
  // বড় রিপোর্টে গতি বাড়াতে শেপিং শব্দ ধরে ক্যাশে রাখা হয় (engine এর গ্রাফিক্স ফল
  // বদলানো চলবে না)। GPOS/GSUB-এ স্পেস গ্লিফের কোনো নিয়ম নেই — তাই ফল একই হওয়া উচিত।
  const fs = await import('node:fs')
  const path = await import('node:path')
  const fontkit = (await import('fontkit')) as unknown as {
    create: (bytes: Buffer) => {
      unitsPerEm: number
      layout(text: string): {
        glyphs: { id: number }[]
        positions: { xAdvance: number; xOffset: number; yOffset: number }[]
      }
    }
  }
  const samples = [
    'বিক্রি রিপোর্ট ২০২৬', 'সয়াবিন তেল ৫ লিটার', 'মোছাম্মৎ রেহেনা বেগম চৌধুরানী',
    'সমাপনী স্টক = ওপেনিং + ক্রয় − বিক্রয় + সমন্বয়।', 'নিট লাভ', 'কর্ণফুলী সেলস সেন্টার',
    '  দুই  স্পেস  ', 'ক্রমবর্ধমান-১ / SL-2026-0142', 'শ্রদ্ধাঞ্জলি ঊর্ধ্বমুখী ভূগোল',
  ]
  for (const weight of ['Regular', 'Bold'] as const) {
    const font = fontkit.create(fs.readFileSync(path.join(process.cwd(), 'public', 'fonts', `NotoSansBengali-${weight}.ttf`)))
    const shaper = new BengaliShaper(font)
    for (const text of samples) {
      const composed = shaper.shape(text)
      const run = font.layout(text)
      let pen = 0
      const expected = run.glyphs.map((glyph, index) => {
        const position = run.positions[index]
        const item = { gid: glyph.id, x: pen + position.xOffset, y: -position.yOffset }
        pen += position.xAdvance
        return item
      })
      assert.deepEqual(composed.glyphs.map((g) => ({ gid: g.gid, x: g.x, y: g.y })), expected, `শেপিং মিলছে না (${weight}): ${text}`)
      assert.equal(composed.width, pen / font.unitsPerEm)
    }
  }
})

test('ভুল/অসম্পূর্ণ রিপোর্ট ডেটায় বাংলা ত্রুটি (crash নয়)', async () => {
  await assert.rejects(
    () => buildReportPdf({ columns: [], rows: [] } as never, { filename: 'x.pdf' }),
    /PDF তৈরি করা যায়নি/,
  )
})
