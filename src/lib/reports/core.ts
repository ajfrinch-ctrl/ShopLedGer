import type { Product, Purchase, Sale, StockAdjustment } from '../../types'
import type { DbBranch, DbCollection, DbCustomer, DbExpense, DbUser, LedgerEntry } from '../db'
import { toDateKey } from '../profitLoss'
import type { ReportScope } from '../report'

export type { ReportScope }

/* ─────────────────────────────────────────────
   রিপোর্টের ধরন ও কাঠামো
   ───────────────────────────────────────────── */

export type ReportKind =
  | 'sales'
  | 'purchase'
  | 'stock'
  | 'customerDue'
  | 'collection'
  | 'expense'
  | 'dailyProfit'
  | 'monthlyProfit'
  | 'product'
  | 'transaction'

export type Tone = 'blue' | 'green' | 'teal' | 'orange' | 'red' | 'gray' | 'purple'

export interface ReportColumn {
  label: string
  align?: 'left' | 'right'
  /** A4-এ কলামের আনুমানিক প্রস্থ (যেমন '38%') */
  width?: string
}

export interface ReportRow {
  cells: string[]
  /** মোট/নিট লাইনের মতো গুরুত্বপূর্ণ সারি */
  emphasis?: boolean
}

export interface SummaryItem {
  label: string
  value: string
  tone?: Tone
}

/**
 * একটা রিপোর্ট = একটা স্বয়ংসম্পূর্ণ ডকুমেন্ট।
 * প্রতিটি রিপোর্ট আলাদা PDF হয় — কখনও একত্রে নয়।
 */
export interface ReportDocument {
  kind: ReportKind
  title: string
  /** নির্বাচিত সময় (হেডারে দেখানো হয়) */
  period: string
  /** নির্বাচিত ফিল্টারের সারসংক্ষেপ */
  filterNote?: string
  columns: ReportColumn[]
  rows: ReportRow[]
  /** টোটাল সারি — কলাম সংখ্যার সমান, খালি স্ট্রিং মানে ফাঁকা ঘর */
  totals?: string[]
  summary: SummaryItem[]
  notes?: string[]
}

/* ─────────────────────────────────────────────
   ডেটা ইনপুট
   ───────────────────────────────────────────── */

export interface ReportData {
  sales: Sale[]
  purchases: Purchase[]
  products: Product[]
  adjustments: StockAdjustment[]
  expenses: DbExpense[]
  entries: LedgerEntry[]
  collections: DbCollection[]
  customers: DbCustomer[]
  branches: DbBranch[]
  users: DbUser[]
}

export interface ReportInput {
  /** YYYY-MM-DD — খালি হলে শুরু থেকে */
  from: string
  /** YYYY-MM-DD — খালি হলে আজ পর্যন্ত */
  to: string
  /** YYYY-MM (মাসিক রিপোর্ট) */
  month: string
  productId?: string
  customerId?: string
  supplier?: string
  category?: string
  paymentType?: 'নগদ' | 'বাকি' | ''
  method?: string
  expenseKind?: 'shop' | 'owner' | ''
  txType?: string
  search?: string
  scope: ReportScope
}

export interface ReportFilterSpec {
  /** 'required' = থেকে/পর্যন্ত দুটোই, 'optional' = শুধু পর্যন্ত (শুরু থেকে) */
  dateRange?: 'required' | 'optional'
  singleDate?: boolean
  month?: boolean
  product?: boolean
  customer?: boolean
  supplier?: boolean
  category?: boolean
  paymentType?: boolean
  method?: boolean
  expenseKind?: boolean
  txType?: boolean
  search?: boolean
}

/* ─────────────────────────────────────────────
   ফরম্যাটিং (সব বাংলা সংখ্যায়)
   ───────────────────────────────────────────── */

export const r2 = (n: number) => Math.round(n * 100) / 100
export const bnNum = (n: number, digits = 0) =>
  n.toLocaleString('bn-BD', { maximumFractionDigits: digits })
export const bnMoney = (n: number) => `৳ ${bnNum(n, 2)}`
export const bnQty = (n: number, unit?: string) => `${bnNum(n, 3)}${unit ? ` ${unit}` : ''}`

/** সংখ্যা → বাংলা অঙ্ক, হাজার-বিভাজক ছাড়া (তারিখের অংশের জন্য জরুরি: ২০২৬ ≠ ২,০২৬) */
const bnDigits = (n: number) => n.toLocaleString('bn-BD', { useGrouping: false, maximumFractionDigits: 0 })

export function bnDate(date: string): string {
  const [y, m, d] = date.slice(0, 10).split('-')
  if (!y || !m || !d) return date
  return `${bnDigits(Number(d))}/${bnDigits(Number(m))}/${bnDigits(Number(y))}`
}

