import type { Sale, Product } from '../../types'
import { computeStock } from '../stock'
import { collectionRecords, type CollectionRecord } from '../report'
import {
  PAYMENT_METHODS,
  TX_TYPES,
  before,
  bnDate,
  bnMoney,
  bnMonthLabel,
  bnNum,
  bnQty,
  inBranch,
  monthRange,
  r2,
  rangePeriod,
  reportDefinition,
  within,
  type ReportData,
  type ReportDocument,
  type ReportInput,
  type ReportKind,
  type ReportRow,
  type SummaryItem,
} from './core'

/** বিস্তারিত টেবিলে সর্বোচ্চ কত সারি (বেশি হলে নোট দেখানো হয়) */
const MAX_ROWS = 500

const saleName = (s: Sale) => s.customer_name?.trim() || 'নগদ ক্রেতা'

const productFilter = (input: ReportInput, productId: string) => !input.productId || input.productId === productId

/* ═════════════════════════════════════════════
   ১. বিক্রি রিপোর্ট
   ═════════════════════════════════════════════ */

function buildSales(input: ReportInput, data: ReportData): ReportDocument {
  const sales = data.sales.filter(
    (s) =>
      inBranch(s.branch_id, input.scope) &&
      within(s.date, input.from, input.to) &&
      (!input.paymentType || s.payment_type === input.paymentType) &&
      (!input.customerId || s.customer_id === input.customerId),
  )

  const rows: ReportRow[] = []
  let quantity = 0
  let amount = 0
  let cash = 0
  let due = 0
  let itemLines = 0
  let totalDiscount = 0

  for (const s of sales) {
    totalDiscount += s.discount || 0
    const isDue = s.payment_type === 'বাকি'
    const items = s.items.length
      ? s.items
      : [{ product_id: '', product_name: '—', quantity: 0, unit: '', sale_price: 0, total: s.total_amount, profit: s.total_profit }]

    for (const item of items) {
      if (!productFilter(input, item.product_id)) continue
      itemLines += 1
      quantity += item.quantity
      amount += item.total
      if (isDue) due += item.total
      else cash += item.total
      rows.push({
        cells: [
          bnDate(s.date),
          item.product_name,
          saleName(s),
          s.payment_type,
          bnQty(item.quantity, item.unit),
          bnMoney(item.sale_price),
          bnMoney(item.total),
        ],
      })
    }
  }

  const summary: SummaryItem[] = [
    { label: 'মোট বিক্রি', value: bnMoney(r2(amount)), tone: 'blue' },
    { label: 'নগদ বিক্রি', value: bnMoney(r2(cash)), tone: 'green' },
    { label: 'বাকিতে বিক্রি', value: bnMoney(r2(due)), tone: 'orange' },
    ...(totalDiscount > 0 ? [{ label: 'মোট ডিস্কাউন্ট', value: bnMoney(r2(totalDiscount)), tone: 'red' as const }] : []),
    { label: 'বিল সংখ্যা', value: `${bnNum(sales.length)}টি`, tone: 'gray' },
    { label: 'বিক্রিত পরিমাণ', value: bnNum(quantity, 3), tone: 'gray' },
    { label: 'আইটেম লাইন', value: `${bnNum(itemLines)}টি`, tone: 'gray' },
  ]

  const notes: string[] = []
  if (input.paymentType) notes.push(`শুধু ${input.paymentType} বিক্রি দেখানো হয়েছে।`)
  if (sales.length && rows.length > MAX_ROWS) notes.push(`সর্বশেষ ${bnNum(MAX_ROWS)}টি সারি দেখানো হয়েছে।`)

  return {
    kind: 'sales',
    title: 'বিক্রি রিপোর্ট',
    period: rangePeriod(input.from, input.to),
    filterNote: filterNoteText(input, data),
    columns: [
      { label: 'তারিখ', width: '14%' },
      { label: 'পণ্য', width: '26%' },
      { label: 'ক্রেতা', width: '20%' },
      { label: 'ধরন' },
      { label: 'পরিমাণ', align: 'right' },
      { label: 'দর', align: 'right' },
      { label: 'বিক্রয় মূল্য', align: 'right' },
    ],
    rows: rows.slice(0, MAX_ROWS),
    totals: ['সর্বমোট', '', '', '', bnNum(quantity, 3), '', bnMoney(r2(amount))],
    summary,
    notes,
  }
}

/* ═════════════════════════════════════════════
   ২. ক্রয় রিপোর্ট
   ═════════════════════════════════════════════ */

