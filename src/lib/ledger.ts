import { db, type LedgerEntry } from './db'
import { yymmdd, nextIdSync } from './idGenerator'
import { isManagerLevel, isShopRole, staffBranchIds } from './roles'
import type { Purchase, Sale } from '../types'
import type { AuthUser } from '../stores/authStore'

export type PartyType = LedgerEntry['party_type']
export const supplierId = (name: string) => `supplier:${name.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()}`
export const money = (n: number) => `৳ ${n.toLocaleString('bn-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const cents = (n: number) => Math.round(n * 100)
export const ledgerToday = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
export interface LedgerScope {
  branchId?: string
  branchIds?: string[]
  through?: string
}
export const ledgerScopeFor = (user: AuthUser | null): LedgerScope =>
  user?.role === 'owner' ? {} : { branchIds: staffBranchIds(user) }
export const inLedgerScope = (row: { branch_id: string; date?: string }, scope: LedgerScope) =>
  (!scope.branchId || row.branch_id === scope.branchId) &&
  (!scope.branchIds || scope.branchIds.includes(row.branch_id)) &&
  (!scope.through || !row.date || row.date.slice(0, 10) <= scope.through)

export interface LedgerRow {
  order?: string
  id: string
  source: 'sale' | 'purchase' | 'ledger' | 'legacy'
  date: string
  branch_id: string
  label: string
  debit: number
  credit: number
  balance: number
}
export interface LegacyPayment {
  id: string
  customer_id: string
  date: string
  branch_id: string
  amount: number
}

/** Customer receivables and supplier payables are separate accounts, even if IDs collide.
 * Defaults to a customer account: supplier callers must explicitly request that type. */
export function ledgerRows(
  party: string,
  sales: Sale[],
  purchases: Purchase[],
  entries: LedgerEntry[],
  collections: LegacyPayment[] = [],
  options: LedgerScope & { partyType?: PartyType } = {},
): LedgerRow[] {
  const type = options.partyType || 'customer'
  const rows: Omit<LedgerRow, 'balance'>[] = []
  if (type === 'customer') {
    sales.filter(s => s.customer_id === party && s.payment_type === 'বাকি' && inLedgerScope(s, options)).forEach(s => rows.push({
      id: s.id, source: 'sale', order: s.created_at, date: s.date, branch_id: s.branch_id,
      label: 'বিক্রয় বিল', debit: cents(s.total_amount), credit: 0,
    }))
    collections.filter(c => c.customer_id === party && inLedgerScope(c, options)).forEach(c => rows.push({
      id: c.id, source: 'legacy', date: c.date, branch_id: c.branch_id,
      label: 'পূর্বের আদায়', debit: 0, credit: cents(c.amount),
    }))
  } else {
    purchases.filter(p => p.supplier && supplierId(p.supplier) === party && p.payment_type === 'বাকি' && inLedgerScope(p, options)).forEach(p => rows.push({
      id: p.id, source: 'purchase', order: p.created_at, date: p.date, branch_id: p.branch_id,
      label: 'ক্রয় বিল', debit: cents(p.total), credit: 0,
    }))
  }
  entries.filter(e => e.party_id === party && e.party_type === type && !e.cancelled && inLedgerScope(e, options)).forEach(e => rows.push({
    id: e.id, source: 'ledger', order: e.created_at, date: e.date, branch_id: e.branch_id,
    label: e.kind === 'opening' ? (type === 'customer' ? 'পুরোনো পাওনা' : 'পুরোনো দেনা') : (type === 'customer' ? 'আদায়' : 'পরিশোধ'),
    debit: e.kind === 'opening' ? cents(e.amount) : 0, credit: e.kind === 'payment' ? cents(e.amount) : 0,
  }))
  let balance = 0
  return rows.sort((a, b) => a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)) ||
    Number(a.credit > 0) - Number(b.credit > 0) || (a.order || a.date).localeCompare(b.order || b.date) ||
    a.source.localeCompare(b.source) || a.id.localeCompare(b.id))
    .map(r => {
      balance += r.debit - r.credit
      return { ...r, debit: r.debit / 100, credit: r.credit / 100, balance: balance / 100 }
    })
}

/** Safe backdated payment capacity: reserve amounts already paid on later dates. */
export function paymentCapacity(rows: LedgerRow[], date: string): number {
  let balance = 0
  for (const row of rows) {
    if (row.date.slice(0, 10) <= date) balance = row.balance
  }
  for (const row of rows) {
    if (row.date.slice(0, 10) > date) balance = Math.min(balance, row.balance)
  }
  return Math.max(0, balance)
}

export const validLedgerDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return y >= 100 && date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

/** Payments cannot consume invisible debt, a different party type's balance, or future bills.
 * expected: null for creation, original snapshot for editing; protects against stale forms/ID collisions. */
export async function saveLedgerEntry(
  entry: LedgerEntry,
  actor: AuthUser,
  sales: Sale[],
  purchases: Purchase[],
  reason = '',
  expected?: LedgerEntry | null,
  newCustomer = false,
) {
  await db.transaction('rw', db.ledgerEntries, db.ledgerAudits, db.branches, db.collections, db.customers, async () => {
    const before = await db.ledgerEntries.get(entry.id)
    const scope = ledgerScopeFor(actor)
    if (!isShopRole(actor.role) || (entry.party_type === 'supplier' && !isManagerLevel(actor.role)) ||
      !inLedgerScope(entry, scope) || (before && !inLedgerScope(before, scope)))
      throw new Error('এই খাতা বা শাখার লেনদেন পরিবর্তনের অনুমতি নেই')
    if (expected === null && before) throw new Error('এই লেনদেন ইতিমধ্যে সংরক্ষিত। খাতা রিফ্রেশ করে আবার চেষ্টা করুন।')
    if (expected && (!before || JSON.stringify(before) !== JSON.stringify(expected)))
      throw new Error('লেনদেনটি ইতিমধ্যে পরিবর্তিত হয়েছে। খাতা রিফ্রেশ করে আবার খুলুন।')
    // Inactive branches may still have old entries that need correction/cancellation.
    const branch = await db.branches.get(entry.branch_id)
    if (!branch || (!branch.is_active && !before)) throw new Error('সক্রিয় শাখা নির্বাচন করুন')
    if (!entry.id.trim() || !entry.party_id.trim() || !entry.party_name.trim() ||
      !['customer', 'supplier'].includes(entry.party_type) || !['opening', 'payment'].includes(entry.kind) ||
      typeof entry.cancelled !== 'boolean' || !Number.isFinite(entry.amount) || entry.amount <= 0 ||
      !Number.isSafeInteger(cents(entry.amount)) || Math.abs(cents(entry.amount) - entry.amount * 100) > 0.0001 ||
      !validLedgerDate(entry.date))
      throw new Error('সঠিক নাম, তারিখ ও টাকার পরিমাণ দিন (সর্বোচ্চ দুই দশমিক)')
    if (entry.date > ledgerToday() && !(before && entry.cancelled && entry.date === before.date))
      throw new Error('ভবিষ্যতের তারিখে বাকি বা টাকা গ্রহণ/পরিশোধ লেখা যাবে না')
    if (entry.party_type === 'supplier' && entry.party_id !== supplierId(entry.party_name))
      throw new Error('সাপ্লায়ারের নাম ও পরিচয় মিলছে না')
    if (entry.kind === 'payment' && !entry.method.trim()) throw new Error('পেমেন্টের মাধ্যম নির্বাচন করুন')
    if (!before && entry.cancelled)
      throw new Error('অবৈধ নতুন লেনদেন')
    if (before && (!reason.trim() || before.cancelled)) throw new Error('পরিবর্তনের কারণ দিন; বাতিল এন্ট্রি পরিবর্তন করা যাবে না')
    if (before && (before.party_id !== entry.party_id || before.party_type !== entry.party_type || before.kind !== entry.kind || before.branch_id !== entry.branch_id))
      throw new Error('ব্যক্তি, খাতার ধরন ও শাখা পরিবর্তন করা যাবে না')
    if (newCustomer && await db.customers.get(entry.party_id)) throw new Error('ক্রেতার আইডি ইতিমধ্যে ব্যবহৃত হয়েছে। নতুন খাতার ফর্ম আবার খুলুন।')
    const normalized: LedgerEntry = { ...entry, party_name: entry.party_name.trim(), method: entry.method.trim(),
      created_by: before?.created_by || actor.id, created_at: before?.created_at || new Date().toISOString() }
    const entries = (await db.ledgerEntries.toArray()).filter(e => e.id !== entry.id)
    const collections = await db.collections.toArray()
    const rows = ledgerRows(entry.party_id, sales, purchases, [...entries, normalized], collections, { ...scope, partyType: entry.party_type })
    const consolidated = ledgerRows(entry.party_id, sales, purchases, [...entries, normalized], collections, { partyType: entry.party_type })
    if (rows.some(r => cents(r.balance) < 0) || consolidated.some(r => cents(r.balance) < 0))
      throw new Error('বকেয়ার বেশি আদায়/পরিশোধ বা আগের তারিখে ঋণাত্মক ব্যালেন্স করা যাবে না')
    if (entry.party_type === 'customer' && !(await db.customers.get(entry.party_id))) {
      await db.customers.add({ id: entry.party_id, name: normalized.party_name, branch_id: entry.branch_id, created_at: normalized.created_at })
    }
    await db.ledgerEntries.put(normalized)
    const audId = nextIdSync('AUD', yymmdd(new Date()), (await db.ledgerAudits.toArray()).map(a => a.id), 3)
    await db.ledgerAudits.add({ id: audId, entry_id: entry.id, actor: actor.name, actor_id: actor.id,
      at: new Date().toISOString(), action: before ? (entry.cancelled ? 'বাতিল' : 'সংশোধন') : 'নতুন',
      before, after: normalized, reason: reason.trim() })
  })
}
