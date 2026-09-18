import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ORG_FALLBACK_NAME, orgPadOf, padHasDetails, padOneLine } from '../src/lib/orgPad'
import type { DbBranch } from '../src/lib/db'

const branch = (o: Partial<DbBranch>): DbBranch => ({
  id: 'b1',
  name: 'প্রধান শাখা',
  organization: 'রহিম ফিড স্টোর',
  address: 'দোকান নং ১২, চকবাজার, চট্টগ্রাম',
  phone: '01800000000',
  is_active: true,
  created_at: '',
  ...o,
})

/* ─────────────────────────────────────────────
   প্রতিষ্ঠানের প্যাড — সব রিপোর্ট/রসিদে যেভাবে বসে
   ───────────────────────────────────────────── */

test('শাখার রেকর্ড থেকে প্যাড — নাম, ঠিকানা, ফোন, লোগো সবই আসে', () => {
  const pad = orgPadOf(branch({ logo: 'data:image/png;base64,AAAA' }))
  assert.equal(pad.name, 'রহিম ফিড স্টোর')
  assert.equal(pad.address, 'দোকান নং ১২, চকবাজার, চট্টগ্রাম')
  assert.equal(pad.phone, '01800000000')
  assert.equal(pad.branchName, 'প্রধান শাখা')
  assert.equal(pad.logo, 'data:image/png;base64,AAAA')
})

test('প্রতিষ্ঠানের নাম না থাকলে শাখার নাম, তাও না থাকলে অ্যাপের নাম', () => {
  assert.equal(orgPadOf(branch({ organization: '  ' })).name, 'প্রধান শাখা')
  assert.equal(orgPadOf(branch({ organization: '', name: '' })).name, ORG_FALLBACK_NAME)
  assert.equal(orgPadOf(undefined).name, ORG_FALLBACK_NAME)
})

test('খালি ফিল্ড (ঠিকানা/ফোন/লোগো) প্যাডে যায় না — ফাঁকা লাইন হয় না', () => {
  const pad = orgPadOf(branch({ address: '   ', phone: '', logo: '  ' }))
  assert.equal(pad.address, undefined)
  assert.equal(pad.phone, undefined)
  assert.equal(pad.logo, undefined)
  assert.equal(padHasDetails(pad), false)
})

test('শেয়ার টেক্সটের জন্য প্যাডের এক-লাইন পরিচিতি', () => {
  const line = padOneLine(orgPadOf(branch({})))
  assert.ok(line.includes('রহিম ফিড স্টোর'))
  assert.ok(line.includes('প্রধান শাখা'))
  assert.ok(line.includes('চকবাজার'))
  assert.ok(line.includes('ফোন: 01800000000'))
})
