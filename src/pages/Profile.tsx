import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type DbCustomer } from '../lib/db'
import { linkCustomerForUser } from '../lib/customerLink'
import { ledgerRows } from '../lib/ledger'
import { useAuthStore } from '../stores/authStore'
import { useCustomerStore } from '../stores/customerStore'
import { useSalesStore } from '../stores/salesStore'
import { bnMoney, r2 } from '../lib/reports/core'
import { Check, Eye, EyeOff, KeyRound, Loader2, LogOut, MapPin, Phone, User } from 'lucide-react'

const ROLE_LABEL = { owner: 'মালিক', manager: 'শাখা ব্যবস্থাপক', salesman: 'সেলস ম্যান', staff: 'কর্মচারী', customer: 'ক্রেতা' } as const

/** নিজের প্রোফাইল — নাম/ফোন/ঠিকানা সম্পাদনা ও পাসওয়ার্ড পরিবর্তন (সব রোলের জন্য) */
export default function Profile() {
  const user = useAuthStore((s) => s.user)
  const updateProfile = useAuthStore((s) => s.updateProfile)
  const changePassword = useAuthStore((s) => s.changePassword)
  const logout = useAuthStore((s) => s.logout)
  const updateCustomer = useCustomerStore((s) => s.updateCustomer)
  const sales = useSalesStore((s) => s.sales)
  const navigate = useNavigate()

  const ledger = useLiveQuery(
    async () => ({ entries: await db.ledgerEntries.toArray(), collections: await db.collections.toArray() }),
    [],
  )

  const [me, setMe] = useState<DbCustomer | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', address: '' })
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwMsg, setPwMsg] = useState('')
  const [pwError, setPwError] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwBusy, setPwBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    setForm({ name: user.name, phone: user.phone, address: '' })
    if (user.role === 'customer') {
      linkCustomerForUser(user).then((c) => {
        setMe(c)
        setForm({ name: c.name, phone: c.phone || user.phone, address: c.address || '' })
      })
    }
  }, [user])

  const due = me ? (() => {
    const rows = ledgerRows(me.id, sales, [], ledger?.entries || [], ledger?.collections || [])
    return rows[rows.length - 1]?.balance || 0
  })() : 0

  if (!user) return null

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaved('')
    setError('')
    setBusy(true)
    try {
      const result = await updateProfile({ name: form.name, phone: form.phone, address: form.address })
      if (!result.ok) {
        setError(result.error || 'সংরক্ষণ হয়নি')
        return
      }
      // ক্রেতার রেকর্ডেও হালনাগাদ (যাতে দোকানের তালিকা/লেজার মিলে থাকে)
      if (user!.role === 'customer' && me) {
        await updateCustomer(me.id, {
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          address: form.address.trim() || undefined,
        })
      }
      setSaved('তথ্য সংরক্ষিত হয়েছে।')
    } finally {
      setBusy(false)
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwMsg('')
    setPwError('')
    if (pw.next !== pw.confirm) {
      setPwError('নতুন পাসওয়ার্ড দুইবার একই লিখুন')
      return
    }
    setPwBusy(true)
    try {
      const result = await changePassword(pw.current, pw.next)
      if (!result.ok) {
        setPwError(result.error || 'পাসওয়ার্ড বদলানো হয়নি')
        return
      }
      setPw({ current: '', next: '', confirm: '' })
      setPwMsg('পাসওয়ার্ড পরিবর্তন হয়েছে।')
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <div className="pb-28">
      <div className="bg-gradient-to-r from-teal-700 to-emerald-700 text-white px-4 pt-4 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center text-xl font-bold">
            {user.name.trim().charAt(0)}
          </div>
          <div>
            <h1 className="text-base font-bold">প্রোফাইল</h1>
            <p className="text-sm font-semibold">{user.name}</p>
            <p className="text-teal-100 text-xs">
              {ROLE_LABEL[user.role]} • {user.phone}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3 space-y-4">
        {user.role === 'customer' && (
          <div className="card bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">আপনার বর্তমান বাকি</p>
              <p className="text-xl font-bold text-orange-600">{bnMoney(r2(due))}</p>
            </div>
            <Link to="/my-dues" className="text-xs text-teal-700 underline">
              বাকির হিসাব →
            </Link>
          </div>
        )}

        {/* তথ্য সম্পাদনা */}
        <form className="card space-y-3" onSubmit={save}>
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <User size={16} className="text-teal-600" /> আমার তথ্য
          </h2>
          <label className="block text-xs text-gray-600">
            নাম
            <input required className="input-field" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </label>
          <label className="block text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <Phone size={12} /> মোবাইল নম্বর (এটি দিয়েই লগইন করবেন)
            </span>
            <input
              required
              type="tel"
              inputMode="numeric"
              className="input-field"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
            />
          </label>
          <label className="block text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <MapPin size={12} /> ঠিকানা
            </span>
            <input
              className="input-field"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="ঐচ্ছিক"
            />
          </label>
          {error && <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">{error}</p>}
          {saved && (
            <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg p-2 flex items-center gap-1">
              <Check size={14} /> {saved}
            </p>
          )}
          <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" disabled={busy}>
            {busy && <Loader2 className="animate-spin" size={16} />} সংরক্ষণ করুন
          </button>
        </form>

        {/* পাসওয়ার্ড */}
        <form className="card space-y-3" onSubmit={savePassword}>
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <KeyRound size={16} className="text-teal-600" /> পাসওয়ার্ড পরিবর্তন
          </h2>
          {(['current', 'next', 'confirm'] as const).map((key) => (
            <label key={key} className="block text-xs text-gray-600">
              {key === 'current' ? 'বর্তমান পাসওয়ার্ড' : key === 'next' ? 'নতুন পাসওয়ার্ড (অন্তত ৬ অক্ষর)' : 'নতুন পাসওয়ার্ড আবার'}
              <div className="relative">
                <input
                  required
                  type={showPw ? 'text' : 'password'}
                  className="input-field pr-10"
                  value={pw[key]}
                  onChange={(e) => setPw((p) => ({ ...p, [key]: e.target.value }))}
                />
                {key === 'current' && (
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label="পাসওয়ার্ড দেখান"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                )}
              </div>
            </label>
          ))}
          {pwError && <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">{pwError}</p>}
          {pwMsg && (
            <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg p-2 flex items-center gap-1">
              <Check size={14} /> {pwMsg}
            </p>
          )}
          <button type="submit" className="btn-secondary w-full flex items-center justify-center gap-2" disabled={pwBusy}>
            {pwBusy && <Loader2 className="animate-spin" size={16} />} পাসওয়ার্ড বদলান
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            logout()
            navigate('/login')
          }}
          className="card w-full flex items-center justify-center gap-2 text-sm text-red-600"
        >
          <LogOut size={16} /> লগআউট
        </button>
      </div>
    </div>
  )
}
