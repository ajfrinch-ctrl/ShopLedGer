/* অডিট পার্ট G — রিপোর্ট সেন্টার: ক্যাটালগ, রোল-ভিত্তিক তালিকা, ফিল্টার,
   ১০টি স্টেটমেন্টের সংখ্যা যাচাই, প্রিভিউ/PDF/শেয়ার ও ভুল ফিল্টার আটকানো */
import {React as _React, win as _win, db, check, section, renderAt, settle, text, find, all, clickEl, clickText, setElValue, fieldByLabel, buttonByText as _buttonByText, seedBase, ownerUser, managerUser, salesmanUser, customerUser, useSalesStore, usePurchaseStore, useProductStore, useStockAdjustmentStore, TODAY, YESTERDAY} from './harness'
import type { Sale, Purchase } from '../../src/types'

const { default: Reports } = await import('../../src/pages/Reports')
const core = await import('../../src/lib/reports/core')
const { buildReport } = await import('../../src/lib/reports/builders')

const routes: Array<[string, unknown]> = [['/reports', Reports], ['/reports/:kind', Reports]]
const nfc = (s: string) => s.normalize('NFC')
const hasText = (needle: string) => nfc(text()).includes(nfc(needle))
const { bnMoney, bnDate, r2 } = core

const sale = (id: string, amount: number, payment: 'নগদ' | 'বাকি', profit: number, customer = false): Sale => ({
  id, date: `${TODAY}T11:00:00`,
  items: [{
    product_id: 'p-rice', product_name: 'মিনিকেট চাল', quantity: amount / 75, unit: 'কেজি',
    sale_price: 75, purchase_price: 60, total: amount, profit,
  }],
  subtotal: amount, discount: 0, total_amount: amount, total_profit: profit,
  payment_type: payment,
  ...(customer ? { customer_id: 'c-karim', customer_name: 'ক্রেতা করিম' } : {}),
  branch_id: 'branch-1', created_by: 'manager-1', created_at: `${TODAY}T11:00:00`,
} as Sale)

const purchase: Purchase = {
  id: 'P-G-001', date: TODAY, product_id: 'p-rice', product_name: 'মিনিকেট চাল', quantity: 20,
  unit: 'কেজি', purchase_price: 55, total: 1100, supplier: 'আলম ট্রেডার্স', invoice_id: 'INV-G-1',
  payment_type: 'বাকি', branch_id: 'branch-1', created_at: `${TODAY}T11:30:00`,
} as Purchase

const openReport = async (label: string) => {
  await clickText(label)
  await settle(220)
}
const generate = async () => {
  await clickText('স্টেটমেন্ট দেখুন')
  await settle(240)
}
const closePreview = async () => {
  await clickEl(find('[aria-label="প্রিভিউ বন্ধ করুন"]'))
  await settle(150)
}

