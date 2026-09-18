# ShopLedGer — সম্পূর্ণ অডিট রিপোর্ট (হালনাগাদ)

**তারিখ:** ১৮ সেপ্টেম্বর ২০২৬
**শাখা:** `arena/01a0b525-shopledger`
**বেস কমিট:** `ed1a227` (main)
**প্রকল্প সংস্করণ:** v0.1.0

এই রিপোর্টে (১) পুরনো অডিটের আইটেমগুলোর বর্তমান অবস্থা, এবং (২) নতুন করে পাওয়া সমস্যা ও
এই ব্রাঞ্চে করা ফিক্স — দুটোই অন্তর্ভুক্ত। শেষে টুল-ভেরিফিকেশনের ফলাফল দেওয়া আছে।

---

## ✅ টুল-ভেরিফিকেশন সারসংক্ষেপ

| চেক | ফলাফল |
|-----|--------|
| `npm ci` / `npm install` | ✅ সফল (আগে **ব্যর্থ** — peer-dep কনফ্লিক্ট, দেখুন N1) |
| `npm run build` (tsc + vite) | ✅ সফল, precache 4198 KiB → **1265 KiB** |
| `npm test` | ✅ ১৮/১৮ পাস |
| `npm run lint` (ESLint) | ✅ ০ এরর, ০ ওয়ার্নিং (আগে eslint ইনস্টলই ছিল না — N2) |
| `npm audit` | ✅ ০ ভালনেরেবিলিটি |

---

## 🔴 নতুন সমালোচনামূলক / উচ্চ সমস্যা (এই ব্রাঞ্চে ফিক্সড)

### N1. ডিপেন্ডেন্সি কনফ্লিক্ট — প্রজেক্ট ইনস্টল/বিল্ড/CI হতো না
**ফাইল:** `package.json`
**সমস্যা:** `vite@8.3.0` (dependabot আপগ্রেড) কিন্তু `@vitejs/plugin-react@^4.3.1` — যার peer range `vite ^4–^7`। ফলে `npm ci` ERESOLVE এররে ব্যর্থ; GitHub Pages ওয়ার্কফ্লো-ও ব্যর্থ হতো।
**ফিক্স:** `vite@^7.3.6` + `@vitejs/plugin-react@^5.2.0` (দুটোই স্টেবল, `vite-plugin-pwa@1.3.0`-এর সাথে সামঞ্জস্যপূর্ণ)। লকফাইল রিজেনারেট করা হয়েছে।

### N2. `npm run lint` ভাঙা — eslint ছিলই না
**সমস্যা:** `package.json`-এ `"lint": "eslint ."` কিন্তু eslint ইনস্টল/কনফিগ নেই।
**ফিক্স:** ESLint 9 flat config (`eslint.config.js`) + `typescript-eslint`, `react-hooks`, `react-refresh` প্লাগইন যোগ; ৪টি hooks-ওয়ার্নিং ফিক্স করে এখন **ক্লিন রান**।

### N3. টাকা ১০০ গুণ কম দেখাত — `MyDues.tsx` ডাবল-ডিভিশন বাগ
**ফাইল:** `src/pages/MyDues.tsx`
**সমস্যা:** `ledgerRows()` আগেই cents→টাকা কনভার্ট করে দেয়; পেজটি আবার `money(r.debit / 100)` করায় ক্রেতার বাকি খাতায় জমা/বাকি কলাম ১০০ গুণ কম দেখাত (ব্যালেন্স কলাম ঠিক ছিল)।
**ফিক্স:** `/100` সরানো হয়েছে — এখন `Collections.tsx`-এর মতোই সরাসরি `money(r.debit)`।

