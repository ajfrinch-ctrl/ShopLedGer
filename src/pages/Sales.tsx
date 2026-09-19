import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProductStore } from '../stores/productStore'
import { useSalesStore, createSaleItem } from '../stores/salesStore'
import { useCustomerStore } from '../stores/customerStore'
import { useAuthStore } from '../stores/authStore'
import { useActiveBranchId } from '../stores/uiStore'
import { usePurchaseStore } from '../stores/purchaseStore'
import { useStockAdjustmentStore } from '../stores/stockAdjustmentStore'
import { computeStock, stockMap } from '../lib/stock'
import { dateKeyToday, entryISOOn, isBackdated, toDateKey } from '../lib/profitLoss'
import { displayName, matchesProduct } from '../lib/productCode'
import { canSeeProfit, inUserBranch } from '../lib/roles'
import type { SaleItem, Sale } from '../types'
import { db, type DbCustomer } from '../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { orgPadOf } from '../lib/orgPad'
import { ledgerRows, ledgerScopeFor, ledgerToday } from '../lib/ledger'
import { bnDate, bnMoney } from '../lib/reports/core'
import SaleReceipt from '../components/SaleReceipt'
import EntryDateField from '../components/EntryDateField'
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
  Receipt,
  Minus,
  Plus,
  AlertTriangle,
} from 'lucide-react'

/** নিচের ফিক্সড নেভিগেশন বারের (৬৮px) ঠিক উপরে — iOS হোম ইন্ডিকেটরের জায়গাও বাদ দিয়ে */
const ABOVE_NAV = 'bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))]'

