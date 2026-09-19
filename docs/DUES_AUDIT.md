# বাকি, আদায় ও পরিশোধ — অডিট ও সংশোধন

তারিখ: ১৯ সেপ্টেম্বর ২০২৬

## কেন কেনাকাটার বাকি “আদায়” মনে হচ্ছিল

- ড্যাশবোর্ডে `todayDues` (আজকের **বাকিতে বিক্রির মোট**) “আজকের বাকি আদায়” নামে দেখানো হতো। এটি আদায় ছিল না।
- পুরোনো `computeCustomerDues` helper-এ supplier opening/payment বাদ দেওয়া হতো না। ফলে সাপ্লায়ারের দেনা ক্রেতার পাওনার তালিকায় ঢুকতে পারত।
- `ledgerRows` কেবল party ID মেলাত, ledger entry-র customer/supplier ধরন মেলাত না। একই ID থাকলে দুই খাতার অঙ্ক মিশে যেত।
- খাতার শিরোনাম/কলাম/ফর্মে “আদায় / পরিশোধ” একসঙ্গে লেখা থাকত। Supplier ট্যাব, ক্রেতা ট্যাব এবং URL query সবসময় সমন্বিত থাকত না।
- **নতুন purchase save ক্রেতার collection তৈরি করত—এমন প্রমাণ পাওয়া যায়নি।** সমস্যাটি presentation এবং কিছু read/aggregation path-এ ছিল। অনুমান করে পুরোনো রেকর্ড মুছে/স্থানান্তর করা হয়নি।

## হিসাবের নির্দিষ্ট নিয়ম

| ঘটনা | ক্রেতার পাওনা | সাপ্লায়ারের দেনা | নগদ চলাচল |
| --- | --- | --- | --- |
| বাকিতে বিক্রি | বাড়ে | অপরিবর্তিত | আদায় নয় |
| বাকিতে পণ্য ক্রয় | অপরিবর্তিত | বাড়ে | পরিশোধ নয় |
| ক্রেতা টাকা দেন | কমে | অপরিবর্তিত | আদায় |
| সাপ্লায়ারকে টাকা দেওয়া | অপরিবর্তিত | কমে | পরিশোধ |
| পুরোনো পাওনা/দেনা যোগ | সংশ্লিষ্ট খাতায় বাড়ে | সংশ্লিষ্ট খাতায় বাড়ে | আদায়/পরিশোধ নয় |
| নগদ বিক্রি/ক্রয় | বাকি বাড়ে না | বাকি বাড়ে না | আলাদা বিক্রি/ক্রয় লেনদেন |
| বাতিল এন্ট্রি | গণনায় নেই | গণনায় নেই | গণনায় নেই; audit রাখা হয় |

`ledgerRows` এখন **ডিফল্টে customer account**; supplier account স্পষ্টভাবে চাইতে হয়।
সারি তারিখক্রমে সাজানো এবং integer-paisa দিয়ে balance গণনা হয়। একই দিনের দেনা/পাওনা বৃদ্ধির পরে জমা ধরা হয়।
`debtAccounts` এবং `dailyDebtActivity` পৃথক, পরীক্ষাযোগ্য helper। একজনের পুরোনো অগ্রিম দিয়ে অন্যজনের পাওনা কমানো হয় না।

## লেআউট / ব্যবহার

