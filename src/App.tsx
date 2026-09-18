import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import type { UserRole } from './types'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Sales from './pages/Sales'
import Purchases from './pages/Purchases'
import Stock from './pages/Stock'
import Collections from './pages/Collections'
import BranchPads from './pages/BranchPads'
import ProfitLoss from './pages/ProfitLoss'
import Reports from './pages/Reports'
import Expenses from './pages/Expenses'
import Customers from './pages/Customers'
import More from './pages/More'
import Orders from './pages/Orders'
import MyDues from './pages/MyDues'
import Profile from './pages/Profile'
import CustomerProfile from './pages/CustomerProfile'
import { Loader2 } from 'lucide-react'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isLoading = useAuthStore((s) => s.isLoading)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-teal-600 mx-auto mb-3" size={32} />
          <p className="text-sm text-gray-500">লোড হচ্ছে...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

/** রোল-ভিত্তিক রাউট গার্ড — অনুমতি না থাকলে হোমে ফেরত পাঠায় */
function RoleRoute({
  roles,
  children,
}: {
  roles: UserRole[]
  children: React.ReactNode
}) {
  const user = useAuthStore((s) => s.user)
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

// Vite injects BASE_URL from `base` in vite.config (defaults to `/`).
// GitHub Pages builds with BASE_PATH=/ShopLedGer/ → basename `/ShopLedGer`.
// Vercel / local: leave BASE_PATH unset so basename is empty (root `/`).
const routerBasename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')

function App() {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <BrowserRouter basename={routerBasename || undefined}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="sales" element={<RoleRoute roles={['owner', 'staff']}><Sales /></RoleRoute>} />
          <Route path="purchases" element={<RoleRoute roles={['owner', 'staff']}><Purchases /></RoleRoute>} />
          <Route path="collections" element={<RoleRoute roles={['owner', 'staff']}><Collections /></RoleRoute>} />
          <Route path="stock" element={<RoleRoute roles={['owner', 'staff']}><Stock /></RoleRoute>} />
          <Route path="profit-loss" element={<RoleRoute roles={['owner', 'staff']}><ProfitLoss /></RoleRoute>} />
          <Route path="reports" element={<RoleRoute roles={['owner', 'staff']}><Reports /></RoleRoute>} />
          {/* প্রতিটি রিপোর্টের নিজস্ব লিংক — /reports/sales, /reports/stock ইত্যাদি */}
          <Route path="reports/:kind" element={<RoleRoute roles={['owner', 'staff']}><Reports /></RoleRoute>} />
          <Route path="expenses" element={<RoleRoute roles={['owner', 'staff']}><Expenses /></RoleRoute>} />
          <Route path="customers" element={<RoleRoute roles={['owner', 'staff']}><Customers /></RoleRoute>} />
          <Route path="customers/:id" element={<RoleRoute roles={['owner', 'staff']}><CustomerProfile /></RoleRoute>} />
          <Route path="orders" element={<Orders />} />
          <Route path="my-dues" element={<RoleRoute roles={['customer']}><MyDues /></RoleRoute>} />
          <Route path="more" element={<More />} />
          <Route path="profile" element={<Profile />} />
          <Route path="branch-pads" element={<RoleRoute roles={['owner']}><BranchPads /></RoleRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}


export default App
