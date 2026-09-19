/**
 * ডেটা ব্যাকআপ ও রিস্টোর — শুধু মালিকের জন্য।
 *
 * দুই রকম ব্যাকআপ:
 *
 * ১) **ব্যাকআপ ফাইল (JSON)** — সব ডেটা টেবিল একটি ফাইলে; মালিক ডাউনলোড করে
 *    ফোন/কম্পিউটারে বা Google Drive-এ রাখেন। নতুন ফোন/রিসেট করা ব্রাউজারে
 *    এই ফাইল থেকেই পুরো হিসাব ফিরে আসে।
 *
 * ২) **প্রতিদিনের অটো ব্যাকআপ (অ্যাপের ভিতরে স্ন্যাপশট)** — প্রতিদিন প্রথম চালু
 *    হলে সেদিনের স্ন্যাপশট নেয়, আর দিনের মধ্যে অ্যাপ বন্ধ/মিনিমাইজ করলে
 *    সেদিনের স্ন্যাপশটটাকে সর্বশেষ অবস্থায় বদলে দেয় — ফলে ভুলে ডেটা নষ্ট
 *    হলেও আগের দিন পর্যন্ত সব ফেরানো যায়। সর্বশেষ ৭ দিনের অটো স্ন্যাপশট
 *    ও ১০টি নিজে নেওয়া স্ন্যাপশট থাকে।
 *
 * ⚠️ অটো স্ন্যাপশট একই ব্রাউজারের IndexedDB-তে থাকে — ব্রাউজারের ডেটা মুছলে
 * এটিও মুছে যায়। তাই মাঝে মাঝে ব্যাকআপ ফাইল ডাউনলোড করে বাইরে রাখা জরুরি।
 */
import { db } from './db'

export const BACKUP_APP_ID = 'shopledger-backup'
export const BACKUP_SCHEMA_VERSION = 1

/** কত দিনের অটো স্ন্যাপশট রাখা হবে */
export const AUTO_BACKUPS_TO_KEEP = 7
/** নিজে নেওয়া (ম্যানুয়াল) স্ন্যাপশট কতটা রাখা হবে */
export const MANUAL_BACKUPS_TO_KEEP = 10

/** ফাইল ডাউনলোড রিমাইন্ডার — এত দিন পর আবার ডাউনলোডের পরামর্শ */
export const FILE_DOWNLOAD_REMIND_DAYS = 7
export const LAST_FILE_DOWNLOAD_KEY = 'shopledger:last-file-download-at'

/** যেসব টেবিল ব্যাকআপে যায় (সিঙ্কের outbox/cursor বাদ — রিস্টোরের সময় ওগুলো রিসেট হয়) */
export const BACKUP_DATA_TABLES = [
  'users',
  'branches',
  'products',
  'purchases',
  'sales',
  'customers',
  'collections',
  'expenses',
  'orders',
  'stockAdjustments',
  'customerMessages',
  'ledgerEntries',
  'ledgerAudits',
] as const

export type BackupTableName = (typeof BACKUP_DATA_TABLES)[number]

export interface BackupPayload {
  app: string
  schema_version: number
  created_at: string
  /** তারিখ (এশিয়া/ঢাকা) — অটো ব্যাকআপে দিন হিসাবে ব্যবহৃত */
  day: string
  /** প্রতিষ্ঠানের নাম (যাচাইয়ে সাহায্য করে) */
  organization?: string
  counts: Partial<Record<BackupTableName, number>>
  data: Partial<Record<BackupTableName, unknown[]>>
}

export interface BackupRecord {
  id: string
  kind: 'auto' | 'manual'
  created_at: string
  day: string
  organization?: string
  /** রেকর্ড-সংখ্যা টেবিল অনুযায়ী */
  counts: Partial<Record<BackupTableName, number>>
  /** JSON আকার (বাইট) */
  size: number
  payload: BackupPayload
}

/** এশিয়া/ঢাকার ক্যালেন্ডার-দিন — `YYYY-MM-DD` */
export const dhakaDay = (d: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(d)

/** এশিয়া/ঢাকার সময় — দেখানোর জন্য `YYYY-MM-DD HH:mm` */
export const dhakaDateTime = (iso: string): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date(iso))
    .replace(',', '')

const bytes = (text: string): number => new TextEncoder().encode(text).length

/** বাইটকে পড়ার মতো করে (`1.2 MB`) */
export const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

