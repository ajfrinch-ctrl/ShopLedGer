import type { Sale } from '../types'
import type { DbCollection, DbCustomer, LedgerEntry } from './db'
import { ledgerRows, ledgerToday } from './ledger'
import { bnDate, bnMoney, r2, type ReportDocument } from './reports/core'

/** A customer-visible, read-only purchase-history line. Values are calculated from
 * existing sales and ledger records; this module never creates or changes a record. */
export interface CustomerPurchaseHistoryRow {
  key: string
  date: string
  receiptNo: string
  productDescription: string
  totalPurchase: number
  paid: number
  /** Running account balance on this transaction date. */
  due: number
  source: 'sale' | 'payment' | 'opening'
}

export interface CustomerStatementRange {
  /** YYYY-MM-DD, blank means the beginning of the saved history. */
  from?: string
  /** YYYY-MM-DD, blank means today. Future dates are capped at today for a current statement. */
  to?: string
}

export interface CustomerPurchaseStatement {
  rows: CustomerPurchaseHistoryRow[]
  totalPurchase: number
  totalPaid: number
  totalDue: number
  document: ReportDocument
  range: Required<CustomerStatementRange>
}

const dateKey = (value: string) => value.slice(0, 10)

const within = (date: string, from: string, to: string) =>
  (!from || dateKey(date) >= from) && dateKey(date) <= to

const descriptionForSale = (sale: Sale) => {
  const items = sale.items || []
  if (items.length) {
    return items
      .map((item) => `${item.product_name} × ${item.quantity.toLocaleString('bn-BD')}${item.unit ? ` ${item.unit}` : ''}`)
      .join(', ')
  }
  return sale.note?.trim() || 'পণ্যের বিবরণ নেই'
}

const periodLabel = (from: string, to: string) => {
  if (from) return `${bnDate(from)} থেকে ${bnDate(to)} পর্যন্ত`
  return `শুরু থেকে ${bnDate(to)} পর্যন্ত`
}

/**
 * Builds the customer-facing statement from immutable history.
 *
 * A cash sale counts as a purchase and as paid at its receipt. A due sale, opening
 * balance and later collection use the established `ledgerRows` ordering and balance,
 * so no payment allocation or ledger rule is reimplemented in the interface.
 */
