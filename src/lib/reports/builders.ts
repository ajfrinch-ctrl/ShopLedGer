import type { Sale } from '../../types'
import { computeStock } from '../stock'
import { cents, ledgerRows } from '../ledger'
import { collectionRecords } from '../report'
import {
  PAYMENT_METHODS, TX_TYPES, before, bnDate, bnMoney, bnMonthLabel, bnQty,
  inBranch, monthRange, r2, rangePeriod, reportDefinition, validateReportInput, within,
  type ReportData, type ReportDocument, type ReportInput, type ReportKind, type ReportRow,
} from './core'

const saleName = (s: Sale) => s.customer_name?.trim() || (s.payment_type === 'বাকি' ? 'নাম নেই' : 'নগদ ক্রেতা')
const productFilter = (input: ReportInput, id: string) => !input.productId || input.productId === id
const chronological = <T extends { date: string; id: string }>(rows: T[]) =>
  [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))

/** Bill totals are authoritative. Allocate the bill adjustment in cents, before product filtering.
 * Cumulative rounding ensures even a one-paisa discount reconciles exactly across all lines. */
export function saleStatementLines(sale: Sale) {
  const items = sale.items.length ? sale.items : [{
    product_id: '', product_name: 'পণ্যের বিবরণ নেই', quantity: 0, unit: '', sale_price: 0,
    total: sale.total_amount,
  }]
  const gross = items.reduce((sum, item) => sum + item.total, 0)
  const adjustment = Math.round((gross - sale.total_amount) * 100)
  let cumulative = 0
  let allocated = 0
  return items.map((item, index) => {
    cumulative += item.total
    const target = index === items.length - 1 ? adjustment
      : Math.round(adjustment * (gross ? cumulative / gross : (index + 1) / items.length))
    const discount = (target - allocated) / 100
    allocated = target
    return { ...item, discount, net: r2(item.total - discount) }
  })
}

/** Different units must never be added as a single quantity. */
function quantityTotal(items: { quantity: number; unit: string }[]) {
  const units = new Map<string, number>()
  for (const item of items) units.set(item.unit, (units.get(item.unit) || 0) + item.quantity)
  return [...units].map(([unit, qty]) => bnQty(qty, unit)).join(' • ') || '—'
}

function buildSales(input: ReportInput, data: ReportData): ReportDocument {
  const sales = chronological(data.sales.filter(s => inBranch(s.branch_id, input.scope) &&
    within(s.date, input.from, input.to) && (!input.paymentType || s.payment_type === input.paymentType) &&
    (!input.customerId || s.customer_id === input.customerId)))
  const lines = sales.flatMap(s => saleStatementLines(s).filter(i => productFilter(input, i.product_id)).map(item => ({ s, item })))
  return {
    kind: 'sales', title: 'বিক্রি রিপোর্ট', period: rangePeriod(input.from, input.to),
    columns: [
      { label: 'তারিখ' }, { label: 'পণ্য', width: '19%' }, { label: 'ক্রেতা', width: '16%' },
      { label: 'ধরন' }, { label: 'পরিমাণ', align: 'right' }, { label: 'দর', align: 'right' },
      { label: 'বিক্রয় মূল্য', align: 'right' }, { label: 'ছাড় / সমন্বয়', align: 'right' }, { label: 'নিট বিক্রি', align: 'right' },
    ],
    rows: lines.map(({ s, item: i }) => ({ cells: [bnDate(s.date), i.product_name, saleName(s), s.payment_type,
      bnQty(i.quantity, i.unit), bnMoney(i.sale_price), bnMoney(i.total), bnMoney(i.discount), bnMoney(i.net)] })),
    totals: ['সর্বমোট', '', '', '', quantityTotal(lines.map(l => l.item)), '',
      bnMoney(r2(lines.reduce((s, l) => s + l.item.total, 0))), bnMoney(r2(lines.reduce((s, l) => s + l.item.discount, 0))),
      bnMoney(r2(lines.reduce((s, l) => s + l.item.net, 0)))],
    notes: lines.some(l => l.item.discount !== 0) ? ['বিলের ছাড় / সমন্বয় পণ্যের মূল্যের অনুপাতে ভাগ করা হয়েছে; নিট বিক্রি বিলের মোটের সঙ্গে মেলে।'] : [],
  }
}

