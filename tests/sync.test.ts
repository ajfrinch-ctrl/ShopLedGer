import { test } from 'node:test'
import assert from 'node:assert/strict'

const store = new Map<string, string>()
;(globalThis as unknown as Record<string, unknown>).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
}

const { newUid, deviceId } = await import('../src/lib/sync/device')
const {
  attachSyncMeta, touchSyncMeta, markDeleted, isDeleted,
  naturalKeyOf, findDuplicates, dedupeCandidate, resolveConflict,
  toRemotePayload, fromRemotePayload,
} = await import('../src/lib/sync/record')
const { withSyncMeta, migrateRows, persistedSyncMigration, isCurrentVersion } = await import('../src/lib/sync/migrate')
const { SCHEMA, SCHEMA_VERSION, SYNC_TABLES, syncOrder, dependenciesOf, tableForLocalStore } = await import('../src/lib/sync/schema')

/* ── Permanent unique IDs ───────────────────────────── */

test('uid is a v4 uuid and never repeats', () => {
  const ids = new Set(Array.from({ length: 500 }, newUid))
  assert.equal(ids.size, 500)
  assert.match(newUid(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})

test('device id is stable across calls and persisted', () => {
  assert.equal(deviceId(), deviceId())
  assert.equal(store.get('shopledger:device-id'), deviceId())
})

test('serial id becomes local_id, never the primary key', () => {
  const row = attachSyncMeta({ id: 'C2609001', name: 'করিম' }, { localId: 'C2609001' })
  assert.equal(row.local_id, 'C2609001')
  assert.notEqual(row.uid, 'C2609001')
  assert.equal(row.rev, 1)
  assert.equal(row.schema_version, SCHEMA_VERSION)
  assert.equal(row.deleted_at, null)
  assert.equal(row.origin_device_id, deviceId())
})

test('uid survives edits so central db rows stay stable', () => {
  const row = attachSyncMeta({ id: 'C2609001', name: 'করিম' })
  const edited = touchSyncMeta(row, { name: 'করিম মিয়া' })
  assert.equal(edited.uid, row.uid)
  assert.equal(edited.name, 'করিম মিয়া')
  assert.equal(edited.rev, 2)
  assert.equal(edited.created_at, row.created_at)
})

/* ── Soft delete / tombstone ────────────────────────── */

test('delete is a tombstone so other devices cannot resurrect the row', () => {
  const row = attachSyncMeta({ id: 'C1', name: 'x' })
  const gone = markDeleted(row)
  assert.ok(isDeleted(gone))
  assert.equal(gone.uid, row.uid)
  assert.equal(gone.rev, 2)
  assert.equal(isDeleted(row), false)
})

/* ── Duplicate prevention ───────────────────────────── */

test('natural key ignores case and whitespace', () => {
  const a = naturalKeyOf('customers', { branch_id: 'b1', phone: '01700000000', name: ' Korim ' })
  const b = naturalKeyOf('customers', { branch_id: 'b1', phone: '01700000000', name: 'korim' })
  assert.equal(a, b)
})

test('same customer added on two devices is detected as duplicate', () => {
  const deviceA = attachSyncMeta({ id: 'C2609001', branch_id: 'b1', name: 'করিম', phone: '01700000000' })
  const deviceB = attachSyncMeta({ id: 'C2609007', branch_id: 'b1', name: 'করিম', phone: '01700000000' })
  assert.notEqual(deviceA.uid, deviceB.uid)

  const dupes = findDuplicates('customers', [deviceA, deviceB])
  assert.equal(dupes.size, 1)
  assert.equal([...dupes.values()][0].length, 2)

  const hit = dedupeCandidate('customers', { branch_id: 'b1', name: 'করিম', phone: '01700000000' }, [deviceA])
  assert.equal(hit?.uid, deviceA.uid)
})

test('deleted rows and empty keys never count as duplicates', () => {
  const live = attachSyncMeta({ id: 'C1', branch_id: 'b1', name: 'করিম', phone: '017' })
  const dead = markDeleted(attachSyncMeta({ id: 'C2', branch_id: 'b1', name: 'করিম', phone: '017' }))
  assert.equal(findDuplicates('customers', [live, dead]).size, 0)
  assert.equal(dedupeCandidate('customers', {}, [live]), undefined)
})

/* ── Conflict handling ──────────────────────────────── */

const at = (t: string, rev: number, dev = 'dev-a', extra: Record<string, unknown> = {}) =>
  ({ uid: 'u1', local_id: 'C1', created_at: t, updated_at: t, deleted_at: null,
     origin_device_id: dev, updated_by_device_id: dev, rev, schema_version: 1, ...extra })

test('higher rev wins', () => {
  const r = resolveConflict(at('2026-09-19T10:00:00Z', 3), at('2026-09-19T11:00:00Z', 2, 'dev-b'))
  assert.equal(r.reason, 'rev')
  assert.equal(r.winner.rev, 3)
})

test('same rev falls back to last-write-wins', () => {
  const r = resolveConflict(at('2026-09-19T10:00:00Z', 2), at('2026-09-19T12:00:00Z', 2, 'dev-b'))
  assert.equal(r.reason, 'updated_at')
  assert.equal(r.winner.updated_by_device_id, 'dev-b')
})

test('delete beats a concurrent edit', () => {
  const deleted = at('2026-09-19T10:00:00Z', 2, 'dev-a', { deleted_at: '2026-09-19T10:00:00Z' })
  const edited = at('2026-09-19T12:00:00Z', 9, 'dev-b')
  assert.equal(resolveConflict(deleted, edited).reason, 'tombstone')
  assert.ok(isDeleted(resolveConflict(deleted, edited).winner))
})

test('identical timestamps converge to the same winner on every device', () => {
  const a = at('2026-09-19T10:00:00Z', 2, 'dev-a')
  const b = at('2026-09-19T10:00:00Z', 2, 'dev-b')
  const fromA = resolveConflict(a, b).winner.updated_by_device_id
  const fromB = resolveConflict(b, a).winner.updated_by_device_id
  assert.equal(fromA, fromB)
})

test('explicit strategies override the default', () => {
  const a = at('2026-09-19T10:00:00Z', 1)
  const b = at('2026-09-19T12:00:00Z', 5, 'dev-b')
  assert.equal(resolveConflict(a, b, 'prefer-local').winner.updated_by_device_id, 'dev-a')
  assert.equal(resolveConflict(a, b, 'prefer-remote').winner.updated_by_device_id, 'dev-b')
})

/* ── Central DB mapping ─────────────────────────────── */

test('every table declares uid pk, local_id, timestamps and a natural key', () => {
  for (const name of SYNC_TABLES) {
    const spec = SCHEMA[name]
    assert.equal(spec.primaryKey, 'uid', name)
    assert.equal(spec.localIdField, 'local_id', name)
    assert.ok(spec.naturalKey.length > 0, name)
    assert.ok(spec.remoteTable, name)
    for (const f of ['uid', 'local_id', 'created_at', 'updated_at', 'deleted_at', 'rev']) {
      assert.ok(spec.fields[f], `${name}.${f}`)
    }
  }
})

test('foreign keys point at real tables and push order puts parents first', () => {
  const remotes = new Set(SYNC_TABLES.map((t) => SCHEMA[t].remoteTable))
  for (const name of SYNC_TABLES) {
    for (const field of Object.values(SCHEMA[name].fields)) {
      if (field.references) assert.ok(remotes.has(field.references.split('.')[0]), field.references)
    }
  }
  const order = syncOrder()
  assert.equal(order.length, SYNC_TABLES.length)
  for (const name of SYNC_TABLES) {
    for (const dep of dependenciesOf(name)) {
      assert.ok(order.indexOf(dep as never) < order.indexOf(name), `${dep} before ${name}`)
    }
  }
})

test('local store names map back to canonical tables', () => {
  assert.equal(tableForLocalStore('shopledger-sales'), 'sales')
  assert.equal(tableForLocalStore('customers'), 'customers')
  assert.equal(tableForLocalStore('nope'), undefined)
})

test('round-trip local → remote → local keeps the data', () => {
  const row = attachSyncMeta({
    id: 'S260901001', date: '2026-09-01', items: [], total_amount: 500, total_profit: 50,
    payment_type: 'নগদ', branch_id: 'b1', created_by: 'u1', created_at: '2026-09-01T00:00:00Z',
  }, { localId: 'S260901001' })

  const remote = toRemotePayload('sales', row)
  assert.equal(remote.uid, row.uid)
  assert.equal(remote.total_amount, 500)
  assert.equal(remote.id, undefined) // সিরিয়াল আলাদা কলামে (local_id)

  const back = fromRemotePayload('sales', remote)
  assert.equal(back.uid, row.uid)
  assert.equal(back.id, 'S260901001') // UI-এর জন্য id ফিরে আসে
  assert.equal(back.total_amount, 500)
})

/* ── Migration / data versioning ────────────────────── */

test('legacy rows without uid are backfilled without losing data', () => {
  const legacy = { id: 'C2609001', name: 'করিম', created_at: '2026-01-01T00:00:00Z' }
  const migrated = withSyncMeta(legacy)
  assert.equal(migrated.name, 'করিম')
  assert.equal(migrated.local_id, 'C2609001')
  assert.equal(migrated.created_at, '2026-01-01T00:00:00Z')
  assert.equal(migrated.updated_at, '2026-01-01T00:00:00Z')
  assert.ok(migrated.uid)
  assert.ok(isCurrentVersion(migrated))
})

test('migration is idempotent — running twice keeps the same uid', () => {
  const once = withSyncMeta({ id: 'C1', name: 'x' })
  const twice = withSyncMeta(once)
  assert.deepEqual(twice, once)
})

test('persisted zustand state migrates only the listed arrays', () => {
  const migrate = persistedSyncMigration<{ sales: object[]; categories: string[] }>('sales')
  const out = migrate({ sales: [{ id: 'S1' }, { id: 'S2' }], categories: ['ফিড'] })
  assert.equal(out.sales.length, 2)
  assert.ok((out.sales[0] as { uid: string }).uid)
  assert.deepEqual(out.categories, ['ফিড'])
})

test('migration copes with missing or malformed persisted state', () => {
  const migrate = persistedSyncMigration<{ sales: object[] }>('sales')
  assert.deepEqual(migrateRows(undefined), [])
  assert.deepEqual(migrate(undefined).sales, undefined)
  assert.deepEqual(migrate({ sales: 'oops' }).sales, 'oops' as never)
})
