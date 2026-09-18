import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { useAuthStore } from '../../stores/authStore'
import { roleLabel, staffBranchIds } from '../../lib/roles'
import { useSalesStore } from '../../stores/salesStore'
import { toDateKey } from '../../lib/profitLoss'
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
  type SummaryTab,
  type ReportMeta,
  type ReportScope,
} from '../../lib/report'
import { pdfFileName } from '../../lib/reportExport'
import { orgPadOf } from '../../lib/orgPad'
import PadHeader from '../org/PadHeader'
import ReportPreviewModal from './ReportPreviewModal'
import {
  AlertTriangle,
  FileSearch,
  Loader2,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'

const nf = (n: number, digits = 0) => n.toLocaleString('bn-BD', { maximumFractionDigits: digits })
const money = (n: number) => `৳ ${nf(n, 2)}`

const TABS: { key: SummaryTab; label: string; icon: typeof TrendingUp }[] = [
  { key: 'sales', label: 'বিক্রি', icon: TrendingUp },
  { key: 'collections', label: 'বাকি আদায়', icon: Wallet },
  { key: 'dues', label: 'বাকি তালিকা', icon: Users },
]

const TITLES: Record<SummaryTab, string> = {
  sales: 'বিক্রি রিপোর্ট',
  collections: 'বাকি আদায় রিপোর্ট',
  dues: 'ক্রেতার বাকি তালিকা',
}

const PREFIX: Record<SummaryTab, string> = {
  sales: 'sales-report',
  collections: 'collection-report',
  dues: 'dues-report',
}

export default function QuickSummary() {
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
  const [kind, setKind] = useState<SummaryTab>('sales')
  const [preset, setPreset] = useState<RangePreset>('today')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [branchId, setBranchId] = useState('')
  /** প্রিভিউ পপ-আপ — আগে পুরো রিপোর্ট দেখুন, তারপর ডাউনলোড/শেয়ার */
  const [preview, setPreview] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const isOwner = user?.role === 'owner'
  // কর্মচারী শুধু নিজের শাখার রিপোর্ট দেখে; শাখা ছাড়া কর্মচারীর অ্যাকাউন্টে কিছুই দেখানো হয় না
  const myBranches = staffBranchIds(user)
  const scope: ReportScope = useMemo(
    () =>
      isOwner
        ? { branchId: branchId || undefined }
        : { branchIds: myBranches.length ? myBranches : ['__no_branch__'] },
    [isOwner, branchId, myBranches],
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

  const noBranchStaff = user.role !== 'owner' && !myBranches.length
  const shopName = branchId ? branchName(branchId) : isOwner ? 'সব শাখা' : myBranches.length ? branchName(myBranches[0]) : 'ShopLedGer'
  const isDues = kind === 'dues'
  const rangeNote = isDues ? 'বর্তমান অবস্থা (তারিখ নির্বাচন প্রযোজ্য নয়)' : rangeLabel(range)
  const title = TITLES[kind]
  const duesSummary = summariseDues(report.dues)

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
        : duesShareText(meta, report.dues, duesSummary)

  const fileBase = pdfFileName(PREFIX[kind], isDues ? today : range.from, isDues ? today : range.to)

  /** প্যাড — প্রতিষ্ঠানের নাম, লোগো, ঠিকানা, ফোন (পেজের মাঝখানে দেখানো হয়) */
  const padBranch =
    (branchId ? data?.branches.find((b) => b.id === branchId) : undefined) ||
    myBranches.map((id) => data?.branches.find((b) => b.id === id)).find(Boolean) ||
    data?.branches[0]
  const pad = orgPadOf(padBranch)

  /** পপ-আপে যাওয়ার আগে কাজের সংখ্যাগুলো এক নজরে */
  const headline = isDues
    ? [
        { label: 'মোট বাকি', value: money(duesSummary.total) },
        { label: 'বাকিওয়ালা ক্রেতা', value: `${nf(duesSummary.customers)} জন` },
        { label: 'গড় বাকি', value: money(duesSummary.average) },
      ]
    : kind === 'sales'
      ? [
          { label: 'মোট বিক্রি', value: money(report.sales.revenue) },
          { label: 'বিল', value: `${nf(report.sales.billCount)}টি` },
          { label: 'গড় বিল', value: money(report.sales.averageBill) },
        ]
      : [
          { label: 'মোট আদায়', value: money(report.collections.total) },
          { label: 'এন্ট্রি', value: `${nf(report.collections.count)}টি` },
          { label: 'সর্বোচ্চ আদায়', value: money(report.collections.largest) },
        ]

  return (
    <div className="space-y-4">
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
                setPreview(false)
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

        {/* রিপোর্ট প্রস্তুত — পপ-আপে সম্পূর্ণ দেখে তারপর ডাউনলোড/শেয়ার */}
        <div className="card space-y-3">
          <div className="flex items-start gap-2">
            <FileSearch size={18} className="text-teal-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-800">{title}</p>
              <p className="text-[11px] text-gray-500">
                {pad.name}
                {shopName && shopName !== pad.name ? ` • ${shopName}` : ''} • {rangeNote}
              </p>
            </div>
            <span className="text-[10px] px-2 py-1 rounded-full bg-teal-50 text-teal-700 whitespace-nowrap">
              রিপোর্ট প্রস্তুত
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {headline.map((h) => (
              <div key={h.label} className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                <p className="text-[10px] text-gray-500">{h.label}</p>
                <p className="text-xs font-bold text-gray-800 break-words">{h.value}</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setPreview(true)}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <FileSearch size={16} /> রিপোর্ট দেখুন — প্রিভিউ, তারপর ডাউনলোড/শেয়ার
          </button>

          <p className="text-[11px] text-gray-500 text-center">
            পপ-আপে প্রতিষ্ঠানের প্যাড (লোগো, নাম, ঠিকানা, ফোন) সহ সম্পূর্ণ রিপোর্ট দেখে তারপর দরকার হলে
            ডাউনলোড বা শেয়ার করবেন — অকারণে ডাউনলোড হবে না।
          </p>
        </div>

        <p className="text-xs text-center text-gray-500" data-no-print>
          বিস্তারিত লাভ-ক্ষতি ও খরচের হিসাব? <Link to="/profit-loss" className="text-teal-700 underline">লাভ-ক্ষতি রিপোর্ট</Link>
        </p>

      {/* প্রিভিউ পপ-আপ — এখান থেকেই ডাউনলোড বা শেয়ার (PDF এই বডি থেকেই তৈরি) */}
      {preview && (
        <ReportPreviewModal
          title={`${title} — প্রিভিউ`}
          filename={fileBase}
          shareText={shareText}
          captureRef={ref}
          onClose={() => setPreview(false)}
        >
          {/* ক্যাপচারের সময়ই ৭১৮px (A4) চওড়া হয় — মোবাইলেও ঝকঝকে PDF */}
          <div ref={ref} data-pdf-width="718" className="bg-white rounded-xl p-4 space-y-4">
            <PadHeader pad={pad} size="sheet" subtitle={`${shopName} • ${rangeNote}`} />

            <div className="text-center">
              <h2 className="font-bold text-gray-800 text-lg">{title}</h2>
              <p className="text-[11px] text-gray-500">
                তৈরি: {new Date().toLocaleString('bn-BD')} • {user.name}
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
            {kind === 'dues' && <DuesBody rows={report.dues} branchName={branchName} showBy={isOwner} />}

            <div className="border-t pt-2 text-[11px] text-gray-400 flex items-center justify-between">
              <span>{pad.name} — {pad.address || 'ঠিকানা দেওয়া হয়নি'}</span>
              <span>{isOwner ? 'মালিক কপি' : `${roleLabel(user.role)} কপি`}</span>
            </div>

            <div className="flex justify-end pt-4">
              <div className="w-56 text-center">
                <div className="border-t border-gray-800 pt-1 text-[11px] font-semibold text-gray-800">
                  মালিকের স্বাক্ষর
                </div>
              </div>
            </div>
          </div>
        </ReportPreviewModal>
      )}
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
