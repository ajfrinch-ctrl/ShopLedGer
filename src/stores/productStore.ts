import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product } from '../types'

interface ProductState {
  products: Product[]
  addProduct: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => void
  updateProduct: (id: string, data: Partial<Product>) => void
  getProductById: (id: string) => Product | undefined
  getProductByName: (name: string) => Product | undefined
}

const SAMPLE_PRODUCTS: Product[] = [
  { id: 'p1', name: 'পাতা ভূষি তাজিনিয়া', unit: 'বস্তা', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p2', name: 'চিকন ভুষি', unit: 'বস্তা', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p3', name: 'সয়ামিল', unit: 'বস্তা', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p4', name: 'গমের খুদি/চাউলের খুদি', unit: 'বস্তা', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p5', name: 'পাংশাস/তেলাপিয়া-ভাসমান/ভোবা', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p6', name: 'হালস', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p7', name: 'আটাকুঁড়া', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p8', name: 'হাউস ফিড', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p9', name: 'সরিষার খৈল', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p10', name: 'ভুট্টার আটা', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p11', name: 'মশুর ভুষি', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p12', name: 'দুধের ফিড/মোটাতাজা', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p13', name: 'মোটাকুঁড়া', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p14', name: 'মুগ ভুষি', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p15', name: 'মটর ভুষি', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p16', name: 'চনা ভুষি', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p17', name: 'চিড়া কুঁড়া', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p18', name: 'রাবভুঁড়া', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p19', name: 'ভুট্টাভাঙা', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p20', name: 'গম', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p21', name: 'কবুতর মিশ্রণ', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p22', name: 'ডিজিজিএস/ডিওআরবি', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p23', name: 'ফিসমিল/ল্যাপসিড', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
]

export const useProductStore = create<ProductState>()(
  persist(
    (set, get) => ({
      products: SAMPLE_PRODUCTS,

      addProduct: (product) => {
        const newProduct: Product = {
          ...product,
          id: `p-${Date.now()}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        set((state) => ({ products: [...state.products, newProduct] }))
      },

      updateProduct: (id, data) => {
        set((state) => ({
          products: state.products.map((p) =>
            p.id === id ? { ...p, ...data, updated_at: new Date().toISOString() } : p
          ),
        }))
      },

      getProductById: (id) => get().products.find((p) => p.id === id),
      getProductByName: (name) => get().products.find((p) => p.name === name),
    }),
    { name: 'shopledger-products' }
  )
)
