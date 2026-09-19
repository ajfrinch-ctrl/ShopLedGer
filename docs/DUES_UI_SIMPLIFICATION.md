# Due & Payment Ledger — UI/UX simplification

তারিখ: ১৯ সেপ্টেম্বর ২০২৬

## পরিবর্তনের আগে implementation audit

পর্যালোচনা: `Collections.tsx`, `LedgerReceipt.tsx`, `lib/ledger.ts`, `lib/dues.ts`, report builders, role/branch helpers, বিদ্যমান dues/ledger ও UI tests।

| আগের UI | সিদ্ধান্ত |
| --- | --- |
| হোমেই customer/supplier tabs এবং একটি খাতার পূর্ণ তালিকা | আলাদা Due Home; দুইটি প্রধান entry point |
| প্রতিটি party-তে account switcher, নির্দেশনা ও primary payment-এর পাশে opening entry | party page-এ নাম/মোবাইল, বর্তমান টাকা, এক primary action, transaction history |
| row ID/শাখা/edit controls সব সময় দৃশ্যমান | row More Details; audit ও opening নিচে More/Admin |
| এক শাখার ব্যবহারকারীকেও branch dropdown | branch auto-select অপরিবর্তিত; selector শুধু owner/multi-branch |
| সেভের পরে সাধারণ message | Success → সংশ্লিষ্ট অবশিষ্ট পাওনা/দেনা → সম্পন্ন; রসিদ ঐচ্ছিক |
| রসিদ আগেই opt-in ছিল | একই receipt/export implementation অক্ষত |
| Due Home-এ নির্দিষ্ট তিন-report entry point ছিল না | customer due, supplier payable, collection/payment read-only view |

## নতুন flow

- `/collections`: আমরা পাব / আমরা দেব; মোট পাওনা, মোট দেনা, আজকের আদায়, আজকের পরিশোধ।
- `/collections?type=customer` ও `?type=supplier`: আলাদা searchable list, বিদ্যমান status filter ও pagination।
- বিদ্যমান `party` deep links অক্ষত; customer type না দেওয়া পুরোনো customer links-ও চলে।
- Party → মোট পাওনা/দেনা → আদায় করুন/পরিশোধ করুন → Amount, Date, Method, optional Reference/Note।
- Save বন্ধ করে inline success/remaining balance দেখায়; Done success বন্ধ করে। রসিদ খুলতে স্পষ্ট user action লাগে। Receipt/PDF/PNG/share component বদলানো হয়নি।
- Name+mobile দেখানো হয়; mobile রেকর্ডে না থাকলে তা স্পষ্ট বলা হয়। Supplier schema-তে নতুন phone field যোগ করা হয়নি।
- More Details-এ source ID, branch, payment reference/note/creator/time ও edit/cancel থাকে; নিচে More/Admin-এ opening ও audit। আগের অনুমতিই প্রযোজ্য—UI সরিয়ে নতুন admin-only permission আরোপ করা হয়নি।
- Home-এর তিন report read-only inline view; due report-এ cutoff, collection/payment-এ date range; pagination ও party ledger-এ যাওয়ার সুবিধা। মূল Report Center/export paths অপরিবর্তিত।
- Salesman-এর ক্ষেত্রে supplier entry, totals ও report গোপন; direct supplier report URL-ও নিষিদ্ধ। Collection/payment view-এ তার জন্য শুধু customer collections।

## যা বদলানো হয়নি

- `lib/ledger.ts`, `lib/dues.ts`, database schema/version, stores, authentication, branch authorization, receipt implementation, ID generation, offline/sync ও audited business rules।
- `saveLedgerEntry`, `paymentCapacity`, `ledgerRows`, `debtAccounts`, `dailyDebtActivity`, `ledgerScopeFor`, `inUserBranch`-ই ব্যবহার করা হয়েছে।
- কোনো migration/reset/delete বা live record editing নেই। Report শুধু পড়ে; receipt/transaction IDs, creator/editor/audits আগের নিয়মেই সংরক্ষিত।
- Customer/supplier balance net করা হয় না। Collection/payment report-এ আলাদা type ও পৃথক totals; unified account balance নেই।
- Cash trade, backdated validation, overpayment, concurrent/stale write validation ও cancelled-record audit behavior অপরিবর্তিত।

## যাচাই

- `npm test`: **৯৪ পাস, ০ ব্যর্থ** — আগের accounting/security tests অপরিবর্তিত।
- `npm run test:ui`: **১০৪ পাস, ০ ব্যর্থ** — home structure, report reconciliation/isolation, single/multi-branch selector, auto-selected branch save, success/remaining/Done, opt-in receipt, cancellation, overpayment, restricted role/direct URL, empty branch scope।
- `npm run lint`: সফল।
- `npm run build`: সফল; বিদ্যমান বড় chunk warning রয়ে গেছে।
- Real headless Chromium: home, party ও তিন report 320/390/768/1280px-এ horizontal overflow ছাড়া; payment modal viewport-এর মধ্যে, background scroll স্থির; native decimal/maximum validation; supplier 1000→800 ও customer 1200→900; success/Done; opt-in receipt PDF/PNG এবং বিদ্যমান customer statement PDF download। Page-level JS error নেই।
- Browser tests শুধু isolated synthetic IndexedDB/localStorage ব্যবহার করেছে। Bengali font-এর test-only local copy ব্যবহার করা হয়েছে। Playwright/Chromium/font project dependency বা tracked asset হিসেবে যোগ করা হয়নি; শেষে `npm ci` দিয়ে locked dependencies ফিরিয়ে সব automated checks পুনরায় চালানো হয়েছে।
- বাস্তব OS share sheet/WhatsApp ও physical mobile keyboard পরীক্ষা করা হয়নি।

## ফাইল

- `src/pages/Collections.tsx`: home/list/party/form/success presentation।
- `src/components/dues/DueReports.tsx`: audited helpers-ভিত্তিক read-only reports।
- `src/index.css`: due-flow-scoped touch targets ও width handling।
- `tests/ui-smoke.customer.tsx`, `tests/ui-browser.dues.mjs`: নতুন navigation ও regression coverage।