function buildPurchase(input: ReportInput, data: ReportData): ReportDocument {
  const rows = chronological(data.purchases.filter(p => inBranch(p.branch_id, input.scope) &&
    within(p.date, input.from, input.to) && productFilter(input, p.product_id) && (!input.supplier || p.supplier === input.supplier)))
  return {
    kind: 'purchase', title: 'ক্রয় রিপোর্ট', period: rangePeriod(input.from, input.to),
    columns: [{ label: 'তারিখ' }, { label: 'পণ্য', width: '23%' }, { label: 'সাপ্লায়ার', width: '20%' },
      { label: 'ধরন' }, { label: 'পরিমাণ', align: 'right' }, { label: 'ক্রয় দর', align: 'right' }, { label: 'ক্রয় মূল্য', align: 'right' }],
    rows: rows.map(p => ({ cells: [bnDate(p.date), p.product_name, p.supplier || '—', p.payment_type || 'নগদ',
      bnQty(p.quantity, p.unit), bnMoney(p.purchase_price), bnMoney(p.total)] })),
    totals: ['সর্বমোট', '', '', '', quantityTotal(rows), '', bnMoney(r2(rows.reduce((s, p) => s + p.total, 0)))],
    notes: rows.some(p => !p.payment_type) ? ['পুরোনো ক্রয়ে পেমেন্টের ধরন না থাকলে অ্যাপের নিয়ম অনুযায়ী নগদ ধরা হয়েছে।'] : [],
  }
}

function buildStock(input: ReportInput, data: ReportData): ReportDocument {
  const products = data.products.filter(p => inBranch(p.branch_id, input.scope) &&
    (!input.category || p.category === input.category) && productFilter(input, p.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'bn') || a.id.localeCompare(b.id))
  const movement = (period: 'opening' | 'range') => {
    const matches = (x: { date: string; branch_id: string }) => inBranch(x.branch_id, input.scope) &&
      (period === 'opening' ? before(x.date, input.from) : within(x.date, input.from, input.to))
    return computeStock(products, data.purchases.filter(matches), data.sales.filter(matches), data.adjustments.filter(matches))
  }
  const openings = new Map(movement('opening').map(p => [p.id, p.currentStock]))
  const stocks = movement('range')
  let purchaseValue = 0
  let saleValue = 0
  const rows = stocks.map(p => {
    const opening = openings.get(p.id) || 0
    const current = Math.round((opening + p.totalPurchased - p.totalSold + p.totalAdjusted) * 1000) / 1000
    const pv = r2(Math.max(0, current) * p.purchase_price)
    const sv = r2(Math.max(0, current) * p.sale_price)
    purchaseValue += pv
    saleValue += sv
    return { cells: [p.name, bnQty(opening, p.unit), bnQty(p.totalPurchased, p.unit), bnQty(p.totalSold, p.unit),
      bnQty(p.totalAdjusted, p.unit), bnQty(current, p.unit), bnMoney(pv), bnMoney(sv)] }
  })
  return {
    kind: 'stock', title: 'স্টক রিপোর্ট', period: rangePeriod(input.from, input.to),
    columns: [{ label: 'পণ্য', width: '23%' }, { label: 'ওপেনিং স্টক', align: 'right' }, { label: 'মোট ক্রয়', align: 'right' },
      { label: 'মোট বিক্রয়', align: 'right' }, { label: 'সমন্বয়', align: 'right' }, { label: 'সমাপনী স্টক', align: 'right' },
      { label: 'ক্রয় মূল্য', align: 'right' }, { label: 'বিক্রয় মূল্য', align: 'right' }],
    rows, totals: ['সর্বমোট', '', '', '', '', '', bnMoney(r2(purchaseValue)), bnMoney(r2(saleValue))],
    notes: ['সমাপনী স্টক = ওপেনিং + ক্রয় − বিক্রয় + সমন্বয়। মূল্যায়ন পণ্যের বর্তমানে সংরক্ষিত দর অনুযায়ী; ঋণাত্মক স্টকের মূল্য শূন্য ধরা হয়েছে।'],
  }
}

interface DueAccount {
  id: string
  name: string
  phone?: string
  opening: number
  openingAdded: number
  dueSales: number
  collected: number
  balance: number
}

