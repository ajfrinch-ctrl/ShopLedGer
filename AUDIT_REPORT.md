# ShopLedGer — সম্পূর্ণ কোড অডিট রিপোর্ট

**তারিখ:** ১৮ সেপ্টেম্বর ২০২৬  
**শাখা:** `arena/01a0b4b5-shopledger`  
**বেস কমিট:** `0b149e3`  
**প্রকল্প সংস্করণ:** v0.1.0  

---

## 📋 সারসংক্ষেপ

| বিষয় | অবস্থা |
|-------|--------|
| মোট ফাইল সংখ্যা (সোর্স) | ১৬টি |
| মোট সমস্যা | ১৯টি |
| 🔴 সমালোচনামূলক (Critical) | ৪টি |
| 🟠 উচ্চ অগ্রাধিকার (High) | ৫টি |
| 🟡 মাঝারি (Medium) | ৫টি |
| 🟢 কম অগ্রাধিকার (Low) | ৩টি |
| 💡 সুপারিশ (Suggestion) | ২টি |

---

## 🔴 সমালোচনামূলক সমস্যা (Critical)

### C1. নিরাপত্তাহীন লগইন সিস্টেম — কোনো প্রমাণীকরণ নেই
**ফাইল:** `src/stores/authStore.ts`  
**সমস্যা:** লগইন সিস্টেম সম্পূর্ণভাবে ক্লায়েন্ট-সাইড মক (mock)। যেকোনো ফোন নম্বর দিলেই লগইন হয়ে যায়, কোনো OTP/পাসওয়ার্ড যাচাই নেই। তিনটি হার্ডকোডেড মক ইউজার আছে এবং অন্য যেকোনো নম্বর দিয়েও অটো-লগইন হয়।
```typescript
// যেকোনো নম্বর দিলেই temp ইউজার তৈরি হয়
const newUser: User = {
  id: `temp-${Date.now()}`,
  ...
}
```
**ঝুঁকি:** যেকোনো ব্যক্তি যেকোনো রোলে (মালিক/কর্মচারী/ক্রেতা) প্রবেশ করতে পারে।  
**সমাধান:** Supabase Auth ইন্টিগ্রেশন জরুরি। OTP বা পাসওয়ার্ড-ভিত্তিক প্রমাণীকরণ যোগ করুন। মক ইউজার সংগ্রহ `NODE_ENV === 'development'` এর মধ্যে সীমাবদ্ধ করুন।

---

### C2. Supabase ক্লায়েন্ট খালি URL দিয়ে তৈরি হচ্ছে
**ফাইল:** `src/lib/supabase.ts`  
**সমস্যা:**
```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```
পরিবেশ ভেরিয়েবল না থাকলে খালি স্ট্রিং দিয়ে Supabase ক্লায়েন্ট তৈরি হয়, যা রানটাইমে অপ্রত্যাশিত ত্রুটি দেবে।  
**সমাধান:** URL এবং Key না থাকলে এরর থ্রো করুন অথবা ক্লায়েন্ট `null` রিটার্ন করুন এবং ফলব্যাক যোগ করুন।

---

### C3. Supabase ব্যবহার হচ্ছে না — সম্পূর্ণ ডাটা লোকালস্টোরেজে
**ফাইল:** সকল Store ফাইল  
**সমস্যা:** `package.json`-এ Supabase ডিপেন্ডেন্সি আছে, কিন্তু কোনো store-এ Supabase ব্যবহার করা হয়নি। সকল ডাটা zustand + persist middleware এর মাধ্যমে localStorage-এ সংরক্ষিত।  
**ঝুঁকি:**  
- ব্রাউজার ডাটা ক্লিয়ার করলে সব ডাটা হারিয়ে যাবে  
- কোনো সিঙ্ক/ব্যাকআপ কাজ করছে না  
- মাল্টি-ইউজার/মাল্টি-ব্রাঞ্চ ফিচার সম্ভব নয়  
**সমাধান:** Supabase ডাটাবেস ইন্টিগ্রেশন এবং Dexie.js (IndexedDB) অফলাইন স্টোরেজ যোগ করুন।

