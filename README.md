# ShopLedGer

**ShopLedGer** is an offline-first Progressive Web App (PWA) for complete shop accounting.

Designed especially for small & medium shops in Bangladesh (feed, grocery, retail etc.).

## Key Features

- **Offline First** — Works without internet. Auto syncs when connection is available.
- **Multi User** — Owner, Staff, Customer roles with proper permissions.
- **Multi Branch** — Owner can create and manage multiple branches.
- **Customer Ordering** — Customers can place orders and view their dues.
- **WhatsApp Receipt** — Beautiful receipt image sent after every sale.
- **PDF Reports** — Download any report as PDF.
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

## Documentation

Full Product Requirements Document: [docs/PRD.md](docs/PRD.md)

---

Made for Bangladeshi shop owners ❤️