export function bnDateTime(date = new Date()): string {
  return `${bnDate(toDateKey(date))}, ${date.toLocaleTimeString('bn-BD', { hour: 'numeric', minute: '2-digit' })}`
}

export function bnMonthLabel(month: string): string {
  const [y, m] = month.split('-')
  if (!y || !m) return month
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('bn-BD', { month: 'long', year: 'numeric' })
}

export function rangePeriod(from: string, to: string): string {
  if (!from && !to) return 'সব সময়'
  if (from && to) return from === to ? bnDate(from) : `${bnDate(from)} থেকে ${bnDate(to)}`
  if (from) return `${bnDate(from)} থেকে`
  return `শুরু থেকে ${bnDate(to)}`
}

/* ─────────────────────────────────────────────
   ফিল্টার হেল্পার
   ───────────────────────────────────────────── */

export const inBranch = (branchId: string | undefined, scope: ReportScope) =>
  (!scope.branchId || branchId === scope.branchId) &&
  (!scope.branchIds || !scope.branchIds.length || scope.branchIds.includes(branchId || ''))

export const within = (date: string, from: string, to: string) => {
  const d = date.slice(0, 10)
  return (!from || d >= from) && (!to || d <= to)
}

export const before = (date: string, limit: string) => (!limit ? false : date.slice(0, 10) < limit)

export const monthRange = (month: string): { from: string; to: string } => {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return { from: '', to: '' }
  return {
    from: toDateKey(new Date(y, m - 1, 1)),
    to: toDateKey(new Date(y, m, 0)),
  }
}

export const nowMonth = () => toDateKey(new Date()).slice(0, 7)

/* ─────────────────────────────────────────────
   রিপোর্ট ক্যাটালগ (মেনুর কার্ড + ফিল্টার)
   ───────────────────────────────────────────── */

export interface ReportDefinition {
  kind: ReportKind
  label: string
  desc: string
  filters: ReportFilterSpec
}

export const REPORT_CATALOG: ReportDefinition[] = [
  {
    kind: 'sales',
    label: 'বিক্রি রিপোর্ট',
    desc: 'তারিখ, পণ্য, ক্রেতা, নগদ/বাকি, পরিমাণ ও মোট বিক্রি',
    filters: { dateRange: 'required', product: true, customer: true, paymentType: true },
  },
  {
    kind: 'purchase',
    label: 'ক্রয় রিপোর্ট',
    desc: 'তারিখ, পণ্য, সাপ্লায়ার, পরিমাণ, ক্রয় দর ও মোট ক্রয়',
    filters: { dateRange: 'required', product: true, supplier: true },
  },
  {
    kind: 'stock',
    label: 'স্টক রিপোর্ট',
    desc: 'ওপেনিং স্টক, মোট ক্রয়, মোট বিক্রয়, বর্তমান স্টক ও মূল্য',
    filters: { dateRange: 'optional', product: true, category: true },
  },
  {
    kind: 'customerDue',
    label: 'ক্রেতার বাকি রিপোর্ট',
    desc: 'বাকিতে বিক্রি, আদায় ও বর্তমান বাকি (ক্রেতাভিত্তিক)',
    filters: { dateRange: 'optional', customer: true },
  },
  {
    kind: 'collection',
    label: 'বাকি আদায় রিপোর্ট',
    desc: 'তারিখ, ক্রেতা, পেমেন্ট পদ্ধতি ও আদায়ের মোট',
    filters: { dateRange: 'required', customer: true, method: true },
  },
  {
    kind: 'expense',
    label: 'খরচ রিপোর্ট',
    desc: 'তারিখ, খরচের খাত, বিবরণ ও মোট খরচ',
    filters: { dateRange: 'required', category: true, expenseKind: true },
  },
  {
    kind: 'dailyProfit',
    label: 'দৈনিক লাভ রিপোর্ট',
    desc: 'এক দিনের বিক্রি, ক্রয়মূল্য, খরচ ও নিট লাভ',
    filters: { singleDate: true },
  },
  {
    kind: 'monthlyProfit',
    label: 'মাসিক লাভ রিপোর্ট',
    desc: 'মাসের বিক্রি, ক্রয়, খরচ, নিট লাভ, বাকি ও স্টক মূল্য',
    filters: { month: true },
  },
  {
    kind: 'product',
    label: 'পণ্য রিপোর্ট',
    desc: 'ক্রয় দর, বিক্রয় দর, ওপেনিং ও বর্তমান স্টক',
    filters: { category: true, search: true },
  },
  {
    kind: 'transaction',
    label: 'লেনদেন রিপোর্ট',
    desc: 'সব লেনদেন একসাথে — সার্চ ও তারিখ ফিল্টারসহ',
    filters: { dateRange: 'required', txType: true, search: true },
  },
]

