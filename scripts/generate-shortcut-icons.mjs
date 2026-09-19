#!/usr/bin/env node
/* PWA অ্যাপ-শর্টকাট আইকন জেনারেটর (শুধু Node বিল্ট-ইন: zlib/fs/path — কোনো লাইব্রেরি নেই)।

   কাজ: lucide-স্টাইল 24×24 SVG পাথ ডেটা (অ্যাপে ইতিমধ্যে ব্যবহৃত আইকনগুলোর হুবহু কপি)
   নিয়ে সুপার-স্যাম্পল করা স্ট্রোক-কভারেজ বাফারে রাস্টারাইজ করে, তারপর box-downsample করে
   অ্যান্টি-অ্যালাইসড PNG (RGBA, স্বচ্ছ ব্যাকগ্রাউন্ড + ব্র্যান্ড সবুজ গ্লিফ) লেখে।

   আউটপুট: public/shortcuts/<key>-<size>.png   (96 ও 192 — Chrome-এর সুপারিশ অনুযায়ী)
   চালান: node scripts/generate-shortcut-icons.mjs
*/
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'public', 'shortcuts')
const SIZES = [96, 192]

/* ব্র্যান্ড রঙ — index.html-এর theme-color / হেডার লোগোর সবুজ (#04795a) */
const GLYPH_RGB = [0x04, 0x79, 0x5a]

/* lucide-react v0.441 থেকে নেওয়া আইকন জ্যামিতি (ISC লাইসেন্স) — অ্যাপের UI-তে
   ঠিক এই আইকনগুলোই সংশ্লিষ্ট সেকশনের পাশে ব্যবহৃত হয়:
     ShoppingCart → বিক্রি, Users → ক্রেতা, Receipt → খরচ এন্ট্রি,
     Package → স্টক, BarChart3 → রিপোর্ট সেন্টার */
