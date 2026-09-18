import type { Sale } from '../types'
import type { DbCollection, DbCustomer, LedgerEntry } from './db'
import { inRange, toDateKey, type DateRange } from './profitLoss'

/**
 * রিপোর্ট সেন্টারের হিসাব — সব ফাংশন pure, তাই টেস্ট করা যায়।
 *
 * স্কোপ (রোল-ভিত্তিক অ্যাকসেস):
 *   scope.branchId না থাকলে → সব শাখা (মালিক)
 *   scope.branchId থাকলে   → শুধু ওই শাখার ডেটা (কর্মচারী)
 */
export interface ReportScope {
  branchId?: string
}

/** রিপোর্ট সেন্টারের রিপোর্টের ধরন */
export type ReportKind = 'sales' | 'collections' | 'dues'

const r2 = (n: number) => Math.round(n * 100) / 100
const dayOf = (date: string) => date.slice(0, 10)

const inBranch = (branchId: string | undefined, scope: ReportScope) =>
  !scope.branchId || branchId === scope.branchId

/* ─────────────────────────────────────────────
   তারিখের সীমা (প্রিসেট)
   ───────────────────────────────────────────── */

export type RangePreset = 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'lastMonth' | 'custom'

export const RANGE_PRESETS: { key: RangePreset; label: string }[] = [
  { key: 'today', label: 'আজ' },
  { key: 'yesterday', label: 'গতকাল' },
  { key: 'last7', label: 'শেষ ৭ দিন' },
  { key: 'thisMonth', label: 'এই মাস' },
  { key: 'lastMonth', label: 'গত মাস' },
  { key: 'custom', label: 'কাস্টম' },
]

const shiftDays = (d: Date, days: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)

/** প্রিসেট অনুযায়ী তারিখের সীমা। custom হলে ব্যবহৃত ইনপুটই ফেরত আসে (উল্টো হলে ঠিক করে)। */
export function rangeForPreset(preset: RangePreset, base = new Date(), custom?: DateRange): DateRange {
  const today = toDateKey(base)
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'yesterday': {
      const y = toDateKey(shiftDays(base, -1))
      return { from: y, to: y }
    }
    case 'last7':
      return { from: toDateKey(shiftDays(base, -6)), to: today }
    case 'thisMonth':
      return {
        from: toDateKey(new Date(base.getFullYear(), base.getMonth(), 1)),
        to: toDateKey(new Date(base.getFullYear(), base.getMonth() + 1, 0)),
      }
    case 'lastMonth':
      return {
        from: toDateKey(new Date(base.getFullYear(), base.getMonth() - 1, 1)),
        to: toDateKey(new Date(base.getFullYear(), base.getMonth(), 0)),
      }
    default:
      if (!custom) return { from: today, to: today }
      return custom.from <= custom.to ? custom : { from: custom.to, to: custom.from }
  }
}

export function rangeLabel(range: DateRange): string {
  return range.from === range.to ? range.from : `${range.from} থেকে ${range.to}`
}

/* ─────────────────────────────────────────────
   বাকি আদায় (কালেকশন) — নতুন লেজার + পুরোনো কালেকশন
   ───────────────────────────────────────────── */

export interface CollectionRecord {
  id: string
  date: string
  customerId: string
  customerName: string
  amount: number
  method: string
  branchId: string
  staffId?: string
  source: 'ledger' | 'legacy'
}

