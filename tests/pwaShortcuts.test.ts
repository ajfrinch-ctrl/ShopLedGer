/* PWA অ্যাপ-শর্টকাট যাচাই — ম্যানিফেস্ট-কনফিগ, আইকন ফাইল ও রাউট-রেজিস্ট্রেশন।
   চলে: npm test  (বিল্ডের পর আবার চালালে dist/manifest.webmanifest-ও যাচাই হয়) */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { join } from 'node:path'
import { APP_SHORTCUTS, SHORTCUT_ICON_SIZES, buildAppShortcuts, joinBase } from '../src/lib/pwaShortcuts'

const ROOT = join(import.meta.dirname, '..')

/* ── PNG হেল্পার: সিগনেচার + IHDR ডাইমেনশন + আলফা-কভারেজ (ফিল্টার-0 ধরে) ── */
function readPng(file: string) {
  const buf = readFileSync(file)
  assert.deepEqual(
    [...buf.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    `${file} PNG সিগনেচার নয়`,
  )
  let off = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  const idat: Buffer[] = []
  while (off < buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('ascii', off + 4, off + 8)
    const data = buf.subarray(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
    } else if (type === 'IDAT') idat.push(Buffer.from(data))
    off += 12 + len
  }
  return { width, height, bitDepth, colorType, raw: inflateSync(Buffer.concat(idat)) }
}

/** স্বচ্ছ নয় এমন পিক্সেলের অনুপাত — খালি বা পুরো ভরাট দুটোই বাগ */
function inkRatio(png: { width: number; height: number; colorType: number; raw: Buffer }) {
  assert.equal(png.colorType, 6, 'আইকন RGBA (color type 6) হতে হবে')
  const stride = png.width * 4
  let ink = 0
  for (let y = 0; y < png.height; y++) {
    assert.equal(png.raw[y * (stride + 1)], 0, 'ফিল্টার বাইট 0 হতে হবে')
    for (let x = 0; x < png.width; x++) {
      if (png.raw[y * (stride + 1) + 1 + x * 4 + 3] > 128) ink++
    }
  }
  return ink / (png.width * png.height)
}

/* ── ১) শর্টকাট তালিকা: ক্রম, লেবেল ও বর্ণনা ── */
test('পাঁচটি শর্টকাট সঠিক ক্রমে আছে (লং-প্রেস মেনুর ক্রম)', () => {
  assert.deepEqual(
    APP_SHORTCUTS.map((s) => s.name),
    ['New Sale', 'Customers', 'Receipts', 'Products', 'Reports'],
  )
  for (const s of APP_SHORTCUTS) {
    assert.ok(s.name.length > 0 && s.name.length <= 30, 'name ছোট ও অখালি')
    assert.ok(s.shortName.length > 0 && s.shortName.length <= 12, 'short_name ≤ ১২ অক্ষর')
    assert.ok(s.description.length > 0, 'description অখালি')
    assert.ok(s.path.startsWith('/'), `path অ্যাবসল্যুট: ${s.path}`)
  }
})

/* ── ২) ম্যানিফেস্ট-অ্যারে: name/short_name/description/url/icons ── */
test('buildAppShortcuts ম্যানিফেস্ট-রেডি অ্যারে দেয় (root base)', () => {
  const shortcuts = buildAppShortcuts('/')
  assert.equal(shortcuts.length, 5)
  assert.deepEqual(
    shortcuts.map((s) => s.url),
    ['/sales', '/customers', '/expenses', '/stock', '/reports'],
  )
  for (const [i, s] of shortcuts.entries()) {
    assert.equal(s.name, APP_SHORTCUTS[i].name)
    assert.equal(s.short_name, APP_SHORTCUTS[i].shortName)
    assert.equal(s.description, APP_SHORTCUTS[i].description)
    assert.deepEqual(
      s.icons.map((ic) => ic.sizes),
      ['96x96', '192x192'],
    )
    for (const ic of s.icons) {
      assert.equal(ic.type, 'image/png')
      assert.ok(!ic.src.startsWith('/') && !ic.src.includes('://'), `আইকন src রিলেটিভ: ${ic.src}`)
    }
  }
})

test('GitHub Pages base-এ url গুলো scope-এর ভিতরে থাকে', () => {
  const shortcuts = buildAppShortcuts('/ShopLedGer/')
  assert.deepEqual(
    shortcuts.map((s) => s.url),
    [
      '/ShopLedGer/sales',
      '/ShopLedGer/customers',
      '/ShopLedGer/expenses',
      '/ShopLedGer/stock',
      '/ShopLedGer/reports',
    ],
  )
  // joinBase-এর ডাবল-স্ল্যাশ প্রতিরোধ
  assert.equal(joinBase('/ShopLedGer', '/sales'), '/ShopLedGer/sales')
  assert.equal(joinBase('/', 'sales'), '/sales')
})

/* ── ৩) আইকন ফাইল: public/-এ আছে, সঠিক মাপ, আসল কন্টেন্ট ── */
test('প্রতিটি শর্টকাটের 96 ও 192 আইকন public/-এ বৈধ PNG', () => {
  for (const s of APP_SHORTCUTS) {
    for (const size of SHORTCUT_ICON_SIZES) {
      const file = join(ROOT, 'public', 'shortcuts', `${s.key}-${size}.png`)
      assert.ok(existsSync(file), `${file} নেই — node scripts/generate-shortcut-icons.mjs চালান`)
      const png = readPng(file)
      assert.equal(png.width, size, `${file} প্রস্থ`)
      assert.equal(png.height, size, `${file} উচ্চতা`)
      assert.equal(png.bitDepth, 8)
      const ratio = inkRatio(png)
      assert.ok(ratio > 0.02 && ratio < 0.6, `${file}-এ গ্লিফ-কভারেজ অস্বাভাবিক (${ratio.toFixed(3)})`)
    }
  }
})

/* ── ৪) প্রতিটি শর্টকাট-URL অ্যাপে রেজিস্টার্ড রাউট (ফাঁকা পেজ/রাউটিং এরর রুখতে) ── */
test('শর্টকাটের প্রতিটি path App.tsx-এ রেজিস্টার্ড রাউট', () => {
  const app = readFileSync(join(ROOT, 'src', 'App.tsx'), 'utf8')
  for (const s of APP_SHORTCUTS) {
    const segment = s.path.replace(/^\//, '')
    assert.ok(
      app.includes(`path="${segment}"`),
      `App.tsx-এ route নেই: ${s.path} (শর্টকাট ${s.name})`,
    )
  }
})

/* ── ৫) vite.config আসলেই ম্যানিফেস্টে shortcuts বসায় ── */
test('vite.config.ts ম্যানিফেস্টে buildAppShortcuts যুক্ত করে', () => {
  const cfg = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8')
  assert.ok(cfg.includes("from './src/lib/pwaShortcuts'"), 'কনফিগ মডিউলটি ইমপোর্ট করে')
  assert.ok(cfg.includes('shortcuts: buildAppShortcuts(base)'), 'ম্যানিফেস্টে shortcuts অ্যারে বসে')
})

/* ── ৬) বিল্ড আর্টিফ্যাক্ট (dist থাকলে): ম্যানিফেস্ট + প্রিক্যাশ + SPA ফলব্যাক ── */
test('বিল্ড হলে dist-এ shortcuts ঠিকমতো বসে ও প্রিক্যাশ হয়', (t) => {
  const manifestFile = join(ROOT, 'dist', 'manifest.webmanifest')
  if (!existsSync(manifestFile)) {
    t.skip('dist/ নেই — npm run build চালান')
    return
  }
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as {
    shortcuts?: Array<{ name: string; short_name: string; description: string; url: string; icons: { src: string; sizes: string; type: string }[] }>
  }
  assert.ok(manifest.shortcuts, 'ম্যানিফেস্টে shortcuts অ্যারে আছে')
  assert.equal(manifest.shortcuts!.length, 5)

  const root = buildAppShortcuts('/')
  const pages = buildAppShortcuts('/ShopLedGer/')
  const sw = readFileSync(join(ROOT, 'dist', 'sw.js'), 'utf8')
  const indexHtml = readFileSync(join(ROOT, 'dist', 'index.html'), 'utf8')
  assert.ok(indexHtml.includes('rel="manifest"'), 'index.html ম্যানিফেস্ট লিংক করে')

  for (const [i, s] of manifest.shortcuts!.entries()) {
    // dist যে base-এ বিল্ড হয়েছে তার সাথে url মেলানো
    const expected = root[i].url
    const expectedPages = pages[i].url
    assert.ok(
      s.url === expected || s.url === expectedPages,
      `শর্টকাট url অজানা base-এ: ${s.url}`,
    )
    const base = s.url === expectedPages ? '/ShopLedGer/' : '/'
    assert.ok(s.url.startsWith(base), `${s.name}: url base (${base})-এর ভিতরে`)
    for (const ic of s.icons) {
      const distIcon = join(ROOT, 'dist', ic.src)
      assert.ok(existsSync(distIcon), `dist-এ আইকন নেই: ${ic.src}`)
      const png = readPng(distIcon)
      const [w, h] = ic.sizes.split('x').map(Number)
      assert.equal(png.width, w)
      assert.equal(png.height, h)
      assert.ok(sw.includes(ic.src), `সার্ভিস-ওয়ার্কার আইকন প্রিক্যাশ করে: ${ic.src}`)
    }
  }
})
