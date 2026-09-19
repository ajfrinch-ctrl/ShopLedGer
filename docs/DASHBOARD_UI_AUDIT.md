# Dashboard audit & UI simplification

তারিখ: ১৯ সেপ্টেম্বর ২০২৬

## ১. Implementation audit (পরিবর্তনের আগে)

পর্যালোচিত: `Dashboard.tsx`, `More.tsx`, `App.tsx`, `Layout.tsx`, `roles.ts`, `profitLoss.ts`, `dues.ts`, `ledger.ts`, `stock.ts`, customer linking, report catalog/builders, এবং বিদ্যমান tests।

| আগের UI | সমস্যা | নতুন অবস্থান |
| --- | --- | --- |
| আজকের ৬টি card: বিক্রি, বাকিতে বিক্রি, আদায়, supplier payment, gross profit, ক্রয় | দৈনিক overview-তে খুব বেশি তথ্য; খরচ শুধু নিচের report-এ | ৪ card: বিক্রি, প্রকৃত আদায়, business expense, net profit |
| মাসের বিক্রি/gross profit/ক্রয়/net profit বড় card | লাভ দুইবার, খরচ আলাদা স্পষ্ট নয় | compact বিক্রি/ক্রয়/খরচ/net profit |
| Stock/Due তিন বড় card | একই কাজের জন্য বাড়তি decoration | এক compact clickable list |
| ৭টি quick action | overview-কে navigation/report hub বানায় | ৪টি: বিক্রি, আদায়, ক্রয়, খরচ |
| দৈনিক রিপোর্ট (অটো) | summary-এর একই তথ্য পুনরাবৃত্তি | Dashboard থেকে বাদ; Reports/লাভ-ক্ষতি অপরিবর্তিত |
| Recent activity ছিল না | সাম্প্রতিক লেনদেনে যাওয়ার সহজ পথ নেই | role/branch-scoped শেষ ৫টি record |
| Customer বড় due/purchase cards + quick-action section | অপ্রয়োজনীয় section/decorations | শুধু নিজস্ব পাওনা, ক্রয়, চলমান order, বাকি history |

### সরানো feature কোথায় পাওয়া যাবে

- ক্রেতা: More → ক্রেতা (`/customers`)।
- লাভ-ক্ষতি: More → লাভ-ক্ষতি রিপোর্ট (`/profit-loss`)।
- বিস্তারিত daily/monthly report: More → রিপোর্ট সেন্টার (`/reports`, `/reports/dailyProfit`, `/reports/monthlyProfit`), আগের role guard অনুযায়ী।
- বাকিতে বিক্রি ও supplier payment: Due খাতা ও তার reports/ledger; বিক্রির বিস্তারিত `/reports/sales`-এ।
- Stock/low-stock: বর্তমান হিসাব → স্টক; More/bottom navigation-এও আছে।
- Orders, branch/user management: আগের More/নিজস্ব section অপরিবর্তিত।
- Global app navigation, logout, কর্মীর working-branch selector ও first-login password prompt বদলানো হয়নি। Dashboard-এর নিজস্ব header-এ শুধু title, welcome/name ও আজকের তারিখ।

## ২. হিসাবের উৎস: নতুন accounting formula নয়

| প্রদর্শিত figure | বিদ্যমান trusted source |
| --- | --- |
| আজ/মাসের বিক্রি, sale count, ক্রয়, খরচ, net profit | `computeProfitLoss` — আগে থেকেই Reports/লাভ-ক্ষতিতে ব্যবহৃত |
| আজকের বাকি আদায় | `dailyDebtActivity(...).collected` |
| আমরা পাব/দেব | আলাদা `debtAccounts('customer'/'supplier', ..., { through: today })`; আগের positive-balance aggregation |
| Stock value ও low-stock count | আগের `computeStock` এবং একই source scope |
| Customer পাওনা | linked customer ID-এর `ledgerRows`-এর শেষ balance |
| Customer মোট ক্রয় | আগের একই linked-customer sales total |
| Customer চলমান order | আগের pending/accepted order query, একই customer ID |
| Recent activity amount | record-এর stored amount/total; কোনো balance, margin বা invoice recalculation নয় |

**লাভের presentation সিদ্ধান্ত:** আগের উপরের card-এ gross এবং নিচে daily report-এ net দেখাত। এখন একটি লাভ card-এ trusted function-এর **net profit**, স্পষ্ট “নিট লাভ · দোকানের খরচ বাদে” subtitle। Loss হলে negative sign ও “নিট ক্ষতি” রাখা হয়; absolute value করে লাভ মনে করানো হয় না।

ক্রয় expense নয়। `kind === 'owner'` টাকা তোলা business expense/net profit-এ যায় না। Recent activity-তে এই record দেখা গেলে “মালিকের টাকা তোলা” বলে আলাদা পরিচয় থাকে। Due ≠ collection, payable ≠ supplier payment।

