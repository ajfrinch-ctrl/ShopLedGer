# রিপোর্ট ও রসিদের PDF / প্রিন্ট

আপডেট: ২১ সেপ্টেম্বর ২০২৬

## সংশোধিত সমস্যা

- পুরোনো print CSS `body > *:not(#root)` লুকিয়ে দিত। TanStack Start-এর
  document-এ `#root` নেই, ফলে প্রিন্ট ফাঁকা আসত।
- jsPDF-এর ডিফল্ট Helvetica বাংলা সমর্থন করে না। আগের রিপোর্টের PDF-এ
  বিক্রির চতুর্থ কলাম (মোট), স্টকের শেষ দুই কলাম এবং মাসিক লাভের বিস্তারিতও
  বাদ পড়ত; নির্দিষ্ট line-height বড় লেখা ও দীর্ঘ রিপোর্ট কেটে দিত।
- রসিদের download বোতাম PDF নয়, stylesheet-বিহীন HTML ফাইল নামাত।

## বর্তমান দুটি পথ

### PDF ডাউনলোড

`PdfDocument` → **pdfmake / PDFKit / fontkit** → রিপোর্টের জন্য A4 PDF,
বিক্রয় রসিদের জন্য ৮০ মিমি POS PDF।

- `src/lib/reports/pdf.ts`: shared document model, lazy renderer, bundled font
  registration/embedding ও blob download। Format অনুযায়ী আলাদা renderer বেছে
  নেয়; report-এ logo fetch লাগে না। Canvas screenshot ব্যবহার হয় না।
- `src/lib/reports/report-definition.ts`: ছবির reference অনুযায়ী A4 layout,
  navy/white table header, alternating light-blue rows ও centered footer।
- `src/lib/reports/pdf-layout.ts`: typed columns (date/money/quantity/phone/text),
  পরিমাপ অনুযায়ী কলামের প্রস্থ, সারিবদ্ধতা ও A4 portrait/landscape নির্বাচন।
- `src/lib/reports/pos-receipt.ts`: `format: "pos80"` রসিদের আলাদা layout;
  fixed 80mm width, content অনুযায়ী auto height এবং 4mm margin।
- `src/components/document-actions.tsx`: busy state, duplicate-click prevention,
  error toast, retry ও পৃথক Print action।
- `src/routes/reports.tsx`: নির্বাচিত সময়সীমার সব কলাম, লাভের summary,
  দৈনিক breakdown ও বিস্তারিত লেনদেন।
- `src/components/receipt-modal.tsx`: পণ্য, পরিমাণ, মোট, ছাড়, জমা, বাকি ও নোট।
- `src/assets/fonts/`: স্থানীয় Noto Sans Bengali Regular/Bold TTF ও OFL লাইসেন্স।
  PDF fontkit-এর Bengali shaping ব্যবহার করে; PDF-এ ফন্ট embed করা থাকে।
- ফাইলের নাম ASCII রাখা হয়েছে: কিছু ব্রাউজার বাংলা filename-কে শুধু
  `download` হিসেবে সংরক্ষণ করে, extension হারিয়ে যায়। PDF-এর ভিতরের
  শিরোনাম ও বিল নম্বর বাংলাতেই থাকে।

pdfmake engine download action-এর সময় lazy-load হয়। কিন্তু ফন্ট CSS ও app
module-এর ভেতর build-time-এ data URL হিসেবে যুক্ত থাকে: PDF তৈরির সময়
`fetch()` বা CDN থেকে কোনো ফন্ট ডাউনলোড হয় না। engine import ব্যর্থ হলে
promise cache খালি হয়, যাতে আবার চেষ্টা করা যায়। Blob URL
ক্লিকের পর কিছু সময় রেখে revoke করা হয়, যাতে মোবাইলে download বাধাগ্রস্ত না হয়।

### বাংলা Unicode ও স্থানীয় ফন্ট

শুধু Unicode TTF থাকাই যথেষ্ট নয়। একই document-এ `মিয়া`/`মিয়া`-এর মতো
canonically equivalent precomposed/decomposed বাংলা অক্ষর মিশলে fontkit-এর
cached glyph clusters ভেঙে “কোয়ালিটি লেয়ার”-এ অযাচিত dotted circle আসছিল।

`src/lib/reports/unicode.ts`-এর `normalizePdfText()` দিয়ে **প্রতিটি** PDF
শিরোনাম, ঠিকানা, header, cell, note ও footer/header-এর প্রাসঙ্গিক লেখা NFC-তে
আনা হয়। মূল হিসাবের রেকর্ড বদলায় না; কারচিহ্ন, নুকতা, ZWJ/ZWNJ মুছে ফেলা হয় না।
স্থানীয় Regular/Bold TTF-এ shaping হয় এবং PDF-এ ফন্ট embed হয়।