export function dueAccounts(data: ReportData, scope: ReportInput['scope'], from: string, to: string): DueAccount[] {
  const map = new Map<string, DueAccount>()
  const apply = (id: string, name: string, date: string, type: 'dueSales' | 'collected' | 'openingAdded', amount: number) => {
    if (!within(date, '', to)) return
    let acc = map.get(id)
    if (!acc) {
      acc = { id, name, opening: 0, openingAdded: 0, dueSales: 0, collected: 0, balance: 0 }
      map.set(id, acc)
    }
    const value = cents(amount)
    const signed = type === 'collected' ? -value : value
    if (before(date, from)) acc.opening += signed
    else acc[type] += value
    acc.balance += signed
  }
  for (const s of data.sales) {
    if (s.payment_type === 'বাকি' && s.customer_id && inBranch(s.branch_id, scope))
      apply(s.customer_id, saleName(s), s.date, 'dueSales', s.total_amount)
  }
  for (const e of data.entries) {
    if (!e.cancelled && e.party_type === 'customer' && inBranch(e.branch_id, scope))
      apply(e.party_id, e.party_name, e.date, e.kind === 'opening' ? 'openingAdded' : 'collected', e.amount)
  }
  for (const c of data.collections) {
    if (inBranch(c.branch_id, scope)) apply(c.customer_id, c.customer_name, c.date, 'collected', c.amount)
  }
  for (const c of data.customers) {
    const acc = map.get(c.id)
    if (acc && inBranch(c.branch_id, scope)) { acc.name = c.name; acc.phone = c.phone }
  }
  return [...map.values()].map(a => ({ ...a, opening: a.opening / 100, openingAdded: a.openingAdded / 100,
    dueSales: a.dueSales / 100, collected: a.collected / 100, balance: a.balance / 100 }))
}

function buildCustomerDue(input: ReportInput, data: ReportData): ReportDocument {
  if (input.customerId) return buildCustomerLedger(input, data)
  const accounts = dueAccounts(data, input.scope, input.from, input.to)
    .filter(a => (!input.customerId || a.id === input.customerId) &&
      [a.opening, a.openingAdded, a.dueSales, a.collected, a.balance].some(n => Math.abs(n) > 0.005))
    .sort((a, b) => a.name.localeCompare(b.name, 'bn') || a.id.localeCompare(b.id))
  const fields = ['opening', 'openingAdded', 'dueSales', 'collected', 'balance'] as const
  return {
    kind: 'customerDue', title: 'ক্রেতার বাকি রিপোর্ট', period: rangePeriod(input.from, input.to),
    columns: [{ label: 'ক্রেতা', width: '22%' }, { label: 'ফোন' }, { label: 'প্রারম্ভিক বাকি', align: 'right' },
      { label: 'পুরোনো বাকি যোগ', align: 'right' }, { label: 'বাকিতে বিক্রি', align: 'right' },
      { label: 'আদায়', align: 'right' }, { label: 'সমাপনী বাকি', align: 'right' }],
    rows: accounts.map(a => ({ cells: [a.name, a.phone || '—', ...fields.map(f => bnMoney(a[f]))] })),
    totals: ['সর্বমোট', '', ...fields.map(f => bnMoney(r2(accounts.reduce((sum, a) => sum + a[f], 0))))],
    notes: ['সমাপনী বাকি = প্রারম্ভিক বাকি + এই সময়ে পুরোনো বাকি যোগ + বাকিতে বিক্রি − আদায়। ঋণাত্মক বাকি মানে ক্রেতার অগ্রিম জমা।'],
  }
}

