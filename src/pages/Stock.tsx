import { useMemo, useState } from 'react'
import { useProductStore } from '../stores/productStore'
import { usePurchaseStore } from '../stores/purchaseStore'
import { useSalesStore } from '../stores/salesStore'
import { useStockAdjustmentStore } from '../stores/stockAdjustmentStore'
import { useAuthStore } from '../stores/authStore'
import { computeStock, type StockRow } from '../lib/stock'
import type { Product, StockAdjustmentReason } from '../types'
import { Search, Package, Plus, Pencil, SlidersHorizontal, X, AlertTriangle, History } from 'lucide-react'

const REASONS: StockAdjustmentReason[] = ['ক্ষয়', 'নষ্ট', 'গণনা সংশোধন', 'অন্যান্য']
const bn = (n: number) => n.toLocaleString('bn-BD')

type ProductForm = {
  name: string
  unit: string
  units_per_bag: string
  opening_stock: string
  purchase_price: string
  sale_price: string
  min_stock: string
}

const emptyForm = (): ProductForm => ({
  name: '',
  unit: 'কেজি',
  units_per_bag: '',
  opening_stock: '0',
  purchase_price: '0',
  sale_price: '0',
  min_stock: '0',
})

const toForm = (p: Product): ProductForm => ({
  name: p.name,
  unit: p.unit,
  units_per_bag: p.units_per_bag ? String(p.units_per_bag) : '',
  opening_stock: String(p.opening_stock),
  purchase_price: String(p.purchase_price),
  sale_price: String(p.sale_price),
  min_stock: String(p.min_stock ?? 0),
})

