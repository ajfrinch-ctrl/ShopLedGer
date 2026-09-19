// ui.css / ui.js ডিজাইন-মকআপের স্মোক টেস্ট (DOM-এ রেন্ডার করে গঠন যাচাই)
// চালান: npm run test:ui-design
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Window } from 'happy-dom'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// --- ছোটখাটো ব্রাউজার এনভায়রনমেন্ট গড়ে তোলা ---
const win = new Window({ url: 'http://localhost/ui.html' })
const ls = new Map()
const stub = (key, value) => {
  if (key in globalThis) { try { delete globalThis[key] } catch { /* ignore */ } }
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
}
stub('window', win)
stub('document', win.document)
stub('self', globalThis)
stub('location', win.location)
stub('localStorage', {
  getItem: (k) => ls.get(k) ?? null,
  setItem: (k, v) => void ls.set(k, String(v)),
  removeItem: (k) => void ls.delete(k),
  clear: () => ls.clear(),
})
stub('navigator', { onLine: true, userAgent: 'node', language: 'bn-BD' })
Object.defineProperty(win, 'localStorage', { value: globalThis.localStorage, configurable: true })

document.body.innerHTML = '<div class="app" id="app"></div>'

// --- ui.js লোড ও রেন্ডার ---
const uiJs = readFileSync(join(root, 'ui.js'), 'utf8')
const uiCss = readFileSync(join(root, 'ui.css'), 'utf8')
const uiHtml = readFileSync(join(root, 'ui.html'), 'utf8')
;(0, eval)(uiJs)

const UI = globalThis.ShopLedgerUI
assert.ok(UI, 'ShopLedgerUI গ্লোবাল এক্সপোর্ট পাওয়া যায়নি')
UI.mount(UI.CONFIG)

const app = document.getElementById('app')
const q = (sel) => app.querySelectorAll(sel)

test('header: লোগো, অ্যাপের নাম, সাবটাইটেল, স্ট্যাটাস পিল ও hamburger থাকে', () => {
  assert.equal(q('.header').length, 1)
  assert.equal(q('.logo svg').length, 1)
  assert.equal(app.querySelector('.app-name').textContent, 'ShopLedGer')
  assert.equal(app.querySelector('.app-sub').textContent, 'দোকান হিসাব')
  const pill = app.querySelector('.pill')
  assert.ok(pill, 'স্ট্যাটাস পিল নেই')
  assert.ok(pill.querySelector('.pill-dot'), 'পিলের ডট নেই')
  assert.equal(pill.querySelector('.pill-text').textContent, 'অনলাইন')
  assert.equal(q('.hamburger').length, 1)
})

test('সামারি কার্ড: টাইটেল + তারিখ + ৩টি প্যাস্টেল স্ট্যাট বক্স (gradient আইকনসহ)', () => {
  assert.ok(app.querySelector('.card-title').textContent.includes('আজকের হিসাব'))
  assert.match(app.querySelector('.card-date').textContent, /[০-৯]/, 'তারিখ বাংলা সংখ্যায় নেই')

  const stats = q('.grid3 .stat')
  assert.equal(stats.length, 3, '৩-কলাম স্ট্যাট গ্রিড ঠিক নেই')
  for (const s of stats) {
    assert.ok(s.querySelector('.stat-icon svg'), 'স্ট্যাট আইকন নেই')
    assert.ok(s.style.getPropertyValue('--grad'), 'gradient টোকেন সেট হয়নি')
    assert.ok(s.style.getPropertyValue('--tint'), 'প্যাস্টেল টিন্ট সেট হয়নি')
    assert.ok(s.querySelector('.stat-label').textContent.trim(), 'লেবেল খালি')
    assert.match(s.querySelector('.stat-value').textContent, /^৳/, 'ভ্যালুতে ৳ নেই')
  }
})

test('টাকা ফরম্যাট: বাংলা সংখ্যা + lakh গ্রুপিং + নেগেটিভ চিহ্ন', () => {
  assert.equal(UI.money(12500), '৳ ১২,৫০০')
  assert.equal(UI.money(123000), '৳ ১,২৩,০০০')
  assert.equal(UI.money(-2500), '−৳ ২,৫০০')
  assert.equal(UI.money('৳ ৫০০'), '৳ ৫০০', 'স্ট্রিং হলে অপরিবর্তিত থাকবে')
  assert.equal(UI.toBn('2026'), '২০২৬')
})

