import { useAuthStore } from '../stores/authStore'
import {
  TrendingUp,
  TrendingDown,
  Package,
  Users,
  ShoppingCart,
  Wallet,
} from 'lucide-react'

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)

  // Mock data for now (will be replaced with real calculations)
  const stats = {
    todaySales: 0,
    todayProfit: 0,
    todayExpense: 0,
    todayNet: 0,
    monthSales: 0,
    monthProfit: 0,
    monthExpense: 0,
    monthNet: 0,
    totalStockValue: 0,
    totalDues: 0,
    totalStockUnits: 0,
  }

  if (user?.role === 'customer') {
    return (
      <div className="p-4 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">স্বাগতম, {user.name}</h2>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-full">
              <Wallet className="text-orange-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">আপনার বর্তমান বাকি</p>
              <p className="text-2xl font-bold text-orange-600">৳ ০</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="card text-center">
            <ClipboardIcon />
            <p className="text-sm text-gray-500 mt-2">অর্ডার দিন</p>
          </div>
          <div className="card text-center">
            <HistoryIcon />
            <p className="text-sm text-gray-500 mt-2">হিস্ট্রি দেখুন</p>
          </div>
        </div>
      </div>
    )
  }

  // Owner & Staff Dashboard
  return (
    <div className="p-4 space-y-4">
      {/* Date */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">ড্যাশবোর্ড</h2>
        <p className="text-sm text-gray-500">
          {new Date().toLocaleDateString('bn-BD', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Today's Summary */}
      <section>
        <h3 className="text-sm font-medium text-gray-500 mb-2">আজকের সারাংশ</h3>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            title="বিক্রি"
            value={stats.todaySales}
            icon={<ShoppingCart size={20} />}
            color="blue"
          />
          <StatCard
            title="গ্রস লাভ"
            value={stats.todayProfit}
            icon={<TrendingUp size={20} />}
            color="green"
          />
          <StatCard
            title="খরচ"
            value={stats.todayExpense}
            icon={<TrendingDown size={20} />}
            color="red"
          />
          <StatCard
            title="নিট লাভ"
            value={stats.todayNet}
            icon={<TrendingUp size={20} />}
            color="primary"
          />
        </div>
      </section>

      {/* This Month */}
      <section>
        <h3 className="text-sm font-medium text-gray-500 mb-2">চলতি মাসের সারাংশ</h3>
        <div className="grid grid-cols-2 gap-3">
          <StatCard title="বিক্রি" value={stats.monthSales} color="blue" />
          <StatCard title="গ্রস লাভ" value={stats.monthProfit} color="green" />
          <StatCard title="খরচ" value={stats.monthExpense} color="red" />
          <StatCard title="নিট লাভ" value={stats.monthNet} color="primary" />
        </div>
      </section>

      {/* Stock & Dues */}
      <section>
        <h3 className="text-sm font-medium text-gray-500 mb-2">স্টক ও বাকি</h3>
        <div className="grid grid-cols-1 gap-3">
          <div className="card flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-100 rounded-lg">
                <Package className="text-purple-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">মোট স্টক মূল্য</p>
                <p className="font-bold text-lg">৳ {stats.totalStockValue.toLocaleString('bn-BD')}</p>
              </div>
            </div>
          </div>

          <div className="card flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-orange-100 rounded-lg">
                <Users className="text-orange-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">মোট ক্রেতার বাকি</p>
                <p className="font-bold text-lg text-orange-600">৳ {stats.totalDues.toLocaleString('bn-BD')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <h3 className="text-sm font-medium text-gray-500 mb-2">দ্রুত কাজ</h3>
        <div className="grid grid-cols-3 gap-3">
          <QuickAction to="/sales" label="নতুন বিক্রি" />
          <QuickAction to="/purchases" label="ক্রয় এন্ট্রি" />
          <QuickAction to="/collections" label="বাকি আদায়" />
        </div>
      </section>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon,
  color = 'primary',
}: {
  title: string
  value: number
  icon?: React.ReactNode
  color?: 'blue' | 'green' | 'red' | 'primary'
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    primary: 'bg-primary-50 text-primary-700',
  }

  return (
    <div className={`card ${colors[color]}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs opacity-80">{title}</p>
        {icon}
      </div>
      <p className="text-xl font-bold">৳ {value.toLocaleString('bn-BD')}</p>
    </div>
  )
}

function QuickAction({ to, label }: { to: string; label: string }) {
  return (
    <a
      href={to}
      className="card text-center py-4 hover:bg-gray-50 active:scale-95 transition-transform"
    >
      <p className="text-sm font-medium text-gray-700">{label}</p>
    </a>
  )
}

function ClipboardIcon() {
  return (
    <div className="mx-auto w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
      <ClipboardList className="text-primary-700" size={24} />
    </div>
  )
}

function HistoryIcon() {
  return (
    <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
      <Wallet className="text-gray-600" size={24} />
    </div>
  )
}

// Fix missing import
import { ClipboardList } from 'lucide-react'
