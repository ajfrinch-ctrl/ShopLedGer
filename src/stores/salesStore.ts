import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Sale, SaleItem } from '../types'

interface SalesState {
  sales: Sale[]
  addSale: (sale: Omit<Sale, 'id' | 'created_at'>) => string
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
        const id = `sale-${Date.now()}`
        const newSale: Sale = {
          ...saleData,
          id,
          created_at: new Date().toISOString(),
        }
        set((state) => ({ sales: [newSale, ...state.sales] }))
        return id
      },

      getSalesByDate: (date) => {
        return get().sales.filter((s) => s.date.startsWith(date))
      },

      getTodaySales: () => {
        const today = new Date().toISOString().split('T')[0]
        return get().getSalesByDate(today)
      },

      getTotalSalesAmount: (sales) => {
        return sales.reduce((sum, s) => sum + s.total_amount, 0)
      },

      getTotalProfit: (sales) => {
        return sales.reduce((sum, s) => sum + s.total_profit, 0)
      },
    }),
    { name: 'shopledger-sales' }
  )
)

// Helper to create sale items
export function createSaleItem(
  productId: string,
  productName: string,
  quantity: number,
  unit: string,
  salePrice: number,
  purchasePrice: number
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
