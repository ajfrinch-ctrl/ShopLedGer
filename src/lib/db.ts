import Dexie, { type Table } from 'dexie'

export interface DbUser {
  id: string
  name: string
  phone: string
  password_hash: string
  role: 'owner' | 'staff' | 'customer'
  branch_id?: string
  is_active: boolean
  /** ক্রেতা নিজে সাইন-আপ করলে দোকানের অনুমোদনের অবস্থা */
  approval?: 'pending' | 'approved' | 'rejected'
  address?: string
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
  organization?: string
  logo?: string
}

export interface DbProduct {
  id: string
  code?: string
  category?: string
  company?: string
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

export interface DbStockAdjustment {
  id: string
  date: string
  product_id: string
  product_name: string
  quantity: number
  unit: string
  reason: 'ক্ষয়' | 'নষ্ট' | 'গণনা সংশোধন' | 'অন্যান্য'
  note?: string
  branch_id: string
  created_by: string
  created_at: string
}

export interface DbPurchase {
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
  invoice_id?: string
  invoice_no?: string
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
  /** 'shop' = দোকানের খরচ (লাভ থেকে বাদ), 'owner' = মালিকের ব্যক্তিগত টাকা তোলা (লাভ থেকে বাদ যায় না) */
  kind?: 'shop' | 'owner'
  payment_method?: string
  branch_id: string
  note?: string
  created_by?: string
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

export interface LedgerEntry {
  id: string
  party_id: string
  party_name: string
  party_type: 'customer' | 'supplier'
  kind: 'opening' | 'payment'
  amount: number
  date: string
  branch_id: string
  method: string
  reference: string
  note: string
  cancelled: boolean
  created_at: string
  created_by: string
}
export interface LedgerAudit {
  id: string
  entry_id: string
  actor: string
  actor_id: string
  at: string
  action: string
  before?: LedgerEntry
  after: LedgerEntry
  reason: string
}

/** ক্রেতার পাঠানো বার্তা (বাকি জানানো, টাকা দেওয়ার খবর ইত্যাদি) — দোকান "বার্তা" ট্যাবে দেখে */
export interface DbCustomerMessage {
  id: string
  customer_id: string
  customer_name: string
  phone?: string
  branch_id: string
  kind: 'payment' | 'due-info' | 'other'
  amount?: number
  method?: string
  note: string
  created_at: string
  seen: boolean
  seen_at?: string
}

export class ShopLedGerDB extends Dexie {
  ledgerEntries!: Table<LedgerEntry>
  ledgerAudits!: Table<LedgerAudit>
  users!: Table<DbUser>
  branches!: Table<DbBranch>
  products!: Table<DbProduct>
  purchases!: Table<DbPurchase>
  sales!: Table<DbSale>
  customers!: Table<DbCustomer>
  collections!: Table<DbCollection>
  expenses!: Table<DbExpense>
  orders!: Table<DbOrder>
  stockAdjustments!: Table<DbStockAdjustment>
  customerMessages!: Table<DbCustomerMessage>

  constructor() {
    super('shopledger-db')

    this.version(4).stores({
      customerMessages: 'id, customer_id, branch_id, created_at, seen',
    })

    this.version(3).stores({
      stockAdjustments: 'id, product_id, branch_id, date',
    })

    this.version(2).stores({
      ledgerEntries: 'id, party_id, branch_id, date',
      ledgerAudits: 'id, entry_id, at',
    })

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
