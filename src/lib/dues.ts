import type { DbCollection, DbCustomer, LedgerEntry } from './db'
import type { Purchase, Sale } from '../types'
import { cents, inLedgerScope, supplierId, type LedgerScope, type PartyType } from './ledger'

export interface DebtData {
  sales: Sale[]
  purchases: Purchase[]
  entries: LedgerEntry[]
  collections: DbCollection[]
  customers: DbCustomer[]
}
export interface DebtAccount {
  id: string
  name: string
  phone?: string
  billed: number
  paid: number
  balance: number
  lastDate: string
}

/** One pass over each source; never net one person's advance against someone else's debt. */
export function debtAccounts(type: PartyType, data: DebtData, scope: LedgerScope = {}): DebtAccount[] {
  const accounts = new Map<string, DebtAccount>()
  const touch = (id: string, name: string, date = '') => {
    let account = accounts.get(id)
    if (!account) { account = { id, name, billed: 0, paid: 0, balance: 0, lastDate: '' }; accounts.set(id, account) }
    if (date > account.lastDate) account.lastDate = date
    return account
  }
  if (type === 'customer') {
    for (const s of data.sales) {
      if (!s.customer_id || !inLedgerScope(s, scope)) continue
      const a = touch(s.customer_id, s.customer_name || s.customer_id, s.date.slice(0, 10))
      if (s.payment_type === 'বাকি') a.billed += cents(s.total_amount)
    }
    for (const c of data.collections) {
      if (inLedgerScope(c, scope)) touch(c.customer_id, c.customer_name, c.date.slice(0, 10)).paid += cents(c.amount)
    }
  } else {
    for (const p of data.purchases) {
      if (!p.supplier?.trim() || !inLedgerScope(p, scope)) continue
      const a = touch(supplierId(p.supplier), p.supplier.trim(), p.date.slice(0, 10))
      if (p.payment_type === 'বাকি') a.billed += cents(p.total)
    }
  }
  for (const e of data.entries) {
    if (e.cancelled || e.party_type !== type || !inLedgerScope(e, scope)) continue
    const a = touch(e.party_id, e.party_name, e.date)
    if (e.kind === 'opening') a.billed += cents(e.amount)
    else if (e.kind === 'payment') a.paid += cents(e.amount)
  }
  if (type === 'customer') {
    for (const c of data.customers) {
      if (!inLedgerScope(c, scope)) continue
      const a = touch(c.id, c.name)
      a.name = c.name
      a.phone = c.phone
    }
  }
  return [...accounts.values()].map(a => ({ ...a, balance: (a.billed - a.paid) / 100, billed: a.billed / 100, paid: a.paid / 100 }))
    .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name, 'bn') || a.id.localeCompare(b.id))
}

/** Accrual (credit trade) is not cash movement (collection/payment). */
export function dailyDebtActivity(data: Omit<DebtData, 'customers'>, date: string, scope: LedgerScope = {}) {
  const onDay = (row: { branch_id: string; date: string }) => inLedgerScope(row, scope) && row.date.slice(0, 10) === date
  const creditSales = data.sales.filter(s => onDay(s) && s.payment_type === 'বাকি').reduce((s, x) => s + cents(x.total_amount), 0)
  const creditPurchases = data.purchases.filter(p => onDay(p) && p.payment_type === 'বাকি').reduce((s, x) => s + cents(x.total), 0)
  let collected = data.collections.filter(onDay).reduce((s, x) => s + cents(x.amount), 0)
  let paid = 0
  for (const e of data.entries) {
    if (!onDay(e) || e.cancelled || e.kind !== 'payment') continue
    if (e.party_type === 'customer') collected += cents(e.amount)
    else if (e.party_type === 'supplier') paid += cents(e.amount)
  }
  return { creditSales: creditSales / 100, creditPurchases: creditPurchases / 100, collected: collected / 100, paid: paid / 100 }
}
