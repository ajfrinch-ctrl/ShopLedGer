# একক ফন্ট ও টাইপোগ্রাফি

সব পেজ, ফর্ম, টপবার, মেনু, নোটিফিকেশন, রিপোর্ট, রসিদ এবং PDF-এ
**Noto Sans Bengali** ব্যবহার করা হয়। বাংলা, ইংরেজি ও সংখ্যার জন্য আলাদা
monospace/system font নির্বাচন করা হয় না। `tabular` শুধু সংখ্যার প্রস্থ নিয়ন্ত্রণ করে।
স্থানীয় Regular (400) ও Bold (700) ফন্ট `public/fonts/`-এ লাইসেন্সসহ আছে।

## একই কাজের জন্য একই সাইজ

`src/styles.css`-এর Tailwind theme-এ চারটি role:

| Role | ডিফল্ট সাইজ | ব্যবহার |
|---|---|---|
| `text-body` | 14px | সাধারণ লেখা, তালিকা, টাকা, বাটন, টেবিল |
| `text-caption` | 12px | তারিখ, ঠিকানা, সহায়ক লেখা, নিচের নেভিগেশন |
| `text-heading` | 18px | পেজ/ডায়ালগ শিরোনাম, প্রধান শিরোনাম |
| `text-input` | 16px | input, select, textarea; iOS-এর focus zoom এড়াতে |

সাইজগুলো `rem`-এ সংজ্ঞায়িত, তাই browser text scaling কাজ করে। সব role-এর
line-height 1.5। সাধারণ লেখা Regular, জোর দেওয়া লেখা Bold। নতুন কম্পোনেন্টে
ইচ্ছেমতো `text-[11px]`, `text-xl` বা আলাদা font family যোগ না করে এই role ব্যবহার করুন।
ছোট section label `text-body font-bold` হতে পারে; সব লেখা এক মাপ করে
শিরোনাম ও বিষয়বস্তুর পার্থক্য মুছে ফেলা হয়নি।

PDF-এ একই Noto Sans Bengali embed হয়। `src/lib/reports/pdf-layout.ts`-এর
`PDF_TYPE` UI-এর 18/14/12px-কে PDF-এর 13.5/10.5/9pt-এ রূপান্তর করে
(1 CSS px = 0.75 PDF pt)। Print view UI-এর role-ই ব্যবহার করে।

## রিগ্রেশন পরীক্ষা

- `npm test`: per-page arbitrary font size/family প্রতিরোধ এবং UI/PDF scale মিল পরীক্ষা।
- `npm run build:pages && npm run test:pages`: 360px ও 1280px viewport-এ পেজ,
  form, report/receipt dialog ও toast-এর computed font/size এবং স্থানীয় font load পরীক্ষা।
- `TYPOGRAPHY_SCREENSHOTS=1 npm run test:pages`: `.cache/`-এ review screenshot রাখে।