/** A selected customer's report is a dated account statement with a running balance. */
function buildCustomerLedger(input: ReportInput, data: ReportData): ReportDocument {
  const id = input.customerId!
  const ledger = ledgerRows(id, data.sales, [], data.entries, data.collections, { ...input.scope, through: input.to })
  const openingRows = ledger.filter(row => before(row.date, input.from))
  const opening = openingRows[openingRows.length - 1]?.balance || 0
  const movements = ledger.filter(row => within(row.date, input.from, input.to))
  const entries = new Map(data.entries.filter(e => e.party_type === 'customer' && e.party_id === id).map(e => [e.id, e]))
  const rows: ReportRow[] = [{ cells: [input.from ? bnDate(input.from) : 'শুরু', 'প্রারম্ভিক বাকি', '—', '—', bnMoney(opening)], emphasis: true }]
  for (const m of movements) {
    const entry = m.source === 'ledger' ? entries.get(m.id) : undefined
    const label = m.source === 'sale' ? `বাকিতে বিক্রি • ${m.id}` : entry?.kind === 'payment'
      ? `আদায় • ${entry.method}${entry.reference ? ` • ${entry.reference}` : ''}` : m.label
    rows.push({ cells: [bnDate(m.date), label, m.debit ? bnMoney(m.debit) : '—', m.credit ? bnMoney(m.credit) : '—', bnMoney(m.balance)] })
  }
  const balance = movements[movements.length - 1]?.balance ?? opening
  return {
    kind: 'customerDue', title: 'ক্রেতার হিসাব বিবরণী', period: rangePeriod(input.from, input.to),
    columns: [{ label: 'তারিখ', width: '15%' }, { label: 'বিবরণ', width: '40%' }, { label: 'বাকি (+)', align: 'right' },
      { label: 'জমা (−)', align: 'right' }, { label: 'ব্যালেন্স', align: 'right' }],
    rows, totals: ['সমাপনী', '', bnMoney(r2(movements.reduce((s, m) => s + m.debit, 0))),
      bnMoney(r2(movements.reduce((s, m) => s + m.credit, 0))), bnMoney(balance)],
    notes: ['ব্যালেন্স = প্রারম্ভিক বাকি + বাকি (+) − জমা (−)। ঋণাত্মক ব্যালেন্স ক্রেতার অগ্রিম জমা। নগদ কেনাকাটা বাকি হিসাবে অন্তর্ভুক্ত নয়।'],
  }
}

function buildCollection(input: ReportInput, data: ReportData): ReportDocument {
  const records = chronological(collectionRecords(data.entries, data.collections, input.scope).filter(c =>
    within(c.date, input.from, input.to) && (!input.customerId || c.customerId === input.customerId) && (!input.method || c.method === input.method)))
  return {
    kind: 'collection', title: 'বাকি আদায় রিপোর্ট', period: rangePeriod(input.from, input.to),
    columns: [{ label: 'তারিখ', width: '18%' }, { label: 'ক্রেতা', width: '40%' }, { label: 'পেমেন্ট পদ্ধতি' }, { label: 'টাকা', align: 'right' }],
    rows: records.map(c => ({ cells: [bnDate(c.date), c.customerName, c.method, bnMoney(c.amount)] })),
    totals: ['সর্বমোট', '', '', bnMoney(r2(records.reduce((s, c) => s + c.amount, 0)))],
  }
}

function buildExpense(input: ReportInput, data: ReportData): ReportDocument {
  const expenses = chronological(data.expenses.filter(e => inBranch(e.branch_id, input.scope) &&
    within(e.date, input.from, input.to) && (!input.category || e.category === input.category) &&
    (!input.expenseKind || (e.kind === 'owner' ? 'owner' : 'shop') === input.expenseKind)))
  return {
    kind: 'expense', title: 'খরচ রিপোর্ট', period: rangePeriod(input.from, input.to),
    columns: [{ label: 'তারিখ' }, { label: 'ধরন', width: '21%' }, { label: 'খরচের খাত', width: '22%' },
      { label: 'বিবরণ', width: '25%' }, { label: 'টাকা', align: 'right' }],
    rows: expenses.map(e => ({ cells: [bnDate(e.date), e.kind === 'owner' ? 'মালিকের টাকা তোলা' : 'দোকানের খরচ',
      e.category, e.note?.trim() || e.payment_method || '—', bnMoney(e.amount)] })),
    totals: ['সর্বমোট', '', '', '', bnMoney(r2(expenses.reduce((s, e) => s + e.amount, 0)))],
    notes: ['মালিকের ব্যক্তিগত টাকা তোলা ব্যবসার খরচ নয়; লাভের হিসাব থেকে বাদ যায় না।'],
  }
}

