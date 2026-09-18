import { useState, useMemo, useEffect, useCallback } from 'react'
import { useProductStore } from '../stores/productStore'
import { useSalesStore, createSaleItem } from '../stores/salesStore'
import { useCustomerStore } from '../stores/customerStore'
import { useAuthStore } from '../stores/authStore'
import type { SaleItem, Sale } from '../types'
import type { DbCustomer } from '../lib/db'
import SaleReceipt from '../components/SaleReceipt'
import {
  Search,
  ShoppingCart,
  Trash2,
  X,
  CheckCircle,
  ChevronUp,
  ChevronDown,
  UserPlus,
  History,
  Pencil,
} from 'lucide-react'

export default function Sales() {
  const products = useProductStore((s) => s.products)
  const { addSale, sales } = useSalesStore()
  const { customers, loadCustomers, addCustomer, searchCustomers } =
    useCustomerStore()
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<SaleItem[]>([])
  const [paymentType, setPaymentType] = useState<'নগদ' | 'বাকি'>('নগদ')
  const [selectedCustomer, setSelectedCustomer] =
    useState<DbCustomer | null>(null)
  const [note, setNote] = useState('')
  const [showCart, setShowCart] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustName, setNewCustName] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerList, setShowCustomerList] = useState(false)

  /* ── Products ── */
  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products.slice(0, 20)
    return products.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()),
    )
  }, [products, search])

  /* ── Customer filter ── */
  const filteredCustomers = useMemo(() => {
    return searchCustomers(customerSearch)
  }, [customerSearch, customers, searchCustomers])

  /* ── Cart totals ── */
  const cartTotals = useMemo(() => {
    const total = cart.reduce((sum, i) => sum + i.total, 0)
    const profit = cart.reduce((sum, i) => sum + i.profit, 0)
    return { total, profit }
  }, [cart])

  /* ── Today's sales ── */
  const todaySales = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return sales.filter((s) => s.date.startsWith(today))
  }, [sales])

  /* ── Add to cart ── */
  const addToCart = useCallback(
    (productId: string) => {
      const product = products.find((p) => p.id === productId)
      if (!product) return

      setCart((prev) => {
        const existing = prev.find((i) => i.product_id === productId)
        if (existing) {
          return prev.map((i) =>
            i.product_id === productId
              ? createSaleItem(
                  i.product_id,
                  i.product_name,
                  i.quantity + 1,
                  i.unit,
                  i.sale_price,
                  i.purchase_price,
                )
              : i,
          )
        }
        return [
          ...prev,
          createSaleItem(
            product.id,
            product.name,
            1,
            product.unit,
            product.sale_price,
            product.purchase_price,
          ),
        ]
      })
    },
    [products],
  )

  const updateQty = useCallback((productId: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.product_id !== productId))
      return
    }
    setCart((prev) =>
      prev.map((i) =>
        i.product_id === productId
          ? createSaleItem(
              i.product_id,
              i.product_name,
              qty,
              i.unit,
              i.sale_price,
              i.purchase_price,
            )
          : i,
      ),
    )
  }, [])

  const updatePrice = useCallback((productId: string, price: number) => {
    setCart((prev) =>
      prev.map((i) =>
        i.product_id === productId
          ? createSaleItem(
              i.product_id,
              i.product_name,
              i.quantity,
              i.unit,
              price,
              i.purchase_price,
            )
          : i,
      ),
    )
  }, [])

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((i) => i.product_id !== productId))
  }, [])

  /* ── Submit sale ── */
  const handleSubmit = () => {
    if (cart.length === 0) return
    if (paymentType === 'বাকি' && !selectedCustomer) {
      alert('বাকি বিক্রির জন্য ক্রেতা সিলেক্ট করুন')
      return
    }

    const sale: Omit<Sale, 'id' | 'created_at'> = {
      date: new Date().toISOString(),
      items: cart,
      total_amount: cartTotals.total,
      total_profit: cartTotals.profit,
      payment_type: paymentType,
      customer_id: selectedCustomer?.id,
      customer_name: selectedCustomer?.name,
      branch_id: user?.branch_id || 'branch-1',
      created_by: user?.id || 'unknown',
      note: note.trim() || undefined,
    }

    const id = addSale(sale)

    // Show receipt
    setCompletedSale({
      ...sale,
      id,
      created_at: new Date().toISOString(),
    })

    // Reset
    setCart([])
    setSelectedCustomer(null)
    setNote('')
    setPaymentType('নগদ')
    setShowCart(false)

    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 2000)
  }

  /* ── Add new customer ── */
  const handleAddCustomer = async () => {
    if (!newCustName.trim()) return
    const newCust = await addCustomer({
      name: newCustName.trim(),
      phone: newCustPhone.trim() || undefined,
      branch_id: user?.branch_id || 'branch-1',
    })
    setSelectedCustomer(newCust)
    setNewCustName('')
    setNewCustPhone('')
    setShowAddCustomer(false)
    setCustomerSearch('')
  }

  return (
    <div className="flex flex-col h-[calc(100vh-128px)]">
      {/* ── Top Bar ── */}
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-10 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">বিক্রি এন্ট্রি</h2>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
            title="আজকের বিক্রি"
          >
            <History size={20} />
          </button>
        </div>

        {/* Customer Select */}
        <div className="relative">
          {selectedCustomer ? (
            <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-xl px-3 py-2">
              <div>
                <span className="text-xs text-teal-600">ক্রেতা</span>
                <p className="text-sm font-semibold text-teal-800">
                  {selectedCustomer.name}
                  {selectedCustomer.phone && (
                    <span className="text-xs text-teal-600 ml-2">
                      ({selectedCustomer.phone})
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-1 hover:bg-teal-100 rounded-full"
              >
                <X size={16} className="text-teal-600" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    size={16}
                  />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value)
                      setShowCustomerList(true)
                    }}
                    onFocus={() => setShowCustomerList(true)}
                    placeholder="ক্রেতা খুঁজুন..."
                    className="w-full pl-9 pr-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-teal-500 text-sm"
                  />
                  {showCustomerList && (
                    <button
                      onClick={() => {
                        setShowCustomerList(false)
                        setCustomerSearch('')
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowAddCustomer(true)}
                  className="px-3 py-2.5 bg-teal-100 text-teal-700 rounded-xl hover:bg-teal-200 transition-colors"
                  title="নতুন ক্রেতা যোগ করুন"
                >
                  <UserPlus size={18} />
                </button>
              </div>

              {/* Customer Dropdown */}
              {showCustomerList && customerSearch && (
                <div className="absolute top-full left-0 right-12 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto z-20">
                  {filteredCustomers.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-3">
                      কোনো ক্রেতা পাওয়া যায়নি
                    </p>
                  ) : (
                    filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c)
                          setCustomerSearch('')
                          setShowCustomerList(false)
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-teal-50 transition-colors border-b last:border-0"
                      >
                        <p className="text-sm font-medium text-gray-800">
                          {c.name}
                        </p>
                        {c.phone && (
                          <p className="text-xs text-gray-500">{c.phone}</p>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Product Search */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="পণ্য খুঁজুন..."
            className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-teal-500 text-sm"
          />
        </div>
      </div>

      {/* ── History Panel ── */}
      {showHistory && (
        <div className="bg-gray-50 border-b px-4 py-3 max-h-60 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">
              আজকের বিক্রি ({todaySales.length}টি)
            </h3>
            <button
              onClick={() => setShowHistory(false)}
              className="p-1 hover:bg-gray-200 rounded-full"
            >
              <X size={16} />
            </button>
          </div>
          {todaySales.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              আজকে কোনো বিক্রি হয়নি
            </p>
          ) : (
            <div className="space-y-2">
              {todaySales.map((sale) => (
                <SaleHistoryCard key={sale.id} sale={sale} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Product Grid ── */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2">
          {filteredProducts.map((product) => {
            const inCart = cart.find((i) => i.product_id === product.id)
            return (
              <button
                key={product.id}
                onClick={() => addToCart(product.id)}
                className={`p-3 rounded-xl border-2 text-left transition-all active:scale-[0.97] ${
                  inCart
                    ? 'border-teal-500 bg-teal-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <p className="font-medium text-sm text-gray-800 line-clamp-2 leading-tight">
                  {product.name}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500">{product.unit}</span>
                  <span className="text-xs font-semibold text-teal-700">
                    ৳{product.sale_price || 0}
                  </span>
                </div>
                {inCart && (
                  <div className="mt-1.5 flex items-center gap-1">
                    <span className="text-xs bg-teal-600 text-white px-2 py-0.5 rounded-full font-medium">
                      {inCart.quantity}টি
                    </span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
        {filteredProducts.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <ShoppingCart size={40} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">কোনো পণ্য পাওয়া যায়নি</p>
          </div>
        )}
      </div>

      {/* ── Floating Cart Bar ── */}
      {cart.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-20">
          <div className="mx-3">
            <button
              onClick={() => setShowCart(!showCart)}
              className="w-full bg-teal-700 hover:bg-teal-800 text-white rounded-2xl shadow-xl shadow-teal-700/30 px-5 py-3.5 flex items-center justify-between transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ShoppingCart size={22} />
                  <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {cart.length}
                  </span>
                </div>
                <div className="text-left">
                  <p className="text-xs text-teal-200">মোট</p>
                  <p className="text-lg font-bold">
                    ৳ {cartTotals.total.toLocaleString('bn-BD')}
                  </p>
                </div>
              </div>
              {showCart ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
            </button>
          </div>
        </div>
      )}

      {/* ── Cart Panel ── */}
      {showCart && cart.length > 0 && (
        <div className="fixed bottom-[4.5rem] left-0 right-0 bg-white border-t shadow-2xl z-20 max-h-[60vh] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold text-gray-800">
              কার্ট ({cart.length} পণ্য)
            </h3>
            <button
              onClick={() => setShowCart(false)}
              className="p-1 hover:bg-gray-100 rounded-full"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
            {cart.map((item) => (
              <div
                key={item.product_id}
                className="flex items-center gap-3 bg-gray-50 rounded-xl p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {item.product_name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateQty(
                          item.product_id,
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      className="w-16 px-2 py-1 border rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-300"
                    />
                    <span className="text-xs text-gray-500">{item.unit}</span>
                    <span className="text-xs text-gray-400">×</span>
                    <input
                      type="number"
                      min="0"
                      value={item.sale_price}
                      onChange={(e) =>
                        updatePrice(
                          item.product_id,
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      className="w-20 px-2 py-1 border rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-300"
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-teal-700 text-sm">
                    ৳{item.total.toLocaleString('bn-BD')}
                  </p>
                  <p className="text-xs text-green-600">
                    লাভ ৳{item.profit.toLocaleString('bn-BD')}
                  </p>
                </div>
                <button
                  onClick={() => removeFromCart(item.product_id)}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          {/* Payment & Submit */}
          <div className="px-4 pb-4 pt-2 border-t space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPaymentType('নগদ')}
                className={`py-2.5 rounded-xl border-2 font-semibold text-sm transition-all ${
                  paymentType === 'নগদ'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 text-gray-500'
                }`}
              >
                💵 নগদ
              </button>
              <button
                onClick={() => setPaymentType('বাকি')}
                className={`py-2.5 rounded-xl border-2 font-semibold text-sm transition-all ${
                  paymentType === 'বাকি'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 text-gray-500'
                }`}
              >
                📋 বাকি
              </button>
            </div>

            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="মন্তব্য (ঐচ্ছিক)"
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-500"
            />

            <button
              onClick={handleSubmit}
              className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-teal-600/30 transition-all active:scale-[0.98]"
            >
              <CheckCircle size={20} />
              বিক্রি সম্পন্ন — ৳ {cartTotals.total.toLocaleString('bn-BD')}
            </button>
          </div>
        </div>
      )}

      {/* ── Add Customer Modal ── */}
      {showAddCustomer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">
                নতুন ক্রেতা যোগ করুন
              </h3>
              <button
                onClick={() => setShowAddCustomer(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                নাম *
              </label>
              <input
                type="text"
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                placeholder="ক্রেতার নাম"
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                মোবাইল
              </label>
              <input
                type="tel"
                value={newCustPhone}
                onChange={(e) =>
                  setNewCustPhone(e.target.value.replace(/\D/g, '').slice(0, 11))
                }
                placeholder="01XXXXXXXXX"
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-teal-500"
              />
            </div>
            <button
              onClick={handleAddCustomer}
              disabled={!newCustName.trim()}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-colors"
            >
              সংরক্ষণ করুন
            </button>
          </div>
        </div>
      )}

      {/* ── Receipt Modal ── */}
      {completedSale && (
        <SaleReceipt
          sale={completedSale}
          onClose={() => setCompletedSale(null)}
        />
      )}

      {/* ── Success Toast ── */}
      {showSuccess && (
        <div className="fixed top-20 left-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <CheckCircle size={20} />
          <span className="font-medium">বিক্রি সফলভাবে সেভ হয়েছে!</span>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Sale History Card (for today's sales list)
   ───────────────────────────────────────────── */
function SaleHistoryCard({ sale }: { sale: Sale }) {
  const { deleteSale } = useSalesStore()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const time = new Date(sale.date).toLocaleTimeString('bn-BD', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const handleDelete = async () => {
    try {
      await deleteSale(sale.id)
      setConfirmDelete(false)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'বিক্রয় মুছে ফেলা যায়নি')
    }
  }

  return (
    <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{time}</span>
            {sale.customer_name && (
              <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
                {sale.customer_name}
              </span>
            )}
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                sale.payment_type === 'নগদ'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-orange-100 text-orange-700'
              }`}
            >
              {sale.payment_type}
            </span>
          </div>
          <p className="text-sm font-bold text-gray-800 mt-1">
            ৳ {sale.total_amount.toLocaleString('bn-BD')}
            <span className="text-xs font-normal text-gray-500 ml-2">
              ({sale.items.length} পণ্য)
            </span>
          </p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setEditing(!editing)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Pencil size={14} />
          </button>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 size={14} />
            </button>
          ) : (
            <button
              onClick={handleDelete}
              className="px-2 py-1 text-xs bg-red-600 text-white rounded-lg font-medium"
            >
              নিশ্চিত?
            </button>
          )}
        </div>
      </div>

      {/* Expanded item list */}
      {editing && (
        <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
          {sale.items.map((item, idx) => (
            <div
              key={idx}
              className="flex justify-between text-xs text-gray-600"
            >
              <span>
                {item.product_name} ({item.quantity} {item.unit})
              </span>
              <span className="font-medium">
                ৳{item.total.toLocaleString('bn-BD')}
              </span>
            </div>
          ))}
          <div className="flex justify-between text-xs text-green-600 pt-1">
            <span>লাভ</span>
            <span className="font-semibold">
              ৳{sale.total_profit.toLocaleString('bn-BD')}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