function buildPurchase(input: ReportInput, data: ReportData): ReportDocument {
  const purchases = data.purchases.filter(
    (p) =>
      inBranch(p.branch_id, input.scope) &&
      within(p.date, input.from, input.to) &&
      productFilter(input, p.product_id) &&
      (!input.supplier || p.supplier === input.supplier),
  )

  let quantity = 0
  let total = 0
  let cash = 0
  let due = 0
  let legacy = 0
  const invoices = new Set<string>()

  const rows: ReportRow[] = purchases.map((p) => {
    quantity += p.quantity
    total += p.total
    if (p.payment_type === 'বাকি') due += p.total
    else {
      cash += p.total
      if (!p.payment_type) legacy += 1
    }
    if (p.invoice_id) invoices.add(p.invoice_id)
    return {
      cells: [
        bnDate(p.date),
        p.product_name,
        p.supplier || '—',
        bnQty(p.quantity, p.unit),
        bnMoney(p.purchase_price),
        bnMoney(p.total),
      ],
    }
  })

  const notes: string[] = []
  if (legacy) notes.push(`${bnNum(legacy)}টি পুরোনো ক্রয়ে পেমেন্টের ধরন লেখা নেই — সেগুলো নগদ ধরা হয়েছে।`)
  if (rows.length > MAX_ROWS) notes.push(`সর্বশেষ ${bnNum(MAX_ROWS)}টি সারি দেখানো হয়েছে।`)

  return {
    kind: 'purchase',
    title: 'ক্রয় রিপোর্ট',
    period: rangePeriod(input.from, input.to),
    filterNote: filterNoteText(input, data),
    columns: [
      { label: 'তারিখ', width: '14%' },
      { label: 'পণ্য', width: '28%' },
      { label: 'সাপ্লায়ার', width: '20%' },
      { label: 'পরিমাণ', align: 'right' },
      { label: 'ক্রয় দর', align: 'right' },
      { label: 'ক্রয় মূল্য', align: 'right' },
    ],
    rows: rows.slice(0, MAX_ROWS),
    totals: ['সর্বমোট', '', '', bnNum(quantity, 3), '', bnMoney(r2(total))],
    summary: [
      { label: 'মোট ক্রয়', value: bnMoney(r2(total)), tone: 'purple' },
      { label: 'নগদ ক্রয়', value: bnMoney(r2(cash)), tone: 'green' },
      { label: 'বাকি ক্রয়', value: bnMoney(r2(due)), tone: 'orange' },
      { label: 'চালান সংখ্যা', value: `${bnNum(invoices.size)}টি`, tone: 'gray' },
      { label: 'ক্রয় পরিমাণ', value: bnNum(quantity, 3), tone: 'gray' },
      { label: 'সাপ্লায়ার', value: `${bnNum(new Set(purchases.map((p) => p.supplier).filter(Boolean)).size)}জন`, tone: 'gray' },
    ],
    notes,
  }
}

/* ═════════════════════════════════════════════
   ৩. স্টক রিপোর্ট
   ═════════════════════════════════════════════ */

function stockAsOf(products: Product[], data: ReportData, limit: string, scope: ReportInput['scope']) {
  const purchasedBefore = new Map<string, number>()
  const soldBefore = new Map<string, number>()
  const adjustedBefore = new Map<string, number>()

  if (limit) {
    data.purchases
      .filter((p) => inBranch(p.branch_id, scope) && before(p.date, limit))
      .forEach((p) => purchasedBefore.set(p.product_id, (purchasedBefore.get(p.product_id) || 0) + p.quantity))
    data.sales
      .filter((s) => inBranch(s.branch_id, scope) && before(s.date, limit))
      .forEach((s) =>
        s.items.forEach((i) => soldBefore.set(i.product_id, (soldBefore.get(i.product_id) || 0) + i.quantity)),
      )
    data.adjustments
      .filter((a) => inBranch(a.branch_id, scope) && before(a.date, limit))
      .forEach((a) => adjustedBefore.set(a.product_id, (adjustedBefore.get(a.product_id) || 0) + a.quantity))
  }

  const map = new Map<string, number>()
  for (const p of products) {
    map.set(
      p.id,
      (p.opening_stock || 0) + (purchasedBefore.get(p.id) || 0) - (soldBefore.get(p.id) || 0) + (adjustedBefore.get(p.id) || 0),
    )
  }
  return map
}

