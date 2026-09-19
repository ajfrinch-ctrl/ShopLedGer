import { create } from 'zustand'
import { db, type DbCustomer } from '../lib/db'
import { nextCustomerId } from '../lib/idGenerator'
import { attachSyncMeta, markDeleted, touchSyncMeta, dedupeCandidate, isDeleted, outbox, type Syncable } from '../lib/sync'

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
      // Soft-deleted (tombstone) row UI-তে দেখানো হয় না
      const customers = (await db.customers.toArray()).filter((c) => !isDeleted(c))
      set({ customers, isLoading: false })
    } catch (err) {
      console.error('Load customers error:', err)
      set({ isLoading: false })
    }
  },

  addCustomer: async (data) => {
    // একই ক্রেতা দুই ডিভাইসে দুইবার তৈরি হওয়া ঠেকাতে natural key দেখে নেওয়া হয়
    const duplicate = dedupeCandidate<DbCustomer>('customers', data, get().customers as Syncable<DbCustomer>[])
    if (duplicate) return duplicate

    // ইউনিক কাস্টমার আইডি: CYYMM001 (যেমন C2609001) — এটি local_id, Primary Key হলো uid
    const id = await nextCustomerId(new Date())
    const newCustomer = attachSyncMeta({ ...data, id, created_at: new Date().toISOString() }, { localId: id })
    await db.customers.add(newCustomer)
    void outbox.enqueue('customers', newCustomer.uid, 'put', newCustomer, newCustomer.rev)
    set((state) => ({ customers: [...state.customers, newCustomer] }))
    return newCustomer
  },

  updateCustomer: async (id, data) => {
    const current = get().customers.find((c) => c.id === id) ?? (await db.customers.get(id))
    if (!current) return
    const updated = touchSyncMeta(current as Syncable<DbCustomer>, data)
    await db.customers.put(updated)
    void outbox.enqueue('customers', updated.uid, 'put', updated, updated.rev)
    set((state) => ({
      customers: state.customers.map((c) => (c.id === id ? { ...c, ...updated } : c)),
    }))
  },

  deleteCustomer: async (id) => {
    // Soft delete — অন্য ডিভাইস থেকে sync হয়ে row ফিরে আসা ঠেকায়
    const current = get().customers.find((c) => c.id === id) ?? (await db.customers.get(id))
    if (current) {
      const tombstone = markDeleted(current as Syncable<DbCustomer>)
      await db.customers.put(tombstone)
      void outbox.enqueue('customers', tombstone.uid, 'delete', tombstone, tombstone.rev)
    } else {
      await db.customers.delete(id)
    }
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
