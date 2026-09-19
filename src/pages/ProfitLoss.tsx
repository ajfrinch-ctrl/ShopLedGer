import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { FileSearch, TrendingDown, TrendingUp } from 'lucide-react'
import { db } from '../lib/db'
import { useAuthStore } from '../stores/authStore'
import { staffBranchIds } from '../lib/roles'
import { useSalesStore } from '../stores/salesStore'
import { usePurchaseStore } from '../stores/purchaseStore'
import { computeProfitLoss, rangeFor, toDateKey, type PeriodKind } from '../lib/profitLoss'
import { pdfFileName } from '../lib/reports/pdf'
import { profitLossDocument } from '../lib/reports/profitLossDocument'
import { orgPadOf, padHasDetails } from '../lib/orgPad'
import PadHeader, { PadEmptyHint } from '../components/org/PadHeader'
import ReportPreviewModal from '../components/report/ReportPreviewModal'

const bn = (n: number) => `৳ ${n.toLocaleString('bn-BD')}`

/**
 * লাভ-ক্ষতি রিপোর্ট (মালিক ও শাখা ব্যবস্থাপক)।
 * ফিল্টার → রিপোর্ট তৈরি → **প্রিভিউ পপ-আপ** (প্রতিষ্ঠানের প্যাড সহ) → ডাউনলোড/শেয়ার।
 */
