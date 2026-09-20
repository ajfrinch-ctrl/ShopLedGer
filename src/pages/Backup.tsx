import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DatabaseBackup,
  Download,
  Save,
  Upload,
  History,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Loader2,
  Info,
  X,
} from 'lucide-react'
import { db } from '../lib/db'
import { useAuthStore } from '../stores/authStore'
import {
  AUTO_BACKUPS_TO_KEEP,
  BACKUP_DATA_TABLES,
  FILE_DOWNLOAD_REMIND_DAYS,
  type BackupPayload,
  type BackupRecord,
  type BackupTableName,
  applyBackup,
  backupFileName,
  collectBackupPayload,
  createBackupSnapshot,
  dhakaDateTime,
  downloadBackupText,
  fileDownloadStale,
  formatBytes,
  lastFileDownloadAt,
  markFileDownloaded,
  parseBackupText,
  runDailyAutoBackup,
  serializeBackup,
} from '../lib/backup'

const TABLE_LABELS: Record<BackupTableName, string> = {
  users: 'আইডি',
  branches: 'শাখা',
  products: 'পণ্য',
  purchases: 'ক্রয়',
  sales: 'বিক্রি',
  customers: 'ক্রেতা',
  collections: 'আদায় রসিদ',
  expenses: 'খরচ',
  orders: 'অর্ডার',
  stockAdjustments: 'স্টক সমন্বয়',
  customerMessages: 'বার্তা',
  ledgerEntries: 'খাতার এন্ট্রি',
  ledgerAudits: 'খাতা অডিট',
}

const totalRows = (counts: Partial<Record<BackupTableName, number>> | undefined): number =>
  counts ? Object.values(counts).reduce<number>((a, b) => a + (b || 0), 0) : 0

/** রিস্টোরের আগে যাচাই-তালিকা দেখানোর মডাল */
interface PendingRestore {
  source: string
  payload: BackupPayload
}