- **ক্রেতার পাওনা — আমরা টাকা পাব** এবং **সাপ্লায়ারকে দেনা — আমরা টাকা দেব** আলাদা ট্যাব, URL ও তালিকা।
- নাম/মোবাইল/আইডি সার্চ; বকেয়া/সব/নিষ্পত্তি ফিল্টার; প্রতিটি খাতার পাশেই অবশিষ্ট টাকা।
- মোবাইলে লেনদেনের কার্ড; বড় স্ক্রিনে টেবিল। দীর্ঘ তালিকায় pagination / আরও দেখুন।
- নতুন লেনদেন ও সংশোধন viewport-এর modal-এ; নিচে ফর্ম খুঁজে স্ক্রল করতে হয় না।
- টাকা লেখার আগে সংশ্লিষ্ট তারিখে আদায়/পরিশোধের সীমা দেখা যায়। Backdated payment-এর সময় পরের দিনের বিদ্যমান payment-এর টাকা সংরক্ষিত থাকে।
- শাখার প্যাডের লিংক মূল খাতা থেকে সরানো। **সেভের পরে রসিদ/প্যাড স্বয়ংক্রিয়ভাবে খোলে না।** কেবল ব্যবহারকারী “রসিদ” চাপলে প্যাডসহ রসিদ খোলে।
- Supplier রসিদে “পরিশোধ / দেনা”, customer রসিদে “আদায় / পাওনা”।
- ডায়ালগে scroll lock, focus containment, Escape ও focus ফেরানো আছে; সেভ/এক্সপোর্ট চললে বন্ধ করা নিষ্ক্রিয়।
- নতুন লেনদেনের default branch কর্মীর active branch; মালিকের ক্ষেত্রে নির্বাচিত খাতার সর্বশেষ শাখা/ক্রেতার শাখা। ইনপুটে তা যাচাই/বদলানো যায়।

## সুরক্ষা ও বাগ সংশোধন

1. Party type, kind ও branch সংশোধন করে অন্য খাতায় এন্ট্রি স্থানান্তর করা যায় না।
2. কর্মীর দৃশ্যমান খাতা, balance, receipt এবং audit কেবল অনুমোদিত শাখার। খালি branch list মানে কোনো শাখার অনুমতি নেই।
3. সেলস ম্যান supplier খাতা বা তার direct URL দেখতে/লিখতে পারে না; write function-এও পরীক্ষা হয়।
4. অনুমতির বাইরের শাখার debt ব্যবহার করে payment করা যায় না। অনুমোদিত scope এবং সব শাখার consolidated balance **দুইটিই** যাচাই হয়—আগে অন্য শাখায় পরিশোধ হওয়া বাকি আবার খরচ করা যায় না।
5. বকেয়ার বেশি, backdated negative balance বা পরের payment invalid করে এমন edit/cancellation নিষিদ্ধ।
6. একই receipt ID দিয়ে create বা পুরোনো snapshot দিয়ে edit করলে reject হয়। DB transaction-এ entry ও audit একসঙ্গে লেখা হয়।
7. নতুন customer ID অন্য কেউ ব্যবহার করে ফেললে দুই ব্যক্তির পাওনা merge হয় না।
8. পরিবর্তনে মূল creator/time সংরক্ষিত থাকে; পরিবর্তনকারী audit-এ থাকে।
9. `Date.parse`-এর rollover (যেমন ৩০ ফেব্রুয়ারি), ভুল enum, negative/NaN amount, দুই দশমিকের বেশি এবং ভবিষ্যতের নতুন payment/opening reject হয়।
10. নিষ্ক্রিয় শাখায় নতুন এন্ট্রি নয়; অনুমোদিত ব্যবহারকারী পুরোনো এন্ট্রি সংশোধন/বাতিল করতে পারেন।
11. Bill, ledger ও legacy collection-এর source identity আলাদা; ID মিলে গেলেও purchase/sale-কে payment-edit বাটন দেখানো হয় না।
12. Customer profile, customer statement, customer list ও sales customer-summary-তে শুধু sales নয়, **সব ledger/collection source-এ** branch scope প্রয়োগ।
13. Customer report-এর চলতি balance এবং খাতা একই ledger function ব্যবহার করে; একই দিনের ক্রম ও প্রতি লেনদেনের পয়সার rounding মেলে।
14. ড্যাশবোর্ডে আজকের **বাকি বিক্রি, প্রকৃত আদায়, প্রকৃত পরিশোধ** আলাদা। মোট পাওনা ও মোট supplier দেনার আলাদা entry point।
15. বর্তমান খাতায় ভবিষ্যতের রেকর্ডের অঙ্ক যোগ হয় না। রিপোর্টে ব্যবহারকারী নির্বাচিত cutoff-এর হিসাব আলাদাভাবে দেখতে পারেন।

## যাচাই

