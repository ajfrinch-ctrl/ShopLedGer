import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { db } from '../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { roleLabel, staffBranchIds } from '../lib/roles'
import { useUiStore } from '../stores/uiStore'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Settings,
  LogOut,
  ClipboardList,
  Wallet,
  UserCircle2,
  KeyRound,
} from 'lucide-react'

export default function Layout() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // একাধিক শাখার কর্মী হেডার থেকে কাজের শাখা বদলাতে পারেন
  const data = useLiveQuery(async () => ({ branches: await db.branches.toArray() }))
  const myBranches = staffBranchIds(user)
  const multiBranchStaff = myBranches.length > 1
  const staffBranchId = useUiStore((st) => st.staffBranchId)
  const setStaffBranchId = useUiStore((st) => st.setStaffBranchId)
  const activeBranch = myBranches.includes(staffBranchId) ? staffBranchId : myBranches[0] || ''
  const isCustomer = user?.role === 'customer'
  const customerDate = new Date().toLocaleDateString('bn-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  // Navigation items based on role
  const navItems = (() => {
    if (user?.role === 'customer') {
      return [
        { to: '/', icon: LayoutDashboard, label: 'হোম' },
        { to: '/orders', icon: ClipboardList, label: 'অর্ডার' },
        { to: '/my-dues', icon: Wallet, label: 'বাকি' },
        { to: '/profile', icon: UserCircle2, label: 'প্রোফাইল' },
      ]
    }

    // Owner & Staff
    return [
      { to: '/', icon: LayoutDashboard, label: 'ড্যাশবোর্ড' },
      { to: '/sales', icon: ShoppingCart, label: 'বিক্রি' },
      { to: '/stock', icon: Package, label: 'স্টক' },
      { to: '/collections', icon: Wallet, label: 'বাকি খাতা' },
      { to: '/more', icon: Settings, label: 'আরও' },
    ]
  })()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* প্রথম লগইনে পাসওয়ার্ড পরিবর্তনের বাধ্যতামূলক পপআপ */}
      {user?.must_change_password && <FirstLoginPasswordModal />}

      {/* Top Header */}
      <header className="bg-primary-700 text-white px-4 py-3 sticky top-0 z-20 shadow-md" data-customer-header={isCustomer || undefined}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-lg leading-tight truncate">{isCustomer ? `স্বাগতম, ${user?.name || ''}` : 'ShopLedGer'}</h1>
            <p className="text-primary-100 text-xs truncate">
              {isCustomer ? `ক্রেতা • ${customerDate}` : `${user?.name} • ${roleLabel(user?.role)}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {multiBranchStaff && (
              <select
                aria-label="কাজের শাখা"
                className="bg-primary-600 border border-primary-500 rounded-lg text-xs text-white px-2 py-1.5 max-w-[130px]"
                value={activeBranch}
                onChange={(e) => setStaffBranchId(e.target.value)}
              >
                {(data?.branches || [])
                  .filter((b) => myBranches.includes(b.id))
                  .map((b) => (
                    <option key={b.id} value={b.id} className="text-gray-900">
                      {b.name || 'শাখা'}
                    </option>
                  ))}
              </select>
            )}
            <button
              onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-primary-600 transition-colors"
            title="লগআউট"
          >
            <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20 safe-bottom">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 h-full text-xs transition-colors ${
                  isActive ? 'text-primary-700' : 'text-gray-500 hover:text-gray-700'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="mt-0.5 font-medium">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

function FirstLoginPasswordModal() {
  const complete = useAuthStore((s) => s.completeFirstLoginPasswordChange)
  const logout = useAuthStore((s) => s.logout)
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPass.length < 6) {
      setError('নতুন পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে')
      return
    }
    if (newPass === '123456') {
      setError('ডিফল্ট পাসওয়ার্ড (123456) রাখা যাবে না, নতুন একটি পাসওয়ার্ড দিন')
      return
    }
    if (newPass !== confirmPass) {
      setError('নতুন পাসওয়ার্ড দুইটি হুবহু মেলেনি')
      return
    }
    setLoading(true)
    const res = await complete(newPass)
    setLoading(false)
    if (!res.ok) {
      setError(res.error || 'পাসওয়ার্ড পরিবর্তন করা যায়নি')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-2">
            <KeyRound size={24} />
          </div>
          <h2 className="text-lg font-bold text-gray-800">প্রথম লগইন: পাসওয়ার্ড পরিবর্তন বাধ্যতামূলক</h2>
          <p className="text-xs text-gray-500">
            নিরাপত্তার স্বার্থে সহজ ডিফল্ট পাসওয়ার্ড (123456) পরিবর্তন করে আপনার নিজস্ব গোপন নতুন পাসওয়ার্ড সেট করুন।
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-xs font-semibold text-gray-700">
            নতুন গোপন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)
            <input
              type="password"
              required
              className="input-field mt-1 text-sm"
              placeholder="নতুন পাসওয়ার্ড"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
            />
          </label>

          <label className="block text-xs font-semibold text-gray-700">
            নতুন পাসওয়ার্ড নিশ্চিত করুন
            <input
              type="password"
              required
              className="input-field mt-1 text-sm"
              placeholder="পুনরায় নতুন পাসওয়ার্ড দিন"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
            />
          </label>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full text-sm py-2.5 flex items-center justify-center gap-2"
          >
            {loading ? 'সংরক্ষণ হচ্ছে...' : 'পাসওয়ার্ড সংরক্ষণ করে শুরু করুন'}
          </button>
        </form>

        <button
          type="button"
          onClick={logout}
          className="w-full text-xs text-gray-500 hover:text-red-600 text-center pt-2"
        >
          লগআউট করুন
        </button>
      </div>
    </div>
  )
}
