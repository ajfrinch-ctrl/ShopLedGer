import type { Sale } from '../types'
import type { DbBranch, DbCustomer, DbCollection, DbUser, LedgerEntry } from './db'
import { ledgerRows, ledgerToday } from './ledger'
import { bnDate, bnMoney, bnNum, inBranch, r2, type ReportDocument, type ReportScope } from './reports/core'
import { phoneNumbers } from './shopProfile'

/**
 * ক্রেতার হিসাবের বিবরণী (statement) — লেজার + কেনাকাটার সারসংক্ষেপ।
 * প্রতিটি ক্রেতার জন্য আলাদা A4 PDF/প্রিন্ট ডকুমেন্ট।
 */
export function buildCustomerStatement(
  customer: DbCustomer,
  sales: Sale[],
  entries: LedgerEntry[],
  collections: DbCollection[],
  scope: ReportScope = {},
): ReportDocument {
  const mine = sales.filter((s) => s.customer_id === customer.id && inBranch(s.branch_id, scope) && s.date.slice(0, 10) <= ledgerToday())
  const rows = ledgerRows(customer.id, mine, [], entries, collections, { ...scope, through: ledgerToday() })

  const totalPurchase = mine.reduce((sum, s) => sum + s.total_amount, 0)
  const purchaseCount = mine.length
  const currentDue = rows[rows.length - 1]?.balance || 0
  const totalBilled = rows.reduce((sum, r) => sum + r.debit, 0)
  const totalPaid = rows.reduce((sum, r) => sum + r.credit, 0)
  const lastPayment = [...rows].reverse().find((r) => r.credit > 0)
  const lastPurchase = [...rows].reverse().find((r) => r.debit > 0)

  return {
    kind: 'customerDue',
    title: `ক্রেতার হিসাব বিবরণী — ${customer.name}`,
    period: 'বর্তমান অবস্থা (আজ পর্যন্ত)',
    filterNote: customer.phone ? `মোবাইল: ${customer.phone}` : undefined,
    columns: [
      { label: 'তারিখ', width: '16%' },
      { label: 'বিবরণ', width: '34%' },
      { label: 'বাকি (+)', align: 'right' },
      { label: 'জমা (−)', align: 'right' },
      { label: 'ব্যালেন্স', align: 'right' },
    ],
    rows: rows.map((r) => ({
      cells: [
        bnDate(r.date),
        r.label,
        r.debit ? bnMoney(r.debit) : '—',
        r.credit ? bnMoney(r.credit) : '—',
        bnMoney(r.balance),
      ],
    })),
    totals: ['সর্বমোট', '', bnMoney(r2(totalBilled)), bnMoney(r2(totalPaid)), bnMoney(r2(currentDue))],
    summary: [
      { label: 'বর্তমান বাকি', value: bnMoney(r2(currentDue)), tone: currentDue > 0 ? 'orange' : 'green' },
      { label: 'মোট কেনাকাটা', value: bnMoney(r2(totalPurchase)), tone: 'blue' },
      { label: 'বিল সংখ্যা', value: `${bnNum(purchaseCount)}টি`, tone: 'gray' },
      { label: 'মোট জমা', value: bnMoney(r2(totalPaid)), tone: 'teal' },
      { label: 'শেষ জমা', value: lastPayment ? `${bnDate(lastPayment.date)} — ${bnMoney(lastPayment.credit)}` : '—', tone: 'gray' },
      { label: 'শেষ কেনাকাটা', value: lastPurchase ? bnDate(lastPurchase.date) : '—', tone: 'gray' },
    ],
    notes: [
      'ব্যালেন্স = বাকিতে বিক্রি + পুরোনো বাকি − জমা (তারিখ অনুযায়ী ক্রমিক)।',
      'এটি দোকানের হিসাবের বিবরণী — কোনো ভুল থাকলে দোকানে জানান।',
    ],
  }
}

/** ক্রেতার হিসাব বিবরণীর A4 PDF ডকুমেন্ট তৈরি করে Statement এর জন্য */
export const statementFileName = (name: string) =>
  `statement-${name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'customer'}.pdf`