const GLYPHS = {
  'new-sale': [
    { tag: 'circle', cx: 8, cy: 21, r: 1 },
    { tag: 'circle', cx: 19, cy: 21, r: 1 },
    { tag: 'path', d: 'M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12' },
  ],
  customers: [
    { tag: 'path', d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' },
    { tag: 'circle', cx: 9, cy: 7, r: 4 },
    { tag: 'path', d: 'M22 21v-2a4 4 0 0 0-3-3.87' },
    { tag: 'path', d: 'M16 3.13a4 4 0 0 1 0 7.75' },
  ],
  receipts: [
    { tag: 'path', d: 'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z' },
    { tag: 'path', d: 'M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8' },
    { tag: 'path', d: 'M12 17.5v-11' },
  ],
  products: [
    { tag: 'path', d: 'm7.5 4.27 9 5.15' },
    { tag: 'path', d: 'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z' },
    { tag: 'path', d: 'm3.3 7 8.7 5 8.7-5' },
    { tag: 'path', d: 'M12 22V12' },
  ],
  reports: [
    { tag: 'path', d: 'M3 3v16a2 2 0 0 0 2 2h16' },
    { tag: 'path', d: 'M18 17V9' },
    { tag: 'path', d: 'M13 17V5' },
    { tag: 'path', d: 'M8 17v-3' },
  ],
}

const VIEWBOX = 24 // lucide-এর viewBox
const STROKE = 2 // lucide-এর ডিফল্ট stroke-width
const SS = 4 // সুপার-স্যাম্পল ফ্যাক্টর (অ্যান্টি-অ্যালাসিং)

/* ─────────────────────────  SVG পাথ পার্স + ফ্ল্যাটেন  ───────────────────────── */

function tokenize(d) {
  const tokens = []
  const re = /([a-zA-Z])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/gi
  let m
  while ((m = re.exec(d))) tokens.push(m[1] ? m[1] : parseFloat(m[2]))
  return tokens
}

/** এলিপ্টিকাল আর্ক (A/a) → কেন্দ্র-প্যারামিটারাইজেশন → পয়েন্ট তালিকা */
function arcPoints(x1, y1, rx, ry, phiDeg, largeArc, sweep, x2, y2) {
  const phi = (phiDeg * Math.PI) / 180
  const cosP = Math.cos(phi)
  const sinP = Math.sin(phi)
  const dx = (x1 - x2) / 2
  const dy = (y1 - y2) / 2
  const x1p = cosP * dx + sinP * dy
  const y1p = -sinP * dx + cosP * dy
  rx = Math.abs(rx)
  ry = Math.abs(ry)
  if (rx === 0 || ry === 0) return [{ x: x2, y: y2 }]
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
  if (lambda > 1) {
    const s = Math.sqrt(lambda)
    rx *= s
    ry *= s
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
  const co = Math.sqrt(Math.max(0, den === 0 ? 0 : num / den)) * (largeArc === sweep ? -1 : 1)
  const cxp = (co * rx * y1p) / ry
  const cyp = (-co * ry * x1p) / rx
  const cx = cosP * cxp - sinP * cyp + (x1 + x2) / 2
  const cy = sinP * cxp + cosP * cyp + (y1 + y2) / 2
  const angle = (ux, uy, vx, vy) => {
    const dot = ux * vx + uy * vy
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy)
    let a = Math.acos(Math.min(1, Math.max(-1, len === 0 ? 1 : dot / len)))
    if (ux * vy - uy * vx < 0) a = -a
    return a
  }
  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
  let delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
  if (!sweep && delta > 0) delta -= 2 * Math.PI
  else if (sweep && delta < 0) delta += 2 * Math.PI
  const steps = Math.max(8, Math.ceil((Math.abs(delta) / (Math.PI / 2)) * 12))
  const pts = []
  for (let i = 1; i <= steps; i++) {
    const t = theta1 + (delta * i) / steps
    const xr = rx * Math.cos(t)
    const yr = ry * Math.sin(t)
    pts.push({ x: cosP * xr - sinP * yr + cx, y: sinP * xr + cosP * yr + cy })
  }
  return pts
}

/** পাথ-ডেটা → সাবপাথের তালিকা; প্রতিটি সাবপাথ পয়েন্টের তালিকা + closed ফ্ল্যাগ */
function flattenPath(d) {
  const t = tokenize(d)
  const subpaths = []
  let cur = []
  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  let prevCtrl = null
  let cmd = null
  let i = 0

  const push = (px, py) => {
    if (!cur.length) cur.push({ x, y })
    cur.push({ x: px, y: py })
    x = px
    y = py
    prevCtrl = null
  }
  const finish = (closed) => {
    if (cur.length > 1) subpaths.push({ points: cur, closed })
    cur = []
  }

  const argCount = { M: 2, m: 2, L: 2, l: 2, H: 1, h: 1, V: 1, v: 1, C: 6, c: 6, S: 4, s: 4, Q: 4, q: 4, T: 2, t: 2, A: 7, a: 7, Z: 0, z: 0 }

  while (i < t.length) {
    if (typeof t[i] === 'string') cmd = t[i++]
    if (!cmd) break
    const rel = cmd === cmd.toLowerCase()
    const C = cmd.toUpperCase()
    const n = argCount[C] ?? 0
    const a = []
    for (let k = 0; k < n; k++) a.push(typeof t[i] === 'number' ? t[i++] : 0)
    const X = (v) => (rel ? x + v : v)
    const Y = (v) => (rel ? y + v : v)

    if (C === 'M') {
      if (cur.length > 1) finish(false)
      x = X(a[0])
      y = Y(a[1])
      startX = x
      startY = y
      cur = [{ x, y }]
      cmd = rel ? 'l' : 'L'
    } else if (C === 'L') {
      push(X(a[0]), Y(a[1]))
    } else if (C === 'H') {
      push(X(a[0]), y)
    } else if (C === 'V') {
      push(x, Y(a[0]))
    } else if (C === 'C') {
      const p1 = { x: X(a[0]), y: Y(a[1]) }
      const p2 = { x: X(a[2]), y: Y(a[3]) }
      const p3 = { x: X(a[4]), y: Y(a[5]) }
      cur.push(...cubic({ x, y }, p1, p2, p3))
      x = p3.x
      y = p3.y
      prevCtrl = p2
    } else if (C === 'S') {
      const p1 = prevCtrl ? { x: 2 * x - prevCtrl.x, y: 2 * y - prevCtrl.y } : { x, y }
      const p2 = { x: X(a[0]), y: Y(a[1]) }
      const p3 = { x: X(a[2]), y: Y(a[3]) }
      cur.push(...cubic({ x, y }, p1, p2, p3))
      x = p3.x
      y = p3.y
      prevCtrl = p2
    } else if (C === 'Q') {
      const p1 = { x: X(a[0]), y: Y(a[1]) }
      const p2 = { x: X(a[2]), y: Y(a[3]) }
      cur.push(...quadratic({ x, y }, p1, p2))
      prevCtrl = p1
      x = p2.x
      y = p2.y
    } else if (C === 'T') {
      const p1 = prevCtrl ? { x: 2 * x - prevCtrl.x, y: 2 * y - prevCtrl.y } : { x, y }
      const p2 = { x: X(a[0]), y: Y(a[1]) }
      cur.push(...quadratic({ x, y }, p1, p2))
      prevCtrl = p1
      x = p2.x
      y = p2.y
    } else if (C === 'A') {
      const pts = arcPoints(x, y, a[0], a[1], a[2], a[3], a[4], X(a[5]), Y(a[6]))
      cur.push(...pts)
      x = X(a[5])
      y = Y(a[6])
      prevCtrl = null
    } else if (C === 'Z') {
      if (cur.length && (x !== startX || y !== startY)) cur.push({ x: startX, y: startY })
      finish(true)
      x = startX
      y = startY
    }
  }
  finish(false)
  return subpaths
}

function cubic(p0, p1, p2, p3) {
  const steps = 24
  const out = []
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const mt = 1 - t
    out.push({
      x: mt ** 3 * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t ** 3 * p3.x,
      y: mt ** 3 * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t ** 3 * p3.y,
    })
  }
  return out
}

