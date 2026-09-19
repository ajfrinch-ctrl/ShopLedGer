# ShopLedGer

**ShopLedGer** is an offline-first Progressive Web App (PWA) for complete shop accounting.

Designed especially for small & medium shops in Bangladesh (feed, grocery, retail etc.).

## Key Features

- **Offline First** — Works without internet. Auto syncs when connection is available.
- **Multi User** — Owner, Staff, Customer roles with proper permissions.
- **Multi Branch** — Owner can create and manage multiple branches.
- **Customer Ordering** — Customers can place orders and view their dues.
- **Customer Account & Profile** — ক্রেতা নিজেই সাইন-আপ করতে পারেন (`/register`); দোকান অনুমোদন দিলেই লগইন। নিজের প্রোফাইল (নাম/মোবাইল/ঠিকানা), পাসওয়ার্ড পরিবর্তন, বাকির খাতা, প্রতিটি বিলের রিসিট PDF নামানো, দোকানে বার্তা পাঠানো (ঐচ্ছিক WhatsApp)।
- **WhatsApp Receipt** — Beautiful receipt image sent after every sale.
- **Report Center (10 reports)** — Sales, Purchase, Stock, Customer Due, Due Collection, Expense, Daily Profit (owner + manager), Monthly Profit (owner + manager), Product and Transaction reports. Each has its own filters and its **own separate A4 PDF**.
- **Preview-first workflow (no needless downloads)** — প্রতিটি রিপোর্ট/হিসাব বিবরণী/রসিদ আগে **প্রিভিউ পপ-আপে** পুরোপুরি দেখা যায়; সেইখান থেকে **PDF ডাউনলোড** ও **ছবি শেয়ার/WhatsApp**। না দেখে বা না চাইলে কিছুই ডাউনলোড হয় না।
- **Share is always an image** — WhatsApp/শেয়ার কখনো PDF ফাইল নয়: আগে রিপোর্টের **ছবি (JPEG)** তৈরি হয় (লম্বা রিপোর্ট হলে প্রতি A4 পেজের আলাদা ছবি, ফুটারে তারিখ ও পৃষ্ঠা নম্বর), তারপর Web Share API-তে WhatsApp/অন্য অ্যাপে যায়; ব্রাউজারে ফাইল-শেয়ার না থাকলে ছবি ডাউনলোড হয়ে WhatsApp খোলে। PDF কেবল ব্যবহারকারী নিজে চাপলে তৈরি হয়। **No print option** (mobile-first).
- **Letterhead pad, centered everywhere** — প্রতিষ্ঠানের **লোগো, নাম, ঠিকানা ও ফোন পেজের মাঝখানে** বসে — রিপোর্ট, হিসাব বিবরণী, বিক্রি রসিদ ও লেনদেনের রসিদ সব জায়গায় (ink-saving black & white pad, `শাখা ও ব্যবস্থাপক → প্যাড` থেকে সেট, সাথে লাইভ প্রিভিউ; নিচে totals row, মালিকের স্বাক্ষর ও পৃষ্ঠা নম্বর)।
- **Daily Auto Backup** — Automatic daily backup of all data.
- **Staff IDs per branch (owner & manager)** — মালিক "শাখা ও ব্যবস্থাপক" পেজ থেকে শাখা অনুযায়ী **শাখা ব্যবস্থাপক** ও **সেলস ম্যান**-এর আইডি খোলেন; ব্যবস্থাপকও নিজের শাখার সেলস ম্যানের আইডি খুলতে পারেন ("সেলস ম্যান আইডি" পেজ)।
  - **লগইন:** ইউনিক ইউজারনেম (যেমন `agrabad_salesman`) বা মোবাইল নম্বর + পাসওয়ার্ড। ডিফল্ট পাস `123456`, ১ম লগইনে বাধ্যতামূলক পরিবর্তন, ৫ ভুলে লক → মালিক/ব্যবস্থাপক ১ ক্লিকে আনলক; আইডি/পাস WhatsApp-এ পাঠানো যায়।
  - **এক আইডিতে একাধিক শাখা** দেওয়া যায় — হেডারের শাখা-সিলেক্টার দিয়ে কাজের শাখা বদলানো যায়।
  - **ব্যবস্থাপক:** বিক্রি, ক্রয়, খরচ, ক্রেতা, স্টক, বাকি আদায়, রিপোর্ট (লাভসহ) + নিজের শাখার সেলস ম্যান নিয়োগ।
  - **সেলস ম্যান:** বিক্রি, ক্রেতা, অর্ডার, বাকি আদায় + স্টক দেখা; ক্রয়/খরচ/লাভ/লেনদেন রিপোর্ট নয়।
  - **মালিকের পূর্ণ নিয়ন্ত্রণ:** আইডি সম্পাদনা (নাম/ইউজারনেম/মোবাইল/শাখা), ডিলিট, পাসওয়ার্ড রিসেট, চালু/বন্ধ, আনলক।

