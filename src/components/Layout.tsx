import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Settings,
  LogOut,
  ClipboardList,
  Wallet,
} from 'lucide-react'

export default function Layout() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Navigation items based on role
  const navItems = (() => {
    if (user?.role === 'customer') {
      return [
        { to: '/', icon: LayoutDashboard, label: 'হোম' },
        { to: '/orders', icon: ClipboardList, label: 'অর্ডার' },
        { to: '/my-dues', icon: Wallet, label: 'বাকি' },
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
      {/* Top Header */}
      <header className="bg-primary-700 text-white px-4 py-3 sticky top-0 z-20 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg leading-tight">ShopLedGer</h1>
            <p className="text-primary-100 text-xs">
              {user?.name} • {user?.role === 'owner' ? 'মালিক' : user?.role === 'staff' ? 'কর্মচারী' : 'ক্রেতা'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-primary-600 transition-colors"
            title="লগআউট"
          >
            <LogOut size={20} />
          </button>
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