- `npm test`: **৯৪ পাস, ০ ব্যর্থ**। নতুন coverage: purchase ≠ collection, customer/supplier isolation, supplier নাম normalization, খালি/অন্য শাখা, cross-branch double spending, fractional amounts, date validation, stale edits, cancellation, concurrent payment ও statement reconciliation ও একই দিনের ক্রম/পয়সার rounding।
- `npm run test:ui`: **৮৭ পাস, ০ ব্যর্থ**। সংশ্লিষ্ট খাতা/রসিদ/সংশোধন/বাতিল, অনুমতি, report ও বিদ্যমান customer flow অন্তর্ভুক্ত। Happy DOM-এর decimal step validation-এর সীমাবদ্ধতার জন্য একটি smoke submit native validation bypass করে write validation পরীক্ষা করে; real browser-এ native validation আলাদাভাবে পরীক্ষা হয়েছে।
- `npm run lint`, `npm run build`: সফল। বড় JS chunk সংক্রান্ত বিদ্যমান Vite সতর্কতা আছে।
- **বাস্তব headless Chromium**: 390×844 mobile এবং 1280×900 desktop; horizontal overflow নেই; modal-এ background scroll সরে না; native decimal/maximum validation; supplier-কে ২০০ পরিশোধে ১০০০→৮০০; customer থেকে ৩০০ আদায়ে ১২০০→৯০০; প্যাড opt-in; supplier PDF/PNG এবং customer statement PDF ডাউনলোড সফল। Page-level JavaScript error নেই।
- restricted-network sandbox-এ browser test-এর Bengali font-এর জন্য Noto Sans Bengali-এর local test copy ব্যবহার করা হয়েছে। এটি application dependency/asset হিসেবে যোগ করা হয়নি। OS share sheet / বাস্তব WhatsApp এবং printer পরীক্ষা করা হয়নি।

### Real-browser পরীক্ষা পুনরায় চালানো (ঐচ্ছিক)

`tests/ui-browser.dues.mjs` আলাদা context-এ synthetic IndexedDB/localStorage তৈরি করে। এটি live ব্যবহারকারীর তথ্য ব্যবহার করে না। চালানোর জন্য Vite dev server ও Playwright দরকার; Playwright নিয়মিত dependency-তে যোগ করা হয়নি।

```sh
npm install --no-save --package-lock=false playwright
npx playwright install --with-deps chromium
# আলাদা টার্মিনালে: npm run dev -- --host 0.0.0.0
node tests/ui-browser.dues.mjs
# পরে নিয়মিত dependency versions ফিরিয়ে আনতে:
npm ci
```

ঐচ্ছিক environment: `BROWSER_BASE_URL`, `CHROMIUM_EXECUTABLE_PATH`, `BROWSER_ARTIFACT_DIR`, `BROWSER_FONT_FILE`।
ডিফল্ট artifacts: `node_modules/.cache/dues-browser/` (Git-এ যায় না)।

## অপরিবর্তিত ব্যবসায়িক নিয়ম / সীমা

- নতুন অগ্রিম গ্রহণ/প্রদান সমর্থিত নয়। পুরোনো/imported ঋণাত্মক balance অগ্রিম হিসেবে দেখানো হয়; লুকানো হয় না। এ ধরনের অসংগত পুরোনো খাতায় নতুন write-এর আগে সমন্বয় প্রয়োজন হতে পারে।
- মালিক/অনুমোদিত বহু-শাখার কর্মীর combined account রাখা হয়েছে। এটি আন্তঃশাখা accounting transfer module নয়; কর্মীর সীমিত branch view ও মালিকের consolidated view ভিন্ন হতে পারে।
- পুরোনো unspecified-payment purchase স্বয়ংক্রিয় supplier debt নয়। যাচাই করে কেবল অনুলিখিত দেনা opening হিসেবে যোগ করতে হবে।
- পুরোনো collection এবং ledger-এ একই বাস্তব payment দুইবার লেখা থাকলে stable migration key ছাড়া আন্দাজে deduplicate করা হয়নি।
- Supplier পরিচয় normalized name-ভিত্তিক; বানান বদলে আলাদা নামে লেখা পুরোনো সাপ্লায়ার নিজে থেকে merge করা হয়নি।
- এটি local app logic/UI audit; browser data tampering বা server authorization-এর নিরাপত্তা নিশ্চয়তা নয়। ব্যবসার আসল রেকর্ড পরিবর্তন/মুছে দেওয়া হয়নি।
