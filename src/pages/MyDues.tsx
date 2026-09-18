import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type DbCustomer } from '../lib/db'
import { ledgerRows, money } from '../lib/ledger'
import { useAuthStore } from '../stores/authStore'
import { useSalesStore } from '../stores/salesStore'
import { linkCustomerForUser } from '../lib/customerLink'
import { Wallet, ShoppingCart } from 'lucide-react'

const bn = (n: number) => n.toLocaleString('bn-BD')

export default function MyDues() {
  const user = useAuthStore((s) => s.user)!
  const sales = useSalesStore((s) => s.sales)
  const [me, setMe] = useState<DbCustomer | null>(null)
  const ledger = useLiveQuery(async () => ({ entries: await db.ledgerEntries.toArray(), collections: await db.collections.toArray() }))

  useEffect(() => {
    linkCustomerForUser(user).then(setMe)
  }, [user])

  const rows = useMemo(() => (me ? ledgerRows(me.id, sales, [], ledger?.entries || [], ledger?.collections || []) : []), [me, sales, ledger])
  const due = rows[rows.length - 1]?.balance || 0
  const mine = useMemo(() => (me ? sales.filter((s) => s.customer_id === me.id).sort((a, b) => b.date.localeCompare(a.date)) : []), [me, sales])
  const [tab, setTab] = useState<'ledger' | 'purchases'>('ledger')

  return (
    <div className="pb-24">
      <div className="bg-gradient-to-r from-teal-700 to-emerald-700 text-white px-4 pt-4 pb-6">
        <h1 className="text-lg font-bold">আমার বাকি</h1>
        <p className="text-teal-100 text-xs">{me?.name}{me?.phone ? ` • ${me.phone}` : ''}</p>
      </div>
      <div className="px-4 -mt-3 space-y-4">
        <div className="card bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 flex items-center gap-4">
          <div className="p-3 bg-orange-100 rounded-xl">
            <Wallet className="text-orange-600" size={28} />
          </div>
          <div>
            <p className="text-sm text-gray-600">বর্তমান বাকি</p>
            <p className="text-3xl font-bold text-orange-600">৳ {bn(due)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button className={tab === 'ledger' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('ledger')}>
            বাকির হিসাব
          </button>
          <button className={tab === 'purchases' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('purchases')}>
            কেনাকাটা ({bn(mine.length)})
          </button>
        </div>

        {tab === 'ledger' ? (
          rows.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">কোনো বাকি লেনদেন নেই</p>
          ) : (
            <div className="card !p-0 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="text-left p-2">তারিখ</th>
                    <th className="text-left p-2">বিবরণ</th>
                    <th className="text-right p-2">বাকি</th>
                    <th className="text-right p-2">জমা</th>
                    <th className="text-right p-2">ব্যালেন্স</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-2 text-gray-500">{r.date.slice(0, 10)}</td>
                      <td className="p-2">{r.label}</td>
                      <td className="p-2 text-right text-orange-700">{r.debit ? money(r.debit) : ''}</td>
                      <td className="p-2 text-right text-green-700">{r.credit ? money(r.credit) : ''}</td>
                      <td className="p-2 text-right font-semibold">{money(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : mine.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <ShoppingCart size={36} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">কোনো কেনাকাটা নেই</p>
          </div>
        ) : (
          <div className="space-y-2">
            {mine.map((s) => (
              <div key={s.id} className="card text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">{s.date.slice(0, 10)}</span>
                  <span className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${s.payment_type === 'বাকি' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>{s.payment_type}</span>
                    <strong className="text-gray-800 text-sm">৳ {bn(s.total_amount)}</strong>
                  </span>
                </div>
                <p className="text-gray-600">{s.items.map((i) => `${i.product_name} ${bn(i.quantity)}${i.unit}`).join(', ')}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