আজ/মাসের summary আগের মতো আজ পর্যন্ত। Stock-এর আগে থেকে ব্যবহৃত opening/purchase/sale/adjustment basis পরিবর্তন করা হয়নি। Customer total purchase-এর আগের lifetime scope অপরিবর্তিত।

## ৩. Role, branch ও data safety

- আগের `inUserBranch`, `canSeeProfit`, `canEntryPurchaseExpense` ব্যবহার করা হয়েছে। Owner-এর সব শাখা; staff-এর অনুমোদিত branch list। Header-এর working branch নতুন entry-এর জন্য—Dashboard aggregate scope আগের মতো authorized branches।
- Owner/manager/legacy staff: চার summary/action; salesman: শুধু অনুমোদিত summary/action, **নিষিদ্ধ card-এর শূন্য বা গোপন value-ও render হয় না**।
- Recent activity-তে role/branch filter আগে, sort/limit পরে; future/cancelled ledger records বাদ। Source-prefixed UI keys ID collision এড়ায়; stored IDs অপরিবর্তিত।
- Recent “সব দেখুন”: manager-level `/reports/transaction`; salesman-এর অনুমোদিত `/reports` hub। Individual rows যথাযথ sales/purchase/expense report বা typed party ledger-এ যায়।
- Customer component আলাদা; own linked ID ছাড়া ব্যবসার totals, supplier, stock, expense/profit/activity বা shop action নেই। Identity বদলালে keyed component নতুন করে mount হয়; pending linking response unmount-এর পরে update করে না।
- Existing `linkCustomerForUser` behavior অক্ষত (আগে থেকেই missing customer link তৈরির ব্যবস্থা ছিল)। নতুন linking/migration policy যোগ করা হয়নি।
- Database schema, version, accounting helpers, stores, authentication, role rules, branch authorization, sync/offline logic বা records পরিবর্তন করা হয়নি। কোনো delete/reset/migration নয়।

## ৪. UI

- Neutral header/cards; Dashboard-এ gradient নেই।
- এক compact বর্তমান হিসাব list; পুরো row clickable।
- চারটি icon+short-label quick action; role restriction অনুযায়ী সংখ্যা কমতে পারে।
- Monthly summary `dl`, বড় cards নয়। Recent activity সর্বোচ্চ পাঁচটি stored record; প্রতিটিতে date/type/party বা product/category/amount।
- Touch targets 44px-এর বেশি, keyboard focus ring, amount/long text wrapping, no horizontal scrolling।
- Loading-এ fake zero totals নয়; customer linking failure-এ error message।

## ৫. যাচাই

- `npm run lint`: সফল।
- `npm test`: **১০০ পাস, ০ ব্যর্থ** (আগের ৯৪ + activity adapter-এর ৬ regression test)।
- `npm run test:ui`: **১৩২ পাস, ০ ব্যর্থ**। চার summary/actions, compact month, More accessibility, figure reconciliation, negative net profit, future dates, owner drawings, single/multi/no-branch, salesman restrictions, customer isolation, record snapshots অন্তর্ভুক্ত।
- `npm run build`: সফল। বিদ্যমান বড় JS chunk warning আছে।
- **Real Chromium**: Dashboard 320/390/768/1280px; no horizontal overflow; >=44px clickable controls; quick/current links existing routes-এ যায়; owner/manager/salesman/customer views; net profit ও own customer totals; five activities; page JS error নেই; browsing-এর আগে/পরে database snapshots অপরিবর্তিত।
- **Due browser regression পুনরায় পাস**: responsive layout, modal, collection/payment, opt-in receipt, PDF/PNG ও customer statement export।
- Tests আলাদা synthetic IndexedDB/localStorage ব্যবহার করেছে; ব্যবহারকারীর বাস্তব data নয়। Browser/font tools সাময়িক, project dependency/asset হিসেবে যোগ হয়নি। শেষে `npm ci` দিয়ে locked dependencies ফিরিয়ে required checks চালানো হয়েছে।
- Physical mobile device/OS share sheet যাচাই করা হয়নি; responsive পরীক্ষাগুলো headless Chromium-এ।

### Browser test পুনরায় চালানো

```sh
npm install --no-save --package-lock=false playwright
npx playwright install --with-deps chromium
# আলাদা terminal:
npm run dev -- --host 0.0.0.0
# test:
node tests/ui-browser.dashboard.mjs
node tests/ui-browser.dues.mjs
# নিয়মিত dependency versions ফিরিয়ে দিন:
npm ci
```

Optional environment: `BROWSER_BASE_URL`, `CHROMIUM_EXECUTABLE_PATH`, `BROWSER_FONT_FILE`, `BROWSER_ARTIFACT_DIR`। Default artifacts `node_modules/.cache/dashboard-browser/` (Git-এর বাইরে)। Network-restricted sandbox-এ npm-distributed temporary Chromium এবং local Bengali test font ব্যবহার করা হয়েছে।