export async function runReportAudit() {
  await seedBase()
  useSalesStore.setState({ sales: [sale('S-G-1', 1500, 'নগদ', 300), sale('S-G-2', 1000, 'বাকি', 200, true)] })
  usePurchaseStore.setState({ purchases: [purchase] as never })
  await db.expenses.bulkPut([
    { id: 'E-G-1', date: TODAY, category: 'ভাড়া', amount: 300, kind: 'shop', payment_method: 'নগদ', branch_id: 'branch-1', created_at: `${TODAY}T12:00:00` } as never,
    { id: 'E-G-2', date: TODAY, category: 'সংসার খরচ', amount: 100, kind: 'owner', payment_method: 'নগদ', branch_id: 'branch-1', created_at: `${TODAY}T12:10:00` } as never,
  ])
  await db.ledgerEntries.put({
    id: 'R-G-1', party_id: 'c-karim', party_name: 'ক্রেতা করিম', party_type: 'customer', kind: 'payment',
    amount: 400, date: TODAY, branch_id: 'branch-1', method: 'বিকাশ', reference: 'BK1', note: '', cancelled: false,
    created_at: `${TODAY}T13:00:00`, created_by: 'manager-1',
  } as never)
  useStockAdjustmentStore.setState({
    adjustments: [{
      id: 'A-G-1', date: TODAY, product_id: 'p-rice', product_name: 'মিনিকেট চাল', type: 'add',
      quantity: 5, reason: 'গণনা সংশোধন', branch_id: 'branch-1', created_by: 'manager-1', created_at: `${TODAY}T13:30:00`,
    }] as never,
  })

  /* ════════ ১) ক্যাটালগ ও রোল-ভিত্তিক তালিকা ════════ */
  section('Reports — ক্যাটালগ, রোল ও ফিল্টার যাচাই')
  check('ক্যাটালগে ১০টি রিপোর্ট আছে', core.REPORT_CATALOG.length === 10, String(core.REPORT_CATALOG.length))
  check('ক্যাটালগে প্রতিটির kind/label/desc ঠিক আছে', core.REPORT_CATALOG.every((d) => !!d.kind && !!d.label && !!d.desc))
  check('মালিক সব রিপোর্ট পান (১০)', core.reportsForRole('owner').length === 10)
  check('ম্যানেজারও সব রিপোর্ট পান (১০)', core.reportsForRole('manager').length === 10)
  const sm = core.reportsForRole('salesman').map((d) => d.kind)
  check('সেলস ম্যান ক্রয়/খরচ/লেনদেন/লাভ রিপোর্ট পান না', !sm.includes('purchase') && !sm.includes('expense') && !sm.includes('transaction') && !sm.includes('dailyProfit') && !sm.includes('monthlyProfit') && sm.includes('sales') && sm.includes('stock'), sm.join(','))
  check('ক্রেতা/লগইনহীন কেউ রিপোর্ট পান না', core.reportsForRole('customer').length === 0 && core.reportsForRole(undefined).length === 0)
  const spec = core.reportDefinition('sales').filters
  check('তারিখ ফাঁকা থাকলে "সঠিক শুরুর ও শেষের তারিখ" ত্রুটি', (core.validateReportInput(spec, { from: '', to: TODAY, month: '' }) || '').includes('শুরুর'), String(core.validateReportInput(spec, { from: '', to: TODAY, month: '' })))
  check('শুরু > শেষ হলে ত্রুটি', (core.validateReportInput(spec, { from: TODAY, to: YESTERDAY, month: '' }) || '').includes('পরে হতে পারে না'))
  check('ভুল মাস হলে ত্রুটি', (core.validateReportInput(core.reportDefinition('monthlyProfit').filters, { from: '', to: '', month: '13-2026' }) || '').includes('মাস'))
  check('সঠিক ইনপুটে কোনো ত্রুটি নেই', core.validateReportInput(spec, { from: TODAY, to: TODAY, month: '' }) === null)

  /* ════════ ২) রিপোর্ট সেন্টার পেজ ════════ */
  section('Reports — রিপোর্ট সেন্টার পেজ ও ডায়ালগ')
  await renderAt('/reports', routes, { ...ownerUser })
  await settle(220)
  check('রিপোর্ট সেন্টার ও কার্ডের সংখ্যা দেখায়', hasText('রিপোর্ট সেন্টার') && hasText('বিষয়ভিত্তিক স্টেটমেন্ট (১০টি)'), text().slice(0, 200))
  check('সব রিপোর্টের কার্ড দেখা যায়', ['বিক্রি রিপোর্ট', 'ক্রয় রিপোর্ট', 'স্টক রিপোর্ট', 'ক্রেতার বাকি রিপোর্ট', 'বাকি আদায় রিপোর্ট', 'খরচ রিপোর্ট', 'দৈনিক লাভ রিপোর্ট', 'মাসিক লাভ রিপোর্ট', 'পণ্য রিপোর্ট', 'লেনদেন রিপোর্ট'].every((l) => hasText(l)), text().slice(0, 200))
  await renderAt('/reports', routes, { ...salesmanUser })
  await settle(220)
  check('সেলস ম্যানের তালিকায় ৫টি স্টেটমেন্ট (৫টি লুকানো)', hasText('(৫টি)') && !hasText('(১০টি)'), text().slice(0, 200))
  check('সেলস ম্যানের কার্ডে ক্রয়/খরচ/লাভ রিপোর্ট নেই', !hasText('ক্রয় রিপোর্ট') && !hasText('খরচ রিপোর্ট') && !hasText('দৈনিক লাভ রিপোর্ট'))
  await renderAt('/reports/purchase', routes, { ...salesmanUser })
  await settle(220)
  check('সেলস ম্যান অনুমতিহীন রিপোর্ট খুললে নিষেধ দেখায়', hasText('এই রিপোর্টটি আপনার রোলের জন্য প্রযোজ্য নয়।') && !find('[role="dialog"][data-report-filters]'), text().slice(0, 200))
  await renderAt('/reports/unknown-kind', routes, { ...ownerUser })
  await settle(220)
  check('অজানা রিপোর্টে "পাওয়া যায়নি" দেখায়', hasText('রিপোর্টটি পাওয়া যায়নি।'))
  await renderAt('/reports', routes, { ...ownerUser })
  await settle(220)
  await openReport('বিক্রি রিপোর্ট')
  check('কার্ডে চাপলে ফিল্টার ডায়ালগ খোলে', !!find('[data-report-filters]') && hasText('সময়সীমা ও ফিল্টার নির্বাচন করুন'), text().slice(0, 200))
  check('ডায়ালগে বিক্রি রিপোর্টের ফিল্টার (পণ্য/ক্রেতা/নগদ-বাকি) আছে', hasText('সব পণ্য') && hasText('সব ক্রেতা') && hasText('নগদ / বাকি') && hasText('সব পেমেন্ট'), text().slice(0, 260))
  check('সব শাখার অপশন ও সার্চ ছাড়া ফিল্ড নেই', hasText('সব শাখা') && !fieldByLabel('সার্চ (পণ্য, ক্রেতা, সাপ্লায়ার…)'))
  await clickText('স্টেটমেন্ট দেখুন')
  await settle(240)
  check('প্রিভিউ মডাল খোলে', !!find('[aria-label*="বিক্রি রিপোর্ট"]') && !!find('[data-sheet]'), text().slice(0, 200))
  await closePreview()
  check('প্রিভিউ বন্ধ হলে আবার ফিল্টার ডায়ালগ থাকে', !!find('[data-report-filters]'))
  await clickEl(find('[aria-label="ফিল্টার বন্ধ করুন"]'))
  await settle(150)
  check('ফিল্টার বন্ধ করলে সেন্টারে ফেরে', !find('[data-report-filters]') && hasText('রিপোর্ট সেন্টার'))

  /* ════════ ৩) বিক্রি রিপোর্টের সংখ্যা ════════ */
  section('Reports — বিক্রি রিপোর্ট (সংখ্যা যাচাই)')
  await renderAt('/reports/sales', routes, { ...ownerUser })
  await settle(240)
  await generate()
  check('বিক্রি রিপোর্টের শিরোনাম ও সময় লেখা', hasText('বিক্রি রিপোর্ট') && hasText(bnDate(TODAY)), text().slice(0, 260))
  check('দুইটি বিক্রি সারি ও পণ্য দেখায়', (text().match(/মিনিকেট চাল/g) || []).length >= 2 && hasText('নগদ') && hasText('বাকি'))
  check('বিক্রির সর্বমোট ২,৫০০ দেখায়', hasText(bnMoney(2500)), text().slice(0, 400))
  check('সারিতে ক্রেতার নাম ও দাম দেখায়', hasText('ক্রেতা করিম') && hasText(bnMoney(1500)) && hasText(bnMoney(1000)))
  /* পণ্য ফিল্টার: অন্য পণ্য (p-feed) — কিছুই পাওয়া উচিত নয় */
  await closePreview()
  const prodSel = fieldByLabel('পণ্য')!
  await setElValue(prodSel, 'p-feed')
  await settle(150)
  await generate()
  check('পণ্য ফিল্টারে ভিন্ন পণ্যের সারি আসে না', !hasText('মিনিকেট চাল'), text().slice(0, 260))
  await closePreview()
  await setElValue(fieldByLabel('পণ্য')!, '')
  await setElValue(fieldByLabel('নগদ / বাকি')!, 'বাকি')
  await settle(150)
  await generate()
  check('নগদ/বাকি ফিল্টারে শুধু বাকি বিক্রি (১,০০০) দেখায়', hasText(bnMoney(1000)) && !hasText(bnMoney(2500)), text().slice(0, 300))
  await closePreview()

  /* ════════ ৪) ক্রয়, স্টক ও পণ্য রিপোর্ট ════════ */
  section('Reports — ক্রয়, স্টক ও পণ্য রিপোর্ট')
  await renderAt('/reports/purchase', routes, { ...ownerUser })
  await settle(240)
  await generate()
  check('ক্রয় রিপোর্টে সাপ্লায়ার ও মোট ক্রয় (১,১০০) দেখায়', hasText('ক্রয় রিপোর্ট') && hasText('আলম ট্রেডার্স') && hasText(bnMoney(1100)), text().slice(0, 300))
  await closePreview()
  await renderAt('/reports/stock', routes, { ...ownerUser })
  await settle(240)
  await generate()
  check('স্টক রিপোর্টে চালের সারি ও ওপেনিং স্টক দেখায়', hasText('স্টক রিপোর্ট') && hasText('মিনিকেট চাল') && hasText('১০০'), text().slice(0, 300))
  /* ওপেনিং ১০০ + ক্রয় ২০ + সমন্বয় ৫ − বিক্রি ৩৩.৩৩ = ৯১.৬৭ (দুই রিপোর্টেই একই হিসাব) */
  const riceRow = all('table tr').find((tr) => nfc(tr.textContent || '').includes(nfc('মিনিকেট চাল')))
  check('স্টক রিপোর্টের সারিতে বর্তমান স্টক ৯১.৬৬৭ দেখায়', !!riceRow && nfc(riceRow.textContent || '').includes(nfc('৯১.৬৬৭')), (riceRow?.textContent || '').slice(0, 200))
  await closePreview()
  await renderAt('/reports/product', routes, { ...ownerUser })
  await settle(240)
  await generate()
  check('পণ্য রিপোর্টে দাম ও স্টক কলাম দেখায়', hasText('পণ্য রিপোর্ট') && hasText('মিনিকেট চাল') && hasText(bnMoney(75)) && hasText(bnMoney(60)), text().slice(0, 300))
  await closePreview()
  await setElValue(all('input[placeholder="যেমন: সয়াবিন / করিম"]')[0], 'তীর')
  await settle(150)
  await generate()
  check('পণ্য রিপোর্টের সার্চ কাজ করে (তীর → ফিড)', hasText('গরুর ফিড') && !hasText('মিনিকেট চাল'), text().slice(0, 300))
  await closePreview()

  /* ════════ ৫) বাকি, আদায় ও খরচ রিপোর্ট ════════ */
  section('Reports — বাকি, আদায় ও খরচ রিপোর্ট')
  await renderAt('/reports/customerDue', routes, { ...ownerUser })
  await settle(240)
  await generate()
  check('ক্রেতার বাকি রিপোর্টে বাকি ও আদায় দেখায় (১০০০ − ৪০০ = ৬০০)', hasText('ক্রেতার বাকি রিপোর্ট') && hasText('ক্রেতা করিম') && hasText(bnMoney(600)), text().slice(0, 400))
  await closePreview()
  await renderAt('/reports/collection', routes, { ...ownerUser })
  await settle(240)
  await generate()
  check('আদায় রিপোর্টে ৪০০ ও মাধ্যম দেখায়', hasText('বাকি আদায় রিপোর্ট') && hasText(bnMoney(400)) && hasText('বিকাশ'), text().slice(0, 300))
  await closePreview()
  await renderAt('/reports/expense', routes, { ...ownerUser })
  await settle(240)
  await generate()
  check('খরচ রিপোর্টে দুই খরচ ও মোট ৪০০ দেখায়', hasText('খরচ রিপোর্ট') && hasText('ভাড়া') && hasText('সংসার খরচ') && hasText(bnMoney(400)), text().slice(0, 400))
  await closePreview()
  await setElValue(fieldByLabel('খরচের ধরন')!, 'shop')
  await settle(150)
  await generate()
  check('খরচের ধরন ফিল্টারে শুধু দোকানের খরচ (৩০০) থাকে', hasText(bnMoney(300)) && !hasText('সংসার খরচ'), text().slice(0, 300))
  await closePreview()

  /* ════════ ৬) লাভ ও লেনদেন রিপোর্ট ════════ */
  section('Reports — দৈনিক/মাসিক লাভ ও লেনদেন রিপোর্ট')
  await renderAt('/reports/dailyProfit', routes, { ...ownerUser })
  await settle(240)
  await generate()
  /* গ্রস লাভ ৫০০ − দোকানের খরচ ৩০০ = ২০০; মালিকের টাকা তোলা বাদ যায় না */
  check('দৈনিক লাভ রিপোর্টে গ্রস লাভ, খরচ ও নিট লাভ দেখায়', hasText('দৈনিক লাভ রিপোর্ট') && hasText(bnMoney(500)) && hasText(bnMoney(300)) && hasText(bnMoney(200)), text().slice(0, 500))
  check('মালিকের টাকা তোলা লাভ থেকে বাদ যায় না', !hasText(bnMoney(100)) || hasText('মালিকের টাকা তোলা'), text().slice(0, 500))
  await closePreview()
  await renderAt('/reports/monthlyProfit', routes, { ...ownerUser })
  await settle(240)
  await generate()
  check('মাসিক লাভ রিপোর্টে মাসের হিসাব দেখায়', hasText('মাসিক লাভ রিপোর্ট') && hasText(bnMoney(500)), text().slice(0, 400))
  await closePreview()
  await renderAt('/reports/transaction', routes, { ...ownerUser })
  await settle(240)
  await generate()
  check('লেনদেন রিপোর্টে সব ধরনের লেনদেন আসে', hasText('লেনদেন রিপোর্ট') && hasText('বিক্রি') && hasText('ক্রয়') && hasText('আদায়'), text().slice(0, 400))
  check('[ফাইন্ডিং] লেনদেন রিপোর্টে সর্বমোট সারি নেই (বাকি রিপোর্টে আছে)', !hasText('সর্বমোট'), text().slice(0, 200))
  await closePreview()
  await setElValue(fieldByLabel('লেনদেনের ধরন')!, 'আদায়')
  await settle(150)
  await generate()
  check('লেনদেনের ধরন ফিল্টার কাজ করে (শুধু আদায়)', hasText(bnMoney(400)) && !hasText(bnMoney(2500)), text().slice(0, 300))
  await closePreview()

  /* ════════ ৭) ভুল ফিল্টার, শাখা নির্বাচন ও ভূমিকা ════════ */
  section('Reports — ভুল ফিল্টার, শাখা ও অনুমতি')
  await renderAt('/reports/sales', routes, { ...ownerUser })
  await settle(240)
  const fromField = fieldByLabel('তারিখ থেকে')!
  await setElValue(fromField, TODAY)
  await settle(100)
  await setElValue(fieldByLabel('তারিখ পর্যন্ত')!, YESTERDAY)
  await settle(150)
  check('শুরু > শেষ হলে সতর্কবার্তা ও বোতাম নিষ্ক্রিয়', hasText('শুরুর তারিখ শেষের তারিখের পরে হতে পারে না।') && (all('button').find((b) => nfc(b.textContent || '').includes(nfc('স্টেটমেন্ট দেখুন'))) as HTMLButtonElement)?.disabled === true, text().slice(0, 240))
  await clickText('আজ')
  await settle(150)
  check('"আজ" শর্টকাটে ফিল্টার আজকের তারিখে ফেরে', (fieldByLabel('তারিখ পর্যন্ত') as HTMLInputElement)?.value === TODAY, (fieldByLabel('তারিখ পর্যন্ত') as HTMLInputElement)?.value || '')
  check('তারিখ ছাড়া null ইনপুটে ডকুমেন্ট বানাতে গেলে ত্রুটি', (() => {
    try { buildReport('sales', { from: '', to: TODAY, month: '', productId: '', customerId: '', supplier: '', category: '', paymentType: '', method: '', expenseKind: '', txType: '', search: '', scope: {} } as never, {
      sales: useSalesStore.getState().sales, purchases: usePurchaseStore.getState().purchases as never,
      products: useProductStore.getState().products, adjustments: useStockAdjustmentStore.getState().adjustments as never,
      entries: [], collections: [], customers: [], expenses: [], branches: [], users: [],
    } as never); return false } catch { return true }
  })())
  await renderAt('/reports/expense', routes, { ...managerUser })
  await settle(240)
  check('ম্যানেজারের ডায়ালগে শাখা নির্বাচক নেই', !fieldByLabel('শাখা'), text().slice(0, 200))
  await renderAt('/reports', routes, { ...customerUser })
  await settle(200)
  check('ক্রেতা রিপোর্ট সেন্টার দেখতে পারে না', hasText('এই রিপোর্ট শুধু মালিক ও কর্মচারীর জন্য।'))
  void r2
}