function buildStock(input: ReportInput, data: ReportData): ReportDocument {
  const products = data.products.filter(
    (p) =>
      inBranch(p.branch_id, input.scope) &&
      (!input.category || p.category === input.category) &&
      productFilter(input, p.id),
  )

  const openingMap = stockAsOf(products, data, input.from, input.scope)
  const purchasedMap = new Map<string, number>()
  const soldMap = new Map<string, number>()
  const adjustedMap = new Map<string, number>()

  data.purchases
    .filter((p) => inBranch(p.branch_id, input.scope) && within(p.date, input.from, input.to))
    .forEach((p) => purchasedMap.set(p.product_id, (purchasedMap.get(p.product_id) || 0) + p.quantity))
  data.sales
    .filter((s) => inBranch(s.branch_id, input.scope) && within(s.date, input.from, input.to))
    .forEach((s) =>
      s.items.forEach((i) => soldMap.set(i.product_id, (soldMap.get(i.product_id) || 0) + i.quantity)),
    )
  data.adjustments
    .filter((a) => inBranch(a.branch_id, input.scope) && within(a.date, input.from, input.to))
    .forEach((a) => adjustedMap.set(a.product_id, (adjustedMap.get(a.product_id) || 0) + a.quantity))

  let purchaseValue = 0
  let saleValue = 0
  let lowStock = 0

  const rows: ReportRow[] = products.map((p) => {
    const opening = openingMap.get(p.id) || 0
    const purchased = purchasedMap.get(p.id) || 0
    const sold = soldMap.get(p.id) || 0
    const adjusted = adjustedMap.get(p.id) || 0
    const current = r2(opening + purchased - sold + adjusted)
    const pv = r2(Math.max(0, current) * p.purchase_price)
    const sv = r2(Math.max(0, current) * p.sale_price)
    purchaseValue += pv
    saleValue += sv
    if ((p.min_stock ?? 0) > 0 && current <= (p.min_stock ?? 0)) lowStock += 1

    return {
      cells: [
        p.name,
        bnQty(opening, p.unit),
        bnQty(purchased, p.unit),
        bnQty(sold, p.unit),
        bnQty(current, p.unit),
        bnMoney(pv),
        bnMoney(sv),
      ],
    }
  })

  const notes = [
    input.from
      ? `ওপেনিং স্টক = ${bnDate(input.from)} তারিখের শুরুর স্টক; বর্তমান স্টক = ওপেনিং + মোট ক্রয় − মোট বিক্রয় ± সমন্বয়।`
      : 'ওপেনিং স্টক = পণ্যের প্রারম্ভিক স্টক; বর্তমান স্টক = ওপেনিং + মোট ক্রয় − মোট বিক্রয় ± সমন্বয়।',
    'একক আলাদা হওয়ায় পরিমাণের সমষ্টি দেখানো হয়নি; মূল্য বাংলা সংখ্যায়।',
  ]

  return {
    kind: 'stock',
    title: 'স্টক রিপোর্ট',
    period: input.from ? rangePeriod(input.from, input.to) : 'সব সময় (আজ পর্যন্ত)',
    filterNote: filterNoteText(input, data),
    columns: [
      { label: 'পণ্য', width: '30%' },
      { label: 'ওপেনিং স্টক', align: 'right' },
      { label: 'মোট ক্রয়', align: 'right' },
      { label: 'মোট বিক্রয়', align: 'right' },
      { label: 'বর্তমান স্টক', align: 'right' },
      { label: 'ক্রয় মূল্য', align: 'right' },
      { label: 'বিক্রয় মূল্য', align: 'right' },
    ],
    rows: rows.slice(0, MAX_ROWS),
    totals: ['সর্বমোট', '', '', '', '', bnMoney(r2(purchaseValue)), bnMoney(r2(saleValue))],
    summary: [
      { label: 'মোট ক্রয় মূল্য', value: bnMoney(r2(purchaseValue)), tone: 'purple' },
      { label: 'মোট বিক্রয় মূল্য', value: bnMoney(r2(saleValue)), tone: 'blue' },
      { label: 'সম্ভাব্য লাভ', value: bnMoney(r2(saleValue - purchaseValue)), tone: 'teal' },
      { label: 'পণ্য সংখ্যা', value: `${bnNum(products.length)}টি`, tone: 'gray' },
      { label: 'লো-স্টক পণ্য', value: `${bnNum(lowStock)}টি`, tone: lowStock ? 'red' : 'gray' },
    ],
    notes,
  }
}

/* ═════════════════════════════════════════════
   ৪. ক্রেতার বাকি রিপোর্ট
   ═════════════════════════════════════════════ */

interface DueAccount {
  id: string
  name: string
  phone?: string
  dueSales: number
  collected: number
  balance: number
}

export function dueAccounts(data: ReportData, scope: ReportInput['scope'], from: string, to: string): DueAccount[] {
  const map = new Map<string, DueAccount>()
  const touch = (id: string, name: string): DueAccount => {
    let acc = map.get(id)
    if (!acc) {
      acc = { id, name, dueSales: 0, collected: 0, balance: 0 }
      map.set(id, acc)
    }
    if (name) acc.name = name
    return acc
  }

  for (const s of data.sales) {
    if (s.payment_type !== 'বাকি' || !s.customer_id) continue
    if (!inBranch(s.branch_id, scope)) continue
    if (to && s.date.slice(0, 10) > to) continue
    const acc = touch(s.customer_id, s.customer_name || 'নাম নেই')
    if (within(s.date, from, to)) acc.dueSales += s.total_amount
    acc.balance += s.total_amount
  }

  for (const e of data.entries) {
    if (e.cancelled || !inBranch(e.branch_id, scope)) continue
    if (to && e.date.slice(0, 10) > to) continue
    const acc = touch(e.party_id, e.party_name)
    if (e.kind === 'opening') acc.balance += e.amount
    else {
      if (within(e.date, from, to)) acc.collected += e.amount
      acc.balance -= e.amount
    }
  }

  for (const c of data.collections) {
    if (!inBranch(c.branch_id, scope)) continue
    if (to && c.date.slice(0, 10) > to) continue
    const acc = touch(c.customer_id, c.customer_name)
    if (within(c.date, from, to)) acc.collected += c.amount
    acc.balance -= c.amount
  }

  for (const c of data.customers) {
    const acc = map.get(c.id)
    if (acc && c.phone) acc.phone = c.phone
  }

  return [...map.values()].map((a) => ({
    ...a,
    dueSales: r2(a.dueSales),
    collected: r2(a.collected),
    balance: r2(a.balance),
  }))
}