- **Customer Profile (shop side)** — ক্রেতার পূর্ণ হিসাব: বাকি, লেজার খাতা, কেনাকাটার ইতিহাস, অর্ডার; **আলাদা A4 "ক্রেতার হিসাব বিবরণী" PDF** (সাদাকালো প্যাড: দোকানের লোগো, নাম, ঠিকানা, ফোন; শেষে স্বাক্ষরের জায়গা; ফুটারে তারিখ ও পৃষ্ঠা নম্বর), WhatsApp বাকি-তাগাদা।
- **Android App Shortcuts (PWA)** — ইনস্টল করা অ্যাপ আইকনে লং-প্রেস করলে কুইক-অ্যাকশন মে뉴: **New Sale** (`/sales`), **Customers** (`/customers`), **Receipts** (`/expenses`), **Products** (`/stock`), **Reports** (`/reports`)। ম্যানিফেস্টের `shortcuts` অ্যারে `src/lib/pwaShortcuts.ts`-এ; আইকন (96/192 PNG, স্বচ্ছ ব্যাকগ্রাউন্ডে ব্র্যান্ড-সবুজ গ্লিফ) `public/shortcuts/`-এ, জেনারেট হয় `npm run icons:shortcuts`-এ (কোনো লাইব্রেরি ছাড়াই)। শর্টকাটের আইকনও সার্ভিস-ওয়ার্কার প্রিক্যাশ করে, তাই অফলাইনেও কাজ করে।
- **দুই মালিক, এক অ্যাপ** — `src/lib/shopProfile.ts`-এ `OWNER_PHONES`-এ থাকা প্রতিটি নম্বরের জন্য আলাদা **মালিক (owner)** আইডি তৈরি হয়; বর্তমানে **01811808294** ও **01821989717**। দুজনেরই অ্যাপে সমান পূর্ণ নিয়ন্ত্রণ (বিক্রি/ক্রয়/খরচ, স্টক, বাকি, সব রিপোর্ট ও লাভ, শাখা-কর্মী আইডি, প্যাড সেটিং)। প্রাথমিক পাসওয়ার্ড `123456` — প্রথম লগইনেই নিজের পাসওয়ার্ড সেট করতে হবে। নতুন নম্বর যোগ করতে চাইলে শুধু `OWNER_PHONES`-এ সেটা যোগ করলেই পরের বার অ্যাপ চালু হওয়ার সময় আইডি তৈরি হয়ে যাবে।
- **Fully Bangla UI**
- **দোকানের ডিফল্ট পরিচিতি (প্যাড)** — ডিফল্ট দোকান **কর্ণফুলী সেলস সেন্টার** (ঠিকানা: পল্লি বিদ্যুৎ অফিসের পাশে, বুড়া মসজিদ রোড, আমুচিয়া, বোয়ালখালী, চট্টগ্রাম; মোবাইল: 01821989717, 01811808294)। অ্যাপ প্রথম চালু হতেই ডিফল্ট শাখায় বসে যায়, তাই রিপোর্ট/রসিদ/স্টেটমেন্টে সাথে সাথে নাম-ঠিকানা-ফোন দেখা যায়। ডিফল্ট মান `src/lib/shopProfile.ts`-এ; মালিক **শাখা ও ব্যবস্থাপক → প্যাড** থেকে বদলালে সেটিই চূড়ান্ত (কোনো ডিফল্ট ওভাররাইট করে না)। একাধিক নম্বর কমা দিয়ে লিখলে প্যাডে সবগুলো দেখায়, WhatsApp-এ প্রথম নম্বরে যায়।

