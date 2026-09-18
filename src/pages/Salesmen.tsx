import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type DbUser } from '../lib/db'
import { useAuthStore, resetStaffPassword, createStaffUser, toggleStaffStatus, unlockStaffUser, normalizeUsername, suggestStaffUsername, type CreateStaffInput } from '../stores/authStore'
import { roleLabel, staffBranchIds } from '../lib/roles'
import {
  AlertCircle,
  CheckCircle2,
  Key,
  Lock,
  MessageCircle,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Unlock,
  Users,
} from 'lucide-react'

/**
 * সেলস ম্যান আইডি ব্যবস্থাপনা (শাখা ব্যবস্থাপকের অংশ) —
 * ব্যবস্থাপক নিজের শাখার সেলস ম্যানের আইডি খোলেন, পাসওয়ার্ড রিসেট/আনলক/চালু-বন্ধ করেন।
 * (ব্যবস্থাপকের নিজের আইডি ও অন্য শাখার আইডি বদলানোর অনুমতি নেই — সেটা শুধু মালিকের)
 */
export default function Salesmen() {
  const user = useAuthStore((s) => s.user)
  const branches = useLiveQuery(() => db.branches.toArray()) || []
  const salesmen = useLiveQuery(
    async () => (await db.users.toArray()).filter((u) => u.role === 'salesman'),
  )

  const myBranches = staffBranchIds(user)
  const myBranchNames = (id: string) => branches.find((b) => b.id === id)?.name || id

  const [newName, setNewName] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newPassword, setNewPassword] = useState('123456')
  const [newBranches, setNewBranches] = useState<string[]>([])
  const [usernameTouched, setUsernameTouched] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error'; username?: string; phone?: string; name?: string; password?: string } | null>(null)

  const [resetting, setResetting] = useState<DbUser | null>(null)
  const [customPassword, setCustomPassword] = useState('123456')
  const [resetMessage, setResetMessage] = useState<{ text: string; type: 'success' | 'error'; username?: string; phone?: string; name?: string; password?: string } | null>(null)

  useEffect(() => {
    if (!usernameTouched && !newUsername && branches.length) {
      suggestStaffUsername(branches.find((b) => b.id === myBranches[0])?.name || '', 'salesman').then(setNewUsername)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches.length])

  if (!user || user.role !== 'manager') {
    return <p className="p-6 text-center text-red-600 font-medium">এই পেজ শুধু শাখা ব্যবস্থাপকের জন্য।</p>
  }

  const mySalesmen = (salesmen || []).filter((u) => staffBranchIds(u).some((b) => myBranches.includes(b)))

  const waUrl = (phone: string, name: string, pass: string, username?: string) => {
    const text = `আসসালামু আলাইকুম ${name},\nShopLedGer-এ আপনার অ্যাকাউন্ট প্রস্তুত:\n\n👤 আইডি (ইউজারনেম): ${username || phone}\n🔑 প্রাথমিক পাসওয়ার্ড: ${pass}\n\n⚠️ প্রথমবার লগইন করার পর অবশ্যই আপনার নিজস্ব নতুন পাসওয়ার্ড সেট করে নিবেন।\nধন্যবাদ!`
    const clean = (phone || '').replace(/\D/g, '').replace(/^88/, '')
    return clean ? `https://wa.me/88${clean}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    const branchIds = newBranches.length ? newBranches : myBranches
    const input: CreateStaffInput = {
      name: newName,
      username: newUsername,
      phone: newPhone || undefined,
      password: newPassword,
      role: 'salesman',
      branch_ids: branchIds,
    }
    const res = await createStaffUser(input)
    if (res.ok) {
      setMessage({
        text: `সেলস ম্যান "${newName}"-এর আইডি খোলা হয়েছে! আইডি: ${normalizeUsername(newUsername)} • পাসওয়ার্ড: ${newPassword} (১ম লগইনে বদলাতে হবে)`,
        type: 'success',
        username: normalizeUsername(newUsername),
        phone: newPhone,
        name: newName,
        password: newPassword,
      })
      setNewName('')
      setNewPhone('')
      setNewPassword('123456')
      setNewBranches([])
      setUsernameTouched(false)
      setNewUsername(await suggestStaffUsername(branches.find((b) => b.id === myBranches[0])?.name || '', 'salesman'))
    } else {
      setMessage({ text: res.error || 'আইডি খোলা যায়নি', type: 'error' })
    }
  }

  async function handleReset(target: DbUser, pass = '123456') {
    setResetMessage(null)
    const res = await resetStaffPassword(target.id, pass)
    if (res.ok) {
      setResetMessage({
        text: `পাসওয়ার্ড রিসেট হয়েছে! নতুন পাসওয়ার্ড: "${pass}" (১ম লগইনে বদলাতে হবে)`,
        type: 'success',
        username: target.username,
        phone: target.phone,
        name: target.name,
        password: pass,
      })
    } else {
      setResetMessage({ text: res.error || 'রিসেট ব্যর্থ', type: 'error' })
    }
  }

  return (
    <div className="pb-24 max-w-3xl mx-auto p-4 space-y-4">
      <div className="border-b pb-3">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Users className="text-teal-700" size={22} /> সেলস ম্যান আইডি ব্যবস্থাপনা
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          আপনার শাখা: {myBranches.map(myBranchNames).join(', ') || '—'} • নিজের শাখার সেলস ম্যানের আইডি খুলুন ও পাসওয়ার্ড দেখাশুনা করুন।
        </p>
      </div>

      {message && (
        <div className={`p-3 rounded-xl border text-sm font-medium space-y-2 ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <div className="flex items-center justify-between gap-2">
            <span>{message.text}</span>
            <button type="button" className="text-xs opacity-70 hover:opacity-100" onClick={() => setMessage(null)}>✕</button>
          </div>
          {message.type === 'success' && (
            <a
              href={waUrl(message.phone || '', message.name || 'সেলস ম্যান', message.password || '123456', message.username)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 bg-green-700 hover:bg-green-800 text-white font-bold py-1.5 px-3 rounded-lg text-xs shadow-sm"
            >
              <MessageCircle size={15} /> হোয়াটসঅ্যাপে আইডি/পাসওয়ার্ড পাঠান
            </a>
          )}
        </div>
      )}

      {/* তালিকা */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-gray-800">আপনার শাখার সেলস ম্যান ({mySalesmen.length}টি আইডি)</h3>
        {mySalesmen.length === 0 ? (
          <div className="py-8 text-center text-gray-500 bg-gray-50 rounded-lg">
            <Users className="mx-auto mb-2 text-gray-400" size={28} />
            <p className="text-sm">এখনো কোনো সেলস ম্যানের আইডি নেই।</p>
            <p className="text-xs text-gray-400 mt-1">নিচের ফর্ম দিয়ে খুলুন।</p>
          </div>
        ) : (
          <div className="divide-y border rounded-lg overflow-hidden bg-white">
            {mySalesmen.map((staff) => {
              const isLocked = !staff.is_active || (staff.failed_login_attempts || 0) >= 5
              return (
                <div key={staff.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{staff.name}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700">সেলস ম্যান</span>
                      {isLocked ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-700 border border-red-200 flex items-center gap-1">
                          <Lock size={12} /> লক
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 flex items-center gap-1">
                          <CheckCircle2 size={12} /> সক্রিয়
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      আইডি: <span className="font-mono text-gray-700">{staff.username || staff.phone}</span>
                      {staff.phone && <> • মোবাইল: <span className="font-mono text-gray-700">{staff.phone}</span></>}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      শাখা: {staffBranchIds(staff).map(myBranchNames).join(', ') || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {isLocked && (
                      <button
                        type="button"
                        className="py-1.5 px-3 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1"
                        onClick={async () => {
                          const r = await unlockStaffUser(staff.id)
                          setMessage({ text: r.ok ? 'আনলক হয়েছে' : r.error || 'আনলক হয়নি', type: r.ok ? 'success' : 'error' })
                        }}
                      >
                        <Unlock size={14} /> আনলক
                      </button>
                    )}
                    <button
                      type="button"
                      className="py-1.5 px-2.5 rounded-lg border text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200 flex items-center gap-1"
                      onClick={() => {
                        setResetting(staff)
                        setCustomPassword('123456')
                        setResetMessage(null)
                      }}
                    >
                      <Key size={14} /> রিসেট
                    </button>
                    {staff.phone && (
                      <a
                        href={waUrl(staff.phone, staff.name, '123456', staff.username)}
                        target="_blank"
                        rel="noreferrer"
                        className="py-1.5 px-2.5 rounded-lg border text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 border-green-200 flex items-center gap-1"
                      >
                        <MessageCircle size={14} /> হোয়াটসঅ্যাপ
                      </a>
                    )}
                    <button
                      type="button"
                      className={`py-1.5 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1 ${
                        staff.is_active ? 'text-red-700 bg-red-50 hover:bg-red-100 border-red-200' : 'text-green-700 bg-green-50 hover:bg-green-100 border-green-200'
                      }`}
                      onClick={async () => {
                        const r = await toggleStaffStatus(staff.id)
                        if (!r.ok) setMessage({ text: r.error || 'বদলানো যায়নি', type: 'error' })
                      }}
                      title={staff.is_active ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন'}
                    >
                      {staff.is_active ? <Lock size={14} /> : <Unlock size={14} />}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* পাসওয়ার্ড রিসেট */}
      {resetting && (
        <div className="card border-2 border-amber-300 bg-amber-50/40 space-y-3">
          <div className="flex items-center justify-between border-b border-amber-200 pb-2">
            <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <Key size={16} className="text-amber-700" /> "{resetting.name}" ({resetting.username || resetting.phone})-এর রিসেট
            </h4>
            <button type="button" onClick={() => setResetting(null)} className="text-xs text-gray-500 hover:text-gray-800">
              বন্ধ করুন ✕
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-secondary py-1.5 px-3 text-xs bg-white text-gray-800 font-semibold flex items-center gap-1.5"
              onClick={() => handleReset(resetting, '123456')}
            >
              <RotateCcw size={14} className="text-amber-600" /> ডিফল্ট "123456" দিন
            </button>
            <div className="flex gap-2 flex-1 min-w-[220px]">
              <input
                type="text"
                className="input-field text-sm bg-white"
                placeholder="অথবা নিজের পাসওয়ার্ড"
                value={customPassword}
                onChange={(e) => setCustomPassword(e.target.value)}
              />
              <button type="button" className="btn-primary py-2 px-4 text-xs shrink-0" onClick={() => handleReset(resetting, customPassword)}>
                সেট করুন
              </button>
            </div>
          </div>
          {resetMessage && (
            <div className={`p-3 rounded-xl border text-xs font-semibold space-y-2 ${resetMessage.type === 'success' ? 'bg-green-100 text-green-900 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}`}>
              <p>{resetMessage.text}</p>
              {resetMessage.type === 'success' && (
                <a
                  href={waUrl(resetMessage.phone || '', resetMessage.name || 'সেলস ম্যান', resetMessage.password || '123456', resetMessage.username)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 bg-green-700 hover:bg-green-800 text-white font-bold py-1.5 px-3 rounded-lg text-xs shadow-sm"
                >
                  <MessageCircle size={15} /> হোয়াটসঅ্যাপে পাঠান
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* নতুন সেলস ম্যান আইডি */}
      <form className="card space-y-4" onSubmit={handleCreate}>
        <div className="border-b pb-2 flex items-center gap-2">
          <Plus className="text-teal-700" size={18} />
          <h3 className="font-semibold text-gray-800 text-sm">নতুন সেলস ম্যানের আইডি খুলুন</h3>
        </div>

        <div className="p-3 rounded-xl border-2 border-blue-200 bg-blue-50 text-left">
          <div className="flex items-center gap-2 font-semibold text-sm text-gray-800">
            <ShoppingBag size={16} className="text-blue-700" /> সেলস ম্যান
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            বিক্রি, ক্রেতা, বাকি আদায় ও অর্ডার পারবে; স্টক দেখতে পারবে; ক্রয়/খরচ/লাভ দেখতে পারবে না। (আপনি নিজে{' '}
            <ShieldCheck size={12} className="inline text-indigo-600" /> শাখা ব্যবস্থাপক — {roleLabel('manager')})
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-700">নাম *</span>
            <input required className="input-field mt-1 text-sm" placeholder="যেমন: কামাল হোসেন" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-700">ইউজারনেম (আইডি) *</span>
            <input
              required
              className="input-field mt-1 text-sm font-mono"
              placeholder="যেমন: aghrabad_salesman"
              value={newUsername}
              onChange={(e) => {
                setUsernameTouched(true)
                setNewUsername(e.target.value)
              }}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-700">মোবাইল (ঐচ্ছিক)</span>
            <input className="input-field mt-1 text-sm" placeholder="017XXXXXXXX" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-700">প্রাথমিক পাসওয়ার্ড *</span>
            <input required className="input-field mt-1 text-sm font-mono" placeholder="ডিফল্ট: 123456" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </label>
        </div>

        <div>
          <span className="text-xs font-medium text-gray-700">শাখা (আপনার শাখাগুলোর মধ্যে)</span>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {branches
              .filter((b) => myBranches.includes(b.id))
              .map((b) => {
                const checked = newBranches.includes(b.id)
                return (
                  <label
                    key={b.id}
                    className={`py-1.5 px-3 rounded-lg border text-xs cursor-pointer ${checked ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-gray-600 border-gray-200'}`}
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={checked}
                      onChange={(e) => setNewBranches((prev) => (e.target.checked ? [...prev, b.id] : prev.filter((x) => x !== b.id)))}
                    />
                    {b.name || 'নামহীন শাখা'}
                  </label>
                )
              })}
          </div>
          {!newBranches.length && <p className="text-[11px] text-gray-400 mt-1">কিছু না বেছে দিলে আপনার প্রথম শাখায় খোলা হবে।</p>}
        </div>

        <button type="submit" className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5">
          <Plus size={14} /> আইডি খুলুন
        </button>

        <p className="text-[11px] text-gray-400 flex items-center gap-1">
          <AlertCircle size={12} /> মালিক চাইলে এই আইডির নাম/শাখা বদলে দিতে বা মুছে ফেলতে পারবেন (শাখা ও ব্যবস্থাপক পেজ থেকে)।
        </p>
      </form>
    </div>
  )
}
