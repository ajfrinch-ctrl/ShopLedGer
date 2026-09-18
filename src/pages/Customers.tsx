import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type DbCustomer, type DbUser } from '../lib/db'
import { ledgerRows } from '../lib/ledger'
import { pendingCustomerUsers } from '../lib/customerAccount'
import { useAuthStore } from '../stores/authStore'
import { inUserBranch, staffBranchIds } from '../lib/roles'
import { useActiveBranchId } from '../stores/uiStore'
import { useCustomerStore } from '../stores/customerStore'
import { useSalesStore } from '../stores/salesStore'
import CustomerForm, { Sheet, type CustomerFormData } from '../components/customer/CustomerForm'
import { Search, Users, Plus, ChevronRight, Check, X, UserCheck } from 'lucide-react'

const bn = (n: number) => n.toLocaleString('bn-BD')

interface CustomerRow extends DbCustomer {
  due: number
  totalPurchase: number
  saleCount: number
  lastSale?: string
}

export default function Customers() {
  const user = useAuthStore((s) => s.user)
  const activeBranch = useActiveBranchId()
  const navigate = useNavigate()
  const { customers, loadCustomers, addCustomer, updateCustomer } = useCustomerStore()
  const sales = useSalesStore((s) => s.sales)
  const ledger = useLiveQuery(async () => ({
    entries: await db.ledgerEntries.toArray(),
    collections: await db.collections.toArray(),
  }))
  const usersQuery = useLiveQuery(() => db.users.toArray(), [])
  const branches = useLiveQuery(() => db.branches.toArray(), []) || []

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  const [search, setSearch] = useState('')
  const [onlyDue, setOnlyDue] = useState(false)
  const [editing, setEditing] = useState<DbCustomer | 'new' | null>(null)
  const [approving, setApproving] = useState<DbUser | null>(null)

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

  // ব্যবস্থাপক/সেলস ম্যান শুধু নিজের শাখার ক্রেতা দেখে; মালিক সব শাখা
  const scoped = useMemo(
    () => (user && user.role !== 'owner' ? rows.filter((r) => inUserBranch(user, r.branch_id)) : rows),
    [rows, user],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return scoped.filter((r) => (!onlyDue || r.due > 0) && (!q || r.name.toLowerCase().includes(q) || r.phone?.includes(q)))
  }, [scoped, search, onlyDue])

  const totals = useMemo(
    () => ({ due: scoped.reduce((s, r) => s + r.due, 0), dueCount: scoped.filter((r) => r.due > 0).length }),
    [scoped],
  )

  const pending = useMemo(() => {
    const all = usersQuery || []
    return pendingCustomerUsers(
      user && user.role !== 'owner' ? all.filter((u) => inUserBranch(user, u.branch_id)) : all,
    )
  }, [usersQuery, user])

  /** নতুন সাইন-আপ করা ক্রেতাকে অনুমোদন — অ্যাকাউন্ট সক্রিয় + ক্রেতা তালিকায় যোগ */
  async function approve(u: DbUser, branchId: string) {
    await db.transaction('rw', db.users, db.customers, async () => {
      await db.users.update(u.id, { is_active: true, approval: 'approved', branch_id: branchId, updated_at: new Date().toISOString() })
      const existing = await db.customers.where('branch_id').equals(branchId).toArray()
      const same = existing.find((c) => c.phone && u.phone && c.phone.replace(/\D/g, '').slice(-11) === u.phone.replace(/\D/g, '').slice(-11))
      if (same) return
      await db.customers.add({
        id: `cust-${u.id}`,
        name: u.name,
        phone: u.phone,
        address: u.address,
        branch_id: branchId,
        created_at: new Date().toISOString(),
      })
    })
    await loadCustomers()
    setApproving(null)
  }

  async function reject(u: DbUser) {
    if (!confirm(`"${u.name}"-এর সাইন-আপ অনুরোধ বাতিল করবেন?`)) return
    await db.users.update(u.id, { is_active: false, approval: 'rejected', updated_at: new Date().toISOString() })
  }

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
            <p className="text-lg font-bold text-teal-700">{bn(scoped.length)} জন</p>
          </div>
          <button onClick={() => setOnlyDue((v) => !v)} className={`card text-left border ${onlyDue ? 'bg-orange-100 border-orange-300' : 'bg-orange-50 border-orange-100'}`}>
            <p className="text-xs text-orange-600">মোট বাকি ({bn(totals.dueCount)} জন)</p>
            <p className="text-lg font-bold text-orange-700">৳ {bn(totals.due)}</p>
          </button>
        </div>

        {pending.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
              <UserCheck size={16} /> অনুমোদনের অপেক্ষায় ({bn(pending.length)})
            </h3>
            {pending.map((u) => (
              <div key={u.id} className="card border-amber-200 bg-amber-50 space-y-2">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{u.name}</p>
                  <p className="text-xs text-gray-600">
                    {u.phone}
                    {u.address ? ` • ${u.address}` : ''}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    সাইন-আপ: {new Date(u.created_at).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
                <div className="flex gap-2">
                  {user?.role === 'owner' ? (
                    <>
                      <button type="button" onClick={() => setApproving(u)} className="btn-primary !py-1.5 text-xs flex items-center gap-1">
                        <Check size={14} /> অনুমোদন
                      </button>
                      <button type="button" onClick={() => reject(u)} className="btn-secondary !py-1.5 text-xs !text-red-600 flex items-center gap-1">
                        <X size={14} /> বাতিল
                      </button>
                    </>
                  ) : (
                    <p className="text-xs text-gray-500">অনুমোদন দিতে পারবেন মালিক।</p>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

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
              <button key={c.id} onClick={() => navigate(`/customers/${encodeURIComponent(c.id)}`)} className="card w-full text-left flex items-center gap-3 active:scale-[0.99]">
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

      {editing && (
        <CustomerForm
          customer={editing === 'new' ? null : editing}
          existing={rows}
          onClose={() => setEditing(null)}
          onSave={async (form: CustomerFormData) => {
            if (editing === 'new') {
              await addCustomer({ ...form, branch_id: activeBranch || branches[0]?.id || 'branch-1' })
            } else {
              const exists = customers.some((c) => c.id === editing.id)
              if (exists) await updateCustomer(editing.id, form)
              else {
                // বিক্রি থেকে আসা ক্রেতা, টেবিলে নেই — যোগ করি
                await db.customers.add({ ...editing, ...form })
                await loadCustomers()
              }
            }
            setEditing(null)
          }}
        />
      )}

      {approving && (
        <ApproveSheet user={approving} branches={branches} onClose={() => setApproving(null)} onApprove={approve} />
      )}
    </div>
  )
}

function ApproveSheet({
  user,
  branches,
  onClose,
  onApprove,
}: {
  user: DbUser
  branches: { id: string; name: string; is_active: boolean }[]
  onClose: () => void
  onApprove: (u: DbUser, branchId: string) => Promise<void>
}) {
  const active = branches.filter((b) => b.is_active)
  const [branchId, setBranchId] = useState(staffBranchIds(user)[0] || active[0]?.id || '')
  const [busy, setBusy] = useState(false)

  return (
    <Sheet title="ক্রেতার সাইন-আপ অনুমোদন" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-gray-700">
          <span className="font-semibold">{user.name}</span> ({user.phone})
          {user.address ? ` — ${user.address}` : ''}
        </p>
        <p className="text-xs text-gray-500">
          অনুমোদন দিলে এই ক্রেতা নিজের নম্বর ও পাসওয়ার্ড দিয়ে লগইন করতে পারবেন এবং ক্রেতা তালিকায় যুক্ত হবেন।
        </p>
        {active.length > 1 && (
          <label className="block text-xs text-gray-600">
            শাখা
            <select className="input-field" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {active.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className="btn-primary w-full"
          disabled={busy || !branchId}
          onClick={async () => {
            setBusy(true)
            try {
              await onApprove(user, branchId)
            } finally {
              setBusy(false)
            }
          }}
        >
          অনুমোদন দিন
        </button>
      </div>
    </Sheet>
  )
}