function buildProfit(kind: 'dailyProfit' | 'monthlyProfit', input: ReportInput, data: ReportData): ReportDocument {
  const { from, to } = kind === 'monthlyProfit' ? monthRange(input.month) : { from: input.to || input.from, to: input.to || input.from }
  const sales = data.sales.filter(s => inBranch(s.branch_id, input.scope) && within(s.date, from, to))
  const expenses = data.expenses.filter(e => inBranch(e.branch_id, input.scope) && within(e.date, from, to) && e.kind !== 'owner')
  const revenue = r2(sales.reduce((s, x) => s + x.total_amount, 0))
  const gross = r2(sales.reduce((s, x) => s + x.total_profit, 0))
  const expense = r2(expenses.reduce((s, x) => s + x.amount, 0))
  return {
    kind, title: reportDefinition(kind).label, period: kind === 'monthlyProfit' ? bnMonthLabel(input.month) : bnDate(to),
    columns: [{ label: 'বিবরণ', width: '65%' }, { label: 'টাকা', align: 'right' }],
    rows: [
      { cells: ['নিট বিক্রি (ছাড়ের পরে)', bnMoney(revenue)] },
      { cells: ['(−) বিক্রিত পণ্যের ক্রয়মূল্য', bnMoney(r2(revenue - gross))] },
      { cells: ['গ্রস লাভ', bnMoney(gross)], emphasis: true },
      { cells: ['(−) দোকানের খরচ', bnMoney(expense)] },
      { cells: ['নিট লাভ / ক্ষতি', bnMoney(r2(gross - expense))], emphasis: true },
    ],
    notes: ['নিট লাভ = নিট বিক্রি − বিক্রিত পণ্যের ক্রয়মূল্য − দোকানের খরচ। পণ্য ক্রয়, বাকি আদায় ও মালিকের টাকা তোলা সরাসরি লাভের অংশ নয়।'],
  }
}

function buildProduct(input: ReportInput, data: ReportData): ReportDocument {
  const term = (input.search || '').trim().toLowerCase()
  const products = data.products.filter(p => inBranch(p.branch_id, input.scope) &&
    (!input.category || p.category === input.category) && (!term || [p.name, p.code, p.company, p.category].some(v => v?.toLowerCase().includes(term))))
  const matches = (x: { date: string; branch_id: string }) => inBranch(x.branch_id, input.scope) && within(x.date, '', input.to)
  const stocks = computeStock(products, data.purchases.filter(matches), data.sales.filter(matches), data.adjustments.filter(matches))
    .sort((a, b) => a.name.localeCompare(b.name, 'bn') || a.id.localeCompare(b.id))
  return {
    kind: 'product', title: 'পণ্য রিপোর্ট', period: rangePeriod('', input.to),
    columns: [{ label: 'পণ্য', width: '32%' }, { label: 'কোড' }, { label: 'ক্রয় দর', align: 'right' },
      { label: 'বিক্রয় দর', align: 'right' }, { label: 'ওপেনিং স্টক', align: 'right' }, { label: 'সমাপনী স্টক', align: 'right' }],
    rows: stocks.map(p => ({ cells: [p.company ? `${p.name} (${p.company})` : p.name, p.code || '—', bnMoney(p.purchase_price),
      bnMoney(p.sale_price), bnQty(p.opening_stock, p.unit), bnQty(p.currentStock, p.unit)] })),
    notes: ['দর পণ্যের বর্তমানে সংরক্ষিত মূল্য; স্টক নির্বাচিত তারিখ পর্যন্ত।'],
  }
}

