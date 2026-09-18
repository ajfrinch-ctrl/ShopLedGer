export type UserRole = 'owner' | 'manager' | 'salesman' | 'staff' | 'customer'

export interface User {
  id: string
  name: string
  phone: string
  email?: string
  role: UserRole
  branch_id?: string
  created_at: string
}

export interface Branch {
  id: string
  name: string
  address?: string
  phone?: string
  is_active: boolean
  created_at: string
}

export interface ProductCategory {
  name: string // যেমন 'তেল'
  prefix: string // যেমন 'OIL'
}

export interface Product {
  id: string
  code?: string // যেমন OIL-001 (অটো)
  category?: string
  company?: string // কোম্পানি/ব্র্যান্ড
  name: string
  unit: string
  units_per_bag?: number
  opening_stock: number
  purchase_price: number
  sale_price: number
  min_stock?: number
  branch_id: string
  note?: string
  created_at: string
  updated_at: string
}

export type StockAdjustmentReason = 'ক্ষয়' | 'নষ্ট' | 'গণনা সংশোধন' | 'অন্যান্য'

export interface StockAdjustment {
  id: string
  date: string
  product_id: string
  product_name: string
  quantity: number // + বাড়ানো, − কমানো
  unit: string
  reason: StockAdjustmentReason
  note?: string
  branch_id: string
  created_by: string
  created_at: string
}

export interface SaleItem {
  product_id: string
  product_name: string
  quantity: number
  unit: string
  sale_price: number
  purchase_price: number
  total: number
  profit: number
}

export interface Sale {
  id: string
  date: string
  items: SaleItem[]
  subtotal?: number
  discount?: number
  total_amount: number
  total_profit: number
  payment_type: 'নগদ' | 'বাকি'
  customer_id?: string
  customer_name?: string
  branch_id: string
  created_by: string
  note?: string
  created_at: string
}

export interface Purchase {
  payment_type?: 'নগদ' | 'বাকি'
  id: string
  date: string
  product_id: string
  product_name: string
  quantity: number
  unit: string
  purchase_price: number
  total: number
  supplier?: string
  invoice_id?: string // একই চালানের সব আইটেম একই invoice_id
  invoice_no?: string // সাপ্লাইয়ারের চালান নম্বর
  branch_id: string
  note?: string
  created_at: string
}

export interface Collection {
  id: string
  date: string
  customer_id: string
  customer_name: string
  amount: number
  payment_method?: string
  branch_id: string
  note?: string
  created_at: string
}

export interface Expense {
  id: string
  date: string
  category: string
  amount: number
  /** 'shop' = দোকানের খরচ (লাভ থেকে বাদ), 'owner' = মালিকের ব্যক্তিগত টাকা তোলা (লাভ থেকে বাদ যায় না) */
  kind?: 'shop' | 'owner'
  payment_method?: string
  branch_id: string
  note?: string
  created_by?: string
  created_at: string
}

export interface Customer {
  id: string
  name: string
  phone?: string
  address?: string
  branch_id: string
  created_at: string
}

export interface OrderItem {
  product_id: string
  product_name: string
  quantity: number
  unit: string
  sale_price: number
  total: number
}

export interface Order {
  id: string
  customer_id: string
  customer_name: string
  items: OrderItem[]
  total_amount: number
  status: 'pending' | 'accepted' | 'delivered' | 'cancelled'
  branch_id: string
  note?: string
  created_at: string
  updated_at: string
}
