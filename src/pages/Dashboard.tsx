import { useLiveQuery } from 'dexie-react-hooks'
import { db, type DbCustomer } from '../lib/db'
import { dailyDebtActivity, debtAccounts } from '../lib/dues'
import { ledgerRows, ledgerToday, money } from '../lib/ledger'
import { linkCustomerForUser } from '../lib/customerLink'
import { useMemo, useState, useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useSalesStore } from '../stores/salesStore'
import { usePurchaseStore } from '../stores/purchaseStore'
import { useProductStore } from '../stores/productStore'
import { useStockAdjustmentStore } from '../stores/stockAdjustmentStore'
import { computeStock } from '../lib/stock'
import { computeProfitLoss, toDateKey } from '../lib/profitLoss'
import { canEntryPurchaseExpense, canSeeProfit, inUserBranch } from '../lib/roles'
import { bnDate } from '../lib/reports/core'
import { recentDashboardActivity } from '../components/dashboard/activity'
import {
  ShoppingCart,
  Wallet,
  Receipt,
  TrendingUp,
  Package,
  ArrowRight,
  CalendarDays,
  History,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  ShoppingBag,
  Plus,
  BarChart3,
  Sparkles,
} from 'lucide-react'

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  if (!user) return null
  return user.role === 'customer' ? <CustomerDashboard key={user.id} /> : <OwnerStaffDashboard />
}

