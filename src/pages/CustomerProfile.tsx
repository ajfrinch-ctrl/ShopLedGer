import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type DbCustomer } from '../lib/db'
import { ledgerRows } from '../lib/ledger'
import { useAuthStore } from '../stores/authStore'
import { useCustomerStore } from '../stores/customerStore'
import { useSalesStore } from '../stores/salesStore'
import { buildCustomerStatement, dueReminderText, reminderWhatsAppLink } from '../lib/customerAccount'
import { downloadSheetPdf, sheetFileName } from '../lib/reports/pdf'
import { bnDate, bnMoney, bnNum, inBranch, r2 } from '../lib/reports/core'
import ReportSheet from '../components/report/ReportSheet'
import CustomerForm, { type CustomerFormData } from '../components/customer/CustomerForm'
import {
  ArrowLeft,
  FileDown,
  Loader2,
  MessageCircle,
  Pencil,
  Phone,
  ShoppingCart,
  Trash2,
  Wallet,
} from 'lucide-react'

/**
 * ক্রেতার প্রোফাইল পেজ (মালিক/কর্মচারী) — বাকি, লেজার, কেনাকাটা, অর্ডার
 * ও ক্রেতার হিসাব বিবরণীর আলাদা A4 PDF।
 */
export default function CustomerProfile() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const sales = useSalesStore((s) => s.sales)
  const { customers, updateCustomer, deleteCustomer } = useCustomerStore()

  const data = useLiveQuery(
    async () => ({
      entries: await db.ledgerEntries.toArray(),
      collections: await db.collections.toArray(),
      orders: await db.orders.toArray(),
      branches: await db.branches.toArray(),
    }),
    [],
  )

  // স্টোরের বাইরেও ডেটাবেজ থেকে ক্রেতা খুঁজি — সরাসরি লিংক খুললেও (স্টোর না লোড হলে) পেজ কাজ করবে
  const dbCustomer = useLiveQuery(
    async () => (id ? (await db.customers.get(id)) ?? null : null),
    [id],
  )

  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState<'pdf' | 'print' | null>(null)
  const [message, setMessage] = useState('')
  const sheetRef = useRef<HTMLDivElement>(null)

  const isOwner = user?.role === 'owner'
  const scope = useMemo(
    () => (isOwner ? {} : { branchId: user?.branch_id || '__none__' }),
    [isOwner, user?.branch_id],
  )

  const customer: DbCustomer | null = useMemo(() => {
    const fromDb = customers.find((c) => c.id === id) ?? dbCustomer ?? undefined
    if (fromDb) return fromDb
    // বিক্রি থেকে আসা ক্রেতা (customers টেবিলে এখনো যোগ হয়নি)
    const fromSale = sales.find((s) => s.customer_id === id)
    if (fromSale)
      return {
        id,
        name: fromSale.customer_name || id,
        branch_id: fromSale.branch_id,
        created_at: fromSale.created_at,
      }
    return null
  }, [customers, dbCustomer, id, sales])

  const mine = useMemo(
    () => sales.filter((s) => s.customer_id === id && inBranch(s.branch_id, scope)),
    [sales, id, scope],
  )

  const rows = useMemo(
    () => ledgerRows(id, mine, [], data?.entries || [], data?.collections || []),
    [id, mine, data],
  )

  const due = rows[rows.length - 1]?.balance || 0
  const totalPurchase = mine.reduce((sum, s) => sum + s.total_amount, 0)
  const lastPayment = [...rows].reverse().find((r) => r.credit > 0)
  const orders = (data?.orders || []).filter((o) => o.customer_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const branch = data?.branches.find((b) => b.id === (customer?.branch_id || mine[0]?.branch_id))

  const statement = useMemo(
    () => (customer ? buildCustomerStatement(customer, mine, data?.entries || [], data?.collections || []) : null),
    [customer, mine, data],
  )

  if (!user || user.role === 'customer') return <p className="p-6">এই পেজ শুধু মালিক ও কর্মচারীর জন্য।</p>
  if (!data || dbCustomer === undefined) return <p className="p-6">লোড হচ্ছে…</p>
  if (!customer)
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-gray-600">এই ক্রেতা পাওয়া যায়নি।</p>
        <Link to="/customers" className="text-teal-700 underline text-sm">
          ক্রেতা তালিকায় ফিরে যান
        </Link>
      </div>
    )

  async function download() {
    if (!sheetRef.current || !statement) return
    setBusy('pdf')
    setMessage('')
    try {
      await downloadSheetPdf(sheetRef.current, {
        filename: sheetFileName('statement', customer!.name),
      })
      setMessage('ক্রেতার হিসাব বিবরণীর PDF ডাউনলোড হয়েছে।')
    } catch {
      setMessage('PDF তৈরি হয়নি, আবার চেষ্টা করুন।')
    } finally {
      setBusy(null)
    }
  }

  function remind() {
    if (!customer) return
    const text = dueReminderText(customer, branch, due, lastPayment?.date)
    window.open(reminderWhatsAppLink(text, customer.phone), '_blank', 'noopener')
    setMessage('বাকি তাগাদার বার্তা WhatsApp-এ খোলা হয়েছে।')
  }

  async function saveEdit(form: CustomerFormData) {
    const exists = customers.some((c) => c.id === customer!.id)
    if (exists) await updateCustomer(customer!.id, form)
    else {
      await db.customers.add({ ...customer!, ...form })
      await useCustomerStore.getState().loadCustomers()
    }
    setEditing(false)
    setMessage('ক্রেতার তথ্য হালনাগাদ হয়েছে।')
  }

  return (
    <div className="pb-28">
      {/* হেডার */}
      <div className="bg-gradient-to-r from-teal-700 to-emerald-700 text-white px-4 pt-3 pb-6">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate('/customers')} className="p-1 rounded-lg hover:bg-white/10" aria-label="ফিরে যান">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{customer.name}</h1>
            <p className="text-teal-100 text-xs">
              {customer.phone || 'ফোন নেই'} • {branch?.name || 'শাখা নেই'}
            </p>
            {customer.address && <p className="text-teal-100 text-xs truncate">{customer.address}</p>}
          </div>
          {customer.phone && (
            <a href={`tel:${customer.phone}`} className="p-2 rounded-lg bg-white/10" aria-label="ফোন করুন">
              <Phone size={18} />
            </a>
          )}
        </div>
      </div>

      <div className="px-4 -mt-3 space-y-4">
        {/* সংক্ষিপ্ত হিসাব */}
        <div className="grid grid-cols-2 gap-2">
          <div className={`card ${due > 0 ? 'bg-orange-50 border-orange-100' : 'bg-gray-50'}`}>
            <p className="text-xs text-gray-500">বর্তমান বাকি</p>
            <p className={`text-xl font-bold ${due > 0 ? 'text-orange-600' : 'text-gray-500'}`}>{bnMoney(r2(due))}</p>
            {lastPayment && <p className="text-[11px] text-gray-500">শেষ জমা: {bnDate(lastPayment.date)}</p>}
          </div>
          <div className="card bg-blue-50 border-blue-100">
            <p className="text-xs text-gray-500">মোট কেনাকাটা</p>
            <p className="text-xl font-bold text-blue-700">{bnMoney(r2(totalPurchase))}</p>
            <p className="text-[11px] text-gray-500">{bnNum(mine.length)}টি বিল</p>
          </div>
        </div>

        {/* কাজের বোতাম */}
        <div className="grid grid-cols-2 gap-2">
          <Link
            to={`/collections?type=customer&party=${encodeURIComponent(customer.id)}`}
            className="btn-primary text-xs flex items-center justify-center gap-1.5"
          >
            <Wallet size={14} /> বাকি খাতা
          </Link>
          <Link to={`/sales?customer=${encodeURIComponent(customer.id)}`} className="btn-secondary text-xs flex items-center justify-center gap-1.5">
            <ShoppingCart size={14} /> নতুন বিক্রি
          </Link>
        </div>

        <button
          type="button"
          disabled={busy === 'pdf'}
          onClick={() => download()}
          className="btn-secondary w-full text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {busy === 'pdf' ? <Loader2 className="animate-spin" size={14} /> : <FileDown size={14} />} হিসাব বিবরণী PDF
        </button>

        <button
          type="button"
          disabled={due <= 0}
          onClick={remind}
          className="btn-primary w-full bg-green-600 hover:bg-green-700 border-green-600 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <MessageCircle size={16} /> WhatsApp-এ বাকি তাগাদা পাঠান
        </button>

        {message && <p className="text-xs text-center text-gray-600 bg-gray-100 rounded-lg p-2">{message}</p>}

        {/* লেজার */}
        <section className="space-y-1.5">
          <h2 className="text-sm font-semibold text-gray-700">বাকির হিসাব</h2>
          <div className="card !p-0 overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left p-2">তারিখ</th>
                  <th className="text-left p-2">বিবরণ</th>
                  <th className="text-right p-2">বাকি (+)</th>
                  <th className="text-right p-2">জমা (−)</th>
                  <th className="text-right p-2">ব্যালেন্স</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2 text-gray-500">{r.date.slice(0, 10)}</td>
                    <td className="p-2">{r.label}</td>
                    <td className="p-2 text-right text-orange-700">{r.debit ? bnMoney(r.debit) : ''}</td>
                    <td className="p-2 text-right text-green-700">{r.credit ? bnMoney(r.credit) : ''}</td>
                    <td className="p-2 text-right font-semibold">{bnMoney(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="bg-teal-50 font-bold">
                    <td className="p-2" colSpan={2}>
                      সর্বমোট
                    </td>
                    <td className="p-2 text-right">{bnMoney(rows.reduce((s, r) => s + r.debit, 0))}</td>
                    <td className="p-2 text-right">{bnMoney(rows.reduce((s, r) => s + r.credit, 0))}</td>
                    <td className="p-2 text-right">{bnMoney(r2(due))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
            {!rows.length && <p className="p-3 text-xs text-gray-400">কোনো বাকি লেনদেন নেই।</p>}
          </div>
        </section>

        {/* কেনাকাটা */}
        <section className="space-y-1.5">
          <h2 className="text-sm font-semibold text-gray-700">কেনাকাটার ইতিহাস ({bnNum(mine.length)})</h2>
          {mine.length === 0 ? (
            <p className="text-xs text-gray-400">কোনো বিক্রি নেই।</p>
          ) : (
            <div className="space-y-1.5">
              {mine
                .slice()
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 30)
                .map((s) => (
                  <div key={s.id} className="card text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">{bnDate(s.date)}</span>
                      <span className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            s.payment_type === 'বাকি' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {s.payment_type}
                        </span>
                        <strong className="text-gray-800">{bnMoney(s.total_amount)}</strong>
                      </span>
                    </div>
                    <p className="text-gray-600">{s.items.map((i) => `${i.product_name} × ${bnNum(i.quantity, 2)} ${i.unit}`).join(', ')}</p>
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* অর্ডার */}
        {orders.length > 0 && (
          <section className="space-y-1.5">
            <h2 className="text-sm font-semibold text-gray-700">অর্ডার ({bnNum(orders.length)})</h2>
            {orders.slice(0, 10).map((o) => (
              <div key={o.id} className="card flex justify-between items-center text-xs">
                <span className="text-gray-500">{new Date(o.created_at).toLocaleDateString('bn-BD')}</span>
                <span className="text-gray-600">{o.items.length}টি পণ্য</span>
                <strong>{bnMoney(o.total_amount)}</strong>
                <span className="text-gray-500">
                  {o.status === 'pending'
                    ? 'অপেক্ষমাণ'
                    : o.status === 'accepted'
                      ? 'গৃহীত'
                      : o.status === 'delivered'
                        ? 'ডেলিভারি'
                        : 'বাতিল'}
                </span>
              </div>
            ))}
          </section>
        )}

        {/* সম্পাদনা/মুছে ফেলা */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button type="button" onClick={() => setEditing(true)} className="btn-secondary text-xs flex items-center justify-center gap-1.5">
            <Pencil size={14} /> সম্পাদনা
          </button>
          {isOwner && mine.length === 0 && due <= 0 ? (
            <button
              type="button"
              onClick={async () => {
                if (!confirm(`"${customer!.name}" মুছে ফেলবেন?`)) return
                await deleteCustomer(customer!.id)
                navigate('/customers')
              }}
              className="btn-secondary text-xs flex items-center justify-center gap-1.5 !text-red-600"
            >
              <Trash2 size={14} /> মুছুন
            </button>
          ) : (
            <span />
          )}
        </div>
      </div>

      {editing && (
        <CustomerForm customer={customer} existing={customers} onClose={() => setEditing(false)} onSave={saveEdit} />
      )}

      {/* অদৃশ্য A4 শিট — এই ক্রেতার হিসাব বিবরণীর PDF এখান থেকে তৈরি হয় */}
      {statement && (
        <div aria-hidden data-sheet style={{ position: 'fixed', top: 0, left: 0, zIndex: -1, pointerEvents: 'none' }}>
          <ReportSheet
            doc={statement}
            businessName={branch?.organization?.trim() || 'ShopLedGer'}
            subtitle={branch?.name}
            pad={{ logo: branch?.logo, address: branch?.address, phone: branch?.phone }}
            sheetRef={sheetRef}
          />
        </div>
      )}
    </div>
  )
}
