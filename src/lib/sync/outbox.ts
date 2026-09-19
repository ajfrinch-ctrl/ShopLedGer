/**
 * Outbox — offline-এ করা প্রতিটি পরিবর্তন এখানে queue হয়।
 *
 * এখন কোনো server নেই, তাই কিছুই push হয় না — শুধু জমা থাকে।
 * ভবিষ্যতে Online চালু হলে `pending()` থেকে নিয়ে ক্রমানুসারে push করলেই
 * Local → Central sync সম্পূর্ণ হবে। UI কখনো outbox-এর জন্য অপেক্ষা করে না,
 * তাই বর্তমান offline performance অপরিবর্তিত থাকে।
 */

import { db } from '../db'
import { deviceId, newUid } from './device'
import { syncOrder, type SyncTableName } from './schema'
import type { OutboxOp } from './types'

/** Outbox বড় হয়ে storage ভরে ফেলা ঠেকাতে সীমা। */
export const OUTBOX_LIMIT = 5000

/**
 * একটি পরিবর্তন queue করে। কখনো throw করে না — outbox ব্যর্থ হলেও
 * মূল offline কাজ (sale/collection ইত্যাদি) কখনো আটকাবে না।
 */
export async function enqueue(
  table: SyncTableName,
  rowUid: string,
  op: 'put' | 'delete',
  payload: object,
  rev = 1,
): Promise<void> {
  try {
    await db.syncOutbox.add({
      id: newUid(),
      table,
      row_uid: rowUid,
      op,
      payload: payload as Record<string, unknown>,
      rev,
      device_id: deviceId(),
      created_at: new Date().toISOString(),
      attempts: 0,
    })
    await trim()
  } catch (err) {
    console.warn('[sync] outbox enqueue skipped:', err)
  }
}

/**
 * Push-ready অপারেশন — foreign key নির্ভরতা মেনে সাজানো
 * (আগে parent যেমন customers, পরে child যেমন sales)।
 */
export async function pending(limit = 500): Promise<OutboxOp[]> {
  const ops = await db.syncOutbox.orderBy('created_at').limit(limit).toArray()
  const order = syncOrder()
  const rank = (t: string) => {
    const i = order.indexOf(t as SyncTableName)
    return i === -1 ? order.length : i
  }
  return ops.sort((a, b) => rank(a.table) - rank(b.table) || a.created_at.localeCompare(b.created_at))
}

export const pendingCount = (): Promise<number> => db.syncOutbox.count()

/** সফলভাবে push হওয়া op গুলো সরায়। */
export async function ack(ids: string[]): Promise<void> {
  if (ids.length) await db.syncOutbox.bulkDelete(ids)
}

/** একই row-এর পুরোনো put গুলো মুছে শুধু সর্বশেষটি রাখে (queue ছোট রাখতে)। */
export async function compact(): Promise<number> {
  const ops = await db.syncOutbox.toArray()
  const latest = new Map<string, OutboxOp>()
  const stale: string[] = []

  for (const op of ops.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const key = `${op.table}:${op.row_uid}`
    const prev = latest.get(key)
    // delete সবসময় জেতে; নইলে সর্বশেষ put থাকে
    if (prev && (op.op === 'delete' || prev.op !== 'delete')) {
      stale.push(prev.id)
      latest.set(key, op)
    } else if (prev) {
      stale.push(op.id)
    } else {
      latest.set(key, op)
    }
  }

  await ack(stale)
  return stale.length
}

async function trim(): Promise<void> {
  const count = await db.syncOutbox.count()
  if (count <= OUTBOX_LIMIT) return
  await compact()
  const after = await db.syncOutbox.count()
  if (after <= OUTBOX_LIMIT) return
  const oldest = await db.syncOutbox.orderBy('created_at').limit(after - OUTBOX_LIMIT).toArray()
  await ack(oldest.map((o) => o.id))
}

/** শেষ কবে pull হয়েছে — incremental sync cursor. */
export async function cursor(table: SyncTableName) {
  return (
    (await db.syncCursors.get(table)) ?? { table, pulled_through: null, last_synced_at: null }
  )
}

export async function setCursor(table: SyncTableName, pulledThrough: string): Promise<void> {
  await db.syncCursors.put({
    table,
    pulled_through: pulledThrough,
    last_synced_at: new Date().toISOString(),
  })
}
