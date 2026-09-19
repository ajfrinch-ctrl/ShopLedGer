import { test } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => void store.clear(),
    },
    configurable: true,
  })
}

import { db } from '../src/lib/db'
import {
  AUTO_BACKUPS_TO_KEEP,
  BACKUP_APP_ID,
  BACKUP_DATA_TABLES,
  type BackupRecord,
  applyBackup,
  collectBackupPayload,
  createBackupSnapshot,
  dhakaDay,
  fileDownloadStale,
  latestAutoBackup,
  markFileDownloaded,
  parseBackupText,
  pruneBackups,
  refreshTodaysAutoBackup,
  runDailyAutoBackup,
  serializeBackup,
} from '../src/lib/backup'

/** টেস্টের জন্য সাজানো ডেটা — দুই বিক্রি, এক ক্রেতা, এক পণ্য, এক শাখা, এক আইডি */
async function seedShopData() {
  // আগের টেস্টের ডেটা থেকে গেলে ফল বদলে যেতে পারে — শুরুতেই পরিষ্কার
  for (const name of BACKUP_DATA_TABLES) await db.table(name).clear()
  await db.branches.bulkPut([
    { id: 'branch-1', name: 'প্রধান শাখা', organization: 'কর্ণফুলী সেলস সেন্টার', is_active: true, created_at: '2026-01-01T00:00:00.000Z' },
  ])
  await db.users.bulkPut([
    {
      id: 'owner-1', name: 'মালিক', phone: '01811808294', password_hash: 'h', role: 'owner',
      is_active: true, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    },
  ])
  await db.products.bulkPut([
    {
      id: 'pr1', name: 'সরিষার খৈল', unit: 'কেজি', opening_stock: 10, purchase_price: 50, sale_price: 60,
      branch_id: 'branch-1', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    },
  ])
  await db.customers.bulkPut([
    { id: 'c1', name: 'করিম', branch_id: 'branch-1', phone: '01700000000', created_at: '2026-01-01T00:00:00.000Z' },
  ])
  await db.sales.bulkPut([
    {
      id: 's1', date: '2026-09-18', items: [], total_amount: 120, total_profit: 20, payment_type: 'বাকি',
      customer_id: 'c1', customer_name: 'করিম', branch_id: 'branch-1', created_by: 'owner-1', created_at: '2026-09-18T04:00:00.000Z',
    },
    {
      id: 's2', date: '2026-09-19', items: [], total_amount: 60, total_profit: 10, payment_type: 'নগদ',
      customer_id: '', customer_name: '', branch_id: 'branch-1', created_by: 'owner-1', created_at: '2026-09-19T04:00:00.000Z',
    },
  ])
}

test('dhakaDay gives YYYY-MM-DD calendar day in Asia/Dhaka', () => {
  assert.match(dhakaDay(new Date('2026-09-19T10:00:00.000Z')), /^\d{4}-\d{2}-\d{2}$/)
  // রাত ২১টা UTC (ভোর ৩টা ঢাকা) — পরের দিনে পড়ে
  assert.equal(dhakaDay(new Date('2026-09-19T21:00:00.000Z')), '2026-09-20')
  assert.equal(dhakaDay(new Date('2026-09-19T02:00:00.000Z')), '2026-09-19')
})

test('collectBackupPayload reads every data table with counts and shop name', async () => {
  await seedShopData()
  const payload = await collectBackupPayload()
  assert.equal(payload.app, BACKUP_APP_ID)
  assert.equal(payload.organization, 'কর্ণফুলী সেলস সেন্টার')
  assert.equal(payload.data.sales?.length, 2)
  assert.equal(payload.counts.sales, 2)
  assert.equal(payload.counts.products, 1)
  for (const name of BACKUP_DATA_TABLES) assert.ok(Array.isArray(payload.data[name]))
})

test('serialize → parse roundtrip keeps all rows intact', async () => {
  await seedShopData()
  const payload = await collectBackupPayload()
  const parsed = parseBackupText(serializeBackup(payload))
  assert.ok(parsed.ok)
  if (!parsed.ok) return
  assert.deepEqual(parsed.payload.data.sales, payload.data.sales)
  assert.deepEqual(parsed.payload.counts, payload.counts)
})

test('parse rejects junk files with clear reason', () => {
  const notJson = parseBackupText('এটা জেসন না')
  assert.ok(!notJson.ok)
  const wrongApp = parseBackupText(JSON.stringify({ app: 'other-app', data: {} }))
  assert.ok(!wrongApp.ok)
  const empty = parseBackupText(JSON.stringify({ app: BACKUP_APP_ID, schema_version: 1, data: {} }))
  assert.ok(!empty.ok)
  const missingData = parseBackupText(JSON.stringify({ app: BACKUP_APP_ID, schema_version: 1 }))
  assert.ok(!missingData.ok)
  const newer = parseBackupText(JSON.stringify({ app: BACKUP_APP_ID, schema_version: 99, data: { sales: [] } }))
  assert.ok(!newer.ok)
})