/** প্রতিষ্ঠানের নাম (প্রথম শাখার organization) — পেলোডে ট্যাগ হিসেবে */
async function shopOrganization(): Promise<string | undefined> {
  const branches = await db.branches.toArray()
  branches.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
  const branch = branches[0]
  return branch?.organization?.trim() || branch?.name?.trim() || undefined
}

/** সব টেবিল পড়ে ব্যাকআপ পেলোড তৈরি */
export async function collectBackupPayload(now: Date = new Date()): Promise<BackupPayload> {
  const data: BackupPayload['data'] = {}
  const counts: BackupPayload['counts'] = {}
  for (const name of BACKUP_DATA_TABLES) {
    const rows = (await db.table(name).toArray()) as unknown[]
    data[name] = rows
    counts[name] = rows.length
  }
  return {
    app: BACKUP_APP_ID,
    schema_version: BACKUP_SCHEMA_VERSION,
    created_at: now.toISOString(),
    day: dhakaDay(now),
    organization: await shopOrganization(),
    counts,
    data,
  }
}

/** পেলোড → JSON টেক্সট (ফাইলে লেখার জন্য) */
export const serializeBackup = (payload: BackupPayload): string => JSON.stringify(payload)

export type ParseBackupResult =
  | { ok: true; payload: BackupPayload }
  | { ok: false; error: string }

/** ব্যাকআপ ফাইলের টেক্সট যাচাই করে পেলোড বানায় — ভুল হলে বাংলায় কারণ */
export function parseBackupText(text: string): ParseBackupResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'ফাইলটি সঠিক JSON নয় — নিশ্চয়ই ভুল ফাইল বেছে নেওয়া হয়েছে' }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'ফাইলের ভিতরের গঠন ব্যাকআপের মতো নয়' }
  }
  const p = raw as Record<string, unknown>
  if (p.app !== BACKUP_APP_ID) {
    return { ok: false, error: 'এটি কর্ণফুলী সেলস সেন্টারের ব্যাকআপ ফাইল নয়' }
  }
  const version = typeof p.schema_version === 'number' ? p.schema_version : 0
  if (version > BACKUP_SCHEMA_VERSION) {
    return { ok: false, error: `ফাইলটি নতুন ভার্সনের (v${version}) — আগে অ্যাপ আপডেট করুন` }
  }
  if (!p.data || typeof p.data !== 'object' || Array.isArray(p.data)) {
    return { ok: false, error: 'ব্যাকআপ ফাইলে ডেটা নেই বা ভাঙা' }
  }

  const data: BackupPayload['data'] = {}
  const counts: BackupPayload['counts'] = {}
  for (const name of BACKUP_DATA_TABLES) {
    const rows = (p.data as Record<string, unknown>)[name]
    const list = Array.isArray(rows) ? rows : []
    data[name] = list
    counts[name] = list.length
  }
  if (BACKUP_DATA_TABLES.every((n) => !(counts[n] ?? 0))) {
    return { ok: false, error: 'ব্যাকআপ ফাইলে কোনো ডেটাই নেই (খালি ব্যাকআপ)' }
  }

  return {
    ok: true,
    payload: {
      app: BACKUP_APP_ID,
      schema_version: BACKUP_SCHEMA_VERSION,
      created_at: typeof p.created_at === 'string' ? p.created_at : new Date().toISOString(),
      day: typeof p.day === 'string' ? p.day : dhakaDay(),
      organization: typeof p.organization === 'string' ? p.organization : undefined,
      counts,
      data,
    },
  }
}

/**
 * ব্যাকআপ রিস্টোর — বর্তমান **সব** ডেটা মুছে ফাইলের ডেটা বসে।
 * সিঙ্কের outbox/cursor-ও রিসেট হয়, যাতে পুরনো আইডির বাকি সিঙ্ক-কিউ
 * নতুন ডেটাকে নষ্ট না করে।
 */
export async function applyBackup(payload: BackupPayload): Promise<Partial<Record<BackupTableName, number>>> {
  const tables = [...BACKUP_DATA_TABLES.map((n) => db.table(n)), db.syncOutbox, db.syncCursors]
  await db.transaction('rw', tables, async () => {
    await Promise.all([db.syncOutbox.clear(), db.syncCursors.clear()])
    for (const name of BACKUP_DATA_TABLES) {
      await db.table(name).clear()
      const rows = payload.data[name] || []
      if (rows.length) await db.table(name).bulkAdd(rows as never[])
    }
  })
  return payload.counts
}