export default function Stock() {
  const user = useAuthStore((s) => s.user)
  const { products, addProduct, updateProduct } = useProductStore()
  const purchases = usePurchaseStore((s) => s.purchases)
  const sales = useSalesStore((s) => s.sales)
  const { adjustments, addAdjustment } = useStockAdjustmentStore()

  const [search, setSearch] = useState('')
  const [onlyLow, setOnlyLow] = useState(false)
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [adjusting, setAdjusting] = useState<StockRow | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const stockData = useMemo(
    () => computeStock(products, purchases, sales, adjustments),
    [products, purchases, sales, adjustments],
  )

  const filtered = useMemo(() => {
    let rows = stockData
    if (onlyLow) rows = rows.filter((r) => r.isLow || r.currentStock <= 0)
    if (search.trim()) rows = rows.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    return rows
  }, [stockData, search, onlyLow])

  const totals = useMemo(
    () => ({
      totalStockValue: stockData.reduce((s, p) => s + p.stockValue, 0),
      totalPotentialProfit: stockData.reduce((s, p) => s + p.potentialProfit, 0),
      lowCount: stockData.filter((r) => r.isLow).length,
      negativeCount: stockData.filter((r) => r.currentStock < 0).length,
    }),
    [stockData],
  )

  const openEdit = (p: Product | 'new') => {
    setEditing(p)
    setForm(p === 'new' ? emptyForm() : toForm(p))
  }

  const saveProduct = (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      name: form.name.trim(),
      unit: form.unit.trim() || 'কেজি',
      units_per_bag: form.units_per_bag ? Number(form.units_per_bag) : undefined,
      opening_stock: Number(form.opening_stock) || 0,
      purchase_price: Number(form.purchase_price) || 0,
      sale_price: Number(form.sale_price) || 0,
      min_stock: Number(form.min_stock) || 0,
    }
    if (!data.name) return
    if (editing === 'new') {
      addProduct({ ...data, branch_id: user?.branch_id || 'branch-1' })
    } else if (editing) {
      updateProduct(editing.id, data)
    }
    setEditing(null)
  }

  return (
    <div className="pb-24">
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-10 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">স্টক হিসাব</h2>
        <div className="flex gap-2">
          <button className="btn-secondary !py-1.5 !px-2.5 text-xs flex items-center gap-1" onClick={() => setShowHistory(true)}>
            <History size={14} /> সমন্বয়
          </button>
          <button className="btn-primary !py-1.5 !px-2.5 text-xs flex items-center gap-1" onClick={() => openEdit('new')}>
            <Plus size={14} /> নতুন পণ্য
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="card bg-purple-50">
            <p className="text-xs text-purple-600">মোট স্টক মূল্য</p>
            <p className="text-lg font-bold text-purple-700">৳ {bn(totals.totalStockValue)}</p>
          </div>
          <div className="card bg-green-50">
            <p className="text-xs text-green-600">সম্ভাব্য লাভ</p>
            <p className="text-lg font-bold text-green-700">৳ {bn(totals.totalPotentialProfit)}</p>
          </div>
        </div>

        {(totals.lowCount > 0 || totals.negativeCount > 0) && (
          <button
            onClick={() => setOnlyLow((v) => !v)}
            className={`w-full card flex items-center gap-3 text-left border ${
              onlyLow ? 'bg-red-100 border-red-300' : 'bg-red-50 border-red-200'
            }`}
          >
            <AlertTriangle className="text-red-600 shrink-0" size={20} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-700">
                {totals.lowCount > 0 && `${bn(totals.lowCount)}টি পণ্যের স্টক কম`}
                {totals.lowCount > 0 && totals.negativeCount > 0 && ' • '}
                {totals.negativeCount > 0 && `${bn(totals.negativeCount)}টি ঋণাত্মক`}
              </p>
              <p className="text-xs text-red-500">{onlyLow ? 'সব পণ্য দেখতে ট্যাপ করুন' : 'শুধু এগুলো দেখতে ট্যাপ করুন'}</p>
            </div>
          </button>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="পণ্য খুঁজুন..."
            className="input-field pl-10"
          />
        </div>

        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Package size={40} className="mx-auto mb-2 opacity-50" />
              <p>কোনো পণ্য পাওয়া যায়নি</p>
            </div>
          ) : (
            filtered.map((item) => (
              <div key={item.id} className={`card ${item.isLow || item.currentStock < 0 ? 'border-red-200' : ''}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-sm text-gray-800">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.unit} • ক্রয় ৳{item.purchase_price} • বিক্রি ৳{item.sale_price}
                      {item.min_stock ? ` • ন্যূনতম ${bn(item.min_stock)}` : ''}
                    </p>
                  </div>
                  <div
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      item.currentStock < 0
                        ? 'bg-red-100 text-red-700'
                        : item.isLow
                        ? 'bg-orange-100 text-orange-700'
                        : item.currentStock > 0
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {bn(item.currentStock)} {item.unit}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-xs text-gray-500">
                  <div>
                    <p>প্রারম্ভিক</p>
                    <p className="font-medium text-gray-700">{bn(item.opening_stock)}</p>
                  </div>
                  <div>
                    <p>ক্রয়</p>
                    <p className="font-medium text-gray-700">{bn(item.totalPurchased)}</p>
                  </div>
                  <div>
                    <p>বিক্রি</p>
                    <p className="font-medium text-gray-700">{bn(item.totalSold)}</p>
                  </div>
                  <div>
                    <p>সমন্বয়</p>
                    <p className={`font-medium ${item.totalAdjusted < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                      {item.totalAdjusted > 0 ? '+' : ''}
                      {bn(item.totalAdjusted)}
                    </p>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t flex items-center justify-between text-xs">
                  <span className="text-gray-500">
                    স্টক মূল্য: <strong className="text-gray-700">৳{bn(item.stockValue)}</strong>
                  </span>
                  <div className="flex gap-1">
                    <button className="p-1.5 rounded-lg text-teal-700 hover:bg-teal-50" title="সম্পাদনা" onClick={() => openEdit(item)}>
                      <Pencil size={15} />
                    </button>
                    <button className="p-1.5 rounded-lg text-orange-700 hover:bg-orange-50" title="স্টক সমন্বয়" onClick={() => setAdjusting(item)}>
                      <SlidersHorizontal size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Product edit / new modal ── */}
      {editing && (
        <Modal title={editing === 'new' ? 'নতুন পণ্য' : 'পণ্য সম্পাদনা'} onClose={() => setEditing(null)}>
          <form className="space-y-3" onSubmit={saveProduct}>
            <Field label="পণ্যের নাম">
              <input required className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="একক">
                <input className="input-field" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              </Field>
              <Field label="প্রতি বস্তায় (কেজি)">
                <input type="number" className="input-field" value={form.units_per_bag} onChange={(e) => setForm({ ...form, units_per_bag: e.target.value })} />
              </Field>
              <Field label="ক্রয়মূল্য">
                <input type="number" step="0.01" className="input-field" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
              </Field>
              <Field label="বিক্রয়মূল্য">
                <input type="number" step="0.01" className="input-field" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
              </Field>
              <Field label="প্রারম্ভিক স্টক">
                <input type="number" step="0.001" className="input-field" value={form.opening_stock} onChange={(e) => setForm({ ...form, opening_stock: e.target.value })} />
              </Field>
              <Field label="ন্যূনতম স্টক (অ্যালার্ট)">
                <input type="number" step="0.001" className="input-field" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
              </Field>
            </div>
            <p className="text-[11px] text-gray-500">ন্যূনতম স্টক ০ রাখলে অ্যালার্ট দেখাবে না। বর্তমান স্টকের ভুল ঠিক করতে "স্টক সমন্বয়" ব্যবহার করুন।</p>
            <button className="btn-primary w-full">সংরক্ষণ</button>
          </form>
        </Modal>
      )}

      {/* ── Adjustment modal ── */}
      {adjusting && (
        <AdjustModal
          row={adjusting}
          onClose={() => setAdjusting(null)}
          onSave={(qty, reason, note) => {
            addAdjustment({
              date: new Date().toISOString().slice(0, 10),
              product_id: adjusting.id,
              product_name: adjusting.name,
              quantity: qty,
              unit: adjusting.unit,
              reason,
              note: note || undefined,
              branch_id: adjusting.branch_id,
              created_by: user?.id || '',
            })
            setAdjusting(null)
          }}
        />
      )}

      {/* ── Adjustment history ── */}
      {showHistory && (
        <Modal title="স্টক সমন্বয়ের ইতিহাস" onClose={() => setShowHistory(false)}>
          {adjustments.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">কোনো সমন্বয় নেই</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {adjustments.map((a) => (
                <div key={a.id} className="bg-gray-50 rounded-lg p-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-800">{a.product_name}</span>
                    <span className={`font-bold ${a.quantity < 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {a.quantity > 0 ? '+' : ''}
                      {bn(a.quantity)} {a.unit}
                    </span>
                  </div>
                  <p className="text-gray-500">
                    {a.date} • {a.reason}
                    {a.note ? ` • ${a.note}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

function AdjustModal({
  row,
  onClose,
  onSave,
}: {
  row: StockRow
  onClose: () => void
  onSave: (qty: number, reason: StockAdjustmentReason, note: string) => void
}) {
  const [mode, setMode] = useState<'decrease' | 'increase' | 'set'>('decrease')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState<StockAdjustmentReason>('ক্ষয়')
  const [note, setNote] = useState('')

  const n = Number(amount)
  const delta = mode === 'set' ? n - row.currentStock : mode === 'decrease' ? -n : n
  const valid = amount !== '' && !Number.isNaN(n) && n >= 0 && delta !== 0

  return (
    <Modal title={`স্টক সমন্বয় — ${row.name}`} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) onSave(Math.round(delta * 1000) / 1000, reason, note.trim())
        }}
      >
        <p className="text-sm text-gray-600">
          বর্তমান স্টক: <strong>{bn(row.currentStock)} {row.unit}</strong>
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['decrease', 'কমান'],
              ['increase', 'বাড়ান'],
              ['set', 'গণনা অনুযায়ী'],
            ] as const
          ).map(([m, label]) => (
            <button
              type="button"
              key={m}
              className={mode === m ? 'btn-primary !py-2 text-xs' : 'btn-secondary !py-2 text-xs'}
              onClick={() => {
                setMode(m)
                if (m === 'set') setReason('গণনা সংশোধন')
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <Field label={mode === 'set' ? `প্রকৃত স্টক (${row.unit})` : `পরিমাণ (${row.unit})`}>
          <input type="number" step="0.001" min="0" required className="input-field" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="কারণ">
          <select className="input-field" value={reason} onChange={(e) => setReason(e.target.value as StockAdjustmentReason)}>
            {REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="মন্তব্য (ঐচ্ছিক)">
          <input className="input-field" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {valid && (
          <p className={`text-sm font-medium ${delta < 0 ? 'text-red-600' : 'text-green-700'}`}>
            পরিবর্তন: {delta > 0 ? '+' : ''}
            {bn(delta)} {row.unit} → নতুন স্টক {bn(row.currentStock + delta)} {row.unit}
          </p>
        )}
        <button className="btn-primary w-full" disabled={!valid}>
          সমন্বয় সংরক্ষণ
        </button>
      </form>
    </Modal>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-gray-600">
      {label}
      {children}
    </label>
  )
}