function buildCustomerDue(input: ReportInput, data: ReportData): ReportDocument {
  const accounts = dueAccounts(data, input.scope, input.from, input.to)
    .filter((a) => (!input.customerId || a.id === input.customerId) && (a.balance > 0.005 || a.dueSales > 0 || a.collected > 0))
    .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name, 'bn'))

  const rows: ReportRow[] = accounts.map((a) => ({
    cells: [a.name, a.phone || '—', bnMoney(a.dueSales), bnMoney(a.collected), bnMoney(a.balance)],
    emphasis: a.balance > 0.005 && false,
  }))

  const totals = accounts.reduce(
    (acc, a) => {
      acc[0] += a.dueSales
      acc[1] += a.collected
      acc[2] += a.balance
      return acc
    },
    [0, 0, 0],
  )

  const withDue = accounts.filter((a) => a.balance > 0.005)
  const top = withDue[0]

  return {
    kind: 'customerDue',
    title: 'ক্রেতার বাকি রিপোর্ট',
    period: rangePeriod(input.from, input.to),
    filterNote: filterNoteText(input, data),
    columns: [
      { label: 'ক্রেতা', width: '34%' },
      { label: 'ফোন' },
      { label: 'বাকিতে বিক্রি', align: 'right' },
      { label: 'আদায়', align: 'right' },
      { label: 'বর্তমান বাকি', align: 'right' },
    ],
    rows: rows.slice(0, MAX_ROWS),
    totals: ['সর্বমোট', '', bnMoney(r2(totals[0])), bnMoney(r2(totals[1])), bnMoney(r2(totals[2]))],
    summary: [
      { label: 'মোট বাকি', value: bnMoney(r2(withDue.reduce((s, a) => s + a.balance, 0))), tone: 'orange' },
      { label: 'বাকিওয়ালা ক্রেতা', value: `${bnNum(withDue.length)}জন`, tone: 'gray' },
      { label: 'এই সময়ের বাকি বিক্রি', value: bnMoney(r2(totals[0])), tone: 'red' },
      { label: 'এই সময়ের আদায়', value: bnMoney(r2(totals[1])), tone: 'green' },
      { label: 'সর্বোচ্চ বাকি', value: top ? bnMoney(top.balance) : bnMoney(0), tone: 'purple' },
      { label: 'সর্বোচ্চ বাকিওয়ালা', value: top?.name || '—', tone: 'gray' },
    ],
    notes: ['বর্তমান বাকি = বাকিতে বিক্রি + পুরোনো বাকি − আদায় (নির্বাচিত সময় পর্যন্ত)।'],
  }
}

/* ═════════════════════════════════════════════
   ৫. বাকি আদায় রিপোর্ট
   ═════════════════════════════════════════════ */

function buildCollection(input: ReportInput, data: ReportData): ReportDocument {
  const records: CollectionRecord[] = collectionRecords(data.entries, data.collections, input.scope).filter(
    (c) =>
      within(c.date, input.from, input.to) &&
      (!input.customerId || c.customerId === input.customerId) &&
      (!input.method || c.method === input.method),
  )

  const total = records.reduce((s, c) => s + c.amount, 0)
  const largest = records.reduce<CollectionRecord | null>((best, c) => (!best || c.amount > best.amount ? c : best), null)

  return {
    kind: 'collection',
    title: 'বাকি আদায় রিপোর্ট',
    period: rangePeriod(input.from, input.to),
    filterNote: filterNoteText(input, data),
    columns: [
      { label: 'তারিখ', width: '18%' },
      { label: 'ক্রেতা', width: '40%' },
      { label: 'পেমেন্ট পদ্ধতি' },
      { label: 'টাকা', align: 'right' },
    ],
    rows: records.slice(0, MAX_ROWS).map((c) => ({
      cells: [bnDate(c.date), c.customerName, c.method, bnMoney(c.amount)],
    })),
    totals: ['সর্বমোট', '', '', bnMoney(r2(total))],
    summary: [
      { label: 'মোট আদায়', value: bnMoney(r2(total)), tone: 'teal' },
      { label: 'আদায় সংখ্যা', value: `${bnNum(records.length)}টি`, tone: 'gray' },
      { label: 'গড় আদায়', value: bnMoney(records.length ? r2(total / records.length) : 0), tone: 'blue' },
      { label: 'সবচেয়ে বড় আদায়', value: largest ? bnMoney(largest.amount) : bnMoney(0), tone: 'green' },
      { label: 'সর্বোচ্চ আদায়কারী', value: largest?.customerName || '—', tone: 'gray' },
      { label: 'আদায়কারী ক্রেতা', value: `${bnNum(new Set(records.map((c) => c.customerId)).size)}জন`, tone: 'gray' },
    ],
  }
}

/* ═════════════════════════════════════════════
   ৬. খরচ রিপোর্ট
   ═════════════════════════════════════════════ */