`src/assets/fonts/`-এ দুই TTF, লাইসেন্স ও import module আছে। `?inline` দিয়ে
CSS এবং PDF font data উভয়ই bundled; কোনো external font service বা আলাদা
font-file request লাগে না। এই পরিবর্তনে নতুন ফন্ট নামানো হয়নি—রিপোজিটরির
আগের একই font binaries স্থানান্তর করা হয়েছে। এটি পুরো অ্যাপের offline cache
ঘোষণা নয়: app code ও logo asset-এর স্বাভাবিক লোড আলাদা বিষয়।

### A4 রিপোর্ট: ব্যবহারকারীর ছবির reference

শুধু A4 রিপোর্টগুলোর জন্য ব্যবহারকারী ছবির মতো **নীল রং** বেছে নিয়েছেন;
আগের সম্পূর্ণ monochrome report style এই নির্বাচন দ্বারা প্রতিস্থাপিত।

- ছবির মতো report header-এ লোগো নেই। প্রতিষ্ঠানের নাম, tagline, ঠিকানা,
  ফোন, report title ও সময়কাল মাঝখানে, কম ফাঁক রেখে বসানো। UI-এর রঙিন logo
  এবং POS PDF-এর সাদাকালো logo অপরিবর্তিত।
- সব table header centered: `#203864` গাঢ় নীল background-এ সাদা bold লেখা।
  Data rows সাদা / `#e8eff7` হালকা নীল পর্যায়ক্রমে; কালো 0.5pt grid,
  header/বিশেষ total-এর নিচে 0.85pt rule। পুনরাবৃত্ত header-ও একই নীল।
- নাম/বিবরণ বাঁয়ে; ID, quantity, date ও phone মাঝখানে; টাকা ডানদিকে।
  Stock report-এ পণ্যের কলাম বেশি প্রশস্ত, বাকি কলাম compact।
- রিপোর্ট A4, পাশে 15mm margin। মাপ অনুযায়ী portrait/landscape, wrapped
  description, বড় অঙ্ক এবং বহু পৃষ্ঠার/tall-row handling বজায় আছে।
- প্রতি পৃষ্ঠায় centered statement notice, তার নিচে centered `পৃষ্ঠা X / Y`।
  শেষ পৃষ্ঠায় footer টেবিল/নোটের পরপর আসে, খালি কাগজের নিচে আটকে থাকে না।
  স্বাক্ষরের জায়গা/রেখা নেই। আগের “স্বয়ংক্রিয়ভাবে তৈরি স্টেটমেন্ট—স্বাক্ষরের
  প্রয়োজন নেই।” লেখাটি shared `document-text.ts` থেকে নেওয়া হয়।
- শেষ footer-এর অবস্থান row count দিয়ে অনুমান করা হয় না। pdfmake 0.3 body
  layout করার পর footer callback চালায়; শেষের অদৃশ্য zero-height canvas
  marker-এর measured `positions` থেকে শেষ content-এর page/top নেওয়া হয়।
  Footer-এর reserved area থেকে relative offset দিয়ে সরানো হয়। এটি engine-এর
  layout metadata-নির্ভর; version update-এ real-PDF regression চালাতে হবে।
- `report-definition.test.mjs` আসল PDF parse করে palette, centered alignment,
  footer gap, page count, empty data, ১৪০ সারি এবং বহু পৃষ্ঠার এক সারির শেষ তথ্য
  পরীক্ষা করে। Bengali font/NFC এবং 13.5/10.5/9pt type scale অপরিবর্তিত।

### বিক্রয় রসিদ: ৮০ মিমি POS PDF

শুধু `ReceiptModal`-এর `PdfDocument`-এ `format: "pos80"` থাকে। Owner-এর বিক্রয়
ও ক্রেতার খাতা, customer home ও আমার বাকি—সব জায়গার receipt download একই
layout পায়। অন্যান্য report-এর A4 planner, page count ও 15mm side margin বদলায়নি।

- কাগজের প্রস্থ 80mm (`226.77pt`); পাশে 4mm করে বাদ দিয়ে printable area 72mm।
- pdfmake-এর `height: "auto"` প্রকৃত text/table layout থেকে পৃষ্ঠার দৈর্ঘ্য
  নির্ধারণ করে। ছোট রসিদে A4-এর ফাঁকা tail নেই; বেশি পণ্যে লম্বা roll হয়।
- মাঝখানে কালো লোগো, প্রতিষ্ঠানের নাম/ঠিকানা/ফোন এবং রসিদের শিরোনাম। তারপর
  বিল নম্বর, তারিখ ও ক্রেতা আলাদা লাইনে; বড় নাম/নোট স্বাভাবিকভাবে wrap হয়।
- পণ্যের নাম দুই কলাম জুড়ে পুরো প্রস্থে। পরের লাইনে পরিমাণ × সংরক্ষিত দর,
  ডানদিকে item total। ভগ্নাংশ, ইউনিট বা saved price বাদ/পুনর্গণনা করা হয় না।
- Table header মাঝখানে, টাকার অঙ্ক ডানদিকে; vertical grid-এর বদলে হালকা
  কালো dashed separator। উপমোট/ছাড়/মোট/জমা/বাকি থাকে; সর্বমোট ও বাকি bold।
