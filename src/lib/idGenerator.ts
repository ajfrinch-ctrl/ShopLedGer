/**
 * ইউনিক আইডি জেনারেটর — বছর/মাস/দিন ভিত্তিক সিকোয়েন্স
 *
 * ফরম্যাট:
 *  - Customer:      CYYMMXXX  => C2609001 (C + 26 09 + 001)
 *  - Receipt:       RYYMMDDXXX => R260901001 (R + 26 09 01 + 001)
 *  - Transaction:   TYYMMXXX  => T2609001
 *  - Order:         OYYMMDDXXX => O260901001
 *  - Sale:          SYYMMDDXXX => S260901001
 *  - Purchase:      PYYMMDDXXX => P260901001
 *  - Expense:       EYYMMDDXXX => E260901001
 *  - Adjustment:    AYYMMDDXXX => A260901001
 *  - Product:       PRYYMMXXX => PR2609001
 *  - Branch:        BYYMMXXX
 *  - Collection:    R (receipt) same
 *  - Message:       MSGYYMMDDXXX
 *  - User (customer): CUYYMMXXX
 *  - Staff:         MYYMMXXX (manager), SLYYMMXXX (salesman)
 *
 * সব আইডি অটো-ইনক্রিমেন্ট, মাস/দিন অনুযায়ী রিসেট
 */

import { db } from './db'

function yy(d = new Date()): string {
  return String(d.getFullYear()).slice(-2).padStart(2, '0')
}
function mm(d = new Date()): string {
  return String(d.getMonth() + 1).padStart(2, '0')
}
function dd(d = new Date()): string {
  return String(d.getDate()).padStart(2, '0')
}

export const yymm = (d = new Date()): string => `${yy(d)}${mm(d)}`
export const yymmdd = (d = new Date()): string => `${yy(d)}${mm(d)}${dd(d)}`

/**
 * existingIds থেকে prefix+datePart দিয়ে শুরু হওয়া আইডিগুলোর সর্বোচ্চ সিকোয়েন্স বের করে পরেরটা দেয়
 */
export function nextSequentialId(
  prefix: string,
  datePart: string,
  existingIds: string[],
  pad = 3,
): string {
  const fullPrefix = `${prefix}${datePart}`
  let max = 0
  for (const id of existingIds) {
    if (!id.startsWith(fullPrefix)) continue
    const suffix = id.slice(fullPrefix.length)
    // suffix may contain non-digits (old ids) — only take leading digits
    const m = suffix.match(/^(\d+)/)
    if (!m) continue
    const num = parseInt(m[1], 10)
    if (!isNaN(num) && num > max) max = num
  }
  const next = max + 1
  // 999 পার হলে pad বাড়বে (1000 => 4 digit)
  const neededPad = Math.max(pad, String(next).length)
  return `${fullPrefix}${String(next).padStart(neededPad, '0')}`
}

/* ─────────────────────────────────────────────
   Async helpers — Dexie থেকে existing IDs নিয়ে
   ───────────────────────────────────────────── */

async function existingCustomerIds(): Promise<string[]> {
  try {
    const all = await db.customers.toArray()
    return all.map((c) => c.id)
  } catch {
    return []
  }
}

async function existingUserIds(): Promise<string[]> {
  try {
    const all = await db.users.toArray()
    return all.map((u) => u.id)
  } catch {
    return []
  }
}

async function existingOrderIds(): Promise<string[]> {
  try {
    const all = await db.orders.toArray()
    return all.map((o) => o.id)
  } catch {
    return []
  }
}

async function existingLedgerIds(): Promise<string[]> {
  try {
    const all = await db.ledgerEntries.toArray()
    return all.map((e) => e.id)
  } catch {
    return []
  }
}

async function existingCollectionIds(): Promise<string[]> {
  try {
    const all = await db.collections.toArray()
    return all.map((c) => c.id)
  } catch {
    return []
  }
}

async function existingExpenseIds(): Promise<string[]> {
  try {
    const all = await db.expenses.toArray()
    return all.map((e) => e.id)
  } catch {
    return []
  }
}

async function existingAdjustmentIds(): Promise<string[]> {
  try {
    const all = await db.stockAdjustments.toArray()
    return all.map((a) => a.id)
  } catch {
    return []
  }
}