function buildExpense(input: ReportInput, data: ReportData): ReportDocument {
  const expenses = data.expenses.filter(
    (e) =>
      inBranch(e.branch_id, input.scope) &&
      within(e.date, input.from, input.to) &&
      (!input.category || e.category === input.category) &&
      (!input.expenseKind || (e.kind === 'owner' ? 'owner' : 'shop') === input.expenseKind),
  )

  const total = expenses.reduce((s, e) => s + e.amount, 0)
  const shop = expenses.filter((e) => e.kind !== 'owner').reduce((s, e) => s + e.amount, 0)
  const owner = total - shop

  return {
    kind: 'expense',
    title: 'খরচ রিপোর্ট',
    period: rangePeriod(input.from, input.to),
    filterNote: filterNoteText(input, data),
    columns: [
      { label: 'তারিখ', width: '16%' },
      { label: 'খরচের খাত', width: '26%' },
      { label: 'বিবরণ', width: '38%' },
      { label: 'টাকা', align: 'right' },
    ],
    rows: expenses.slice(0, MAX_ROWS).map((e) => ({
      cells: [bnDate(e.date), e.category, e.note?.trim() || e.payment_method || '—', bnMoney(e.amount)],
    })),
    totals: ['সর্বমোট', '', '', bnMoney(r2(total))],
    summary: [
      { label: 'মোট খরচ', value: bnMoney(r2(total)), tone: 'red' },
      { label: 'দোকানের খরচ', value: bnMoney(r2(shop)), tone: 'orange' },
      { label: 'মালিকের টাকা তোলা', value: bnMoney(r2(owner)), tone: 'purple' },
      { label: 'খাত সংখ্যা', value: `${bnNum(new Set(expenses.map((e) => e.category)).size)}টি`, tone: 'gray' },
      { label: 'এন্ট্রি সংখ্যা', value: `${bnNum(expenses.length)}টি`, tone: 'gray' },
    ],
    notes: ['দোকানের খরচ নিট লাভ থেকে বাদ যায়; মালিকের ব্যক্তিগত টাকা তোলা লাভ থেকে বাদ যায় না।'],
  }
}

/* ═════════════════════════════════════════════
   ৭. দৈনিক লাভ রিপোর্ট
   ═════════════════════════════════════════════ */

function dayKey(input: ReportInput) {
  return input.to || input.from
}

function buildDailyProfit(input: ReportInput, data: ReportData): ReportDocument {
  const day = dayKey(input)
  const sales = data.sales.filter((s) => inBranch(s.branch_id, input.scope) && within(s.date, day, day))
  const expenses = data.expenses.filter(
    (e) => inBranch(e.branch_id, input.scope) && within(e.date, day, day) && e.kind !== 'owner',
  )
  const collected = collectionRecords(data.entries, data.collections, input.scope)
    .filter((c) => within(c.date, day, day))
    .reduce((s, c) => s + c.amount, 0)

  const revenue = r2(sales.reduce((s, x) => s + x.total_amount, 0))
  const grossProfit = r2(sales.reduce((s, x) => s + x.total_profit, 0))
  const cogs = r2(revenue - grossProfit)
  const expenseTotal = r2(expenses.reduce((s, x) => s + x.amount, 0))
  const netProfit = r2(grossProfit - expenseTotal)
  const dueSales = r2(sales.filter((s) => s.payment_type === 'বাকি').reduce((s, x) => s + x.total_amount, 0))
  const cashSales = r2(revenue - dueSales)

  return {
    kind: 'dailyProfit',
    title: 'দৈনিক লাভ রিপোর্ট',
    period: bnDate(day),
    filterNote: filterNoteText(input, data),
    columns: [
      { label: 'বিবরণ', width: '62%' },
      { label: 'পরিমাণ', align: 'right' },
    ],
    rows: [
      { cells: ['মোট বিক্রি', bnMoney(revenue)] },
      { cells: ['(−) বিক্রিত পণ্যের ক্রয়মূল্য', bnMoney(cogs)] },
      { cells: ['গ্রস লাভ', bnMoney(grossProfit)], emphasis: true },
      { cells: ['(−) দোকানের খরচ', bnMoney(expenseTotal)] },
      { cells: ['নিট লাভ', bnMoney(netProfit)], emphasis: true },
      { cells: ['নগদ বিক্রি', bnMoney(cashSales)] },
      { cells: ['বাকিতে বিক্রি', bnMoney(dueSales)] },
      { cells: ['এই দিনের বাকি আদায়', bnMoney(r2(collected))] },
    ],
    summary: [
      { label: 'মোট বিক্রি', value: bnMoney(revenue), tone: 'blue' },
      { label: 'গ্রস লাভ', value: bnMoney(grossProfit), tone: 'green' },
      { label: 'দোকানের খরচ', value: bnMoney(expenseTotal), tone: 'orange' },
      { label: netProfit < 0 ? 'নিট ক্ষতি' : 'নিট লাভ', value: bnMoney(Math.abs(netProfit)), tone: netProfit < 0 ? 'red' : 'teal' },
    ],
    notes: [
      `বিল সংখ্যা: ${bnNum(sales.length)}টি • খরচ এন্ট্রি: ${bnNum(expenses.length)}টি`,
      'পণ্য ক্রয় স্টকে যোগ হয়, তাই সরাসরি লাভ থেকে বাদ যায় না — বিক্রির সময় প্রতিটি পণ্যের ক্রয়মূল্য ধরা হয়েছে।',
    ],
  }
}

