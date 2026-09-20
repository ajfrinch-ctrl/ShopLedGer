# অবদান নির্দেশিকা / Contributing Guide

ShopLedGer-এ আগ্রহ দেখানোর জন্য ধন্যবাদ! 🙏 নিচের ধাপগুলো অনুসরণ করলে আপনার পরিবর্তন দ্রুত রিভিউ ও মার্জ করা সম্ভব হবে। (English summary below.)

## সেটআপ / Setup

```bash
git clone https://github.com/ajfrinch-ctrl/ShopLedGer.git
cd ShopLedGer
npm install
npm run dev        # লোকাল ডেভ সার্ভার — http://localhost:8080
```

কোনো বাহ্যিক সার্ভিস লাগে না — ডাটাবেজ হিসেবে এম্বেডেড **PGLite** চলে। ঐচ্ছিকভাবে `DATABASE_URL` সেট করলে তার বদলে সেই পোস্টগ্রেস ব্যবহৃত হবে (`scripts/migrate.mjs` মাইগ্রেশন চালায়)।

## কাজের ধারা / Workflow

1. একটি ইস্যু খুলুন (বাগ বা ফিচার) এবং আলোচনা করুন — বিশেষ করে বড় পরিবর্তনের আগে।
2. `main` থেকে একটি ফিচার ব্রাঞ্চ কাটুন: `git checkout -b fix/issue-123`।
3. ছোট, ফোকাসড কমিট করুন। কমিট মেসেজে ইস্যু নম্বর উল্লেখ করুন।
4. পুল-রিকোয়েস্ট খুলুন এবং টেমপ্লেট পূরণ করুন।

## মান যাচাই / Quality gates

পুল-রিকোয়েস্ট মার্জের আগে এই কমান্ডগুলো সফল হতে হবে (CI-তেও এগুলোই চলে):

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript টাইপ-চেক
npm test            # ইউনিট টেস্ট (node:test)
npm run build       # প্রোডাকশন বিল্ড (Vite + Nitro/Vercel আউটপুট)
```

## কোড স্টাইল / Code style

- ESLint + Prettier কনফিগারেশন অনুসরণ করুন (`npm run format` চালাতে পারেন)।
- নতুন পেজ/রুট `src/routes/`-এ রাখুন (TanStack Start ফাইল-ভিত্তিক রাউটিং)।
- ইউজার-ফেসিং টেক্সট বাংলায় রাখুন (অ্যাপটি সম্পূর্ণ বাংলা)।

---

### English summary

Thanks for contributing! Open an issue first for big changes, branch off `main`, keep commits small, and make sure `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` all pass before opening a pull request. No external services are needed — the app runs on embedded PGLite by default. User-facing text should stay in Bengali.
