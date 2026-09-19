/**
 * Record helpers — local row-এ sync metadata যোগ/হালনাগাদ, soft delete,
 * duplicate detection ও conflict resolution.
 *
 * সব function pure (device id ছাড়া) — তাই সহজে test করা যায় এবং
 * বর্তমান offline flow-এ কোনো network dependency আসে না।
 */

import { SCHEMA, SCHEMA_VERSION, type SyncTableName } from './schema'
import { deviceId, newUid } from './device'
import type { ConflictResult, ConflictStrategy, SyncMeta, Syncable } from './types'

const nowIso = () => new Date().toISOString()

/**
 * নতুন row-এ sync metadata বসায়।
 * `local_id` হিসেবে বিদ্যমান সিরিয়াল আইডি (যেমন C2609001) ব্যবহার হয়,
 * আর Primary Key হয় নতুন permanent `uid`।
 */
export function attachSyncMeta<T extends object>(
  row: T,
  options: { localId?: string; uid?: string; device?: string; now?: string } = {},
): Syncable<T> {
  const device = options.device ?? deviceId()
  const at = options.now ?? nowIso()
  const existing = row as Partial<SyncMeta>
  const anyRow = row as Record<string, unknown>

  return {
    ...row,
    uid: options.uid ?? existing.uid ?? newUid(),
    local_id: options.localId ?? existing.local_id ?? String(anyRow.id ?? ''),
    created_at: existing.created_at ?? at,
    updated_at: at,
    deleted_at: existing.deleted_at ?? null,
    origin_device_id: existing.origin_device_id ?? device,
    updated_by_device_id: device,
    rev: existing.rev ?? 1,
    schema_version: existing.schema_version ?? SCHEMA_VERSION,
  } as Syncable<T>
}

/** বিদ্যমান row আপডেট করে rev বাড়িয়ে দেয় (conflict detection-এর জন্য জরুরি)। */
export function touchSyncMeta<T extends object>(
  row: Syncable<T>,
  patch: Partial<T> = {},
  options: { device?: string; now?: string } = {},
): Syncable<T> {
  return {
    ...row,
    ...patch,
    updated_at: options.now ?? nowIso(),
    updated_by_device_id: options.device ?? deviceId(),
    rev: (row.rev ?? 0) + 1,
  }
}

/** Hard delete নয় — tombstone, যাতে অন্য ডিভাইস থেকে row ফিরে না আসে। */
export function markDeleted<T extends object>(
  row: Syncable<T>,
  options: { device?: string; now?: string } = {},
): Syncable<T> {
  const at = options.now ?? nowIso()
  return {
    ...row,
    deleted_at: at,
    updated_at: at,
    updated_by_device_id: options.device ?? deviceId(),
    rev: (row.rev ?? 0) + 1,
  }
}

export const isDeleted = (row: { deleted_at?: string | null }): boolean => Boolean(row.deleted_at)

/**
 * Natural key — একই বাস্তব জিনিস দুই ডিভাইসে আলাদা uid নিয়ে তৈরি হলে
 * এই key মিলিয়ে duplicate ধরা যায়।
 */
export function naturalKeyOf(table: SyncTableName, row: object): string {
  const spec = SCHEMA[table]
  return spec.naturalKey
    .map((field) => {
      const value = (row as Record<string, unknown>)[field]
      return value == null ? '' : String(value).trim().toLowerCase()
    })
    .join('|')
}

