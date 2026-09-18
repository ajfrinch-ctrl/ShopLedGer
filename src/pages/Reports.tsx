import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../lib/db'
import { useAuthStore } from '../stores/authStore'
import { useSalesStore } from '../stores/salesStore'
import { toDateKey } from '../lib/profitLoss'
import {
  collectionRecords,
  computeCollectionsReport,
  computeCustomerDues,
  computeSalesReport,
  duesShareText,
  collectionsShareText,
  salesShareText,
  rangeForPreset,
  rangeLabel,
  summariseDues,
  RANGE_PRESETS,
  type RangePreset,
  type ReportKind,
  type ReportMeta,
  type ReportScope,
} from '../lib/report'
import {
  downloadReportPdf,
  pdfFileName,
  printReport,
  shareReportPdf,
  shareReportText,
} from '../lib/reportExport'
import {
  AlertTriangle,
  FileDown,
  Loader2,
  Printer,
  Share2,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'

const nf = (n: number, digits = 0) => n.toLocaleString('bn-BD', { maximumFractionDigits: digits })
const money = (n: number) => `৳ ${nf(n, 2)}`

const TABS: { key: ReportKind; label: string; icon: typeof TrendingUp }[] = [
  { key: 'sales', label: 'বিক্রি', icon: TrendingUp },
  { key: 'collections', label: 'বাকি আদায়', icon: Wallet },
  { key: 'dues', label: 'বাকি তালিকা', icon: Users },
]

const TITLES: Record<ReportKind, string> = {
  sales: 'বিক্রি রিপোর্ট',
  collections: 'বাকি আদায় রিপোর্ট',
  dues: 'ক্রেতার বাকি তালিকা',
}

const PREFIX: Record<ReportKind, string> = {
  sales: 'sales-report',
  collections: 'collection-report',
  dues: 'dues-report',
}

export default function Reports() {
  const user = useAuthStore((s) => s.user)
  const sales = useSalesStore((s) => s.sales)
  const data = useLiveQuery(
    async () => ({
      entries: await db.ledgerEntries.toArray(),
      collections: await db.collections.toArray(),
      customers: await db.customers.toArray(),
      branches: await db.branches.toArray(),
      users: await db.users.toArray(),
    }),
    [],
  )

  const today = toDateKey(new Date())
  const [kind, setKind] = useState<ReportKind>('sales')
  const [preset, setPreset] = useState<RangePreset>('today')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [branchId, setBranchId] = useState('')
  const [busy, setBusy] = useState<'pdf' | 'print' | 'whatsapp' | 'text' | null>(null)
  const [message, setMessage] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const isOwner = user?.role === 'owner'
  // কর্মচারী শুধু নিজের শাখার রিপোর্ট দেখে; শাখা ছাড়া কর্মচারীর অ্যাকাউন্টে কিছুই দেখানো হয় না
  const scope: ReportScope = useMemo(
    () =>
      isOwner
        ? { branchId: branchId || undefined }
        : { branchId: user?.branch_id || '__no_branch__' },
    [isOwner, branchId, user?.branch_id],
  )

  const range = useMemo(
    () => rangeForPreset(preset, new Date(), { from, to }),
    [preset, from, to],
  )

  const report = useMemo(() => {
    if (!data) return null
    const records = collectionRecords(data.entries, data.collections, scope)
    return {
      records,
      sales: computeSalesReport(sales, range, scope),
      collections: computeCollectionsReport(records, range),
      dues: computeCustomerDues(data.customers, sales, data.entries, data.collections, scope),
    }
  }, [data, sales, range, scope])

  const branchName = (id: string) => data?.branches.find((b) => b.id === id)?.name || 'অজানা শাখা'
  const staffName = (id: string) => data?.users.find((u) => u.id === id)?.name || '—'

  if (!user || user.role === 'customer') {
    return <p className="p-6">এই রিপোর্ট শুধু মালিক ও কর্মচারীর জন্য।</p>
  }

  if (!data || !report) {
    return (
      <div className="p-6 flex items-center gap-2 text-gray-500">
        <Loader2 className="animate-spin" size={18} /> রিপোর্ট তৈরি হচ্ছে…
      </div>
    )
  }

  const noBranchStaff = user.role === 'staff' && !user.branch_id
  const shopName = branchId ? branchName(branchId) : isOwner ? 'সব শাখা' : branchName(user.branch_id || '')
  const isDues = kind === 'dues'
  const rangeNote = isDues ? 'বর্তমান অবস্থা (তারিখ নির্বাচন প্রযোজ্য নয়)' : rangeLabel(range)
  const title = TITLES[kind]

  const meta: ReportMeta = {
    title,
    shopName: branchId ? branchName(branchId) : 'ShopLedGer',
    branchName: shopName,
    rangeNote,
  }

  const shareText =
    kind === 'sales'
      ? salesShareText(meta, report.sales)
      : kind === 'collections'
        ? collectionsShareText(meta, report.collections)
        : duesShareText(meta, report.dues, summariseDues(report.dues))

  const fileBase = pdfFileName(PREFIX[kind], isDues ? today : range.from, isDues ? today : range.to)

  async function run(action: 'pdf' | 'print' | 'whatsapp' | 'text') {
    if (!ref.current) return
    setBusy(action)
    setMessage('')
    try {
      if (action === 'pdf') {
        await downloadReportPdf(ref.current, fileBase)
        setMessage('PDF ডাউনলোড হয়েছে।')
      } else if (action === 'print') {
        const ok = printReport(ref.current, title)
        setMessage(ok ? 'প্রিন্ট উইন্ডো খোলা হয়েছে।' : 'প্রিন্ট উইন্ডো খোলা যায়নি — পপ-আপ অনুমতি দিন।')
      } else if (action === 'text') {
        shareReportText(shareText)
        setMessage('WhatsApp খোলা হয়েছে (সারসংক্ষেপ টেক্সট)।')
      } else {
        const result = await shareReportPdf(ref.current, fileBase, shareText)
        setMessage(
          result === 'shared'
            ? 'PDF শেয়ার শিটে পাঠানো হয়েছে।'
            : 'এই ব্রাউজারে ফাইল শেয়ার নেই — PDF ডাউনলোড হয়েছে ও WhatsApp টেক্সট খোলা হয়েছে।',
        )
      }
    } catch {
      setMessage('কাজটি সম্পন্ন হয়নি, আবার চেষ্টা করুন।')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="pb-28">
      <div className="bg-gradient-to-r from-teal-700 to-emerald-700 text-white px-4 pt-4 pb-6">
        <h1 className="text-lg font-bold">রিপোর্ট সেন্টার</h1>
        <p className="text-teal-100 text-xs mt-0.5">
          প্রিভিউ দেখুন → PDF, প্রিন্ট বা WhatsApp-এ পাঠান
        </p>
      </div>

      <div className="px-4 -mt-3 space-y-4">
        {noBranchStaff && (
          <div className="card border-amber-200 bg-amber-50 flex items-start gap-2 text-xs text-amber-900">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <p>আপনার অ্যাকাউন্টে কোনো শাখা নির্ধারিত নেই, তাই রিপোর্ট ফাঁকা দেখাবে। মালিককে জানান।</p>
          </div>
        )}

        {/* রিপোর্ট ধরন */}
        <div className="grid grid-cols-3 gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setKind(t.key)
                setMessage('')
              }}
              className={kind === t.key ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
            >
              <span className="flex items-center justify-center gap-1.5">
                <t.icon size={15} /> {t.label}
              </span>
            </button>
          ))}
        </div>

        {/* ফিল্টার */}
        <div className="card space-y-3" data-no-print>
          {!isDues && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {RANGE_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPreset(p.key)}
                    className={
                      preset === p.key ? 'btn-primary text-xs py-2' : 'btn-secondary text-xs py-2'
                    }
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {preset === 'custom' && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-gray-600">
                    থেকে
                    <input
                      type="date"
                      className="input-field"
                      value={from}
                      max={to}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    পর্যন্ত
                    <input
                      type="date"
                      className="input-field"
                      value={to}
                      min={from}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </label>
                </div>
              )}
            </>
          )}

          {isOwner ? (
            <label className="block text-xs text-gray-600">
              শাখা
              <select className="input-field" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">সব শাখা</option>
                {data.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-xs text-gray-500">
              শাখা: <span className="font-semibold text-gray-700">{shopName}</span> — কর্মচারী
              অ্যাকাউন্ট শুধু নিজের শাখার রিপোর্ট দেখতে পারে।
            </p>
          )}

          {kind === 'dues' && (
            <p className="text-xs text-gray-500">
              এই রিপোর্টে তারিখ নির্বাচন লাগে না — এখন পর্যন্ত জমা থাকা বাকি দেখানো হয়।
            </p>
          )}
        </div>

        {/* প্রিভিউ (যা PDF/প্রিন্ট হবে) */}
        <div ref={ref} className="card bg-white space-y-4">
          <div className="border-b pb-2">
            <h2 className="font-bold text-gray-800">{title}</h2>
            <p className="text-xs text-gray-500">
              {shopName} • {rangeNote}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              ShopLedGer • তৈরি: {new Date().toLocaleString('bn-BD')} • {user.name}
            </p>
          </div>

          {kind === 'sales' && (
            <SalesBody report={report.sales} branchName={branchName} staffName={staffName} showBy={isOwner} />
          )}
          {kind === 'collections' && (
            <CollectionsBody
              report={report.collections}
              branchName={branchName}
              staffName={staffName}
              showBy={isOwner}
            />
          )}
          {kind === 'dues' && (
            <DuesBody rows={report.dues} branchName={branchName} showBy={isOwner} />
          )}

          <div className="border-t pt-2 text-[11px] text-gray-400 flex items-center justify-between">
            <span>ShopLedGer — দোকান হিসাব ব্যবস্থা</span>
            <span>{isOwner ? 'মালিক কপি' : 'কর্মচারী কপি'}</span>
          </div>
        </div>

        {/* অ্যাকশন */}
        <div className="grid grid-cols-3 gap-2" data-no-print>
          <ActionButton label="PDF" icon={<FileDown size={16} />} busy={busy === 'pdf'} disabled={!!busy} onClick={() => run('pdf')} />
          <ActionButton label="প্রিন্ট" icon={<Printer size={16} />} busy={busy === 'print'} disabled={!!busy} onClick={() => run('print')} />
          <ActionButton
            label="WhatsApp"
            icon={<Share2 size={16} />}
            busy={busy === 'whatsapp'}
            disabled={!!busy}
            onClick={() => run('whatsapp')}
            className="bg-green-600 hover:bg-green-700 text-white border-green-600"
          />
        </div>

        <button
          type="button"
          data-no-print
          disabled={!!busy}
          onClick={() => run('text')}
          className="w-full text-xs text-teal-700 underline disabled:opacity-50"
        >
          {busy === 'text' ? 'পাঠানো হচ্ছে…' : 'PDF ছাড়া শুধু সারসংক্ষেপ টেক্সট পাঠান'}
        </button>

        {message && (
          <p className="text-xs text-center text-gray-600 bg-gray-100 rounded-lg p-2" data-no-print>
            {message}
          </p>
        )}

        <p className="text-xs text-center text-gray-500" data-no-print>
          বিস্তারিত লাভ-ক্ষতি ও খরচের হিসাব? <Link to="/profit-loss" className="text-teal-700 underline">লাভ-ক্ষতি রিপোর্ট</Link>
        </p>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   রিপোর্টের মূল অংশ
   ───────────────────────────────────────────── */

function SalesBody({
  report,
  branchName,
  staffName,
  showBy,
}: {
  report: ReturnType<typeof computeSalesReport>
  branchName: (id: string) => string
  staffName: (id: string) => string
  showBy: boolean
}) {
  const products = report.byProduct.slice(0, 15)
  const customers = report.byCustomer.slice(0, 10)
  const bills = report.rows.slice(0, 50)

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Tile label="মোট বিক্রি" value={money(report.revenue)} tone="blue" />
        <Tile label="বিল সংখ্যা" value={`${nf(report.billCount)}টি`} tone="gray" />
        <Tile label="নগদ বিক্রি" value={money(report.cashSales)} tone="green" />
        <Tile label="বাকিতে বিক্রি" value={money(report.dueSales)} tone="orange" />
        <Tile label="গ্রস লাভ" value={money(report.profit)} tone="teal" />
        <Tile label="গড় বিল" value={money(report.averageBill)} tone="gray" />
      </div>

      <Section title="দৈনিক হিসাব">
        <Table
          head={['তারিখ', 'বিল', 'মোট বিক্রি', 'লাভ']}
          rows={report.byDate.map((d) => [d.date, nf(d.bills), money(d.amount), money(d.profit)])}
        />
      </Section>

      <Section title="পণ্যভিত্তিক বিক্রি">
        <Table
          head={['পণ্য', 'পরিমাণ', 'বিক্রি', 'লাভ']}
          rows={products.map((p) => [p.name, `${nf(p.quantity, 2)} ${p.unit}`, money(p.amount), money(p.profit)])}
          note={report.byProduct.length > products.length ? `সেরা ${nf(products.length)}টি পণ্য দেখানো হয়েছে।` : undefined}
        />
      </Section>

      <Section title="ক্রেতাভিত্তিক বিক্রি">
        <Table
          head={['ক্রেতা', 'বিল', 'মোট', 'বাকি']}
          rows={customers.map((c) => [c.name, nf(c.bills), money(c.amount), money(c.due)])}
          note={report.byCustomer.length > customers.length ? `সেরা ${nf(customers.length)}জন ক্রেতা দেখানো হয়েছে।` : undefined}
        />
      </Section>

      {showBy && report.byBranch.length > 1 && (
        <Section title="শাখাভিত্তিক">
          {report.byBranch.map((b) => (
            <KeyRow
              key={b.branchId}
              label={branchName(b.branchId)}
              value={`${nf(b.bills)}টি বিল • ${money(b.amount)} • লাভ ${money(b.profit)}`}
            />
          ))}
        </Section>
      )}

      {showBy && report.byStaff.length > 0 && (
        <Section title="কর্মচারীভিত্তিক">
          {report.byStaff.map((s) => (
            <KeyRow
              key={s.staffId}
              label={staffName(s.staffId)}
              value={`${nf(s.bills)}টি বিল • ${money(s.amount)}`}
            />
          ))}
        </Section>
      )}

      <Section title="বিলের বিবরণ">
        <Table
          head={['তারিখ', 'ক্রেতা', 'ধরন', 'টাকা']}
          rows={bills.map((s) => [
            s.date.slice(0, 10),
            s.customer_name || 'নগদ ক্রেতা',
            s.payment_type,
            money(s.total_amount),
          ])}
          note={report.rows.length > bills.length ? `সর্বশেষ ${nf(bills.length)}টি বিল দেখানো হয়েছে (মোট ${nf(report.billCount)}টি)।` : undefined}
        />
      </Section>
    </>
  )
}

