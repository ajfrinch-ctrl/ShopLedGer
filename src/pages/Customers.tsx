import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type DbCustomer } from '../lib/db'
import { ledgerRows } from '../lib/ledger'
import { useAuthStore } from '../stores/authStore'
import { useCustomerStore } from '../stores/customerStore'
import { useSalesStore } from '../stores/salesStore'
import { Search, Users, Plus, Pencil, Phone, MapPin, X, Wallet, ShoppingCart, ChevronRight, Trash2 } from 'lucide-react'

const bn = (n: number) => n.toLocaleString('bn-BD')

interface CustomerRow extends DbCustomer {
  due: number
  totalPurchase: number
  saleCount: number
  lastSale?: string
}

export default function Customers() {
  const user = useAuthStore((s) => s.user)
  const { customers, loadCustomers, addCustomer, updateCustomer, deleteCustomer } = useCustomerStore()
  const sales = useSalesStore((s) => s.sales)
  const ledger = useLiveQuery(async () => ({
    entries: await db.ledgerEntries.toArray(),
    collections: await db.collections.toArray(),
  }))

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  const [search, setSearch] = useState('')
  const [onlyDue, setOnlyDue] = useState(false)
  const [editing, setEditing] = useState<DbCustomer | 'new' | null>(null)
  const [selected, setSelected] = useState<CustomerRow | null>(null)

  const rows = useMemo<CustomerRow[]>(() => {
    // ক্রেতা তালিকা: customers টেবিল + বিক্রিতে থাকা ক্রেতা (টেবিলে না থাকলেও)
    const map = new Map<string, DbCustomer>()
    customers.forEach((c) => map.set(c.id, c))
    sales.forEach((s) => {
      if (s.customer_id && !map.has(s.customer_id))
        map.set(s.customer_id, { id: s.customer_id, name: s.customer_name || s.customer_id, branch_id: s.branch_id, created_at: s.created_at })
    })
    return [...map.values()]
      .map((c) => {
        const mine = sales.filter((s) => s.customer_id === c.id)
        const lr = ledgerRows(c.id, sales, [], ledger?.entries || [], ledger?.collections || [])
        return {
          ...c,
          due: lr[lr.length - 1]?.balance || 0,
          totalPurchase: mine.reduce((sum, s) => sum + s.total_amount, 0),
          saleCount: mine.length,
          lastSale: mine.map((s) => s.date).sort().pop(),
        }
      })
      .sort((a, b) => b.due - a.due || a.name.localeCompare(b.name, 'bn'))
  }, [customers, sales, ledger])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => (!onlyDue || r.due > 0) && (!q || r.name.toLowerCase().includes(q) || r.phone?.includes(q)))
  }, [rows, search, onlyDue])

  const totals = useMemo(
    () => ({ due: rows.reduce((s, r) => s + r.due, 0), dueCount: rows.filter((r) => r.due > 0).length }),
    [rows],
  )

  if (user?.role === 'customer') return <p className="p-6">এই পেজ শুধু মালিক ও কর্মচারীর জন্য।</p>

  return (
    <div className="pb-24">
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-10 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">ক্রেতা</h2>
        <button className="btn-primary !py-1.5 !px-2.5 text-xs flex items-center gap-1" onClick={() => setEditing('new')}>
          <Plus size={14} /> নতুন ক্রেতা
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="card bg-teal-50 border-teal-100">
            <p className="text-xs text-teal-600">মোট ক্রেতা</p>
            <p className="text-lg font-bold text-teal-700">{bn(rows.length)} জন</p>
          </div>
          <button onClick={() => setOnlyDue((v) => !v)} className={`card text-left border ${onlyDue ? 'bg-orange-100 border-orange-300' : 'bg-orange-50 border-orange-100'}`}>
            <p className="text-xs text-orange-600">মোট বাকি ({bn(totals.dueCount)} জন)</p>
            <p className="text-lg font-bold text-orange-700">৳ {bn(totals.due)}</p>
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input className="input-field pl-10" placeholder="নাম বা ফোন দিয়ে খুঁজুন..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Users size={40} className="mx-auto mb-2 opacity-50" />
            <p>কোনো ক্রেতা পাওয়া যায়নি</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((c) => (
              <button key={c.id} onClick={() => setSelected(c)} className="card w-full text-left flex items-center gap-3 active:scale-[0.99]">
                <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 font-bold flex items-center justify-center shrink-0">
                  {c.name.trim().charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-800 truncate">{c.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {c.phone || 'ফোন নেই'} • {bn(c.saleCount)}টি কেনাকাটা
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-sm ${c.due > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{c.due > 0 ? `৳ ${bn(c.due)}` : 'বাকি নেই'}</p>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <CustomerDetail
          row={selected}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing(selected)
          }}
          onDelete={
            user?.role === 'owner' && selected.saleCount === 0 && selected.due === 0
              ? async () => {
                  if (!confirm(`"${selected.name}" মুছে ফেলবেন?`)) return
                  await deleteCustomer(selected.id)
                  setSelected(null)
                }
              : undefined
          }
        />
      )}

      {editing && (
        <CustomerForm
          customer={editing === 'new' ? null : editing}
          existing={rows}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            if (editing === 'new') {
              await addCustomer({ ...data, branch_id: user?.branch_id || 'branch-1' })
            } else {
              const exists = customers.some((c) => c.id === editing.id)
              if (exists) await updateCustomer(editing.id, data)
              else {
                // বিক্রি থেকে আসা ক্রেতা, টেবিলে নেই — যোগ করি
                await db.customers.add({ ...editing, ...data })
                await loadCustomers()
              }
              setSelected((s) => (s && s.id === editing.id ? { ...s, ...data } : s))
            }
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function CustomerDetail({ row, onClose, onEdit, onDelete }: { row: CustomerRow; onClose: () => void; onEdit: () => void; onDelete?: () => void }) {
  const sales = useSalesStore((s) => s.sales)
  const mine = useMemo(() => sales.filter((s) => s.customer_id === row.id).sort((a, b) => b.date.localeCompare(a.date)), [sales, row.id])

  return (
    <Sheet title={row.name} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-center gap-4 text-xs text-gray-600">
          {row.phone && (
            <a href={`tel:${row.phone}`} className="flex items-center gap-1 text-teal-700">
              <Phone size={13} /> {row.phone}
            </a>
          )}
          {row.address && (
            <span className="flex items-center gap-1">
              <MapPin size={13} /> {row.address}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className={`rounded-xl p-3 ${row.due > 0 ? 'bg-orange-50' : 'bg-gray-50'}`}>
            <p className="text-xs text-gray-500">বর্তমান বাকি</p>
            <p className={`text-xl font-bold ${row.due > 0 ? 'text-orange-600' : 'text-gray-500'}`}>৳ {bn(row.due)}</p>
          </div>
          <div className="rounded-xl p-3 bg-blue-50">
            <p className="text-xs text-gray-500">মোট কেনাকাটা</p>
            <p className="text-xl font-bold text-blue-700">৳ {bn(row.totalPurchase)}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Link to={`/collections?type=customer&party=${encodeURIComponent(row.id)}`} className="btn-primary text-center text-xs !py-2 flex items-center justify-center gap-1">
            <Wallet size={14} /> বাকি খাতা
          </Link>
          <button onClick={onEdit} className="btn-secondary text-xs !py-2 flex items-center justify-center gap-1">
            <Pencil size={14} /> সম্পাদনা
          </button>
          {onDelete ? (
            <button onClick={onDelete} className="btn-secondary text-xs !py-2 flex items-center justify-center gap-1 !text-red-600">
              <Trash2 size={14} /> মুছুন
            </button>
          ) : (
            <Link to="/sales" className="btn-secondary text-xs !py-2 flex items-center justify-center gap-1">
              <ShoppingCart size={14} /> বিক্রি
            </Link>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-700 mb-1.5">কেনাকাটার ইতিহাস ({bn(mine.length)})</p>
          {mine.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">কোনো বিক্রি নেই</p>
          ) : (
            <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
              {mine.map((s) => (
                <div key={s.id} className="bg-gray-50 rounded-lg p-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">{s.date.slice(0, 10)}</span>
                    <span className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${s.payment_type === 'বাকি' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>{s.payment_type}</span>
                      <strong className="text-gray-800">৳ {bn(s.total_amount)}</strong>
                    </span>
                  </div>
                  <p className="text-gray-600 mt-1 truncate">{s.items.map((i) => `${i.product_name} ${i.quantity}${i.unit}`).join(', ')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Sheet>
  )
}

function CustomerForm({
  customer,
  existing,
  onClose,
  onSave,
}: {
  customer: DbCustomer | null
  existing: DbCustomer[]
  onClose: () => void
  onSave: (data: { name: string; phone?: string; address?: string }) => Promise<void>
}) {
  const [name, setName] = useState(customer?.name || '')
  const [phone, setPhone] = useState(customer?.phone || '')
  const [address, setAddress] = useState(customer?.address || '')
  const [busy, setBusy] = useState(false)

  const dupPhone = phone.trim() && existing.find((c) => c.id !== customer?.id && c.phone === phone.trim())
  const dupName = existing.find((c) => c.id !== customer?.id && c.name.trim().toLowerCase() === name.trim().toLowerCase())

  return (
    <Sheet title={customer ? 'ক্রেতা সম্পাদনা' : 'নতুন ক্রেতা'} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim() || dupPhone) return
          if (dupName && !customer && !confirm(`"${dupName.name}" নামে ক্রেতা আগে থেকেই আছে। তবুও নতুন যোগ করবেন?`)) return
          setBusy(true)
          try {
            await onSave({ name: name.trim(), phone: phone.trim() || undefined, address: address.trim() || undefined })
          } finally {
            setBusy(false)
          }
        }}
      >
        <label className="block text-xs text-gray-600">
          নাম <span className="text-red-500">*</span>
          <input required className="input-field" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label className="block text-xs text-gray-600">
          মোবাইল নম্বর
          <input type="tel" className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" />
          {dupPhone && <span className="text-red-600">এই নম্বরটি "{dupPhone.name}"-এর</span>}
        </label>
        <label className="block text-xs text-gray-600">
          ঠিকানা
          <input className="input-field" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ঐচ্ছিক" />
        </label>
        <button className="btn-primary w-full" disabled={busy || !!dupPhone}>
          সংরক্ষণ
        </button>
      </form>
    </Sheet>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
