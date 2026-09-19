import 'fake-indexeddb/auto'
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    },
    configurable: true,
  })
}

const { db } = await import('../src/lib/db')
const outbox = await import('../src/lib/sync/outbox')
const { attachSyncMeta, markDeleted } = await import('../src/lib/sync/record')
const { useCustomerStore } = await import('../src/stores/customerStore')

beforeEach(async () => {
  await db.open()
  await db.syncOutbox.clear()
  await db.syncCursors.clear()
  await db.customers.clear()
  useCustomerStore.setState({ customers: [], isLoading: false })
})

test('offline changes are queued in the outbox for a future central db', async () => {
  const row = attachSyncMeta({ id: 'C2609001', name: 'করিম', branch_id: 'b1' })
  await outbox.enqueue('customers', row.uid, 'put', row, row.rev)

  assert.equal(await outbox.pendingCount(), 1)
  const [op] = await outbox.pending()
  assert.equal(op.table, 'customers')
  assert.equal(op.row_uid, row.uid)
  assert.equal(op.op, 'put')
  assert.equal(op.attempts, 0)
  assert.ok(op.device_id)
})

test('pending ops come back in foreign-key safe order (parents first)', async () => {
  const sale = attachSyncMeta({ id: 'S1' })
  const customer = attachSyncMeta({ id: 'C1' })
  await outbox.enqueue('sales', sale.uid, 'put', sale)
  await outbox.enqueue('customers', customer.uid, 'put', customer)

  const tables = (await outbox.pending()).map((o) => o.table)
  assert.ok(tables.indexOf('customers') < tables.indexOf('sales'))
})

test('acked ops leave the queue, so nothing is pushed twice', async () => {
  const row = attachSyncMeta({ id: 'C1' })
  await outbox.enqueue('customers', row.uid, 'put', row)
  const ops = await outbox.pending()
  await outbox.ack(ops.map((o) => o.id))
  assert.equal(await outbox.pendingCount(), 0)
})

test('compaction keeps only the newest op per row, and delete always wins', async () => {
  const row = attachSyncMeta({ id: 'C1' })
  await outbox.enqueue('customers', row.uid, 'put', { ...row, name: 'v1' }, 1)
  await outbox.enqueue('customers', row.uid, 'put', { ...row, name: 'v2' }, 2)
  await outbox.enqueue('customers', row.uid, 'delete', markDeleted(row), 3)

  const removed = await outbox.compact()
  assert.equal(removed, 2)
  const remaining = await outbox.pending()
  assert.equal(remaining.length, 1)
  assert.equal(remaining[0].op, 'delete')
})

test('sync cursor tracks incremental pull position per table', async () => {
  assert.deepEqual(await outbox.cursor('sales'), { table: 'sales', pulled_through: null, last_synced_at: null })
  await outbox.setCursor('sales', '2026-09-19T10:00:00Z')
  const c = await outbox.cursor('sales')
  assert.equal(c.pulled_through, '2026-09-19T10:00:00Z')
  assert.ok(c.last_synced_at)
})

/* ── Store integration: offline behaviour unchanged, sync data added ── */

test('adding a customer offline still works and now carries a permanent uid', async () => {
  const created = await useCustomerStore.getState().addCustomer({ name: 'করিম', phone: '01700000000', branch_id: 'b1' })
  assert.equal(created.name, 'করিম')
  assert.match(created.id, /^C\d+$/) // সিরিয়াল আগের মতোই
  assert.ok(created.uid)
  assert.equal(created.local_id, created.id)

  const stored = await db.customers.get(created.id)
  assert.equal(stored?.uid, created.uid)
  assert.equal((await outbox.pending()).some((o) => o.row_uid === created.uid), true)
})

test('duplicate customer on the same device returns the existing row, no new uid', async () => {
  const store = useCustomerStore.getState()
  const first = await store.addCustomer({ name: 'করিম', phone: '01700000000', branch_id: 'b1' })
  // একই নাম+ফোন, শুধু whitespace/কেস আলাদা — তবুও duplicate ধরা পড়বে
  const again = await store.addCustomer({ name: '  করিম ', phone: '01700000000', branch_id: 'b1' })
  assert.equal(again.uid, first.uid)
  assert.equal(useCustomerStore.getState().customers.length, 1)
})

test('deleting a customer soft-deletes it and hides it from the UI list', async () => {
  const store = useCustomerStore.getState()
  const c = await store.addCustomer({ name: 'রহিম', phone: '01800000000', branch_id: 'b1' })
  await useCustomerStore.getState().deleteCustomer(c.id)

  assert.equal(useCustomerStore.getState().customers.length, 0)
  const row = await db.customers.get(c.id)
  assert.ok(row?.deleted_at, 'tombstone thakbe')

  // reload করলেও deleted row দেখাবে না
  await useCustomerStore.getState().loadCustomers()
  assert.equal(useCustomerStore.getState().customers.length, 0)
})

test('updating a customer bumps rev but keeps the uid stable', async () => {
  const store = useCustomerStore.getState()
  const c = await store.addCustomer({ name: 'করিম', phone: '01700000000', branch_id: 'b1' })
  await useCustomerStore.getState().updateCustomer(c.id, { name: 'করিম মিয়া' })

  const row = await db.customers.get(c.id)
  assert.equal(row?.uid, c.uid)
  assert.equal(row?.name, 'করিম মিয়া')
  assert.equal(row?.rev, 2)
})