test('applyBackup replaces all data and resets sync outbox/cursors', async () => {
  await seedShopData()
  const payload = await collectBackupPayload()

  // রিস্টোরের আগে ডেটা এলোমেলো করে দিই — বিক্রি মুছে, ভুয়া পণ্য, outbox-এ বাকি সিঙ্ক
  await db.sales.clear()
  await db.products.bulkPut([{ id: 'prX', name: 'ভুয়া', unit: 'কেজি', opening_stock: 0, purchase_price: 1, sale_price: 2, branch_id: 'branch-1', created_at: '', updated_at: '' }])
  await db.syncOutbox.bulkPut([{ id: 'op1', table: 'sales', row_uid: 's9', op: 'put', created_at: '2026-09-19T00:00:00.000Z' } as never])
  await db.syncCursors.bulkPut([{ table: 'sales', cursor: 'x' } as never])

  const counts = await applyBackup(payload)
  assert.equal(counts.sales, 2)
  const sales = (await db.sales.toArray()).sort((a, b) => a.created_at.localeCompare(b.created_at)); assert.deepEqual(sales.map((s) => s.id), ['s1', 's2'])
  assert.equal(await db.products.get('prX'), undefined) // ভুয়া পণ্য চলে গেছে
  assert.equal((await db.products.get('pr1'))?.name, 'সরিষার খৈল') // আসলটা ফিরেছে
  assert.equal(await db.syncOutbox.count(), 0)
  assert.equal(await db.syncCursors.count(), 0)
})

test('runDailyAutoBackup creates one snapshot per day, refresh updates it with latest data', async () => {
  await seedShopData()
  await db.backups.clear()

  const now = new Date('2026-09-19T06:00:00.000Z')
  const first = await runDailyAutoBackup(now)
  assert.equal(first.created, true)
  const again = await runDailyAutoBackup(new Date('2026-09-19T09:00:00.000Z'))
  assert.equal(again.created, false)
  assert.equal(await db.backups.count(), 1)

  // দিনে নতুন বিক্রি হলো — অ্যাপ পেছনে গেলে আজকের স্ন্যাপশট সর্বশেষ অবস্থায় বদলাবে
  await db.sales.bulkPut([{
    id: 's3', date: '2026-09-19', items: [], total_amount: 500, total_profit: 100, payment_type: 'নগদ',
    customer_id: '', customer_name: '', branch_id: 'branch-1', created_by: 'owner-1', created_at: '2026-09-19T10:00:00.000Z',
  }])
  const updated = await refreshTodaysAutoBackup(new Date('2026-09-19T11:00:00.000Z'))
  assert.equal(updated.updated, true)
  assert.equal(await db.backups.count(), 1)
  const latest = await latestAutoBackup()
  assert.equal(latest?.payload.counts.sales, 3)

  // পরের দিন খুললে নতুন স্ন্যাপশট — দুদিনের দুটোই থাকে
  const nextDay = await runDailyAutoBackup(new Date('2026-09-20T06:00:00.000Z'))
  assert.equal(nextDay.created, true)
  assert.equal(await db.backups.count(), 2)
  // আজকের না হলে refresh কিছুই বদলায় না
  const stale = await refreshTodaysAutoBackup(new Date('2026-09-21T06:00:00.000Z'))
  assert.equal(stale.updated, false)
})

test('pruneBackups keeps only the latest snapshots per kind', async () => {
  await db.backups.clear()
  const mk = (i: number, kind: BackupRecord['kind']): BackupRecord => {
    const created = new Date(Date.UTC(2026, 8, 1 + i, 6)).toISOString()
    return {
      id: `bk-test-${kind}-${i}`, kind, created_at: created, day: dhakaDay(new Date(created)),
      counts: { sales: 1 }, size: 10,
      payload: { app: BACKUP_APP_ID, schema_version: 1, created_at: created, day: dhakaDay(new Date(created)), counts: { sales: 1 }, data: {} },
    }
  }
  // ৯টি অটো + ১টি ম্যানুয়াল → অটো সর্বশেষ ৭টি থাকবে
  for (let i = 0; i < 9; i++) await db.backups.put(mk(i, 'auto'))
  await db.backups.put(mk(0, 'manual'))
  await pruneBackups()
  const left = await db.backups.orderBy('created_at').toArray()
  assert.equal(left.filter((b) => b.kind === 'auto').length, AUTO_BACKUPS_TO_KEEP)
  assert.equal(left.filter((b) => b.kind === 'manual').length, 1)
  // সবচেয়ে পুরনোগুলোই বাদ গেছে
  assert.equal(left.some((b) => b.id === 'bk-test-auto-0'), false)
  assert.equal(left.some((b) => b.id === 'bk-test-auto-8'), true)
})

test('file download reminder goes stale without a fresh download', () => {
  localStorage.removeItem('shopledger:last-file-download-at')
  assert.equal(fileDownloadStale(), true) // কখনো ডাউনলোড হয়নি
  markFileDownloaded(new Date(Date.now() - 2 * 86_400_000))
  assert.equal(fileDownloadStale(), false) // ২ দিন আগে
  markFileDownloaded(new Date(Date.now() - 30 * 86_400_000))
  assert.equal(fileDownloadStale(), true) // ৩০ দিন আগে
})

test('createBackupSnapshot stores searchable record and downloadable payload', async () => {
  await seedShopData()
  await db.backups.clear()
  const rec = await createBackupSnapshot('manual', new Date('2026-09-19T07:00:00.000Z'))
  assert.equal(rec.kind, 'manual')
  assert.equal(rec.organization, 'কর্ণফুলী সেলস সেন্টার')
  assert.equal(rec.payload.data.customers?.length, 1)
  assert.ok(rec.size > 0)
  const saved = await db.backups.get(rec.id)
  assert.equal(saved?.payload.counts.sales, 2)
  // ফাইল-নাম প্যাটার্ন
  const { backupFileName } = await import('../src/lib/backup')
  assert.match(backupFileName('auto', rec.created_at), /^shopledger-backup-auto-\d{4}-\d{2}-\d{2}-\d{4}\.json$/)
})
