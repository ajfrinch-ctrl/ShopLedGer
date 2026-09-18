# ShopLedGer

**ShopLedGer** is an offline-first Progressive Web App (PWA) for complete shop accounting.

Designed especially for small & medium shops in Bangladesh (feed, grocery, retail etc.).

## Key Features

- **Offline First** — Works without internet. Auto syncs when connection is available.
- **Multi User** — Owner, Staff, Customer roles with proper permissions.
- **Multi Branch** — Owner can create and manage multiple branches.
- **Customer Ordering** — Customers can place orders and view their dues.
- **WhatsApp Receipt** — Beautiful receipt image sent after every sale.
- **Report Center (10 reports)** — Sales, Purchase, Stock, Customer Due, Due Collection, Expense, Daily Profit, Monthly Profit, Product and Transaction reports. Each has its own filters, live preview and its **own separate A4 PDF** (header with business name + period, totals row, footer with generated date and page number). Print and WhatsApp sharing included.
- **Daily Auto Backup** — Automatic daily backup of all data.
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

## Documentation

Full Product Requirements Document: [docs/PRD.md](docs/PRD.md)

---

Made for Bangladeshi shop owners ❤️
