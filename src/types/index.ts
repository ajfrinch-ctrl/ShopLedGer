export type UserRole = 'owner' | 'staff' | 'customer'

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

export interface Product {
  id: string
  name: string
  unit: string
  units_per_bag?: number
  opening_stock: number
  purchase_price: number
  sale_price: number
  branch_id: string
  note?: string
  created_at: string
  updated_at: string
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
  id: string
  date: string
  product_id: string
  product_name: string
  quantity: number
  unit: string
  purchase_price: number
  total: number
  supplier?: string
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
  payment_method?: string
  branch_id: string
  note?: string
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
