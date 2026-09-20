# রিপোর্ট ও রসিদের PDF / প্রিন্ট

আপডেট: ২০ সেপ্টেম্বর ২০২৬

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

- `src/lib/reports/pdf.ts`: shared document model, lazy renderer, একই origin
  থেকে font fetch, embedding, repeated table headers, text wrapping, automatic
  pagination, page numbers ও blob download। Canvas screenshot ব্যবহার হয় না।
- `src/lib/reports/pdf-layout.ts`: typed columns (date/money/quantity/phone/text),
  পরিমাপ অনুযায়ী কলামের প্রস্থ, সারিবদ্ধতা ও A4 portrait/landscape নির্বাচন।
- `src/components/document-actions.tsx`: busy state, duplicate-click prevention,
  error toast, retry ও পৃথক Print action।
- `src/routes/reports.tsx`: নির্বাচিত সময়সীমার সব কলাম, লাভের summary,
  দৈনিক breakdown ও বিস্তারিত লেনদেন।
- `src/components/receipt-modal.tsx`: পণ্য, পরিমাণ, মোট, ছাড়, জমা, বাকি ও নোট।
- `public/fonts/`: স্থানীয় Noto Sans Bengali Regular/Bold TTF ও OFL লাইসেন্স।
  PDF fontkit-এর Bengali shaping ব্যবহার করে; PDF-এ ফন্ট embed করা থাকে।
- ফাইলের নাম ASCII রাখা হয়েছে: কিছু ব্রাউজার বাংলা filename-কে শুধু
  `download` হিসেবে সংরক্ষণ করে, extension হারিয়ে যায়। PDF-এর ভিতরের
  শিরোনাম ও বিল নম্বর বাংলাতেই থাকে।

pdfmake ও ফন্ট কেবল download-এর সময় লোড হয়। ব্যর্থ font-loading promise
cache থেকে সরানো হয়, যাতে পরের ক্লিকে আবার চেষ্টা করা যায়। Blob URL
ক্লিকের পর কিছু সময় রেখে revoke করা হয়, যাতে মোবাইলে download বাধাগ্রস্ত না হয়।

### লোগো ও পেজে তথ্যের বিন্যাস

- `SHOP.logo`-র JPEG একই origin থেকে এনে PDF-এ embed হয়। প্রথম পৃষ্ঠায়
  প্রতিষ্ঠানের নামের ওপরে 48pt লোগো, পরের পৃষ্ঠায় 20pt লোগোসহ সংক্ষিপ্ত header।
  লোগো fetch ব্যর্থ হলে নিঃশব্দে লোগোবিহীন PDF তৈরি না করে error/retry দেখায়।
- নাম/বিবরণ বাঁয়ে, তারিখ/মোবাইল নম্বর মাঝখানে এবং টাকা/পরিমাণ ডানদিকে।
  একই alignment কলামের header ও data-তে প্রযোজ্য।
- তারিখ/টাকার আসল লেখার প্রস্থ মেপে জায়গা রাখা হয়। Canvas শুধু স্থানীয়
  Noto Sans Bengali দিয়ে প্রস্থ মাপে; PDF-এর লেখা আগের মতো font-embedded text,
  screenshot নয়। প্রতিটি কলামের padding-সহ প্রস্থ A4 margin-এর মধ্যে থাকে।
- সাধারণ রিপোর্ট portrait; নির্ধারিত column minima portrait-এ না আঁটলে landscape।
  বড় অঙ্কে প্রয়োজনে caption-size পর্যন্ত নামানো হয়; তাতেও না ধরলে wrap হয়,
  কখনো অঙ্ক বাদ দেওয়া বা ellipsis ব্যবহার হয় না।
- পণ্য/বিবরণের কলাম বেশি জায়গা পায় এবং wrap হয়। সাধারণ সারি অখণ্ড অবস্থায়
  পরের পৃষ্ঠায় যায়। একটি সারি পৃষ্ঠার চেয়েও লম্বা হলে সেটি পরের পৃষ্ঠায়
  চলতে পারে; প্রথম সারিকে header-এর সঙ্গে জোর করে আটকে তথ্য হারানো হয় না।
- প্রতি পৃষ্ঠায় table header পুনরাবৃত্ত হয়; হালকা বিকল্প row background
  পড়তে সহায়তা করে।

### প্রিন্ট / Save as PDF

Report ও receipt dialog `createPortal` দিয়ে সরাসরি `document.body`-তে থাকে।
Print media-তে শুধু খোলা document থাকে; background app, navigation, date
inputs ও action buttons লুকানো হয়। Scroll container-এর max-height ও overflow
সরিয়ে পুরো document প্রিন্ট করা হয়। কোনো document খোলা না থাকলে পুরো অ্যাপ
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
right-edge alignment, print-only visibility, print invocation, দীর্ঘ ১৪০-সারির রিপোর্টের
pagination/শেষ সারি, এক-পৃষ্ঠার চেয়ে লম্বা বিবরণ, খালি report এবং font/logo
failure-এর পরে retry যাচাই করে।
মোবাইল portrait/landscape, tablet, ছোট viewport ও desktop-এ সব রিপোর্টের
print visibility, PDF download এবং receipt keyboard focus-ও যাচাই করা হয়।
বাইরের network requests বন্ধ রেখেও স্থানীয় ফন্ট কাজ করতে হবে। Physical printer
থেকে কাগজ বের হওয়া এই স্বয়ংক্রিয় পরীক্ষার আওতায় নয়।

এই নথি আগের jsPDF-ভিত্তিক architecture বর্ণনাকে প্রতিস্থাপন করে; সেখানে উল্লেখিত
`src/lib/reports/pdf/engine.ts`, `fonts:subset` ও `tests/pdf.test.ts` এই checkout-এ নেই।