- একই bundled Noto Sans Bengali ও 13.5/10.5/9pt type scale, সব string NFC।
- স্বাক্ষর নেই। আগের স্বয়ংক্রিয় স্টেটমেন্টের footer এখন content-এর শেষে;
  auto-height পৃষ্ঠায় fixed-position footer বা অপ্রয়োজনীয় page count নেই।
- Browser-এর সরাসরি Print এখনও A4 preview ব্যবহার করে। POS printer-এর জন্য
  **ডাউনলোড করা PDF** খুলে 80mm roll ও Actual size / 100% বেছে নিন; driver-এর
  paper-length/support অনুযায়ী printer setting লাগতে পারে। মোবাইলে Print
  বোতাম আগের মতো লুকানো। বাস্তব POS printer-এ পরীক্ষা করা হয়নি।

`pos-receipt.test.mjs` আসল PDF render/parse করে 80mm width, auto height,
printable bounds, ৫০ পণ্য, দীর্ঘ নাম/নোট, ভগ্নাংশ, বড় অঙ্ক, zero-item receipt
এবং শেষ সারি অক্ষত থাকার regression চালায়। Browser smoke customer receipt-এর
মাপ/দৈর্ঘ্য এবং অন্য রিপোর্টগুলোর A4 মাপও আলাদাভাবে যাচাই করে।

### প্রিন্ট / Save as PDF

Report ও receipt dialog `createPortal` দিয়ে সরাসরি `document.body`-তে থাকে।
ছবির মতো নীল report layout পেতে **PDF ডাউনলোড** ব্যবহার করুন। Browser-এর
সরাসরি Print preview আগের সাদাকালো CSS ব্যবহার করে।
Print media-তে শুধু খোলা document থাকে; background app, navigation, date
inputs ও action buttons লুকানো হয়। Scroll container-এর max-height ও overflow
সরিয়ে পুরো document প্রিন্ট করা হয়। Desktop print CSS-এ সাদা কাগজ, কালো
লেখা/টেবিল বর্ডার, grayscale logo এবং A4 15mm margin থাকে। কোনো document খোলা না থাকলে পুরো অ্যাপ
লুকানো হয় না।

**প্রিন্ট** বোতাম ও তার নির্দেশনা শুধু ডেস্কটপে দেখা যায়: viewport অন্তত 768px,
primary pointer fine এবং hover সমর্থিত হতে হবে। ছোট screen বা touch-first
ডিভাইসে (ফোন landscape ও tablet-সহ) সব রিপোর্ট/রসিদে এগুলো লুকানো থাকে।
PDF download সব ডিভাইসে থাকে; browser-এর নিজস্ব Print menu বদলানো হয় না।

ডেস্কটপে **প্রিন্ট** চাপলে font readiness-এর পর browser print dialog খোলে। ব্যবহারকারী
printer বা **Save as PDF** বেছে নেন। Physical printer এবং মোবাইল browser-এর
printing support ব্যবহারকারীর ডিভাইসের ওপর নির্ভর করে।

## পরীক্ষা

```bash
npm run build:pages
npx playwright install --with-deps chromium
npm run test:pages
```

ব্রাউজার smoke test বাস্তব PDF download করে PDF.js দিয়ে পড়ে: টাকার কলাম,
receipt PDF, প্রতি পৃষ্ঠায় embedded logo, text-এর margin bounds, টাকার
right-edge alignment, POS-এ লোগো ও সব PDF-এ প্রতিষ্ঠানের নামের center coordinate,
সব table header-এর centering, প্রতিটি পৃষ্ঠার A4 dimensions, A4 drawing-এর অনুমোদিত নীল palette এবং POS-এর সাদাকালো
রঙ ও logo pixel-এর সাদাকালো মান, print-only visibility, print invocation, দীর্ঘ ১৪০-সারির রিপোর্টের
pagination/শেষ সারি, এক-পৃষ্ঠার চেয়ে লম্বা বিবরণ, খালি report এবং logo
failure-এর পরে retry যাচাই করে।
মোবাইল portrait/landscape, tablet, ছোট viewport ও desktop-এ সব রিপোর্টের
print visibility, PDF download এবং receipt keyboard focus-ও যাচাই করা হয়।
সব HTTP font request এবং বাইরের service বন্ধ রেখেও PDF generation সফল
হয়; font request-এর সংখ্যা শূন্য কিনা যাচাই হয়। ইউনিট টেস্টে Regular ও Bold
দুই ফন্টের পুরোনো glyph-corruption পুনরুৎপাদন করে NFC-তে সেটি না হওয়া যাচাই হয়। Physical printer
থেকে কাগজ বের হওয়া এই স্বয়ংক্রিয় পরীক্ষার আওতায় নয়।

এই নথি আগের jsPDF-ভিত্তিক architecture বর্ণনাকে প্রতিস্থাপন করে; সেখানে উল্লেখিত
`src/lib/reports/pdf/engine.ts`, `fonts:subset` ও `tests/pdf.test.ts` এই checkout-এ নেই।