/** স্ন্যাপশটের ফাইল-নাম — `shopledger-backup-auto-2026-09-19-1042.json` */
export const backupFileName = (kind: 'auto' | 'manual' | 'file', iso: string): string =>
  `shopledger-backup-${kind}-${dhakaDateTime(iso).replace(':', '').replace(' ', '-')}.json`

/** ব্রাউজারে ফাইল ডাউনলোড */
export function downloadBackupText(text: string, filename: string): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** অ্যাপের ভিতরে স্ন্যাপশট সেভ (অটো/ম্যানুয়াল) — পুরনোগুলো ছাঁটাও হয় */
export async function createBackupSnapshot(kind: 'auto' | 'manual', now: Date = new Date()): Promise<BackupRecord> {
  const payload = await collectBackupPayload(now)
  const record: BackupRecord = {
    id: `bk-${now.getTime()}-${kind}`,
    kind,
    created_at: payload.created_at,
    day: payload.day,
    organization: payload.organization,
    counts: payload.counts,
    size: bytes(serializeBackup(payload)),
    payload,
  }
  await db.backups.put(record)
  await pruneBackups()
  return record
}

/** সর্বশেষ অটো স্ন্যাপশট */
export function latestAutoBackup(): Promise<BackupRecord | undefined> {
  return db.backups.orderBy('created_at').reverse().filter((b) => b.kind === 'auto').first()
}

/**
 * প্রতিদিনের অটো ব্যাকআপ — আজকের (ঢাকা-সময়) অটো স্ন্যাপশট না থাকলে নেয়।
 * অ্যাপ চালু/প্রতি ঘণ্টায়/আবার দেখা দিলে ডাকা হয়।
 */
export async function runDailyAutoBackup(now: Date = new Date()): Promise<{ created: boolean; record?: BackupRecord }> {
  const last = await latestAutoBackup()
  if (last && last.day === dhakaDay(now)) return { created: false, record: last }
  const record = await createBackupSnapshot('auto', now)
  return { created: true, record }
}

/**
 * দিনের মধ্যে অ্যাপ বন্ধ/মিনিমাইজ হলে — আজকের অটো স্ন্যাপশটটাকে সর্বশেষ
 * অবস্থায় বদলে দেয় (দিনের এন্ট্রিগুলোও যেন অটো ব্যাকআপে থাকে)।
 */
export async function refreshTodaysAutoBackup(now: Date = new Date()): Promise<{ updated: boolean }> {
  const last = await latestAutoBackup()
  if (!last || last.day !== dhakaDay(now)) return { updated: false }
  await db.backups.delete(last.id)
  await createBackupSnapshot('auto', now)
  return { updated: true }
}

/** স্ন্যাপশট সংখ্যা সীমায় রাখা — অটো ৭টি, ম্যানুয়াল ১০টি */
export async function pruneBackups(): Promise<void> {
  const all = await db.backups.orderBy('created_at').reverse().toArray()
  const limits: Record<BackupRecord['kind'], number> = { auto: AUTO_BACKUPS_TO_KEEP, manual: MANUAL_BACKUPS_TO_KEEP }
  const seen: Record<BackupRecord['kind'], number> = { auto: 0, manual: 0 }
  const drop: string[] = []
  for (const rec of all) {
    seen[rec.kind] += 1
    if (seen[rec.kind] > limits[rec.kind]) drop.push(rec.id)
  }
  if (drop.length) await db.backups.bulkDelete(drop)
}

/** শেষ ব্যাকআপ ফাইল কখন ডাউনলোড হয়েছিল (localStorage) */
export const lastFileDownloadAt = (): string | null => {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(LAST_FILE_DOWNLOAD_KEY)
}

export const markFileDownloaded = (now: Date = new Date()): void => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(LAST_FILE_DOWNLOAD_KEY, now.toISOString())
}

/** ফাইল ডাউনলোড অনেকদিন হয়নি — কি না (রিমাইন্ডারের জন্য) */
export function fileDownloadStale(now: Date = new Date()): boolean {
  const at = lastFileDownloadAt()
  if (!at) return true
  const days = (now.getTime() - new Date(at).getTime()) / 86_400_000
  return days > FILE_DOWNLOAD_REMIND_DAYS
}
