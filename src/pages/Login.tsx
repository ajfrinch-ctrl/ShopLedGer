import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import type { UserRole } from '../types'

const ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: 'owner', label: 'মালিক', description: 'সব কিছু নিয়ন্ত্রণ করতে পারবেন' },
  { value: 'staff', label: 'কর্মচারী', description: 'বিক্রি, ক্রয়, আদায় করতে পারবেন' },
  { value: 'customer', label: 'ক্রেতা', description: 'বাকি দেখা ও অর্ডার দিতে পারবেন' },
]

export default function Login() {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<UserRole>('staff')
  const [error, setError] = useState('')
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!phone || phone.length < 11) {
      setError('সঠিক মোবাইল নম্বর দিন (১১ ডিজিট)')
      return
    }

    login(phone, role, name || undefined)
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-700 to-primary-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary-700">ShopLedGer</h1>
          <p className="text-gray-500 text-sm mt-1">দোকান হিসাব ব্যবস্থা</p>
        </div>

        {/* Demo Credentials */}
        <div className="bg-primary-50 border border-primary-100 rounded-lg p-3 text-sm">
          <p className="font-medium text-primary-800 mb-1">ডেমো অ্যাকাউন্ট:</p>
          <ul className="text-primary-700 space-y-0.5 text-xs">
            <li>মালিক: <strong>01700000000</strong></li>
            <li>কর্মচারী: <strong>01800000000</strong></li>
            <li>ক্রেতা: <strong>01900000000</strong></li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">রোল নির্বাচন করুন</label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    role === r.value
                      ? 'border-primary-600 bg-primary-50 text-primary-700 ring-2 ring-primary-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-sm">{r.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Name (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">নাম (ঐচ্ছিক)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="আপনার নাম"
              className="input-field"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">মোবাইল নম্বর</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="01XXXXXXXXX"
              className="input-field"
              required
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm text-center">{error}</p>
          )}

          <button type="submit" className="btn-primary w-full py-3 text-base">
            প্রবেশ করুন
          </button>
        </form>

        <p className="text-center text-xs text-gray-400">
          অফলাইন মোডেও কাজ করবে • ডাটা লোকাল সেভ হয়
        </p>
      </div>
    </div>
  )
}
