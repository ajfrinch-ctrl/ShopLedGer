# ShopLedGer — Offline-First + Future Online-Ready Architecture

> **নীতি: Local Data First → Future Central Database Sync Ready**
> বর্তমানে কোনো Server / API / Online Database **বাধ্যতামূলক নয়**। অ্যাপ সম্পূর্ণ
> অফলাইনে চলে; sync layer শুধু ভবিষ্যতের জন্য তথ্য ও mapping জমা রাখে।

## ১. Data Flow

```
UI (React)
   ↓ (সঙ্গে সঙ্গে, কোনো await নেই)
zustand store  →  IndexedDB (Dexie) / localStorage      ← Login, Customer, Transaction,
   ↓                                                       Receipt, Search, Report সবই
sync outbox (শুধু queue হয়, কিছু push হয় না)              এখান থেকেই দ্রুত চলে
   ↓
[ভবিষ্যৎ] Central Database  ⇄  push / pull
```

UI কখনো outbox বা network-এর জন্য অপেক্ষা করে না (`void outbox.enqueue(...)`),
তাই বর্তমান offline performance অপরিবর্তিত।

## ২. Storage Map

| Domain | Local store | Storage | ভবিষ্যৎ Central table |
| --- | --- | --- | --- |
| Users | `users` | IndexedDB | `users` |
| Branches | `branches` | IndexedDB | `branches` |
| Customers | `customers` | IndexedDB | `customers` |
| Products | `shopledger-products` | localStorage | `products` |
| Sales | `shopledger-sales` | localStorage | `sales` |
| Purchases | `shopledger-purchases` | localStorage | `purchases` |
| Collections | `collections` | IndexedDB | `collections` |
| Ledger entries | `ledgerEntries` | IndexedDB | `ledger_entries` |
| Ledger audits | `ledgerAudits` | IndexedDB | `ledger_audits` |
| Expenses | `expenses` | IndexedDB | `expenses` |
| Orders | `orders` | IndexedDB | `orders` |
| Stock adjustments | `shopledger-stock-adjustments` | localStorage | `stock_adjustments` |
| Customer messages | `customerMessages` | IndexedDB | `customer_messages` |

সম্পূর্ণ field name, data type, foreign key ও nullability: `src/lib/sync/schema.ts`
(এটিই single source of truth; test দিয়ে যাচাই করা হয়)।

## ৩. Primary ID নীতি

| Field | কাজ | PK? |
| --- | --- | --- |
| `uid` | স্থায়ী UUID v4 — সব ডিভাইসে একই, কখনো বদলায় না | ✅ **Primary Key** |
| `local_id` | মানুষের পড়ার সিরিয়াল (`C2609001`, `S260901001`) | ❌ কখনো নয় |
| `id` | বিদ্যমান UI/route যা ব্যবহার করে (= `local_id`) | ❌ |

**Serial Number কখনোই Primary ID নয়** — দুই ডিভাইস অফলাইনে একই সিরিয়াল
তৈরি করতে পারে, কিন্তু `uid` কখনো সংঘর্ষ করবে না।

## ৪. প্রতিটি row-এর Sync Metadata

| Field | Type | কাজ |
| --- | --- | --- |
| `uid` | uuid | স্থায়ী Primary ID |
| `local_id` | text | পড়ার সিরিয়াল |
| `created_at` / `updated_at` | timestamptz (ISO-8601) | Timestamp |
| `deleted_at` | timestamptz \| null | Soft delete (tombstone) |
| `origin_device_id` | text | কোন ডিভাইসে তৈরি |
| `updated_by_device_id` | text | শেষ কোন ডিভাইস বদলেছে |
| `rev` | integer | প্রতি লেখায় +1 — conflict detection |
| `schema_version` | integer | Row-level migration version |

## ৫. Duplicate Prevention

প্রতি table-এ **natural key** নির্ধারিত (যেমন customers → `branch_id + phone + name`)।

- `dedupeCandidate()` — নতুন row যোগের আগে বিদ্যমান মিল খোঁজে (case/whitespace-insensitive)।
- `findDuplicates()` — sync-এর পরে একই natural key-এর একাধিক row ধরে merge করার জন্য।

## ৬. Conflict Handling

`resolveConflict(local, remote)` — deterministic, তাই সব ডিভাইস একই ফলাফলে পৌঁছায়:

1. **Tombstone জেতে** — মুছে ফেলা row কখনো ফিরে আসে না।
2. বড় **`rev`** জেতে।
3. `rev` সমান হলে নতুন **`updated_at`** জেতে (last-write-wins)।
4. সবই সমান হলে **`device_id` tie-break** (convergence নিশ্চিত)।

`prefer-local` / `prefer-remote` strategy-ও সমর্থিত।

## ৭. Outbox (Local → Central)

`src/lib/sync/outbox.ts` — অফলাইনে করা প্রতিটি পরিবর্তন queue হয়।

- `pending()` — foreign key নির্ভরতা মেনে সাজানো (parent আগে, child পরে; `syncOrder()`)।
- `compact()` — একই row-এর পুরোনো op বাদ, delete সবসময় জেতে।
- `ack()` — সফলভাবে push হওয়া op মুছে দেয় (duplicate push নেই)।
- `cursor()` / `setCursor()` — per-table incremental **pull** position (Central → Device)।
- `OUTBOX_LIMIT` (৫০০০) — storage ভরে যাওয়া ঠেকাতে auto-trim।

Online চালু করতে শুধু একটি transport লিখতে হবে:
`pending()` → server-এ পাঠান → `ack()`; আর pull-এ `fromRemotePayload()` +
`resolveConflict()` ব্যবহার করুন। UI বা store-এ কোনো পরিবর্তন লাগবে না —
Local cache আগের মতোই সঙ্গে সঙ্গে render করবে।

## ৮. Migration / Data Version

- **Dexie v6** — additive upgrade: নতুন `uid`/`updated_at` index, `syncOutbox`,
  `syncCursors` table, এবং পুরোনো সব row-তে metadata backfill। কোনো ডাটা মুছে না।
- **zustand persist** — `persistedSyncMigration()` দিয়ে localStorage store গুলোতে
  একই backfill।
- Backfill **idempotent** — দুইবার চললেও `uid` বদলায় না।
- ভবিষ্যতে Database বদলালে `schema_version` বাড়িয়ে ধাপে ধাপে migration যোগ করা যাবে।

## ৯. কী পরিবর্তন হয়নি

Login/Auth flow, routing, UI, receipt, report ও stock হিসাব — সব অপরিবর্তিত।
সব sync field **optional/additive**, তাই পুরোনো ডাটা নিয়েই অ্যাপ আগের মতো চলে।
