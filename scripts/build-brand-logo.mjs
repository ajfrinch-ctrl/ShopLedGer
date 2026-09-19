/**
 * কর্ণফুলী সেলস সেন্টার — ব্র্যান্ড লোগো ও অ্যাপ আইকন জেনারেটর।
 *
 * লোগো PNG গুলো `public/brand/`-এ তৈরি করে (মার্ক, মনো মার্ক, লকআপ),
 * সাথে অ্যাপের আইকনগুলোও (`public/logo.png`, `favicon.png`, `apple-touch-icon.png`,
 * `pwa-192x192.png`, `pwa-512x512.png`) একই মার্ক থেকে বানায়।
 * দরকার শুধু লোগো বদলাতে/রিজেনারেট করতে হলেই — অ্যাপ চালাতে এই ডিপেন্ডেন্সি লাগে না।
 *
 *   npm i --no-save @napi-rs/canvas @expo-google-fonts/noto-sans-bengali
 *   node scripts/build-brand-logo.mjs
 *
 * বাংলা টেক্সট সঠিকভাবে জোড়া লাগানোর জন্য (র্ণ/ফু/সেন্টার) Noto Sans Bengali ব্যবহার করে
 * Skia-র টেক্সট শেপিং ব্যবহার করা হয়েছে।
 */
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

GlobalFonts.registerFromPath(
  'node_modules/@expo-google-fonts/noto-sans-bengali/700Bold/NotoSansBengali_700Bold.ttf',
  'NotoBnBold',
)
GlobalFonts.registerFromPath(
  'node_modules/@expo-google-fonts/noto-sans-bengali/600SemiBold/NotoSansBengali_600SemiBold.ttf',
  'NotoBnSemi',
)

const TEAL = '#04795a' // অ্যাপের ব্র্যান্ড সবুজ
const TEAL_DARK = '#036148'
const AMBER = '#f0a020'
const WHITE = '#ffffff'
const INK = '#111827'

/* ── গরুর মাথা (সামনের দিক থেকে) + খাদ্যের গামলায় দানা — গোল ব্যাজের ভিতরে ──
 *
 * প্রতিষ্ঠান গবাদি পশুর খাদ্য বিক্রেতা — তাই মার্কে গরুর মাথা (শিং-কানসহ) আর
 * নিচে খাদ্যের গামলা, যাতে দানা (ভুট্টা/খৈল/ভাতের কুড়া) ভরা — সবই ব্র্যান্ড
 * সবুজের গোল ব্যাজে, আগের মতোই এক রঙের (সাদা) আর্টওয়ার্কে।
 */
