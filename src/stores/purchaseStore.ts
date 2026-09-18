import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Purchase } from '../types'
import { yymmdd, nextIdSync } from '../lib/idGenerator'

interface PurchaseState {
  purchases: Purchase[]
  addPurchase: (purchase: Omit<Purchase, 'id' | 'created_at'>) => string
  addPurchaseAsync: (purchase: Omit<Purchase, 'id' | 'created_at'>) => Promise<string>
  getPurchasesByProduct: (productId: string) => Purchase[]
  getTotalPurchasedQty: (productId: string) => number
}

export const usePurchaseStore = create<PurchaseState>()(
  persist(
    (set, get) => ({
      purchases: [],

      addPurchase: (data) => {
        // PYYMMDD001 (যেমন P260901001)
        const existing = get().purchases.map((p) => p.id)
        const id = nextIdSync('P', yymmdd(new Date()), existing, 3)
        const newPurchase: Purchase = {
          ...data,
          id,
          created_at: new Date().toISOString(),
        }
        set((state) => ({ purchases: [newPurchase, ...state.purchases] }))
        return id
      },

      addPurchaseAsync: async (data) => {
        const existing = get().purchases.map((p) => p.id)
        const id = nextIdSync('P', yymmdd(new Date()), existing, 3)
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