function buildTransaction(input: ReportInput, data: ReportData): ReportDocument {
  const rows: (ReportRow & { date: string; id: string; type: string; amount: number })[] = []
  const push = (id: string, type: string, date: string, product: string, party: string, quantity: string, amount: number, status: string) =>
    rows.push({ id, type, date, amount, cells: [bnDate(date), type, product, party, quantity, bnMoney(amount), status] })
  const matches = (x: { date: string; branch_id: string }) => inBranch(x.branch_id, input.scope) && within(x.date, input.from, input.to)
  for (const s of data.sales.filter(matches)) {
    saleStatementLines(s).forEach((i, index) => push(`sale:${s.id}:${index}`, 'বিক্রি', s.date, i.product_name, saleName(s), bnQty(i.quantity, i.unit), i.net, s.payment_type))
  }
  for (const p of data.purchases.filter(matches)) push(`purchase:${p.id}`, 'ক্রয়', p.date, p.product_name, p.supplier || '—', bnQty(p.quantity, p.unit), p.total, p.payment_type || 'নগদ')
  for (const e of data.entries.filter(matches)) {
    if (e.cancelled) continue
    const type = e.party_type === 'customer' ? (e.kind === 'payment' ? 'আদায়' : 'পুরোনো বাকি') : (e.kind === 'payment' ? 'সাপ্লায়ার পরিশোধ' : 'পুরোনো দেনা')
    push(`ledger:${e.id}`, type, e.date, '—', e.party_name, '—', e.amount, e.kind === 'opening' ? 'প্রারম্ভিক হিসাব' : e.method)
  }
  for (const c of data.collections.filter(matches)) push(`collection:${c.id}`, 'আদায়', c.date, '—', c.customer_name, '—', c.amount, c.payment_method || 'নগদ টাকা')
  for (const e of data.expenses.filter(matches)) push(`expense:${e.id}`, e.kind === 'owner' ? 'মালিকের টাকা তোলা' : 'খরচ', e.date, '—', e.category, '—', e.amount, e.payment_method || 'নগদ টাকা')
  const term = (input.search || '').trim().toLowerCase()
  const filtered = chronological(rows.filter(r => (!input.txType || r.type === input.txType) && (!term || r.cells.some(c => c.toLowerCase().includes(term)))))
  const oneType = new Set(filtered.map(r => r.type)).size === 1
  return {
    kind: 'transaction', title: 'লেনদেন রিপোর্ট', period: rangePeriod(input.from, input.to),
    columns: [{ label: 'তারিখ' }, { label: 'লেনদেনের ধরন', width: '17%' }, { label: 'পণ্য', width: '20%' },
      { label: 'ক্রেতা / সাপ্লায়ার / খাত', width: '20%' }, { label: 'পরিমাণ', align: 'right' }, { label: 'টাকা', align: 'right' }, { label: 'পেমেন্ট অবস্থা' }],
    rows: filtered.map(({ cells }) => ({ cells })),
    totals: oneType ? ['সর্বমোট', '', '', '', '', bnMoney(r2(filtered.reduce((s, r) => s + r.amount, 0))), ''] : undefined,
    notes: ['এটি লেনদেনের বিবরণী, নগদ বই নয়। বিক্রি, ক্রয়, আদায় ও প্রারম্ভিক হিসাব আলাদা প্রকৃতির; মিশ্র লেনদেনের সম্মিলিত মোট দেখানো হয় না।'],
  }
}

function filterNoteText(input: ReportInput, data: ReportData): string | undefined {
  const parts: string[] = []
  const product = data.products.find(p => p.id === input.productId)
  if (product) parts.push(`পণ্য: ${product.name}`)
  const customer = data.customers.find(c => c.id === input.customerId)
  if (input.customerId) parts.push(`ক্রেতা: ${customer?.name || data.entries.find(e => e.party_type === 'customer' && e.party_id === input.customerId && inBranch(e.branch_id, input.scope))?.party_name || input.customerId}`)
  if (input.supplier) parts.push(`সাপ্লায়ার: ${input.supplier}`)
  if (input.category) parts.push(`ক্যাটাগরি: ${input.category}`)
  if (input.paymentType) parts.push(`পেমেন্ট: ${input.paymentType}`)
  if (input.method) parts.push(`পদ্ধতি: ${input.method}`)
  if (input.expenseKind) parts.push(`খরচ: ${input.expenseKind === 'owner' ? 'মালিকের টাকা তোলা' : 'দোকানের খরচ'}`)
  if (input.txType) parts.push(`ধরন: ${input.txType}`)
  if (input.search?.trim()) parts.push(`সার্চ: "${input.search.trim()}"`)
  return parts.length ? parts.join(' • ') : undefined
}

export function buildReport(kind: ReportKind, input: ReportInput, data: ReportData): ReportDocument {
  const error = validateReportInput(reportDefinition(kind).filters, input)
  if (error) throw new Error(error)
  const builders = { sales: buildSales, purchase: buildPurchase, stock: buildStock, customerDue: buildCustomerDue,
    collection: buildCollection, expense: buildExpense, product: buildProduct, transaction: buildTransaction }
  const doc = kind === 'dailyProfit' || kind === 'monthlyProfit' ? buildProfit(kind, input, data) : builders[kind](input, data)
  return { ...doc, filterNote: filterNoteText(input, data) }
}

export const reportTitle = (kind: ReportKind) => reportDefinition(kind).label
export const TX_TYPE_OPTIONS = TX_TYPES
export const METHOD_OPTIONS = PAYMENT_METHODS
