import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, Loader2, TrendingDown, TrendingUp } from 'lucide-react'
import { db } from '../lib/db'
import { useAuthStore } from '../stores/authStore'
import { staffBranchIds } from '../lib/roles'
import { useSalesStore } from '../stores/salesStore'
import { usePurchaseStore } from '../stores/purchaseStore'
import { computeProfitLoss, rangeFor, toDateKey, type PeriodKind } from '../lib/profitLoss'
import { downloadReportPdf, pdfFileName } from '../lib/reportExport'

const bn = (n: number) => `৳ ${n.toLocaleString('bn-BD')}`

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
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const range = useMemo(() => rangeFor(kind, new Date(), { from, to }), [kind, from, to])
  const pl = useMemo(
    () => computeProfitLoss(sales, expenses, purchases, range, branchId || undefined),
    [sales, expenses, purchases, range, branchId],
  )

  const isLoss = pl.netProfit < 0
  const branchName = branches.find((b) => b.id === branchId)?.name || 'সব শাখা'
  const rangeLabel = range.from === range.to ? range.from : `${range.from} থেকে ${range.to}`

  async function downloadPdf() {
    if (!ref.current) return
    setBusy(true)
    try {
      await downloadReportPdf(ref.current, pdfFileName('profit-loss', range.from, range.to))
    } finally {
      setBusy(false)
    }
  }

  // লাভ-ক্ষতি ব্যবসার সংবেদনশীল হিসাব — মালিক ও শাখা ব্যবস্থাপক দেখতে পারবেন
  if (user?.role === 'salesman' || user?.role === 'customer' || !user) {
    return <p className="p-6">লাভ-ক্ষতির হিসাব শুধু মালিক ও শাখা ব্যবস্থাপক দেখতে পারবেন।</p>
  }

  return (
    <div className="pb-24">
      <div className="bg-gradient-to-r from-teal-700 to-emerald-700 text-white px-4 pt-4 pb-6">
        <h1 className="text-lg font-bold">লাভ-ক্ষতি রিপোর্ট</h1>
        <p className="text-teal-100 text-xs mt-0.5">বিক্রি − ক্রয়মূল্য − খরচ = নিট লাভ/ক্ষতি</p>
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
                onClick={() => setKind(k)}
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

        {/* Report body (captured for PDF) */}
        <div ref={ref} className="card bg-white space-y-4 p-4">
          <div className="border-b pb-2">
            <h2 className="font-bold text-gray-800">লাভ-ক্ষতি বিবরণী</h2>
            <p className="text-xs text-gray-500">
              {branchName} • {rangeLabel} • {pl.saleCount.toLocaleString('bn-BD')}টি বিক্রি
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
        </div>

        <button type="button" className="btn-primary w-full flex items-center justify-center gap-2" disabled={busy} onClick={downloadPdf}>
          {busy ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
          PDF ডাউনলোড
        </button>
      </div>
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