function CollectionsBody({
  report,
  branchName,
  staffName,
  showBy,
}: {
  report: ReturnType<typeof computeCollectionsReport>
  branchName: (id: string) => string
  staffName: (id: string) => string
  showBy: boolean
}) {
  const customers = report.byCustomer.slice(0, 10)
  const rows = report.rows.slice(0, 50)

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Tile label="মোট আদায়" value={money(report.total)} tone="teal" />
        <Tile label="আদায় সংখ্যা" value={`${nf(report.count)}টি`} tone="gray" />
        <Tile label="গড় আদায়" value={money(report.average)} tone="blue" />
        <Tile
          label="সবচেয়ে বড় আদায়"
          value={money(report.largest)}
          sub={report.largestName || undefined}
          tone="green"
        />
      </div>

      <Section title="দৈনিক আদায়">
        <Table
          head={['তারিখ', 'সংখ্যা', 'টাকা']}
          rows={report.byDate.map((d) => [d.date, nf(d.count), money(d.amount)])}
        />
      </Section>

      <Section title="ক্রেতাভিত্তিক আদায়">
        <Table
          head={['ক্রেতা', 'সংখ্যা', 'টাকা']}
          rows={customers.map((c) => [c.name, nf(c.count), money(c.amount)])}
          note={report.byCustomer.length > customers.length ? `সেরা ${nf(customers.length)}জন ক্রেতা দেখানো হয়েছে।` : undefined}
        />
      </Section>

      {report.byMethod.length > 1 && (
        <Section title="পেমেন্ট পদ্ধতি">
          <Table
            head={['পদ্ধতি', 'সংখ্যা', 'টাকা']}
            rows={report.byMethod.map((m) => [m.method, nf(m.count), money(m.amount)])}
          />
        </Section>
      )}

      {showBy && report.byBranch.length > 1 && (
        <Section title="শাখাভিত্তিক">
          {report.byBranch.map((b) => (
            <KeyRow
              key={b.branchId}
              label={branchName(b.branchId)}
              value={`${nf(b.count)}টি • ${money(b.amount)}`}
            />
          ))}
        </Section>
      )}

      {showBy && report.byStaff.length > 0 && (
        <Section title="কর্মচারীভিত্তিক">
          {report.byStaff.map((s) => (
            <KeyRow
              key={s.staffId}
              label={staffName(s.staffId)}
              value={`${nf(s.count)}টি • ${money(s.amount)}`}
            />
          ))}
        </Section>
      )}

      <Section title="আদায়ের বিবরণ">
        <Table
          head={['তারিখ', 'ক্রেতা', 'পদ্ধতি', 'টাকা']}
          rows={rows.map((r) => [r.date, r.customerName, r.method, money(r.amount)])}
          note={report.rows.length > rows.length ? `সর্বশেষ ${nf(rows.length)}টি আদায় দেখানো হয়েছে (মোট ${nf(report.count)}টি)।` : undefined}
        />
      </Section>
    </>
  )
}