/** বাকি তাগাদার WhatsApp বার্তা (দোকান → ক্রেতা) */
export function dueReminderText(
  customer: DbCustomer,
  branch: DbBranch | undefined,
  currentDue: number,
  lastPaymentDate?: string,
): string {
  const shop = branch?.organization?.trim() || branch?.name || 'আমাদের দোকান'
  const lines = [
    `আসসালামু আলাইকুম ${customer.name},`,
    '',
    `${shop}-এ আপনার হিসাব অনুযায়ী বর্তমান বাকি: *${bnMoney(r2(currentDue))}*।`,
  ]
  if (lastPaymentDate) lines.push(`শেষ জমা: ${bnDate(lastPaymentDate)}।`)
  lines.push('', 'সুবিধামতো টাকা পরিশোধ করার জন্য অনুরোধ করছি। ধন্যবাদ।')
  return lines.join('\n')
}

/**
 * wa.me লিংক — দোকানের নম্বর থাকলে সেই নম্বরেই ক্রেতার নম্বর, না হলে ক্রেতার নম্বরে।
 * দোকানের ফোন ফিল্ডে একাধিক নম্বর (কমা দিয়ে) থাকলে প্রথমটিতে পাঠানো হয়।
 */
export function reminderWhatsAppLink(text: string, phone?: string): string {
  const clean = phoneNumbers(phone)[0] || ''
  const target = clean.length === 11 ? `88${clean}` : ''
  return `https://wa.me/${target}?text=${encodeURIComponent(text)}`
}

/** ক্রেতার বার্তা কাকে দেখানো হবে (দোকানের কাজে ব্যবহার) — বার্তার ধরন অনুযায়ী বাংলা লেবেল */
/** নাম মেলানোর একরকম রূপ — 'য়' (য+় vs য়) দুই রূপে লেখা হলেও একই নাম ধরা পড়বে */
export const normName = (s: string) => s.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()

export const MESSAGE_KINDS: Record<'payment' | 'due-info' | 'other', string> = {
  payment: 'টাকা দিয়েছি',
  'due-info': 'বাকির খোঁজ',
  other: 'অন্য বিষয়',
}

/** ক্রেতার বার্তার WhatsApp টেক্সট (ক্রেতাকে দেওয়া, দোকানে পাঠানোর জন্য) */
export function customerMessageText(input: {
  customerName: string
  shopName: string
  kind: 'payment' | 'due-info' | 'other'
  amount?: number
  method?: string
  note: string
  due: number
}): string {
  const lines = [
    `আসসালামু আলাইকুম ${input.shopName},`,
    `আমি ${input.customerName}।`,
    '',
    `📌 ${MESSAGE_KINDS[input.kind]}`,
  ]
  if (input.amount) lines.push(`💰 টাকা: ${bnMoney(input.amount)}`)
  if (input.method) lines.push(`💳 মাধ্যম: ${input.method}`)
  if (input.kind === 'payment' || input.kind === 'due-info') lines.push(`📄 আমার হিসাবে বাকি: ${bnMoney(r2(input.due))}`)
  if (input.note.trim()) lines.push(`📝 ${input.note.trim()}`)
  lines.push('', '— কর্ণফুলী সেলস সেন্টার')
  return lines.join('\n')
}

/** দোকানের কাছে বার্তা পাঠানোর জন্য নম্বর (শাখার ফোন) */
export const shopWhatsAppLink = (text: string, branchPhone?: string) =>
  reminderWhatsAppLink(text, branchPhone)

/**
 * দোকানের দিকের "অনুমোদনের অপেক্ষায়" তালিকা — ক্রেতা নিজে সাইন-আপ করা অ্যাকাউন্ট।
 * দোকানের কর্মচারী দেখতে পারে, কিন্তু অনুমোদন দিতে পারে শুধু মালিক।
 */
export function pendingCustomerUsers(users: DbUser[]): DbUser[] {
  return users
    .filter((u) => u.role === 'customer' && u.approval === 'pending')
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
}
