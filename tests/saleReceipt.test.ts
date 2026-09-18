import test from 'node:test'
import assert from 'node:assert/strict'
import { saleReceiptShareText } from '../src/components/SaleReceipt'
import { computeProfitLoss } from '../src/lib/profitLoss'
import type { Sale } from '../src/types'

test('হোয়াটসঅ্যাপ শেয়ারে টেক্সট: পুরা ডিটেইলস না দিয়ে কেনাকাটার জন্য ধন্যবাদ ও রসিদের সংযুক্তি জানায়', () => {
  const pad = {
    name: 'রহিম ট্রেডার্স',
    address: 'চকবাজার, চট্টগ্রাম',
    phone: '01811111111',
  }

  const textWithCustomer = saleReceiptShareText(
    { customer_name: 'করিম সাহেব' },
    pad,
  )

  // ধন্যবাদ বার্তা ও দোকানের নাম থাকবে
  assert.ok(textWithCustomer.includes('রহিম ট্রেডার্স'))
  assert.ok(textWithCustomer.includes('করিম সাহেব'))
  assert.ok(textWithCustomer.includes('কেনাকাটা করার জন্য আপনাকে আন্তরিক ধন্যবাদ'))
  assert.ok(textWithCustomer.includes('বিক্রি রসিদটি সাথে দেওয়া হলো'))
  assert.ok(textWithCustomer.includes('01811111111'))

  // পুরো আইটেম বিবরণী, দর, পরিমাণ, মোট টাকা মেসেজের ভেতরে থাকা যাবে না (ছবিতে ইতিমধ্যে আছে)
  assert.equal(textWithCustomer.includes('পণ্য'), false)
  assert.equal(textWithCustomer.includes('পরিমাণ'), false)
  assert.equal(textWithCustomer.includes('রসিদ নং'), false)

  const textWithoutCustomer = saleReceiptShareText(
    {},
    { name: 'বিসমিল্লাহ স্টোর' },
  )
  assert.ok(textWithoutCustomer.includes('বিসমিল্লাহ স্টোর'))
  assert.ok(textWithoutCustomer.includes('কেনাকাটা করার জন্য আপনাকে আন্তরিক ধন্যবাদ'))
  assert.ok(textWithoutCustomer.includes('বিক্রি রসিদটি সাথে দেওয়া হলো'))
})

test('বিক্রিত দাম থেকে যত কম দিবে তা ডিস্কাউন্ট ও চূড়ান্ত হিসেবে সমন্বয় হয়', () => {
  // ২ কেজি সয়াবিন তেল (দর ২০০ টাকা) = ৪০০ টাকা
  // ১ কেজি ডাল (দর ১২০ টাকা) = ১২০ টাকা
  // মোট বিক্রিত দাম = ৫২০ টাকা
  // ক্রেতা দিল ৫০০ টাকা (২০ টাকা কম)
  const items = [
    {
      product_id: 'p1',
      product_name: 'সয়াবিন তেল',
      quantity: 2,
      unit: 'লিটার',
      sale_price: 200,
      purchase_price: 160,
      total: 400,
      profit: 80,
    },
    {
      product_id: 'p2',
      product_name: 'মসুর ডাল',
      quantity: 1,
      unit: 'কেজি',
      sale_price: 120,
      purchase_price: 100,
      total: 120,
      profit: 20,
    },
  ]

  const subtotal = items.reduce((sum, i) => sum + i.total, 0)
  assert.equal(subtotal, 520)

  const customerPaid = 500
  const discount = Math.max(0, subtotal - customerPaid)
  assert.equal(discount, 20)

  const totalAmount = subtotal - discount
  assert.equal(totalAmount, 500)

  // মোট আইটেম প্রফিট ১০০, ২০ টাকা ডিস্কাউন্ট দিলে নিট গ্রস প্রফিট ৮০
  const totalProfit = items.reduce((sum, i) => sum + i.profit, 0) - discount
  assert.equal(totalProfit, 80)

  const sale: Sale = {
    id: 's-test-1',
    date: '2026-09-18T10:00:00',
    items,
    subtotal,
    discount,
    total_amount: totalAmount,
    total_profit: totalProfit,
    payment_type: 'নগদ',
    branch_id: 'b1',
    created_by: 'u1',
    created_at: new Date().toISOString(),
  }

  // প্রফিট অ্যান্ড লস সামারি
  const pl = computeProfitLoss([sale], [], [], { from: '2026-09-18', to: '2026-09-18' }, 'b1')
  assert.equal(pl.revenue, 500)
  assert.equal(pl.grossProfit, 80)
  // cogs = revenue - grossProfit = 500 - 80 = 420 (which is 2*160 + 1*100)
  assert.equal(pl.cogs, 420)
})
