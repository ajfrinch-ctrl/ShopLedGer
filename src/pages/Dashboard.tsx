import { useLiveQuery } from 'dexie-react-hooks'
import { db, type DbCustomer } from '../lib/db'
import { ledgerRows } from '../lib/ledger'
import { linkCustomerForUser } from '../lib/customerLink'
import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useSalesStore } from '../stores/salesStore'
import { usePurchaseStore } from '../stores/purchaseStore'
import { useProductStore } from '../stores/productStore'
import { useStockAdjustmentStore } from '../stores/stockAdjustmentStore'
import { computeStock } from '../lib/stock'
import {
  TrendingUp,
  Package,
  Users,
  ShoppingCart,
  Wallet,
  ClipboardList,
  ArrowRight,
  CalendarDays,
  BarChart3,
  CreditCard,
  ShoppingBag,
  Receipt,
} from 'lucide-react'

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)

  if (user?.role === 'customer') {
    return <CustomerDashboard userName={user.name} />
  }

  return <OwnerStaffDashboard />
}

/* ─────────────────────────────────────────────
   Owner & Staff Dashboard
   ───────────────────────────────────────────── */
function OwnerStaffDashboard() {
  const sales = useSalesStore((s) => s.sales)
  const purchases = usePurchaseStore((s) => s.purchases)
  const products = useProductStore((s) => s.products)
  const adjustments = useStockAdjustmentStore((s) => s.adjustments)

  const ledger = useLiveQuery(async () => ({ entries: await db.ledgerEntries.toArray(), collections: await db.collections.toArray() }))
  const expenses = useLiveQuery(() => db.expenses.toArray(), []) || []

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0]

    // ── Today ──
    const todaySales = sales.filter((s) => s.date.startsWith(today))
    const todaySalesAmount = todaySales.reduce(
      (sum, s) => sum + s.total_amount,
      0,
    )
    const todayProfit = todaySales.reduce(
      (sum, s) => sum + s.total_profit,
      0,
    )
    const todayPurchases = purchases.filter((p) => p.date.startsWith(today))
    const todayPurchaseAmount = todayPurchases.reduce(
      (sum, p) => sum + p.total,
      0,
    )
    const todayDues = todaySales
      .filter((s) => s.payment_type === 'বাকি')
      .reduce((sum, s) => sum + s.total_amount, 0)
    const shopExpenses = expenses.filter((e) => e.kind !== 'owner')
    const todayExpense = shopExpenses
      .filter((e) => e.date.startsWith(today))
      .reduce((sum, e) => sum + e.amount, 0)

    // ── This Month ──
    const monthSales = sales.filter((s) => s.date >= monthStart)
    const monthSalesAmount = monthSales.reduce(
      (sum, s) => sum + s.total_amount,
      0,
    )
    const monthProfit = monthSales.reduce(
      (sum, s) => sum + s.total_profit,
      0,
    )
    const monthPurchases = purchases.filter((p) => p.date >= monthStart)
    const monthPurchaseAmount = monthPurchases.reduce(
      (sum, p) => sum + p.total,
      0,
    )
    const monthExpense = shopExpenses
      .filter((e) => e.date >= monthStart)
      .reduce((sum, e) => sum + e.amount, 0)

    // ── All-time dues ──
    const totalDues = sales
      .filter((s) => s.payment_type === 'বাকি')
      .reduce((sum, s) => sum + s.total_amount, 0)
      + (ledger?.entries || []).filter(e => e.party_type === 'customer' && !e.cancelled).reduce((sum, e) => sum + (e.kind === 'opening' ? e.amount : -e.amount), 0)
      - (ledger?.collections || []).reduce((sum, e) => sum + e.amount, 0)

    // ── Stock value ──
    const stockRows = computeStock(products, purchases, sales, adjustments)
    const stockValue = stockRows.reduce((sum, r) => sum + r.stockValue, 0)
    const lowStockCount = stockRows.filter((r) => r.isLow).length

    return {
      todaySalesAmount,
      todayProfit,
      todayPurchaseAmount,
      todayDues,
      todayExpense,
      todaySaleCount: todaySales.length,
      monthSalesAmount,
      monthProfit,
      monthPurchaseAmount,
      monthExpense,
      monthSaleCount: monthSales.length,
      totalDues,
      stockValue,
      lowStockCount,
    }
  }, [sales, purchases, products, ledger, expenses, adjustments])

  const todayStr = new Date().toLocaleDateString('bn-BD', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="pb-24">
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-teal-700 to-emerald-700 text-white px-4 pt-4 pb-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-bold">ড্যাশবোর্ড</h1>
          <div className="flex items-center gap-1.5 text-teal-100 text-xs">
            <CalendarDays size={14} />
            {todayStr}
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3 space-y-5">
        {/* ── Today's Summary ── */}
        <section>
          <SectionTitle icon={<BarChart3 size={16} />} text="আজকের হিসাব" />
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              title="মোট বিক্রি"
              value={stats.todaySalesAmount}
              subtitle={`${stats.todaySaleCount}টি বিক্রি`}
              icon={<ShoppingCart size={18} />}
              color="blue"
            />
            <StatCard
              title="মোট লাভ"
              value={stats.todayProfit}
              subtitle="গ্রস প্রফিট"
              icon={<TrendingUp size={18} />}
              color="green"
            />
            <StatCard
              title="মোট ক্রয়"
              value={stats.todayPurchaseAmount}
              subtitle="পণ্য ক্রয়"
              icon={<ShoppingBag size={18} />}
              color="purple"
            />
            <StatCard
              title="আজকের বাকি"
              value={stats.todayDues}
              subtitle="বাকি বিক্রি"
              icon={<CreditCard size={18} />}
              color="orange"
            />
          </div>
        </section>

        {/* ── Monthly Summary ── */}
        <section>
          <SectionTitle
            icon={<CalendarDays size={16} />}
            text="চলতি মাসের হিসাব"
          />
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              title="মোট বিক্রি"
              value={stats.monthSalesAmount}
              subtitle={`${stats.monthSaleCount}টি বিক্রি`}
              color="blue"
            />
            <StatCard
              title="মোট লাভ"
              value={stats.monthProfit}
              color="green"
            />
            <StatCard
              title="মোট ক্রয়"
              value={stats.monthPurchaseAmount}
              color="purple"
            />
            <StatCard
              title={stats.monthProfit - stats.monthExpense < 0 ? 'নিট ক্ষতি' : 'নিট লাভ'}
              value={Math.abs(stats.monthProfit - stats.monthExpense)}
              subtitle={`খরচ ৳ ${stats.monthExpense.toLocaleString('bn-BD')} বাদে`}
              color={stats.monthProfit - stats.monthExpense < 0 ? 'red' : 'teal'}
            />
          </div>
        </section>

        {/* ── Stock & Dues ── */}
        <section>
          <SectionTitle
            icon={<Package size={16} />}
            text="স্টক ও বাকি"
          />
          <div className="grid grid-cols-1 gap-3">
            <div className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-100 rounded-xl">
                  <Package className="text-purple-600" size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">মোট স্টক মূল্য</p>
                  <p className="font-bold text-lg text-gray-800">
                    ৳ {stats.stockValue.toLocaleString('bn-BD')}
                  </p>
                  {stats.lowStockCount > 0 && (
                    <p className="text-[11px] font-medium text-red-600">
                      ⚠ {stats.lowStockCount.toLocaleString('bn-BD')}টি পণ্যের স্টক কম
                    </p>
                  )}
                </div>
              </div>
              <Link
                to="/stock"
                className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
              >
                <ArrowRight size={18} />
              </Link>
            </div>

            <div className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-orange-100 rounded-xl">
                  <Users className="text-orange-600" size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">মোট ক্রেতার বাকি</p>
                  <p className="font-bold text-lg text-orange-600">
                    ৳ {stats.totalDues.toLocaleString('bn-BD')}
                  </p>
                </div>
              </div>
              <Link
                to="/collections"
                className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
              >
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Quick Actions ── */}
        <section>
          <SectionTitle icon={<ShoppingCart size={16} />} text="দ্রুত কাজ" />
          <div className="grid grid-cols-2 gap-3">
            <QuickAction
              to="/sales"
              label="নতুন বিক্রি"
              icon={<ShoppingCart size={20} />}
              color="bg-blue-50 text-blue-600"
            />
            <QuickAction
              to="/purchases"
              label="ক্রয় এন্ট্রি"
              icon={<ShoppingBag size={20} />}
              color="bg-purple-50 text-purple-600"
            />
            <QuickAction
              to="/collections"
              label="বাকি আদায়"
              icon={<Wallet size={20} />}
              color="bg-orange-50 text-orange-600"
            />
            <QuickAction
              to="/customers"
              label="ক্রেতা"
              icon={<Users size={20} />}
              color="bg-teal-50 text-teal-600"
            />
            <QuickAction
              to="/expenses"
              label="খরচ এন্ট্রি"
              icon={<Receipt size={20} />}
              color="bg-red-50 text-red-600"
            />
            <QuickAction
              to="/profit-loss"
              label="লাভ-ক্ষতি রিপোর্ট"
              icon={<TrendingUp size={20} />}
              color="bg-green-50 text-green-600"
            />
          </div>
        </section>

        {/* ── Daily Report Card ── */}
        <DailyReport
          todaySales={stats.todaySalesAmount}
          todayProfit={stats.todayProfit}
          todayPurchase={stats.todayPurchaseAmount}
          todayExpense={stats.todayExpense}
          todayDues={stats.todayDues}
          todaySaleCount={stats.todaySaleCount}
        />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Customer Dashboard
   ───────────────────────────────────────────── */