function quadratic(p0, p1, p2) {
  const steps = 18
  const out = []
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const mt = 1 - t
    out.push({
      x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
      y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
    })
  }
  return out
}

function circleSubpath(cx, cy, r) {
  const steps = 48
  const points = []
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    points.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return { points, closed: true }
}

/** আইকন-জ্যামিতি → ফ্ল্যাট সাবপাথ তালিকা */
function glyphGeometry(shapes) {
  return shapes.flatMap((s) => (s.tag === 'circle' ? [circleSubpath(s.cx, s.cy, s.r)] : flattenPath(s.d)))
}

/* ─────────────────────────  রাস্টারাইজেশন  ───────────────────────── */

function boundsOf(subpaths, pad) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const sp of subpaths)
    for (const p of sp.points) {
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
    }
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad }
}

function renderGlyph(subpaths, size) {
  const margin = Math.round(size * 0.08) // চারপাশে ফাঁকা জায়গা
  const inner = size - margin * 2
  const b = boundsOf(subpaths, STROKE / 2)
  const gw = Math.max(1e-6, b.maxX - b.minX)
  const gh = Math.max(1e-6, b.maxY - b.minY)
  const scale = Math.min(inner / gw, inner / gh) * (VIEWBOX / VIEWBOX)
  const offX = margin + (inner - gw * scale) / 2 - b.minX * scale
  const offY = margin + (inner - gh * scale) / 2 - b.minY * scale
  const strokeR = (STROKE * scale * SS) / 2

  const W = size * SS
  const H = size * SS
  const cov = new Float32Array(W * H)

  // প্রতিটি সেগমেন্ট = ক্যাপসুল (রাউন্ড ক্যাপ/জয়েন) — একই রঙ বলে "over" কম্পোজিটিং
  const paint = (ax, ay, bx, by) => {
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy || 1e-9
    const pad = strokeR + 1
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - pad))
    const x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + pad))
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - pad))
    const y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by) + pad))
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const sx = px + 0.5
        const sy = py + 0.5
        let t = ((sx - ax) * dx + (sy - ay) * dy) / len2
        t = t < 0 ? 0 : t > 1 ? 1 : t
        const ex = ax + dx * t
        const ey = ay + dy * t
        const dist = Math.hypot(sx - ex, sy - ey)
        const a = Math.min(1, Math.max(0, strokeR + 0.5 - dist))
        if (a > 0) {
          const idx = py * W + px
          cov[idx] = cov[idx] + a * (1 - cov[idx])
        }
      }
    }
  }

  for (const sp of subpaths) {
    const pts = sp.points.map((p) => ({ x: p.x * scale * SS + offX * SS, y: p.y * scale * SS + offY * SS }))
    for (let i = 0; i < pts.length - 1; i++) paint(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)
    if (sp.closed && pts.length > 2) paint(pts[pts.length - 1].x, pts[pts.length - 1].y, pts[0].x, pts[0].y)
  }

  // ডাউন-স্যাম্পল (box filter) → RGBA বাফার
  const rgba = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) sum += cov[(y * SS + sy) * W + (x * SS + sx)]
      const a = Math.round((sum / (SS * SS)) * 255)
      const o = (y * size + x) * 4
      rgba[o] = GLYPH_RGB[0]
      rgba[o + 1] = GLYPH_RGB[1]
      rgba[o + 2] = GLYPH_RGB[2]
      rgba[o + 3] = a
    }
  }
  return rgba
}

/* ─────────────────────────  PNG এনকোডার (zlib)  ───────────────────────── */

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ─────────────────────────  চালু  ───────────────────────── */

mkdirSync(OUT_DIR, { recursive: true })
const written = []
for (const [key, shapes] of Object.entries(GLYPHS)) {
  const subpaths = glyphGeometry(shapes)
  for (const size of SIZES) {
    const file = join(OUT_DIR, `${key}-${size}.png`)
    writeFileSync(file, encodePng(size, renderGlyph(subpaths, size)))
    written.push(`public/shortcuts/${key}-${size}.png`)
  }
}
console.log(`✓ ${written.length} shortcut icons →\n  ${written.join('\n  ')}`)