function OwnerStaffDashboard() {
  const user = useAuthStore((s) => s.user)
  const showProfit = canSeeProfit(user?.role)
  const showPurchasesExpenses = canEntryPurchaseExpense(user?.role)
  const sales = useSalesStore((s) => s.sales)
  const purchases = usePurchaseStore((s) => s.purchases)
  const products = useProductStore((s) => s.products)
  const adjustments = useStockAdjustmentStore((s) => s.adjustments)
  const ledger = useLiveQuery(async () => ({
    entries: await db.ledgerEntries.toArray(),
    collections: await db.collections.toArray(),
  }))
  const expensesQuery = useLiveQuery(() => db.expenses.toArray(), [])
  const expenses = useMemo(() => expensesQuery ?? [], [expensesQuery])
  const today = ledgerToday()

  const stats = useMemo(() => {
    const now = new Date()
    const monthStart = toDateKey(new Date(now.getFullYear(), now.getMonth(), 1))
    const mine = <T extends { branch_id?: string }>(rows: T[]) =>
      rows.filter((r) => inUserBranch(user, r.branch_id))
    const mySales = mine(sales)
    const myPurchases = mine(purchases)
    const myExpenses = mine(expenses)
    const daily = computeProfitLoss(mySales, myExpenses, myPurchases, { from: today, to: today })
    const monthly = computeProfitLoss(mySales, myExpenses, myPurchases, { from: monthStart, to: today })
    const debtData = {
      sales: mySales,
      purchases: myPurchases,
      entries: mine(ledger?.entries || []),
      collections: mine(ledger?.collections || []),
      customers: [],
    }
    const activity = dailyDebtActivity(debtData, today)
    const totalDues = debtAccounts('customer', debtData, { through: today }).reduce(
      (sum, a) => sum + Math.max(0, a.balance),
      0
    )
    const supplierDues = debtAccounts('supplier', debtData, { through: today }).reduce(
      (sum, a) => sum + Math.max(0, a.balance),
      0
    )
    const stockRows = computeStock(mine(products), myPurchases, mySales, mine(adjustments))
    return {
      daily,
      monthly,
      todayCollected: activity.collected,
      totalDues,
      supplierDues,
      stockValue: stockRows.reduce((sum, r) => sum + r.stockValue, 0),
      lowStockCount: stockRows.filter((r) => r.isLow).length,
    }
  }, [sales, purchases, products, ledger, expenses, adjustments, user, today])

  const recent = useMemo(
    () =>
      recentDashboardActivity(
        { sales, purchases, expenses, entries: ledger?.entries || [], collections: ledger?.collections || [] },
        user,
        today
      ),
    [sales, purchases, expenses, ledger, user, today]
  )
  const loaded = !!ledger && !!expensesQuery

  const todayBangla = new Date().toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  if (!loaded) {
    return (
      <div className="px-4 pt-6 pb-28 space-y-4">
        <div className="bg-white rounded-[20px] p-5 animate-pulse">
          <div className="h-5 bg-gray-100 rounded-full w-1/3 mb-5"></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="h-24 bg-gray-50 rounded-[16px]"></div>
            <div className="h-24 bg-gray-50 rounded-[16px]"></div>
            <div className="h-24 bg-gray-50 rounded-[16px]"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-4 pb-28 space-y-5">
      {/* Main Summary Card - Spec Exact */}
      <div className="bg-white rounded-[20px] border border-gray-100/80 shadow-[0_8px_32px_rgba(4,121,90,0.08),0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Card Header */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-[8px] bg-[#e6f5ee] flex items-center justify-center">
                <BarChart3 size={14} className="text-[#04795a]" />
              </div>
              <h2 className="text-[14px] font-bold text-gray-900 tracking-tight">আজকের হিসাব</h2>
            </div>
            <span className="text-[11px] font-medium text-gray-500 bg-[#f8faf9] border border-gray-100 px-2.5 py-1 rounded-full">
              {todayBangla}
            </span>
          </div>

          {/* 3-Column Stat Grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <PastelStatBox
              label="বিক্রি"
              value={money(stats.daily.revenue)}
              rawValue={stats.daily.revenue}
              tint="bg-[#fff7ed]"
              border="border-[#ffedd5]/60"
              gradient="from-[#fb923c] to-[#f97316]"
              icon={<ShoppingCart size={18} strokeWidth={2} />}
              sub={`${stats.daily.saleCount.toLocaleString('bn-BD')}টি`}
            />
            <PastelStatBox
              label="আদায়"
              value={money(stats.todayCollected)}
              rawValue={stats.todayCollected}
              tint="bg-[#f0fdf4]"
              border="border-[#dcfce7]/80"
              gradient="from-[#34d399] to-[#04795a]"
              icon={<Wallet size={18} strokeWidth={2} />}
              sub="বাকি আদায়"
            />
            <PastelStatBox
              label={showPurchasesExpenses ? 'খরচ' : 'বাকি'}
              value={money(showPurchasesExpenses ? stats.daily.expenseTotal : stats.totalDues)}
              rawValue={showPurchasesExpenses ? stats.daily.expenseTotal : stats.totalDues}
              tint="bg-[#eff6ff]"
              border="border-[#dbeafe]/70"
              gradient="from-[#60a5fa] to-[#3b82f6]"
              icon={
                showPurchasesExpenses ? <Receipt size={18} strokeWidth={2} /> : <ArrowDownLeft size={18} strokeWidth={2} />
              }
              sub={showPurchasesExpenses ? 'দোকান খরচ' : 'পাওনা'}
            />
          </div>
        </div>

        {/* Full-width Highlight Banner */}
        <div className="bg-gradient-to-r from-[#e6f5ee] via-[#eefaf6] to-[#f0fdf4] border-t border-[#d1ebe2]/50 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] bg-white shadow-sm border border-[#d1ebe2]/50 flex items-center justify-center">
              {showProfit ? (
                <TrendingUp size={16} className="text-[#04795a]" />
              ) : (
                <Package size={16} className="text-[#04795a]" />
              )}
            </div>
            <div>
              <p className="text-[11px] font-medium text-[#04795a]/80 leading-none">
                {showProfit ? 'আজকের নিট লাভ' : 'মোট স্টক মূল্য'}
              </p>
              <p className="text-[11px] text-[#065f46]/60 mt-0.5">
                {showProfit ? (stats.daily.netProfit < 0 ? 'ক্ষতি হিসাব' : 'খরচ বাদে') : `${stats.lowStockCount ? `${stats.lowStockCount}টি কম` : 'সব ঠিক আছে'}`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-[15px] font-bold tracking-tight ${showProfit && stats.daily.netProfit < 0 ? 'text-red-600' : 'text-[#04795a]'}`}>
              {showProfit ? money(stats.daily.netProfit) : money(stats.stockValue)}
            </p>
            <p className="text-[10px] font-medium text-[#04795a]/60 flex items-center justify-end gap-1 mt-0.5">
              <Sparkles size={10} /> আপডেটেড
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions - Spec Exact */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-[13px] font-bold text-gray-900 tracking-tight">দ্রুত কাজ</h3>
          <span className="text-[11px] font-medium text-gray-500 bg-white border border-gray-100 px-2.5 py-1 rounded-full shadow-sm">
            ৪টি অপশন
          </span>
        </div>

        <div className="bg-white rounded-[20px] border border-gray-100/80 shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-4">
          <div className="grid grid-cols-4 gap-3">
            <QuickActionButton
              to="/sales"
              label="নতুন বিক্রি"
              gradient="from-[#34d399] to-[#04795a]"
              shadow="shadow-[0_6px_16px_rgba(4,121,90,0.25)]"
              icon={<Plus size={22} strokeWidth={2.5} />}
            />
            <QuickActionButton
              to="/collections?type=customer"
              label="বাকি আদায়"
              gradient="from-[#fb923c] to-[#f97316]"
              shadow="shadow-[0_6px_16px_rgba(249,115,22,0.25)]"
              icon={<Wallet size={20} strokeWidth={2} />}
            />
            {showPurchasesExpenses ? (
              <>
                <QuickActionButton
                  to="/purchases"
                  label="ক্রয়"
                  gradient="from-[#60a5fa] to-[#3b82f6]"
                  shadow="shadow-[0_6px_16px_rgba(59,130,246,0.25)]"
                  icon={<ShoppingBag size={20} strokeWidth={2} />}
                />
                <QuickActionButton
                  to="/expenses"
                  label="খরচ"
                  gradient="from-[#a78bfa] to-[#8b5cf6]"
                  shadow="shadow-[0_6px_16px_rgba(139,92,246,0.25)]"
                  icon={<Receipt size={20} strokeWidth={2} />}
                />
              </>
            ) : (
              <>
                <QuickActionButton
                  to="/stock"
                  label="স্টক"
                  gradient="from-[#60a5fa] to-[#3b82f6]"
                  shadow="shadow-[0_6px_16px_rgba(59,130,246,0.25)]"
                  icon={<Package size={20} strokeWidth={2} />}
                />
                <QuickActionButton
                  to="/collections"
                  label="হিসাব"
                  gradient="from-[#a78bfa] to-[#8b5cf6]"
                  shadow="shadow-[0_6px_16px_rgba(139,92,246,0.25)]"
                  icon={<FileText size={20} strokeWidth={2} />}
                />
              </>
            )}
          </div>
        </div>
      </section>

      {/* Current Balance - Soft Card */}
      <section>
        <h3 className="text-[13px] font-bold text-gray-900 tracking-tight mb-3 px-1 flex items-center gap-2">
          <span className="w-6 h-6 rounded-[8px] bg-white border border-gray-100 shadow-sm flex items-center justify-center">
            <Wallet size={12} className="text-gray-600" />
          </span>
          বর্তমান হিসাব
        </h3>
        <div className="bg-white rounded-[20px] border border-gray-100/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)] divide-y divide-gray-50 overflow-hidden">
          <AccountRow
            to="/collections?type=customer"
            label="আমরা পাব"
            detail="ক্রেতার বাকি"
            value={stats.totalDues}
            icon={<ArrowDownLeft size={18} />}
            tint="bg-[#f0fdf4] text-[#04795a] border-[#dcfce7]"
          />
          {showPurchasesExpenses && (
            <AccountRow
              to="/collections?type=supplier"
              label="আমরা দেব"
              detail="সাপ্লায়ার পাওনা"
              value={stats.supplierDues}
              icon={<ArrowUpRight size={18} />}
              tint="bg-[#fff7ed] text-[#ea580c] border-[#ffedd5]"
            />
          )}
          <AccountRow
            to="/stock"
            label="মোট স্টক মূল্য"
            detail={stats.lowStockCount ? `${stats.lowStockCount.toLocaleString('bn-BD')}টি পণ্যের স্টক কম` : 'সব পণ্য পর্যাপ্ত'}
            value={stats.stockValue}
            icon={<Package size={18} />}
            tint="bg-[#eff6ff] text-[#2563eb] border-[#dbeafe]"
          />
        </div>
      </section>

      {/* Monthly Summary */}
      <section>
        <h3 className="text-[13px] font-bold text-gray-900 tracking-tight mb-3 px-1 flex items-center gap-2">
          <span className="w-6 h-6 rounded-[8px] bg-white border border-gray-100 shadow-sm flex items-center justify-center">
            <CalendarDays size={12} className="text-gray-600" />
          </span>
          চলতি মাস
        </h3>
        <div className="bg-white rounded-[20px] border border-gray-100/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-4">
          <div className="grid grid-cols-3 gap-3">
            <MonthlyChip label="বিক্রি" value={stats.monthly.revenue} />
            {showPurchasesExpenses && (
              <>
                <MonthlyChip label="ক্রয়" value={stats.monthly.purchaseTotal} />
                <MonthlyChip label="খরচ" value={stats.monthly.expenseTotal} />
              </>
            )}
            {showProfit && (
              <MonthlyChip label="লাভ" value={stats.monthly.netProfit} highlight isNegative={stats.monthly.netProfit < 0} />
            )}
          </div>
        </div>
      </section>

      {/* Recent Activity */}
      <section className="pb-2">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-[13px] font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <span className="w-6 h-6 rounded-[8px] bg-white border border-gray-100 shadow-sm flex items-center justify-center">
              <History size={12} className="text-gray-600" />
            </span>
            সাম্প্রতিক
          </h3>
          <Link
            to={showPurchasesExpenses ? '/reports/transaction' : '/reports'}
            className="text-[11px] font-semibold text-[#04795a] bg-[#e6f5ee] border border-[#d1ebe2] px-3 py-1 rounded-full inline-flex items-center gap-1 hover:bg-[#d1ebe2] transition-colors"
          >
            সব দেখুন <ArrowRight size={12} />
          </Link>
        </div>

        <div className="bg-white rounded-[20px] border border-gray-100/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)] overflow-hidden">
          {recent.length ? (
            <ul className="divide-y divide-gray-50">
              {recent.slice(0, 6).map((r) => (
                <li key={r.key}>
                  <Link to={r.to} className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#f8faf9] transition-colors group">
                    <div className="w-10 h-10 rounded-[12px] bg-[#f8faf9] border border-gray-100 flex items-center justify-center text-[#04795a] group-hover:bg-[#e6f5ee] group-hover:border-[#d1ebe2] transition-colors">
                      <ActivityIcon type={r.type} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-gray-500 leading-none">{bnDate(r.date)} • {r.type}</p>
                      <p className="text-[13px] font-medium text-gray-900 truncate mt-1">{r.party}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-bold text-gray-900">{money(r.amount)}</p>
                      <ArrowRight size={12} className="text-gray-300 ml-auto mt-0.5 group-hover:text-[#04795a] transition-colors" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-[14px] bg-[#f8faf9] border border-gray-100 flex items-center justify-center mx-auto mb-3">
                <History size={20} className="text-gray-400" />
              </div>
              <p className="text-[13px] font-medium text-gray-700">এখনও কোনো লেনদেন নেই</p>
              <p className="text-[11px] text-gray-500 mt-1">নতুন বিক্রি দিয়ে শুরু করুন</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function PastelStatBox({
  label,
  value,
  rawValue,
  tint,
  border,
  gradient,
  icon,
  sub,
}: {
  label: string
  value: string
  rawValue: number
  tint: string
  border: string
  gradient: string
  icon: ReactNode
  sub: string
}) {
  return (
    <div className={`rounded-[16px] ${tint} border ${border} p-3 flex flex-col items-center text-center`}>
      <div
        className={`w-11 h-11 rounded-[12px] bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-sm mb-2.5`}
      >
        {icon}
      </div>
      <p className="text-[11px] font-medium text-gray-500 leading-tight">{label}</p>
      <p className={`text-[14px] font-bold tracking-tight mt-1 leading-tight ${rawValue < 0 ? 'text-red-600' : 'text-gray-900'}`}>
        {value}
      </p>
      <p className="text-[10px] text-gray-400 mt-0.5 leading-none">{sub}</p>
    </div>
  )
}

function QuickActionButton({
  to,
  label,
  gradient,
  shadow,
  icon,
}: {
  to: string
  label: string
  gradient: string
  shadow: string
  icon: ReactNode
}) {
  return (
    <Link to={to} className="flex flex-col items-center gap-2.5 group">
      <div
        className={`w-[52px] h-[52px] rounded-[16px] bg-gradient-to-br ${gradient} ${shadow} flex items-center justify-center text-white group-hover:scale-105 group-active:scale-95 transition-transform duration-200`}
      >
        {icon}
      </div>
      <span className="text-[11px] font-medium text-gray-700 text-center leading-tight group-hover:text-gray-900">
        {label}
      </span>
    </Link>
  )
}

function AccountRow({
  to,
  label,
  detail,
  value,
  icon,
  tint,
}: {
  to: string
  label: string
  detail?: string
  value: number
  icon: ReactNode
  tint: string
}) {
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#fcfdfc] transition-colors group">
      <div className={`w-10 h-10 rounded-[12px] border flex items-center justify-center ${tint}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-gray-900">{label}</p>
        {detail && <p className="text-[11px] text-gray-500 mt-0.5">{detail}</p>}
      </div>
      <div className="text-right flex items-center gap-2">
        <p className="text-[13px] font-bold text-gray-900">{money(value)}</p>
        <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
      </div>
    </Link>
  )
}

function MonthlyChip({
  label,
  value,
  highlight,
  isNegative,
}: {
  label: string
  value: number
  highlight?: boolean
  isNegative?: boolean
}) {
  return (
    <div className={`rounded-[14px] p-3 border ${highlight ? 'bg-[#e6f5ee] border-[#d1ebe2]' : 'bg-[#f8faf9] border-gray-100'}`}>
      <p className={`text-[11px] font-medium ${highlight ? 'text-[#04795a]' : 'text-gray-500'}`}>{label}</p>
      <p className={`text-[13px] font-bold mt-1 tracking-tight ${isNegative ? 'text-red-600' : highlight ? 'text-[#04795a]' : 'text-gray-900'}`}>
        {money(value)}
      </p>
    </div>
  )
}

function ActivityIcon({ type }: { type: string }) {
  if (type === 'বিক্রি') return <ShoppingCart size={16} />
  if (type === 'ক্রয়') return <ShoppingBag size={16} />
  if (type === 'খরচ' || type === 'মালিকের টাকা তোলা') return <Receipt size={16} />
  return <Wallet size={16} />
}

/* Customer Dashboard - Same Soft Style */
function CustomerDashboard() {
  const user = useAuthStore((s) => s.user)!
  const sales = useSalesStore((s) => s.sales)
  const [me, setMe] = useState<DbCustomer | null>(null)
  const [error, setError] = useState(false)
  const ledger = useLiveQuery(async () => ({
    entries: await db.ledgerEntries.toArray(),
    collections: await db.collections.toArray(),
  }))

  useEffect(() => {
    let active = true
    linkCustomerForUser(user)
      .then((c) => {
        if (active) setMe(c)
      })
      .catch(() => {
        if (active) setError(true)
      })
    return () => {
      active = false
    }
  }, [user])

  const customerStats = useMemo(() => {
    if (!me) return { myDues: 0, totalPurchases: 0 }
    const rows = ledgerRows(me.id, sales, [], ledger?.entries || [], ledger?.collections || [], {
      through: ledgerToday(),
    })
    const myDues = rows[rows.length - 1]?.balance || 0
    const totalPurchases = sales.filter((s) => s.customer_id === me.id).reduce((sum, s) => sum + s.total_amount, 0)
    return { myDues, totalPurchases }
  }, [me, sales, ledger])

  const todayBangla = new Date().toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="px-4 pt-4 pb-28 space-y-5">
      <div className="bg-white rounded-[20px] border border-gray-100/80 shadow-[0_8px_32px_rgba(4,121,90,0.08)] overflow-hidden">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[14px] font-bold text-gray-900">আপনার হিসাব</h2>
            <span className="text-[11px] text-gray-500 bg-[#f8faf9] border border-gray-100 px-2.5 py-1 rounded-full">
              {todayBangla}
            </span>
          </div>

          {error ? (
            <p className="text-[13px] text-red-600 bg-red-50 border border-red-100 p-3 rounded-[12px]">
              আপনার হিসাব লোড হয়নি। আবার পেজটি খুলুন।
            </p>
          ) : !me || !ledger ? (
            <div className="grid grid-cols-2 gap-3 animate-pulse">
              <div className="h-24 bg-gray-50 rounded-[16px]"></div>
              <div className="h-24 bg-gray-50 rounded-[16px]"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <PastelStatBox
                label="বর্তমান পাওনা"
                value={money(customerStats.myDues)}
                rawValue={customerStats.myDues}
                tint="bg-[#fff7ed]"
                border="border-[#ffedd5]/60"
                gradient="from-[#fb923c] to-[#f97316]"
                icon={<Wallet size={18} />}
                sub={customerStats.myDues < 0 ? 'অগ্রিম জমা' : 'দোকানে বাকি'}
              />
              <PastelStatBox
                label="মোট ক্রয়"
                value={money(customerStats.totalPurchases)}
                rawValue={customerStats.totalPurchases}
                tint="bg-[#eff6ff]"
                border="border-[#dbeafe]/70"
                gradient="from-[#60a5fa] to-[#3b82f6]"
                icon={<ShoppingBag size={18} />}
                sub="আপনার কেনাকাটা"
              />
            </div>
          )}
        </div>

        <div className="bg-gradient-to-r from-[#e6f5ee] to-[#f0fdf4] border-t border-[#d1ebe2]/50 px-5 py-3">
          <Link to="/my-dues" className="flex items-center justify-between group">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[10px] bg-white border border-[#d1ebe2]/50 shadow-sm flex items-center justify-center text-[#04795a]">
                <FileText size={16} />
              </div>
              <div>
                <p className="text-[12px] font-semibold text-[#04795a]">Statement দেখুন</p>
                <p className="text-[10px] text-[#065f46]/60">PDF ডাউনলোড ও ইতিহাস</p>
              </div>
            </div>
            <ArrowRight size={16} className="text-[#04795a]/60 group-hover:text-[#04795a] transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  )
}