async function existingBranchIds(): Promise<string[]> {
  try {
    const all = await db.branches.toArray()
    return all.map((b) => b.id)
  } catch {
    return []
  }
}

async function existingProductIds(): Promise<string[]> {
  try {
    const all = await db.products.toArray()
    return all.map((p) => p.id)
  } catch {
    return []
  }
}

async function existingPurchaseIdsFromDexie(): Promise<string[]> {
  try {
    const all = await db.purchases.toArray()
    return all.map((p) => p.id)
  } catch {
    return []
  }
}

async function existingMessageIds(): Promise<string[]> {
  try {
    const all = await db.customerMessages.toArray()
    return all.map((m) => m.id)
  } catch {
    return []
  }
}

/* ─────────────────────────────────────────────
   Public generators
   ───────────────────────────────────────────── */

export async function nextCustomerId(date = new Date()): Promise<string> {
  const part = yymm(date)
  const ids = await existingCustomerIds()
  // CYYMMXXX
  return nextSequentialId('C', part, ids, 3)
}

export async function nextCustomerUserId(date = new Date()): Promise<string> {
  const part = yymm(date)
  const ids = await existingUserIds()
  // CUYYMMXXX — Customer User
  return nextSequentialId('CU', part, ids, 3)
}

export async function nextSaleId(date = new Date(), existingFromStore: string[] = []): Promise<string> {
  const part = yymmdd(date)
  const dexieIds: string[] = [] // sales are in Zustand, not Dexie
  const all = [...dexieIds, ...existingFromStore]
  return nextSequentialId('S', part, all, 3)
}

export async function nextPurchaseId(date = new Date(), existingFromStore: string[] = []): Promise<string> {
  const part = yymmdd(date)
  const dexie = await existingPurchaseIdsFromDexie()
  const all = [...dexie, ...existingFromStore]
  return nextSequentialId('P', part, all, 3)
}

export async function nextOrderId(date = new Date()): Promise<string> {
  const part = yymmdd(date)
  const ids = await existingOrderIds()
  return nextSequentialId('O', part, ids, 3)
}

export async function nextReceiptId(date = new Date()): Promise<string> {
  const part = yymmdd(date)
  const ledger = await existingLedgerIds()
  const coll = await existingCollectionIds()
  const all = [...ledger, ...coll]
  // RYYMMDDXXX
  return nextSequentialId('R', part, all, 3)
}

export async function nextTransactionId(date = new Date()): Promise<string> {
  const part = yymm(date)
  const ledger = await existingLedgerIds()
  // TYYMMXXX
  return nextSequentialId('T', part, ledger, 3)
}

export async function nextExpenseId(date = new Date()): Promise<string> {
  const part = yymmdd(date)
  const ids = await existingExpenseIds()
  return nextSequentialId('E', part, ids, 3)
}

export async function nextAdjustmentId(date = new Date(), existingFromStore: string[] = []): Promise<string> {
  const part = yymmdd(date)
  const dexie = await existingAdjustmentIds()
  const all = [...dexie, ...existingFromStore]
  return nextSequentialId('A', part, all, 3)
}

export async function nextBranchId(date = new Date()): Promise<string> {
  const part = yymm(date)
  const ids = await existingBranchIds()
  return nextSequentialId('B', part, ids, 3)
}

export async function nextProductId(date = new Date(), existingFromStore: string[] = []): Promise<string> {
  const part = yymm(date)
  const dexie = await existingProductIds()
  const all = [...dexie, ...existingFromStore]
  return nextSequentialId('PR', part, all, 3)
}

export async function nextMessageId(date = new Date()): Promise<string> {
  const part = yymmdd(date)
  const ids = await existingMessageIds()
  return nextSequentialId('MSG', part, ids, 3)
}

export async function nextStaffId(role: 'manager' | 'salesman', date = new Date()): Promise<string> {
  const part = yymm(date)
  const ids = await existingUserIds()
  const prefix = role === 'manager' ? 'M' : 'SL'
  return nextSequentialId(prefix, part, ids, 3)
}

/* ─────────────────────────────────────────────
   Sync version for Zustand stores (localStorage)
   ───────────────────────────────────────────── */

export function nextIdSync(prefix: string, datePart: string, existingIds: string[], pad = 3): string {
  return nextSequentialId(prefix, datePart, existingIds, pad)
}