/* ═════════════════════════════════════════════
   ৮. মাসিক লাভ রিপোর্ট
   ═════════════════════════════════════════════ */

function buildMonthlyProfit(input: ReportInput, data: ReportData): ReportDocument {
  const { from, to } = monthRange(input.month)
  const sales = data.sales.filter((s) => inBranch(s.branch_id, input.scope) && within(s.date, from, to))
  const purchases = data.purchases.filter((p) => inBranch(p.branch_id, input.scope) && within(p.date, from, to))
  const expenses = data.expenses.filter(
    (e) => inBranch(e.branch_id, input.scope) && within(e.date, from, to) && e.kind !== 'owner',
  )
  const collected = r2(
    collectionRecords(data.entries, data.collections, input.scope)
      .filter((c) => within(c.date, from, to))
      .reduce((s, c) => s + c.amount, 0),
  )

  const revenue = r2(sales.reduce((s, x) => s + x.total_amount, 0))
  const grossProfit = r2(sales.reduce((s, x) => s + x.total_profit, 0))
  const cogs = r2(revenue - grossProfit)
  const purchaseTotal = r2(purchases.reduce((s, x) => s + x.total, 0))
  const expenseTotal = r2(expenses.reduce((s, x) => s + x.amount, 0))
  const netProfit = r2(grossProfit - expenseTotal)
  const dueSales = r2(sales.filter((s) => s.payment_type === 'বাকি').reduce((s, x) => s + x.total_amount, 0))

  const closingDue = r2(
    dueAccounts(data, input.scope, '', to)
      .filter((a) => a.balance > 0.005)
      .reduce((s, a) => s + a.balance, 0),
  )

  // মাস শেষে স্টকের মূল্য (সেই তারিখ পর্যন্ত সব ক্রয়-বিক্রি ধরে)
  const stockValue = r2(
    data.products
      .filter((p) => inBranch(p.branch_id, input.scope))
      .reduce((sum, p) => {
        const stock = computeStock(
          [p],
          data.purchases.filter((x) => before(x.date, to) || within(x.date, to, to)),
          data.sales.filter((x) => before(x.date, to) || within(x.date, to, to)),
          data.adjustments.filter((x) => before(x.date, to) || within(x.date, to, to)),
        )[0]
        return sum + Math.max(0, stock?.currentStock || 0) * p.purchase_price
      }, 0),
  )

  return {
    kind: 'monthlyProfit',
    title: 'মাসিক লাভ রিপোর্ট',
    period: bnMonthLabel(input.month),
    filterNote: filterNoteText(input, data),
    columns: [
      { label: 'বিবরণ', width: '62%' },
      { label: 'পরিমাণ', align: 'right' },
    ],
    rows: [
      { cells: ['মোট বিক্রি', bnMoney(revenue)] },
      { cells: ['(−) মোট পণ্য ক্রয়', bnMoney(purchaseTotal)] },
      { cells: ['(−) বিক্রিত পণ্যের ক্রয়মূল্য', bnMoney(cogs)] },
      { cells: ['গ্রস লাভ', bnMoney(grossProfit)], emphasis: true },
      { cells: ['(−) দোকানের খরচ', bnMoney(expenseTotal)] },
      { cells: ['নিট লাভ', bnMoney(netProfit)], emphasis: true },
      { cells: ['বাকিতে বিক্রি', bnMoney(dueSales)] },
      { cells: ['বাকি আদায়', bnMoney(collected)] },
      { cells: ['সমাপনী বাকি (পাওনা)', bnMoney(closingDue)] },
      { cells: ['স্টক মূল্য (ক্রয়মূল্যে)', bnMoney(stockValue)] },
    ],
    summary: [
      { label: 'মোট বিক্রি', value: bnMoney(revenue), tone: 'blue' },
      { label: 'গ্রস লাভ', value: bnMoney(grossProfit), tone: 'green' },
      { label: 'মোট খরচ', value: bnMoney(expenseTotal), tone: 'orange' },
      { label: netProfit < 0 ? 'নিট ক্ষতি' : 'নিট লাভ', value: bnMoney(Math.abs(netProfit)), tone: netProfit < 0 ? 'red' : 'teal' },
    ],
    notes: [
      `মোট পণ্য ক্রয় স্টকে যোগ হয়, লাভ থেকে বাদ যায় না (তথ্যের জন্য দেখানো)।`,
      `মাসে বিল: ${bnNum(sales.length)}টি • বাকি আদায়: ${bnNum(collectionRecords(data.entries, data.collections, input.scope).filter((c) => within(c.date, from, to)).length)}টি`,
    ],
  }
}

/* ═════════════════════════════════════════════
   ৯. পণ্য রিপোর্ট
   ═════════════════════════════════════════════ */