## Tech Stack

| Layer          | Technology                  |
|----------------|-----------------------------|
| Frontend       | React + Vite + Tailwind CSS |
| Offline        | Dexie.js (IndexedDB)        |
| Backend        | Supabase (Auth + DB + Storage) |
| PWA            | vite-plugin-pwa             |
| PDF            | jsPDF / html2canvas         |

## Project Structure

```
ShopLedGer/
├── docs/
│   └── PRD.md              # Full Product Requirements Document
├── public/
│   └── shortcuts/          # PWA অ্যাপ-শর্টকাট আইকন (96/192 PNG, জেনারেটেড)
├── scripts/
│   └── generate-shortcut-icons.mjs  # শর্টকাট আইকন জেনারেটর (Node-only, no deps)
├── src/
│   ├── components/
│   ├── pages/
│   ├── lib/
│   ├── hooks/
│   ├── stores/
│   └── types/
├── ui.html                 # Mobile UI design mock — shell page
├── ui.css                  # Theme tokens (color/radius/shadow) + all styles
├── ui.js                   # UI config (text/values/icons/tabs) + renderer
├── mobile-ui-preview.html  # আগের single-file মকআপ (reference-এর জন্য রাখা)
├── tests/
│   └── ui-design.test.mjs  # Design mock smoke test
├── package.json
└── README.md
```

## Mobile UI Design (editable mock)

ডিজাইন মকআপটি তিন ফাইলে ভাগ করা, যাতে পরে সহজে বদলানো যায়:

| ফাইল | কী বদলাবেন |
| --- | --- |
| `ui.css` | থিম টোকেন — `:root`-এ রঙ (`--brand: #04795a`), radius (`--r-card: 20px`), shadow, font-size। কোনো হার্ড-কোড রঙ নেই। |
| `ui.js` | `CONFIG` — অ্যাপের নাম, স্ট্যাট বক্সের লেবেল/ভ্যালু/রঙ, quick actions, bottom-nav ট্যাব; `ICONS` — SVG আইকন লাইব্রেরি। |
| `ui.html` | শুধু খোলস (ফন্ট লিঙ্ক + `#app` মাউন্ট পয়েন্ট)। |

চালান: যেকোনো static server দিয়ে `ui.html` খুলুন (যেমন `python3 -m http.server`)।
`ui.html?w=375` / `?w=420` দিলে সেই viewport width-এ রেন্ডার হয়।
টেস্ট: `npm run test:ui-design`। একই ডিজাইন ল্যাংগুয়েজ React অ্যাপেও আছে
(`src/components/Layout.tsx`, `src/pages/Dashboard.tsx`, `src/index.css`)।

## Getting Started

```bash
npm install
npm run dev
```

## Deploy

| Host | Base path | Notes |
|------|-----------|--------|
| **Vercel** | `/` (default) | Leave `BASE_PATH` **unset/empty** in Environment Variables and Build Command. `vercel.json` handles SPA rewrites. |
| **GitHub Pages** | `/ShopLedGer/` | Set only in `.github/workflows/deploy-pages.yml` (`BASE_PATH=/ShopLedGer/`). Do not copy this into Vercel. |
| Local / preview | `/` | `npm run build` then `npm run preview` |

```bash
# Default build (Vercel / local) — base `/`
npm run build

# GitHub Pages build — base `/ShopLedGer/`
npm run build:pages
```

Live (when configured):
- GitHub Pages: https://ajfrinch-ctrl.github.io/ShopLedGer/
- Vercel: your Vercel project URL (root domain)

## Test

```bash
npm test        # ইউনিট টেস্ট — রিপোর্ট, লেজার, স্টক, ক্রেতা-হিসাব, authStore, PWA শর্টকাট
npm run test:ui # UI স্মোক — কাস্টমার-মডিউলের পেজগুলো সত্যিই রেন্ডার হয় কি না (happy-dom)
npm run test:ui-shortcuts # প্রতিটি PWA শর্টকাট-URL-এ পুরো অ্যাপ রেন্ডার (ফাঁকা পেজ/রাউটিং এরর নেই)
```

## Documentation

Full Product Requirements Document: [docs/PRD.md](docs/PRD.md)

---

Made for Bangladeshi shop owners ❤️
