import { useState, useMemo } from 'react'
import { useProductStore } from '../stores/productStore'
import { usePurchaseStore } from '../stores/purchaseStore'
import { useAuthStore } from '../stores/authStore'
import { Search, CheckCircle, Plus } from 'lucide-react'

export default function Purchases() {
  const products = useProductStore((s) => s.products)
  const updateProduct = useProductStore((s) => s.updateProduct)
  const addPurchase = usePurchaseStore((s) => s.addPurchase)
  const user = useAuthStore((s) => s.user)

  const [search, setSearch] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [paymentType, setPaymentType] = useState<'নগদ' | 'বাকি'>('নগদ')
  const [supplier, setSupplier] = useState('')
  const [note, setNote] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products
    return products.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [products, search])

  const selectedProduct = products.find((p) => p.id === selectedProductId)

  const total = useMemo(() => {
    const qty = parseFloat(quantity) || 0
    const pr = parseFloat(price) || 0
    return qty * pr
  }, [quantity, price])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduct || !quantity || !price) return

    const qty = parseFloat(quantity)
    const pr = parseFloat(price)
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(pr) || pr < 0 || (paymentType === 'বাকি' && !supplier.trim())) return

    addPurchase({
      date: new Date().toISOString(),
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      quantity: qty,
      unit: selectedProduct.unit,
      purchase_price: pr,
      total: qty * pr,
      payment_type: paymentType,
      supplier: supplier.trim() || undefined,
      branch_id: user?.branch_id || 'branch-1',
      note: note.trim() || undefined,
    })

    // Update product purchase price if changed
    if (pr !== selectedProduct.purchase_price) {
      updateProduct(selectedProduct.id, { purchase_price: pr })
    }

    // Reset form
    setSelectedProductId('')
    setQuantity('')
    setPrice('')
    setSupplier('')
    setNote('')
    setSearch('')
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 2000)
  }

  return (
    <div className="pb-24">
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-10">
        <h2 className="text-lg font-semibold text-gray-800">ক্রয় এন্ট্রি</h2>
      </div>

      {showSuccess && (
        <div className="fixed top-20 left-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <CheckCircle size={20} />
          <span>ক্রয় সফলভাবে সেভ হয়েছে!</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {/* Search */}
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

        {/* Product List */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => {
                setSelectedProductId(product.id)
                setPrice(product.purchase_price ? String(product.purchase_price) : '')
              }}
              className={`w-full p-3 rounded-lg border text-left transition-all ${
                selectedProductId === product.id
                  ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-200'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <p className="font-medium text-sm">{product.name}</p>
              <p className="text-xs text-gray-500">
                {product.unit} • ক্রয়মূল্য: ৳{product.purchase_price || 0}
              </p>
            </button>
          ))}
        </div>

        {selectedProduct && (
          <div className="card space-y-3">
            <p className="font-medium text-primary-700">{selectedProduct.name}</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">পরিমাণ ({selectedProduct.unit})</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="input-field"
                  required
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">প্রতি ইউনিট ক্রয়মূল্য</label>
                <input
                  type="number"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="input-field"
                  required
                  placeholder="0"
                />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 flex justify-between items-center">
              <span className="text-sm text-gray-600">মোট ক্রয়</span>
              <span className="text-lg font-bold text-primary-700">
                ৳ {total.toLocaleString('bn-BD')}
              </span>
            </div>

            <div>
              <label className="text-xs text-gray-500">পেমেন্ট</label>
              <select className="input-field mb-3" value={paymentType} onChange={e => setPaymentType(e.target.value as typeof paymentType)}><option>নগদ</option><option>বাকি</option></select>
              <label className="text-xs text-gray-500">সরবরাহকারী (বাকি হলে আবশ্যক; একই নাম ব্যবহার করুন)</label>
              <input
                type="text"
                required={paymentType === 'বাকি'}
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="input-field"
                placeholder="ঐচ্ছিক"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">মন্তব্য</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="input-field"
                placeholder="ঐচ্ছিক"
              />
            </div>

            <button type="submit" className="btn-primary w-full py-3 flex items-center justify-center gap-2">
              <Plus size={20} />
              ক্রয় সেভ করুন
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