export default function ProfitLoss() {
  const user = useAuthStore((s) => s.user)
  const sales = useSalesStore((s) => s.sales)
  const purchases = usePurchaseStore((s) => s.purchases)
  const expensesQuery = useLiveQuery(() => db.expenses.toArray(), [])
  const expenses = useMemo(() => expensesQuery ?? [], [expensesQuery])
  const branches = useLiveQuery(() => db.branches.toArray(), []) || []

  const today = toDateKey(new Date())
  const [kind, setKind] = useState<PeriodKind>('daily')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const isOwner = user?.role === 'owner'
  const myBranches = staffBranchIds(user)
  const [branchId, setBranchId] = useState<string>(isOwner ? '' : myBranches[0] || '__none__')
  /** প্রিভিউ পপ-আপ — আগে পুরো রিপোর্ট, তারপর দরকার হলে ডাউনলোড/শেয়ার */
  const [preview, setPreview] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const range = useMemo(() => rangeFor(kind, new Date(), { from, to }), [kind, from, to])
  const pl = useMemo(
    () => computeProfitLoss(sales, expenses, purchases, range, branchId || undefined),
    [sales, expenses, purchases, range, branchId],
  )

  const isLoss = pl.netProfit < 0
  const branchName = branches.find((b) => b.id === branchId)?.name || 'সব শাখা'
  const rangeLabel = range.from === range.to ? range.from : `${range.from} থেকে ${range.to}`
  const fileName = pdfFileName('profit-loss', range.from, range.to)
  /** PDF = structured ডেটা থেকে native/vector টেক্সট (প্রিভিউ HTML-ই থাকে) */
  const pdfContent = useMemo(
    () => profitLossDocument(pl, {
      title: 'লাভ-ক্ষতি বিবরণী',
      period: rangeLabel,
      branchName,
      kind: kind === 'monthly' ? 'monthlyProfit' : 'dailyProfit',
      createdBy: user?.name,
    }),
    [pl, rangeLabel, branchName, kind, user?.name],
  )

  /** প্যাড — প্রতিষ্ঠানের লোগো, নাম, ঠিকানা, ফোন (পেজের মাঝখানে দেখানো হয়) */
  const padBranch =
    (branchId ? branches.find((b) => b.id === branchId) : undefined) ||
    (isOwner ? branches[0] : branches.find((b) => myBranches.includes(b.id))) ||
    branches[0]
  const pad = orgPadOf(padBranch)

  const shareText = [
    `📊 *${pad.name}*`,
    `লাভ-ক্ষতি বিবরণী — ${branchName} • ${rangeLabel}`,
    '━━━━━━━━━━━━━━━━',
    `মোট বিক্রি: ৳${pl.revenue.toLocaleString('bn-BD')}`,
    `বিক্রিত পণ্যের ক্রয়মূল্য: ৳${pl.cogs.toLocaleString('bn-BD')}`,
    `মোট খরচ: ৳${pl.expenseTotal.toLocaleString('bn-BD')}`,
    `${isLoss ? 'নিট ক্ষতি' : 'নিট লাভ'}: ৳${Math.abs(pl.netProfit).toLocaleString('bn-BD')}`,
    pad.address ? `📍 ${pad.address}` : '',
    pad.phone ? `📞 ${pad.phone}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  // লাভ-ক্ষতি ব্যবসার সংবেদনশীল হিসাব — মালিক ও শাখা ব্যবস্থাপক দেখতে পারবেন
  if (user?.role === 'salesman' || user?.role === 'customer' || !user) {
    return <p className="p-6">লাভ-ক্ষতির হিসাব শুধু মালিক ও শাখা ব্যবস্থাপক দেখতে পারবেন।</p>
  }

  return (
    <div className="pb-24">
      <div className="bg-gradient-to-r from-teal-700 to-emerald-700 text-white px-4 pt-4 pb-6">
        <h1 className="text-lg font-bold">লাভ-ক্ষতি রিপোর্ট</h1>
        <p className="text-teal-100 text-xs mt-0.5">
          বিক্রি − ক্রয়মূল্য − খরচ = নিট লাভ/ক্ষতি • প্রিভিউ পপ-আপ থেকে PDF/শেয়ার
        </p>
      </div>

      <div className="px-4 -mt-3 space-y-4">
        {/* Filters */}
        <div className="card space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['daily', 'আজ'],
                ['monthly', 'চলতি মাস'],
                ['custom', 'কাস্টম'],
              ] as [PeriodKind, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKind(k)
                  setPreview(false)
                }}
                className={kind === k ? 'btn-primary' : 'btn-secondary'}
              >
                {label}
              </button>
            ))}
          </div>
          {kind === 'custom' && (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-gray-600">
                থেকে
                <input type="date" className="input-field" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="text-xs text-gray-600">
                পর্যন্ত
                <input type="date" className="input-field" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
              </label>
            </div>
          )}
          {/* মালিক: সব শাখা বেছে নিতে পারেন; ব্যবস্থাপক: শুধু নিজের শাখাগুলো থেকে */}
          {isOwner && branches.length > 0 && (
            <label className="block text-xs text-gray-600">
              শাখা
              <select className="input-field" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">সব শাখা</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!isOwner && myBranches.length > 1 && (
            <label className="block text-xs text-gray-600">
              শাখা
              <select className="input-field" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                {myBranches.map((id) => (
                  <option key={id} value={id}>
                    {branches.find((b) => b.id === id)?.name || id}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {/* প্যাড সেট না থাকলে মনে করিয়ে দেওয়া */}
        {!padHasDetails(pad) && <PadEmptyHint />}

        {/* রিপোর্ট প্রস্তুত — পপ-আপে পুরো দেখে তারপর ডাউনলোড/শেয়ার */}
        <div className="card space-y-3">
          <div className="flex items-start gap-2">
            <FileSearch size={18} className="text-teal-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-800">লাভ-ক্ষতি বিবরণী</p>
              <p className="text-[11px] text-gray-500">
                {pad.name}
                {pad.branchName ? ` • ${pad.branchName}` : ''} • {rangeLabel}
              </p>
            </div>
            <span className="text-[10px] px-2 py-1 rounded-full bg-teal-50 text-teal-700 whitespace-nowrap">
              রিপোর্ট প্রস্তুত
            </span>
          </div>

          <div
            className={`rounded-xl p-3 flex items-center justify-between ${
              isLoss ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
            }`}
          >
            <div>
              <p className="text-xs text-gray-600">{isLoss ? 'নিট ক্ষতি' : 'নিট লাভ'}</p>
              <p className={`text-xl font-bold ${isLoss ? 'text-red-700' : 'text-green-700'}`}>
                {bn(Math.abs(pl.netProfit))}
              </p>
            </div>
            {isLoss ? <TrendingDown className="text-red-600" size={26} /> : <TrendingUp className="text-green-600" size={26} />}
          </div>

          <button
            type="button"
            onClick={() => setPreview(true)}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <FileSearch size={16} /> রিপোর্ট দেখুন — প্রিভিউ, তারপর ডাউনলোড/শেয়ার
          </button>

          <p className="text-[11px] text-gray-500 text-center">
            পপ-আপে প্রতিষ্ঠানের প্যাড (লোগো, নাম, ঠিকানা, ফোন) সহ সম্পূর্ণ হিসাব দেখে তারপর দরকার হলে
            ডাউনলোড বা শেয়ার করবেন — অকারণে ডাউনলোড হবে না।
          </p>
        </div>
      </div>

      {/* প্রিভিউ পপ-আপ — এখান থেকেই ডাউনলোড বা শেয়ার (PDF এই বডি থেকেই তৈরি) */}
      {preview && (
        <ReportPreviewModal
          title="লাভ-ক্ষতি বিবরণী — প্রিভিউ"
          filename={fileName}
          document={pdfContent.document}
          pad={pad}
          businessName={pad.name}
          subtitle={`${branchName} • ${rangeLabel}`}
          signatureLabel="মালিকের স্বাক্ষর"
          shareText={shareText}
          captureRef={ref}
          onClose={() => setPreview(false)}
        >
          {/* শেয়ারে ক্যাপচারের সময়ই ৭১৮px (A4) চওড়া হয় — ছবি ঝকঝকে হয় */}
          <div ref={ref} data-pdf-width="718" className="bg-white rounded-xl p-4 space-y-4">
            <PadHeader pad={pad} size="sheet" subtitle={`${branchName} • ${rangeLabel}`} />

            <div className="text-center border-b pb-2">
              <h2 className="font-bold text-gray-800 text-lg">লাভ-ক্ষতি বিবরণী</h2>
              <p className="text-xs text-gray-500">
                {pl.saleCount.toLocaleString('bn-BD')}টি বিক্রি • তৈরি: {new Date().toLocaleString('bn-BD')} •{' '}
                {user.name}
              </p>
            </div>

            <div
              className={`rounded-xl p-4 flex items-center justify-between ${
                isLoss ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
              }`}
            >
              <div>
                <p className="text-xs text-gray-600">{isLoss ? 'নিট ক্ষতি' : 'নিট লাভ'}</p>
                <p className={`text-2xl font-bold ${isLoss ? 'text-red-700' : 'text-green-700'}`}>
                  {bn(Math.abs(pl.netProfit))}
                </p>
              </div>
              {isLoss ? <TrendingDown className="text-red-600" size={32} /> : <TrendingUp className="text-green-600" size={32} />}
            </div>

            <div className="space-y-2">
              <Row label="মোট বিক্রি" value={pl.revenue} color="text-blue-700" />
              <Row label="  নগদ বিক্রি" value={pl.cashSales} muted />
              <Row label="  বাকিতে বিক্রি" value={pl.dueSales} muted />
              <Row label="(−) বিক্রিত পণ্যের ক্রয়মূল্য" value={pl.cogs} color="text-purple-700" />
              <div className="border-t pt-2">
                <Row label="গ্রস লাভ" value={pl.grossProfit} color={pl.grossProfit < 0 ? 'text-red-700' : 'text-green-700'} bold />
              </div>
              <Row label="(−) মোট খরচ" value={pl.expenseTotal} color="text-orange-700" />
              {pl.expensesByCategory.map((c) => (
                <Row key={c.category} label={`  ${c.category}`} value={c.amount} muted />
              ))}
              <div className="border-t pt-2">
                <Row
                  label={isLoss ? 'নিট ক্ষতি' : 'নিট লাভ'}
                  value={pl.netProfit}
                  color={isLoss ? 'text-red-700' : 'text-teal-700'}
                  bold
                />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
              <p>
                এই সময়ে পণ্য ক্রয়: <span className="font-semibold text-gray-800">{bn(pl.purchaseTotal)}</span>
              </p>
              {pl.ownerDrawings > 0 && (
                <p>
                  মালিকের ব্যক্তিগত টাকা তোলা: <span className="font-semibold text-gray-800">{bn(pl.ownerDrawings)}</span>{' '}
                  <span className="text-gray-400">(লাভ থেকে বাদ যায়নি)</span>
                </p>
              )}
              <p className="text-gray-500">
                পণ্য ক্রয় স্টকে যোগ হয়; এটি লাভ থেকে বাদ যায় না। বিক্রির সময় প্রতিটি পণ্যের ক্রয়মূল্য ধরেই গ্রস লাভ হিসাব করা হয়।
              </p>
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

function Row({
  label,
  value,
  color = 'text-gray-800',
  bold,
  muted,
}: {
  label: string
  value: number
  color?: string
  bold?: boolean
  muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between whitespace-pre">
      <span className={`text-sm ${bold ? 'font-semibold text-gray-800' : muted ? 'text-gray-400 text-xs' : 'text-gray-600'}`}>{label}</span>
      <span className={`text-sm font-semibold ${muted ? 'text-gray-400 text-xs font-normal' : color}`}>{bn(value)}</span>
    </div>
  )
}