/** একই natural key-এর একাধিক row (duplicate) খুঁজে দেয়। */
export function findDuplicates<T extends object>(
  table: SyncTableName,
  rows: Syncable<T>[],
): Map<string, Syncable<T>[]> {
  const groups = new Map<string, Syncable<T>[]>()
  for (const row of rows) {
    if (isDeleted(row)) continue
    const key = naturalKeyOf(table, row)
    if (!key.replace(/\|/g, '')) continue // সম্পূর্ণ ফাঁকা key উপেক্ষা
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  for (const [key, group] of groups) if (group.length < 2) groups.delete(key)
  return groups
}

/**
 * নতুন row ঢোকানোর আগে duplicate আছে কি না দেখে।
 * থাকলে বিদ্যমান row ফেরত দেয় — নতুন uid তৈরি করার দরকার নেই।
 */
export function dedupeCandidate<T extends object>(
  table: SyncTableName,
  candidate: object,
  existing: Syncable<T>[],
): Syncable<T> | undefined {
  const key = naturalKeyOf(table, candidate)
  if (!key.replace(/\|/g, '')) return undefined
  return existing.find((row) => !isDeleted(row) && naturalKeyOf(table, row) === key)
}

/**
 * Conflict resolution — দুই ডিভাইসের একই uid-এর দুই version মেলানো।
 *
 * ক্রম:
 *  1. Tombstone (delete) সবসময় জেতে — মুছে ফেলা জিনিস ফিরে আসবে না।
 *  2. বড় `rev` জেতে।
 *  3. rev সমান হলে নতুন `updated_at` জেতে (last-write-wins)।
 *  4. সবই সমান হলে device_id দিয়ে deterministic tie-break —
 *     সব ডিভাইস একই বিজয়ী বেছে নেবে (convergence নিশ্চিত)।
 */
export function resolveConflict<T extends object>(
  local: Syncable<T>,
  remote: Syncable<T>,
  strategy: ConflictStrategy = 'last-write-wins',
): ConflictResult<T> {
  if (strategy === 'prefer-local') return { winner: local, loser: remote, reason: 'device-tiebreak' }
  if (strategy === 'prefer-remote') return { winner: remote, loser: local, reason: 'device-tiebreak' }

  const localDeleted = isDeleted(local)
  const remoteDeleted = isDeleted(remote)
  if (localDeleted !== remoteDeleted) {
    const winner = localDeleted ? local : remote
    const loser = localDeleted ? remote : local
    return { winner, loser, reason: 'tombstone' }
  }

  if ((local.rev ?? 0) !== (remote.rev ?? 0)) {
    const localWins = (local.rev ?? 0) > (remote.rev ?? 0)
    return { winner: localWins ? local : remote, loser: localWins ? remote : local, reason: 'rev' }
  }

  if (local.updated_at !== remote.updated_at) {
    const localWins = local.updated_at > remote.updated_at
    return { winner: localWins ? local : remote, loser: localWins ? remote : local, reason: 'updated_at' }
  }

  if (local.updated_by_device_id === remote.updated_by_device_id) {
    return { winner: local, loser: remote, reason: 'identical' }
  }
  const localWins = local.updated_by_device_id > remote.updated_by_device_id
  return { winner: localWins ? local : remote, loser: localWins ? remote : local, reason: 'device-tiebreak' }
}

/** Local row → Central DB payload (schema-এর column mapping অনুযায়ী)। */
export function toRemotePayload(
  table: SyncTableName,
  row: object,
): Record<string, unknown> {
  const spec = SCHEMA[table]
  const payload: Record<string, unknown> = {}
  for (const [field, meta] of Object.entries(spec.fields)) {
    const value = (row as Record<string, unknown>)[field]
    if (value !== undefined) payload[meta.column] = value
  }
  return payload
}

/** Central DB row → local row (পুল করার সময় ব্যবহার হবে)। */
export function fromRemotePayload(
  table: SyncTableName,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const spec = SCHEMA[table]
  const row: Record<string, unknown> = {}
  for (const [field, meta] of Object.entries(spec.fields)) {
    if (payload[meta.column] !== undefined) row[field] = payload[meta.column]
  }
  // বিদ্যমান UI কোড `id` ব্যবহার করে — local_id সেখানে ম্যাপ করা হয়।
  if (row.local_id !== undefined) row.id = row.local_id
  return row
}