function drawMark(ctx, size, { ring = TEAL, body = TEAL, art = WHITE, grain = AMBER } = {}) {
  const s = size / 512
  const cx = 256 * s
  const cy = 256 * s

  ctx.save()
  // ব্যাজ (গোলাকার)
  ctx.beginPath()
  ctx.arc(cx, cy, 240 * s, 0, Math.PI * 2)
  ctx.fillStyle = body
  ctx.fill()
  if (ring !== body) {
    ctx.lineWidth = 18 * s
    ctx.strokeStyle = ring
    ctx.stroke()
  }

  // ভিতরের সব আর্টওয়ার্ক ব্যাজের গোলের মধ্যে সীমাবদ্ধ
  ctx.beginPath()
  ctx.arc(cx, cy, 240 * s, 0, Math.PI * 2)
  ctx.clip()

  ctx.fillStyle = art
  ctx.strokeStyle = art
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  /* শিং — দুই পাশ থেকে উপরে-বাইরের দিকে বাঁকানো (গরুর চেনা প্রোফাইল; মাথার পেছনে) */
  const horn = (mirror) => {
    ctx.save()
    if (mirror) {
      ctx.translate(512 * s, 0)
      ctx.scale(-1, 1)
    }
    ctx.beginPath()
    ctx.moveTo(226 * s, 138 * s) // গোড়া (বাইরের কোণ) — মাথার ভিতরে লুকানো
    ctx.quadraticCurveTo(148 * s, 116 * s, 124 * s, 76 * s) // বাইরের ধার → ডগা
    ctx.quadraticCurveTo(164 * s, 112 * s, 234 * s, 92 * s) // ভিতরের ধার → গোড়া
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  horn(false)
  horn(true)

  /* কান — দুই পাশে ঝুলে থাকা (শিংয়ের নিচে, মাথার পেছনে) */
  const ear = (mirror) => {
    ctx.save()
    if (mirror) {
      ctx.translate(512 * s, 0)
      ctx.scale(-1, 1)
    }
    ctx.beginPath()
    ctx.ellipse(150 * s, 184 * s, 46 * s, 21 * s, (-24 * Math.PI) / 180, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  ear(false)
  ear(true)

  /* মাথা — কপাল, মুখের নাকালি ও থুতনি মিলেমিশে এক টুকরো সাদা সিলুয়েট */
  ctx.beginPath()
  ctx.ellipse(256 * s, 184 * s, 92 * s, 82 * s, 0, 0, Math.PI * 2) // কপাল
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(256 * s, 240 * s, 68 * s, 48 * s, 0, 0, Math.PI * 2) // মুখের নাকালি
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(256 * s, 278 * s, 56 * s, 48 * s, 0, 0, Math.PI * 2) // থুতনি/মুখের নিচের অংশ
  ctx.fill()

  /* চোখ (বডির রঙে ফুটো) */
  for (const ex of [222, 290]) {
    ctx.beginPath()
    ctx.arc(ex * s, 186 * s, 10 * s, 0, Math.PI * 2)
    ctx.fillStyle = body
    ctx.fill()
    ctx.fillStyle = art
  }

  /* নাকের দুই ছিদ্র (বডির রঙে ফুটো) */
  for (const nx of [238, 274]) {
    ctx.beginPath()
    ctx.arc(nx * s, 278 * s, 8.5 * s, 0, Math.PI * 2)
    ctx.fillStyle = body
    ctx.fill()
    ctx.fillStyle = art
  }

  /* খাদ্যের দানা — গামলায় চাপা দানার স্তুপ + উপরে ছিটকে পড়া কয়েককণা (অ্যাম্বার) */
  ctx.fillStyle = grain
  ctx.beginPath()
  ctx.ellipse(256 * s, 366 * s, 54 * s, 15 * s, 0, 0, Math.PI * 2) // দানার স্তুপ
  ctx.fill()
  for (const [dx, dy] of [
    [240, 334],
    [272, 334],
    [224, 346],
    [288, 346],
  ]) {
    ctx.beginPath()
    ctx.arc(dx * s, dy * s, 7 * s, 0, Math.PI * 2)
    ctx.fill()
  }

  /* খাদ্যের গামলা — চওড়া পাত্রের রেখা, দানার স্তুপের উপর দিয়ে (দানা ভরা মনে হয়) */
  ctx.strokeStyle = art
  ctx.lineWidth = 15 * s
  ctx.beginPath()
  ctx.moveTo(154 * s, 384 * s)
  ctx.lineTo(358 * s, 384 * s)
  ctx.lineTo(334 * s, 428 * s)
  ctx.lineTo(178 * s, 428 * s)
  ctx.closePath()
  ctx.stroke()

  ctx.restore()
}

/* মার্ক + বাংলা নাম + ইংরেজি — লকআপ (অ্যাপ/লগইন ব্র্যান্ডিংয়ের জন্য) */
async function buildLockup(showText = true) {
  const W = 1200
  const H = 380
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  ctx.save()
  ctx.translate(24, 30)
  drawMark(ctx, 320, {})
  ctx.restore()

  if (showText) {
    const textX = 376
    ctx.fillStyle = TEAL_DARK
    ctx.font = '96px NotoBnBold'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText('কর্ণফুলী সেলস সেন্টার', textX, 168)

    ctx.fillStyle = TEAL
    ctx.font = '600 34px NotoBnSemi'
    ctx.fillText('গবাদি পশুর খাদ্য সরবরাহ', textX, 226)

    // ইংরেজি (letter-spaced, হাতে)
    const label = 'KARNAPHULI SALES CENTER'
    ctx.font = '600 28px NotoBnSemi'
    ctx.fillStyle = AMBER
    let x = textX
    for (const ch of label) {
      ctx.fillText(ch, x, 288)
      x += ctx.measureText(ch).width + 6
    }
  }

  return canvas
}

/* মার্কটিকে নির্দিষ্ট ক্যানভাসের মাঝখানে ছোট করে আঁকা (অ্যাপ আইকনের জন্য) */
function drawMarkCentered(ctx, canvasSize, markSize, opts = {}) {
  ctx.save()
  ctx.translate((canvasSize - markSize) / 2, (canvasSize - markSize) / 2)
  drawMark(ctx, markSize, opts)
  ctx.restore()
}

async function main() {
  mkdirSync('public/brand', { recursive: true })

  // ১) কেবল মার্ক — স্বচ্ছ ব্যাকগ্রাউন্ড (প্যাড/লেটারহেডে ব্যবহার)
  for (const size of [512, 192]) {
    const canvas = createCanvas(size, size)
    const ctx = canvas.getContext('2d')
    drawMark(ctx, size, {})
    writeFileSync(`public/brand/karnaphuli-mark${size === 512 ? '' : '-192'}.png`, canvas.toBuffer('image/png'))
  }

  // ২) এক রঙের (কালি) মার্ক — সাদা-কালো ছাপার জন্য
  const mono = createCanvas(512, 512)
  const mctx = mono.getContext('2d')
  drawMark(mctx, 512, { body: INK, ring: INK, art: WHITE, grain: '#9ca3af' })
  writeFileSync('public/brand/karnaphuli-mark-mono.png', mono.toBuffer('image/png'))

  // ৩) লকআপ — মার্ক + নাম
  const lockup = await buildLockup()
  writeFileSync('public/brand/karnaphuli-lockup.png', lockup.toBuffer('image/png'))

  // ৪) অ্যাপ আইকন — সবগুলোই একই মার্ক থেকে
  //    - logo.png (লগইন/রেজিস্টার পেজ, সাদা কার্ডের ভিতরে বসে) — স্বচ্ছ ব্যাকগ্রাউন্ড
  //    - favicon.png — ব্রাউজার ট্যাব
  //    - apple-touch-icon.png — iOS হোম-স্ক্রিন (সাদা ব্যাকগ্রাউন্ড)
  //    - pwa-192x192.png / pwa-512x512.png — ইনস্টল করা অ্যাপের আইকন
  //      (মাস্কেবল: পুরো স্কয়ার সাদা, মার্ক মাঝখানে — কোণ কাটা গেলেও মার্ক অক্ষত)
  const appIcons = [
    ['public/logo.png', 256, null, 0.94],
    ['public/favicon.png', 64, null, 0.94],
    ['public/apple-touch-icon.png', 180, WHITE, 0.88],
    ['public/pwa-192x192.png', 192, WHITE, 0.86],
    ['public/pwa-512x512.png', 512, WHITE, 0.86],
  ]
  for (const [file, size, bg, markScale] of appIcons) {
    const canvas = createCanvas(size, size)
    const ctx = canvas.getContext('2d')
    if (bg) {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, size, size)
    }
    drawMarkCentered(ctx, size, size * markScale, {})
    writeFileSync(file, canvas.toBuffer('image/png'))
  }

  console.log('লোগো ও অ্যাপ আইকন তৈরি হয়েছে — public/brand/ ও public/')
}

main()
