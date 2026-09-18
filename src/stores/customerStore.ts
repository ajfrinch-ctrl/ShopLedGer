import { create } from 'zustand'
import { db, type DbCustomer } from '../lib/db'
import { nextCustomerId } from '../lib/idGenerator'

interface CustomerState {
  customers: DbCustomer[]
  isLoading: boolean
  loadCustomers: () => Promise<void>
  addCustomer: (data: Omit<DbCustomer, 'id' | 'created_at'>) => Promise<DbCustomer>
  updateCustomer: (id: string, data: Partial<DbCustomer>) => Promise<void>
  deleteCustomer: (id: string) => Promise<void>
  searchCustomers: (query: string) => DbCustomer[]
  getCustomerById: (id: string) => DbCustomer | undefined
}

export const useCustomerStore = create<CustomerState>()((set, get) => ({
  customers: [],
  isLoading: false,

  loadCustomers: async () => {
    set({ isLoading: true })
    try {
      const customers = await db.customers.toArray()
      set({ customers, isLoading: false })
    } catch (err) {
      console.error('Load customers error:', err)
      set({ isLoading: false })
    }
  },

  addCustomer: async (data) => {
    // ইউনিক কাস্টমার আইডি: CYYMM001 (যেমন C2609001)
    const id = await nextCustomerId(new Date())
    const newCustomer: DbCustomer = {
      ...data,
      id,
      created_at: new Date().toISOString(),
    }
    await db.customers.add(newCustomer)
    set((state) => ({ customers: [...state.customers, newCustomer] }))
    return newCustomer
  },

  updateCustomer: async (id, data) => {
    await db.customers.update(id, data)
    set((state) => ({
      customers: state.customers.map((c) =>
        c.id === id ? { ...c, ...data } : c,
      ),
    }))
  },

  deleteCustomer: async (id) => {
    await db.customers.delete(id)
    set((state) => ({
      customers: state.customers.filter((c) => c.id !== id),
    }))
  },

  searchCustomers: (query) => {
    const q = query.toLowerCase().trim()
    if (!q) return get().customers
    return get().customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)),
    )
  },

  getCustomerById: (id) => get().customers.find((c) => c.id === id),
}))
