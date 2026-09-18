import Dexie, { type Table } from 'dexie'

export interface DbUser {
  id: string
  name: string
  phone: string
  password_hash: string
  role: 'owner' | 'staff' | 'customer'
  branch_id?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DbBranch {
  id: string
  name: string
  address?: string
  phone?: string
  is_active: boolean
  created_at: string
}

export interface DbProduct {
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

export interface DbPurchase {
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

export interface DbSaleItem {
  product_id: string
  product_name: string
  quantity: number
  unit: string
  sale_price: number
  purchase_price: number
  total: number
  profit: number
}

export interface DbSale {
  id: string
  date: string
  items: DbSaleItem[]
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

export interface DbCustomer {
  id: string
  name: string
  phone?: string
  address?: string
  branch_id: string
  created_at: string
}

export interface DbCollection {
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

export interface DbExpense {
  id: string
  date: string
  category: string
  amount: number
  payment_method?: string
  branch_id: string
  note?: string
  created_at: string
}

export interface DbOrder {
  id: string
  customer_id: string
  customer_name: string
  items: { product_id: string; product_name: string; quantity: number; unit: string; sale_price: number; total: number }[]
  total_amount: number
  status: 'pending' | 'accepted' | 'delivered' | 'cancelled'
  branch_id: string
  note?: string
  created_at: string
  updated_at: string
}

export class ShopLedGerDB extends Dexie {
  users!: Table<DbUser>
  branches!: Table<DbBranch>
  products!: Table<DbProduct>
  purchases!: Table<DbPurchase>
  sales!: Table<DbSale>
  customers!: Table<DbCustomer>
  collections!: Table<DbCollection>
  expenses!: Table<DbExpense>
  orders!: Table<DbOrder>

  constructor() {
    super('shopledger-db')

    this.version(1).stores({
      users: 'id, phone, role, branch_id, is_active',
      branches: 'id, is_active',
      products: 'id, branch_id, name',
      purchases: 'id, product_id, branch_id, date',
      sales: 'id, branch_id, date, customer_id, created_by',
      customers: 'id, branch_id, name, phone',
      collections: 'id, customer_id, branch_id, date',
      expenses: 'id, branch_id, date, category',
      orders: 'id, customer_id, branch_id, status',
    })
  }
}

export const db = new ShopLedGerDB()
