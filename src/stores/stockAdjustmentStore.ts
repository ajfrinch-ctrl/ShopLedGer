import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { StockAdjustment } from '../types'
import { yymmdd, nextIdSync } from '../lib/idGenerator'

interface StockAdjustmentState {
  adjustments: StockAdjustment[]
  addAdjustment: (a: Omit<StockAdjustment, 'id' | 'created_at'>) => string
  deleteAdjustment: (id: string) => void
}

export const useStockAdjustmentStore = create<StockAdjustmentState>()(
  persist(
    (set, get) => ({
      adjustments: [],
      addAdjustment: (data) => {
        // AYYMMDD001
        const existing = get().adjustments.map((a) => a.id)
        const id = nextIdSync('A', yymmdd(new Date()), existing, 3)
        set((s) => ({ adjustments: [{ ...data, id, created_at: new Date().toISOString() }, ...s.adjustments] }))
        return id
      },
      deleteAdjustment: (id) => set((s) => ({ adjustments: s.adjustments.filter((a) => a.id !== id) })),
    }),
    { name: 'shopledger-stock-adjustments' },
  ),
)
