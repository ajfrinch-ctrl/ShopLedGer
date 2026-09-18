import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { CheckCircle2, Loader2, Lock, MapPin, Phone, User } from 'lucide-react'

/**
 * ক্রেতার নিজে সাইন-আপ (PRD মডিউল #১ — Registration)।
 * অ্যাকাউন্ট তৈরি হয় সাথে সাথে, কিন্তু অ্যাকাউন্ট নিষ্ক্রিয় থাকে —
 * দোকান (মালিক) অনুমোদন দিলে তবেই লগইন করা যাবে।
 */
export default function Register() {
  const navigate = useNavigate()
  const register = useAuthStore((s) => s.register)

  const [form, setForm] = useState({ name: '', phone: '', address: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) {
      setError('দুইবার লেখা পাসওয়ার্ড মিলছে না')
      return
    }
    setBusy(true)
    try {
      const result = await register({
        name: form.name,
        phone: form.phone,
        password: form.password,
        address: form.address,
      })
      if (!result.ok) {
        setError(result.error || 'সাইন-আপ হয়নি')
        return
      }
      setDone(true)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-600 via-emerald-600 to-cyan-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
          <CheckCircle2 className="mx-auto text-green-600" size={48} />
          <h2 className="text-xl font-bold text-gray-800">অ্যাকাউন্ট তৈরি হয়েছে</h2>
          <p className="text-sm text-gray-600">
            আপনার নম্বর: <span className="font-semibold">{form.phone}</span>
            <br />
            এখন দোকান অনুমোদন দিলে আপনি লগইন করতে পারবেন। অনুমোদনের পর জানিয়ে দেওয়া হবে।
          </p>
          <button type="button" className="btn-primary w-full" onClick={() => navigate('/login')}>
            লগইন পেজে যান
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-600 via-emerald-600 to-cyan-600 flex flex-col items-center justify-center p-4">
      <div className="mb-5 text-center">
        <div className="mx-auto w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center mb-2">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="ShopLedGer" className="w-11 h-11 object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-white">ShopLedGer</h1>
        <p className="text-teal-100 text-xs">ক্রেতা হিসেবে নতুন অ্যাকাউন্ট</p>
      </div>

      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-800">সাইন-আপ করুন</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            অ্যাকাউন্ট তৈরি হলে দোকান অনুমোদন দেবে, তারপর লগইন করা যাবে
          </p>
        </div>

        {error && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">{error}</p>
        )}

        <form className="space-y-3" onSubmit={submit}>
          <label className="block text-xs font-semibold text-gray-600">
            আপনার নাম <span className="text-red-500">*</span>
            <div className="relative mt-1">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                required
                className="input-field pl-9"
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="যেমন: করিম উদ্দিন"
              />
            </div>
          </label>

          <label className="block text-xs font-semibold text-gray-600">
            মোবাইল নম্বর <span className="text-red-500">*</span>
            <div className="relative mt-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                required
                type="tel"
                inputMode="numeric"
                className="input-field pl-9"
                value={form.phone}
                onChange={(e) => set({ phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                placeholder="01XXXXXXXXX"
              />
            </div>
          </label>

          <label className="block text-xs font-semibold text-gray-600">
            ঠিকানা (ঐচ্ছিক)
            <div className="relative mt-1">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                className="input-field pl-9"
                value={form.address}
                onChange={(e) => set({ address: e.target.value })}
                placeholder="গ্রাম/বাজার"
              />
            </div>
          </label>

          <label className="block text-xs font-semibold text-gray-600">
            পাসওয়ার্ড (অন্তত ৬ অক্ষর) <span className="text-red-500">*</span>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                required
                type="password"
                className="input-field pl-9"
                value={form.password}
                onChange={(e) => set({ password: e.target.value })}
                placeholder="পাসওয়ার্ড"
              />
            </div>
          </label>

          <label className="block text-xs font-semibold text-gray-600">
            পাসওয়ার্ড আবার লিখুন <span className="text-red-500">*</span>
            <input
              required
              type="password"
              className="input-field mt-1"
              value={form.confirm}
              onChange={(e) => set({ confirm: e.target.value })}
              placeholder="একই পাসওয়ার্ড"
            />
          </label>

          <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" disabled={busy}>
            {busy && <Loader2 className="animate-spin" size={16} />}
            অ্যাকাউন্ট তৈরি করুন
          </button>
        </form>

        <p className="text-xs text-center text-gray-500">
          আগে থেকেই অ্যাকাউন্ট আছে?{' '}
          <Link to="/login" className="text-teal-700 font-semibold underline">
            লগইন করুন
          </Link>
        </p>
      </div>
    </div>
  )
}
