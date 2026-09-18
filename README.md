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
- **Report Center (10 reports)** — Sales, Purchase, Stock, Customer Due, Due Collection, Expense, Daily Profit (owner-only), Monthly Profit (owner-only), Product and Transaction reports. Each has its own filters, live preview and its **own separate A4 PDF** — ink-saving **black & white letterhead pad** (shop logo, name, address, phone from Branch Pads), totals row, owner's signature line, footer with generated date and page number (no branding). **No print option** (mobile-first): PDF download + WhatsApp sharing only.
- **Daily Auto Backup** — Automatic daily backup of all data.
- **Customer Profile (shop side)** — ক্রেতার পূর্ণ হিসাব: বাকি, লেজার খাতা, কেনাকাটার ইতিহাস, অর্ডার; **আলাদা A4 "ক্রেতার হিসাব বিবরণী" PDF** (সাদাকালো প্যাড: দোকানের লোগো, নাম, ঠিকানা, ফোন; শেষে স্বাক্ষরের জায়গা; ফুটারে তারিখ ও পৃষ্ঠা নম্বর), WhatsApp বাকি-তাগাদা।
- **Fully Bangla UI**

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
├── src/
│   ├── components/
│   ├── pages/
│   ├── lib/
│   ├── hooks/
│   ├── stores/
│   └── types/
├── package.json
└── README.md
```

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
npm test        # ইউনিট টেস্ট (৫৭টি) — রিপোর্ট, লেজার, স্টক, ক্রেতা-হিসাব, authStore
npm run test:ui # UI স্মোক — কাস্টমার-মডিউলের পেজগুলো সত্যিই রেন্ডার হয় কি না (happy-dom)
```

## Documentation

Full Product Requirements Document: [docs/PRD.md](docs/PRD.md)

---

Made for Bangladeshi shop owners ❤️
