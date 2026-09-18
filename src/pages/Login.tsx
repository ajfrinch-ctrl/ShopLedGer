import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { Eye, EyeOff, Phone, Lock, Loader2 } from 'lucide-react'

export default function Login() {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { login, error, clearError, isAuthenticated, isLoading } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, isLoading, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()

    if (!phone || phone.length < 11) {
      return
    }
    if (!password || password.length < 4) {
      return
    }

    setIsSubmitting(true)
    const success = await login(phone, password)
    setIsSubmitting(false)

    if (success) {
      navigate('/', { replace: true })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-600 via-emerald-600 to-cyan-600 flex items-center justify-center">
        <Loader2 className="animate-spin text-white" size={40} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-600 via-emerald-600 to-cyan-600 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute top-[-80px] right-[-80px] w-[200px] h-[200px] bg-white/10 rounded-full" />
      <div className="absolute bottom-[-60px] left-[-60px] w-[160px] h-[160px] bg-white/10 rounded-full" />
      <div className="absolute top-[30%] left-[-40px] w-[80px] h-[80px] bg-white/5 rounded-full" />
      <div className="absolute bottom-[20%] right-[-30px] w-[100px] h-[100px] bg-white/5 rounded-full" />

      {/* Logo & Brand */}
      <div className="mb-6 text-center relative z-10">
        <div className="mx-auto w-20 h-20 bg-white rounded-2xl shadow-xl flex items-center justify-center mb-3 transform rotate-[-2deg] hover:rotate-0 transition-transform duration-300">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="ShopLedGer" className="w-14 h-14 object-contain" />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-wide drop-shadow-lg">
          ShopLedGer
        </h1>
        <p className="text-teal-100 text-sm mt-1 font-medium">
          দোকান হিসাব ব্যবস্থা
        </p>
      </div>

      {/* Login Card */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 relative z-10">
        <div className="text-center mb-5">
          <h2 className="text-xl font-bold text-gray-800">লগইন করুন</h2>
          <p className="text-sm text-gray-500 mt-1">আপনার অ্যাকাউন্টে প্রবেশ করুন</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Phone */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              মোবাইল নম্বর
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-teal-500">
                <Phone size={18} />
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))
                  clearError()
                }}
                placeholder="01XXXXXXXXX"
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition-all text-base"
                required
                autoComplete="tel"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              পাসওয়ার্ড
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-teal-500">
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  clearError()
                }}
                placeholder="পাসওয়ার্ড লিখুন"
                className="w-full pl-10 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition-all text-base"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-teal-600 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2.5 text-center">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || !phone || password.length < 4}
            className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-base transition-all active:scale-[0.98] shadow-lg shadow-teal-500/30 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                প্রবেশ হচ্ছে...
              </>
            ) : (
              'প্রবেশ করুন'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="my-5 flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 font-medium">ডেমো অ্যাকাউন্ট</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Demo Accounts */}
        <div className="space-y-2">
          <DemoButton
            label="মালিক"
            phone="01700000000"
            color="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
            onSelect={(p) => {
              setPhone(p)
              setPassword('123456')
              clearError()
            }}
          />
          <DemoButton
            label="কর্মচারী"
            phone="01800000000"
            color="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
            onSelect={(p) => {
              setPhone(p)
              setPassword('123456')
              clearError()
            }}
          />
          <DemoButton
            label="ক্রেতা"
            phone="01900000000"
            color="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
            onSelect={(p) => {
              setPhone(p)
              setPassword('123456')
              clearError()
            }}
          />
        </div>
      </div>

      {/* ক্রেতার সাইন-আপ */}
      <div className="mt-4 w-full max-w-sm relative z-10">
        <Link
          to="/register"
          className="block text-center bg-white/15 hover:bg-white/25 transition-colors text-white text-sm font-medium py-2.5 rounded-xl"
        >
          নতুন ক্রেতা? সাইন-আপ করুন
        </Link>
      </div>

      {/* Footer */}
      <p className="text-teal-100 text-xs mt-6 relative z-10">
        অফলাইনেও কাজ করে • ডাটা আপনার ডিভাইসে সেভ হয়
      </p>
    </div>
  )
}

function DemoButton({
  label,
  phone,
  color,
  onSelect,
}: {
  label: string
  phone: string
  color: string
  onSelect: (phone: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(phone)}
      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${color}`}
    >
      <span>{label}</span>
      <span className="font-mono text-xs opacity-80">{phone}</span>
    </button>
  )
}