---

### C4. npm dependencies ইনস্টল করা হয়নি
**সমস্যা:** `node_modules` ফোল্ডার নেই। সকল ২৩টি ডিপেন্ডেন্সি UNMET।  
**ঝুঁকি:** প্রজেক্ট বিল্ড বা রান করা যাবে না।  
**সমাধান:** `npm install` চালান।

---

## 🟠 উচ্চ অগ্রাধিকার সমস্যা (High)

### H1. PWA আইকন ফাইল অনুপস্থিত
**ফাইল:** `vite.config.ts` → PWA manifest  
**সমস্যা:** ম্যানিফেস্টে `pwa-192x192.png`, `pwa-512x512.png` রেফার করা হয়েছে কিন্তু `public/` ফোল্ডারে এই ফাইলগুলো নেই (ফোল্ডারটিই নেই)।  
**ঝুঁকি:** PWA ইনস্টলেশন ব্যর্থ হবে, অ্যাপ আইকন দেখাবে না।  
**সমাধান:** `public/` ফোল্ডার তৈরি করুন এবং প্রয়োজনীয় আইকন ফাইল যোগ করুন।

---

### H2. Dexie.js ডিপেন্ডেন্সি আছে কিন্তু ব্যবহার নেই
**সমস্যা:** `package.json`-এ `dexie` এবং `dexie-react-hooks` আছে কিন্তু কোনো ফাইলে IndexedDB/Dexie ব্যবহার করা হয়নি।  
**ঝুঁকি:** PRD-তে "Offline First" মূল ফিচার হিসেবে উল্লেখ করা হয়েছে, কিন্তু localStorage সীমাবদ্ধ (৫-১০MB) এবং সিঙ্ক সমর্থন করে না।  
**সমাধান:** Dexie.js দিয়ে IndexedDB schema তৈরি করুন এবং সকল store-এ ব্যবহার করুন।

---

### H3. স্টক ইউনিট ট্র্যাকিং সমস্যা — `units_per_bag` অব্যবহৃত
**ফাইল:** `src/stores/productStore.ts`, `src/pages/Stock.tsx`  
**সমস্যা:** প্রতিটি পণ্যে `units_per_bag: 50` সেট করা আছে (একক = কেজি/বস্তা), কিন্তু স্টক গণনায় এটি ব্যবহার করা হয়নি। "বস্তা" এককের পণ্যের জন্য স্টক কেজিতে গণনা হচ্ছে বা বস্তায় — এটি স্পষ্ট নয়।  
**ঝুঁকি:** ভুল স্টক হিসাব।  
**সমাধান:** একক রূপান্তর লজিক যোগ করুন (`বস্তা` ↔ `কেজি`)।

---

### H4. `jspdf` এবং `html2canvas` ডিপেন্ডেন্সি আছে কিন্তু ব্যবহার নেই
**সমস্যা:** PRD-তে PDF রিপোর্ট একটি মূল ফিচার। ডিপেন্ডেন্সি `package.json`-এ আছে কিন্তু কোনো ফাইলে ব্যবহার করা হয়নি। কোনো PDF জেনারেশন কোড নেই।  
**সমাধান:** PDF রিপোর্ট জেনারেশন ইউটিলিটি তৈরি করুন।

---

### H5. ক্রেতা (Customer) ডাটা মডেল এবং স্টোর নেই
**সমস্যা:** `types/index.ts`-এ `Customer` ইন্টারফেস ডিফাইন করা আছে, কিন্তু কোনো customer store নেই। বাকি বিক্রির সময় শুধু `customer_name` স্ট্রিং সেভ হয়, `customer_id` নয়।  
**ঝুঁকি:** ক্রেতার বাকি ট্র্যাকিং, বাকি আদায় — কিছুই সম্ভব নয়।  
**সমাধান:** Customer store তৈরি করুন, বাকি বিক্রির সময় ক্রেতা সিলেক্ট/তৈরি করার সুবিধা দিন।