test('কার্ডের নিচে ফুল-উইথ হাইলাইট ব্যানার (টোটাল সামারি)', () => {
  const banner = app.querySelector('.card .banner')
  assert.ok(banner, 'ব্যানার নেই')
  assert.ok(banner.textContent.includes('আজকের নিট লাভ'))
  assert.match(banner.querySelector('.banner-value').textContent, /^৳/)
  assert.ok(app.querySelector('.card').contains(banner), 'ব্যানার কার্ডের ভেতরে নয়')
})

test('quick actions: সেকশন হেডার + ৪টি gradient আইকন বাটন', () => {
  assert.ok(app.querySelector('.section-title').textContent.includes('দ্রুত কাজ'))
  assert.equal(app.querySelector('.section-sub').textContent, '৪টি অপশন')
  const actions = q('.quick-card .grid4 .action')
  assert.equal(actions.length, 4)
  for (const a of actions) {
    assert.ok(a.querySelector('.action-icon svg'), 'অ্যাকশন আইকন নেই')
    assert.ok(a.querySelector('.action-label').textContent.trim(), 'অ্যাকশন লেবেল নেই')
  }
})

test('bottom navigation: ৫ ট্যাব, ঠিক একটি অ্যাক্টিভ, ক্লিকে অ্যাক্টিভ বদলায়', () => {
  const tabs = q('.bottom-nav .tab')
  assert.equal(tabs.length, 5)
  assert.equal(q('.bottom-nav .tab.active').length, 1)
  assert.ok(tabs[0].classList.contains('active'))

  tabs[2].dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  assert.ok(tabs[2].classList.contains('active'), 'ক্লিক করলে ট্যাব অ্যাক্টিভ হলো না')
  assert.equal(q('.bottom-nav .tab.active').length, 1, 'এক সময় একটিই ট্যাব অ্যাক্টিভ থাকবে')
  assert.equal(ls.get('sl.activeTab'), tabs[2].dataset.tab, 'অ্যাক্টিভ ট্যাব মনে রাখা হয়নি')
})

test('hamburger ক্লিকে মেনু খোলে-বন্ধ হয়', () => {
  const btn = app.querySelector('#menuBtn')
  const menu = app.querySelector('#menu')
  assert.ok(btn && menu)
  assert.equal(menu.classList.contains('open'), false)
  btn.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  assert.equal(menu.classList.contains('open'), true)
  assert.equal(btn.getAttribute('aria-expanded'), 'true')
  btn.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  assert.equal(menu.classList.contains('open'), false)
})

test('ui.css থিম টোকেন: #04795a, 20px কার্ড radius, প্যাস্টেল টিন্ট ও তিন গ্র্যাডিয়েন্ট', () => {
  assert.ok(uiCss.includes('--brand:        #04795a'), 'মূল থিম কালার টোকেন নেই')
  assert.ok(uiCss.includes('--r-card:       20px'), 'কার্ড radius 20px নেই')
  for (const t of ['--tint-orange:  #fff7ed', '--tint-green:   #f0fdf4', '--tint-blue:    #eff6ff']) {
    assert.ok(uiCss.includes(t), `প্যাস্টেল টিন্ট নেই: ${t}`)
  }
  for (const g of ['#fb923c, #f97316', '#34d399, #04795a', '#60a5fa, #3b82f6']) {
    assert.ok(uiCss.includes(g), `গ্র্যাডিয়েন্ট নেই: ${g}`)
  }
  assert.ok(uiCss.includes('repeat(3, 1fr)') && uiCss.includes('repeat(4, 1fr)'), 'গ্রিড কলাম নেই')
})

test('ui.html শুধু খোলস: ui.css ও ui.js লিঙ্ক করা, কোনো ইনলাইন স্টাইল/মার্কআপ নেই', () => {
  assert.ok(uiHtml.includes('href="ui.css"'), 'ui.css লিঙ্ক নেই')
  assert.ok(uiHtml.includes('src="ui.js"'), 'ui.js লিঙ্ক নেই')
  assert.ok(!/<style/i.test(uiHtml), 'ইনলাইন <style> রয়ে গেছে')
  assert.ok(uiHtml.includes('id="app"'), 'মাউন্ট পয়েন্ট #app নেই')
})
