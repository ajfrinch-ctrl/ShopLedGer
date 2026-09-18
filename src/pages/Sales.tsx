import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProductStore } from '../stores/productStore'
import { useSalesStore, createSaleItem } from '../stores/salesStore'
import { useAuthStore } from '../stores/authStore'
import type { SaleItem } from '../types'
import { Plus, Trash2, Search, CheckCircle } from 'lucide-react'

export default function Sales() {
  const products = useProductStore((s) => s.products)
  const addSale = useSalesStore((s) => s.addSale)
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [selectedItems, setSelectedItems] = useState<SaleItem[]>([])
  const [paymentType, setPaymentType] = useState<'নগদ' | 'বাকি'>('নগদ')
  const [customerName, setCustomerName] = useState('')
  const [note, setNote] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [editingPrice, setEditingPrice] = useState<Record<string, number>>({})

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products.slice(0, 12)
    return products.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [products, search])

  const totals = useMemo(() => {
    const totalAmount = selectedItems.reduce((sum, i) => sum + i.total, 0)
    const totalProfit = selectedItems.reduce((sum, i) => sum + i.profit, 0)
    return { totalAmount, totalProfit }
  }, [selectedItems])

  const addItem = (productId: string) => {
    const product = products.find((p) => p.id === productId)
    if (!product) return

    const existing = selectedItems.find((i) => i.product_id === productId)
    if (existing) {
      // Increase quantity
      setSelectedItems((items) =>
        items.map((i) =>
          i.product_id === productId
            ? createSaleItem(
                i.product_id,
                i.product_name,
                i.quantity + 1,
                i.unit,
                i.sale_price,
                i.purchase_price
              )
            : i
        )
      )
    } else {
      const price = editingPrice[productId] ?? product.sale_price
      setSelectedItems((items) => [
        ...items,
        createSaleItem(
          product.id,
          product.name,
          1,
          product.unit,
          price,
          product.purchase_price
        ),
      ])
    }
  }

  const updateQuantity = (productId: string, qty: number) => {
    if (qty <= 0) {
      removeItem(productId)
      return
    }
    setSelectedItems((items) =>
      items.map((i) =>
        i.product_id === productId
          ? createSaleItem(
              i.product_id,
              i.product_name,
              qty,
              i.unit,
              i.sale_price,
              i.purchase_price
            )
          : i
      )
    )
  }

  const updatePrice = (productId: string, price: number) => {
    setEditingPrice((prev) => ({ ...prev, [productId]: price }))
    setSelectedItems((items) =>
      items.map((i) =>
        i.product_id === productId
          ? createSaleItem(
              i.product_id,
              i.product_name,
              i.quantity,
              i.unit,
              price,
              i.purchase_price
            )
          : i
      )
    )
  }

  const removeItem = (productId: string) => {
    setSelectedItems((items) => items.filter((i) => i.product_id !== productId))
  }

  const handleSubmit = () => {
    if (selectedItems.length === 0) return
    if (paymentType === 'বাকি' && !customerName.trim()) {
      alert('বাকি বিক্রির জন্য ক্রেতার নাম দিন')
      return
    }

    addSale({
      date: new Date().toISOString(),
      items: selectedItems,
      total_amount: totals.totalAmount,
      total_profit: totals.totalProfit,
      payment_type: paymentType,
      customer_name: customerName.trim() || undefined,
      branch_id: user?.branch_id || 'branch-1',
      created_by: user?.id || 'unknown',
      note: note.trim() || undefined,
    })

    setShowSuccess(true)
    setSelectedItems([])
    setCustomerName('')
    setNote('')
    setPaymentType('নগদ')

    setTimeout(() => {
      setShowSuccess(false)
    }, 2000)
  }

  return (
    <div className="pb-32">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-10">
        <h2 className="text-lg font-semibold text-gray-800">বিক্রি এন্ট্রি</h2>
      </div>

      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-20 left-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-pulse">
          <CheckCircle size={20} />
          <span>বিক্রি সফলভাবে সেভ হয়েছে!</span>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Search Products */}
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

        {/* Product Grid */}
        <div className="grid grid-cols-2 gap-2">
          {filteredProducts.map((product) => {
            const selected = selectedItems.find((i) => i.product_id === product.id)
            return (
              <button
                key={product.id}
                onClick={() => addItem(product.id)}
                className={`p-3 rounded-lg border text-left transition-all active:scale-95 ${
                  selected
                    ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-200'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <p className="font-medium text-sm text-gray-800 line-clamp-2">{product.name}</p>
                <p className="text-xs text-gray-500 mt-1">{product.unit}</p>
                {selected && (
                  <p className="text-xs text-primary-700 font-medium mt-1">
                    {selected.quantity} × ৳{selected.sale_price}
                  </p>
                )}
              </button>
            )
          })}
        </div>

        {/* Selected Items */}
        {selectedItems.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium text-gray-700">নির্বাচিত পণ্য ({selectedItems.length})</h3>

            {selectedItems.map((item) => (
              <div key={item.product_id} className="card space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{item.product_name}</p>
                    <p className="text-xs text-gray-500">{item.unit}</p>
                  </div>
                  <button
                    onClick={() => removeItem(item.product_id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">পরিমাণ</label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateQuantity(item.product_id, parseFloat(e.target.value) || 0)
                      }
                      className="input-field text-sm py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">দর (৳)</label>
                    <input
                      type="number"
                      min="0"
                      value={item.sale_price}
                      onChange={(e) =>
                        updatePrice(item.product_id, parseFloat(e.target.value) || 0)
                      }
                      className="input-field text-sm py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">মোট</label>
                    <p className="font-semibold text-primary-700 py-1.5">
                      ৳{item.total.toLocaleString('bn-BD')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Payment & Customer */}
        {selectedItems.length > 0 && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">পেমেন্ট</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentType('নগদ')}
                  className={`py-2.5 rounded-lg border font-medium transition-all ${\n                    paymentType === 'নগদ'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200'
                  }`}
                >
                  নগদ
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType('বাকি')}
                  className={`py-2.5 rounded-lg border font-medium transition-all ${\n                    paymentType === 'বাকি'
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-200'
                  }`}
                >
                  বাকি
                </button>
              </div>
            </div>

            {paymentType === 'বাকি' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ক্রেতার নাম *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="ক্রেতার নাম লিখুন"
                  className="input-field"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">মন্তব্য</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="ঐচ্ছিক"
                className="input-field"
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Summary Bar */}
      {selectedItems.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 bg-white border-t shadow-lg p-4 z-10">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-gray-500">মোট বিক্রি</p>
              <p className="text-xl font-bold text-gray-900">
                ৳ {totals.totalAmount.toLocaleString('bn-BD')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">লাভ</p>
              <p className="text-lg font-semibold text-green-600">
                ৳ {totals.totalProfit.toLocaleString('bn-BD')}
              </p>
            </div>
          </div>
          <button
            onClick={handleSubmit}
            className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            বিক্রি সেভ করুন
          </button>
        </div>
      )}
    </div>
  )
}
