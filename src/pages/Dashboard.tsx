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
import { TrendingUp, Package, ShoppingCart, Wallet, ClipboardList, ArrowRight, CalendarDays, BarChart3, ShoppingBag, Receipt, History, ArrowDownLeft, ArrowUpRight } from 'lucide-react'

export default function Dashboard() {
  const user = useAuthStore(s => s.user)
  if (!user) return null
  return user.role === 'customer' ? <CustomerDashboard key={user.id} userName={user.name} /> : <OwnerStaffDashboard />
}

function OwnerStaffDashboard() {
  const user = useAuthStore(s => s.user)
  const showProfit = canSeeProfit(user?.role)
  const showPurchasesExpenses = canEntryPurchaseExpense(user?.role)
  const sales = useSalesStore(s => s.sales)
  const purchases = usePurchaseStore(s => s.purchases)
  const products = useProductStore(s => s.products)
  const adjustments = useStockAdjustmentStore(s => s.adjustments)
  const ledger = useLiveQuery(async () => ({ entries: await db.ledgerEntries.toArray(), collections: await db.collections.toArray() }))
  const expensesQuery = useLiveQuery(() => db.expenses.toArray(), [])
  const expenses = useMemo(() => expensesQuery ?? [], [expensesQuery])
  const today = ledgerToday()

  const stats = useMemo(() => {
    const now = new Date()
    const monthStart = toDateKey(new Date(now.getFullYear(), now.getMonth(), 1))
    // Same authorized-branch scope as the previous dashboard (not just the entry branch).
    const mine = <T extends { branch_id?: string }>(rows: T[]) => rows.filter(r => inUserBranch(user, r.branch_id))
    const mySales = mine(sales)
    const myPurchases = mine(purchases)
    const myExpenses = mine(expenses)
    // Reuse the trusted profit/loss function: purchases and owner drawings are NOT expenses.
    const daily = computeProfitLoss(mySales, myExpenses, myPurchases, { from: today, to: today })
    const monthly = computeProfitLoss(mySales, myExpenses, myPurchases, { from: monthStart, to: today })
    const debtData = { sales: mySales, purchases: myPurchases, entries: mine(ledger?.entries || []), collections: mine(ledger?.collections || []), customers: [] }
    const activity = dailyDebtActivity(debtData, today)
    const totalDues = debtAccounts('customer', debtData, { through: today }).reduce((sum, a) => sum + Math.max(0, a.balance), 0)
    const supplierDues = debtAccounts('supplier', debtData, { through: today }).reduce((sum, a) => sum + Math.max(0, a.balance), 0)
    // Preserve the existing stock basis, including adjustments and stored opening stock.
    const stockRows = computeStock(mine(products), myPurchases, mySales, mine(adjustments))
    return {
      daily, monthly, todayCollected: activity.collected, totalDues, supplierDues,
      stockValue: stockRows.reduce((sum, r) => sum + r.stockValue, 0),
      lowStockCount: stockRows.filter(r => r.isLow).length,
    }
  }, [sales, purchases, products, ledger, expenses, adjustments, user, today])

  const recent = useMemo(() => recentDashboardActivity({ sales, purchases, expenses, entries: ledger?.entries || [], collections: ledger?.collections || [] }, user, today),
    [sales, purchases, expenses, ledger, user, today])
  const loaded = !!ledger && !!expensesQuery

  return <div className="dashboard-ui max-w-5xl mx-auto px-4 pt-5 pb-28 space-y-6" data-dashboard="shop">
    <DashboardHeader name={user?.name || ''} />
    {!loaded ? <p role="status" className="text-sm text-gray-500 py-6">হিসাব লোড হচ্ছে…</p> : <>
      <section aria-label="আজকের হিসাব">
        <SectionTitle icon={<BarChart3 size={18} />} text="আজকের হিসাব" />
        <div className="grid grid-cols-2 gap-3" data-today-summary>
          <StatCard title="মোট বিক্রি" value={stats.daily.revenue} subtitle={`${stats.daily.saleCount.toLocaleString('bn-BD')}টি বিক্রি`} icon={<ShoppingCart size={18} />} />
          <StatCard title="বাকি আদায়" value={stats.todayCollected} subtitle="ক্রেতার কাছ থেকে পাওয়া টাকা" icon={<Wallet size={18} />} />
          {showPurchasesExpenses && <StatCard title="মোট খরচ" value={stats.daily.expenseTotal} subtitle="শুধু দোকানের খরচ" icon={<Receipt size={18} />} />}
          {showProfit && <StatCard title="মোট লাভ" value={stats.daily.netProfit} subtitle={stats.daily.netProfit < 0 ? 'নিট ক্ষতি · দোকানের খরচ বাদে' : 'নিট লাভ · দোকানের খরচ বাদে'} icon={<TrendingUp size={18} />} />}
        </div>
      </section>

      <section aria-label="বর্তমান হিসাব">
        <SectionTitle icon={<Wallet size={18} />} text="বর্তমান হিসাব" />
        <div className="bg-white rounded-xl border divide-y" data-current-summary>
          <AccountLink to="/collections?type=customer" label="আমরা পাব" detail="Customer Due" value={stats.totalDues} icon={<ArrowDownLeft size={20} />} />
          {showPurchasesExpenses && <AccountLink to="/collections?type=supplier" label="আমরা দেব" detail="Supplier Payable" value={stats.supplierDues} icon={<ArrowUpRight size={20} />} />}
          <AccountLink to="/stock" label="মোট স্টক মূল্য" detail={stats.lowStockCount ? `${stats.lowStockCount.toLocaleString('bn-BD')}টি পণ্যের স্টক কম` : undefined} value={stats.stockValue} icon={<Package size={20} />} />
        </div>
      </section>

      <section aria-label="দ্রুত কাজ">
        <SectionTitle icon={<ShoppingCart size={18} />} text="দ্রুত কাজ" />
        <div className="grid grid-cols-2 gap-3" data-quick-actions>
          <QuickAction to="/sales" label="নতুন বিক্রি" icon={<ShoppingCart size={20} />} />
          <QuickAction to="/collections?type=customer" label="বাকি আদায়" icon={<Wallet size={20} />} />
          {showPurchasesExpenses && <><QuickAction to="/purchases" label="ক্রয়" icon={<ShoppingBag size={20} />} /><QuickAction to="/expenses" label="খরচ" icon={<Receipt size={20} />} /></>}
        </div>
      </section>

      <section aria-label="চলতি মাস">
        <SectionTitle icon={<CalendarDays size={18} />} text="চলতি মাস" />
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 border-y py-4" data-month-summary>
          <MonthlyItem label="বিক্রি" value={stats.monthly.revenue} />
          {showPurchasesExpenses && <><MonthlyItem label="ক্রয়" value={stats.monthly.purchaseTotal} /><MonthlyItem label="খরচ" value={stats.monthly.expenseTotal} /></>}
          {showProfit && <MonthlyItem label="লাভ" value={stats.monthly.netProfit} note={stats.monthly.netProfit < 0 ? 'নিট ক্ষতি' : 'নিট লাভ'} />}
        </dl>
      </section>

      <section aria-label="সাম্প্রতিক কার্যক্রম">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <SectionTitle icon={<History size={18} />} text="সাম্প্রতিক কার্যক্রম" />
          <Link to={showPurchasesExpenses ? '/reports/transaction' : '/reports'} className="text-sm font-semibold text-teal-700 inline-flex items-center gap-1 min-h-11">সব দেখুন <ArrowRight size={16} /></Link>
        </div>
        <ul className="divide-y" data-recent-activity>
          {recent.map(r => <li key={r.key}>
            <Link to={r.to} className="flex items-center gap-3 py-3 min-h-16 hover:bg-gray-100 rounded-lg">
              <span className="p-2 bg-white rounded-lg text-teal-700 shrink-0"><ActivityIcon type={r.type} /></span>
              <span className="min-w-0 flex-1"><span className="block text-xs text-gray-500">{bnDate(r.date)} · {r.type}</span><span className="block text-sm font-medium break-words">{r.party}</span></span>
              <span className="max-w-[45%] text-right text-sm font-semibold">{money(r.amount)}</span>
            </Link>
          </li>)}
        </ul>
        {!recent.length && <p className="text-sm text-gray-500 py-5">এখনও কোনো লেনদেন নেই। নতুন বিক্রি দিয়ে শুরু করুন।</p>}
      </section>
    </>}
  </div>
}

