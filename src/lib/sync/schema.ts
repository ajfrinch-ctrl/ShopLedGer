/**
 * ShopLedGer — Canonical Data Schema (Local First → Central DB Ready)
 *
 * এই ফাইলটি হলো "single source of truth": প্রতিটি Local table কোন ভবিষ্যৎ
 * Central Database table/collection-এ যাবে, তার field name, data type,
 * primary key, foreign key ও timestamp এখানে নির্ধারিত।
 *
 * গুরুত্বপূর্ণ নিয়ম:
 *  - Primary ID সবসময় `uid` (permanent, globally unique, কখনো পরিবর্তন হয় না)।
 *  - `local_id` (যেমন C2609001, S260901001) হলো মানুষের পড়ার সিরিয়াল —
 *    এটি কখনোই Primary Key নয়, শুধু display/search-এর জন্য।
 *  - সব row-তে `created_at`, `updated_at` (ISO-8601 UTC) থাকে; delete হয়
 *    soft-delete (`deleted_at`) যাতে multi-device sync-এ resurrect না হয়।
 *
 * এখানে কোনো network/server code নেই — এটি শুধু mapping ও contract।
 */

export type FieldType =
  | 'uuid'
  | 'text'
  | 'integer'
  | 'numeric'
  | 'boolean'
  | 'timestamptz'
  | 'date'
  | 'jsonb'

export interface FieldSpec {
  /** Central DB column name (local field name-এর সমান রাখা হয়েছে যাতে mapping সরল থাকে) */
  column: string
  type: FieldType
  nullable?: boolean
  /** অন্য table-এর dependency: `table.column` */
  references?: string
  note?: string
}

export interface TableSpec {
  /** Local উৎস: Dexie table নাম, অথবা zustand persist key */
  localStore: string
  storage: 'indexeddb' | 'localstorage'
  /** ভবিষ্যৎ central database-এর table/collection নাম */
  remoteTable: string
  /** Primary key — সবসময় uid */
  primaryKey: 'uid'
  /** Human-readable serial field (Primary Key নয়) */
  localIdField: 'local_id'
  /** একই row দুই ডিভাইসে দুইবার তৈরি হওয়া ঠেকাতে natural key */
  naturalKey: string[]
  fields: Record<string, FieldSpec>
}

/** প্রতিটি synced row-এ থাকা common metadata (নিচের সব table-এ যুক্ত হয়)। */
export const SYNC_META_FIELDS: Record<string, FieldSpec> = {
  uid: { column: 'uid', type: 'uuid', note: 'Permanent primary key — device/serial নিরপেক্ষ' },
  local_id: { column: 'local_id', type: 'text', note: 'মানুষের পড়ার সিরিয়াল (C2609001) — PK নয়' },
  branch_id: { column: 'branch_id', type: 'text', references: 'branches.uid', nullable: true },
  created_at: { column: 'created_at', type: 'timestamptz' },
  updated_at: { column: 'updated_at', type: 'timestamptz' },
  deleted_at: { column: 'deleted_at', type: 'timestamptz', nullable: true, note: 'Soft delete — tombstone' },
  origin_device_id: { column: 'origin_device_id', type: 'text', note: 'যে ডিভাইসে row তৈরি হয়েছে' },
  updated_by_device_id: { column: 'updated_by_device_id', type: 'text', note: 'শেষ যে ডিভাইস বদলেছে' },
  rev: { column: 'rev', type: 'integer', note: 'প্রতি পরিবর্তনে +1 — conflict detection' },
  schema_version: { column: 'schema_version', type: 'integer', note: 'Migration-এর জন্য row-level version' },
}

const meta = (extra: Record<string, FieldSpec>): Record<string, FieldSpec> => ({
  ...SYNC_META_FIELDS,
  ...extra,
})

/** বর্তমান canonical schema version — migration এখান থেকে চালানো হয়। */
export const SCHEMA_VERSION = 1

