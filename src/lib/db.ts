import Dexie, { type Table } from 'dexie'
import type { OutboxOp, SyncCursor, SyncMeta } from './sync/types'
import type { BackupRecord } from './backup'

/**
 * সব local row ধীরে ধীরে এই metadata পাবে (Offline-First → Future Sync Ready)।
 * পুরোনো row-তে না থাকলেও কিছু ভাঙে না — সব ফিল্ড optional রাখা হয়েছে,
 * এবং v6 migration সেগুলো backfill করে দেয়।
 */
export type WithSync<T> = T & Partial<SyncMeta>

export interface DbUser {
  id: string
  name: string
  phone: string
  password_hash: string
  role: 'owner' | 'manager' | 'salesman' | 'staff' | 'customer'
  /** লগইনের জন্য ইউনিক ইউজারনেম (ব্যবস্থাপক/সেলস ম্যানের আইডি; ফোন নম্বর দিয়েও লগইন করা যায়) */
  username?: string
  /** প্রধান শাখা (পুরোনো ফিল্ড — branch_ids-এর প্রথমটির সমান রাখা হয়) */
  branch_id?: string
  /** এই আইডি যেসব শাখা পরিচালনা করতে পারবে (একাধিক হতে পারে) */
  branch_ids?: string[]
  is_active: boolean
  /** ক্রেতা নিজে সাইন-আপ করলে দোকানের অনুমোদনের অবস্থা */
  approval?: 'pending' | 'approved' | 'rejected'
  address?: string
  /** প্রথম লগইনে পাসওয়ার্ড পরিবর্তন বাধ্যতামূলক কি না */
  must_change_password?: boolean
  /** ভুল পাসওয়ার্ড দেওয়ার সংখ্যা (৫ বার হলে লক হয়) */
  failed_login_attempts?: number
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
  ledgerEntries!: Table<WithSync<LedgerEntry>>
  ledgerAudits!: Table<WithSync<LedgerAudit>>
  users!: Table<WithSync<DbUser>>
  branches!: Table<WithSync<DbBranch>>
  products!: Table<WithSync<DbProduct>>
  purchases!: Table<WithSync<DbPurchase>>
  sales!: Table<WithSync<DbSale>>
  customers!: Table<WithSync<DbCustomer>>
  collections!: Table<WithSync<DbCollection>>
  expenses!: Table<WithSync<DbExpense>>
  orders!: Table<WithSync<DbOrder>>
  stockAdjustments!: Table<WithSync<DbStockAdjustment>>
  customerMessages!: Table<WithSync<DbCustomerMessage>>
  /** অফলাইনে করা পরিবর্তনের queue — Online হলে এখান থেকেই push হবে */
  syncOutbox!: Table<OutboxOp>
  /** প্রতি table-এর incremental pull cursor */
  syncCursors!: Table<SyncCursor>
  /** ডেটা ব্যাকআপের অ্যাপ-ভিতরের স্ন্যাপশট (মালিকের জন্য, প্রতিদিন অটো + নিজে নেওয়া) */
  backups!: Table<BackupRecord>

  constructor() {
    super('shopledger-db')

    // v7: মালিকের ডেটা ব্যাকআপ — প্রতিদিনের অটো স্ন্যাপশট ও নিজে নেওয়া স্ন্যাপশট
    this.version(7).stores({
      backups: 'id, kind, day, created_at',
    })

    // v6: Offline-First → Future Sync Ready.
    // - প্রতিটি synced table-এ `uid` (স্থায়ী primary id) ও `updated_at` index
    // - outbox + cursor table যোগ
    // - পুরোনো সব row-তে uid/local_id/timestamp backfill (data loss ছাড়া)
    this.version(6)
      .stores({
        users: 'id, uid, phone, username, role, branch_id, is_active, updated_at',
        branches: 'id, uid, is_active, updated_at',
        products: 'id, uid, branch_id, name, updated_at',
        purchases: 'id, uid, product_id, branch_id, date, updated_at',
        sales: 'id, uid, branch_id, date, customer_id, created_by, updated_at',
        customers: 'id, uid, branch_id, name, phone, updated_at',
        collections: 'id, uid, customer_id, branch_id, date, updated_at',
        expenses: 'id, uid, branch_id, date, category, updated_at',
        orders: 'id, uid, customer_id, branch_id, status, updated_at',
        stockAdjustments: 'id, uid, product_id, branch_id, date, updated_at',
        customerMessages: 'id, uid, customer_id, branch_id, created_at, seen, updated_at',
        ledgerEntries: 'id, uid, party_id, branch_id, date, updated_at',
        ledgerAudits: 'id, uid, entry_id, at, updated_at',
        syncOutbox: 'id, table, row_uid, created_at',
        syncCursors: 'table',
      })
      .upgrade(async (tx) => {
        const tables = ['users', 'branches', 'products', 'purchases', 'sales', 'customers',
          'collections', 'expenses', 'orders', 'stockAdjustments', 'customerMessages',
          'ledgerEntries', 'ledgerAudits']
        const { backfillSyncMeta } = await import('./sync/migrate')
        for (const name of tables) {
          await tx.table(name).toCollection().modify(backfillSyncMeta)
        }
      })

    // v5: ব্যবস্থাপক/সেলস ম্যান আইডি — username ইনডেক্স, পুরোনো 'staff' রোল → 'manager',
    // এবং branch_id থেকে branch_ids তৈরি
    this.version(5)
      .stores({
        users: 'id, phone, username, role, branch_id, is_active',
      })
      .upgrade(async (tx) => {
        await tx
          .table('users')
          .toCollection()
          .modify((user: { role?: string; branch_id?: string; branch_ids?: string[] }) => {
            if (user.role === 'staff') user.role = 'manager'
            if (user.branch_id && (!user.branch_ids || !user.branch_ids.length)) {
              user.branch_ids = [user.branch_id]
            }
          })
      })

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
