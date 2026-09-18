import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type DbOrder, type DbCustomer, type DbCustomerMessage } from '../lib/db'
import { useAuthStore } from '../stores/authStore'
import { inUserBranch } from '../lib/roles'
import { useProductStore } from '../stores/productStore'
import { usePurchaseStore } from '../stores/purchaseStore'
import { useSalesStore, createSaleItem } from '../stores/salesStore'
import { useStockAdjustmentStore } from '../stores/stockAdjustmentStore'
import { computeStock, stockMap } from '../lib/stock'
import { displayName, matchesProduct } from '../lib/productCode'
import { linkCustomerForUser } from '../lib/customerLink'
import { nowLocalISO } from '../lib/profitLoss'
import { MESSAGE_KINDS } from '../lib/customerAccount'
import { bnMoney, r2 } from '../lib/reports/core'
import { nextOrderId } from '../lib/idGenerator'
import { Search, ClipboardList, Plus, Minus, Trash2, CheckCircle, X, Truck, Ban, Check, Clock, Bell, Eye } from 'lucide-react'

const bn = (n: number) => n.toLocaleString('bn-BD')
const STATUS: Record<DbOrder['status'], { label: string; cls: string; icon: React.ReactNode }> = {
  pending: { label: 'অপেক্ষমাণ', cls: 'bg-yellow-100 text-yellow-700', icon: <Clock size={12} /> },
  accepted: { label: 'গৃহীত', cls: 'bg-blue-100 text-blue-700', icon: <Check size={12} /> },
  delivered: { label: 'ডেলিভারি হয়েছে', cls: 'bg-green-100 text-green-700', icon: <Truck size={12} /> },
  cancelled: { label: 'বাতিল', cls: 'bg-gray-100 text-gray-500', icon: <Ban size={12} /> },
}

export default function Orders() {
  const user = useAuthStore((s) => s.user)
  if (!user) return null
  return user.role === 'customer' ? <CustomerOrders /> : <ShopOrders />
}

