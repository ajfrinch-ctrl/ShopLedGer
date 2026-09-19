/**
 * Data version & migration.
 *
 * লক্ষ্য: ভবিষ্যতে Database বদলালেও বর্তমান local data যেন হারিয়ে না যায়।
 * তাই প্রতিটি row নিজের `schema_version` বহন করে এবং migration গুলো
 * ধাপে ধাপে (idempotent) চলে — একই migration দুইবার চললেও ক্ষতি নেই।
 */

import { SCHEMA_VERSION } from './schema'
import { deviceId, newUid } from './device'
import type { SyncMeta } from './types'

/** Legacy row-তে জায়গামতো (in-place) sync metadata বসায় — Dexie `modify()`-এর জন্য। */
export function backfillSyncMeta(row: Record<string, unknown>): void {
  const at = (row.created_at as string) || new Date().toISOString()

  if (!row.uid) row.uid = newUid()
  // পুরোনো সিরিয়াল আইডি (C2609001) local_id হিসেবে সংরক্ষিত হয়,
  // কিন্তু Primary Key এখন uid — সিরিয়াল আর কখনো PK নয়।
  if (!row.local_id) row.local_id = String(row.id ?? '')
  if (!row.created_at) row.created_at = at
  if (!row.updated_at) row.updated_at = at
  if (row.deleted_at === undefined) row.deleted_at = null
  if (!row.origin_device_id) row.origin_device_id = deviceId()
  if (!row.updated_by_device_id) row.updated_by_device_id = row.origin_device_id
  if (typeof row.rev !== 'number') row.rev = 1
  if (typeof row.schema_version !== 'number') row.schema_version = SCHEMA_VERSION
}

/** Immutable ভার্সন — zustand persist migration ও pure test-এর জন্য। */
export function withSyncMeta<T extends object>(row: T): T & SyncMeta {
  const copy = { ...row } as Record<string, unknown>
  backfillSyncMeta(copy)
  return copy as T & SyncMeta
}

/** একটি array-এর সব row backfill করে (zustand persist store-এর জন্য)। */
export function migrateRows<T extends object>(rows: T[] | undefined): (T & SyncMeta)[] {
  if (!Array.isArray(rows)) return []
  return rows.map(withSyncMeta)
}

/**
 * zustand `persist` এর জন্য reusable migrate function।
 * বিদ্যমান state-এর বাকি অংশে হাত না দিয়ে শুধু নির্দিষ্ট array গুলোতে
 * sync metadata যোগ করে — তাই UI/behaviour অপরিবর্তিত থাকে।
 */
export function persistedSyncMigration<S extends object>(...arrayKeys: (keyof S & string)[]) {
  return (persisted: unknown): S => {
    const state = { ...((persisted ?? {}) as Record<string, unknown>) }
    for (const key of arrayKeys) {
      const value = state[key]
      if (Array.isArray(value)) state[key] = migrateRows(value as object[])
    }
    return state as S
  }
}

/** Row-টি বর্তমান schema version-এ আছে কি না। */
export const isCurrentVersion = (row: { schema_version?: number }): boolean =>
  row.schema_version === SCHEMA_VERSION

export { SCHEMA_VERSION }
