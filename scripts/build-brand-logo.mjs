/**
 * কর্ণফুলী সেলস সেন্টার — ব্র্যান্ড লোগো জেনারেটর।
 *
 * লোগো PNG গুলো `public/brand/`-এ তৈরি করে (মার্ক, মনো মার্ক, লকআপ)।
 * দরকার শুধু লোগো বদলাতে/রিজেনারেট করতে হলেই — অ্যাপ চালাতে এই ডিপেন্ডেন্সি লাগে না।
 *
 *   npm i --no-save @napi-rs/canvas @expo-google-fonts/noto-sans-bengali
 *   node scripts/build-brand-logo.mjs
 *
 * বাংলা টেক্সট সঠিকভাবে জোড়া লাগানোর জন্য (র্ণ/ফু/সেন্টার) Noto Sans Bengali ব্যবহার করে
 * Skia-র টেক্সট শেপিং ব্যবহার করা হয়েছে।
 */
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

GlobalFonts.registerFromPath(
  'node_modules/@expo-google-fonts/noto-sans-bengali/700Bold/NotoSansBengali_700Bold.ttf',
  'NotoBnBold',
)
GlobalFonts.registerFromPath(
  'node_modules/@expo-google-fonts/noto-sans-bengali/600SemiBold/NotoSansBengali_SemiBold.ttf',
  'NotoBnSemi',
)

const TEAL = '#04795a' // অ্যাপের ব্র্যান্ড সবুজ
const TEAL_DARK = '#036148'
const AMBER = '#f0a020'
const WHITE = '#ffffff'
const INK = '#111827'

/* ── মাছ + নদীর ঢেউ + ধানের শীষ — গোল ব্যাজের ভিতরে ── */
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

  /* নদীর ঢেউ (কর্ণফুলী) — নিচের অংশে ২টি ঢেউ */
  const wave = (yBase, amp, period, phase, width) => {
    ctx.lineWidth = width
    ctx.beginPath()
    const x0 = 74 * s
    const x1 = 438 * s
    for (let x = x0; x <= x1; x += 3 * s) {
      const t = ((x - x0) / (x1 - x0)) * period * Math.PI * 2 + phase
      const y = yBase + Math.sin(t) * amp
      if (x === x0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  wave(344 * s, 15 * s, 2, 0, 17 * s)
  wave(386 * s, 11 * s, 2, Math.PI * 0.95, 12 * s)

  /* মাছ — ডানদিকে মুখ করে (দেহ আগে আঁকা হয়নি, পাখনা/লেজ আগে) */
  const fx = 226 * s
  const fy = 198 * s
  const L = 224 * s
  const H = 124 * s
  const noseX = fx + L / 2
  const tailX = fx - L / 2 + 26 * s

  // লেজ (দেহের নিচে — জোড়া লাগবে বলে ভিতর পর্যন্ত)
  ctx.beginPath()
  ctx.moveTo(tailX + 62 * s, fy)
  ctx.lineTo(tailX - 52 * s, fy - 50 * s)
  ctx.lineTo(tailX - 34 * s, fy)
  ctx.lineTo(tailX - 52 * s, fy + 50 * s)
  ctx.closePath()
  ctx.fill()

  // পিঠের পাখনা
  ctx.beginPath()
  ctx.moveTo(fx - 30 * s, fy - H * 0.2)
  ctx.quadraticCurveTo(fx + 2 * s, fy - H * 0.92, fx + 52 * s, fy - H * 0.18)
  ctx.closePath()
  ctx.fill()

  // পেটের পাখনা
  ctx.beginPath()
  ctx.moveTo(fx - 26 * s, fy + H * 0.18)
  ctx.quadraticCurveTo(fx + 6 * s, fy + H * 0.78, fx + 44 * s, fy + H * 0.16)
  ctx.closePath()
  ctx.fill()

  // দেহ
  ctx.beginPath()
  ctx.moveTo(noseX, fy)
  ctx.quadraticCurveTo(fx + 14 * s, fy - H * 0.6, tailX - 10 * s, fy)
  ctx.quadraticCurveTo(fx + 14 * s, fy + H * 0.6, noseX, fy)
  ctx.closePath()
  ctx.fill()

  // চোখ (বডির রঙে ফুটো)
  ctx.beginPath()
  ctx.arc(noseX - 46 * s, fy - H * 0.13, 10.5 * s, 0, Math.PI * 2)
  ctx.fillStyle = body
  ctx.fill()
  ctx.fillStyle = art

  /* ধানের শীষ — উপরে ডানদিকে ছোট করে (অ্যাম্বার) */
  const gx = 358 * s
  const gy = 158 * s
  ctx.strokeStyle = grain
  ctx.fillStyle = grain
  ctx.lineWidth = 7 * s
  ctx.beginPath()
  ctx.moveTo(gx - 22 * s, gy + 42 * s)
  ctx.quadraticCurveTo(gx + 4 * s, gy + 6 * s, gx + 20 * s, gy - 44 * s)
  ctx.stroke()

  const grains = [
    [gx - 24 * s, gy + 22 * s, -30],
    [gx - 8 * s, gy - 4 * s, -18],
    [gx + 8 * s, gy - 30 * s, -6],
    [gx + 22 * s, gy - 50 * s, 2],
  ]
  for (const [x, y, rot] of grains) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate((rot * Math.PI) / 180)
    ctx.beginPath()
    ctx.ellipse(0, 0, 16 * s, 7 * s, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

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
    ctx.fillText('ফিড • পোল্ট্রি • ফিশারিজ সরবরাহ', textX, 226)

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

  console.log('লোগো তৈরি হয়েছে — public/brand/')
}

main()