/* ─────────────── ক্রেতার দিক: অর্ডার দেওয়া ─────────────── */
function CustomerOrders() {
  const user = useAuthStore((s) => s.user)!
  const products = useProductStore((s) => s.products)
  const [me, setMe] = useState<DbCustomer | null>(null)
  const orders = useLiveQuery(() => (me ? db.orders.where('customer_id').equals(me.id).reverse().sortBy('created_at') : []), [me?.id]) || []

  useEffect(() => {
    linkCustomerForUser(user).then(setMe)
  }, [user])

  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [note, setNote] = useState('')
  const [toast, setToast] = useState('')

  const list = useMemo(() => products.filter((p) => p.sale_price > 0 && matchesProduct(p, search)).slice(0, 40), [products, search])
  const items = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, q]) => ({ p: products.find((x) => x.id === id)!, q }))
        .filter((x) => x.p && x.q > 0),
    [cart, products],
  )
  const total = items.reduce((s, x) => s + x.q * x.p.sale_price, 0)
  const setQty = (id: string, q: number) => setCart((c) => ({ ...c, [id]: Math.max(0, q) }))

  const place = async () => {
    if (!me || items.length === 0) return
    const now = new Date().toISOString()
    const oid = await nextOrderId(new Date())
    await db.orders.add({
      id: oid,
      customer_id: me.id,
      customer_name: me.name,
      items: items.map(({ p, q }) => ({ product_id: p.id, product_name: displayName(p), quantity: q, unit: p.unit, sale_price: p.sale_price, total: q * p.sale_price })),
      total_amount: total,
      status: 'pending',
      branch_id: me.branch_id,
      note: note.trim() || undefined,
      created_at: now,
      updated_at: now,
    })
    setCart({})
    setNote('')
    setToast('অর্ডার পাঠানো হয়েছে! দোকান থেকে নিশ্চিত করা হবে।')
    setTimeout(() => setToast(''), 2500)
  }

  const cancel = async (o: DbOrder) => {
    if (o.status !== 'pending') return
    if (!confirm('অর্ডারটি বাতিল করবেন?')) return
    await db.orders.update(o.id, { status: 'cancelled', updated_at: new Date().toISOString() })
  }

  return (
    <div className="pb-40">
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-10">
        <h2 className="text-lg font-semibold text-gray-800">অর্ডার দিন</h2>
      </div>
      {toast && (
        <div className="fixed top-20 left-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <CheckCircle size={20} /> <span>{toast}</span>
        </div>
      )}

      <div className="p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input className="input-field pl-10" placeholder="পণ্য খুঁজুন..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {list.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-6">কোনো পণ্য নেই</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {list.map((p) => {
              const q = cart[p.id] || 0
              return (
                <div key={p.id} className={`p-3 rounded-xl border-2 ${q > 0 ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white'}`}>
                  <p className="font-medium text-sm text-gray-800 line-clamp-2 leading-tight">{displayName(p)}</p>
                  <p className="text-xs text-teal-700 font-semibold mt-1">
                    ৳{p.sale_price} / {p.unit}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <button onClick={() => setQty(p.id, q - 1)} className="w-8 h-8 rounded-lg bg-white border flex items-center justify-center" disabled={q === 0}>
                      <Minus size={14} />
                    </button>
                    <input type="number" min="0" step="0.5" value={q || ''} placeholder="0" onChange={(e) => setQty(p.id, parseFloat(e.target.value) || 0)} className="w-14 text-center text-sm border rounded-lg py-1" />
                    <button onClick={() => setQty(p.id, q + 1)} className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">আমার অর্ডার</h3>
          {orders.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">এখনো কোনো অর্ডার নেই</p>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <OrderCard key={o.id} o={o} actions={o.status === 'pending' ? <button onClick={() => cancel(o)} className="text-xs text-red-600 font-medium">বাতিল</button> : null} />
              ))}
            </div>
          )}
        </section>
      </div>

      {items.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 bg-white border-t shadow-lg p-4 space-y-2 z-20">
          <div className="max-h-28 overflow-y-auto space-y-1">
            {items.map(({ p, q }) => (
              <div key={p.id} className="flex justify-between text-xs text-gray-600">
                <span className="truncate">
                  {displayName(p)} × {bn(q)} {p.unit}
                </span>
                <span className="flex items-center gap-2">
                  ৳ {bn(q * p.sale_price)}
                  <button onClick={() => setQty(p.id, 0)} className="text-red-500">
                    <Trash2 size={12} />
                  </button>
                </span>
              </div>
            ))}
          </div>
          <input className="input-field text-sm" placeholder="মন্তব্য (যেমন কখন লাগবে)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button onClick={place} disabled={!me} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
            <ClipboardList size={18} /> অর্ডার পাঠান — ৳ {bn(total)}
          </button>
        </div>
      )}
    </div>
  )
}