---

## 🟡 মাঝারি সমস্যা (Medium)

### M1. Sales page-এ stock validation নেই
**ফাইল:** `src/pages/Sales.tsx`  
**সমস্যা:** বিক্রির সময় পণ্যের স্টক চেক করা হয় না। স্টক ০ বা নেগেটিভ থাকলেও বিক্রি হয়ে যায়।  
**সমাধান:** `addItem` এবং `handleSubmit`-এ স্টক validation যোগ করুন।

---

### M2. ID জেনারেশন `Date.now()` দিয়ে — collision risk
**ফাইল:** সকল Store  
**সমস্যা:** `sale-${Date.now()}`, `purchase-${Date.now()}`, `p-${Date.now()}` — একই মিলিসেকেন্ডে দুটি এন্ট্রি করলে ID ক্ল্যাশ হবে।  
**সমাধান:** `crypto.randomUUID()` অথবা `nanoid` ব্যবহার করুন।

---

### M3. Dashboard-এ `totalStockValue` এবং `totalDues` সবসময় ০
**ফাইল:** `src/pages/Dashboard.tsx`  
**সমস্যা:**
```typescript
totalStockValue: 0,
totalDues: 0,
```
এগুলো হার্ডকোডেড। স্টোর থেকে রিয়েল ডাটা আনা হয়নি।  
**সমাধান:** Product store এবং Sales store থেকে গণনা করুন।

---

### M4. `date-fns` ডিপেন্ডেন্সি আছে কিন্তু ব্যবহার নেই
**সমস্যা:** সকল তারিখ ফরম্যাটিং `toLocaleDateString` এবং `new Date()` দিয়ে করা হয়েছে। `date-fns` ইনস্টল করা হলেও কোথাও import করা হয়নি।  
**সমাধান:** অপ্রয়োজনীয় ডিপেন্ডেন্সি বাদ দিন অথবা তারিখ হ্যান্ডলিং-এ ব্যবহার করুন।

---

### M5. `clsx` এবং `tailwind-merge` ডিপেন্ডেন্সি আছে কিন্তু ব্যবহার নেই
**সমস্যা:** এই দুটি লাইব্রেরি utility class merging এর জন্য, কিন্তু কোনো ফাইলে import করা হয়নি।  
**সমাধান:** ব্যবহার করুন অথবা বাদ দিন।

---

## 🟢 কম অগ্রাধিকার সমস্যা (Low)

### L1. `ComingSoon` কম্পোনেন্ট `App.tsx`-এ define করা
**সমস্যা:** রাউট-লেভেল কম্পোনেন্ট `App.tsx`-এ inline define করা হয়েছে।  
**সমাধান:** আলাদা ফাইলে নিন।

---

### L2. `useAuthStore` selector pattern inconsistency
**সমস্যা:** কিছু জায়গায় `useAuthStore((s) => s.user)` এবং কিছু জায়গায় `useAuthStore((s) => s.isAuthenticated)` — এটা ঠিক আছে, কিন্তু Layout-এ দুটি আলাদা selector call একটি component-এ করা হয়েছে।  
**সমাধান:** একটি selector-এ একসাথে নিন:
```typescript
const { user, logout } = useAuthStore()
```

---

### L3. `vite-env.d.ts` — Tripple-slash directive
**ফাইল:** `src/vite-env.d.ts`  
**সমস্যা:** Vite এর default template অনুসরণ করা হয়েছে, যা ঠিক আছে। কিন্তু file content চেক করা যায়নি।

---

## 💡 সুপারিশ (Suggestions)

