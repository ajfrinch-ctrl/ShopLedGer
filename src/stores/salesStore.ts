import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { db } from '../lib/db'
import { toDateKey } from '../lib/profitLoss'
import type { Sale, SaleItem } from '../types'
import { yymmdd, nextIdSync } from '../lib/idGenerator'

interface SalesState {
  sales: Sale[]
  addSale: (sale: Omit<Sale, 'id' | 'created_at'>) => string
  addSaleAsync: (sale: Omit<Sale, 'id' | 'created_at'>) => Promise<string>
  updateSale: (id: string, data: Partial<Sale>) => void
  deleteSale: (id: string) => Promise<void>
  getSalesByDate: (date: string) => Sale[]
  getTodaySales: () => Sale[]
  getTotalSalesAmount: (sales: Sale[]) => number
  getTotalProfit: (sales: Sale[]) => number
}

export const useSalesStore = create<SalesState>()(
  persist(
    (set, get) => ({
      sales: [],

      addSale: (saleData) => {
        // ইউনিক সেল আইডি: SYYMMDD001 (যেমন S260901001) — সিঙ্ক ভার্সন
        const existing = get().sales.map((s) => s.id)
        const id = nextIdSync('S', yymmdd(new Date()), existing, 3)
        const newSale: Sale = {
          ...saleData,
          id,
          created_at: new Date().toISOString(),
        }
        set((state) => ({ sales: [newSale, ...state.sales] }))
        return id
      },

      addSaleAsync: async (saleData) => {
        const existing = get().sales.map((s) => s.id)
        const id = nextIdSync('S', yymmdd(new Date()), existing, 3)
        const newSale: Sale = {
          ...saleData,
          id,
          created_at: new Date().toISOString(),
        }
        set((state) => ({ sales: [newSale, ...state.sales] }))
        return id
      },

      updateSale: (id, data) => {
        set((state) => ({
          sales: state.sales.map((s) =>
            s.id === id ? { ...s, ...data } : s,
          ),
        }))
      },

      deleteSale: async (id) => {
        await db.transaction('r', db.ledgerEntries, db.collections, async () => {
          const sale = get().sales.find(s => s.id === id)
          if (sale?.payment_type === 'বাকি' && sale.customer_id) {
            const entries = await db.ledgerEntries.where('party_id').equals(sale.customer_id).toArray()
            const legacy = await db.collections.where('customer_id').equals(sale.customer_id).count()
            if (legacy || entries.some(e => e.kind === 'payment' && !e.cancelled)) {
              throw new Error('এই ক্রেতার আদায় রয়েছে। আগে বাকি খাতায় আদায়ের হিসাব সমন্বয় করুন।')
            }
          }
          set((state) => ({ sales: state.sales.filter((s) => s.id !== id) }))
        })
      },

      getSalesByDate: (date) => {
        return get().sales.filter((s) => s.date.startsWith(date))
      },

      getTodaySales: () => {
        return get().getSalesByDate(toDateKey(new Date()))
      },

      getTotalSalesAmount: (sales) => {
        return sales.reduce((sum, s) => sum + s.total_amount, 0)
      },

      getTotalProfit: (sales) => {
        return sales.reduce((sum, s) => sum + s.total_profit, 0)
      },
    }),
    { name: 'shopledger-sales' },
  ),
)

// Helper to create sale items
export function createSaleItem(
  productId: string,
  productName: string,
  quantity: number,
  unit: string,
  salePrice: number,
  purchasePrice: number,
): SaleItem {
  const total = quantity * salePrice
  const cost = quantity * purchasePrice
  return {
    product_id: productId,
    product_name: productName,
    quantity,
    unit,
    sale_price: salePrice,
    purchase_price: purchasePrice,
    total,
    profit: total - cost,
  }
}