export const SCHEMA: Record<string, TableSpec> = {
  users: {
    localStore: 'users',
    storage: 'indexeddb',
    remoteTable: 'users',
    primaryKey: 'uid',
    localIdField: 'local_id',
    naturalKey: ['phone'],
    fields: meta({
      name: { column: 'name', type: 'text' },
      phone: { column: 'phone', type: 'text' },
      username: { column: 'username', type: 'text', nullable: true },
      password_hash: { column: 'password_hash', type: 'text', note: 'Online হলে server-side auth, এটি sync হবে না' },
      role: { column: 'role', type: 'text' },
      branch_ids: { column: 'branch_ids', type: 'jsonb', nullable: true },
      is_active: { column: 'is_active', type: 'boolean' },
      approval: { column: 'approval', type: 'text', nullable: true },
      address: { column: 'address', type: 'text', nullable: true },
    }),
  },
  branches: {
    localStore: 'branches',
    storage: 'indexeddb',
    remoteTable: 'branches',
    primaryKey: 'uid',
    localIdField: 'local_id',
    naturalKey: ['name'],
    fields: meta({
      name: { column: 'name', type: 'text' },
      address: { column: 'address', type: 'text', nullable: true },
      phone: { column: 'phone', type: 'text', nullable: true },
      organization: { column: 'organization', type: 'text', nullable: true },
      logo: { column: 'logo', type: 'text', nullable: true },
      is_active: { column: 'is_active', type: 'boolean' },
    }),
  },
  customers: {
    localStore: 'customers',
    storage: 'indexeddb',
    remoteTable: 'customers',
    primaryKey: 'uid',
    localIdField: 'local_id',
    naturalKey: ['branch_id', 'phone', 'name'],
    fields: meta({
      name: { column: 'name', type: 'text' },
      phone: { column: 'phone', type: 'text', nullable: true },
      address: { column: 'address', type: 'text', nullable: true },
    }),
  },
  products: {
    localStore: 'shopledger-products',
    storage: 'localstorage',
    remoteTable: 'products',
    primaryKey: 'uid',
    localIdField: 'local_id',
    naturalKey: ['branch_id', 'code'],
    fields: meta({
      code: { column: 'code', type: 'text', nullable: true },
      name: { column: 'name', type: 'text' },
      category: { column: 'category', type: 'text', nullable: true },
      company: { column: 'company', type: 'text', nullable: true },
      unit: { column: 'unit', type: 'text' },
      units_per_bag: { column: 'units_per_bag', type: 'numeric', nullable: true },
      opening_stock: { column: 'opening_stock', type: 'numeric' },
      purchase_price: { column: 'purchase_price', type: 'numeric' },
      sale_price: { column: 'sale_price', type: 'numeric' },
      min_stock: { column: 'min_stock', type: 'numeric', nullable: true },
      note: { column: 'note', type: 'text', nullable: true },
    }),
  },
  sales: {
    localStore: 'shopledger-sales',
    storage: 'localstorage',
    remoteTable: 'sales',
    primaryKey: 'uid',
    localIdField: 'local_id',
    naturalKey: ['branch_id', 'local_id'],
    fields: meta({
      date: { column: 'date', type: 'date' },
      items: { column: 'items', type: 'jsonb', note: 'Online-এ চাইলে sale_items child table-এ normalize করা যাবে' },
      subtotal: { column: 'subtotal', type: 'numeric', nullable: true },
      discount: { column: 'discount', type: 'numeric', nullable: true },
      total_amount: { column: 'total_amount', type: 'numeric' },
      total_profit: { column: 'total_profit', type: 'numeric' },
      payment_type: { column: 'payment_type', type: 'text' },
      customer_id: { column: 'customer_id', type: 'text', nullable: true, references: 'customers.uid' },
      customer_name: { column: 'customer_name', type: 'text', nullable: true },
      created_by: { column: 'created_by', type: 'text', references: 'users.uid' },
      note: { column: 'note', type: 'text', nullable: true },
    }),
  },
  purchases: {
    localStore: 'shopledger-purchases',
    storage: 'localstorage',
    remoteTable: 'purchases',
    primaryKey: 'uid',
    localIdField: 'local_id',
    naturalKey: ['branch_id', 'local_id'],
    fields: meta({
      date: { column: 'date', type: 'date' },
      product_id: { column: 'product_id', type: 'text', references: 'products.uid' },
      product_name: { column: 'product_name', type: 'text' },
      quantity: { column: 'quantity', type: 'numeric' },
      unit: { column: 'unit', type: 'text' },
      purchase_price: { column: 'purchase_price', type: 'numeric' },
      total: { column: 'total', type: 'numeric' },
      supplier: { column: 'supplier', type: 'text', nullable: true },
      invoice_id: { column: 'invoice_id', type: 'text', nullable: true },
      invoice_no: { column: 'invoice_no', type: 'text', nullable: true },
      payment_type: { column: 'payment_type', type: 'text', nullable: true },
      note: { column: 'note', type: 'text', nullable: true },
    }),
  },
  collections: {
    localStore: 'collections',
    storage: 'indexeddb',
    remoteTable: 'collections',
    primaryKey: 'uid',
    localIdField: 'local_id',
    naturalKey: ['branch_id', 'local_id'],
    fields: meta({
      date: { column: 'date', type: 'date' },
      customer_id: { column: 'customer_id', type: 'text', references: 'customers.uid' },
      customer_name: { column: 'customer_name', type: 'text' },
      amount: { column: 'amount', type: 'numeric' },
      payment_method: { column: 'payment_method', type: 'text', nullable: true },
      note: { column: 'note', type: 'text', nullable: true },
    }),
  },
  ledgerEntries: {
    localStore: 'ledgerEntries',
    storage: 'indexeddb',
    remoteTable: 'ledger_entries',
    primaryKey: 'uid',
    localIdField: 'local_id',
    naturalKey: ['branch_id', 'local_id'],
    fields: meta({
      party_id: { column: 'party_id', type: 'text', note: 'customer হলে customers.uid, supplier হলে derived id' },
      party_name: { column: 'party_name', type: 'text' },
      party_type: { column: 'party_type', type: 'text' },
      kind: { column: 'kind', type: 'text' },
      amount: { column: 'amount', type: 'numeric' },
      date: { column: 'date', type: 'date' },
      method: { column: 'method', type: 'text' },
      reference: { column: 'reference', type: 'text' },
      note: { column: 'note', type: 'text' },
      cancelled: { column: 'cancelled', type: 'boolean' },
      created_by: { column: 'created_by', type: 'text', references: 'users.uid' },
    }),
  },
  ledgerAudits: {
    localStore: 'ledgerAudits',
    storage: 'indexeddb',
    remoteTable: 'ledger_audits',
    primaryKey: 'uid',
    localIdField: 'local_id',
    naturalKey: ['entry_id', 'at', 'action'],
    fields: meta({
      entry_id: { column: 'entry_id', type: 'text', references: 'ledger_entries.uid' },
      actor: { column: 'actor', type: 'text' },
      actor_id: { column: 'actor_id', type: 'text', references: 'users.uid' },
      at: { column: 'at', type: 'timestamptz' },
      action: { column: 'action', type: 'text' },
      before: { column: 'before', type: 'jsonb', nullable: true },
      after: { column: 'after', type: 'jsonb' },
      reason: { column: 'reason', type: 'text' },
    }),
  },
  expenses: {
    localStore: 'expenses',
    storage: 'indexeddb',
    remoteTable: 'expenses',
    primaryKey: 'uid',
    localIdField: 'local_id',
    naturalKey: ['branch_id', 'local_id'],
    fields: meta({
      date: { column: 'date', type: 'date' },
      category: { column: 'category', type: 'text' },
      amount: { column: 'amount', type: 'numeric' },
      kind: { column: 'kind', type: 'text', nullable: true },
      payment_method: { column: 'payment_method', type: 'text', nullable: true },
      note: { column: 'note', type: 'text', nullable: true },
      created_by: { column: 'created_by', type: 'text', nullable: true, references: 'users.uid' },
    }),
  },
  orders: {
    localStore: 'orders',
    storage: 'indexeddb',
    remoteTable: 'orders',
    primaryKey: 'uid',
    localIdField: 'local_id',
    naturalKey: ['branch_id', 'local_id'],
    fields: meta({
      customer_id: { column: 'customer_id', type: 'text', references: 'customers.uid' },
      customer_name: { column: 'customer_name', type: 'text' },
      items: { column: 'items', type: 'jsonb' },
      total_amount: { column: 'total_amount', type: 'numeric' },
      status: { column: 'status', type: 'text' },
      note: { column: 'note', type: 'text', nullable: true },
    }),
  },
  stockAdjustments: {
    localStore: 'shopledger-stock-adjustments',
    storage: 'localstorage',
    remoteTable: 'stock_adjustments',
    primaryKey: 'uid',
    localIdField: 'local_id',
    naturalKey: ['branch_id', 'local_id'],
    fields: meta({
      date: { column: 'date', type: 'date' },
      product_id: { column: 'product_id', type: 'text', references: 'products.uid' },
      product_name: { column: 'product_name', type: 'text' },
      quantity: { column: 'quantity', type: 'numeric' },
      unit: { column: 'unit', type: 'text' },
      reason: { column: 'reason', type: 'text' },
      note: { column: 'note', type: 'text', nullable: true },
      created_by: { column: 'created_by', type: 'text', references: 'users.uid' },
    }),
  },
  customerMessages: {
    localStore: 'customerMessages',
    storage: 'indexeddb',
    remoteTable: 'customer_messages',
    primaryKey: 'uid',
    localIdField: 'local_id',
    naturalKey: ['branch_id', 'local_id'],
    fields: meta({
      customer_id: { column: 'customer_id', type: 'text', references: 'customers.uid' },
      customer_name: { column: 'customer_name', type: 'text' },
      phone: { column: 'phone', type: 'text', nullable: true },
      kind: { column: 'kind', type: 'text' },
      amount: { column: 'amount', type: 'numeric', nullable: true },
      method: { column: 'method', type: 'text', nullable: true },
      note: { column: 'note', type: 'text' },
      seen: { column: 'seen', type: 'boolean' },
      seen_at: { column: 'seen_at', type: 'timestamptz', nullable: true },
    }),
  },
}