function DuesBody({
  rows,
  branchName,
  showBy,
}: {
  rows: ReturnType<typeof computeCustomerDues>
  branchName: (id: string) => string
  showBy: boolean
}) {
  const summary = summariseDues(rows)
  const list = rows.slice(0, 100)
  const byBranch = new Map<string, number>()
  rows.forEach((r) => byBranch.set(r.branchId, (byBranch.get(r.branchId) || 0) + r.due))

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Tile label="মোট বাকি" value={money(summary.total)} tone="orange" />
        <Tile label="বাকিওয়ালা ক্রেতা" value={`${nf(summary.customers)}জন`} tone="gray" />
        <Tile label="গড় বাকি" value={money(summary.average)} tone="blue" />
        <Tile label="সবচেয়ে বেশি" value={money(summary.topAmount)} sub={summary.topName || undefined} tone="red" />
      </div>

      <Section title="ক্রেতার তালিকা">
        <Table
          head={['ক্রেতা', 'ফোন', 'শেষ আদায়', 'বাকি']}
          rows={list.map((r) => [r.name, r.phone || '—', r.lastPaymentDate || '—', money(r.due)])}
          note={rows.length > list.length ? `প্রথম ${nf(list.length)}জন দেখানো হয়েছে (মোট ${nf(rows.length)}জন)।` : undefined}
        />
      </Section>

      {showBy && byBranch.size > 1 && (
        <Section title="শাখাভিত্তিক বাকি">
          {[...byBranch.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([id, amount]) => (
              <KeyRow key={id} label={branchName(id)} value={money(amount)} />
            ))}
        </Section>
      )}
    </>
  )
}

