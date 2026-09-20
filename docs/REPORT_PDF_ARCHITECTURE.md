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

### প্রিন্ট / Save as PDF

Report ও receipt dialog `createPortal` দিয়ে সরাসরি `document.body`-তে থাকে।
Print media-তে শুধু খোলা document থাকে; background app, navigation, date
inputs ও action buttons লুকানো হয়। Scroll container-এর max-height ও overflow
সরিয়ে পুরো document প্রিন্ট করা হয়। কোনো document খোলা না থাকলে পুরো অ্যাপ
লুকানো হয় না।

**প্রিন্ট** চাপলে font readiness-এর পর browser print dialog খোলে। ব্যবহারকারী
printer বা **Save as PDF** বেছে নেন। Physical printer এবং মোবাইল browser-এর
printing support ব্যবহারকারীর ডিভাইসের ওপর নির্ভর করে।

## পরীক্ষা

```bash
npm run build:pages
npx playwright install --with-deps chromium
npm run test:pages
```

ব্রাউজার smoke test বাস্তব PDF download করে PDF.js দিয়ে পড়ে: টাকার কলাম,
receipt PDF, print-only visibility, print invocation, দীর্ঘ ১৪০-সারির রিপোর্টের
pagination/শেষ সারি, খালি report এবং font failure-এর পরে retry যাচাই করে।
বাইরের network requests বন্ধ রেখেও স্থানীয় ফন্ট কাজ করতে হবে। Physical printer
থেকে কাগজ বের হওয়া এই স্বয়ংক্রিয় পরীক্ষার আওতায় নয়।

এই নথি আগের jsPDF-ভিত্তিক architecture বর্ণনাকে প্রতিস্থাপন করে; সেখানে উল্লেখিত
`src/lib/reports/pdf/engine.ts`, `fonts:subset` ও `tests/pdf.test.ts` এই checkout-এ নেই।