### N4. UTC তারিখ বাগ — "আজ/এই মাস"-এর হিসাব ভুল (BD টাইমজোনে রাত ১২টা–সকাল ৬টা)
**ফাইল:** `src/pages/Dashboard.tsx`, `src/pages/Sales.tsx`, `src/stores/salesStore.ts`, `src/pages/Stock.tsx`
**সমস্যা:** `new Date().toISOString().split('T')[0]` হলো **UTC** তারিখ; বাংলাদেশে (UTC+6) মধ্যরাত থেকে সকাল ৬টা পর্যন্ত "আজ"-এর বিক্রি, ড্যাশবোর্ড স্ট্যাটস, মাসের শুরু — সব আগের দিনের হিসাব দেখাত।
**ফিক্স:** বিদ্যমান লোকাল-ডেট হেল্পার `toDateKey()` ব্যবহার করা হয়েছে (Dashboard-এ `monthStart`-ও)।

### N5. ডেটা-মডেল অসামঞ্জস্য — বিক্রি/ক্রয়ের তারিখ UTC, লেজার এন্ট্রির তারিখ লোকাল
**ফাইল:** `src/pages/Sales.tsx`, `src/pages/Orders.tsx` (ডেলিভারি→বিক্রি), `src/pages/Purchases.tsx`, `src/lib/profitLoss.ts`
**সমস্যা:** লেজার এন্ট্রি `YYYY-MM-DD` (লোকাল) সেভ হয়, কিন্তু Sale/Purchase সেভ হতো UTC ISO-তে; ফলে একই দিনের লেনদেন দুই রকম দিন-কি পেত, `inRange`/ফিল্টারে অমিল।
**ফিক্স:** নতুন হেল্পার `nowLocalISO()` (লোকাল ক্যালেন্ডার দিন + সময়) — Sale, Purchase, order→sale কনভার্সনে ব্যবহৃত। পুরনো ডেটা পার্স/সর্টে অক্ষত থাকে।

### N6. ID collision — `Date.now()` ভিত্তিক আইডি
**ফাইল:** salesStore, purchaseStore, customerStore, stockAdjustmentStore, productStore, Expenses, Orders, Purchases (invoice_id)
**সমস্যা:** একই মিলিসেকেন্ডে দুটি এন্ট্রি হলে আইডি ক্ল্যাশ।
**ফিক্স:** সব জায়গায় `crypto.randomUUID()`। (`grep Date.now src/` → এখন খালি।)

### N7. রোল-ভিত্তিক রাউট প্রোটেকশন ছিল না
**ফাইল:** `src/App.tsx`
**সমস্যা:** `ProtectedRoute` শুধু লগইন দেখত; ক্রেতা রোল URL টাইপ করে `/sales`, `/stock`, `/purchases`-এ পৌঁছাতে পারত (পেজগুলোতে আলাদা গার্ড ছিল না)।
**ফিক্স:** নতুন `RoleRoute` কম্পোনেন্ট — `sales/purchases/collections/stock/profit-loss/expenses/customers` → owner+staff, `branch-pads` → owner, `my-dues` → customer; অনুমতি না থাকলে হোমে রিডাইরেক্ট।

### N8. PWA আইকন ৩ মেগাবাইট! — precache 4.2 MB, ইনস্টল/লোড ধীর
**ফাইল:** `public/*.png`
**সমস্যা:** প্রতিটি আইকন আসলে 1024×1024 আনঅপ্টিমাইজড PNG (pwa-192x192.png-ও 837 KB!)। মোট ~2.97 MB, workbox precache 4198 KiB।
**ফিক্স:** ImageMagick দিয়ে সঠিক মাপে রিসাইজ + কালার কোয়ান্টাইজ: apple-touch 180², favicon 64², logo 256², pwa-192, pwa-512 — মোট **~25 KB**। Precache এখন 1265 KiB (বাকিটা মূলত JS বান্ডল)।

---

## 🟠 মাঝারি সমস্যা (এই ব্রাঞ্চে ফিক্সড)

### M1. `supabase.ts` খালি URL-এ ক্লায়েন্ট তৈরি করত
**ফিক্স:** এনভ ভেরিয়েবল না থাকলে `supabase = null`, `isSupabaseConfigured` এক্সপোর্ট; আর রানটাইম ক্র্যাশ নেই।

### M2. `useLiveQuery(...) || []` প্রতি রেন্ডারে নতুন অ্যারে → useMemo ডিপেন্ডেন্সি অস্থির
**ফাইল:** Dashboard, Expenses, ProfitLoss — ESLint ওয়ার্নিং হিসেবে ধরা পড়ে; `useMemo`-র্যাপ করা হয়েছে।