export const reportDefinition = (kind: ReportKind): ReportDefinition =>
  REPORT_CATALOG.find((r) => r.kind === kind) || REPORT_CATALOG[0]

/** লাভের রিপোর্ট — মালিক ও শাখা ব্যবস্থাপক দেখতে পারবেন, সেলস ম্যান নয় */
export const PROFIT_KINDS: ReportKind[] = ['dailyProfit', 'monthlyProfit']

/** সেলস ম্যান যে রিপোর্টগুলো দেখবে না (ক্রয়/খরচ/লেনদেন/লাভ) */
export const SALESMAN_HIDDEN_KINDS: ReportKind[] = ['purchase', 'expense', 'transaction', ...PROFIT_KINDS]

/** রোল অনুযায়ী দৃশ্যমান রিপোর্টের তালিকা */
export const reportsForRole = (role: 'owner' | 'manager' | 'salesman' | 'staff' | 'customer' | undefined): ReportDefinition[] =>
  role === 'salesman' ? REPORT_CATALOG.filter((d) => !SALESMAN_HIDDEN_KINDS.includes(d.kind)) : REPORT_CATALOG

export const TX_TYPES = [
  'বিক্রি',
  'ক্রয়',
  'আদায়',
  'সাপ্লায়ার পরিশোধ',
  'পুরোনো বাকি',
  'খরচ',
  'মালিকের টাকা তোলা',
] as const

export const PAYMENT_METHODS = ['নগদ টাকা', 'বিকাশ', 'নগদ', 'রকেট', 'ব্যাংক', 'চেক'] as const

/* ─────────────────────────────────────────────
   ফিল্টার অপশন (ডেটা থেকে)
   ───────────────────────────────────────────── */

export interface ReportOptions {
  products: { id: string; name: string }[]
  customers: { id: string; name: string }[]
  suppliers: string[]
  categories: string[]
  expenseCategories: string[]
  methods: string[]
}

export function reportOptions(data: ReportData, scope: ReportScope): ReportOptions {
  const products = data.products
    .filter((p) => inBranch(p.branch_id, scope))
    .map((p) => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'bn'))

  const customerMap = new Map<string, string>()
  data.customers
    .filter((c) => inBranch(c.branch_id, scope))
    .forEach((c) => customerMap.set(c.id, c.name))
  data.sales
    .filter((s) => inBranch(s.branch_id, scope) && s.customer_id && s.customer_name)
    .forEach((s) => customerMap.set(s.customer_id!, s.customer_name!))

  const suppliers = new Set<string>()
  data.purchases
    .filter((p) => inBranch(p.branch_id, scope) && p.supplier)
    .forEach((p) => suppliers.add(p.supplier!))
  data.entries
    .filter((e) => inBranch(e.branch_id, scope) && e.party_type === 'supplier' && !e.cancelled)
    .forEach((e) => suppliers.add(e.party_name))

  const expenseCategories = [...new Set(data.expenses.filter((e) => inBranch(e.branch_id, scope)).map((e) => e.category))]
  const methods = [
    ...new Set(
      data.entries
        .filter((e) => inBranch(e.branch_id, scope) && e.kind === 'payment' && !e.cancelled)
        .map((e) => e.method)
        .concat(data.collections.map((c) => c.payment_method || 'নগদ টাকা')),
    ),
  ].filter(Boolean)

  return {
    products,
    customers: [...customerMap.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'bn')),
    suppliers: [...suppliers].sort((a, b) => a.localeCompare(b, 'bn')),
    categories: [...new Set(data.products.map((p) => p.category).filter(Boolean))] as string[],
    expenseCategories: expenseCategories.sort((a, b) => a.localeCompare(b, 'bn')),
    methods,
  }
}

/* ─────────────────────────────────────────────
   WhatsApp শেয়ার টেক্সট (প্রতিটি রিপোর্টের জন্য আলাদা)
   ───────────────────────────────────────────── */

export function reportShareText(doc: ReportDocument, businessName: string, subtitle?: string): string {
  const lines = [
    `📄 *${doc.title}*`,
    `🏪 ${businessName}${subtitle ? ` • ${subtitle}` : ''}`,
    `📅 ${doc.period}`,
    '━━━━━━━━━━━━━━━',
  ]
  doc.summary.forEach((s) => lines.push(`${s.label}: *${s.value}*`))
  if (doc.totals) {
    const parts = doc.totals.filter((t) => t && t !== 'সর্বমোট')
    if (parts.length) lines.push('', `সর্বমোট: ${parts.join(' | ')}`)
  }
  lines.push('', 'বিস্তারিত A4 রিপোর্ট PDF সংযুক্ত করুন।', '— ShopLedGer')
  return lines.join('\n')
}