export default function Sales() {
  const products = useProductStore((s) => s.products)
  const { addSale, sales } = useSalesStore()
  const { loadCustomers, addCustomer } =
    useCustomerStore()
  const customers = useCustomerStore((s) => s.customers)
  const user = useAuthStore((s) => s.user)
  const showProfit = canSeeProfit(user?.role)
  const activeBranch = useActiveBranchId()
  const purchases = usePurchaseStore((s) => s.purchases)
  const adjustments = useStockAdjustmentStore((s) => s.adjustments)
  const stockById = useMemo(
    () => stockMap(computeStock(products, purchases, sales, adjustments)),
    [products, purchases, sales, adjustments],
  )
  const stockOf = (id: string) => stockById.get(id)?.currentStock ?? 0

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<SaleItem[]>([])
  const [paymentType, setPaymentType] = useState<'নগদ' | 'বাকি'>('নগদ')
  const [selectedCustomer, setSelectedCustomer] =
    useState<DbCustomer | null>(null)
  const [note, setNote] = useState('')
  /** বিক্রির তারিখ — পুরানো তারিখে এন্ট্রি দেওয়া যায় (সেভের পর আজকে ফেরত যায়) */
  const [saleDate, setSaleDate] = useState(dateKeyToday)
  const [showCart, setShowCart] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)
  const [viewingReceipt, setViewingReceipt] = useState<Sale | null>(null)
  const [discountInput, setDiscountInput] = useState('')
  const [paidInput, setPaidInput] = useState('')
  const [discountMode, setDiscountMode] = useState<'discount' | 'paid' | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustName, setNewCustName] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')
  const [newCustAddress, setNewCustAddress] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerList, setShowCustomerList] = useState(false)
  /** সাবমিট আটকে গেলে কারণ — alert()-এর বদলে ফর্মের ভিতরেই দেখায় */
  const [formError, setFormError] = useState('')
  /** স্টক কম থাকলে সেভের আগে ইনলাইন নিশ্চিতকরণ (window.confirm নয়) */
  const [confirmShortStock, setConfirmShortStock] = useState(false)
  /** কার্ট খালি করার আগে ইনলাইন নিশ্চিতকরণ */
  const [confirmClear, setConfirmClear] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const customerInputRef = useRef<HTMLInputElement | null>(null)
  /** শাখার প্যাড (লোগো, প্রতিষ্ঠানের নাম, ঠিকানা, ফোন) — বিক্রি রসিদে বসে */
  const branches = useLiveQuery(() => db.branches.toArray(), []) || []
  const ledgerData = useLiveQuery(async () => ({
    entries: await db.ledgerEntries.toArray(),
    collections: await db.collections.toArray(),
  }), [])

  /* ── Products ── */
  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products.slice(0, 20)
    return products.filter((p) => matchesProduct(p, search))
  }, [products, search])

  /* ── Customer filter ── */
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase()
    return customers.filter(c => inUserBranch(user, c.branch_id) && (!q || c.name.toLowerCase().includes(q) || c.phone?.includes(q)))
  }, [customerSearch, customers, user])

  /* ── Customer summary for selected customer ── */
  const selectedCustomerSummary = useMemo(() => {
    if (!selectedCustomer) return null
    const custId = selectedCustomer.id
    const custSales = sales.filter((s) => s.customer_id === custId && inUserBranch(user, s.branch_id))
    const totalPurchased = custSales.reduce((sum, s) => sum + s.total_amount, 0)
    const entries = ledgerData?.entries || []
    const collections = ledgerData?.collections || []
    const rows = ledgerRows(custId, sales, [], entries, collections, { ...ledgerScopeFor(user), through: ledgerToday() })
    const balance = rows[rows.length - 1]?.balance || 0

    // সর্বশেষ লেনদেন (rows-এর শেষ সারি)
    const lastRow = rows[rows.length - 1]
    const lastTxDate = lastRow ? bnDate(lastRow.date) : null
    const lastTxAmount = lastRow ? (lastRow.debit > 0 ? lastRow.debit : lastRow.credit) : null
    const lastTxLabel = lastRow ? lastRow.label : null

    // সর্বশেষ কেনা পণ্য/বিক্রি
    const sortedSales = [...custSales].sort((a, b) => b.date.localeCompare(a.date))
    const lastSale = sortedSales[0]
    const lastItemsSummary = lastSale?.items?.length
      ? lastSale.items.map((i) => i.product_name).join(', ')
      : null

    return {
      totalPurchased,
      currentDue: balance,
      lastTxDate,
      lastTxAmount,
      lastTxLabel,
      lastSaleDate: lastSale ? bnDate(lastSale.date) : null,
      lastItemsSummary,
    }
  }, [selectedCustomer, sales, ledgerData, user])

  /* ── ক্রেতার প্রোফাইল থেকে ?customer=<id> নিয়ে এলে আগেই নির্বাচিত ── */
  useEffect(() => {
    const wanted = searchParams.get('customer')
    if (!wanted || selectedCustomer?.id === wanted) return
    const found = customers.find((c) => c.id === wanted && inUserBranch(user, c.branch_id))
    if (found) setSelectedCustomer(found)
    setSearchParams((params) => {
      params.delete('customer')
      return params
    }, { replace: true })
  }, [searchParams, customers, selectedCustomer?.id, setSelectedCustomer, setSearchParams, user])

  /* ── Cart totals ── */
  const cartTotals = useMemo(() => {
    const total = cart.reduce((sum, i) => sum + i.total, 0)
    const profit = cart.reduce((sum, i) => sum + i.profit, 0)
    return { total, profit }
  }, [cart])

  const subtotal = cartTotals.total

  const effectiveDiscount = useMemo(() => {
    if (subtotal <= 0) return 0
    if (discountMode === 'discount') {
      const d = parseFloat(discountInput)
      return isNaN(d) ? 0 : Math.min(subtotal, Math.max(0, d))
    }
    if (discountMode === 'paid') {
      const p = parseFloat(paidInput)
      if (isNaN(p)) return 0
      return Math.min(subtotal, Math.max(0, subtotal - p))
    }
    return 0
  }, [subtotal, discountMode, discountInput, paidInput])

  const finalTotal = Math.max(0, subtotal - effectiveDiscount)

  const handleDiscountChange = (val: string) => {
    setDiscountMode('discount')
    setDiscountInput(val)
    const num = parseFloat(val)
    if (!isNaN(num) && subtotal > 0) {
      const eff = Math.min(subtotal, Math.max(0, num))
      setPaidInput(String(Math.max(0, subtotal - eff)))
    } else {
      setPaidInput('')
    }
  }

  const handlePaidChange = (val: string) => {
    setDiscountMode('paid')
    setPaidInput(val)
    const num = parseFloat(val)
    if (!isNaN(num) && subtotal > 0) {
      const eff = Math.min(subtotal, Math.max(0, subtotal - num))
      setDiscountInput(eff > 0 ? String(eff) : '')
    } else {
      setDiscountInput('')
    }
  }

  /* ── Today's sales ── */
  const todaySales = useMemo(() => {
    return sales.filter((s) => s.date.startsWith(toDateKey(new Date())))
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
            displayName(product),
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

  /* ── সাবমিটের আগে যাচাই — বাকি হলে ক্রেতা লাগবে, স্টক কম হলে সতর্কতা ── */
  const shortStockItems = useMemo(
    () => cart.filter((i) => i.quantity > stockOf(i.product_id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cart, stockById],
  )
  const dueBlocked = paymentType === 'বাকি' && !selectedCustomer
  const canSubmit = cart.length > 0 && !dueBlocked

  // কার্ট/পেমেন্ট বদলালে পুরোনো সতর্কতা আর নিশ্চিতকরণ মুছে যাক
  useEffect(() => {
    setConfirmShortStock(false)
    setFormError('')
  }, [cart, paymentType, selectedCustomer])

  /* ── Submit sale ── */
  const saveSale = () => {
    if (cart.length === 0) {
      setFormError('কার্ট খালি — আগে পণ্য যোগ করুন')
      return
    }
    if (paymentType === 'বাকি' && !selectedCustomer) {
      setFormError('বাকি বিক্রির জন্য ক্রেতা নির্বাচন করুন')
      return
    }

    const saleSubtotal = subtotal
    const saleDiscount = effectiveDiscount
    const saleTotal = finalTotal
    const saleProfit = Math.max(0, cartTotals.profit - effectiveDiscount)

    const sale: Omit<Sale, 'id' | 'created_at'> = {
      date: entryISOOn(saleDate),
      items: cart,
      subtotal: saleSubtotal,
      discount: saleDiscount,
      total_amount: saleTotal,
      total_profit: saleProfit,
      payment_type: paymentType,
      customer_id: selectedCustomer?.id,
      customer_name: selectedCustomer?.name,
      branch_id: activeBranch || 'branch-1',
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
    setSaleDate(dateKeyToday()) // পুরানো তারিখ পরের বিক্রিতে থেকে না যায়
    setPaymentType('নগদ')
    setDiscountInput('')
    setPaidInput('')
    setDiscountMode(null)
    setShowCart(false)
    setConfirmShortStock(false)
    setConfirmClear(false)
    setFormError('')

    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 2000)
  }

  /** সাবমিট বাটন — স্টক কম থাকলে আগে ইনলাইন নিশ্চিতকরণ দেখায়, তারপর সেভ */
  const handleSubmit = () => {
    if (!canSubmit) {
      setFormError(
        cart.length === 0
          ? 'কার্ট খালি — আগে পণ্য যোগ করুন'
          : 'বাকি বিক্রির জন্য ক্রেতা নির্বাচন করুন',
      )
      return
    }
    if (shortStockItems.length > 0 && !confirmShortStock) {
      setConfirmShortStock(true)
      return
    }
    setConfirmShortStock(false)
    saveSale()
  }

  /** ক্রেতা খোঁজার ঘরে ফোকাস — কার্ট বন্ধ করে সরাসরি উপরে নিয়ে যায় */
  const focusCustomerSearch = () => {
    setShowCart(false)
    setShowCustomerList(true)
    requestAnimationFrame(() => {
      customerInputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      customerInputRef.current?.focus()
    })
  }

  /* ── Add new customer ── */
  const handleAddCustomer = async () => {
    if (!newCustName.trim()) return
    const newCust = await addCustomer({
      name: newCustName.trim(),
      phone: newCustPhone.trim() || undefined,
      address: newCustAddress.trim() || undefined,
      branch_id: activeBranch || 'branch-1',
    })
    setSelectedCustomer(newCust)
    setNewCustName('')
    setNewCustPhone('')
    setNewCustAddress('')
    setShowAddCustomer(false)
    setCustomerSearch('')
  }

  const bn = (n: number) => n.toLocaleString('bn-BD')

  return (
    <div className="sale-ui" data-sale-page>
      {/* ── Top Bar (স্ক্রল করলেও উপরে আটকে থাকে) ── */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-100 px-4 py-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-800 leading-tight">পন্য বিক্রি</h2>
            <p className="text-[11px] text-gray-500">
              পণ্যে ট্যাপ করে কার্টে যোগ করুন
              {todaySales.length > 0 && ` • আজ ${bn(todaySales.length)}টি বিক্রি`}
            </p>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
              showHistory
                ? 'bg-teal-50 border-teal-200 text-teal-700'
                : 'bg-white border-gray-200 text-teal-700 hover:bg-teal-50'
            }`}
            title="আজকের বিক্রি"
            aria-expanded={showHistory}
          >
            <History size={16} />
            আজকের বিক্রি
          </button>
        </div>

        {/* পুরানো তারিখে এন্ট্রি — পুরো পেজে দেখা যাবে, যাতে ভুল না হয় */}
        {isBackdated(saleDate) && (
          <div className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3 py-2 text-xs">
            <span>
              📅 <strong>{bnDate(saleDate)}</strong> তারিখের বিক্রি এন্ট্রি চলছে — রসিদ ও রিপোর্টে
              এই তারিখেই দেখাবে।
            </span>
            <button
              type="button"
              onClick={() => setSaleDate(dateKeyToday())}
              className="shrink-0 px-2 py-1 rounded-lg bg-white border border-amber-300 font-semibold hover:bg-amber-100"
            >
              আজ
            </button>
          </div>
        )}

        {/* Customer Select */}
        <div className="relative">
          {selectedCustomer ? (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-teal-600 uppercase tracking-wider">নির্বাচিত ক্রেতা</span>
                  <p className="text-sm font-bold text-teal-900">
                    {selectedCustomer.name}
                    {selectedCustomer.phone && (
                      <span className="text-xs font-normal text-teal-700 ml-2">
                        📞 {selectedCustomer.phone}
                      </span>
                    )}
                  </p>
                  {selectedCustomer.address && (
                    <p className="text-xs text-teal-700">📍 {selectedCustomer.address}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1.5 hover:bg-teal-100 text-teal-600 rounded-full transition-colors"
                  title="ক্রেতা পরিবর্তন করুন"
                  aria-label="ক্রেতা পরিবর্তন করুন"
                >
                  <X size={16} />
                </button>
              </div>

              {/* ক্রেতার সামারি (সর্বশেষ লেনদেন, কি কিনসে, মোট কেনাকাটা, বাকি) */}
              {selectedCustomerSummary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-2 border-t border-teal-200/60 text-xs">
                  <div className="bg-white/80 rounded-lg p-2 border border-teal-100">
                    <p className="text-[10px] text-gray-500">বর্তমান বাকি</p>
                    <p className={`font-bold ${selectedCustomerSummary.currentDue > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {bnMoney(selectedCustomerSummary.currentDue)}
                    </p>
                  </div>
                  <div className="bg-white/80 rounded-lg p-2 border border-teal-100">
                    <p className="text-[10px] text-gray-500">মোট কেনাকাটা</p>
                    <p className="font-bold text-gray-800">
                      {bnMoney(selectedCustomerSummary.totalPurchased)}
                    </p>
                  </div>
                  <div className="bg-white/80 rounded-lg p-2 border border-teal-100">
                    <p className="text-[10px] text-gray-500">সর্বশেষ লেনদেন</p>
                    <p className="font-semibold text-gray-800">
                      {selectedCustomerSummary.lastTxDate
                        ? `${selectedCustomerSummary.lastTxDate} (${bnMoney(selectedCustomerSummary.lastTxAmount || 0)})`
                        : '—'}
                    </p>
                    {selectedCustomerSummary.lastTxLabel && (
                      <p className="text-[10px] text-gray-400">{selectedCustomerSummary.lastTxLabel}</p>
                    )}
                  </div>
                  <div className="bg-white/80 rounded-lg p-2 border border-teal-100">
                    <p className="text-[10px] text-gray-500">সর্বশেষ কি কিনসে</p>
                    <p className="font-medium text-gray-800 truncate" title={selectedCustomerSummary.lastItemsSummary || ''}>
                      {selectedCustomerSummary.lastItemsSummary || '—'}
                    </p>
                    {selectedCustomerSummary.lastSaleDate && (
                      <p className="text-[10px] text-gray-400">{selectedCustomerSummary.lastSaleDate}</p>
                    )}
                  </div>
                </div>
              )}
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
                    ref={customerInputRef}
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value)
                      setShowCustomerList(true)
                    }}
                    onFocus={() => setShowCustomerList(true)}
                    placeholder="ক্রেতা খুঁজুন (নাম বা মোবাইল)..."
                    aria-label="ক্রেতা খুঁজুন"
                    className="w-full pl-9 pr-8 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-teal-500 text-sm"
                  />
                  {showCustomerList && (
                    <button
                      onClick={() => {
                        setShowCustomerList(false)
                        setCustomerSearch('')
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
                      aria-label="ক্রেতার তালিকা বন্ধ করুন"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowAddCustomer(true)}
                  className="px-3 py-2.5 bg-teal-100 text-teal-700 rounded-xl hover:bg-teal-200 transition-colors"
                  title="নতুন ক্রেতা যোগ করুন"
                  aria-label="নতুন ক্রেতা যোগ করুন"
                >
                  <UserPlus size={18} />
                </button>
              </div>

              {/* Customer Dropdown */}
              {showCustomerList && customerSearch && (
                <div className="absolute top-full left-0 right-12 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto z-30">
                  {filteredCustomers.length === 0 ? (
                    <div className="text-center py-3 px-4">
                      <p className="text-sm text-gray-400">কোনো ক্রেতা পাওয়া যায়নি</p>
                      <button
                        onClick={() => setShowAddCustomer(true)}
                        className="mt-1 text-xs font-semibold text-teal-700"
                      >
                        + নতুন ক্রেতা যোগ করুন
                      </button>
                    </div>
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
            placeholder="পণ্য খুঁজুন — নাম, কোম্পানি বা কোড..."
            aria-label="পণ্য খুঁজুন"
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-teal-500 text-sm"
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
              aria-label="আজকের বিক্রির তালিকা বন্ধ করুন"
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
                <SaleHistoryCard
                  key={sale.id}
                  sale={sale}
                  onOpenReceipt={(s) => setViewingReceipt(s)}
                />
              ))}
            </div>
          )}
          <p className="mt-2 text-[11px] text-gray-500">
            📅 পুরানো তারিখে দেওয়া বিক্রি এখানে থাকবে না — সেগুলো <strong>রিপোর্ট → বিক্রি</strong>
            -এ সেই তারিখ বেছে দেখুন (ক্রেতার খাতাতেও সঠিক তারিখেই বসে)।
          </p>
        </div>
      )}

      {/* ── Product Grid ── (নিচের ফ্লোটিং বারের নিচে যেন পণ্য ঢাকা না পড়ে তাই pb) */}
      <div className="p-3 pb-32">
        <div className="grid grid-cols-2 gap-2.5" data-product-grid>
          {filteredProducts.map((product) => {
            const inCart = cart.find((i) => i.product_id === product.id)
            const stock = stockOf(product.id)
            return (
              <div
                key={product.id}
                data-product-card
                className={`rounded-2xl border-2 bg-white p-2.5 transition-all ${
                  inCart
                    ? 'border-teal-500 bg-teal-50/60 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <button
                  onClick={() => addToCart(product.id)}
                  className="w-full text-left active:scale-[0.97] transition-transform"
                  aria-label={`${displayName(product)} কার্টে যোগ করুন`}
                >
                  <p className="font-medium text-sm text-gray-800 line-clamp-2 leading-tight min-h-[2.4rem]">
                    {displayName(product)}
                  </p>
                  {product.code && (
                    <p className="text-[10px] font-mono text-gray-400 mt-0.5">{product.code}</p>
                  )}
                  <div className="flex items-center justify-between gap-1 mt-1.5">
                    <span
                      className={`text-[11px] ${
                        stock <= 0
                          ? 'text-red-600 font-semibold'
                          : stockById.get(product.id)?.isLow
                            ? 'text-orange-600 font-semibold'
                            : 'text-gray-500'
                      }`}
                    >
                      স্টক {bn(stock)} {product.unit}
                    </span>
                    <span className="text-[13px] font-bold text-teal-700">৳{bn(product.sale_price || 0)}</span>
                  </div>
                </button>

                {/* কার্টে থাকলে এখানেই +/− — আলাদা করে কার্ট খুলতে হয় না */}
                {inCart ? (
                  <div className="mt-2 pt-2 border-t border-teal-200/70 flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQty(product.id, inCart.quantity - 1)}
                        className="w-8 h-8 rounded-lg bg-white border border-teal-200 text-teal-700 flex items-center justify-center active:scale-90 transition-transform"
                        aria-label={`${inCart.product_name} কমান`}
                      >
                        <Minus size={14} />
                      </button>
                      <span className="min-w-[3.2rem] text-center text-xs font-bold text-teal-800">
                        {bn(inCart.quantity)} {inCart.unit}
                      </span>
                      <button
                        onClick={() => updateQty(product.id, inCart.quantity + 1)}
                        className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center active:scale-90 transition-transform"
                        aria-label={`${inCart.product_name} বাড়ান`}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <span className="text-xs font-bold text-gray-800">৳{bn(inCart.total)}</span>
                  </div>
                ) : (
                  <p className="mt-2 pt-2 border-t border-gray-100 text-[11px] text-teal-700 font-medium">
                    + যোগ করুন
                  </p>
                )}
              </div>
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

      {/* ── Floating Cart Bar ── নিচের নেভিগেশনের ঠিক উপরে, সবসময় হাতের নাগালে */}
      {cart.length > 0 && !showCart && (
        <div className={`fixed left-0 right-0 z-30 px-3 ${ABOVE_NAV}`} data-sale-bar>
          <button
            onClick={() => setShowCart(true)}
            className="w-full max-w-[456px] mx-auto bg-teal-700 hover:bg-teal-800 text-white rounded-2xl shadow-xl shadow-teal-700/30 pl-4 pr-2 py-2.5 flex items-center justify-between gap-3 transition-all active:scale-[0.98]"
            aria-label={`কার্ট দেখুন — ${cart.length} পণ্য, মোট ৳${bn(finalTotal)}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <ShoppingCart size={22} />
                <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] font-bold min-w-[1.25rem] h-5 px-1 rounded-full flex items-center justify-center">
                  {bn(cart.length)}
                </span>
              </div>
              <div className="text-left min-w-0">
                <p className="text-[11px] text-teal-200 leading-none">
                  {cart.length} পণ্য{effectiveDiscount > 0 ? ` • ছাড় ৳${bn(effectiveDiscount)}` : ''}
                </p>
                <p className="text-lg font-bold leading-tight truncate">৳ {bn(finalTotal)}</p>
              </div>
            </div>
            <span className="shrink-0 bg-white text-teal-800 text-xs font-bold rounded-xl px-3 py-2.5 flex items-center gap-1">
              সাবমিট
              <ChevronUp size={16} />
            </span>
          </button>
        </div>
      )}

      {/* ── Cart Sheet ── বিলের বাকি অংশ স্ক্রল হয়, কিন্তু "সাবমিট" বোতাম নিচে আটকে থাকে
           (নেভিগেশন বারের উপরে) — তাই বোতাম কখনো ফুটারের নিচে ঢেকে যায় না */}
      {showCart && cart.length > 0 && (
        <div
          className={`fixed left-0 right-0 z-30 px-3 ${ABOVE_NAV}`}
          data-sale-sheet
          aria-label="বিক্রির বিল"
        >
          <div className="max-w-[456px] mx-auto bg-white rounded-t-3xl border border-b-0 border-gray-200 shadow-[0_-10px_34px_rgba(0,0,0,0.14)] flex flex-col overflow-hidden max-h-[min(64dvh,calc(100dvh-15.5rem))]">
            {/* হেডার */}
            <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-2.5 border-b border-gray-100 bg-white">
              <h3 className="font-bold text-gray-800 text-sm">
                কার্ট ({bn(cart.length)} পণ্য)
              </h3>
              <div className="flex items-center gap-1">
                {!confirmClear ? (
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="px-2.5 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    সব মুছুন
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setCart([])
                        setConfirmClear(false)
                        setShowCart(false)
                      }}
                      className="px-2.5 py-1.5 text-[11px] font-bold text-white bg-red-600 rounded-lg"
                    >
                      মুছে ফেলুন
                    </button>
                    <button
                      onClick={() => setConfirmClear(false)}
                      className="px-2 py-1.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      বাতিল
                    </button>
                  </div>
                )}
                <button
                  onClick={() => setShowCart(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-full"
                  aria-label="বিল বন্ধ করুন"
                >
                  <ChevronDown size={18} />
                </button>
              </div>
            </div>

            {/* স্ক্রল করার অংশ — পণ্য, ছাড়, তারিখ, পেমেন্ট, মন্তব্য */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3.5 py-3 space-y-3">
              {/* পণ্যের তালিকা */}
              <div className="space-y-2">
                {cart.map((item) => {
                  const stock = stockOf(item.product_id)
                  const short = item.quantity > stock
                  return (
                    <div
                      key={item.product_id}
                      data-cart-item
                      className="flex items-start gap-2 bg-gray-50 rounded-2xl p-2.5 border border-gray-100"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-800 truncate">
                          {item.product_name}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          ৳{bn(item.sale_price)}/{item.unit}
                          {short && (
                            <span className="ml-1.5 text-red-600 font-semibold">
                              • স্টক মাত্র {bn(stock)}
                            </span>
                          )}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <button
                            onClick={() => updateQty(item.product_id, item.quantity - 1)}
                            className="w-9 h-9 rounded-xl bg-white border border-gray-200 text-gray-700 flex items-center justify-center active:scale-90 transition-transform"
                            aria-label={`${item.product_name} কমান`}
                          >
                            <Minus size={15} />
                          </button>
                          <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateQty(item.product_id, parseFloat(e.target.value) || 0)
                            }
                            aria-label={`${item.product_name} পরিমাণ (${item.unit})`}
                            className="w-16 h-9 px-1 border border-gray-200 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white"
                          />
                          <button
                            onClick={() => updateQty(item.product_id, item.quantity + 1)}
                            className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center active:scale-90 transition-transform"
                            aria-label={`${item.product_name} বাড়ান`}
                          >
                            <Plus size={15} />
                          </button>
                          <span className="text-[11px] text-gray-400">{item.unit}</span>
                          <span className="text-xs text-gray-400">×</span>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">৳</span>
                            <input
                              type="number"
                              min="0"
                              value={item.sale_price}
                              onChange={(e) =>
                                updatePrice(item.product_id, parseFloat(e.target.value) || 0)
                              }
                              aria-label={`${item.product_name} বিক্রয় দাম`}
                              className="w-20 h-9 pl-5 pr-1.5 border border-gray-200 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-teal-700 text-sm">৳{bn(item.total)}</p>
                        {showProfit && (
                          <p className="text-[10px] text-green-600">লাভ ৳{bn(item.profit)}</p>
                        )}
                        <button
                          onClick={() => removeFromCart(item.product_id)}
                          className="mt-1 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          aria-label={`${item.product_name} কার্ট থেকে মুছুন`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* ছাড় ও হিসাব */}
              <div className="bg-gray-50 rounded-2xl p-3 space-y-2.5 border border-gray-100">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">বিক্রিত পণ্যের দাম</span>
                  <span className="font-semibold text-gray-800">৳ {bn(subtotal)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      মোট ডিস্কাউন্ট (ছাড়)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">৳</span>
                      <input
                        type="number"
                        min="0"
                        max={subtotal}
                        step="any"
                        placeholder="০"
                        value={discountMode === 'paid' && effectiveDiscount > 0 ? effectiveDiscount : discountInput}
                        onChange={(e) => handleDiscountChange(e.target.value)}
                        className="w-full pl-6 pr-2 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      পরিশোধ (দাম থেকে)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">৳</span>
                      <input
                        type="number"
                        min="0"
                        max={subtotal}
                        step="any"
                        placeholder={String(subtotal)}
                        value={discountMode === 'discount' && effectiveDiscount > 0 ? finalTotal : paidInput}
                        onChange={(e) => handlePaidChange(e.target.value)}
                        className="w-full pl-6 pr-2 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>
                </div>

                {/* এক ট্যাপে ছাড় */}
                {subtotal > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {[50, 100].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => handleDiscountChange(String(amount))}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-full border border-gray-200 bg-white text-gray-600 hover:border-teal-400 hover:text-teal-700"
                      >
                        ছাড় ৳{bn(amount)}
                      </button>
                    ))}
                    {[5, 10].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => handleDiscountChange(String(Math.round((subtotal * pct) / 100)))}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-full border border-gray-200 bg-white text-gray-600 hover:border-teal-400 hover:text-teal-700"
                      >
                        {pct === 5 ? '৫' : '১০'}% ছাড়
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex justify-between items-center text-xs pt-2 border-t border-dashed border-gray-200">
                  <span className="text-emerald-700">
                    মোট ডিস্কাউন্ট: -৳{bn(effectiveDiscount)}
                  </span>
                  <span className="font-bold text-gray-900 text-sm">
                    সর্বমোট: ৳{bn(finalTotal)}
                  </span>
                </div>
              </div>

              {/* পেমেন্টের ধরন */}
              <div>
                <p className="text-[11px] font-semibold text-gray-600 mb-1.5">পেমেন্টের ধরন</p>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="পেমেন্টের ধরন">
                  <button
                    onClick={() => setPaymentType('নগদ')}
                    aria-pressed={paymentType === 'নগদ'}
                    className={`py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                      paymentType === 'নগদ'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    💵 নগদ
                  </button>
                  <button
                    onClick={() => setPaymentType('বাকি')}
                    aria-pressed={paymentType === 'বাকি'}
                    className={`py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                      paymentType === 'বাকি'
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    📋 বাকি
                  </button>
                </div>
                {dueBlocked && (
                  <div className="mt-2 flex items-center justify-between gap-2 bg-orange-50 border border-orange-200 text-orange-800 rounded-xl px-3 py-2 text-[11px]">
                    <span>বাকি লিখতে ক্রেতার নাম দরকার</span>
                    <button
                      onClick={focusCustomerSearch}
                      className="shrink-0 px-2.5 py-1 rounded-lg bg-white border border-orange-300 font-bold"
                    >
                      ক্রেতা বাছুন
                    </button>
                  </div>
                )}
                {paymentType === 'বাকি' && selectedCustomer && (
                  <p className="mt-2 text-[11px] text-orange-700 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
                    📋 <strong>{selectedCustomer.name}</strong>-এর বাকিতে ৳{bn(finalTotal)} যোগ হবে।
                  </p>
                )}
              </div>

              <EntryDateField value={saleDate} onChange={setSaleDate} what="বিক্রি" />

              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="মন্তব্য (ঐচ্ছিক)"
                aria-label="মন্তব্য"
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* ── পিন করা ফুটার — সাবমিট বোতাম সবসময় চোখের সামনে, নেভিগেশনের উপরে ── */}
            <div
              data-sale-sheet-footer
              className="shrink-0 border-t border-gray-100 bg-white px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] space-y-2"
            >
              {formError && (
                <p role="alert" className="text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                  {formError}
                </p>
              )}

              {confirmShortStock && (
                <div className="rounded-xl bg-amber-50 border border-amber-300 p-2.5 space-y-2">
                  <p className="text-[11px] font-bold text-amber-800 flex items-center gap-1.5">
                    <AlertTriangle size={14} /> স্টক যথেষ্ট নেই — তবুও সেভ করবেন?
                  </p>
                  <p className="text-[10px] text-amber-800 leading-relaxed whitespace-pre-line">
                    {shortStockItems
                      .map((i) => `• ${i.product_name}: স্টক ${bn(stockOf(i.product_id))} ${i.unit}, বিক্রি ${bn(i.quantity)} ${i.unit}`)
                      .join('\n')}
                    {'\n'}স্টক ঋণাত্মক হবে — পরে ক্রয় এন্ট্রি দিয়ে মিলিয়ে নিন।
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmShortStock(false)}
                      className="flex-1 py-2 rounded-lg bg-white border border-amber-300 text-[12px] font-semibold text-gray-700"
                    >
                      বাতিল
                    </button>
                    <button
                      onClick={() => {
                        setConfirmShortStock(false)
                        saveSale()
                      }}
                      className="flex-1 py-2 rounded-lg bg-amber-600 text-white text-[12px] font-bold"
                    >
                      হ্যাঁ, সেভ করুন
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-[11px] text-gray-500 leading-none">
                    {paymentType}
                    {effectiveDiscount > 0 ? ` • ছাড় ৳${bn(effectiveDiscount)}` : ''}
                  </p>
                  <p className="text-2xl font-extrabold text-gray-900 leading-tight">
                    ৳ {bn(finalTotal)}
                  </p>
                </div>
                {showProfit && (
                  <p className="text-[11px] text-green-600 font-semibold">
                    লাভ ৳{bn(Math.max(0, cartTotals.profit - effectiveDiscount))}
                  </p>
                )}
              </div>

              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                data-sale-submit
                className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-300 disabled:text-gray-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-teal-600/30 transition-all active:scale-[0.98]"
              >
                <CheckCircle size={20} />
                {dueBlocked
                  ? 'আগে ক্রেতা নির্বাচন করুন'
                  : `বিক্রি সম্পন্ন — ৳ ${bn(finalTotal)}`}
              </button>
            </div>
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
                aria-label="বন্ধ করুন"
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
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                ঠিকানা
              </label>
              <input
                type="text"
                value={newCustAddress}
                onChange={(e) => setNewCustAddress(e.target.value)}
                placeholder="গ্রাম/রোড, এলাকা"
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
      {(completedSale || viewingReceipt) && (() => {
        const targetSale = completedSale || viewingReceipt!
        const cust = targetSale.customer_id
          ? customers.find((c) => c.id === targetSale.customer_id)
          : selectedCustomer && selectedCustomer.name === targetSale.customer_name
            ? selectedCustomer
            : undefined
        return (
          <SaleReceipt
            sale={targetSale}
            pad={orgPadOf(
              branches.find((b) => b.id === targetSale.branch_id) || branches[0],
            )}
            customerPhone={cust?.phone}
            customerAddress={cust?.address}
            onClose={() => {
              setCompletedSale(null)
              setViewingReceipt(null)
            }}
          />
        )
      })()}

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
function SaleHistoryCard({
  sale,
  onOpenReceipt,
}: {
  sale: Sale
  onOpenReceipt?: (sale: Sale) => void
}) {
  const { deleteSale } = useSalesStore()
  const user = useAuthStore((s) => s.user)
  const showProfit = canSeeProfit(user?.role)
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
      window.alert(error instanceof Error ? error.message : 'বিক্রয় মুছে ফেলা যায়নি')
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
            {sale.discount ? (
              <span className="text-xs font-medium text-emerald-600 ml-2">
                (ছাড় ৳{sale.discount.toLocaleString('bn-BD')})
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex gap-1">
          {onOpenReceipt && (
            <button
              onClick={() => onOpenReceipt(sale)}
              className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
              title="রসিদ দেখুন / শেয়ার করুন"
            >
              <Receipt size={14} />
            </button>
          )}
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
          {sale.discount ? (
            <div className="flex justify-between text-xs text-emerald-600 pt-1">
              <span>মোট ডিস্কাউন্ট</span>
              <span className="font-semibold">
                - ৳ {sale.discount.toLocaleString('bn-BD')}
              </span>
            </div>
          ) : null}
          {showProfit && (
            <div className="flex justify-between text-xs text-green-600 pt-1">
              <span>লাভ</span>
              <span className="font-semibold">
                ৳{sale.total_profit.toLocaleString('bn-BD')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
