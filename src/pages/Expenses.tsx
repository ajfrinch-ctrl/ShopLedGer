import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db, type DbExpense } from '../lib/db'
import { nextExpenseId } from '../lib/idGenerator'
import { useAuthStore } from '../stores/authStore'
import { useActiveBranchId } from '../stores/uiStore'
import { toDateKey } from '../lib/profitLoss'
import { bnDate } from '../lib/reports/core'
import { CheckCircle, Plus, Trash2, Receipt, User, Store, TrendingUp } from 'lucide-react'

const DEFAULT_CATEGORIES = ['ভাড়া', 'বিদ্যুৎ', 'বেতন', 'পরিবহন', 'খাওয়া', 'মোবাইল/ইন্টারনেট', 'মেরামত', 'অন্যান্য']
const OWNER_CATEGORIES = ['সংসার খরচ', 'ব্যক্তিগত', 'অন্যান্য']
const CUSTOM_CATS_KEY = 'shopledger-expense-categories'
const bn = (n: number) => n.toLocaleString('bn-BD')

function loadCustomCats(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_CATS_KEY) || '[]')
  } catch {
    return []
  }
}

export default function Expenses() {
  const user = useAuthStore((s) => s.user)
  const activeBranch = useActiveBranchId()
  const allQuery = useLiveQuery(() => db.expenses.orderBy('date').reverse().toArray(), [])
  const all = useMemo(() => allQuery ?? [], [allQuery])

  const [kind, setKind] = useState<'shop' | 'owner'>('shop')
  const [date, setDate] = useState(toDateKey(new Date()))
  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0])
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('নগদ')
  const [note, setNote] = useState('')
  const [customCats, setCustomCats] = useState<string[]>(loadCustomCats)
  const [newCat, setNewCat] = useState('')
  const [showNewCat, setShowNewCat] = useState(false)
  const [toast, setToast] = useState('')
  const [filter, setFilter] = useState<'today' | 'month' | 'all'>('month')

  const categories = kind === 'shop' ? [...DEFAULT_CATEGORIES, ...customCats] : OWNER_CATEGORIES

  const switchKind = (k: 'shop' | 'owner') => {
    setKind(k)
    setCategory(k === 'shop' ? DEFAULT_CATEGORIES[0] : OWNER_CATEGORIES[0])
  }

  const addCategory = () => {
    const c = newCat.trim()
    if (!c || categories.includes(c)) return
    const next = [...customCats, c]
    setCustomCats(next)
    localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify(next))
    setCategory(c)
    setNewCat('')
    setShowNewCat(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0) return
    const eid = await nextExpenseId(new Date())
    const exp: DbExpense = {
      id: eid,
      date,
      category,
      amount: n,
      kind,
      payment_method: method,
      branch_id: activeBranch || 'branch-1',
      note: note.trim() || undefined,
      created_by: user?.id,
      created_at: new Date().toISOString(),
    }
    await db.expenses.add(exp)
    setAmount('')
    setNote('')
    setToast(`${kind === 'owner' ? 'মালিকের টাকা তোলা' : 'খরচ'} সেভ হয়েছে — ৳ ${bn(n)}`)
    setTimeout(() => setToast(''), 2000)
  }

  const remove = async (x: DbExpense) => {
    if (!confirm(`"${x.category} — ৳${bn(x.amount)}" মুছে ফেলবেন?`)) return
    await db.expenses.delete(x.id)
  }

  const today = toDateKey(new Date())
  const monthStart = today.slice(0, 8) + '01'
  const list = useMemo(() => {
    if (filter === 'today') return all.filter((x) => x.date.startsWith(today))
    if (filter === 'month') return all.filter((x) => x.date >= monthStart)
    return all
  }, [all, filter, today, monthStart])

  const totals = useMemo(
    () => ({
      shop: list.filter((x) => x.kind !== 'owner').reduce((s, x) => s + x.amount, 0),
      owner: list.filter((x) => x.kind === 'owner').reduce((s, x) => s + x.amount, 0),
    }),
    [list],
  )

  if (user?.role === 'customer') return <p className="p-6">এই পেজ শুধু মালিক ও কর্মচারীর জন্য।</p>

  return (
    <div className="pb-24">
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-10 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">খরচ এন্ট্রি</h2>
        <Link to="/profit-loss" className="text-xs text-teal-700 font-medium flex items-center gap-1">
          <TrendingUp size={14} /> লাভ-ক্ষতি
        </Link>
      </div>

      {toast && (
        <div className="fixed top-20 left-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <CheckCircle size={20} /> <span>{toast}</span>
        </div>
      )}

      <form onSubmit={submit} className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => switchKind('shop')} className={`py-2.5 rounded-xl border-2 text-sm font-semibold flex items-center justify-center gap-1.5 ${kind === 'shop' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'}`}>
            <Store size={16} /> দোকানের খরচ
          </button>
          <button type="button" onClick={() => switchKind('owner')} className={`py-2.5 rounded-xl border-2 text-sm font-semibold flex items-center justify-center gap-1.5 ${kind === 'owner' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-500'}`}>
            <User size={16} /> মালিকের টাকা তোলা
          </button>
        </div>
        <p className="text-[11px] text-gray-500">
          {kind === 'shop' ? 'দোকানের খরচ লাভ থেকে বাদ যাবে (নিট লাভ = গ্রস লাভ − খরচ)।' : 'মালিকের ব্যক্তিগত টাকা তোলা আলাদা হিসাবে থাকবে — লাভ থেকে বাদ যাবে না।'}
        </p>

        <div className="card space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-600">
              তারিখ
              <input type="date" className="input-field" value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label className="text-xs text-gray-600">
              টাকা <span className="text-red-500">*</span>
              <input type="number" min="1" step="0.01" className="input-field text-lg font-bold" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" required autoFocus />
            </label>
          </div>

          <div>
            <p className="text-xs text-gray-600 mb-1.5">খাত</p>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button key={c} type="button" onClick={() => setCategory(c)} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${category === c ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                  {c}
                </button>
              ))}
              {kind === 'shop' && (
                <button type="button" onClick={() => setShowNewCat((v) => !v)} className="px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-teal-400 text-teal-700">
                  + নতুন খাত
                </button>
              )}
            </div>
            {showNewCat && (
              <div className="flex gap-2 mt-2">
                <input className="input-field" placeholder="খাতের নাম" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
                <button type="button" className="btn-secondary whitespace-nowrap" onClick={addCategory}>
                  যোগ
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-600">
              পেমেন্ট মাধ্যম
              <select className="input-field" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option>নগদ</option>
                <option>বিকাশ</option>
                <option>নগদ (মোবাইল)</option>
                <option>ব্যাংক</option>
              </select>
            </label>
            <label className="text-xs text-gray-600">
              মন্তব্য
              <input className="input-field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ঐচ্ছিক" />
            </label>
          </div>

          <button className="btn-primary w-full py-3 flex items-center justify-center gap-2">
            <Plus size={18} /> {kind === 'owner' ? 'টাকা তোলা সেভ করুন' : 'খরচ সেভ করুন'}
          </button>
        </div>
      </form>

      <div className="px-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">খরচের তালিকা</h3>
          <div className="flex gap-1">
            {(
              [
                ['today', 'আজ'],
                ['month', 'এ মাস'],
                ['all', 'সব'],
              ] as const
            ).map(([f, l]) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-2.5 py-1 rounded-lg text-xs font-medium ${filter === f ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="card bg-red-50 border-red-100">
            <p className="text-xs text-red-600">দোকানের খরচ</p>
            <p className="text-lg font-bold text-red-700">৳ {bn(totals.shop)}</p>
          </div>
          <div className="card bg-purple-50 border-purple-100">
            <p className="text-xs text-purple-600">মালিকের টাকা তোলা</p>
            <p className="text-lg font-bold text-purple-700">৳ {bn(totals.owner)}</p>
          </div>
        </div>

        {list.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Receipt size={40} className="mx-auto mb-2 opacity-50" />
            <p>কোনো খরচ নেই</p>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((x) => (
              <div key={x.id} className="card flex items-center gap-3">
                <div className={`p-2 rounded-lg ${x.kind === 'owner' ? 'bg-purple-100 text-purple-600' : 'bg-red-100 text-red-600'}`}>
                  {x.kind === 'owner' ? <User size={16} /> : <Store size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {x.category}
                    {x.note ? <span className="text-gray-400 font-normal"> — {x.note}</span> : null}
                  </p>
                  <p className="text-xs text-gray-500">
                    {bnDate(x.date)} • {x.payment_method || 'নগদ'}
                  </p>
                </div>
                <p className={`font-bold text-sm ${x.kind === 'owner' ? 'text-purple-700' : 'text-red-700'}`}>৳ {bn(x.amount)}</p>
                {(user?.role === 'owner' || x.created_by === user?.id) && (
                  <button onClick={() => remove(x)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
