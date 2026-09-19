import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type DbCustomer } from '../lib/db'
import { ledgerToday } from '../lib/ledger'
import { useAuthStore } from '../stores/authStore'
import { useSalesStore } from '../stores/salesStore'
import { linkCustomerForUser } from '../lib/customerLink'
import { buildCustomerPurchaseStatement, type CustomerStatementRange } from '../lib/customerStatement'
import { bnDate, bnMoney } from '../lib/reports/core'
import { orgPadOf } from '../lib/orgPad'
import { sheetFileName } from '../lib/reports/pdf'
import ReportPreview from '../components/report/ReportPreview'
import ReportPreviewModal from '../components/report/ReportPreviewModal'
import ReportSheet from '../components/report/ReportSheet'
import { CalendarRange, FileSearch, FileText, Loader2, ReceiptText, ShoppingBag } from 'lucide-react'

/**
 * Customer-only, read-only purchase history and account statement.
 * There are deliberately no share, WhatsApp, or customer-message actions here:
 * the available flow is filter → generate → preview → download PDF.
 */
export default function MyDues() {
  const user = useAuthStore((s) => s.user)!
  const sales = useSalesStore((s) => s.sales)
  const [me, setMe] = useState<DbCustomer | null>(null)
  const [linkError, setLinkError] = useState(false)
  const [draftFrom, setDraftFrom] = useState('')
  const [draftTo, setDraftTo] = useState(ledgerToday())
  const [range, setRange] = useState<CustomerStatementRange>({ from: '', to: ledgerToday() })
  const [rangeError, setRangeError] = useState('')
  const [preview, setPreview] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  const data = useLiveQuery(
    async () => ({
      entries: await db.ledgerEntries.toArray(),
      collections: await db.collections.toArray(),
      branches: await db.branches.toArray(),
    }),
    [],
  )

  useEffect(() => {
    let active = true
    // Reuse the existing phone-to-customer identity linking. Nothing else is queried
    // until the link is known, so a customer never sees another customer's history.
    linkCustomerForUser(user)
      .then((customer) => { if (active) setMe(customer) })
      .catch(() => { if (active) setLinkError(true) })
    return () => { active = false }
  }, [user])

  const statement = useMemo(
    () => me
      ? buildCustomerPurchaseStatement(me, sales, data?.entries || [], data?.collections || [], range)
      : null,
    [me, sales, data, range],
  )

  const branch = useMemo(
    () => data?.branches.find((item) => item.id === (me?.branch_id || user.branch_id)),
    [data, me?.branch_id, user.branch_id],
  )
  const pad = orgPadOf(branch)

  function selectedRange(): CustomerStatementRange | null {
    const today = ledgerToday()
    const from = draftFrom.trim()
    const to = (draftTo.trim() || today) > today ? today : (draftTo.trim() || today)
    if (from && from > to) {
      setRangeError('শুরুর তারিখ শেষ তারিখের পরে হতে পারে না।')
      return null
    }
    setRangeError('')
    return { from, to }
  }

  function viewHistory() {
    const nextRange = selectedRange()
    if (nextRange) setRange(nextRange)
  }

  function showPreview() {
    const nextRange = selectedRange()
    if (!nextRange) return
    setRange(nextRange)
    setPreview(true)
  }

  function allHistory() {
    const to = ledgerToday()
    setDraftFrom('')
    setDraftTo(to)
    setRange({ from: '', to })
    setRangeError('')
  }

  if (linkError) {
    return <p role="alert" className="p-4 text-sm text-red-700">আপনার হিসাব লোড হয়নি। আবার পেজটি খুলুন।</p>
  }

  if (!me || !data || !statement) {
    return <div className="p-6 text-sm text-gray-500 flex items-center gap-2"><Loader2 className="animate-spin" size={17} /> আপনার হিসাব লোড হচ্ছে…</div>
  }

  const rangeText = statement.range.from
    ? `${bnDate(statement.range.from)} — ${bnDate(statement.range.to)}`
    : `শুরু থেকে ${bnDate(statement.range.to)}`

  return (
    <div className="customer-statement-ui max-w-4xl mx-auto px-4 pt-4 pb-28 space-y-4" data-customer-statement>
      <section className="space-y-1" aria-labelledby="statement-heading">
        <div className="flex items-center gap-2 text-teal-700">
          <ReceiptText size={20} aria-hidden="true" />
          <h1 id="statement-heading" className="text-lg font-bold text-gray-900">ক্রয় হিস্ট্রি / Statement</h1>
        </div>
        <p className="text-xs text-gray-500">নিজের কেনাকাটা ও হিসাবের বিবরণী দেখুন।</p>
      </section>

      <section className="card !p-0 overflow-hidden" aria-labelledby="customer-information-heading">
        <h2 id="customer-information-heading" className="px-4 py-3 text-sm font-semibold text-gray-800 bg-gray-50 border-b">Customer Information</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x">
          <InfoItem label="Customer Name" value={me.name} />
          <InfoItem label="Mobile Number" value={me.phone || 'নেই'} />
          <InfoItem label="Customer ID" value={me.id} />
        </dl>
      </section>

      <section className="card space-y-3" aria-labelledby="date-filter-heading">
        <div className="flex items-center gap-2">
          <CalendarRange size={18} className="text-teal-700" aria-hidden="true" />
          <h2 id="date-filter-heading" className="text-sm font-semibold text-gray-800">Date Filter</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block min-w-0 text-xs font-medium text-gray-600">
            From Date
            <input
              aria-label="From Date"
              type="date"
              value={draftFrom}
              max={draftTo || ledgerToday()}
              onChange={(event) => setDraftFrom(event.target.value)}
              className="input-field mt-1 text-sm"
            />
          </label>
          <label className="block min-w-0 text-xs font-medium text-gray-600">
            To Date
            <input
              aria-label="To Date"
              type="date"
              value={draftTo}
              max={ledgerToday()}
              onChange={(event) => setDraftTo(event.target.value)}
              className="input-field mt-1 text-sm"
            />
          </label>
        </div>
        {rangeError && <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">{rangeError}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={viewHistory} className="btn-primary flex items-center justify-center gap-2 text-sm">
            <FileSearch size={16} /> দেখুন
          </button>
          <button type="button" onClick={allHistory} className="btn-secondary flex items-center justify-center gap-2 text-sm">
            <CalendarRange size={16} /> All History
          </button>
        </div>
        <p className="text-[11px] text-gray-500">ফিল্টার শুধু দেখার জন্য; মূল হিসাব বা পুরোনো লেনদেন পরিবর্তন হবে না।</p>
      </section>

      <section aria-labelledby="summary-heading" className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-1">
          <h2 id="summary-heading" className="text-sm font-semibold text-gray-800">Summary</h2>
          <p className="text-[11px] text-gray-500">{rangeText}</p>
        </div>
        <div className="grid grid-cols-1 min-[380px]:grid-cols-3 gap-2">
          <SummaryCard label="মোট ক্রয়" value={statement.totalPurchase} tone="blue" />
          <SummaryCard label="মোট পরিশোধ" value={statement.totalPaid} tone="teal" />
          <SummaryCard label="মোট বাকি" value={statement.totalDue} tone={statement.totalDue > 0 ? 'orange' : 'green'} />
        </div>
      </section>

      <section aria-labelledby="purchase-history-heading" className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 id="purchase-history-heading" className="text-sm font-semibold text-gray-800">Purchase History</h2>
          <span className="text-xs text-gray-500">{statement.rows.length.toLocaleString('bn-BD')}টি লেনদেন</span>
        </div>
        {statement.rows.length === 0 ? (
          <div className="card text-center py-8 text-sm text-gray-500">
            <ShoppingBag size={30} className="mx-auto mb-2 text-gray-300" />
            নির্বাচিত সময়ে কোনো লেনদেন নেই।
          </div>
        ) : (
          <div className="space-y-2" data-purchase-history>
            {statement.rows.map((row) => <HistoryCard key={row.key} row={row} />)}
          </div>
        )}
      </section>

      <section className="card bg-teal-50 border-teal-100 space-y-2" aria-labelledby="generate-statement-heading">
        <div className="flex items-start gap-3">
          <span className="p-2 bg-white rounded-lg text-teal-700 shrink-0"><FileText size={20} /></span>
          <div className="min-w-0">
            <h2 id="generate-statement-heading" className="text-sm font-semibold text-gray-900">Statement Generate</h2>
            <p className="text-xs text-gray-600 mt-0.5">আগে প্রিভিউ দেখুন, তারপর শুধু PDF Download করুন।</p>
          </div>
        </div>
        <button type="button" onClick={showPreview} className="btn-primary w-full flex items-center justify-center gap-2">
          <FileSearch size={17} /> Statement Generate
        </button>
      </section>

      {/* The A4 sheet is created only after Generate. It contains only this linked
          customer's data and is used exclusively by the preview's PDF download. */}
      {preview && <>
        <div aria-hidden data-sheet style={{ position: 'fixed', top: 0, left: 0, zIndex: -1, pointerEvents: 'none' }}>
          <ReportSheet doc={statement.document} businessName={pad.name} subtitle={branch?.name} pad={pad} sheetRef={sheetRef} />
        </div>
        <ReportPreviewModal
          title="Statement Preview"
          filename={sheetFileName('customer-statement', `${me.id}-${statement.range.from || 'all'}-${statement.range.to}`)}
          captureRef={sheetRef}
          onClose={() => setPreview(false)}
          allowShare={false}
          hint="প্রিভিউতে পুরো Statement দেখে PDF Download করুন।"
        >
          <ReportPreview doc={statement.document} businessName={pad.name} subtitle={branch?.name} pad={pad} />
        </ReportPreviewModal>
      </>}
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 px-4 py-3">
    <dt className="text-[11px] text-gray-500">{label}</dt>
    <dd className="mt-0.5 text-sm font-semibold text-gray-800 break-words">{value}</dd>
  </div>
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'teal' | 'orange' | 'green' }) {
  const colors = {
    blue: 'bg-blue-50 border-blue-100 text-blue-800',
    teal: 'bg-teal-50 border-teal-100 text-teal-800',
    orange: 'bg-orange-50 border-orange-100 text-orange-800',
    green: 'bg-emerald-50 border-emerald-100 text-emerald-800',
  }
  return <div className={`rounded-xl border p-3 min-w-0 ${colors[tone]}`}>
    <p className="text-[11px] text-gray-600">{label}</p>
    <p className="mt-1 text-base font-bold break-words">{bnMoney(value)}</p>
  </div>
}

function HistoryCard({ row }: { row: ReturnType<typeof buildCustomerPurchaseStatement>['rows'][number] }) {
  return <article className="card !p-3 space-y-2" data-history-row>
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-gray-500 shrink-0">তারিখ: {bnDate(row.date)}</span>
      <span className="text-right text-gray-500 break-all">Receipt No. {row.receiptNo}</span>
    </div>
    <p className="text-sm text-gray-800 break-words">পণ্যের বিবরণ: <span className="font-medium">{row.productDescription}</span></p>
    <dl className="grid grid-cols-3 gap-2 border-t pt-2">
      <Amount label="মোট ক্রয়" value={row.totalPurchase} tone="text-blue-700" />
      <Amount label="পরিশোধ" value={row.paid} tone="text-teal-700" />
      <Amount label="বাকি" value={row.due} tone={row.due > 0 ? 'text-orange-700' : 'text-emerald-700'} />
    </dl>
  </article>
}

function Amount({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="min-w-0">
    <dt className="text-[10px] text-gray-500">{label}</dt>
    <dd className={`mt-0.5 text-xs font-bold break-words ${tone}`}>{bnMoney(value)}</dd>
  </div>
}
