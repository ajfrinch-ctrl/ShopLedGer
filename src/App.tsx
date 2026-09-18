import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Sales from './pages/Sales'
import Purchases from './pages/Purchases'
import Stock from './pages/Stock'
import Collections from './pages/Collections'
import BranchPads from './pages/BranchPads'
import ProfitLoss from './pages/ProfitLoss'
import Expenses from './pages/Expenses'
import Customers from './pages/Customers'
import More from './pages/More'
import Orders from './pages/Orders'
import MyDues from './pages/MyDues'
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

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="sales" element={<Sales />} />
          <Route path="purchases" element={<Purchases />} />
          <Route path="collections" element={<Collections />} />
          <Route path="stock" element={<Stock />} />
          <Route path="profit-loss" element={<ProfitLoss />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="customers" element={<Customers />} />
          <Route path="orders" element={<Orders />} />
          <Route path="my-dues" element={<MyDues />} />
          <Route path="more" element={<More />} />
          <Route path="branch-pads" element={<BranchPads />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}


export default App
