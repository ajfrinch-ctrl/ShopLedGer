/**
 * Offline-First → Future Online Sync layer.
 *
 * Architecture: **Local Data First → Future Central Database Sync Ready**
 *
 *   UI  →  zustand store  →  IndexedDB / localStorage   (সবসময়, সঙ্গে সঙ্গে)
 *                                    ↓
 *                              sync outbox              (শুধু জমা থাকে)
 *                                    ↓
 *                     [ভবিষ্যৎ] Central Database push/pull
 *
 * এখন কোনো server/API/Database বাধ্যতামূলক নয় — এই layer সম্পূর্ণ offline-এ চলে
 * এবং UI কখনো এর জন্য অপেক্ষা করে না।
 */

export * from './schema'
export * from './types'
export { deviceId, newUid } from './device'
export {
  attachSyncMeta,
  touchSyncMeta,
  markDeleted,
  isDeleted,
  naturalKeyOf,
  findDuplicates,
  dedupeCandidate,
  resolveConflict,
  toRemotePayload,
  fromRemotePayload,
} from './record'
export {
  backfillSyncMeta,
  withSyncMeta,
  migrateRows,
  persistedSyncMigration,
  isCurrentVersion,
} from './migrate'
export * as outbox from './outbox'

/**
 * Online backend সম্পূর্ণ optional — এই layer কখনো supabase import করে না,
 * যাতে offline build/test-এ কোনো env variable বা network dependency না লাগে।
 * ভবিষ্যতে push/pull লেখার সময় `../supabase` আলাদাভাবে import করলেই হবে।
 */
