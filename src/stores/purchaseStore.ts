import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Purchase } from '../types'

interface PurchaseState {
  purchases: Purchase[]
  addPurchase: (purchase: Omit<Purchase, 'id' | 'created_at'>) => string
  getPurchasesByProduct: (productId: string) => Purchase[]
  getTotalPurchasedQty: (productId: string) => number
}

export const usePurchaseStore = create<PurchaseState>()(
  persist(
    (set, get) => ({
      purchases: [],

      addPurchase: (data) => {
        const id = `purchase-${crypto.randomUUID()}`
        const newPurchase: Purchase = {
          ...data,
          id,
          created_at: new Date().toISOString(),
        }
        set((state) => ({ purchases: [newPurchase, ...state.purchases] }))
        return id
      },

      getPurchasesByProduct: (productId) => {
        return get().purchases.filter((p) => p.product_id === productId)
      },

      getTotalPurchasedQty: (productId) => {
        return get()
          .purchases.filter((p) => p.product_id === productId)
          .reduce((sum, p) => sum + p.quantity, 0)
      },
    }),
    { name: 'shopledger-purchases' }
  )
)
