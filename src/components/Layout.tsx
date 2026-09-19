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
  Store,
  Menu,
  X,
} from 'lucide-react'

export default function Layout() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const data = useLiveQuery(async () => ({ branches: await db.branches.toArray() }))
  const myBranches = staffBranchIds(user)
  const multiBranchStaff = myBranches.length > 1
  const staffBranchId = useUiStore((st) => st.staffBranchId)
  const setStaffBranchId = useUiStore((st) => st.setStaffBranchId)
  const activeBranch = myBranches.includes(staffBranchId) ? staffBranchId : myBranches[0] || ''
  const isCustomer = user?.role === 'customer'

  const navItems = (() => {
    if (user?.role === 'customer') {
      return [
        { to: '/', icon: LayoutDashboard, label: 'হোম' },
        { to: '/orders', icon: ClipboardList, label: 'অর্ডার' },
        { to: '/my-dues', icon: Wallet, label: 'বাকি' },
        { to: '/profile', icon: UserCircle2, label: 'প্রোফাইল' },
      ]
    }
    return [
      { to: '/', icon: LayoutDashboard, label: 'হোম' },
      { to: '/sales', icon: ShoppingCart, label: 'বিক্রি' },
      { to: '/stock', icon: Package, label: 'স্টক' },
      { to: '/collections', icon: Wallet, label: 'বাকি' },
      { to: '/more', icon: Settings, label: 'আরও' },
    ]
  })()

  return (
    <div className="min-h-screen bg-[#f8faf9] flex flex-col">
      {user?.must_change_password && <FirstLoginPasswordModal />}

      {/* New Header - Mint Gradient */}
      <header className="sticky top-0 z-20 bg-gradient-to-b from-white via-white to-[#eefaf6] border-b border-[#e6f0ec]/80 backdrop-blur-xl">
        <div className="max-w-[480px] mx-auto px-4 py-3.5 flex items-center justify-between">
          {/* Left: Logo + App Name */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-[12px] bg-[#04795a] flex items-center justify-center shadow-[0_4px_14px_rgba(4,121,90,0.28)] shrink-0">
              <Store size={20} className="text-white" strokeWidth={2.2} />
            </div>
            <div className="leading-tight min-w-0">
              <h1 className="font-bold text-[15px] tracking-tight text-gray-900 truncate">কর্ণফুলী সেলস সেন্টার</h1>
              <p className="text-[11px] text-gray-500 font-medium -mt-0.5 truncate">
                {isCustomer ? 'ক্রেতা প্যানেল' : 'গবাদি পশুর খাদ্য সরবরাহ'}
              </p>
            </div>
          </div>

          {/* Right: Status Pill + Menu */}
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-1.5 bg-[#e6f5ee] pl-2.5 pr-3 py-1.5 rounded-full border border-[#d1ebe2]">
              <span className="w-2 h-2 rounded-full bg-[#04795a] animate-pulse shadow-[0_0_0_3px_rgba(4,121,90,0.15)]"></span>
              <span className="text-[11px] font-semibold text-[#04795a] tracking-wide">অনলাইন</span>
            </div>
            {/* Mobile status dot only */}
            <div className="sm:hidden w-7 h-7 rounded-full bg-[#e6f5ee] border border-[#d1ebe2] flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-[#04795a] animate-pulse"></span>
            </div>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-9 h-9 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all active:scale-95"
              aria-label="মেনু"
            >
              {menuOpen ? <X size={18} className="text-gray-700" /> : <Menu size={18} className="text-gray-700" />}
            </button>
          </div>
        </div>

        {/* Multi Branch Selector - soft pill */}
        {multiBranchStaff && (
          <div className="max-w-[480px] mx-auto px-4 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500 font-medium">শাখা:</span>
              <select
                aria-label="কাজের শাখা"
                className="bg-white border border-gray-200 rounded-full text-[12px] font-medium text-gray-700 px-3 py-1.5 pr-7 max-w-[180px] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#04795a]/20 focus:border-[#04795a]/30"
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
              {!isCustomer && (
                <span className="text-[10px] text-gray-400">
                  {user?.name} • {roleLabel(user?.role)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Dropdown Menu */}
        {menuOpen && (
          <div className="max-w-[480px] mx-auto px-4 pb-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="bg-white rounded-[16px] border border-gray-100 shadow-[0_8px_32px_rgba(0,0,0,0.08)] p-2">
              <div className="px-3 py-2.5 border-b border-gray-50 mb-1">
                <p className="text-[13px] font-semibold text-gray-900">{user?.name}</p>
                <p className="text-[11px] text-gray-500">{roleLabel(user?.role)} • {user?.phone || user?.username || ''}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-[13px] font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={16} /> লগআউট
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content - constrained to mobile width but centered */}
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-[480px] mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Bottom Navigation - Soft Finance Style */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-t border-gray-100 shadow-[0_-4px_24px_rgba(0,0,0,0.04)] safe-bottom">
        <div className="max-w-[480px] mx-auto flex justify-around items-center h-[68px] px-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 h-full gap-1 rounded-[14px] mx-0.5 transition-all duration-200 ${
                  isActive ? 'text-[#04795a]' : 'text-gray-400 hover:text-gray-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`w-7 h-7 flex items-center justify-center rounded-[10px] transition-all ${
                      isActive ? 'bg-[#e6f5ee]' : 'bg-transparent'
                    }`}
                  >
                    <item.icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
                  </div>
                  <span className={`text-[10px] leading-none tracking-wide ${isActive ? 'font-semibold' : 'font-medium'}`}>
                    {item.label}
                  </span>
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
      <div className="bg-white rounded-[20px] max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-[12px] flex items-center justify-center mx-auto mb-2">
            <KeyRound size={24} />
          </div>
          <h2 className="text-[16px] font-bold text-gray-800">প্রথম লগইন: পাসওয়ার্ড পরিবর্তন বাধ্যতামূলক</h2>
          <p className="text-[12px] text-gray-500 leading-relaxed">
            নিরাপত্তার স্বার্থে সহজ ডিফল্ট পাসওয়ার্ড (123456) পরিবর্তন করে আপনার নিজস্ব গোপন নতুন পাসওয়ার্ড সেট করুন।
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-[12px] font-semibold text-gray-700">
            নতুন গোপন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)
            <input
              type="password"
              required
              className="input-field mt-1.5 text-[13px] rounded-[12px]"
              placeholder="নতুন পাসওয়ার্ড"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
            />
          </label>

          <label className="block text-[12px] font-semibold text-gray-700">
            নতুন পাসওয়ার্ড নিশ্চিত করুন
            <input
              type="password"
              required
              className="input-field mt-1.5 text-[13px] rounded-[12px]"
              placeholder="পুনরায় নতুন পাসওয়ার্ড দিন"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
            />
          </label>

          {error && (
            <p className="text-[11px] text-red-600 bg-red-50 p-2.5 rounded-[10px] border border-red-100">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full text-[13px] py-2.5 rounded-[12px] flex items-center justify-center gap-2"
          >
            {loading ? 'সংরক্ষণ হচ্ছে...' : 'পাসওয়ার্ড সংরক্ষণ করে শুরু করুন'}
          </button>
        </form>

        <button
          type="button"
          onClick={logout}
          className="w-full text-[11px] text-gray-500 hover:text-red-600 text-center pt-1"
        >
          লগআউট করুন
        </button>
      </div>
    </div>
  )
}