export function buildCustomerPurchaseStatement(
  customer: DbCustomer,
  sales: Sale[],
  entries: LedgerEntry[],
  collections: DbCollection[],
  selected: CustomerStatementRange = {},
): CustomerPurchaseStatement {
  const today = ledgerToday()
  const to = selected.to && selected.to < today ? selected.to : today
  const from = selected.from && selected.from <= to ? selected.from : ''
  const mine = sales.filter((sale) => sale.customer_id === customer.id && dateKey(sale.date) <= to)
  const account = ledgerRows(customer.id, mine, [], entries, collections, { through: to })
  const saleById = new Map(mine.map((sale) => [sale.id, sale]))
  const dueSaleIds = new Set(account.filter((row) => row.source === 'sale').map((row) => row.id))
  const entryById = new Map(entries.map((entry) => [entry.id, entry]))

  const accountRows: Array<CustomerPurchaseHistoryRow & { order: string; debitFirst: boolean; isLedgerMovement: boolean }> = account.map((row) => {
    const sale = row.source === 'sale' ? saleById.get(row.id) : undefined
    const entry = row.source === 'ledger' ? entryById.get(row.id) : undefined
    const source: CustomerPurchaseHistoryRow['source'] = sale
      ? 'sale'
      : entry?.kind === 'opening'
        ? 'opening'
        : 'payment'
    const productDescription = sale
      ? descriptionForSale(sale)
      : entry?.kind === 'opening'
        ? 'পুরোনো বাকি'
        : `${row.label}${entry?.method ? ` — ${entry.method}` : ''}`

    return {
      key: `${row.source}:${row.id}`,
      date: dateKey(row.date),
      receiptNo: row.id,
      productDescription,
      totalPurchase: sale ? sale.total_amount : 0,
      paid: row.credit,
      due: row.balance,
      source,
      order: row.order || row.date,
      debitFirst: row.debit > 0,
      isLedgerMovement: true,
    }
  })

  // Cash purchases are intentionally absent from the due ledger. Add them to the
  // history without affecting the trusted running customer balance.
  const cashRows: Array<CustomerPurchaseHistoryRow & { order: string; debitFirst: boolean; isLedgerMovement: boolean }> = mine
    .filter((sale) => !dueSaleIds.has(sale.id))
    .map((sale) => ({
      key: `cash-sale:${sale.id}`,
      date: dateKey(sale.date),
      receiptNo: sale.id,
      productDescription: descriptionForSale(sale),
      totalPurchase: sale.total_amount,
      paid: sale.total_amount,
      due: 0,
      source: 'sale' as const,
      order: sale.created_at || sale.date,
      debitFirst: true,
      isLedgerMovement: false,
    }))

  let latestDue = 0
  const history = [...accountRows, ...cashRows]
    .sort((a, b) =>
      a.date.localeCompare(b.date) ||
      Number(b.debitFirst) - Number(a.debitFirst) ||
      a.order.localeCompare(b.order) ||
      a.key.localeCompare(b.key),
    )
    .map((row) => {
      // A cash sale never changes a due balance, but its statement line should still
      // show the account balance at that point in the preserved chronology.
      const due = row.isLedgerMovement ? row.due : latestDue
      if (row.isLedgerMovement) latestDue = row.due
      return { ...row, due }
    })
    .filter((row) => within(row.date, from, to))
    .map(({ order: _order, debitFirst: _debitFirst, isLedgerMovement: _isLedgerMovement, ...row }) => row)

  const totalPurchase = r2(history.reduce((sum, row) => sum + row.totalPurchase, 0))
  const totalPaid = r2(history.reduce((sum, row) => sum + row.paid, 0))
  // Closing due is deliberately calculated over all records through the selected end
  // date, including an opening balance before the visible date range.
  const totalDue = r2(account[account.length - 1]?.balance || 0)
  const customerInfo = [
    `ক্রেতা: ${customer.name}`,
    `মোবাইল: ${customer.phone || 'নেই'}`,
    `Customer ID: ${customer.id}`,
  ].join(' • ')

  const document: ReportDocument = {
    kind: 'customerDue',
    title: 'ক্রয় হিস্ট্রি / Statement',
    period: periodLabel(from, to),
    filterNote: customerInfo,
    columns: [
      { label: 'তারিখ', width: '12%' },
      { label: 'Receipt No.', width: '17%' },
      { label: 'পণ্যের বিবরণ', width: '31%', align: 'left' },
      { label: 'মোট ক্রয়', align: 'right' },
      { label: 'পরিশোধ', align: 'right' },
      { label: 'বাকি', align: 'right' },
    ],
    rows: history.map((row) => ({
      cells: [
        bnDate(row.date),
        row.receiptNo,
        row.productDescription,
        row.totalPurchase ? bnMoney(r2(row.totalPurchase)) : '—',
        row.paid ? bnMoney(r2(row.paid)) : '—',
        bnMoney(r2(row.due)),
      ],
    })),
    totals: ['সর্বমোট', '', '', bnMoney(totalPurchase), bnMoney(totalPaid), bnMoney(totalDue)],
    summary: [
      { label: 'মোট ক্রয়', value: bnMoney(totalPurchase), tone: 'blue' },
      { label: 'মোট পরিশোধ', value: bnMoney(totalPaid), tone: 'teal' },
      { label: 'মোট বাকি', value: bnMoney(totalDue), tone: totalDue > 0 ? 'orange' : 'green' },
    ],
    notes: [
      'বাকি কলামে নির্বাচিত শেষ তারিখ পর্যন্ত চলতি হিসাব দেখানো হয়েছে।',
      'তারিখ ফিল্টার শুধু দেখার জন্য; মূল হিসাব বা পুরোনো লেনদেন পরিবর্তন করে না।',
    ],
  }

  return { rows: history, totalPurchase, totalPaid, totalDue, document, range: { from, to } }
}