/** ক্রেতার কাছ থেকে আদায় হওয়া টাকার সব রেকর্ড (বাতিল বাদে)। */
export function collectionRecords(
  entries: LedgerEntry[],
  legacy: DbCollection[],
  scope: ReportScope = {},
): CollectionRecord[] {
  const out: CollectionRecord[] = []

  for (const e of entries) {
    if (e.cancelled || e.party_type !== 'customer' || e.kind !== 'payment') continue
    if (!inBranch(e.branch_id, scope)) continue
    out.push({
      id: e.id,
      date: dayOf(e.date),
      customerId: e.party_id,
      customerName: e.party_name,
      amount: r2(e.amount),
      method: e.method || 'নগদ টাকা',
      branchId: e.branch_id,
      staffId: e.created_by,
      source: 'ledger',
    })
  }

  // পুরোনো (legacy) কালেকশন — এই টেবিলে এখন আর লেখা হয় না, শুধু পুরনো ডেটার জন্য পড়া হয়
  for (const c of legacy) {
    if (!inBranch(c.branch_id, scope)) continue
    out.push({
      id: c.id,
      date: dayOf(c.date),
      customerId: c.customer_id,
      customerName: c.customer_name,
      amount: r2(c.amount),
      method: c.payment_method || 'নগদ টাকা',
      branchId: c.branch_id,
      source: 'legacy',
    })
  }

  return out.sort(
    (a, b) => b.date.localeCompare(a.date) || a.customerName.localeCompare(b.customerName) || a.id.localeCompare(b.id),
  )
}

/* ─────────────────────────────────────────────
   বিক্রি রিপোর্ট
   ───────────────────────────────────────────── */

export interface SalesDayRow {
  date: string
  bills: number
  amount: number
  cash: number
  due: number
  profit: number
}

export interface SalesReport {
  billCount: number
  revenue: number
  cashSales: number
  dueSales: number
  profit: number
  averageBill: number
  itemLines: number
  byDate: SalesDayRow[]
  byProduct: { name: string; unit: string; quantity: number; amount: number; profit: number }[]
  byCustomer: { name: string; bills: number; amount: number; due: number }[]
  byBranch: { branchId: string; bills: number; amount: number; profit: number }[]
  byStaff: { staffId: string; bills: number; amount: number; profit: number }[]
  /** তারিখ অনুযায়ী নতুন আগে — বিস্তারিত টেবিলের জন্য */
  rows: Sale[]
}

export function computeSalesReport(sales: Sale[], range: DateRange, scope: ReportScope = {}): SalesReport {
  const scoped = sales.filter((s) => inBranch(s.branch_id, scope) && inRange(s.date, range))

  const byDateMap = new Map<string, SalesDayRow>()
  const byProductMap = new Map<string, { name: string; unit: string; quantity: number; amount: number; profit: number }>()
  const byCustomerMap = new Map<string, { name: string; bills: number; amount: number; due: number }>()
  const byBranchMap = new Map<string, { branchId: string; bills: number; amount: number; profit: number }>()
  const byStaffMap = new Map<string, { staffId: string; bills: number; amount: number; profit: number }>()

  let revenue = 0
  let profit = 0
  let cashSales = 0
  let dueSales = 0
  let itemLines = 0

  for (const s of scoped) {
    const day = dayOf(s.date)
    const isDue = s.payment_type === 'বাকি'
    revenue += s.total_amount
    profit += s.total_profit
    if (isDue) dueSales += s.total_amount
    else cashSales += s.total_amount
    itemLines += s.items.length

    const d = byDateMap.get(day) || { date: day, bills: 0, amount: 0, cash: 0, due: 0, profit: 0 }
    d.bills += 1
    d.amount += s.total_amount
    d.profit += s.total_profit
    if (isDue) d.due += s.total_amount
    else d.cash += s.total_amount
    byDateMap.set(day, d)

    for (const item of s.items) {
      const key = `${item.product_name}|${item.unit}`
      const p = byProductMap.get(key) || { name: item.product_name, unit: item.unit, quantity: 0, amount: 0, profit: 0 }
      p.quantity += item.quantity
      p.amount += item.total
      p.profit += item.profit
      byProductMap.set(key, p)
    }

    const cKey = s.customer_id || s.customer_name || '__walkin__'
    const cName = s.customer_name || 'নাম নেই (নগদ ক্রেতা)'
    const c = byCustomerMap.get(cKey) || { name: cName, bills: 0, amount: 0, due: 0 }
    c.bills += 1
    c.amount += s.total_amount
    if (isDue) c.due += s.total_amount
    byCustomerMap.set(cKey, c)

    const b = byBranchMap.get(s.branch_id) || { branchId: s.branch_id, bills: 0, amount: 0, profit: 0 }
    b.bills += 1
    b.amount += s.total_amount
    b.profit += s.total_profit
    byBranchMap.set(s.branch_id, b)

    const st = byStaffMap.get(s.created_by) || { staffId: s.created_by, bills: 0, amount: 0, profit: 0 }
    st.bills += 1
    st.amount += s.total_amount
    st.profit += s.total_profit
    byStaffMap.set(s.created_by, st)
  }

  const byDate = [...byDateMap.values()]
    .map((d) => ({ ...d, amount: r2(d.amount), cash: r2(d.cash), due: r2(d.due), profit: r2(d.profit) }))
    .sort((a, b) => b.date.localeCompare(a.date))

  return {
    billCount: scoped.length,
    revenue: r2(revenue),
    cashSales: r2(cashSales),
    dueSales: r2(dueSales),
    profit: r2(profit),
    averageBill: scoped.length ? r2(revenue / scoped.length) : 0,
    itemLines,
    byDate,
    byProduct: [...byProductMap.values()]
      .map((p) => ({ ...p, quantity: r2(p.quantity), amount: r2(p.amount), profit: r2(p.profit) }))
      .sort((a, b) => b.amount - a.amount),
    byCustomer: [...byCustomerMap.values()]
      .map((c) => ({ ...c, amount: r2(c.amount), due: r2(c.due) }))
      .sort((a, b) => b.amount - a.amount),
    byBranch: [...byBranchMap.values()]
      .map((b) => ({ ...b, amount: r2(b.amount), profit: r2(b.profit) }))
      .sort((a, b) => b.amount - a.amount),
    byStaff: [...byStaffMap.values()]
      .map((s) => ({ ...s, amount: r2(s.amount), profit: r2(s.profit) }))
      .sort((a, b) => b.amount - a.amount),
    rows: [...scoped].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)),
  }
}

