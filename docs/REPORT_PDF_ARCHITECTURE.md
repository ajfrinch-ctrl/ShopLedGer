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

`PdfDocument` → **pdfmake / PDFKit / fontkit** → A4 PDF।

- `src/lib/reports/pdf.ts`: shared document model, lazy renderer, bundled font
  registration/embedding, repeated table headers, text wrapping, automatic
  pagination, page numbers ও blob download। Canvas screenshot ব্যবহার হয় না।
- `src/lib/reports/pdf-layout.ts`: typed columns (date/money/quantity/phone/text),
  পরিমাপ অনুযায়ী কলামের প্রস্থ, সারিবদ্ধতা ও A4 portrait/landscape নির্বাচন।
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

### লোগো ও পেজে তথ্যের বিন্যাস

- PDF-এ `SHOP.printLogo`-র স্থানীয় সাদাকালো PNG embed হয়; অ্যাপের UI-তে
  আগের রঙিন `SHOP.logo` অপরিবর্তিত থাকে। প্রথম পৃষ্ঠায় 44pt লোগো এবং তার
  নিচে প্রতিষ্ঠানের নাম/ঠিকানা/ফোন—সবকিছু পৃষ্ঠার মাঝখানে। পরের পৃষ্ঠায় 18pt
  লোগো, প্রতিষ্ঠানের নাম ও রিপোর্টের নামসহ centered compact header থাকে।
  header যেন টেবিলের ওপর না পড়ে, তার জন্য ওপরের জায়গা সংরক্ষিত থাকে।
  লোগো fetch ব্যর্থ হলে নিঃশব্দে লোগোবিহীন PDF তৈরি না করে error/retry দেখায়।
- **সব টেবিলের header নিজ নিজ কলামের মাঝখানে** থাকে; body data-এর alignment
  আলাদা: নাম/বিবরণ বাঁয়ে, তারিখ/মোবাইল নম্বর মাঝখানে এবং টাকা/পরিমাণ ডানদিকে।
  Repeat হওয়া table header-ও centered। Footer-এর স্বয়ংক্রিয় স্টেটমেন্টের নোট মাঝখানে
  থাকে, পৃষ্ঠা নম্বর ডানদিকে।
- তারিখ/টাকার আসল লেখার প্রস্থ মেপে জায়গা রাখা হয়। Canvas শুধু স্থানীয়
  Noto Sans Bengali দিয়ে প্রস্থ মাপে; PDF-এর লেখা আগের মতো font-embedded text,
  screenshot নয়। প্রতিটি কলামের padding-সহ প্রস্থ A4 margin-এর মধ্যে থাকে।
- সাধারণ রিপোর্ট portrait; নির্ধারিত column minima portrait-এ না আঁটলে landscape।
  বড় অঙ্কে প্রয়োজনে caption-size পর্যন্ত নামানো হয়; তাতেও না ধরলে wrap হয়,
  কখনো অঙ্ক বাদ দেওয়া বা ellipsis ব্যবহার হয় না।
- পণ্য/বিবরণের কলাম বেশি জায়গা পায় এবং wrap হয়। সাধারণ সারি অখণ্ড অবস্থায়
  পরের পৃষ্ঠায় যায়। একটি সারি পৃষ্ঠার চেয়েও লম্বা হলে সেটি পরের পৃষ্ঠায়
  চলতে পারে; প্রথম সারিকে header-এর সঙ্গে জোর করে আটকে তথ্য হারানো হয় না।
- প্রতি পৃষ্ঠায় table header পুনরাবৃত্ত হয়। সব cell সাদা; header মোটা অক্ষরে,
  horizontal/vertical grid কালো 0.5pt এবং header/বিশেষ total-এর রেখা 0.85pt।
  Zebra shading বা রঙিন background নেই, তাই সাদাকালো printer-এ রঙের ওপর
  নির্ভরতা নেই এবং বড় ভরাট অংশে অতিরিক্ত toner লাগে না।
- A4-এর পাশে 15mm মার্জিন। প্রস্থ নির্ধারণে padding-এর পাশাপাশি vertical
  border-এর প্রস্থও ধরা হয়। সব লেখা/রেখা কালো এবং print logo-র pixel কেবল
  কালো/সাদা; printer setting দিয়ে রঙ বদলানোর প্রয়োজন নেই।
- রসিদের সর্বমোট/বাকি এবং লাভের summary-তে নিট লাভ bold। Bold অঙ্কের প্রকৃত
  প্রস্থ মাপা হয়। মালিকের স্বাক্ষরের জায়গা/রেখা নেই। প্রতি পৃষ্ঠার footer-এ
  “স্বয়ংক্রিয়ভাবে তৈরি স্টেটমেন্ট—স্বাক্ষরের প্রয়োজন নেই।”, পাতলা রেখা এবং
  `পৃষ্ঠা X / Y` থাকে। একই নোট report/receipt preview ও desktop print-এও থাকে;
  লেখাটি `src/lib/reports/document-text.ts` থেকে নেওয়া হয়।

### প্রিন্ট / Save as PDF

Report ও receipt dialog `createPortal` দিয়ে সরাসরি `document.body`-তে থাকে।
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
right-edge alignment, প্রতিটি পৃষ্ঠায় লোগো ও প্রতিষ্ঠানের নামের center coordinate,
সব table header-এর centering, প্রতিটি পৃষ্ঠার A4 dimensions, PDF drawing-এর সাদাকালো
রঙ এবং logo pixel-এর সাদাকালো মান, print-only visibility, print invocation, দীর্ঘ ১৪০-সারির রিপোর্টের
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