function buildProduct(input: ReportInput, data: ReportData): ReportDocument {
  // শাখা-স্কোপ ধরে স্টক (প্রতিটি শাখার স্টক আলাদা)
  const stockRows = computeStock(
    data.products.filter((p) => inBranch(p.branch_id, input.scope)),
    data.purchases.filter((p) => inBranch(p.branch_id, input.scope)),
    data.sales.filter((s) => inBranch(s.branch_id, input.scope)),
    data.adjustments.filter((a) => inBranch(a.branch_id, input.scope)),
  )
  const stockById = new Map(stockRows.map((r) => [r.id, r]))
  const term = (input.search || '').trim().toLowerCase()

  const products = data.products.filter((p) => {
    if (!inBranch(p.branch_id, input.scope)) return false
    if (input.category && p.category !== input.category) return false
    if (!term) return true
    return [p.name, p.code, p.company, p.category].filter(Boolean).some((v) => v!.toLowerCase().includes(term))
  })

  let stockValue = 0
  let saleValue = 0

  const rows: ReportRow[] = products.map((p) => {
    const row = stockById.get(p.id)
    const current = row?.currentStock ?? p.opening_stock
    stockValue += Math.max(0, current) * p.purchase_price
    saleValue += Math.max(0, current) * p.sale_price
    return {
      cells: [
        p.company ? `${p.name} (${p.company})` : p.name,
        bnMoney(p.purchase_price),
        bnMoney(p.sale_price),
        bnQty(p.opening_stock, p.unit),
        bnQty(current, p.unit),
      ],
    }
  })

  return {
    kind: 'product',
    title: 'পণ্য রিপোর্ট',
    period: 'বর্তমান অবস্থা',
    filterNote: filterNoteText(input, data),
    columns: [
      { label: 'পণ্য', width: '40%' },
      { label: 'ক্রয় দর', align: 'right' },
      { label: 'বিক্রয় দর', align: 'right' },
      { label: 'ওপেনিং স্টক', align: 'right' },
      { label: 'বর্তমান স্টক', align: 'right' },
    ],
    rows: rows.slice(0, MAX_ROWS),
    totals: ['সর্বমোট পণ্য', `${bnNum(products.length)}টি`, '', '', ''],
    summary: [
      { label: 'পণ্য সংখ্যা', value: `${bnNum(products.length)}টি`, tone: 'gray' },
      { label: 'স্টক মূল্য (ক্রয়)', value: bnMoney(r2(stockValue)), tone: 'purple' },
      { label: 'স্টক মূল্য (বিক্রয়)', value: bnMoney(r2(saleValue)), tone: 'blue' },
      { label: 'সম্ভাব্য লাভ', value: bnMoney(r2(saleValue - stockValue)), tone: 'teal' },
    ],
    notes: ['বর্তমান স্টক = ওপেনিং + মোট ক্রয় − মোট বিক্রয় ± সমন্বয় (আজ পর্যন্ত)।'],
  }
}

/* ═════════════════════════════════════════════
   ১০. লেনদেন রিপোর্ট
   ═════════════════════════════════════════════ */

interface TxRow extends ReportRow {
  sortKey: string
  type: string
}