export type SyncTableName = keyof typeof SCHEMA

export const SYNC_TABLES = Object.keys(SCHEMA) as SyncTableName[]

/** Local store নাম থেকে canonical table খুঁজে বের করে। */
export function tableForLocalStore(localStore: string): SyncTableName | undefined {
  return SYNC_TABLES.find((t) => SCHEMA[t].localStore === localStore)
}

/** কোন table কোন table-গুলোর উপর নির্ভরশীল — sync/push order নির্ধারণে ব্যবহৃত। */
export function dependenciesOf(table: SyncTableName): string[] {
  const deps = new Set<string>()
  for (const field of Object.values(SCHEMA[table].fields)) {
    if (!field.references) continue
    const remote = field.references.split('.')[0]
    const local = SYNC_TABLES.find((t) => SCHEMA[t].remoteTable === remote)
    if (local && local !== table) deps.add(local)
  }
  return [...deps]
}

/**
 * Foreign key নির্ভরতা মেনে push order (parent আগে, child পরে)।
 * Cycle থাকলেও কখনো আটকে যাবে না — বাকিগুলো শেষে যোগ হয়।
 */
export function syncOrder(): SyncTableName[] {
  const ordered: SyncTableName[] = []
  const visiting = new Set<string>()

  const visit = (table: SyncTableName) => {
    if (ordered.includes(table) || visiting.has(table)) return
    visiting.add(table)
    for (const dep of dependenciesOf(table)) visit(dep as SyncTableName)
    visiting.delete(table)
    ordered.push(table)
  }

  SYNC_TABLES.forEach(visit)
  return ordered
}