/* ─────────────────────────────────────────────
   ছোট কম্পোনেন্ট
   ───────────────────────────────────────────── */

const TONES: Record<string, string> = {
  blue: 'bg-blue-50 border-blue-100 text-blue-700',
  green: 'bg-green-50 border-green-100 text-green-700',
  teal: 'bg-teal-50 border-teal-100 text-teal-700',
  orange: 'bg-orange-50 border-orange-100 text-orange-700',
  red: 'bg-red-50 border-red-100 text-red-700',
  gray: 'bg-gray-50 border-gray-200 text-gray-700',
}

function Tile({
  label,
  value,
  sub,
  tone = 'gray',
}: {
  label: string
  value: string
  sub?: string
  tone?: keyof typeof TONES
}) {
  return (
    <div className={`rounded-xl border p-3 ${TONES[tone]}`}>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-base font-bold">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 truncate">{sub}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-semibold text-gray-600">{title}</h3>
      {children}
    </div>
  )
}

function Table({ head, rows, note }: { head: string[]; rows: React.ReactNode[][]; note?: string }) {
  if (!rows.length) return <p className="text-xs text-gray-400 py-1">এই রিপোর্টে কোনো তথ্য নেই।</p>
  return (
    <div>
      <div className="overflow-x-auto" data-pdf-expand>
        <table className="w-full text-xs">
          <thead>
            <tr>
              {head.map((h, i) => (
                <th
                  key={h}
                  className={`border-b border-gray-200 py-1.5 px-1 font-semibold text-gray-500 ${
                    i === 0 ? 'text-left' : 'text-right whitespace-nowrap'
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`border-b border-gray-100 py-1.5 px-1 ${
                      ci === 0 ? 'text-left' : 'text-right whitespace-nowrap'
                    } ${ci === 0 ? 'font-medium text-gray-700' : 'text-gray-600'}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && <p className="text-[11px] text-gray-400 pt-1">{note}</p>}
    </div>
  )
}

function KeyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs border-b border-gray-100 py-1.5">
      <span className="font-medium text-gray-700">{label}</span>
      <span className="text-gray-600 text-right">{value}</span>
    </div>
  )
}

function ActionButton({
  label,
  icon,
  onClick,
  busy,
  disabled,
  className = '',
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  busy: boolean
  disabled: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`btn-primary flex items-center justify-center gap-1.5 text-sm disabled:opacity-50 ${className}`}
    >
      {busy ? <Loader2 className="animate-spin" size={16} /> : icon}
      {label}
    </button>
  )
}
