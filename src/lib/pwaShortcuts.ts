/**
 * PWA অ্যাপ-শর্টকাট (Android-এ ইনস্টল করা আইকনে লং-প্রেস করলে যে কুইক-অ্যাকশন মে뉴 আসে)।
 *
 * এটাই `shortcuts` অ্যারে-এর একমাত্র সোর্স — vite.config.ts এখান থেকে ম্যানিফেস্টে বসায়,
 * আর tests/pwaShortcuts.test.ts এখান থেকে যাচাই করে। নতুন শর্টকাট লাগলে শুধু এখানে
 * এক লাইন যোগ করুন + `node scripts/generate-shortcut-icons.mjs`-এ আইকন জেনারেট করুন।
 *
 * নিয়ম (Web App Manifest spec + Chrome on Android):
 *  - `url` অবশ্যই ম্যানিফেস্টের scope-এর ভিতরে হতে হবে (এখানে base-সহ অ্যাবসল্যুট পাথ)।
 *  - আইকন PNG, কমপক্ষে 96×96; আমরা 96 ও 192 দুটোই দিই (48dp-এর গুণিতক)।
 *  - আইকনের `src` ম্যানিফেস্ট-URL সাপেক্ষে রিলেটিভ — তাই Vite `base`
 *    (রুট `/` বা GitHub Pages-এর `/ShopLedGer/`) দুটোতেই ঠিক থাকে।
 */

/** শর্টকাট আইকনের সাইজ — Chrome-এর সুপারিশ 48dp-এর গুণিতক; TWA/বাবলর‍্যাপের ন্যূনতম 96 */
export const SHORTCUT_ICON_SIZES = [96, 192] as const
export type ShortcutIconSize = (typeof SHORTCUT_ICON_SIZES)[number]

export interface AppShortcut {
  /** আইকন ফাইল ও টেস্টের জন্য ইউনিক কী — public/shortcuts/<key>-<size>.png */
  key: 'new-sale' | 'customers' | 'receipts' | 'products' | 'reports'
  /** লং-প্রেস মেনুতে যে লেবেল দেখাবে */
  name: string
  /** ছোট লেবেল (লঞ্চার জায়গা কমলে) */
  shortName: string
  /** অ্যাকশনের বিবরণ — অ্যাপের ভাষা বাংলায় */
  description: string
  /** অ্যাপের ভিতরের রাউট (App.tsx-এ রেজিস্টার্ড) */
  path: string
}

/** লং-প্রেস মেনুতে দেখানোর ক্রম অনুযায়ী সাজানো (Android সাধারণত প্রথম ৪টি দেখায়) */
export const APP_SHORTCUTS: AppShortcut[] = [
  {
    key: 'new-sale',
    name: 'New Sale',
    shortName: 'New Sale',
    description: 'নতুন বিক্রি এন্ট্রি খুলুন — পণ্য বেছে রসিদ বানান',
    path: '/sales',
  },
  {
    key: 'customers',
    name: 'Customers',
    shortName: 'Customers',
    description: 'ক্রেতার তালিকা, বাকি ও কেনাকাটার ইতিহাস',
    path: '/customers',
  },
  {
    key: 'receipts',
    name: 'Receipts',
    shortName: 'Receipts',
    description: 'খরচ এন্ট্রি ও রসিদ দেখুন',
    path: '/expenses',
  },
  {
    key: 'products',
    name: 'Products',
    shortName: 'Products',
    description: 'পণ্য ও স্টক (ইনভেন্টরি) পরিচালনা করুন',
    path: '/stock',
  },
  {
    key: 'reports',
    name: 'Reports',
    shortName: 'Reports',
    description: 'রিপোর্ট সেন্টার — সব রিপোর্ট ও PDF',
    path: '/reports',
  },
]

/** Vite `base`-এর সাথে রাউট পাথ জোড়া — '/' → '/sales', '/ShopLedGer/' → '/ShopLedGer/sales' */
export function joinBase(base: string, path: string): string {
  const b = base.endsWith('/') ? base : `${base}/`
  return `${b}${path.replace(/^\/+/, '')}`
}

/** public/ ফোল্ডারের সাপেক্ষে আইকনের রিলেটিভ পাথ (ম্যানিফেস্ট-URL সাপেক্ষে রেজলভ হয়) */
export function shortcutIconSrc(key: AppShortcut['key'], size: ShortcutIconSize): string {
  return `shortcuts/${key}-${size}.png`
}

export interface ManifestShortcutIcon {
  src: string
  sizes: string
  type: 'image/png'
}

export interface ManifestShortcut {
  name: string
  short_name: string
  description: string
  url: string
  icons: ManifestShortcutIcon[]
}

/**
 * ম্যানিফেস্টের `shortcuts` অ্যারে গড়ে দেয়।
 * @param base Vite-এর base ('/' অথবা GitHub Pages-এ '/ShopLedGer/') — url এতেই তৈরি হয়,
 *             আর আইকন রিলেটিভ থাকে যাতে দুই ডিপ্লয়মেন্টেই রেজলভ হয়।
 */
export function buildAppShortcuts(base = '/'): ManifestShortcut[] {
  return APP_SHORTCUTS.map((s) => ({
    name: s.name,
    short_name: s.shortName,
    description: s.description,
    url: joinBase(base, s.path),
    icons: SHORTCUT_ICON_SIZES.map((size) => ({
      src: shortcutIconSrc(s.key, size),
      sizes: `${size}x${size}`,
      type: 'image/png' as const,
    })),
  }))
}
