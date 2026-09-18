import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product, ProductCategory } from '../types'
import { DEFAULT_CATEGORIES, assignMissingCodes, nextCode, normalizePrefix, prefixFor } from '../lib/productCode'

interface ProductState {
  products: Product[]
  categories: ProductCategory[]
  /** কোড না দিলে ক্যাটাগরি অনুযায়ী অটো কোড বসে। নতুন পণ্যটি রিটার্ন করে। */
  addProduct: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => Product
  updateProduct: (id: string, data: Partial<Product>) => void
  addCategory: (name: string, prefix: string) => ProductCategory
  getProductById: (id: string) => Product | undefined
  getProductByName: (name: string) => Product | undefined
  getProductByCode: (code: string) => Product | undefined
  previewCode: (category?: string) => string
}

const SAMPLE_PRODUCTS: Product[] = [
  { id: 'p1', name: 'পাতা ভূষি তাজিনিয়া', unit: 'বস্তা', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, category: 'ফিড', branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p2', name: 'চিকন ভুষি', unit: 'বস্তা', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, category: 'ফিড', branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p3', name: 'সয়ামিল', unit: 'বস্তা', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, category: 'ফিড', branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p4', name: 'গমের খুদি/চাউলের খুদি', unit: 'বস্তা', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, category: 'ফিড', branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p5', name: 'পাংশাস/তেলাপিয়া-ভাসমান/ভোবা', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, category: 'ফিড', branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p6', name: 'হালস', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, category: 'ফিড', branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p7', name: 'আটাকুঁড়া', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, category: 'ফিড', branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p8', name: 'হাউস ফিড', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, category: 'ফিড', branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p9', name: 'সরিষার খৈল', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, category: 'ফিড', branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p10', name: 'ভুট্টার আটা', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, category: 'ফিড', branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p11', name: 'মশুর ভুষি', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, category: 'ফিড', branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p12', name: 'দুধের ফিড/মোটাতাজা', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, category: 'ফিড', branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p13', name: 'মোটাকুঁড়া', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, category: 'ফিড', branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p14', name: 'মুগ ভুষি', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, category: 'ফিড', branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p15', name: 'মটর ভুষি', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, category: 'ফিড', branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p16', name: 'চনা ভুষি', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, category: 'ফিড', branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p17', name: 'চিড়া কুঁড়া', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, category: 'ফিড', branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p18', name: 'রাবভুঁড়া', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, category: 'ফিড', branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p19', name: 'ভুট্টাভাঙা', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, category: 'ফিড', branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p20', name: 'গম', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, category: 'ফিড', branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p21', name: 'কবুতর মিশ্রণ', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, category: 'ফিড', branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p22', name: 'ডিজিজিএস/ডিওআরবি', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, category: 'ফিড', branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'p23', name: 'ফিসমিল/ল্যাপসিড', unit: 'কেজি', units_per_bag: 50, opening_stock: 0, purchase_price: 0, sale_price: 0, category: 'ফিড', branch_id: 'branch-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
]

export const useProductStore = create<ProductState>()(
  persist(
    (set, get) => ({
      products: assignMissingCodes(SAMPLE_PRODUCTS, DEFAULT_CATEGORIES),
      categories: DEFAULT_CATEGORIES,

      addProduct: (product) => {
        const { products, categories } = get()
        const code = product.code?.trim().toUpperCase() || nextCode(prefixFor(product.category, categories), products)
        const newProduct: Product = {
          ...product,
          code,
          id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        set((state) => ({ products: [...state.products, newProduct] }))
        return newProduct
      },

      addCategory: (name, prefix) => {
        const cat = { name: name.trim(), prefix: normalizePrefix(prefix) }
        set((state) =>
          state.categories.some((c) => c.name === cat.name) ? state : { categories: [...state.categories, cat] },
        )
        return cat
      },

      previewCode: (category) => {
        const { products, categories } = get()
        return nextCode(prefixFor(category, categories), products)
      },

      getProductByCode: (code) => get().products.find((p) => p.code?.toUpperCase() === code.trim().toUpperCase()),

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
    {
      name: 'shopledger-products',
      version: 1,
      migrate: (persisted) => {
        const state = (persisted || {}) as Partial<ProductState>
        const categories = state.categories?.length ? state.categories : DEFAULT_CATEGORIES
        return {
          ...state,
          categories,
          products: assignMissingCodes(state.products || [], categories),
        } as ProductState
      },
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<ProductState>
        const categories = p.categories?.length ? p.categories : current.categories
        return {
          ...current,
          ...p,
          categories,
          products: assignMissingCodes(p.products || current.products, categories),
        }
      },
    }
  )
)