function buildTransaction(input: ReportInput, data: ReportData): ReportDocument {
  const rows: TxRow[] = []

  const push = (
    type: string,
    date: string,
    product: string,
    party: string,
    quantity: string,
    amount: number,
    status: string,
  ) => {
    rows.push({
      sortKey: date,
      type,
      cells: [bnDate(date), type, product, party, quantity, bnMoney(amount), status],
    })
  }

  for (const s of data.sales) {
    if (!inBranch(s.branch_id, input.scope) || !within(s.date, input.from, input.to)) continue
    const items = s.items.length
      ? s.items
      : [{ product_name: '—', quantity: 0, unit: '', total: s.total_amount }]
    for (const item of items)
      push('বিক্রি', s.date, item.product_name, saleName(s), bnQty(item.quantity, item.unit), item.total, s.payment_type)
  }

  for (const p of data.purchases) {
    if (!inBranch(p.branch_id, input.scope) || !within(p.date, input.from, input.to)) continue
    push('ক্রয়', p.date, p.product_name, p.supplier || '—', bnQty(p.quantity, p.unit), p.total, p.payment_type || '—')
  }

  for (const c of data.entries) {
    if (c.cancelled || !inBranch(c.branch_id, input.scope) || !within(c.date, input.from, input.to)) continue
    if (c.party_type === 'customer')
      push(c.kind === 'payment' ? 'আদায়' : 'পুরোনো বাকি', c.date, '—', c.party_name, '—', c.amount, c.method)
    else push(c.kind === 'payment' ? 'সাপ্লায়ার পরিশোধ' : 'পুরোনো দেনা', c.date, '—', c.party_name, '—', c.amount, c.method)
  }

  for (const c of data.collections) {
    if (!inBranch(c.branch_id, input.scope) || !within(c.date, input.from, input.to)) continue
    push('আদায়', c.date, '—', c.customer_name, '—', c.amount, c.payment_method || 'নগদ টাকা')
  }

  for (const e of data.expenses) {
    if (!inBranch(e.branch_id, input.scope) || !within(e.date, input.from, input.to)) continue
    push(e.kind === 'owner' ? 'মালিকের টাকা তোলা' : 'খরচ', e.date, '—', e.category, '—', e.amount, e.payment_method || 'নগদ')
  }

  const term = (input.search || '').trim().toLowerCase()
  const filtered = rows
    .filter((r) => !input.txType || r.type === input.txType)
    .filter((r) => !term || r.cells.some((c) => c.toLowerCase().includes(term)))
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey))

  const salesTotal = data.sales
    .filter((s) => inBranch(s.branch_id, input.scope) && within(s.date, input.from, input.to))
    .reduce((s, x) => s + x.total_amount, 0)
  const purchaseTotal = data.purchases
    .filter((p) => inBranch(p.branch_id, input.scope) && within(p.date, input.from, input.to))
    .reduce((s, x) => s + x.total, 0)
  const collected = collectionRecords(data.entries, data.collections, input.scope)
    .filter((c) => within(c.date, input.from, input.to))
    .reduce((s, c) => s + c.amount, 0)
  const expenseTotal = data.expenses
    .filter((e) => inBranch(e.branch_id, input.scope) && within(e.date, input.from, input.to))
    .reduce((s, e) => s + e.amount, 0)

  return {
    kind: 'transaction',
    title: 'লেনদেন রিপোর্ট',
    period: rangePeriod(input.from, input.to),
    filterNote: filterNoteText(input, data),
    columns: [
      { label: 'তারিখ', width: '13%' },
      { label: 'লেনদেনের ধরন', width: '15%' },
      { label: 'পণ্য', width: '20%' },
      { label: 'ক্রেতা / সাপ্লায়ার', width: '20%' },
      { label: 'পরিমাণ', align: 'right' },
      { label: 'টাকা', align: 'right' },
      { label: 'পেমেন্ট অবস্থা' },
    ],
    rows: filtered.slice(0, MAX_ROWS).map(({ cells, emphasis }) => ({ cells, emphasis })),
    summary: [
      { label: 'মোট লেনদেন', value: `${bnNum(filtered.length)}টি`, tone: 'gray' },
      { label: 'মোট বিক্রি', value: bnMoney(r2(salesTotal)), tone: 'blue' },
      { label: 'মোট ক্রয়', value: bnMoney(r2(purchaseTotal)), tone: 'purple' },
      { label: 'মোট আদায়', value: bnMoney(r2(collected)), tone: 'green' },
      { label: 'মোট খরচ', value: bnMoney(r2(expenseTotal)), tone: 'red' },
    ],
    notes: filtered.length > MAX_ROWS ? [`সর্বশেষ ${bnNum(MAX_ROWS)}টি লেনদেন দেখানো হয়েছে (মোট ${bnNum(filtered.length)}টি)।`] : [],
  }
}

/* ═════════════════════════════════════════════
   ফিল্টার নোট
   ═════════════════════════════════════════════ */

function filterNoteText(input: ReportInput, data: ReportData): string | undefined {
  const parts: string[] = []
  const product = data.products.find((p) => p.id === input.productId)
  if (product) parts.push(`পণ্য: ${product.name}`)
  const customer = data.customers.find((c) => c.id === input.customerId)
  if (customer) parts.push(`ক্রেতা: ${customer.name}`)
  if (input.supplier) parts.push(`সাপ্লায়ার: ${input.supplier}`)
  if (input.category) parts.push(`ক্যাটাগরি: ${input.category}`)
  if (input.paymentType) parts.push(`পেমেন্ট: ${input.paymentType}`)
  if (input.method) parts.push(`পদ্ধতি: ${input.method}`)
  if (input.expenseKind) parts.push(`খরচ: ${input.expenseKind === 'owner' ? 'মালিকের টাকা তোলা' : 'দোকানের খরচ'}`)
  if (input.txType) parts.push(`ধরন: ${input.txType}`)
  if (input.search) parts.push(`সার্চ: "${input.search}"`)
  return parts.length ? parts.join(' • ') : undefined
}

/* ═════════════════════════════════════════════
   ডিসপ্যাচার
   ═════════════════════════════════════════════ */

export function buildReport(kind: ReportKind, input: ReportInput, data: ReportData): ReportDocument {
  switch (kind) {
    case 'sales':
      return buildSales(input, data)
    case 'purchase':
      return buildPurchase(input, data)
    case 'stock':
      return buildStock(input, data)
    case 'customerDue':
      return buildCustomerDue(input, data)
    case 'collection':
      return buildCollection(input, data)
    case 'expense':
      return buildExpense(input, data)
    case 'dailyProfit':
      return buildDailyProfit(input, data)
    case 'monthlyProfit':
      return buildMonthlyProfit(input, data)
    case 'product':
      return buildProduct(input, data)
    case 'transaction':
      return buildTransaction(input, data)
    default:
      return buildSales(input, data)
  }
}

/** হেডারের জন্য রিপোর্টের নাম (ক্যাটালগ থেকে) */
export const reportTitle = (kind: ReportKind) => reportDefinition(kind).label

export const TX_TYPE_OPTIONS = TX_TYPES
export const METHOD_OPTIONS = PAYMENT_METHODS