/* ─────────────────────────────────────────────
   বাকি আদায় রিপোর্ট
   ───────────────────────────────────────────── */

export interface CollectionsReport {
  count: number
  total: number
  average: number
  largest: number
  largestName: string
  byDate: { date: string; count: number; amount: number }[]
  byCustomer: { name: string; count: number; amount: number }[]
  byMethod: { method: string; count: number; amount: number }[]
  byBranch: { branchId: string; count: number; amount: number }[]
  byStaff: { staffId: string; count: number; amount: number }[]
  rows: CollectionRecord[]
}

export function computeCollectionsReport(records: CollectionRecord[], range: DateRange): CollectionsReport {
  const scoped = records.filter((r) => inRange(r.date, range))

  const byDateMap = new Map<string, { date: string; count: number; amount: number }>()
  const byCustomerMap = new Map<string, { name: string; count: number; amount: number }>()
  const byMethodMap = new Map<string, { method: string; count: number; amount: number }>()
  const byBranchMap = new Map<string, { branchId: string; count: number; amount: number }>()
  const byStaffMap = new Map<string, { staffId: string; count: number; amount: number }>()

  let total = 0
  let largest = 0
  let largestName = ''

  for (const r of scoped) {
    total += r.amount
    if (r.amount > largest) {
      largest = r.amount
      largestName = r.customerName
    }

    const d = byDateMap.get(r.date) || { date: r.date, count: 0, amount: 0 }
    d.count += 1
    d.amount += r.amount
    byDateMap.set(r.date, d)

    const c = byCustomerMap.get(r.customerId) || { name: r.customerName, count: 0, amount: 0 }
    c.count += 1
    c.amount += r.amount
    byCustomerMap.set(r.customerId, c)

    const m = byMethodMap.get(r.method) || { method: r.method, count: 0, amount: 0 }
    m.count += 1
    m.amount += r.amount
    byMethodMap.set(r.method, m)

    const b = byBranchMap.get(r.branchId) || { branchId: r.branchId, count: 0, amount: 0 }
    b.count += 1
    b.amount += r.amount
    byBranchMap.set(r.branchId, b)

    if (r.staffId) {
      const s = byStaffMap.get(r.staffId) || { staffId: r.staffId, count: 0, amount: 0 }
      s.count += 1
      s.amount += r.amount
      byStaffMap.set(r.staffId, s)
    }
  }

  return {
    count: scoped.length,
    total: r2(total),
    average: scoped.length ? r2(total / scoped.length) : 0,
    largest: r2(largest),
    largestName,
    byDate: [...byDateMap.values()]
      .map((d) => ({ ...d, amount: r2(d.amount) }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    byCustomer: [...byCustomerMap.values()]
      .map((c) => ({ ...c, amount: r2(c.amount) }))
      .sort((a, b) => b.amount - a.amount),
    byMethod: [...byMethodMap.values()]
      .map((m) => ({ ...m, amount: r2(m.amount) }))
      .sort((a, b) => b.amount - a.amount),
    byBranch: [...byBranchMap.values()]
      .map((b) => ({ ...b, amount: r2(b.amount) }))
      .sort((a, b) => b.amount - a.amount),
    byStaff: [...byStaffMap.values()]
      .map((s) => ({ ...s, amount: r2(s.amount) }))
      .sort((a, b) => b.amount - a.amount),
    rows: scoped,
  }
}

/* ─────────────────────────────────────────────
   ক্রেতার বাকির বর্তমান অবস্থা (তারিখ-সীমাহীন)
   ───────────────────────────────────────────── */

export interface DueRow {
  customerId: string
  name: string
  phone?: string
  branchId: string
  due: number
  lastPaymentDate?: string
  lastSaleDate?: string
}

export function computeCustomerDues(
  customers: DbCustomer[],
  sales: Sale[],
  entries: LedgerEntry[],
  legacy: DbCollection[],
  scope: ReportScope = {},
): DueRow[] {
  const map = new Map<string, DueRow>()

  const touch = (id: string, name: string, branchId: string): DueRow => {
    let row = map.get(id)
    if (!row) {
      row = { customerId: id, name, branchId, due: 0 }
      map.set(id, row)
    } else if (!row.name && name) {
      row.name = name
    }
    return row
  }

  // বাকিতে বিক্রি → বাকি বাড়ে
  for (const s of sales) {
    if (s.payment_type !== 'বাকি' || !s.customer_id) continue
    if (!inBranch(s.branch_id, scope)) continue
    const row = touch(s.customer_id, s.customer_name || 'নাম নেই', s.branch_id)
    row.due += s.total_amount
    const day = dayOf(s.date)
    if (!row.lastSaleDate || day > row.lastSaleDate) row.lastSaleDate = day
  }

  for (const e of entries) {
    if (e.cancelled) continue
    if (!inBranch(e.branch_id, scope)) continue
    if (e.kind === 'opening') {
      const row = touch(e.party_id, e.party_name, e.branch_id)
      row.due += e.amount
    } else if (e.kind === 'payment') {
      const row = touch(e.party_id, e.party_name, e.branch_id)
      row.due -= e.amount
      const day = dayOf(e.date)
      if (!row.lastPaymentDate || day > row.lastPaymentDate) row.lastPaymentDate = day
    }
  }

  for (const c of legacy) {
    if (!inBranch(c.branch_id, scope)) continue
    const row = touch(c.customer_id, c.customer_name, c.branch_id)
    row.due -= c.amount
    const day = dayOf(c.date)
    if (!row.lastPaymentDate || day > row.lastPaymentDate) row.lastPaymentDate = day
  }

  // ক্রেতা-রেকর্ড থেকে ফোন ও সর্বশেষ নাম বসানো (শাখা লেনদেন থেকেই থাকে)
  for (const c of customers) {
    const row = map.get(c.id)
    if (!row) continue
    row.phone = c.phone || row.phone
    if (c.name) row.name = c.name
  }

  return [...map.values()]
    .map((row) => ({ ...row, due: r2(row.due) }))
    .filter((row) => row.due > 0.005)
    .sort((a, b) => b.due - a.due)
}

export interface DuesSummary {
  total: number
  customers: number
  average: number
  topName: string
  topAmount: number
}

export function summariseDues(rows: DueRow[]): DuesSummary {
  const total = rows.reduce((sum, r) => sum + r.due, 0)
  return {
    total: r2(total),
    customers: rows.length,
    average: rows.length ? r2(total / rows.length) : 0,
    topName: rows[0]?.name || '',
    topAmount: r2(rows[0]?.due || 0),
  }
}

/* ─────────────────────────────────────────────
   WhatsApp / শেয়ার টেক্সট
   ───────────────────────────────────────────── */

export interface ReportMeta {
  title: string
  shopName: string
  branchName: string
  rangeNote: string
}

const taka = (n: number) => `৳ ${Math.abs(n).toLocaleString('bn-BD', { maximumFractionDigits: 2 })}`
const bnNum = (n: number) => n.toLocaleString('bn-BD', { maximumFractionDigits: 2 })

function head(meta: ReportMeta, icon: string) {
  return [
    `${icon} *${meta.title}*`,
    `🏪 ${meta.shopName} • ${meta.branchName}`,
    `📅 ${meta.rangeNote}`,
    '━━━━━━━━━━━━━━━',
  ]
}

const tail = (meta: ReportMeta) => ['', `${meta.shopName} — ShopLedGer থেকে তৈরি`]

export function salesShareText(meta: ReportMeta, report: SalesReport, lines = 5): string {
  const body = [
    `💰 মোট বিক্রি: *${taka(report.revenue)}*`,
    `🧾 বিল সংখ্যা: ${bnNum(report.billCount)}টি`,
    `💵 নগদ বিক্রি: ${taka(report.cashSales)}`,
    `🪙 বাকিতে বিক্রি: ${taka(report.dueSales)}`,
    `📈 গ্রস লাভ: ${taka(report.profit)}`,
    `📊 গড় বিল: ${taka(report.averageBill)}`,
  ]
  if (report.byProduct.length) {
    body.push('', '*সর্বোচ্চ বিক্রি হওয়া পণ্য*')
    report.byProduct.slice(0, lines).forEach((p, i) => {
      body.push(`${i + 1}. ${p.name} — ${bnNum(p.quantity)} ${p.unit} • ${taka(p.amount)}`)
    })
  }
  return [...head(meta, '📊'), ...body, ...tail(meta)].join('\n')
}

export function collectionsShareText(meta: ReportMeta, report: CollectionsReport, lines = 5): string {
  const body = [
    `🧾 মোট আদায়: *${taka(report.total)}*`,
    `🔢 আদায়ের সংখ্যা: ${bnNum(report.count)}টি`,
    `📊 গড় আদায়: ${taka(report.average)}`,
    `🏆 সবচেয়ে বড় আদায়: ${taka(report.largest)}${report.largestName ? ` (${report.largestName})` : ''}`,
  ]
  if (report.byCustomer.length) {
    body.push('', '*সর্বোচ্চ আদায় — ক্রেতা*')
    report.byCustomer.slice(0, lines).forEach((c, i) => {
      body.push(`${i + 1}. ${c.name} — ${taka(c.amount)}`)
    })
  }
  return [...head(meta, '🪙'), ...body, ...tail(meta)].join('\n')
}

export function duesShareText(meta: ReportMeta, rows: DueRow[], summary: DuesSummary, lines = 5): string {
  const body = [
    `🧮 মোট বাকি: *${taka(summary.total)}*`,
    `👥 বাকিওয়ালা ক্রেতা: ${bnNum(summary.customers)}জন`,
    `📊 গড় বাকি: ${taka(summary.average)}`,
  ]
  if (summary.topName) body.push(`🏆 সবচেয়ে বেশি: ${summary.topName} — ${taka(summary.topAmount)}`)
  if (rows.length) {
    body.push('', '*বেশি বাকিওয়ালা ক্রেতা*')
    rows.slice(0, lines).forEach((r, i) => {
      body.push(`${i + 1}. ${r.name} — ${taka(r.due)}`)
    })
  }
  return [...head(meta, '🧮'), ...body, ...tail(meta)].join('\n')
}
