# Daily notes — ShopLedGer

## 2026-09-21

Checked `main` after 20 Sep top-bar/weather work and remaining 19 Sep audit items.

### Shipped today
- Profit-loss period header uses `bnDate` (Bangla month + digits) instead of ISO `YYYY-MM-DD` (finding #7).
- Transaction report adds a `সর্বমোট` footer row on screen and in PDF (finding #5).

### Fixed after a report (দুপুর)
- অভিযোগ: লাইভ `/sales` লিংকে ঢোকা যাচ্ছে না। CI-তে Playwright দিয়ে আসল ব্রাউজারে যাচাই — সাইট সার্ভ হচ্ছে,
  লগইন ছাড়া `/sales` খুললে লগইন পাতায় পড়ে, আইডি/পাসওয়ার্ড দিলে বিক্রি পাতা চলে; সমস্যা হলো লগইনের পরে
  ব্যবহারকারী হোমপাতায় গিয়ে ঠেকতেন (পাতাটি হারিয়ে যায়) আর ডিফল্ট পাসওয়ার্ড/প্রথম-লগইনের নিয়ম পাতায় লেখা ছিল না।
- ফিক্স: `src/lib/return-to.ts` + `RequireAuth`/`login` — লগইন (ও বাধ্যতামূলক পাসওয়ার্ড পরিবর্তনের) পরে ঠিক
  সেই পাতাতেই ফেরা; লগইন পাতায় কোন পাতা দেখতে লগইন লাগছে, ডিফল্ট পাসওয়ার্ড ও নিষ্ক্রিয় বোতামের হিন্ট।
- টেস্ট: `scripts/return-to.test.mjs` (৭টি), `scripts/deep-link-smoke.mjs` (Pages smoke-এ যুক্ত)।

### Next (still open from audit)
- #4 Shop order list branch filter.
- #6 SaleReceipt Escape / focus trap / scroll lock.
- #13 First-login dialog `role="dialog"` (if that modal still exists on this stack).
- #1 Signup phone OTP / existing-customer check.
