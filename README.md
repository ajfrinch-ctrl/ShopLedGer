# কর্ণফুলী সেলস সেন্টার (Karnaphuli Sales Center)

গবাদি পশুর আধা-সরবরাহ দোকানের জন্য বাংলা, মোবাইল-ফার্সট বিক্রয় ও হিসাব অ্যাপ —
বিক্রি, বাকি আদায়, ক্রয়, খরচ, স্টক, রিপোর্ট ও রসিদ এক জায়গায়।

> ২০ সেপ্টেম্বর ২০২৬ থেকে এই রিপোর মূল অ্যাপ: Grok অ্যাপ-বিল্ডারে তৈরি
> কর্ণফুলী অ্যাপটি (TanStack Start + Nitro + PGLite)। আগের Vite+React PWA-এর
> ইতিহাস git লগ ও `docs/`-এ সংরক্ষিত।

## চালানো

```bash
npm install
npm run dev        # http://localhost:8080
```

## বিল্ড ও ডিপ্লয়

```bash
npm run build      # vite build (Vercel/nitro আউটপুট: .vercel/output) + db:migrate
```

- **লাইভ:** Vercel — এই রিপোর GitHub ইন্টিগ্রেশন থেকে অটো-ডিপ্লয়
  (ব্রাঞ্চ পুশ → Preview, `main` → Production)।
- `DATABASE_URL` না থাকলে মাইগ্রেশন স্কিপ হয়; অ্যাপ অন্তর্নিহিত PGLite ফলব্যাকে চলে।
- `.grok/app-env.json`-এ `VITE_AUTH_ENABLED=false` — সাইন-ইন গার্ড বন্ধ;
  Vercel প্রজেক্টে আলাদা `VITE_AUTH_ENABLED` সেট করলে সেটিই প্রাধান্য পাবে।

## কাঠামো

- `src/routes/` — পেজসমূহ (হোম/ড্যাশবোর্ড, বিক্রি, স্টক, বাকি, ক্রয়, খরচ, রিপোর্ট, লাভ-ক্ষতি, ক্রেতা, অর্ডার, প্রোফাইল)
- `src/lib/` — ডাটা স্টোর, auth গেট, app-data (PGLite)
- `scripts/` — বিল্ড/পিডব্লিউএ/মাইগ্রেশন হেল্পার
- `migrations/` — SQL মাইগ্রেশন
- `screenshots/` — অ্যাপের স্ক্রিনশট