function CustomerDashboard({ userName }: { userName: string }) {
  const user = useAuthStore((s) => s.user)!
  const sales = useSalesStore((s) => s.sales)
  const [me, setMe] = useState<DbCustomer | null>(null)
  const ledger = useLiveQuery(async () => ({ entries: await db.ledgerEntries.toArray(), collections: await db.collections.toArray() }))
  const pendingOrders = useLiveQuery(() => (me ? db.orders.where('customer_id').equals(me.id).filter((o) => o.status === 'pending' || o.status === 'accepted').count() : 0), [me?.id]) || 0

  useEffect(() => {
    linkCustomerForUser(user).then(setMe)
  }, [user])

  const customerStats = useMemo(() => {
    if (!me) return { myDues: 0, totalPurchases: 0 }
    const rows = ledgerRows(me.id, sales, [], ledger?.entries || [], ledger?.collections || [])
    const myDues = rows[rows.length - 1]?.balance || 0
    const totalPurchases = sales.filter((s) => s.customer_id === me.id).reduce((sum, s) => sum + s.total_amount, 0)
    return { myDues, totalPurchases }
  }, [me, sales, ledger])

  return (
    <div className="pb-24">
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-teal-700 to-emerald-700 text-white px-4 pt-4 pb-6">
        <h1 className="text-lg font-bold">স্বাগতম, {userName}</h1>
        <p className="text-teal-100 text-xs mt-0.5">
          আপনার হিসাব দেখুন
        </p>
      </div>

      <div className="px-4 -mt-3 space-y-5">
        {/* ── Due Card ── */}
        <div className="card bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-xl">
              <Wallet className="text-orange-600" size={28} />
            </div>
            <div>
              <p className="text-sm text-gray-600">আপনার বর্তমান বাকি</p>
              <p className="text-3xl font-bold text-orange-600">
                ৳ {customerStats.myDues.toLocaleString('bn-BD')}
              </p>
            </div>
          </div>
        </div>

        {/* ── Purchase Summary ── */}
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-100 rounded-xl">
              <ShoppingCart className="text-teal-600" size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500">মোট ক্রয়</p>
              <p className="font-bold text-lg text-gray-800">
                ৳ {customerStats.totalPurchases.toLocaleString('bn-BD')}
              </p>
            </div>
          </div>
        </div>

        {/* ── Quick Actions ── */}
        <section>
          <SectionTitle icon={<ClipboardList size={16} />} text="দ্রুত কাজ" />
          <div className="grid grid-cols-2 gap-3">
            <QuickAction
              to="/orders"
              label={pendingOrders > 0 ? `অর্ডার (${pendingOrders.toLocaleString('bn-BD')}টি চলমান)` : 'অর্ডার দিন'}
              icon={<ClipboardList size={20} />}
              color="bg-teal-50 text-teal-600"
            />
            <QuickAction
              to="/my-dues"
              label="বাকির হিস্ট্রি"
              icon={<Wallet size={20} />}
              color="bg-orange-50 text-orange-600"
            />
          </div>
        </section>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Daily Report Card (Auto)
   ───────────────────────────────────────────── */
function DailyReport({
  todaySales,
  todayProfit,
  todayPurchase,
  todayExpense,
  todayDues,
  todaySaleCount,
}: {
  todaySales: number
  todayProfit: number
  todayPurchase: number
  todayExpense: number
  todayDues: number
  todaySaleCount: number
}) {
  // নিট লাভ = গ্রস লাভ − খরচ। পণ্য ক্রয় স্টকে যায়, লাভ থেকে বাদ যায় না।
  const netToday = todayProfit - todayExpense

  return (
    <section>
      <SectionTitle
        icon={<BarChart3 size={16} />}
        text="দৈনিক রিপোর্ট (অটো)"
      />
      <div className="card bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 text-sm">
            আজকের সারসংক্ষেপ
          </h3>
          <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
            {todaySaleCount}টি লেনদেন
          </span>
        </div>

        <div className="space-y-3">
          <ReportRow
            label="মোট বিক্রি"
            value={todaySales}
            color="text-blue-700"
          />
          <ReportRow
            label="মোট ক্রয়"
            value={todayPurchase}
            color="text-purple-700"
          />
          <ReportRow
            label="গ্রস লাভ"
            value={todayProfit}
            color="text-green-700"
          />
          <ReportRow
            label="মোট খরচ"
            value={todayExpense}
            color="text-orange-700"
          />
          <div className="border-t border-teal-200 pt-2">
            <ReportRow
              label={netToday < 0 ? 'নিট ক্ষতি' : 'নিট লাভ'}
              value={netToday}
              color={netToday >= 0 ? 'text-teal-700' : 'text-red-700'}
              bold
            />
          </div>
          {todayDues > 0 && (
            <ReportRow
              label="আজকের বাকি"
              value={todayDues}
              color="text-orange-700"
            />
          )}
          <Link to="/profit-loss" className="block text-center text-xs font-medium text-teal-700 pt-1">
            বিস্তারিত লাভ-ক্ষতি রিপোর্ট →
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────
   Reusable Components
   ───────────────────────────────────────────── */
function SectionTitle({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <span className="text-teal-600">{icon}</span>
      <h2 className="text-sm font-semibold text-gray-700">{text}</h2>
    </div>
  )
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color = 'blue',
}: {
  title: string
  value: number
  subtitle?: string
  icon?: React.ReactNode
  color?: 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'teal'
}) {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-100',
    green: 'bg-green-50 border-green-100',
    red: 'bg-red-50 border-red-100',
    purple: 'bg-purple-50 border-purple-100',
    orange: 'bg-orange-50 border-orange-100',
    teal: 'bg-teal-50 border-teal-100',
  }
  const textColor = {
    blue: 'text-blue-700',
    green: 'text-green-700',
    red: 'text-red-700',
    purple: 'text-purple-700',
    orange: 'text-orange-700',
    teal: 'text-teal-700',
  }

  return (
    <div
      className={`card ${colorMap[color]} border rounded-xl shadow-sm p-3.5`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-medium text-gray-500">{title}</p>
        {icon && <span className={textColor[color]}>{icon}</span>}
      </div>
      <p className={`text-xl font-bold ${textColor[color]}`}>
        ৳ {value.toLocaleString('bn-BD')}
      </p>
      {subtitle && (
        <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>
      )}
    </div>
  )
}

function QuickAction({
  to,
  label,
  icon,
  color,
}: {
  to: string
  label: string
  icon: React.ReactNode
  color: string
}) {
  return (
    <Link
      to={to}
      className={`card text-center py-4 hover:shadow-md active:scale-95 transition-all ${color} border rounded-xl`}
    >
      <div className="mx-auto mb-1.5">{icon}</div>
      <p className="text-xs font-semibold">{label}</p>
    </Link>
  )
}

function ReportRow({
  label,
  value,
  color,
  bold,
}: {
  label: string
  value: number
  color: string
  bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={`text-sm ${bold ? 'font-semibold text-gray-800' : 'text-gray-600'}`}
      >
        {label}
      </span>
      <span className={`text-sm font-semibold ${color}`}>
        ৳ {value.toLocaleString('bn-BD')}
      </span>
    </div>
  )
}
