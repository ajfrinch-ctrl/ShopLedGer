/**
 * বাংলা PDF ফন্ট তৈরি — `public/fonts/NotoSansBengali-*.ttf`
 *
 * কেন: PDF-এ বাংলা লেখা এমবেড করতে একটি Unicode Bengali font লাগে (ব্রাউজার/সিস্টেম
 * ফন্টের উপর ভরসা করা যায় না)। সম্পূর্ণ Noto Sans Bengali বড়, তাই Latin+Bengali
 * রেঞ্জে সাবসেট করা হয় — গ্লিফ ও GSUB shaping feature (akhn/blwf/pres/half/rphf…)
 * অপরিবর্তিত থাকে, কিন্তু ফাইল ~৩ গুণ ছোট হয়।
 *
 * সোর্স: `@expo-google-fonts/noto-sans-bengali` (devDependency, আপস্ট্রিম Noto রিলিজ)।
 * চালান: `npm run fonts:subset`
 */
import subsetFont from 'subset-font'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = (weight) =>
  join(root, 'node_modules/@expo-google-fonts/noto-sans-bengali', weight, `NotoSansBengali_${weight}.ttf`)
const target = (name) => join(root, 'public/fonts', name)

/**
 * যে অক্ষরগুলো রাখতে হবে: বাংলা (০৯৮০–০৯FF), Latin-1, ZWJ/ZWNJ (যুক্তবর্ণ গঠনে
 * দরকার) এবং সাধারণ যতিচিহ্ন/৳। hb-subset টেক্সট চায়, তাই রেঞ্জ থেকে স্ট্রিং বানানো হয়।
 */
const RANGES = [
  [0x0020, 0x00ff], // Latin-1 (ইংরেজি অক্ষর, সংখ্যা, যতিচিহ্ন)
  [0x0964, 0x0965], // ।  ॥ — বাংলা দাঁড়ি (রিপোর্টের প্রতিটি বাক্যে ব্যবহৃত)
  [0x0980, 0x09ff], // বাংলা ব্লক (অক্ষর, মাত্রা, যুক্তাক্ষর, ৳, বাংলা সংখ্যা)
  [0x200c, 0x200d], // ZWNJ / ZWJ
  [0x2000, 0x206f], // ড্যাশ, কোটেশন, •, …, ইত্যাদি (general punctuation)
  [0x20b9, 0x20b9], // ₹
  [0x2200, 0x22ff], // গাণিতিক চিহ্ন — যেমন (−) মাইনাস (U+2212)
]
const KEEP_TEXT = RANGES.flatMap(([from, to]) => {
  const chars = []
  for (let cp = from; cp <= to; cp++) chars.push(String.fromCodePoint(cp))
  return chars
}).join('')

const FONTS = [
  { weight: '400Regular', name: 'NotoSansBengali-Regular.ttf' },
  { weight: '700Bold', name: 'NotoSansBengali-Bold.ttf' },
]

mkdirSync(join(root, 'public/fonts'), { recursive: true })
for (const font of FONTS) {
  const bytes = readFileSync(source(font.weight))
  const subset = await subsetFont(bytes, KEEP_TEXT, { targetFormat: 'truetype', variationAxes: {} })
  writeFileSync(target(font.name), Buffer.from(subset))
  const kb = (subset.byteLength / 1024).toFixed(0)
  console.log(`${font.name}: ${(bytes.byteLength / 1024).toFixed(0)} KB → ${kb} KB`)
}
