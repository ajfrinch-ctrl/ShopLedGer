/**
 * রসিদের structured কাঠামো — PDF renderer-এর জন্য।
 *
 * রসিদের হিসাব HTML-এ যেমন দেখা যায় হুবহু সেই মানগুলোই এখানে ReportDocument
 * আকারে সাজানো হয় (কোনো নতুন হিসাব নয়) — তাই একই renderer দিয়ে native PDF
 * তৈরি হয়, আলাদা PDF কোড লাগে না।
 */
import type { Sale } from '../../types'
import { money } from '../ledger'
import type { LedgerEntry } from '../db'
import { bnDate, bnNum, type ReportDocument } from './core'

export interface ReceiptDetail {
  label: string
  value: string
  strong?: boolean
}

export interface ReceiptPdf {
  document: ReportDocument
  details: ReceiptDetail[]
}

const timeOf = (date: string): string => {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })
}

/** বিক্রি রসিদ: পণ্যের টেবিল + মোট (ক্রেতার রসিদে লাভ কখনো যায় না) */
export function saleReceiptDocument(
  sale: Sale,
  extras: { customerPhone?: string; customerAddress?: string } = {},
): ReceiptPdf {
  const subtotal =
    sale.subtotal ??
    sale.items.reduce((sum, item) => sum + (item.total || item.quantity * item.sale_price), 0)
  const discount =
    sale.discount !== undefined ? sale.discount : Math.max(0, subtotal - sale.total_amount)

  const rows = sale.items.map((item) => ({
    cells: [
      item.product_name || '—',
      `${bnNum(item.quantity, 3)}${item.unit ? ` ${item.unit}` : ''}`,
      money(item.sale_price),
      money(item.total),
    ],
  }))

  const document: ReportDocument = {
    kind: 'sales',
    title: 'বিক্রি রসিট',
    period: `${bnDate(sale.date)}${timeOf(sale.date) ? `, ${timeOf(sale.date)}` : ''}`,
    columns: [
      { label: 'পণ্য', width: '46%' },
      { label: 'পরিমাণ', align: 'right' },
      { label: 'দর', align: 'right' },
      { label: 'মোট', align: 'right' },
    ],
    rows,
    totals: rows.length ? ['সর্বমোট', '', '', money(sale.total_amount)] : undefined,
    notes: sale.note ? [`মন্তব্য: ${sale.note}`] : [],
  }

  const details: ReceiptDetail[] = [{ label: 'রসিদ নং', value: sale.id }]
  details.push({ label: 'তারিখ', value: document.period })
  if (sale.customer_name) details.push({ label: 'ক্রেতা', value: sale.customer_name, strong: true })
  if (extras.customerPhone) details.push({ label: 'মোবাইল', value: extras.customerPhone })
  if (extras.customerAddress) details.push({ label: 'ঠিকানা', value: extras.customerAddress })
  if (discount > 0) {
    details.push({ label: 'বিক্রিত দাম', value: money(subtotal) })
    details.push({ label: 'মোট ডিস্কাউন্ট', value: `− ${money(discount)}` })
  }
  details.push({ label: 'সর্বমোট প্রদেয়', value: money(sale.total_amount), strong: true })
  details.push({ label: 'পেমেন্ট', value: sale.payment_type })

  return { document, details }
}

/** টাকা আদায়/পরিশোধের রসিদ — লেবেল → মান সারি (কোনো নতুন হিসাব নয়) */
export function ledgerReceiptDocument(
  entry: LedgerEntry,
  extras: { balance: number; partyPhone?: string; partyAddress?: string },
): ReceiptPdf {
  const partyLabel = entry.party_type === 'customer' ? 'ক্রেতা' : 'সাপ্লায়ার'
  const outstanding = entry.party_type === 'customer' ? 'পাওনা' : 'দেনা'
  const title = entry.party_type === 'customer' ? 'টাকা আদায়ের রসিদ' : 'টাকা পরিশোধের রসিদ'

  const document: ReportDocument = {
    kind: 'transaction',
    title: `${title}${entry.cancelled ? ' — বাতিল' : ''}`,
    period: bnDate(entry.date),
    columns: [],
    rows: [],
    notes: entry.cancelled ? ['এই রসিদটি বাতিল করা হয়েছে।'] : [],
  }

  const details: ReceiptDetail[] = [
    { label: 'রসিদ নং', value: entry.id },
    { label: 'তারিখ', value: bnDate(entry.date) },
    { label: partyLabel, value: entry.party_name, strong: true },
  ]
  if (extras.partyPhone) details.push({ label: 'মোবাইল', value: extras.partyPhone })
  if (extras.partyAddress) details.push({ label: 'ঠিকানা', value: extras.partyAddress })
  details.push({ label: 'টাকা', value: money(entry.amount), strong: true })
  details.push({ label: 'মাধ্যম', value: entry.method || '—' })
  if (entry.reference) details.push({ label: 'রেফারেন্স', value: entry.reference })
  details.push({ label: `লেনদেনের পর ${outstanding}`, value: money(extras.balance), strong: true })
  if (entry.note) details.push({ label: 'মন্তব্য', value: entry.note })

  return { document, details }
}
