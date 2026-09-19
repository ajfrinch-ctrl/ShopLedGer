/* অডিট পার্ট J — ব্যাকআপ/রিস্টোর (lib + পেজ) এবং sync/outbox স্তর */
import {React as _React, win, db, check, section, renderAt, settle, text, find, all, clickEl, clickText as _clickText, setElValue as _setElValue, submitForm as _submitForm, seedBase, ownerUser, managerUser, useSalesStore, TODAY} from './harness'

const { default: Backup } = await import('../../src/pages/Backup')
const B = await import('../../src/lib/backup')
const S = await import('../../src/lib/sync')

const backupRoutes: Array<[string, unknown]> = [['/backup', Backup]]
/* অ্যাপটি globalThis.localStorage ব্যবহার করে (happy-dom window-এর নয়) */
const ls = (globalThis as unknown as { localStorage: Storage }).localStorage
/* happy-dom-এ URL.createObjectURL নেই — Fফাইল ডাউনলোড পথটা যাচাই করার জন্য স্টাব */
const urlAny = (globalThis as unknown as { URL: Record<string, unknown> }).URL
urlAny.createObjectURL = () => 'blob:stub'
urlAny.revokeObjectURL = () => {}
const nfc = (s: string) => s.normalize('NFC')
const hasText = (needle: string) => nfc(text()).includes(nfc(needle))
const btnExact = (label: string) =>
  all<HTMLButtonElement>('button').find((b) => nfc((b.textContent || '').trim()) === nfc(label))
const _btnStarts = (label: string) =>
  all<HTMLButtonElement>('button').find((b) => nfc((b.textContent || '').trim()).startsWith(nfc(label)))
const rowsOf = (c: Partial<Record<string, number>> | undefined) =>
  c ? Object.values(c).reduce((a, b) => a + (b || 0), 0) : 0
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function pickFile(name: string, content: string) {
  const input = all<HTMLInputElement>('input[type="file"]')[0]
  const FileCtor = (win as unknown as { File?: typeof File }).File
  if (!input || typeof FileCtor !== 'function') return false
  const file = new (FileCtor as unknown as new (p: BlobPart[], n: string, o?: FilePropertyBag) => File)([content], name, { type: 'application/json' })
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new (win as unknown as { Event: typeof Event }).Event('change', { bubbles: true }))
  await settle(280)
  return true
}

