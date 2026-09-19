/**
 * Sync-ready record envelope — সব local row এই metadata বহন করে।
 * বর্তমানে কোনো server লাগে না; শুধু ভবিষ্যতের জন্য তথ্য জমা থাকে।
 */

export interface SyncMeta {
  /** স্থায়ী Primary ID — UUID v4, কখনো বদলায় না, সব ডিভাইসে একই। */
  uid: string
  /** মানুষের পড়ার সিরিয়াল (C2609001) — display/search only, Primary Key নয়। */
  local_id: string
  created_at: string
  updated_at: string
  /** Soft delete tombstone — multi-device sync-এ deleted row ফিরে আসা ঠেকায়। */
  deleted_at?: string | null
  origin_device_id: string
  updated_by_device_id: string
  /** প্রতি লেখায় +1 — conflict detection-এর ভিত্তি। */
  rev: number
  schema_version: number
}

/** যেকোনো domain record + sync metadata */
export type Syncable<T> = T & SyncMeta

/** Outbox-এ জমা হওয়া পরিবর্তন — online হলে এগুলোই push হবে। */
export interface OutboxOp {
  /** Op-এর নিজস্ব uid — একই op দুইবার push হলেও server idempotent থাকতে পারে। */
  id: string
  table: string
  row_uid: string
  op: 'put' | 'delete'
  /** put হলে সম্পূর্ণ row snapshot; delete হলে tombstone। */
  payload: Record<string, unknown>
  rev: number
  device_id: string
  created_at: string
  /** Push চেষ্টা কতবার হয়েছে (ভবিষ্যতে retry/backoff-এর জন্য)। */
  attempts: number
}

/** প্রতি table-এ কত দূর পর্যন্ত pull হয়েছে (incremental sync cursor)। */
export interface SyncCursor {
  table: string
  /** শেষ সফল pull-এর server timestamp */
  pulled_through: string | null
  last_synced_at: string | null
}

export type ConflictStrategy = 'last-write-wins' | 'prefer-local' | 'prefer-remote'

export interface ConflictResult<T> {
  winner: Syncable<T>
  loser: Syncable<T>
  reason: 'rev' | 'updated_at' | 'device-tiebreak' | 'tombstone' | 'identical'
}
