import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type DbCustomer, type DbCustomerMessage } from '../lib/db'
import { ledgerRows, money } from '../lib/ledger'
import { useAuthStore } from '../stores/authStore'
import { useSalesStore } from '../stores/salesStore'
import { linkCustomerForUser } from '../lib/customerLink'
import { customerMessageText, MESSAGE_KINDS, shopWhatsAppLink } from '../lib/customerAccount'
import { bnMoney, r2 } from '../lib/reports/core'
import SaleReceipt from '../components/SaleReceipt'
import { Sheet } from '../components/customer/CustomerForm'
import type { Sale } from '../types'
import { Bell, CheckCircle2, Loader2, MessageCircle, Receipt, ShoppingCart, Wallet } from 'lucide-react'

const bn = (n: number) => n.toLocaleString('bn-BD')

const METHODS = ['নগদ টাকা', 'বিকাশ', 'নগদ', 'রকেট', 'ব্যাংক'] as const

/** ক্রেতার নিজের পেজ — বাকির হিসাব, কেনাকাটা ও রসিদ, এবং দোকানকে বার্তা পাঠানো */
export default function MyDues() {
  const user = useAuthStore((s) => s.user)!
  const sales = useSalesStore((s) => s.sales)
  const [me, setMe] = useState<DbCustomer | null>(null)
  const [receipt, setReceipt] = useState<Sale | null>(null)
  const [messaging, setMessaging] = useState(false)
  const [toast, setToast] = useState('')

  const ledger = useLiveQuery(
    async () => ({
      entries: await db.ledgerEntries.toArray(),
      collections: await db.collections.toArray(),
      branches: await db.branches.toArray(),
      messages: await db.customerMessages.toArray(),
    }),
    [],
  )

  useEffect(() => {
    linkCustomerForUser(user).then(setMe)
  }, [user])

  const rows = useMemo(
    () => (me ? ledgerRows(me.id, sales, [], ledger?.entries || [], ledger?.collections || []) : []),
    [me, sales, ledger],
  )
  const due = rows[rows.length - 1]?.balance || 0
  const mine = useMemo(
    () => (me ? sales.filter((s) => s.customer_id === me.id).sort((a, b) => b.date.localeCompare(a.date)) : []),
    [me, sales],
  )
  const [tab, setTab] = useState<'ledger' | 'purchases'>('ledger')

  const branch = useMemo(
    () => ledger?.branches.find((b) => b.id === (me?.branch_id || user.branch_id)),
    [ledger, me, user.branch_id],
  )
  const shopName = branch?.organization?.trim() || branch?.name || 'দোকান'

  const myMessages = useMemo(
    () => (ledger?.messages || []).filter((m) => m.customer_id === me?.id).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [ledger, me],
  )

  const totalPaid = rows.reduce((s, r) => s + r.credit, 0)
  const totalBilled = rows.reduce((s, r) => s + r.debit, 0)

  return (
    <div className="pb-24">
      <div className="bg-gradient-to-r from-teal-700 to-emerald-700 text-white px-4 pt-4 pb-6">
        <h1 className="text-lg font-bold">আমার বাকি</h1>
        <p className="text-teal-100 text-xs">
          {me?.name}
          {me?.phone ? ` • ${me.phone}` : ''} • {shopName}
        </p>
      </div>

      <div className="px-4 -mt-3 space-y-4">
        {toast && (
          <p className="text-xs text-green-800 bg-green-50 border border-green-200 rounded-lg p-2 flex items-center gap-2">
            <CheckCircle2 size={14} /> {toast}
          </p>
        )}

        <div className="card bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 flex items-center gap-4">
          <div className="p-3 bg-orange-100 rounded-xl">
            <Wallet className="text-orange-600" size={28} />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-600">বর্তমান বাকি</p>
            <p className="text-3xl font-bold text-orange-600">৳ {bn(due)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="card !p-3">
            <p className="text-gray-500">মোট বাকি হয়েছে</p>
            <p className="font-bold text-gray-800">{bnMoney(r2(totalBilled))}</p>
          </div>
          <div className="card !p-3">
            <p className="text-gray-500">মোট জমা দিয়েছেন</p>
            <p className="font-bold text-teal-700">{bnMoney(r2(totalPaid))}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMessaging(true)}
          className="btn-primary w-full bg-green-600 hover:bg-green-700 border-green-600 flex items-center justify-center gap-2"
        >
          <MessageCircle size={16} /> দোকানকে জানান
        </button>

        {myMessages.length > 0 && (
          <section className="space-y-1.5">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Bell size={15} className="text-teal-600" /> আমার পাঠানো বার্তা ({bn(myMessages.length)})
            </h2>
            {myMessages.slice(0, 5).map((m) => (
              <div key={m.id} className="card text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">{MESSAGE_KINDS[m.kind]}</span>
                  <span className="text-gray-400">
                    {new Date(m.created_at).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
                {m.amount ? <p className="text-gray-600">টাকা: {bnMoney(m.amount)}</p> : null}
                {m.note && <p className="text-gray-600">{m.note}</p>}
                <p className={m.seen ? 'text-green-700' : 'text-gray-400'}>{m.seen ? 'দোকান দেখেছে' : 'দোকান এখনো দেখেনি'}</p>
              </div>
            ))}
          </section>
        )}

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
            <div className="card !p-0 overflow-x-auto">
              <table className="w-full text-xs whitespace-nowrap">
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
              <div key={s.id} className="card text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">{s.date.slice(0, 10)}</span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        s.payment_type === 'বাকি' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {s.payment_type}
                    </span>
                    <strong className="text-gray-800 text-sm">৳ {bn(s.total_amount)}</strong>
                  </span>
                </div>
                <p className="text-gray-600">{s.items.map((i) => `${i.product_name} ${bn(i.quantity)}${i.unit}`).join(', ')}</p>
                <button
                  type="button"
                  onClick={() => setReceipt(s)}
                  className="btn-secondary !py-1.5 text-xs flex items-center justify-center gap-1.5"
                >
                  <Receipt size={14} /> রসিদ দেখুন / ডাউনলোড
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {receipt && <SaleReceipt sale={receipt} shopName={shopName} onClose={() => setReceipt(null)} />}

      {messaging && me && (
        <MessageSheet
          shopName={shopName}
          customerName={me.name}
          due={due}
          branchPhone={branch?.phone}
          onClose={() => setMessaging(false)}
          onSent={(text) => {
            setMessaging(false)
            setToast(text)
          }}
          customerId={me.id}
          branchId={me.branch_id}
          phone={me.phone}
        />
      )}
    </div>
  )
}

/* ─────────────── দোকানকে বার্তা ─────────────── */

function MessageSheet({
  shopName,
  customerName,
  customerId,
  branchId,
  phone,
  due,
  branchPhone,
  onClose,
  onSent,
}: {
  shopName: string
  customerName: string
  customerId: string
  branchId: string
  phone?: string
  due: number
  branchPhone?: string
  onClose: () => void
  onSent: (toast: string) => void
}) {
  const [kind, setKind] = useState<DbCustomerMessage['kind']>('payment')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<string>(METHODS[0])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const text = customerMessageText({
    customerName,
    shopName,
    kind,
    amount: parseFloat(amount) || undefined,
    method: kind === 'payment' ? method : undefined,
    note,
    due,
  })

  async function send(alsoWhatsApp: boolean) {
    setError('')
    const value = parseFloat(amount)
    if (kind === 'payment' && (!Number.isFinite(value) || value <= 0)) {
      setError('কত টাকা দিয়েছেন লিখুন')
      return
    }
    setBusy(true)
    try {
      await db.customerMessages.add({
        id: `msg-${crypto.randomUUID()}`,
        customer_id: customerId,
        customer_name: customerName,
        phone,
        branch_id: branchId,
        kind,
        amount: kind === 'payment' ? value : undefined,
        method: kind === 'payment' ? method : undefined,
        note: note.trim(),
        created_at: new Date().toISOString(),
        seen: false,
      })
      if (alsoWhatsApp) window.open(shopWhatsAppLink(text, branchPhone), '_blank', 'noopener')
      onSent(alsoWhatsApp ? 'বার্তা পাঠানো হয়েছে ও WhatsApp খোলা হয়েছে।' : 'বার্তা দোকানে পাঠানো হয়েছে।')
    } catch {
      setError('বার্তা পাঠানো যায়নি, আবার চেষ্টা করুন')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="দোকানকে জানান" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-gray-500">
          আপনার হিসাবে বর্তমান বাকি <span className="font-semibold text-orange-600">{bnMoney(r2(due))}</span>
        </p>

        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(MESSAGE_KINDS) as DbCustomerMessage['kind'][]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`text-xs py-2 rounded-xl border-2 ${
                kind === k ? 'border-teal-500 bg-teal-50 text-teal-700 font-semibold' : 'border-gray-200 text-gray-600'
              }`}
            >
              {MESSAGE_KINDS[k]}
            </button>
          ))}
        </div>

        {kind === 'payment' && (
          <>
            <label className="block text-xs text-gray-600">
              কত টাকা দিয়েছেন
              <input
                type="number"
                min="1"
                step="0.01"
                inputMode="decimal"
                className="input-field"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="যেমন ৫০০"
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`text-[11px] px-3 py-1.5 rounded-full border ${
                    method === m ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </>
        )}

        <label className="block text-xs text-gray-600">
          মন্তব্য (ঐচ্ছিক)
          <textarea
            className="input-field"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="যেমন: আগামীকাল এসে বাকি টাকা দেব"
          />
        </label>

        {error && <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">{error}</p>}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => send(false)} className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-50">
            {busy && <Loader2 className="animate-spin" size={14} />} অ্যাপে পাঠান
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => send(true)}
            className="btn-primary bg-green-600 hover:bg-green-700 border-green-600 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <MessageCircle size={14} /> WhatsApp
          </button>
        </div>
        <p className="text-[11px] text-gray-400 text-center">“অ্যাপে পাঠান”-এ বার্তা দোকানের “বার্তা” তালিকায় জমা হয়।</p>
      </div>
    </Sheet>
  )
}
