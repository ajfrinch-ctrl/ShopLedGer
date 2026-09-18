import type { Sale, Purchase, Expense } from '../types'

export type PeriodKind = 'daily' | 'monthly' | 'custom'

export interface DateRange {
  from: string // YYYY-MM-DD inclusive
  to: string // YYYY-MM-DD inclusive
}

export interface ProfitLossSummary {
  saleCount: number
  revenue: number // মোট বিক্রি
  cogs: number // বিক্রিত পণ্যের ক্রয়মূল্য
  grossProfit: number // গ্রস লাভ = revenue − cogs
  expenseTotal: number // মোট খরচ
  netProfit: number // নিট লাভ/ক্ষতি = grossProfit − expenseTotal
  purchaseTotal: number // সময়কালে পণ্য ক্রয় (নগদ প্রবাহ, লাভ থেকে বাদ যায় না)
  ownerDrawings: number // মালিকের ব্যক্তিগত টাকা তোলা (লাভ থেকে বাদ যায় না)
  dueSales: number // বাকিতে বিক্রি
  cashSales: number // নগদ বিক্রি
  expensesByCategory: { category: string; amount: number }[]
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function rangeFor(kind: PeriodKind, base = new Date(), custom?: DateRange): DateRange {
  if (kind === 'daily') {
    const k = toDateKey(base)
    return { from: k, to: k }
  }
  if (kind === 'monthly') {
    const from = toDateKey(new Date(base.getFullYear(), base.getMonth(), 1))
    const to = toDateKey(new Date(base.getFullYear(), base.getMonth() + 1, 0))
    return { from, to }
  }
  if (custom) {
    return custom.from <= custom.to ? custom : { from: custom.to, to: custom.from }
  }
  const k = toDateKey(base)
  return { from: k, to: k }
}

export function inRange(date: string, range: DateRange): boolean {
  const key = date.slice(0, 10)
  return key >= range.from && key <= range.to
}

/**
 * লাভ-ক্ষতি হিসাব।
 *  গ্রস লাভ  = মোট বিক্রি − বিক্রিত পণ্যের ক্রয়মূল্য
 *  নিট লাভ   = গ্রস লাভ − খরচ
 * পণ্য ক্রয় (purchases) স্টকে যোগ হয়, তাই এটি লাভ থেকে বাদ দেওয়া হয় না —
 * বিক্রির সময় প্রতিটি আইটেমের ক্রয়মূল্য ইতিমধ্যে ধরা হয়েছে।
 */
export function computeProfitLoss(
  sales: Sale[],
  expenses: Expense[],
  purchases: Purchase[],
  range: DateRange,
  branchId?: string,
): ProfitLossSummary {
  const byBranch = <T extends { branch_id: string }>(x: T) => !branchId || x.branch_id === branchId

  const s = sales.filter((x) => byBranch(x) && inRange(x.date, range))
  const allE = expenses.filter((x) => byBranch(x) && inRange(x.date, range))
  const e = allE.filter((x) => x.kind !== 'owner')
  const ownerDrawings = allE.filter((x) => x.kind === 'owner').reduce((sum, x) => sum + x.amount, 0)
  const p = purchases.filter((x) => byBranch(x) && inRange(x.date, range))

  const revenue = s.reduce((sum, x) => sum + x.total_amount, 0)
  const grossProfit = s.reduce((sum, x) => sum + x.total_profit, 0)
  const cogs = revenue - grossProfit
  const expenseTotal = e.reduce((sum, x) => sum + x.amount, 0)
  const purchaseTotal = p.reduce((sum, x) => sum + x.total, 0)
  const dueSales = s.filter((x) => x.payment_type === 'বাকি').reduce((sum, x) => sum + x.total_amount, 0)

  const catMap = new Map<string, number>()
  for (const x of e) catMap.set(x.category, (catMap.get(x.category) || 0) + x.amount)
  const expensesByCategory = [...catMap.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)

  return {
    saleCount: s.length,
    revenue,
    cogs,
    grossProfit,
    expenseTotal,
    netProfit: grossProfit - expenseTotal,
    purchaseTotal,
    ownerDrawings,
    dueSales,
    cashSales: revenue - dueSales,
    expensesByCategory,
  }
}

/** লোকাল (ডিভাইস) সময় অনুযায়ী ISO টাইমস্ট্যাম — UTC নয়, যাতে "আজ"-এর হিসাব সঠিক থাকে */
export function nowLocalISO(base = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${toDateKey(base)}T${p(base.getHours())}:${p(base.getMinutes())}:${p(base.getSeconds())}`
}
