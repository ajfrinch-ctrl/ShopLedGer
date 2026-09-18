import { useState, useMemo } from 'react'
import { useProductStore } from '../stores/productStore'
import { usePurchaseStore } from '../stores/purchaseStore'
import { useActiveBranchId } from '../stores/uiStore'
import { displayName, matchesProduct, normalizePrefix } from '../lib/productCode'
import { nowLocalISO } from '../lib/profitLoss'
import { yymmdd, nextIdSync } from '../lib/idGenerator'
import type { Product } from '../types'
import { Search, CheckCircle, Plus, Trash2, X, PackagePlus, Tag } from 'lucide-react'

interface InvoiceLine {
  product: Product
  quantity: string
  price: string
}

const bn = (n: number) => n.toLocaleString('bn-BD')

export default function Purchases() {
  const { products, updateProduct } = useProductStore()
  const addPurchase = usePurchaseStore((s) => s.addPurchase)
  const activeBranch = useActiveBranchId()

  const [search, setSearch] = useState('')
  const [lines, setLines] = useState<InvoiceLine[]>([])
  const [paymentType, setPaymentType] = useState<'নগদ' | 'বাকি'>('নগদ')
  const [supplier, setSupplier] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [note, setNote] = useState('')
  const [showSuccess, setShowSuccess] = useState('')
  const [showNewProduct, setShowNewProduct] = useState(false)

  const filteredProducts = useMemo(
    () => products.filter((p) => matchesProduct(p, search)).slice(0, 30),
    [products, search],
  )

  const supplierSuggestions = useMemo(() => {
    const all = usePurchaseStore.getState().purchases.map((p) => p.supplier).filter(Boolean) as string[]
    return [...new Set(all)].slice(0, 20)
  }, [])

  const addLine = (product: Product) => {
    setLines((prev) => {
      if (prev.some((l) => l.product.id === product.id)) return prev
      return [...prev, { product, quantity: '', price: product.purchase_price ? String(product.purchase_price) : '' }]
    })
    setSearch('')
  }

  const setLine = (id: string, patch: Partial<InvoiceLine>) =>
    setLines((prev) => prev.map((l) => (l.product.id === id ? { ...l, ...patch } : l)))

  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.product.id !== id))

  const lineTotal = (l: InvoiceLine) => (parseFloat(l.quantity) || 0) * (parseFloat(l.price) || 0)
  const grandTotal = lines.reduce((s, l) => s + lineTotal(l), 0)

  const invalidLine = lines.find((l) => {
    const q = parseFloat(l.quantity)
    const p = parseFloat(l.price)
    return !Number.isFinite(q) || q <= 0 || !Number.isFinite(p) || p < 0
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (lines.length === 0 || invalidLine) return
    if (paymentType === 'বাকি' && !supplier.trim()) return

    const existingInv = usePurchaseStore.getState().purchases.map(p => p.invoice_id || '').filter(Boolean) as string[]
    const invoice_id = nextIdSync('INV', yymmdd(new Date()), existingInv, 3)
    const date = nowLocalISO()
    const sup = supplier.trim() || undefined

    for (const l of lines) {
      const qty = parseFloat(l.quantity)
      const pr = parseFloat(l.price)
      addPurchase({
        date,
        product_id: l.product.id,
        product_name: displayName(l.product),
        quantity: qty,
        unit: l.product.unit,
        purchase_price: pr,
        total: qty * pr,
        payment_type: paymentType,
        supplier: sup,
        invoice_id,
        invoice_no: invoiceNo.trim() || undefined,
        branch_id: activeBranch || 'branch-1',
        note: note.trim() || undefined,
      })
      // সর্বশেষ ক্রয়মূল্য পণ্যে আপডেট
      if (pr !== l.product.purchase_price) updateProduct(l.product.id, { purchase_price: pr })
    }

    setLines([])
    setSupplier('')
    setInvoiceNo('')
    setNote('')
    setShowSuccess(`${bn(lines.length)}টি পণ্যের ক্রয় সেভ হয়েছে — ৳ ${bn(grandTotal)}`)
    setTimeout(() => setShowSuccess(''), 2500)
  }

  return (
    <div className="pb-24">
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-10 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">ক্রয় এন্ট্রি (সাপ্লাইয়ার চালান)</h2>
        <button type="button" className="btn-secondary !py-1.5 !px-2.5 text-xs flex items-center gap-1" onClick={() => setShowNewProduct(true)}>
          <PackagePlus size={14} /> নতুন পণ্য
        </button>
      </div>

      {showSuccess && (
        <div className="fixed top-20 left-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <CheckCircle size={20} />
          <span>{showSuccess}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {/* Supplier / invoice header */}
        <div className="card space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500">সরবরাহকারী {paymentType === 'বাকি' && <span className="text-red-500">*</span>}</label>
              <input
                list="supplier-list"
                type="text"
                required={paymentType === 'বাকি'}
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="input-field"
                placeholder="কোম্পানি/ডিলারের নাম (একই নাম ব্যবহার করুন)"
              />
              <datalist id="supplier-list">
                {supplierSuggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="text-xs text-gray-500">চালান নম্বর</label>
              <input type="text" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className="input-field" placeholder="ঐচ্ছিক" />
            </div>
            <div>
              <label className="text-xs text-gray-500">পেমেন্ট</label>
              <select className="input-field" value={paymentType} onChange={(e) => setPaymentType(e.target.value as typeof paymentType)}>
                <option>নগদ</option>
                <option>বাকি</option>
              </select>
            </div>
          </div>
        </div>

        {/* Product search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="পণ্যের নাম, কোম্পানি বা কোড (যেমন OIL-001)..."
            className="input-field pl-10"
          />
        </div>

        {search.trim() && (
          <div className="card !p-2 space-y-1 max-h-60 overflow-y-auto">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addLine(product)}
                className="w-full p-2.5 rounded-lg text-left hover:bg-primary-50 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{displayName(product)}</p>
                  <p className="text-xs text-gray-500">
                    {product.unit} • সর্বশেষ ক্রয়মূল্য ৳{product.purchase_price || 0}
                  </p>
                </div>
                <CodeBadge code={product.code} />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowNewProduct(true)}
              className="w-full p-2.5 rounded-lg text-left text-sm text-teal-700 font-medium hover:bg-teal-50 flex items-center gap-2 border-t"
            >
              <PackagePlus size={16} /> "{search}" নতুন পণ্য হিসেবে যোগ করুন
            </button>
          </div>
        )}

        {/* Invoice lines */}
        {lines.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-6">উপরে খুঁজে পণ্য যোগ করুন — একই চালানে একাধিক পণ্য দেওয়া যাবে</p>
        ) : (
          <div className="space-y-2">
            {lines.map((l) => (
              <div key={l.product.id} className="card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-gray-800 truncate">{displayName(l.product)}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <CodeBadge code={l.product.code} />
                      <span className="text-xs text-gray-500">{l.product.unit}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => removeLine(l.product.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 items-end">
                  <div>
                    <label className="text-[11px] text-gray-500">পরিমাণ ({l.product.unit})</label>
                    <input type="number" min="0.001" step="0.001" required value={l.quantity} onChange={(e) => setLine(l.product.id, { quantity: e.target.value })} className="input-field" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500">দর</label>
                    <input type="number" min="0" step="0.01" required value={l.price} onChange={(e) => setLine(l.product.id, { price: e.target.value })} className="input-field" placeholder="0" />
                  </div>
                  <div className="text-right pb-2">
                    <p className="text-[11px] text-gray-500">মোট</p>
                    <p className="font-bold text-primary-700">৳ {bn(lineTotal(l))}</p>
                  </div>
                </div>
              </div>
            ))}

            <div className="card space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">চালানের মোট ({bn(lines.length)}টি পণ্য)</span>
                <span className="text-xl font-bold text-primary-700">৳ {bn(grandTotal)}</span>
              </div>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="input-field" placeholder="মন্তব্য (ঐচ্ছিক)" />
              <button type="submit" disabled={!!invalidLine} className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50">
                <Plus size={20} />
                চালান সেভ করুন
              </button>
            </div>
          </div>
        )}
      </form>

      {showNewProduct && (
        <NewProductModal
          initialName={search}
          onClose={() => setShowNewProduct(false)}
          onCreated={(p) => {
            setShowNewProduct(false)
            addLine(p)
          }}
        />
      )}
    </div>
  )
}

export function CodeBadge({ code }: { code?: string }) {
  if (!code) return null
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded shrink-0">
      <Tag size={10} /> {code}
    </span>
  )
}

/* ─────────────────────────────────────────────
   নতুন পণ্য (কোম্পানি অনুযায়ী ভ্যারিয়েন্ট) — অটো কোড
   ───────────────────────────────────────────── */
export function NewProductModal({
  initialName = '',
  onClose,
  onCreated,
}: {
  initialName?: string
  onClose: () => void
  onCreated: (p: Product) => void
}) {
  const { products, categories, addProduct, addCategory, previewCode } = useProductStore()
  const activeBranch = useActiveBranchId()

  const [name, setName] = useState(initialName)
  const [company, setCompany] = useState('')
  const [category, setCategory] = useState(categories[0]?.name || '')
  const [unit, setUnit] = useState('কেজি')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [minStock, setMinStock] = useState('')
  const [customCode, setCustomCode] = useState('')
  const [newCat, setNewCat] = useState<{ name: string; prefix: string } | null>(null)
  const [error, setError] = useState('')

  const autoCode = previewCode(category)
  const finalCode = customCode.trim().toUpperCase() || autoCode

  const companies = useMemo(() => [...new Set(products.map((p) => p.company).filter(Boolean) as string[])], [products])
  const duplicate = products.find(
    (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase() && (p.company || '').trim().toLowerCase() === company.trim().toLowerCase(),
  )

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) return
    if (duplicate) {
      setError(`এই পণ্যটি আগে থেকেই আছে (${duplicate.code})`)
      return
    }
    if (customCode.trim() && products.some((p) => p.code?.toUpperCase() === finalCode)) {
      setError('এই কোডটি অন্য পণ্যে ব্যবহৃত হয়েছে')
      return
    }
    const p = addProduct({
      name: name.trim(),
      company: company.trim() || undefined,
      category: category || undefined,
      code: customCode.trim() ? finalCode : undefined,
      unit: unit.trim() || 'কেজি',
      opening_stock: 0,
      purchase_price: Number(purchasePrice) || 0,
      sale_price: Number(salePrice) || 0,
      min_stock: Number(minStock) || 0,
      branch_id: activeBranch || 'branch-1',
    })
    onCreated(p)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-800">নতুন পণ্য যোগ</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X size={18} />
          </button>
        </div>

        <form className="space-y-3" onSubmit={submit}>
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-teal-700">প্রডাক্ট কোড {customCode.trim() ? '(নিজস্ব)' : '(অটো)'}</p>
              <p className="font-mono font-bold text-teal-800 text-lg">{finalCode}</p>
            </div>
            <input className="input-field !w-32 text-xs font-mono" placeholder="নিজে দিন?" value={customCode} onChange={(e) => setCustomCode(e.target.value)} />
          </div>

          <label className="block text-xs text-gray-600">
            ক্যাটাগরি
            <div className="flex gap-2">
              <select
                className="input-field"
                value={newCat ? '__new' : category}
                onChange={(e) => (e.target.value === '__new' ? setNewCat({ name: '', prefix: '' }) : (setNewCat(null), setCategory(e.target.value)))}
              >
                {categories.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.prefix})
                  </option>
                ))}
                <option value="__new">+ নতুন ক্যাটাগরি</option>
              </select>
            </div>
          </label>
          {newCat && (
            <div className="grid grid-cols-3 gap-2 bg-gray-50 p-2 rounded-lg">
              <input className="input-field col-span-2" placeholder="ক্যাটাগরির নাম" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
              <input className="input-field font-mono uppercase" placeholder="প্রিফিক্স" value={newCat.prefix} onChange={(e) => setNewCat({ ...newCat, prefix: e.target.value })} />
              <button
                type="button"
                className="btn-secondary col-span-3 !py-1.5 text-xs"
                disabled={!newCat.name.trim()}
                onClick={() => {
                  const c = addCategory(newCat.name, newCat.prefix || newCat.name)
                  setCategory(c.name)
                  setNewCat(null)
                }}
              >
                ক্যাটাগরি যোগ করুন → কোড হবে {normalizePrefix(newCat.prefix || newCat.name)}-001
              </button>
            </div>
          )}

          <label className="block text-xs text-gray-600">
            পণ্যের নাম <span className="text-red-500">*</span>
            <input required className="input-field" placeholder="যেমন সয়াবিন তেল ৫ লিটার" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-xs text-gray-600">
            কোম্পানি / ব্র্যান্ড
            <input list="company-list" className="input-field" placeholder="যেমন তীর, রূপচাঁদা, ফ্রেশ" value={company} onChange={(e) => setCompany(e.target.value)} />
            <datalist id="company-list">
              {companies.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          {duplicate && <p className="text-xs text-red-600">⚠ "{displayName(duplicate)}" আগে থেকেই আছে — কোড {duplicate.code}</p>}

          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-gray-600">
              একক
              <input className="input-field" value={unit} onChange={(e) => setUnit(e.target.value)} />
            </label>
            <label className="block text-xs text-gray-600">
              ন্যূনতম স্টক
              <input type="number" className="input-field" value={minStock} onChange={(e) => setMinStock(e.target.value)} placeholder="0" />
            </label>
            <label className="block text-xs text-gray-600">
              ক্রয়মূল্য
              <input type="number" step="0.01" className="input-field" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="0" />
            </label>
            <label className="block text-xs text-gray-600">
              বিক্রয়মূল্য
              <input type="number" step="0.01" className="input-field" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="0" />
            </label>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={!!duplicate}>
            পণ্য তৈরি করুন
          </button>
        </form>
      </div>
    </div>
  )
}
