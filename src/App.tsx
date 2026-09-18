import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Sales from './pages/Sales'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
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
          <Route path="purchases" element={<ComingSoon title="ক্রয় এন্ট্রি" />} />
          <Route path="collections" element={<ComingSoon title="বাকি আদায়" />} />
          <Route path="stock" element={<ComingSoon title="স্টক" />} />
          <Route path="customers" element={<ComingSoon title="ক্রেতা" />} />
          <Route path="orders" element={<ComingSoon title="অর্ডার" />} />
          <Route path="my-dues" element={<ComingSoon title="আমার বাকি" />} />
          <Route path="more" element={<ComingSoon title="আরও অপশন" />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="card max-w-sm w-full">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">{title}</h2>
        <p className="text-sm text-gray-500">এই অংশটি শীঘ্রই আসছে...</p>
      </div>
    </div>
  )
}

export default App