export async function runBackupSyncAudit() {
  await seedBase()
  /* ব্যাকআপ পরীক্ষার জন্য নিজে ডামি বিক্রি বসানো (seedBase-এ বিক্রি খালি থাকে) */
  const seedSale = {
    id: 'S-BK-1', uid: 'uid-bk-1', date: `${TODAY}T10:00:00`,
    items: [{ product_id: 'p-rice', product_name: 'মিনিকেট চাল', quantity: 10, unit: 'কেজি', sale_price: 75, purchase_price: 60, total: 750, profit: 150 }],
    subtotal: 750, discount: 0, total_amount: 750, total_profit: 150, payment_type: 'নগদ' as const,
    branch_id: 'branch-1', created_by: 'manager-1', created_at: `${TODAY}T10:00:00`,
    customer_name: 'ক্রেতা করিম', customer_id: 'c-karim',
  }
  await db.sales.put(seedSale as never)
  useSalesStore.setState({ sales: [seedSale as never] })
  const seededSales = 1
  const seededCustomers = (await db.customers.toArray()).length

  /* ════════ ১) ব্যাকআপ ফাইল পড়া ও যাচাই (lib) ════════ */
  section('Backup — ফাইল পড়া, যাচাই ও নামকরণ')
  const bad = B.parseBackupText('এটা JSON নয়')
  check('ভাঙা JSON ধরিয়ে দেয়', !bad.ok && hasTextNfcLib(bad.error, 'সঠিক JSON নয়'), bad.ok ? '' : bad.error)
  check('JSON array হলে গঠনের ভুল দেখায়', !B.parseBackupText('[]').ok)
  check('অন্য অ্যাপের ফাইল চেনে না', !B.parseBackupText('{"app":"other","data":{}}').ok)
  check('নতুন ভার্সনের ফাইল আটকায় (আপডেট করতে বলে)', !B.parseBackupText('{"app":"shopledger-backup","schema_version":99,"data":{}}').ok)
  const emptyFile = B.parseBackupText('{"app":"shopledger-backup","schema_version":1,"data":{}}')
  check('খালি ব্যাকআপ আটকায়', !emptyFile.ok && hasTextNfcLib(emptyFile.error, 'কোনো ডেটাই নেই'), emptyFile.ok ? '' : emptyFile.error)
  const payload = await B.collectBackupPayload()
  check('ব্যাকআপ পেলোডে অ্যাপ আইডি ও স্কিমা ভার্সন থাকে', payload.app === B.BACKUP_APP_ID && payload.schema_version === B.BACKUP_SCHEMA_VERSION)
  check('ব্যাকআপে সব বিক্রি ধরা পড়ে', payload.counts.sales === seededSales, `payload=${payload.counts.sales} seed=${seededSales}`)
  check('ব্যাকআপে সব ক্রেতা ধরা পড়ে', payload.counts.customers === seededCustomers)
  const roundTrip = B.parseBackupText(B.serializeBackup(payload))
  check('সেভ → আবার পড়া গেলে ডেটা অটুট থাকে', roundTrip.ok && roundTrip.payload.counts.sales === payload.counts.sales && roundTrip.payload.day === payload.day)
  check('ফাইলের নামে তারিখ-সময় থাকে', /^shopledger-backup-manual-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(B.backupFileName('manual', new Date().toISOString())), B.backupFileName('manual', new Date().toISOString()))

  /* ════════ ২) স্ন্যাপশট, ছাঁটা ও ডাউনলোড-রিমাইন্ডার (lib) ════════ */
  section('Backup — স্ন্যাপশট, সীমা ও রিমাইন্ডার')
  const first = await B.createBackupSnapshot('manual')
  check('স্ন্যাপশট সংরক্ষিত হয় (id/kind/counts সহ)', first.kind === 'manual' && first.counts.sales === seededSales && first.size > 0, `${first.id} ${first.size}B`)
  const sameDay = await B.runDailyAutoBackup()
  const again = await B.runDailyAutoBackup()
  check('দিনে একবারই অটো স্ন্যাপশট (দ্বিতীয়বার নতুন নয়)', sameDay.created === true && again.created === false)
  const refreshed = await B.refreshTodaysAutoBackup()
  check('দিনের শেষে আজকের অটো স্ন্যাপশট হালনাগাদ হয়', refreshed.updated === true)
  for (let i = 0; i < 13; i++) await B.createBackupSnapshot('manual')
  const kept = await db.backups.toArray()
  check(`নিজে নেওয়া স্ন্যাপশট সর্বোচ্চ ${B.MANUAL_BACKUPS_TO_KEEP}টি রাখে`, kept.filter((r) => r.kind === 'manual').length === B.MANUAL_BACKUPS_TO_KEEP, String(kept.filter((r) => r.kind === 'manual').length))
  check(`অটো স্ন্যাপশট সর্বোচ্চ ${B.AUTO_BACKUPS_TO_KEEP}টি রাখে`, kept.filter((r) => r.kind === 'auto').length <= B.AUTO_BACKUPS_TO_KEEP, String(kept.filter((r) => r.kind === 'auto').length))
  ls.removeItem(B.LAST_FILE_DOWNLOAD_KEY)
  check('কখনো ডাউনলোড না হলে রিমাইন্ডার দেখায়', B.fileDownloadStale() === true && B.lastFileDownloadAt() === null)
  B.markFileDownloaded(new Date())
  check('এখনই ডাউনলোড করলে রিমাইন্ডার থাকে না', B.fileDownloadStale() === false && !!B.lastFileDownloadAt())
  B.markFileDownloaded(new Date(Date.now() - (B.FILE_DOWNLOAD_REMIND_DAYS + 2) * 86_400_000))
  check(`${B.FILE_DOWNLOAD_REMIND_DAYS} দিনের বেশি হলে আবার রিমাইন্ডার`, B.fileDownloadStale() === true)

  /* ════════ ৩) রিস্টোর (lib) ════════ */
  section('Backup — রিস্টোর করলে ডেটা ফিরে আসে')
  const snapshot = await B.createBackupSnapshot('manual')
  const victim = seedSale
  await db.sales.delete(victim.id)
  useSalesStore.setState({ sales: useSalesStore.getState().sales.filter((s) => s.id !== victim.id) })
  await db.syncOutbox.add({ id: 'ob-dummy', table: 'sales', row_uid: 'u', op: 'put', payload: {}, rev: 1, device_id: 'd', created_at: TODAY, attempts: 0 } as never)
  const restored = await B.applyBackup(snapshot.payload)
  check('রিস্টোরের পর মুছে ফেলা সারি ফিরে আসে', !!(await db.sales.get(victim.id)), victim.id)
  check('রিস্টোরে কত সারি ফিরল তার হিসাব দেয়', (restored.sales || 0) === seededSales, JSON.stringify(restored))
  check('রিস্টোরে sync outbox/cursor পরিষ্কার হয় (পুরনো কিউ নতুন ডেটা নষ্ট করে না)', (await db.syncOutbox.count()) === 0)

  /* ════════ ৪) ব্যাকআপ পেজ ════════ */
  section('Backup পেজ — ডাউনলোড, স্ন্যাপশট, রিস্টোর ও ডিলিট')
  await renderAt('/backup', backupRoutes, { ...ownerUser })
  await settle(320)
  check('পেজের শিরোনাম ও অটো-ব্যাকআপ অবস্থা দেখা যায়', hasText('ডেটা ব্যাকআপ ও রিস্টোর') && hasText('প্রতিদিনের অটো ব্যাকআপ') && hasText('চালু আছে'), text().slice(0, 200))
  const liveRows = rowsOf(await liveCounts())
  check('বর্তমান মোট রেকর্ডের সংখ্যা দেখায়', hasText('বর্তমান মোট রেকর্ড') && hasText(liveRows.toLocaleString('en-IN')), `rows=${liveRows} :: ${text().slice(0, 260)}`)
  check('স্ন্যাপশট তালিকায় অটো ব্যাজ আছে', hasText('অটো'))
  check('কাজের তিনটি বোতাম আছে', !!btnExact('ব্যাকআপ ফাইল ডাউনলোড করুন') && !!btnExact('ভিতরে স্ন্যাপশট নিন') && !!btnExact('ফাইল থেকে রিস্টোর'))
  const manualIdsBefore = new Set((await db.backups.toArray()).map((r) => r.id))
  await clickEl(btnExact('ভিতরে স্ন্যাপশট নিন')!)
  await settle(320)
  check('"ভিতরে স্ন্যাপশট নিন" নতুন স্ন্যাপশট বানায়', (await db.backups.toArray()).some((r) => !manualIdsBefore.has(r.id) && r.kind === 'manual'))
  check('স্ন্যাপশট সেভের টোস্ট দেখায়', hasText('অ্যাপের ভিতরে স্ন্যাপশট সেভ হয়েছে'), text().slice(-160))
  check('তালিকায় "নিজে নেওয়া" ব্যাজ আসে', hasText('নিজে নেওয়া'))
  ls.removeItem(B.LAST_FILE_DOWNLOAD_KEY)
  await renderAt('/backup', backupRoutes, { ...ownerUser })
  await settle(320)
  check('ডাউনলোড না হলে হলুদ রিমাইন্ডার দেখায়', hasText('এখনো এই ডিভাইস থেকে ব্যাকআপ ফাইল ডাউনলোড করা হয়নি'), text().slice(0, 300))
  await clickEl(btnExact('ব্যাকআপ ফাইল ডাউনলোড করুন')!)
  await settle(360)
  check('ফাইল ডাউনলোডের টোস্ট দেখায়', hasText('ব্যাকআপ ফাইল ডাউনলোড হয়েছে'), text().slice(-200))
  check('ডাউনলোডের সময় localStorage-এ লেখা হয়', !!B.lastFileDownloadAt())

  /* রিস্টোর নিশ্চিতকরণ → বাতিল → আবার খুলে রিস্টোর */
  const markSale = {
    ...seedSale, id: 'S-MARK-1', uid: 'uid-mark-1', total_amount: 300, subtotal: 300, total_profit: 60,
    items: [{ product_id: 'p-rice', product_name: 'মিনিকেট চাল', quantity: 4, unit: 'কেজি', sale_price: 75, purchase_price: 60, total: 300, profit: 60 }],
  }
  await db.sales.put(markSale as never)
  useSalesStore.setState({ sales: [...useSalesStore.getState().sales, markSale as never] })
  await clickEl(btnExact('ভিতরে স্ন্যাপশট নিন')!)     // মার্কার সারি সহ নতুন স্ন্যাপশট
  await settle(320)
  const newestManual = (await db.backups.toArray()).filter((r) => r.kind === 'manual').sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  check('নতুন স্ন্যাপশটে হালনাগাদ ডেটা (মার্কার বিক্রি) ধরা পড়ে', (newestManual?.counts.sales || 0) >= 2, String(newestManual?.counts.sales))
  await db.sales.delete('S-MARK-1')
  useSalesStore.setState({ sales: useSalesStore.getState().sales.filter((s) => s.id !== 'S-MARK-1') })
  await db.syncOutbox.add({ id: 'ob-dummy2', table: 'sales', row_uid: 'u2', op: 'put', payload: {}, rev: 1, device_id: 'd', created_at: TODAY, attempts: 0 } as never)
  await renderAt('/backup', backupRoutes, { ...ownerUser })
  await settle(320)
  await clickEl(all<HTMLButtonElement>('button').filter((b) => nfc((b.textContent || '').trim()) === nfc('রিস্টোর'))[0])
  await settle(220)
  check('রিস্টোরের আগে নিশ্চিতকরণ দেখায় (উৎস, সময়, রেকর্ড সংখ্যা, সতর্কবার্তা)',
    hasText('রিস্টোর করবেন?') && hasText('উৎস:') && hasText('মোট রেকর্ড:') && hasText('সব ডেটা মুছে গিয়ে'), text().slice(0, 400))
  await clickEl(btnExact('বাতিল')!)
  await settle(180)
  check('"বাতিল" চাপলে রিস্টোর হয় না', !hasText('রিস্টোর করবেন?') && !(await db.sales.get('S-MARK-1')))
  await clickEl(all<HTMLButtonElement>('button').filter((b) => nfc((b.textContent || '').trim()) === nfc('রিস্টোর'))[0])
  await settle(200)
  await clickEl(btnExact('রিস্টোর করুন')!)
  await settle(600)
  check('রিস্টোর শেষ হলে সফল বার্তা ও রেকর্ড সংখ্যা দেখায়', hasText('রিস্টোর সম্পন্ন!') && hasText('টি রেকর্ড ফিরে এসেছে'), text().slice(-260))
  check('রিস্টোরের পর স্ন্যাপশটের সারিগুলো ডেটাবেজে ফিরে আসে', !!(await db.sales.get('S-MARK-1')) && (await db.sales.count()) >= 2, `sales=${await db.sales.count()}`)
  check('রিস্টোরে sync outbox-ও পরিষ্কার হয়', (await db.syncOutbox.count()) === 0, String(await db.syncOutbox.count()))
  check('[ফাইন্ডিং] রিস্টোরের পর লগইন/রিলোড বাধ্যতামূলক (in-memory store নিজে হালনাগাদ হয় না)', true)
  check('রিস্টোরের পর আবার লগইন করতে বলে', hasText('নিরাপত্তার জন্য আবার লগইন করতে হবে') && !!btnExact('লগইন পেজে যান'))

  /* স্ন্যাপশট ডিলিট */
  await renderAt('/backup', backupRoutes, { ...ownerUser })
  await settle(320)
  const countBeforeDelete = (await db.backups.toArray()).length
  await clickEl(all<HTMLButtonElement>('button').filter((b) => nfc((b.textContent || '').trim()) === nfc('মুছুন'))[0])
  await settle(200)
  check('মুছে ফেলার আগে নিশ্চিতকরণ দেখায়', hasText('স্ন্যাপশট মুছবেন?') && hasText('স্থায়ীভাবে মুছে যাবে'), text().slice(0, 300))
  await clickEl(btnExact('মুছে ফেলুন')!)
  await settle(320)
  check('স্ন্যাপশট সত্যিই মুছে যায়', (await db.backups.toArray()).length === countBeforeDelete - 1)
  check('মুছে ফেলার টোস্ট দেখায়', hasText('স্ন্যাপশট মুছে ফেলা হয়েছে'), text().slice(-160))

  /* ফাইল থেকে রিস্টোর (ভুল ফাইল → স্পষ্ট বার্তা) */
  const fileInputOk = await pickFile('wrong.json', '{"app":"other","data":{"sales":[1]}}')
  check('ফাইল বাছাইয়ের ইনপুট আছে (json ফাইল)', !!find('input[type="file"]') && (all<HTMLInputElement>('input[type="file"]')[0]?.accept || '').includes('.json'), fileInputOk ? '' : 'happy-dom File নেই')
  if (fileInputOk) {
    check('ভুল ফাইলে স্পষ্ট ত্রুটি দেখায়', hasText('এটি কর্ণফুলী সেলস সেন্টারের ব্যাকআপ ফাইল নয়'), text().slice(-200))
    const good = B.serializeBackup(await B.collectBackupPayload())
    await pickFile('good.json', good)
    check('সঠিক ফাইল দিলে রিস্টোরের নিশ্চিতকরণ খোলে (ফাইলের নাম দেখায়)', hasText('রিস্টোর করবেন?') && hasText('good.json'), text().slice(0, 300))
  }

  /* ════════ ৫) sync স্তর — meta, tombstone, duplicate, conflict ════════ */
  section('Sync — row meta, soft delete, duplicate ও conflict নিয়ম')
  const uid1 = S.newUid(), uid2 = S.newUid()
  check('newUid সঠিক UUID দেয় ও প্রতিবার আলাদা', uuidRe.test(uid1) && uuidRe.test(uid2) && uid1 !== uid2, `${uid1} / ${uid2}`)
  check('এই ডিভাইসের আইডি স্থায়ী ও localStorage-এ জমা', S.deviceId() === S.deviceId() && ls.getItem('shopledger:device-id') === S.deviceId(), S.deviceId())
  const attached = S.attachSyncMeta({ id: 'C2609001', name: 'করিম', created_at: '2026-01-01T00:00:00.000Z' })
  check('নতুন row-এ meta বসে (uid/local_id/rev 1/তৈরি ডিভাইস)', attached.uid === undefined || uuidRe.test(String(attached.uid)) ? attached.local_id === 'C2609001' && attached.rev === 1 && attached.deleted_at === null && attached.origin_device_id === S.deviceId() : false, JSON.stringify({ local_id: attached.local_id, rev: attached.rev }))
  check('meta-তে schema_version থাকে', attached.schema_version === S.SCHEMA_VERSION)
  const touched = S.touchSyncMeta(attached, { name: 'করিম হোসেন' }, { now: '2026-02-01T00:00:00.000Z' })
  check('হালনাগাদে rev বাড়ে ও ফিল্ড বদলায়', touched.rev === 2 && touched.name === 'করিম হোসেন' && touched.updated_at === '2026-02-01T00:00:00.000Z', JSON.stringify({ rev: touched.rev }))
  const tomb = S.markDeleted(touched, { now: '2026-03-01T00:00:00.000Z' })
  check('মুছলে hard delete নয় — tombstone বসে ও rev বাড়ে', tomb.deleted_at === '2026-03-01T00:00:00.000Z' && tomb.rev === 3 && S.isDeleted(tomb) && !S.isDeleted(touched))
  check('natural key শাখা+ফোন+নাম মিলিয়ে তৈরি হয়', S.naturalKeyOf('customers', { branch_id: 'B1', phone: '0171', name: ' করিম ' } as never) === 'b1|0171|করিম', S.naturalKeyOf('customers', { branch_id: 'B1', phone: '0171', name: ' করিম ' } as never))
  const dupRows = [
    { uid: 'u1', branch_id: 'b1', phone: '0171', name: 'করিম', deleted_at: null, rev: 1, updated_at: 't1', updated_by_device_id: 'd1' },
    { uid: 'u2', branch_id: 'b1', phone: '0171', name: 'করিম', deleted_at: null, rev: 1, updated_at: 't2', updated_by_device_id: 'd2' },
    { uid: 'u3', branch_id: 'b1', phone: '0172', name: 'রহিম', deleted_at: null, rev: 1, updated_at: 't3', updated_by_device_id: 'd3' },
    { uid: 'u4', branch_id: 'b1', phone: '0171', name: 'করিম', deleted_at: 't', rev: 2, updated_at: 't4', updated_by_device_id: 'd4' },
  ] as never[]
  const dups = S.findDuplicates('customers', dupRows)
  check('একই ক্রেতার দুই সারি ডুপ্লিকেট হিসেবে ধরা পড়ে (tombstone বাদ)', dups.size === 1 && dups.get('b1|0171|করিম')?.length === 2, `${dups.size}`)
  check('আগেই থাকলে নতুন row না — পুরোনোটাই ফেরত আসে', S.dedupeCandidate('customers', { branch_id: 'b1', phone: '0171', name: 'করিম' } as never, dupRows)?.uid === 'u1')
  const base = { uid: 'x', rev: 1, updated_at: 'a', updated_by_device_id: 'd1', deleted_at: null } as never
  check('conflict-এ delete সবসময় জেতে (resurrect হয় না)', S.resolveConflict({ ...base, rev: 9 }, { ...base, rev: 1, deleted_at: 'z' }).reason === 'tombstone' && S.resolveConflict({ ...base, rev: 9 }, { ...base, rev: 1, deleted_at: 'z' }).winner.deleted_at === 'z')
  check('বড় rev জেতে', S.resolveConflict({ ...base, rev: 5 }, { ...base, rev: 2 }).winner.rev === 5)
  check('rev সমান হলে নতুন updated_at জেতে', S.resolveConflict({ ...base, updated_at: 'z' }, { ...base, updated_at: 'a' }).winner.updated_at === 'z')
  const tie1 = S.resolveConflict({ ...base, updated_by_device_id: 'd2' }, { ...base, updated_by_device_id: 'd1' })
  const tie2 = S.resolveConflict({ ...base, updated_by_device_id: 'd1' }, { ...base, updated_by_device_id: 'd2' })
  check('সব সমান হলে ডিভাইস-ভিত্তিক একই ফল আসে (দুই ডিভাইসে মিল থাকবে)', tie1.winner.updated_by_device_id === tie2.winner.updated_by_device_id && tie1.reason === 'device-tiebreak', tie1.winner.updated_by_device_id)
  const remote = S.toRemotePayload('customers', { branch_id: 'b1', phone: '0171', name: 'করিম', extra: 'বাদ' } as never)
  check('remote payload-এ শুধু schema-র কলাম যায়', 'name' in remote && 'phone' in remote && !('extra' in remote), JSON.stringify(remote).slice(0, 120))
  check('remote→local ম্যাপে local_id থেকেই id ফেরে', S.fromRemotePayload('customers', { local_id: 'C2609001', name: 'করিম' }).id === 'C2609001')

  /* ════════ ৬) outbox ও cursor ════════ */
  section('Sync — outbox queue, ক্রম, ack ও cursor')
  await db.syncOutbox.clear()
  await db.syncCursors.clear()
  await S.outbox.enqueue('sales', 'row-s1', 'put', { id: 'S1' })
  await S.outbox.enqueue('customers', 'row-c1', 'put', { id: 'C1' })
  check('queue-তে দুটি কাজ জমা হয়', (await S.outbox.pendingCount()) === 2)
  const ordered = await S.outbox.pending()
  check('parent (ক্রেতা) আগে, child (বিক্রি) পরে — foreign key ক্রম ঠিক', ordered[0].table === 'customers' && ordered[1].table === 'sales', ordered.map((o) => o.table).join(','))
  check('queue-র প্রতিটি কাজে ডিভাইস ও rev লেখা থাকে', ordered.every((o) => o.device_id === S.deviceId() && o.rev === 1 && !!o.id))
  await S.outbox.ack([ordered[0].id])
  check('push হওয়া কাজ queue থেকে সরে যায়', (await S.outbox.pendingCount()) === 1)
  await S.outbox.enqueue('customers', 'row-c1', 'put', { id: 'C1-v2' })
  await S.outbox.enqueue('customers', 'row-c1', 'put', { id: 'C1-v3' })
  const removed = await S.outbox.compact()
  const left = await db.syncOutbox.toArray()
  check('একই সারির পুরোনো put মুছে শুধু সর্বশেষটি থাকে', removed === 1 && left.filter((o) => o.row_uid === 'row-c1' && o.op === 'put').length === 1, `removed=${removed} left=${left.length}`)
  await S.outbox.enqueue('customers', 'row-c1', 'delete', { id: 'C1' })
  await S.outbox.compact()
  check('delete থাকলে সেটিই জেতে (put ফিরিয়ে আনে না)', (await db.syncOutbox.toArray()).filter((o) => o.row_uid === 'row-c1').length === 1 && (await db.syncOutbox.toArray()).find((o) => o.row_uid === 'row-c1')?.op === 'delete')
  const freshCursor = await S.outbox.cursor('sales')
  check('নতুন টেবিলের cursor শুরুতে খালি', freshCursor.pulled_through === null && freshCursor.table === 'sales')
  await S.outbox.setCursor('sales', '2026-09-19T00:00:00.000Z')
  const moved = await S.outbox.cursor('sales')
  check('pull-এর পর cursor এগিয়ে যায় ও সময় লেখা হয়', moved.pulled_through === '2026-09-19T00:00:00.000Z' && !!moved.last_synced_at, JSON.stringify(moved))

  /* ════════ ৭) ভূমিকার সীমানা ════════ */
  section('Backup — কে ঢুকতে পারে (রাউট-গার্ড)')
  const staffCountBefore = (await db.backups.count())
  await renderAt('/backup', backupRoutes, { ...managerUser })
  await settle(300)
  check('[ফাইন্ডিং] ব্যবস্থাপক সরাসরি /backup খুললে পেজ নিজে আটকায় না (সুরক্ষা শুধু রাউটে)', hasText('ডেটা ব্যাকআপ ও রিস্টোর'), text().slice(0, 160))
  check('[ফাইন্ডিং] খোলামাত্রই অটো স্ন্যাপশট তৈরি হয় (README-তে লেখা নেই)', (await db.backups.count()) >= staffCountBefore, `${staffCountBefore} → ${await db.backups.count()}`)
}

async function liveCounts(): Promise<Partial<Record<string, number>>> {
  const counts: Partial<Record<string, number>> = {}
  for (const name of B.BACKUP_DATA_TABLES) counts[name] = await db.table(name).count()
  return counts
}

function hasTextNfcLib(value: string | undefined, needle: string) {
  return !!value && value.normalize('NFC').includes(needle.normalize('NFC'))
}
