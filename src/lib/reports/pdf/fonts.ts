/**
 * PDF-এ বাংলা ফন্ট — একবার লোড, বারবার ব্যবহার।
 *
 * ফন্ট ফাইল দুটি (`public/fonts/NotoSansBengali-*.ttf`, `npm run fonts:subset`
 * দিয়ে তৈরি) lazy ভাবে আনা হয়: শুধু PDF ডাউনলোড চাপলে। Report Center খোলার সময়
 * কোনো ফন্ট বা PDF লাইব্রেরি লোড হয় না।
 *
 * ব্রাউজার/সিস্টেম ফন্টের উপর নির্ভরতা নেই — ফাইলটাই PDF-এ embed হয়, তাই যে
 * ডিভাইসেই খোলা হোক বাংলা ঠিকভাবে আঁকা হয়।
 */
import { BengaliShaper, type BengaliWeight, type FontkitFontLike } from './bengali'

/** ওজন → ফাইল-নাম (Vite `base` অনুযায়ী relative path) */
const FONT_FILES: Record<BengaliWeight, string> = {
  normal: 'NotoSansBengali-Regular.ttf',
  bold: 'NotoSansBengali-Bold.ttf',
}

export interface BengaliFontFile {
  /** jsPDF-এ embed করার জন্য base64 (একবার বানিয়ে ক্যাশ) */
  base64: string
  /** কত বাইট (লগ/ডায়াগনস্টিকের জন্য) */
  size: number
}

export interface BengaliFontSet {
  shapers: Record<BengaliWeight, BengaliShaper>
  files: Record<BengaliWeight, BengaliFontFile>
}

const LOAD_TIMEOUT_MS = 8000

let loaded: BengaliFontSet | null = null
let pending: Promise<BengaliFontSet> | null = null

/**
 * ফন্টের ঠিকানা Vite `base` অনুযায়ী (GitHub Pages-এ '/ShopLedGer/')।
 * Vite build-এ `import.meta.env.BASE_URL` বসে যায়; টেস্ট/Node-এ env না থাকলে '/'.
 */
function fontUrl(file: string): string {
  let base = '/'
  try {
    base = import.meta.env.BASE_URL || '/'
  } catch {
    base = '/'
  }
  return `${base}fonts/${file}`
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let at = 0; at < bytes.length; at += chunk) {
    binary += String.fromCharCode(...bytes.subarray(at, at + chunk))
  }
  return btoa(binary)
}

async function fetchFont(file: string): Promise<Uint8Array> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS)
  try {
    const response = await fetch(fontUrl(file), { signal: controller.signal, cache: 'force-cache' })
    if (!response.ok) throw new Error('ফন্ট পাওয়া যায়নি')
    return new Uint8Array(await response.arrayBuffer())
  } catch {
    throw new Error('বাংলা ফন্ট লোড করা যায়নি — ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।')
  } finally {
    clearTimeout(timer)
  }
}

/** বাংলা ফন্ট (regular + bold) লোড — একবারই ডাউনলোড/পার্স হয়, তারপর ক্যাশ */
export function loadBengaliFonts(): Promise<BengaliFontSet> {
  if (loaded) return Promise.resolve(loaded)
  if (pending) return pending
  pending = (async () => {
    const fontkit = await import('fontkit')
    const weights: BengaliWeight[] = ['normal', 'bold']
    const bytes = await Promise.all(weights.map((weight) => fetchFont(FONT_FILES[weight])))
    const shapers = {} as Record<BengaliWeight, BengaliShaper>
    const files = {} as Record<BengaliWeight, BengaliFontFile>
    weights.forEach((weight, index) => {
      const font = fontkit.create(bytes[index] as unknown as ArrayBuffer) as unknown as FontkitFontLike
      shapers[weight] = new BengaliShaper(font)
      files[weight] = { base64: toBase64(bytes[index]), size: bytes[index].byteLength }
    })
    loaded = { shapers, files }
    return loaded
  })()
  pending.catch(() => { pending = null })
  return pending
}

/** ফন্ট আগেই লোড হয়ে থাকলে সেটিই (নয়তো null) — মাপ করার ফলব্যাকে লাগে */
export const loadedBengaliFonts = (): BengaliFontSet | null => loaded
