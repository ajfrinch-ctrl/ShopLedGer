import { useMemo, useState } from 'react'
import { useProductStore } from '../stores/productStore'
import { usePurchaseStore } from '../stores/purchaseStore'
import { useSalesStore } from '../stores/salesStore'
import { Search, Package } from 'lucide-react'

export default function Stock() {
  const products = useProductStore((s) => s.products)
  const purchases = usePurchaseStore((s) => s.purchases)
  const sales = useSalesStore((s) => s.sales)
  const [search, setSearch] = useState('')

  const stockData = useMemo(() => {
    return products.map((product) => {
      const totalPurchased = purchases
        .filter((p) => p.product_id === product.id)
        .reduce((sum, p) => sum + p.quantity, 0)

      const totalSold = sales.reduce((sum, sale) => {
        const item = sale.items.find((i) => i.product_id === product.id)
        return sum + (item?.quantity || 0)
      }, 0)

      const currentStock = product.opening_stock + totalPurchased - totalSold
      const stockValue = currentStock * product.purchase_price
      const saleValue = currentStock * product.sale_price
      const potentialProfit = saleValue - stockValue

      return {
        ...product,
        totalPurchased,
        totalSold,
        currentStock,
        stockValue,
        saleValue,
        potentialProfit,
      }
    })
  }, [products, purchases, sales])

  const filtered = useMemo(() => {
    if (!search.trim()) return stockData
    return stockData.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [stockData, search])

  const totals = useMemo(() => {
    return {
      totalStockValue: stockData.reduce((s, p) => s + p.stockValue, 0),
      totalUnits: stockData.reduce((s, p) => s + p.currentStock, 0),
      totalPotentialProfit: stockData.reduce((s, p) => s + p.potentialProfit, 0),
    }
  }, [stockData])

  return (
    <div className="pb-24">
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-10">
        <h2 className="text-lg font-semibold text-gray-800">স্টক হিসাব</h2>
      </div>

      <div className="p-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card bg-purple-50">
            <p className="text-xs text-purple-600">মোট স্টক মূল্য</p>
            <p className="text-lg font-bold text-purple-700">
              ৳ {totals.totalStockValue.toLocaleString('bn-BD')}
            </p>
          </div>
          <div className="card bg-green-50">
            <p className="text-xs text-green-600">সম্ভাব্য লাভ</p>
            <p className="text-lg font-bold text-green-700">
              ৳ {totals.totalPotentialProfit.toLocaleString('bn-BD')}
            </p>
          </div>
        </div>

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

        {/* Stock List */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Package size={40} className="mx-auto mb-2 opacity-50" />
              <p>কোনো পণ্য পাওয়া যায়নি</p>
            </div>
          ) : (
            filtered.map((item) => (
              <div key={item.id} className="card">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-sm text-gray-800">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.unit}</p>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    item.currentStock > 0
                      ? 'bg-green-100 text-green-700'
                      : item.currentStock < 0
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {item.currentStock.toLocaleString('bn-BD')} {item.unit}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                  <div>
                    <p>প্রারম্ভিক</p>
                    <p className="font-medium text-gray-700">{item.opening_stock}</p>
                  </div>
                  <div>
                    <p>মোট ক্রয়</p>
                    <p className="font-medium text-gray-700">{item.totalPurchased}</p>
                  </div>
                  <div>
                    <p>মোট বিক্রি</p>
                    <p className="font-medium text-gray-700">{item.totalSold}</p>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t flex justify-between text-xs">
                  <span className="text-gray-500">
                    স্টক মূল্য: <strong className="text-gray-700">৳{item.stockValue.toLocaleString('bn-BD')}</strong>
                  </span>
                  <span className="text-gray-500">
                    সম্ভাব্য লাভ: <strong className="text-green-600">৳{item.potentialProfit.toLocaleString('bn-BD')}</strong>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