function CustomerDashboard({ userName }: { userName: string }) {
  const user = useAuthStore(s => s.user)!
  const sales = useSalesStore(s => s.sales)
  const [me, setMe] = useState<DbCustomer | null>(null)
  const [error, setError] = useState(false)
  const ledger = useLiveQuery(async () => ({ entries: await db.ledgerEntries.toArray(), collections: await db.collections.toArray() }))
  const pendingOrders = useLiveQuery(() => (me ? db.orders.where('customer_id').equals(me.id).filter(o => o.status === 'pending' || o.status === 'accepted').count() : 0), [me?.id])

  useEffect(() => {
    let active = true
    // Keep the existing customer identity/linking behavior, never use shop-wide totals.
    linkCustomerForUser(user).then(c => { if (active) setMe(c) }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [user])

  const customerStats = useMemo(() => {
    if (!me) return { myDues: 0, totalPurchases: 0 }
    const rows = ledgerRows(me.id, sales, [], ledger?.entries || [], ledger?.collections || [], { through: ledgerToday() })
    const myDues = rows[rows.length - 1]?.balance || 0
    const totalPurchases = sales.filter(s => s.customer_id === me.id).reduce((sum, s) => sum + s.total_amount, 0)
    return { myDues, totalPurchases }
  }, [me, sales, ledger])

  return <div className="dashboard-ui max-w-5xl mx-auto px-4 pt-5 pb-28 space-y-6" data-dashboard="customer">
    <DashboardHeader name={userName} />
    {error ? <p role="alert" className="text-sm text-red-700">আপনার হিসাব লোড হয়নি। আবার পেজটি খুলুন।</p> : !me || !ledger || pendingOrders === undefined ? <p role="status" className="text-sm text-gray-500">আপনার হিসাব লোড হচ্ছে…</p> : <>
      <section aria-label="আপনার হিসাব" className="grid grid-cols-2 gap-3">
        <StatCard title="বর্তমান পাওনা" value={customerStats.myDues} subtitle={customerStats.myDues < 0 ? 'আগের রেকর্ডে অগ্রিম জমা' : 'দোকানে আপনার বাকি'} icon={<Wallet size={18} />} />
        <StatCard title="মোট ক্রয়" value={customerStats.totalPurchases} subtitle="আপনার কেনাকাটা" icon={<ShoppingBag size={18} />} />
      </section>
      <div className="bg-white border rounded-xl divide-y">
        <Link to="/orders" className="flex items-center gap-3 p-4 min-h-16 text-sm"><ClipboardList size={20} className="text-teal-700 shrink-0" /><span className="flex-1">চলমান অর্ডার</span><strong>{pendingOrders.toLocaleString('bn-BD')}টি</strong><ArrowRight size={16} /></Link>
        <Link to="/my-dues" className="flex items-center gap-3 p-4 min-h-16 text-sm"><History size={20} className="text-teal-700 shrink-0" /><span className="flex-1">বাকি হিস্ট্রি</span><ArrowRight size={16} /></Link>
      </div>
    </>}
  </div>
}

function DashboardHeader({ name }: { name: string }) {
  return <header className="space-y-1">
    <h1 className="text-xl font-bold">ড্যাশবোর্ড</h1>
    <p className="text-sm text-gray-700">স্বাগতম, {name}</p>
    <p className="text-xs text-gray-500">{new Date().toLocaleDateString('bn-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
  </header>
}

function SectionTitle({ icon, text }: { icon: ReactNode; text: string }) {
  return <h2 className="flex items-center gap-2 mb-2.5 text-sm font-semibold text-gray-700"><span className="text-teal-700 shrink-0">{icon}</span>{text}</h2>
}

function StatCard({ title, value, subtitle, icon }: { title: string; value: number; subtitle: string; icon: ReactNode }) {
  return <div className="card min-w-0 !p-3 sm:!p-4">
    <div className="flex items-center gap-2 mb-2"><span className="text-teal-700 shrink-0">{icon}</span><p className="text-xs text-gray-600">{title}</p></div>
    <p className={`text-lg sm:text-xl font-bold ${value < 0 ? 'text-red-700' : 'text-gray-900'}`}>{money(value)}</p>
    <p className="text-[11px] text-gray-500 mt-1">{subtitle}</p>
  </div>
}

function AccountLink({ to, label, detail, value, icon }: { to: string; label: string; detail?: string; value: number; icon: ReactNode }) {
  return <Link to={to} className="flex items-center gap-3 px-3 py-3 min-h-16 hover:bg-gray-50">
    <span className="text-teal-700 shrink-0">{icon}</span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{label}</span>{detail && <span className="block text-[11px] text-gray-500">{detail}</span>}</span>
    <strong className="text-sm text-right max-w-[45%]">{money(value)}</strong><ArrowRight size={16} className="text-gray-400 shrink-0" />
  </Link>
}

function QuickAction({ to, label, icon }: { to: string; label: string; icon: ReactNode }) {
  return <Link to={to} className="bg-white border rounded-xl flex items-center justify-center gap-2 px-3 py-4 min-h-14 text-teal-800 hover:bg-teal-50 active:bg-teal-100"><span className="shrink-0">{icon}</span><span className="text-sm font-semibold">{label}</span></Link>
}

function MonthlyItem({ label, value, note }: { label: string; value: number; note?: string }) {
  return <div className="min-w-0"><dt className="text-xs text-gray-500">{label}{note && <span className="ml-1">({note})</span>}</dt><dd className={`text-sm font-semibold mt-1 ${value < 0 ? 'text-red-700' : ''}`}>{money(value)}</dd></div>
}

function ActivityIcon({ type }: { type: string }) {
  if (type === 'বিক্রি') return <ShoppingCart size={18} />
  if (type === 'ক্রয়') return <ShoppingBag size={18} />
  if (type === 'খরচ' || type === 'মালিকের টাকা তোলা') return <Receipt size={18} />
  return <Wallet size={18} />
}