---

## 🟢 পুরনো রিপোর্টের আইটেম — বর্তমান অবস্থা

| পুরনো আইটেম | বর্তমান অবস্থা |
|--------------|----------------|
| C1 নিরাপত্তাহীন মক লগইন | ✅ **রেজলভড:** Dexie-তে ইউজার + SHA-256 পাসওয়ার্ড হ্যাশ, ডেমো অ্যাকাউন্ট (01700000000 ইত্যাদি / 123456)। *নোট:* ক্লায়েন্ট-সাইড হ্যাশ — মাল্টি-ডিভাইস সিঙ্কের সময় সার্ভার-সাইড auth (Supabase) দরকার। |
| C2/C3 Supabase অব্যবহৃত | 🟡 এখনও লোকাল-ফার্সট; Supabase sync রোডম্যাপে। `supabase.ts` এখন নিরাপদ (N/M1)। |
| C4 npm install ব্যর্থ | ✅ ফিক্সড (N1) |
| H1 PWA আইকন অনুপস্থিত | ✅ আছে + অপ্টিমাইজড (N8) |
| H2 Dexie অব্যবহৃত | ✅ রেজলভড — auth, customers, ledger, expenses, orders এখন IndexedDB/Dexie-তে |
| H3 units_per_bag অব্যবহৃত | 🟡 এখনও ডিসপ্লে-অনলি; ব্যাগ↔কেজি কনভার্সন রোডম্যাপে |
| H4 PDF অব্যবহৃত | ✅ রেজলভড — লাভ-ক্ষতি PDF (ProfitLoss), লেজার রসিদ PDF/ইমেজ/প্রিন্ট (LedgerReceipt) |
| H5 customer store নেই | ✅ রেজলভড — customerStore + ক্রেতা লিঙ্কিং (customerLink) |
| M1 (পুরনো) stock validation নেই | ✅ রেজলভড — Sales-এ স্টক চেক + ওয়ার্নিং কনফার্ম |
| M2 (পুরনো) ID collision | ✅ ফিক্সড (N6) |
| M3 (পুরনো) Dashboard হার্ডকোডেড ০ | ✅ রেজলভড — রিয়েল স্ট্যাটস |
| S1 Purchases নেভিগেশন | ✅ "আরও" মেনুতে আছে |
| S2 Role-based route protection | ✅ ফিক্সড (N7) |

---

## 💡 বাকি সুপারিশ (রোডম্যাপ)

1. **Supabase sync** — বর্তমানে ডাটা ডিভাইস-লোকাল (Dexie + zustand persist)। মাল্টি-ডিভাইস/ব্যাকআপের জন্য sync লেয়ার যোগ করুন।
2. **বান্ডল সাইজ** — মূল JS ~1 MB (jsPDF + html2canvas)। PDF ফিচার `React.lazy`/dynamic import-এ সরালে প্রথম লোড হালকা হবে।
3. **সার্ভার-সাইড auth** — ক্লায়েন্ট-সাইড SHA-256 শুধু ডেমো/লোকাল-ফার্সট ব্যবহারের জন্য যথেষ্ট; প্রোডাকশন সিঙ্কে OTP/পাসওয়ার্ড Supabase Auth-এ নিন।
4. **ইউনিট কনভার্সন** — বস্তা↔কেজি (`units_per_bag`) এখনও হিসাবে ব্যবহৃত নয়।

---

## 🎯 ভেরিফিকেশন কমান্ড

```bash
npm ci          # ✅ ক্লিন ইনস্টল
npm run lint    # ✅ 0 errors, 0 warnings
npm run build   # ✅ tsc + vite, precache 1265 KiB
npm test        # ✅ 18/18
npm audit       # ✅ 0 vulnerabilities
```

---

*অডিট + ফিক্স সম্পন্ন: ১৮ সেপ্টেম্বর ২০২৬ — লাইভ ডিপ্লয়: GitHub Pages (নিচে Deploy সেকশন দেখুন)*