/* ─────────────── দোকানের দিক: অর্ডার ব্যবস্থাপনা ─────────────── */
function ShopOrders() {
  const user = useAuthStore((s) => s.user)!
  const products = useProductStore((s) => s.products)
  const purchases = usePurchaseStore((s) => s.purchases)
  const sales = useSalesStore((s) => s.sales)
  const adjustments = useStockAdjustmentStore((s) => s.adjustments)
  const orders = useLiveQuery(() => db.orders.reverse().sortBy('created_at'), []) || []
  const messagesQuery = useLiveQuery(() => db.customerMessages.reverse().sortBy('created_at'), [])
  const [tab, setTab] = useState<'open' | 'done' | 'messages'>('open')
  const [delivering, setDelivering] = useState<DbOrder | null>(null)

  const scopedMessages = useMemo(() => {
    const all = messagesQuery || []
    return user.role === 'owner' ? all : all.filter((m) => inUserBranch(user, m.branch_id))
  }, [messagesQuery, user])
  const unseen = scopedMessages.filter((m) => !m.seen).length

  const markSeen = (m: DbCustomerMessage) =>
    db.customerMessages.update(m.id, { seen: true, seen_at: new Date().toISOString() })

  const stockById = useMemo(() => stockMap(computeStock(products, purchases, sales, adjustments)), [products, purchases, sales, adjustments])
  const shown = orders.filter((o) => (tab === 'open' ? o.status === 'pending' || o.status === 'accepted' : o.status === 'delivered' || o.status === 'cancelled'))
  const pendingCount = orders.filter((o) => o.status === 'pending').length

  const setStatus = (o: DbOrder, status: DbOrder['status']) => db.orders.update(o.id, { status, updated_at: new Date().toISOString() })

  const deliver = (o: DbOrder, paymentType: 'নগদ' | 'বাকি') => {
    const items = o.items.map((i) => {
      const p = products.find((x) => x.id === i.product_id)
      return createSaleItem(i.product_id, i.product_name, i.quantity, i.unit, i.sale_price, p?.purchase_price || 0)
    })
    const saleId = useSalesStore.getState().addSale({
      date: nowLocalISO(),
      items,
      total_amount: items.reduce((s, i) => s + i.total, 0),
      total_profit: items.reduce((s, i) => s + i.profit, 0),
      payment_type: paymentType,
      customer_id: o.customer_id,
      customer_name: o.customer_name,
      branch_id: o.branch_id,
      created_by: user.id,
      note: `অর্ডার ${o.id}${o.note ? ' — ' + o.note : ''}`,
    })
    db.orders.update(o.id, { status: 'delivered', updated_at: new Date().toISOString(), note: [o.note, `বিক্রি: ${saleId}`].filter(Boolean).join(' | ') })
    setDelivering(null)
  }

  return (
    <div className="pb-24">
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-10 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">ক্রেতার অর্ডার</h2>
        {pendingCount > 0 && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-semibold">{bn(pendingCount)}টি নতুন</span>}
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <button className={tab === 'open' ? 'btn-primary text-xs' : 'btn-secondary text-xs'} onClick={() => setTab('open')}>
            চলমান
          </button>
          <button className={tab === 'done' ? 'btn-primary text-xs' : 'btn-secondary text-xs'} onClick={() => setTab('done')}>
            সম্পন্ন/বাতিল
          </button>
          <button className={tab === 'messages' ? 'btn-primary text-xs' : 'btn-secondary text-xs'} onClick={() => setTab('messages')}>
            <span className="flex items-center justify-center gap-1">
              <Bell size={13} /> বার্তা {unseen > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{bn(unseen)}</span>}
            </span>
          </button>
        </div>

        {tab === 'messages' ? (
          scopedMessages.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Bell size={40} className="mx-auto mb-2 opacity-50" />
              <p>ক্রেতার কোনো বার্তা নেই</p>
            </div>
          ) : (
            <div className="space-y-2">
              {scopedMessages.map((m) => (
                <div key={m.id} className={`card space-y-2 ${m.seen ? '' : 'border-teal-300 bg-teal-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{m.customer_name}</p>
                      <p className="text-xs text-gray-500">
                        {m.phone || 'ফোন নেই'} •{' '}
                        {new Date(m.created_at).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">
                      {MESSAGE_KINDS[m.kind]}
                    </span>
                  </div>
                  {m.amount ? (
                    <p className="text-sm text-gray-800">
                      টাকা: <strong>{bnMoney(r2(m.amount))}</strong>
                      {m.method ? ` • ${m.method}` : ''}
                    </p>
                  ) : null}
                  {m.note && <p className="text-xs text-gray-600">{m.note}</p>}
                  <div className="flex items-center justify-between pt-1 border-t">
                    <span className={`text-[11px] ${m.seen ? 'text-gray-400' : 'text-teal-700 font-medium'}`}>
                      {m.seen ? 'দেখা হয়েছে' : 'নতুন বার্তা'}
                    </span>
                    <div className="flex gap-2">
                      {m.phone && (
                        <a href={`tel:${m.phone}`} className="btn-secondary !py-1.5 text-xs">
                          ফোন
                        </a>
                      )}
                      {!m.seen && (
                        <button onClick={() => markSeen(m)} className="btn-primary !py-1.5 text-xs flex items-center gap-1">
                          <Eye size={13} /> দেখা হয়েছে
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : shown.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <ClipboardList size={40} className="mx-auto mb-2 opacity-50" />
            <p>কোনো অর্ডার নেই</p>
          </div>
        ) : (
          shown.map((o) => (
            <OrderCard
              key={o.id}
              o={o}
              showCustomer
              stockById={stockById}
              actions={
                o.status === 'pending' ? (
                  <>
                    <button onClick={() => setStatus(o, 'cancelled')} className="btn-secondary !py-1.5 text-xs !text-red-600">
                      বাতিল
                    </button>
                    <button onClick={() => setStatus(o, 'accepted')} className="btn-secondary !py-1.5 text-xs">
                      গ্রহণ
                    </button>
                    <button onClick={() => setDelivering(o)} className="btn-primary !py-1.5 text-xs">
                      ডেলিভারি
                    </button>
                  </>
                ) : o.status === 'accepted' ? (
                  <>
                    <button onClick={() => setStatus(o, 'cancelled')} className="btn-secondary !py-1.5 text-xs !text-red-600">
                      বাতিল
                    </button>
                    <button onClick={() => setDelivering(o)} className="btn-primary !py-1.5 text-xs flex items-center gap-1">
                      <Truck size={14} /> ডেলিভারি ও বিক্রি
                    </button>
                  </>
                ) : null
              }
            />
          ))
        )}
      </div>

      {delivering && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setDelivering(null)}>
          <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800">ডেলিভারি নিশ্চিত করুন</h3>
              <button onClick={() => setDelivering(null)}>
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              {delivering.customer_name} — ৳ {bn(delivering.total_amount)}। বিক্রি এন্ট্রি হবে ও স্টক কমবে।
            </p>
            {delivering.items.some((i) => (stockById.get(i.product_id)?.currentStock ?? 0) < i.quantity) && (
              <p className="text-xs text-red-600">⚠ কিছু পণ্যের স্টক যথেষ্ট নেই — স্টক ঋণাত্মক হবে।</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => deliver(delivering, 'নগদ')} className="py-3 rounded-xl border-2 border-green-500 bg-green-50 text-green-700 font-semibold">
                💵 নগদ
              </button>
              <button onClick={() => deliver(delivering, 'বাকি')} className="py-3 rounded-xl border-2 border-orange-500 bg-orange-50 text-orange-700 font-semibold">
                📋 বাকি
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function OrderCard({ o, actions, showCustomer, stockById }: { o: DbOrder; actions?: React.ReactNode; showCustomer?: boolean; stockById?: Map<string, { currentStock: number }> }) {
  const st = STATUS[o.status]
  return (
    <div className="card space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          {showCustomer && <p className="font-medium text-sm text-gray-800">{o.customer_name}</p>}
          <p className="text-xs text-gray-500">
            {new Date(o.created_at).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' })} • {o.id}
          </p>
        </div>
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${st.cls}`}>
          {st.icon} {st.label}
        </span>
      </div>
      <div className="text-xs text-gray-700 space-y-0.5">
        {o.items.map((i) => {
          const short = stockById && (stockById.get(i.product_id)?.currentStock ?? 0) < i.quantity && o.status !== 'delivered' && o.status !== 'cancelled'
          return (
            <div key={i.product_id} className="flex justify-between">
              <span>
                {i.product_name} × {bn(i.quantity)} {i.unit}
                {short && <span className="text-red-600 ml-1">(স্টক {bn(stockById!.get(i.product_id)?.currentStock ?? 0)})</span>}
              </span>
              <span>৳ {bn(i.total)}</span>
            </div>
          )
        })}
      </div>
      {o.note && <p className="text-xs text-gray-500 italic">{o.note}</p>}
      <div className="flex items-center justify-between pt-1 border-t">
        <span className="font-bold text-teal-700 text-sm">৳ {bn(o.total_amount)}</span>
        <div className="flex gap-2">{actions}</div>
      </div>
    </div>
  )
}