export default function Backup() {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const canManageBackup = user?.role === 'owner'

  const [snapshots, setSnapshots] = useState<BackupRecord[]>([])
  const [liveCounts, setLiveCounts] = useState<Partial<Record<BackupTableName, number>>>({})
  const [busy, setBusy] = useState<'download' | 'snapshot' | null>(null)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [pending, setPending] = useState<PendingRestore | null>(null)
  const [restoreBusy, setRestoreBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BackupRecord | null>(null)
  const [stale, setStale] = useState(false)
  const [lastDownload, setLastDownload] = useState<string | null>(null)
  const [restoreDone, setRestoreDone] = useState<Partial<Record<BackupTableName, number>> | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const list = await db.backups.orderBy('created_at').reverse().toArray()
    setSnapshots(list)
    const cs: Partial<Record<BackupTableName, number>> = {}
    for (const name of BACKUP_DATA_TABLES) cs[name] = await db.table(name).count()
    setLiveCounts(cs)
  }, [])

  useEffect(() => {
    if (!canManageBackup) return
    void load()
    setStale(fileDownloadStale())
    setLastDownload(lastFileDownloadAt())
    // পেজে এলেই আজকের অটো ব্যাকআপ নিশ্চিত করা হয় (না থাকলে নেয়)
    void runDailyAutoBackup().then(() => load())
  }, [load, canManageBackup])

  const showToast = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 4000)
  }

  const handleDownload = async () => {
    setBusy('download')
    try {
      const payload = await collectBackupPayload()
      downloadBackupText(serializeBackup(payload), backupFileName('file', payload.created_at))
      markFileDownloaded()
      setStale(false)
      setLastDownload(payload.created_at)
      showToast('ok', 'ব্যাকআপ ফাইল ডাউনলোড হয়েছে — ফোন/কম্পিউটারের নিরাপদ জায়গায় রাখুন')
    } catch {
      showToast('err', 'ব্যাকআপ ফাইল তৈরি করা গেল না — আবার চেষ্টা করুন')
    } finally {
      setBusy(null)
    }
  }

  const handleSnapshot = async () => {
    setBusy('snapshot')
    try {
      await createBackupSnapshot('manual')
      await load()
      showToast('ok', 'অ্যাপের ভিতরে স্ন্যাপশট সেভ হয়েছে')
    } catch {
      showToast('err', 'স্ন্যাপশট নেওয়া গেল না')
    } finally {
      setBusy(null)
    }
  }

  const handleFilePicked = async (file: File | undefined) => {
    if (!file) return
    try {
      const text = await file.text()
      const parsed = parseBackupText(text)
      if (!parsed.ok) return showToast('err', parsed.error)
      setPending({ source: file.name, payload: parsed.payload })
    } catch {
      showToast('err', 'ফাইলটি পড়া গেল না')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleRestore = async () => {
    if (!pending) return
    setRestoreBusy(true)
    try {
      const counts = await applyBackup(pending.payload)
      setPending(null)
      setRestoreDone(counts)
    } catch {
      showToast('err', 'রিস্টোর করা গেল না — ফাইলটি ঠিক আছে কি না দেখে আবার চেষ্টা করুন')
    } finally {
      setRestoreBusy(false)
    }
  }

  const handleDelete = async (rec: BackupRecord) => {
    await db.backups.delete(rec.id)
    setDeleteTarget(null)
    await load()
    showToast('ok', 'স্ন্যাপশট মুছে ফেলা হয়েছে')
  }

  const downloadSnapshot = (rec: BackupRecord) => {
    downloadBackupText(serializeBackup(rec.payload), backupFileName(rec.kind, rec.created_at))
    markFileDownloaded()
    setStale(false)
    setLastDownload(new Date().toISOString())
  }

  const autoSnap = snapshots.find((s) => s.kind === 'auto') || null
  const manualSnaps = snapshots.filter((s) => s.kind === 'manual')

  if (!canManageBackup) {
    return <p role="alert" className="p-4 text-sm text-red-700">এই পেজ শুধু মালিকের জন্য।</p>
  }

  return (
    <div className="pb-24">
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-10 flex items-center gap-2">
        <DatabaseBackup size={20} className="text-teal-600" />
        <h2 className="text-lg font-semibold text-gray-800">ডেটা ব্যাকআপ ও রিস্টোর</h2>
      </div>

      <div className="p-4 space-y-4">
        {stale && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 flex gap-2.5">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              {lastDownload
                ? `${FILE_DOWNLOAD_REMIND_DAYS} দিনের বেশি হয়েছে ব্যাকআপ ফাইল ডাউনলোড করেননি।`
                : 'এখনো এই ডিভাইস থেকে ব্যাকআপ ফাইল ডাউনলোড করা হয়নি।'}{' '}
              ফোন হারালে বা ব্রাউজারের ডেটা মুছলে অ্যাপের ভিতরের স্ন্যাপশটও মুছে যায় — তাই মাঝে মাঝে ফাইল ডাউনলোড করে WhatsApp/Google Drive-এ রাখুন।
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="card p-3">
            <p className="text-xs text-gray-500">প্রতিদিনের অটো ব্যাকআপ</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-green-700">
              <CheckCircle2 size={16} /> চালু আছে
            </p>
            <p className="mt-1 text-[11px] text-gray-500 leading-snug">
              {autoSnap ? `শেষ: ${dhakaDateTime(autoSnap.created_at)}` : 'শীঘ্রই — অ্যাপ ব্যবহার করলেই হবে'}
            </p>
          </div>
          <div className="card p-3">
            <p className="text-xs text-gray-500">বর্তমান মোট রেকর্ড</p>
            <p className="mt-1 text-sm font-semibold text-gray-800">{totalRows(liveCounts).toLocaleString('en-IN')} টি</p>
            <p className="mt-1 text-[11px] text-gray-500 leading-snug">
              স্ন্যাপশট: {snapshots.length} টি (অটো সর্বোচ্চ {AUTO_BACKUPS_TO_KEEP} দিন)
            </p>
          </div>
        </div>

        <div className="card p-4 space-y-3">
          <button
            onClick={handleDownload}
            disabled={busy !== null}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
          >
            {busy === 'download' ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            ব্যাকআপ ফাইল ডাউনলোড করুন
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleSnapshot}
              disabled={busy !== null}
              className="flex items-center justify-center gap-2 rounded-xl bg-teal-50 py-2.5 text-xs font-semibold text-teal-700 active:scale-[0.99] disabled:opacity-60"
            >
              {busy === 'snapshot' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              ভিতরে স্ন্যাপশট নিন
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-xl bg-red-50 py-2.5 text-xs font-semibold text-red-700 active:scale-[0.99]"
            >
              <Upload size={16} />
              ফাইল থেকে রিস্টোর
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => void handleFilePicked(e.target.files?.[0])}
          />
          {lastDownload && (
            <p className="text-center text-[11px] text-gray-400">শেষ ফাইল ডাউনলোড: {dhakaDateTime(lastDownload)}</p>
          )}
        </div>

        <div className="rounded-2xl bg-blue-50/60 border border-blue-100 p-3 flex gap-2.5">
          <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="text-[11px] text-blue-900 leading-relaxed space-y-1">
            <p>• <b>অটো ব্যাকআপ:</b> প্রতিদিন অ্যাপ খুললে সেদিনের স্ন্যাপশট নেয়, আর দিনে অ্যাপ বন্ধ করলে সেদিনের সর্বশেষ অবস্থা সেভ হয়। সর্বশেষ {AUTO_BACKUPS_TO_KEEP} দিনের স্ন্যাপশট থাকে।</p>
            <p>• <b>রিস্টোর:</b> নিচের যেকোনো স্ন্যাপশট বা ডাউনলোড করা ফাইল থেকে পুরো হিসাব ফিরিয়ে আনা যায় — রিস্টোরে বর্তমান ডেটা বদলে যায়।</p>
            <p>• <b>সবচেয়ে নিরাপদ:</b> সপ্তাহে অন্তত একবার ফাইল ডাউনলোড করে এই ফোনের বাইরে (Google Drive/অন্য ফোন) রাখুন।</p>
          </div>
        </div>

        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-2">
            <History size={16} className="text-gray-400" /> অ্যাপের ভিতরের স্ন্যাপশট
          </h3>
          {snapshots.length === 0 && (
            <div className="card p-4 text-center text-xs text-gray-400">এখনো কোনো স্ন্যাপশট নেই</div>
          )}
          <div className="space-y-2">
            {snapshots.map((rec) => (
              <div key={rec.id} className="card p-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      rec.kind === 'auto' ? 'bg-green-50 text-green-700' : 'bg-indigo-50 text-indigo-700'
                    }`}
                  >
                    {rec.kind === 'auto' ? 'অটো' : 'নিজে নেওয়া'}
                  </span>
                  <p className="text-xs font-semibold text-gray-800 flex-1 min-w-0 truncate">
                    {dhakaDateTime(rec.created_at)}
                  </p>
                  <p className="text-[10px] text-gray-400 shrink-0">{formatBytes(rec.size)} • {totalRows(rec.counts)} রেকর্ড</p>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => downloadSnapshot(rec)}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-gray-50 py-2 text-[11px] font-semibold text-gray-700 active:scale-[0.98]"
                  >
                    <Download size={13} /> ডাউনলোড
                  </button>
                  <button
                    onClick={() => setPending({ source: rec.kind === 'auto' ? 'অটো স্ন্যাপশট' : 'নিজে নেওয়া স্ন্যাপশট', payload: rec.payload })}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-50 py-2 text-[11px] font-semibold text-amber-700 active:scale-[0.98]"
                  >
                    <Upload size={13} /> রিস্টোর
                  </button>
                  <button
                    onClick={() => setDeleteTarget(rec)}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-red-50 py-2 text-[11px] font-semibold text-red-600 active:scale-[0.98]"
                  >
                    <Trash2 size={13} /> মুছুন
                  </button>
                </div>
              </div>
            ))}
            {manualSnaps.length > 10 && <p className="text-[10px] text-gray-400">সর্বশেষ {10}টি নিজে নেওয়া স্ন্যাপশট রাখা হয়</p>}
          </div>
        </div>
      </div>

      {toast && (
        <div
          className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-xl px-4 py-2.5 text-xs font-medium shadow-lg max-w-[90vw] ${
            toast.kind === 'ok' ? 'bg-gray-900 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.text}
        </div>
      )}

      {pending && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 space-y-3">
            <div className="flex items-start justify-between">
              <h3 className="text-base font-bold text-gray-800">রিস্টোর করবেন?</h3>
              <button onClick={() => setPending(null)} className="text-gray-400">
                <X size={18} />
              </button>
            </div>
            <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
              <p><b>উৎস:</b> {pending.source}</p>
              <p><b>ব্যাকআপের সময়:</b> {dhakaDateTime(pending.payload.created_at)}</p>
              {pending.payload.organization && <p><b>প্রতিষ্ঠান:</b> {pending.payload.organization}</p>}
              <p><b>মোট রেকর্ড:</b> {totalRows(pending.payload.counts)} টি</p>
              <div className="flex flex-wrap gap-1 pt-1">
                {BACKUP_DATA_TABLES.filter((n) => (pending.payload.counts[n] ?? 0) > 0).map((n) => (
                  <span key={n} className="rounded-full bg-white border border-gray-200 px-2 py-0.5 text-[10px] text-gray-600">
                    {TABLE_LABELS[n]}: {pending.payload.counts[n]}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex gap-2">
              <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-700 leading-relaxed">
                সাবধান! রিস্টোর করলে বর্তমান <b>সব ডেটা মুছে গিয়ে</b> ব্যাকআপের ডেটা বসবে — বিক্রি, ক্রয়, খরচ, বাকি, আইডি সবকিছু। পরে এটি ফেরানো যাবে না।
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setPending(null)} className="rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-700">
                বাতিল
              </button>
              <button
                onClick={handleRestore}
                disabled={restoreBusy}
                className="rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {restoreBusy && <Loader2 size={16} className="animate-spin" />} রিস্টোর করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {restoreDone && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 space-y-3 text-center">
            <CheckCircle2 size={40} className="mx-auto text-green-600" />
            <h3 className="text-base font-bold text-gray-800">রিস্টোর সম্পন্ন!</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              {totalRows(restoreDone)} টি রেকর্ড ফিরে এসেছে। নিরাপত্তার জন্য আবার লগইন করতে হবে।
            </p>
            <button
              onClick={() => {
                logout()
                navigate('/login')
                window.location.reload()
              }}
              className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white"
            >
              লগইন পেজে যান
            </button>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 space-y-3 text-center">
            <Trash2 size={32} className="mx-auto text-red-500" />
            <h3 className="text-base font-bold text-gray-800">স্ন্যাপশট মুছবেন?</h3>
            <p className="text-xs text-gray-500">{dhakaDateTime(deleteTarget.created_at)} — এই স্ন্যাপশট স্থায়ীভাবে মুছে যাবে।</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setDeleteTarget(null)} className="rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-700">
                বাতিল
              </button>
              <button onClick={() => void handleDelete(deleteTarget)} className="rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white">
                মুছে ফেলুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