### S1. নেভিগেশনে "ক্রয়" (Purchases) মেনু যোগ করুন
**সমস্যা:** Owner/Staff-এর জন্য নেভিগেশনে ক্রয় (Purchases) নেই। শুধুমাত্র Dashboard-এর Quick Actions-এ আছে, কিন্তু বটম নেভিগেশনে নেই। ব্যবহারকারীরা `/purchases` route-এ সরাসরি যেতে পারবে না (URL টাইপ না করে)।  
**সমাধান:** "আরও" (More) মেনুতে ক্রয় যোগ করুন অথবা বটম নেভিগেশনে যোগ করুন।

---

### S2. Role-based route protection নেই
**সমস্যা:** `ProtectedRoute` শুধু `isAuthenticated` চেক করে। Staff ইউজার Owner-only pages-এ প্রবেশ করতে পারবে।  
**সমাধান:** Role-based `ProtectedRoute` তৈরি করুন:
```tsx
<RoleRoute allowedRoles={['owner']}>
  <BranchManagement />
</RoleRoute>
```

---

## 📊 ফাইল-ভিত্তিক সারসংক্ষেপ

| ফাইল | অবস্থা | মন্তব্য |
|-------|--------|---------|
| `src/stores/authStore.ts` | 🔴 | নিরাপত্তাহীন মক লগইন |
| `src/lib/supabase.ts` | 🔴 | খালি URL, অব্যবহৃত |
| `src/stores/productStore.ts` | 🟡 | Sample data hard-coded, `units_per_bag` unused |
| `src/stores/purchaseStore.ts` | 🟢 | কার্যকর কিন্তু localStorage-only |
| `src/stores/salesStore.ts` | 🟢 | কার্যকর কিন্তু localStorage-only |
| `src/pages/Login.tsx` | 🟠 | নিরাপত্তাহীন |
| `src/pages/Dashboard.tsx` | 🟡 | হার্ডকোডেড ০ values |
| `src/pages/Sales.tsx` | 🟡 | Stock validation নেই |
| `src/pages/Purchases.tsx` | 🟢 | কার্যকর |
| `src/pages/Stock.tsx` | 🟡 | Unit conversion সমস্যা |
| `src/components/Layout.tsx` | 🟢 | কার্যকর, role-based nav |
| `src/App.tsx` | 🟢 | Role-based route protection নেই |
| `src/types/index.ts` | 🟢 | Well-structured |
| `vite.config.ts` | 🟠 | PWA icons missing |
| `index.html` | 🟢 | ঠিক আছে |
| `tailwind.config.js` | 🟢 | ঠিক আছে |
| `tsconfig.json` | 🟢 | Strict mode enabled |

---

## ✅ ভালো দিকগুলো

1. **টাইপ সিস্টেম:** `src/types/index.ts` সুন্দরভাবে সব ডাটা মডেল ডিফাইন করা হয়েছে
2. **UI/UX:** বাংলা UI, mobile-first design, Tailwind CSS ভালো ব্যবহার
3. **Zustand:** Store pattern পরিষ্কার এবং সুসংগঠিত
4. **Tailwind Component Layer:** `btn-primary`, `card`, `input-field` reusable classes
5. **PWA Configuration:** `vite-plugin-pwa` সঠিকভাবে কনফিগার করা
6. **TypeScript Strict Mode:** সকল tsconfig-এ strict mode চালু
7. **বাংলা কন্টেন্ট:** UI text, role names, error messages সব বাংলায়

---

## 🎯 অগ্রাধিকার ক্রম (Priority Order)

1. **npm install** — প্রথমে ডিপেন্ডেন্সি ইনস্টল করুন
2. **Supabase Auth** — প্রমাণীকরণ যোগ করুন
3. **PWA আইকন** — public/ ফোল্ডার ও আইকন তৈরি করুন
4. **Customer Store** — ক্রেতা ব্যবস্থাপনা যোগ করুন
5. **Stock Validation** — বিক্রিতে স্টক চেক যোগ করুন
6. **Offline/Sync** — Dexie.js + Supabase sync বাস্তবায়ন করুন
7. **PDF Reports** — রিপোর্ট জেনারেশন যোগ করুন

---

*অডিট সম্পন্ন: ১৮ সেপ্টেম্বর ২০২৬*
