/* অডিট পার্ট B — স্টক/পণ্য (কোড, ক্যাটাগরি, সমন্বয়) ও ক্রয় এন্ট্রি (সাপ্লাইয়ার চালান) */
import {React as _React, act as _act, win, db, check, section, renderAt, settle, text, find as _find, all, bodyText, clickEl, clickText, setField, setElValue, submitForm, fieldByLabel, buttonByText, seedBase, ownerUser as _ownerUser, managerUser, salesmanUser, useProductStore, usePurchaseStore, useStockAdjustmentStore, TODAY, YESTERDAY} from './harness'

const { default: Stock } = await import('../../src/pages/Stock')
const { default: Purchases } = await import('../../src/pages/Purchases')
const { computeStock } = await import('../../src/lib/stock')
const { nextCode, normalizePrefix, prefixFor, assignMissingCodes, displayName, matchesProduct, codeExists, GENERAL_PREFIX, DEFAULT_CATEGORIES } = await import('../../src/lib/productCode')
const { supplierId } = await import('../../src/lib/ledger')
const { debtAccounts } = await import('../../src/lib/dues')
const { yymmdd } = await import('../../src/lib/idGenerator')

const cardWith = (needle: string): HTMLElement | null =>
  all('div.card').find((c) => (c.textContent || '').includes(needle)) || null
const btnIn = (scope: Element | null, sel: string): HTMLElement | null =>
  scope ? (scope.querySelector(sel) as HTMLElement | null) : null
const openCard = () =>
  all('button').find((b) => (b.getAttribute('class') || '').includes('hover:bg-gray-100'))

let alerted = ''
const stubAlert = () => {
  alerted = ''
  ;(win as unknown as { alert: (m: string) => void }).alert = (m: string) => {
    alerted = String(m)
  }
  ;(globalThis as unknown as { alert: (m: string) => void }).alert = (m: string) => {
    alerted = String(m)
  }
}

export async function runStockPurchaseAudit() {
  await seedBase()
  stubAlert()

  /* ════════ ১) পণ্য-কোড ও স্টক হিসাবের বিশুদ্ধ ফাংশন ════════ */
  section('Stock — হিসাবের ফাংশন (computeStock, পণ্য-কোড)')
  const products = useProductStore.getState().products
  const purchases = [
    { id: 'pu1', date: TODAY, product_id: 'p-rice', product_name: 'মিনিকেট চাল', quantity: 50, unit: 'কেজি', purchase_price: 58, total: 2900, branch_id: 'branch-1', created_at: '' },
    { id: 'pu2', date: TODAY, product_id: 'p-feed', product_name: 'গরুর ফিড', quantity: 4, unit: 'বস্তা', purchase_price: 1200, total: 4800, branch_id: 'branch-1', created_at: '' },
  ]
  const sales = [
    { id: 'sa1', date: TODAY, items: [
      { product_id: 'p-rice', product_name: 'মিনিকেট চাল', quantity: 20, unit: 'কেজি', sale_price: 75, purchase_price: 60, total: 1500, profit: 300 },
      { product_id: 'p-feed', product_name: 'গরুর ফিড', quantity: 1, unit: 'বস্তা', sale_price: 1400, purchase_price: 1200, total: 1400, profit: 200 },
    ], total_amount: 2900, total_profit: 500, payment_type: 'নগদ' as const, branch_id: 'branch-1', created_by: 'owner-1', created_at: '' },
  ]
  const adjustments = [
    { id: 'adj1', date: TODAY, product_id: 'p-rice', product_name: 'মিনিকেট চাল', quantity: -5, unit: 'কেজি', reason: 'ক্ষয়' as const, branch_id: 'branch-1', created_by: 'owner-1', created_at: '' },
  ]
  const rows = computeStock(products as never, purchases as never, sales as never, adjustments as never)
  const rice = rows.find((r) => r.id === 'p-rice')!
  const feed = rows.find((r) => r.id === 'p-feed')!
  check('স্টক = প্রারম্ভিক + ক্রয় − বিক্রি + সমন্বয় (চাল: ১০০+৫০−২০−৫=১২৫)', rice.currentStock === 125, String(rice.currentStock))
  check('ক্রয়/বিক্রি/সমন্বয় আলাদা করে দেখায়', rice.totalPurchased === 50 && rice.totalSold === 20 && rice.totalAdjusted === -5)
  check('স্টক মূল্য = বর্তমান স্টক × ক্রয়মূল্য', rice.stockValue === 125 * 60, String(rice.stockValue))
  check('সম্ভাব্য লাভ = (বিক্রয়মূল্য − ক্রয়মূল্য) × স্টক', rice.potentialProfit === 125 * (75 - 60))
  check('ন্যূনতম স্টকের নিচে গেলে isLow সত্য (ফিড: ১০+৪−১=১৩, ন্যূনতম ৫ নয়)', feed.isLow === false, String(feed.currentStock))
  const rice0 = products.find((p) => p.id === 'p-rice')!
  const zeroRow = computeStock([{ ...(rice0 as never), opening_stock: 0, min_stock: 0 } as never], [], [], [])[0]
  check('স্টক শূন্য হলে মান/মূল্য ঋণাত্মক হয় না', zeroRow.currentStock === 0 && zeroRow.stockValue === 0)
  const lowRow = computeStock([{ ...(rice0 as never), opening_stock: 3, min_stock: 5 } as never], [], [], [])[0]
  const negRow = computeStock([rice0 as never], [], [], [{ id: 'x', date: TODAY, product_id: 'p-rice', product_name: 'x', quantity: -999, unit: 'কেজি', reason: 'ক্ষয়', branch_id: 'branch-1', created_by: '', created_at: '' } as never])[0]
  check('সমন্বয়ে ঋণাত্মক স্টকও সঠিকভাবে দেখায় (১০০−৯৯৯)', negRow.currentStock === -899, String(negRow.currentStock))
  check('ঋণাত্মক স্টকে স্টক মূল্য শূন্য ধরা হয় (নেতিবাচক নয়)', negRow.stockValue === 0, String(negRow.stockValue))
  check('ন্যূনতম স্টকের নিচে নামলে isLow সত্য', lowRow.isLow === true)

  check('nextCode পরের ক্রমিক দেয় (RICE-002)', nextCode('RICE', [{ code: 'RICE-001' }]) === 'RICE-002')
  check('nextCode ফাঁকা থাকলে ০০১ দেয়', nextCode('OIL', []) === 'OIL-001')
  check('prefix স্যানিটাইজ (ফাঁকা → GEN)', normalizePrefix('$$') === GENERAL_PREFIX && normalizePrefix('oil 1') === 'OIL1')
  check('ক্যাটাগরি থেকে প্রিফিক্স', prefixFor('ফিড', DEFAULT_CATEGORIES) === 'FEED' && prefixFor('নেই', DEFAULT_CATEGORIES) === 'GEN')
  check('codeExists ডুপ্লিকেট ধরে (বড়-ছোট হাত মিলিয়ে)', codeExists('rice-001', [{ id: 'p-rice', code: 'RICE-001' }]) === true)
  check('codeExists নিজের আইডি বাদ দেয়', codeExists('RICE-001', [{ id: 'p-rice', code: 'RICE-001' }], 'p-rice') === false)
  const missing = assignMissingCodes([{ ...(rice0 as never), code: undefined } as never], DEFAULT_CATEGORIES)[0]
  check('পুরোনো পণ্যে কোড বসে (assignMissingCodes → RICE-001)', missing.code === 'RICE-001', String(missing.code))
  check('প্রদর্শনের নামে কোম্পানি যোগ হয়', displayName({ name: 'গরুর ফিড', company: 'তীর' }) === 'গরুর ফিড – তীর')
  check('search নাম/কোম্পানি/কোড তিনিটেই ধরে', matchesProduct({ name: 'গরুর ফিড', company: 'তীর', code: 'FEED-001' }, 'feEd') && matchesProduct({ name: 'গরুর ফিড', company: 'তীর', code: 'FEED-001' }, 'তীর') && matchesProduct({ name: 'গরুর ফিড', company: 'তীর', code: 'FEED-001' }, ''))

  /* ════════ ২) স্টক পেজ (DOM) ════════ */
  section('Stock পেজ — তালিকা, সমন্বয়, নতুন পণ্য, অনুমতি')
  useProductStore.setState({ products: (await db.products.toArray()) as never })
  usePurchaseStore.setState({ purchases: [] })
  useStockAdjustmentStore.setState({ adjustments: [] })
  await renderAt('/stock', [['/stock', Stock]], { ...managerUser })
  await settle(100)
  check('স্টক পেজে পণ্যের তালিকা দেখা যায়', text().includes('মিনিকেট চাল') && text().includes('গরুর ফিড'))
  check('বর্তমান স্টক দেখায় (১০০ কেজি)', bodyText('body').includes('১০০'))
  check('মোট স্টক মূল্য কার্ড আছে', text().includes('মোট স্টক মূল্য'))

  // অনুসন্ধান
  await setField('input[type="text"]', 'তীর')
  await settle(60)
  check('কোম্পানির নাম দিয়ে খোঁজা কাজ করে', text().includes('গরুর ফিড') && !text().includes('মিনিকেট চাল'))
  await setField('input[type="text"]', 'RICE-001')
  await settle(60)
  check('কোড দিয়ে খোঁজা কাজ করে', text().includes('মিনিকেট চাল') && !text().includes('গরুর ফিড'))
  await setField('input[type="text"]', '')
  await settle(40)

  // পণ্য সম্পাদনা (দাম বদল) — নির্দিষ্ট পণ্যের কার্ড ধরে
  const riceCard = cardWith('মিনিকেট চাল')!
  check('প্রতিটি পণ্যের কার্ডে সম্পাদনা বোতাম আছে', !!btnIn(riceCard, 'button[title="সম্পাদনা"]') && !!btnIn(cardWith('গরুর ফিড'), 'button[title="সম্পাদনা"]'))
  await clickEl(btnIn(riceCard, 'button[title="সম্পাদনা"]'))
  await settle(60)
  check('সম্পাদনার ফর্মে আগের তথ্য বসানো', (fieldByLabel('পণ্যের নাম') as HTMLInputElement)?.value === 'মিনিকেট চাল', (fieldByLabel('পণ্যের নাম') as HTMLInputElement)?.value)
  check('ফর্মে আগের কোড ও ক্যাটাগরি আসে', (fieldByLabel('প্রডাক্ট কোড') as HTMLInputElement)?.value === 'RICE-001' && (fieldByLabel('ক্যাটাগরি') as HTMLSelectElement)?.value === 'চাল')
  await setElValue(fieldByLabel('বিক্রয়মূল্য')!, '80')
  await setElValue(fieldByLabel('ন্যূনতম স্টক (অ্যালার্ট)')!, '25')
  await submitForm()
  await settle(80)
  const riceNow = useProductStore.getState().products.find((p) => p.id === 'p-rice')
  check('পণ্য সম্পাদনা স্টোরে যায় (বিক্রয়মূল্য ৮০)', riceNow?.sale_price === 80, String(riceNow?.sale_price))
  check('ন্যূনতম স্টকও হালনাগাদ হয়', riceNow?.min_stock === 25, String(riceNow?.min_stock))
  /* সিড করা (পুরোনো) সারিতে uid নেই — অ্যাপের v6 মাইগ্রেশন সেগুলো ব্যাকফিল করে;
     তাই এখানে নতুন করে তৈরি পণ্যে uid থাকা যাচাই করা হয় (নিচে)। */
  check('[লক্ষণ] সিড-করা পুরোনো পণ্যে uid নেই → migration নির্ভর', !(riceNow as unknown as { uid?: string })?.uid)
  check('আগের দামের পণ্য অপরিবর্তিত (শুধু নির্দিষ্ট পণ্যই বদলায়)', useProductStore.getState().products.find((p) => p.id === 'p-feed')?.sale_price === 1400)

  // ডুপ্লিকেট কোড
  await clickEl(btnIn(cardWith('মিনিকেট চাল'), 'button[title="সম্পাদনা"]'))
  await settle(60)
  await setElValue(fieldByLabel('প্রডাক্ট কোড')!, 'FEED-001')
  await submitForm()
  await settle(60)
  check('ডুপ্লিকেট কোড দিলে সতর্কবার্তা (alert) ও সংরক্ষণ বন্ধ', alerted.includes('কোডটি অন্য পণ্যে'), alerted)
  check('ডুপ্লিকেট কোডে ডেটা বদলায়নি', useProductStore.getState().products.find((p) => p.id === 'p-rice')?.code === 'RICE-001')
  await clickEl(openCard())
  await settle(40)

  // স্টক সমন্বয় — কমান
  await renderAt('/stock', [['/stock', Stock]], { ...managerUser })
  await settle(100)
  await clickEl(btnIn(cardWith('মিনিকেট চাল'), 'button[title="স্টক সমন্বয়"]'))
  await settle(60)
  check('সমন্বয় মডালে বর্তমান স্টক দেখায়', text().includes('বর্তমান স্টক') && text().includes('১০০'))
  await setElValue(all('input[type="number"]')[0], '10')
  await settle(40)
  check('কমানোর সময় পরিবর্তনের হিসাব দেখায় (১০০→৯০)', text().includes('নতুন স্টক ৯০'), text().slice(0, 240))
  await submitForm()
  await settle(80)
  const adjs = useStockAdjustmentStore.getState().adjustments
  check('সমন্বয় সংরক্ষিত (−১০ কেজি, কারণ ক্ষয়)', adjs.length === 1 && adjs[0].quantity === -10 && adjs[0].reason === 'ক্ষয়', JSON.stringify(adjs[0] || {}))
  check('সমন্বয়ের আইডি ফরম্যাট A…', /^A\d+$/.test(adjs[0]?.id || ''), adjs[0]?.id)
  check('সমন্বয় ঠিক পণ্য ও শাখায় লেখা', adjs[0]?.product_id === 'p-rice' && adjs[0]?.branch_id === 'branch-1' && adjs[0]?.unit === 'কেজি')
  const afterAdj = computeStock(useProductStore.getState().products as never, [], [], adjs as never).find((r) => r.id === 'p-rice')!
  check('সমন্বয়ের পর স্টক ৯০', afterAdj.currentStock === 90, String(afterAdj.currentStock))
  check('সমন্বয়ের পর লো-স্টক সতর্কতা দেখা যায়', text().includes('স্টক কম') || text().includes('ন্যূনতম'))

  // সমন্বয় — বাড়ান ও "গণনা অনুযায়ী"
  await clickEl(btnIn(cardWith('মিনিকেট চাল'), 'button[title="স্টক সমন্বয়"]'))
  await settle(60)
  await clickText('বাড়ান')
  await setElValue(all('input[type="number"]')[0], '5')
  await submitForm()
  await settle(80)
  check('বাড়ানোর সমন্বয় ধনাত্মক (+৫)', useStockAdjustmentStore.getState().adjustments[0].quantity === 5, String(useStockAdjustmentStore.getState().adjustments[0].quantity))
  await clickEl(btnIn(cardWith('মিনিকেট চাল'), 'button[title="স্টক সমন্বয়"]'))
  await settle(60)
  await clickText('গণনা অনুযায়ী')
  await setElValue(all('input[type="number"]')[0], '100')
  await submitForm()
  await settle(80)
  const setAdj = useStockAdjustmentStore.getState().adjustments[0]
  check('"গণনা অনুযায়ী" ডেল্টা হিসাব করে (৯৫→১০০ = +৫), কারণ বদলায়', setAdj.quantity === 5 && setAdj.reason === 'গণনা সংশোধন', JSON.stringify(setAdj))
  check('তিনটি সমন্বয়ই জমা আছে', useStockAdjustmentStore.getState().adjustments.length === 3, String(useStockAdjustmentStore.getState().adjustments.length))

  // ইতিহাস
  await clickText('সমন্বয়')
  await settle(60)
  check('সমন্বয়ের ইতিহাসে এন্ট্রি দেখা যায়', text().includes('স্টক সমন্বয়ের ইতিহাস') && text().includes('গণনা সংশোধন'))
  check('[পর্যবেক্ষণ] সমন্বয়ের ইতিহাসে ডিলিট/বাতিলের বোতাম নেই (store-এ API আছে)', !all('button').some((b) => (b.textContent || '').includes('মুছুন') || (b.textContent || '').includes('বাতিল')))
  await clickEl(openCard())
  await settle(40)

  // নতুন পণ্য (অটো কোড + নতুন ক্যাটাগরি)
  await clickText('নতুন পণ্য')
  await settle(60)
  check('নতুন পণ্য মডালে অটো কোড দেখায়', /[A-Z]+-\d{3}/.test(text()))
  await setElValue(fieldByLabel('পণ্যের নাম')!, 'তিলের খৈল')
  await setElValue(fieldByLabel('ক্রয়মূল্য')!, '90')
  await setElValue(fieldByLabel('বিক্রয়মূল্য')!, '110')
  await submitForm()
  await settle(100)
  const created = useProductStore.getState().products.find((p) => p.name === 'তিলের খৈল')
  check('নতুন পণ্য যোগ হয় (অটো কোডসহ)', !!created && !!created.code, JSON.stringify(created ? { code: created.code } : {}))
  check('নতুন পণ্যের আইডি ফরম্যাট PR…', /^PR\d+$/.test(created?.id || ''), created?.id)
  check('নতুন পণ্যের দাম ও শাখা সংরক্ষিত', created?.purchase_price === 90 && created?.sale_price === 110 && created?.branch_id === 'branch-1')
  check('নতুন পণ্যে sync মেটাডেটা (uid/rev/updated_at) থাকে', !!(created as unknown as { uid?: string })?.uid && (created as unknown as { rev?: number })?.rev === 1)
  check('নতুন পণ্য outbox-এ queue হয় (offline-first)', (await db.syncOutbox.where('table').equals('products').count()) > 0, String(await db.syncOutbox.where('table').equals('products').count()))
  await clickText('নতুন পণ্য')
  await settle(60)
  await setElValue(fieldByLabel('পণ্যের নাম')!, 'তিলের খৈল')
  await settle(40)
  check('একই নাম+কোম্পানির পণ্য আবার যোগ করা যায় না', text().includes('আগে থেকেই আছে'))
  check('ডুপ্লিকেট থাকলে তৈরি বোতাম নিষ্ক্রিয়', !!all('button').find((b) => (b.textContent || '').includes('পণ্য তৈরি করুন') && (b as HTMLButtonElement).disabled))
  await clickEl(openCard())
  await settle(40)

  // নতুন ক্যাটাগরি → প্রিফিক্স-ভিত্তিক কোড
  await clickText('নতুন পণ্য')
  await settle(60)
  await setElValue(fieldByLabel('ক্যাটাগরি')!, '__new')
  await settle(60)
  await setElValue(all('input[placeholder="ক্যাটাগরির নাম"]')[0], 'মসলা')
  await setElValue(all('input[placeholder="প্রিফিক্স"]')[0], 'SPC')
  await settle(40)
  await clickText('ক্যাটাগরি যোগ করুন')
  await settle(60)
  check('নতুন ক্যাটাগরি যোগ হয় ও প্রিফিক্স কোড দেখায়', text().includes('SPC-001'), text().slice(0, 200))
  await setElValue(fieldByLabel('পণ্যের নাম')!, 'হলুদ গুঁড়া')
  await submitForm()
  await settle(100)
  const spice = useProductStore.getState().products.find((p) => p.name === 'হলুদ গুঁড়া')
  check('নতুন ক্যাটাগরির পণ্য SPC-001 কোড পায়', spice?.code === 'SPC-001', String(spice?.code))
  check('নতুন ক্যাটাগরি স্টোরে সংরক্ষিত', useProductStore.getState().categories.some((c) => c.name === 'মসলা' && c.prefix === 'SPC'))

  // সেলস ম্যানের অনুমতি
  await renderAt('/stock', [['/stock', Stock]], { ...salesmanUser })
  await settle(100)
  check('সেলস ম্যান সম্পাদনা/সমন্বয়/নতুন পণ্যের বোতাম পান না', all('button[title="সম্পাদনা"]').length === 0 && all('button[title="স্টক সমন্বয়"]').length === 0 && !buttonByText('নতুন পণ্য'))

  /* ════════ ৩) ক্রয় এন্ট্রি (সাপ্লাইয়ার চালান) ════════ */
  section('Purchases — চালান এন্ট্রি, দাম হালনাগাদ, সাপ্লায়ারের বাকি')
  await seedBase()
  useProductStore.setState({ products: (await db.products.toArray()) as never })
  usePurchaseStore.setState({ purchases: [] })
  await renderAt('/purchases', [['/purchases', Purchases]], { ...managerUser })
  await settle(100)
  check('ক্রয় পেজে খোঁজা ও ফর্ম দেখা যায়', text().includes('ক্রয় এন্ট্রি') && text().includes('উপরে খুঁজে পণ্য যোগ করুন'))

  // একই চালানে দুই পণ্য
  await setField('input[placeholder^="পণ্যের নাম"]', 'চাল')
  await settle(40)
  await clickText('মিনিকেট চাল')
  await setField('input[placeholder^="পণ্যের নাম"]', 'FEED-001')
  await settle(40)
  await clickText('গরুর ফিড')
  await settle(60)
  check('একই চালানে দুই পণ্য যোগ করা যায়', bodyText('body').includes('আমুচিয়া') === false && all('input[type="number"]').length >= 4)
  const qtyPrice = all<HTMLInputElement>('input[type="number"]')
  await setElValue(qtyPrice[0], '10')   // চাল ১০ কেজি
  await setElValue(qtyPrice[1], '55')   // দর ৫৫ (আগের ৬০ থেকে আলাদা)
  await setElValue(qtyPrice[2], '2')    // ফিড ২ বস্তা
  await setElValue(qtyPrice[3], '1150')
  await settle(60)
  check('চালানের চলতি মোট দেখায় (১০×৫৫ + ২×১১৫০ = ২৮৫০)', text().includes('২,৮৫০'), text().slice(-300))

  // সাপ্লায়ার + বাকি
  await setElValue(fieldByLabel('সরবরাহকারী')!, 'মেঘনা ট্রেডার্স')
  await setElValue(fieldByLabel('চালান নম্বর')!, 'CH-১০২')
  await setElValue(fieldByLabel('পেমেন্ট')!, 'বাকি')
  const noteInput = all<HTMLInputElement>('input[placeholder="মন্তব্য (ঐচ্ছিক)"]')[0]
  if (noteInput) await setElValue(noteInput, 'সাপ্তাহিক চালান')
  await submitForm()
  await settle(120)
  const savedPurchases = usePurchaseStore.getState().purchases
  check('দুই সারির ক্রয় সংরক্ষিত', savedPurchases.length === 2, String(savedPurchases.length))
  check('চালানের মোট যোগফল ঠিক (১০×৫৫ = ৫৫০, ২×১১৫০ = ২৩০০)', savedPurchases.reduce((s, p) => s + p.total, 0) === 2850, String(savedPurchases.reduce((s, p) => s + p.total, 0)))
  check('দুই সারির invoice_id একই (একই চালান)', savedPurchases[0].invoice_id === savedPurchases[1].invoice_id && !!savedPurchases[0].invoice_id, String(savedPurchases[0].invoice_id))
  check('invoice_id ফরম্যাট INVYYMMDD…', /^INV\d+$/.test(savedPurchases[0].invoice_id || ''), savedPurchases[0].invoice_id)
  check('সাপ্লায়ার ও চালান নম্বর সংরক্ষিত', savedPurchases[0].supplier === 'মেঘনা ট্রেডার্স' && savedPurchases[0].invoice_no === 'CH-১০২')
  check('বাকি হিসেবে লেখা হয়', savedPurchases.every((p) => p.payment_type === 'বাকি'))
  check('শাখা সক্রিয় শাখায় যায়', savedPurchases.every((p) => p.branch_id === 'branch-1'))
  const prodRice = useProductStore.getState().products.find((p) => p.id === 'p-rice')!
  const prodFeed = useProductStore.getState().products.find((p) => p.id === 'p-feed')!
  check('পণ্যের সর্বশেষ ক্রয়মূল্য হালনাগাদ (চাল ৫৫)', prodRice.purchase_price === 55, String(prodRice.purchase_price))
  check('আগের দামের সাথে মিললে অকারণ আপডেট হয় না (ফিড ১১৫০ ≠ ১২০০ হলে বদলায়)', prodFeed.purchase_price === 1150, String(prodFeed.purchase_price))
  check('সেভের পর সফল বার্তা দেখায়', text().includes('ক্রয় সেভ হয়েছে'), text().slice(-200))
  check('সেভের পর ফর্ম খালি (নতুন চালানের জন্য প্রস্তুত)', (fieldByLabel('সরবরাহকারী') as HTMLInputElement)?.value === '' && all('input[type="number"]').length === 0, (fieldByLabel('সরবরাহকারী') as HTMLInputElement)?.value)

  // সাপ্লায়ারের বাকি হিসাব
  const supplierKey = supplierId('মেঘনা ট্রেডার্স')
  const dues = debtAccounts('supplier', {
    sales: [], purchases: usePurchaseStore.getState().purchases as never, entries: [], collections: [], customers: [],
  })
  check('সাপ্লায়ারের খাতায় দেনা ২৮৫০ জমা হয়', dues.length === 1 && dues[0].id === supplierKey && dues[0].balance === 2850, JSON.stringify(dues.map((d) => ({ b: d.balance }))))

  // বাকি ক্রয়ে সাপ্লায়ার ছাড়া সেভ আটকায়
  await renderAt('/purchases', [['/purchases', Purchases]], { ...managerUser })
  await settle(80)
  await setField('input[placeholder^="পণ্যের নাম"]', 'চাল')
  await settle(40)
  await clickText('মিনিকেট চাল')
  await setElValue(all<HTMLInputElement>('input[type="number"]')[0], '1')
  await setElValue(all<HTMLInputElement>('input[type="number"]')[1], '60')
  await setElValue(fieldByLabel('পেমেন্ট')!, 'বাকি')
  await submitForm()
  await settle(80)
  check('বাকি ক্রয়ে সাপ্লায়ার ছাড়া সেভ হয় না', usePurchaseStore.getState().purchases.length === 2, String(usePurchaseStore.getState().purchases.length))

  // বাকি ক্রয় রোধ — সাপ্লায়ার নামের জায়গায় কেবল স্পেস দিলেও আটকায় কি না
  await setElValue(fieldByLabel('সরবরাহকারী')!, '   ')
  await submitForm()
  await settle(60)
  check('শুধু স্পেস দিলে সাপ্লায়ার ধরা হয় না', usePurchaseStore.getState().purchases.length === 2)

  // পুরোনো তারিখের চালান
  await renderAt('/purchases', [['/purchases', Purchases]], { ...managerUser })
  await settle(80)
  await setField('input[placeholder^="পণ্যের নাম"]', 'চাল')
  await settle(40)
  await clickText('মিনিকেট চাল')
  await setElValue(all<HTMLInputElement>('input[type="number"]')[0], '3')
  await setElValue(all<HTMLInputElement>('input[type="number"]')[1], '60')
  await setElValue(fieldByLabel('সরবরাহকারী')!, 'পুরোনো ডিলার')
  const dateInput = all<HTMLInputElement>('input[type="date"]')[0]
  await setElValue(dateInput, YESTERDAY)
  await settle(60)
  check('পুরোনো তারিখ দিলে সতর্কবার্তা দেখায়', text().includes('পুরানো তারিখ'))
  await submitForm()
  await settle(100)
  const backdated = usePurchaseStore.getState().purchases.find((p) => p.supplier === 'পুরোনো ডিলার')
  check('পুরোনো তারিখেই ক্রয় সেভ হয় (yyyy-mm-dd)', (backdated?.date || '').slice(0, 10) === YESTERDAY, backdated?.date)
  const expectInv = `INV${yymmdd(new Date(`${YESTERDAY}T00:00:00`))}`
  check('পুরোনো তারিখের চালান আইডি সেদিনের সিরিয়াল', (backdated?.invoice_id || '').startsWith(expectInv), `${backdated?.invoice_id} vs ${expectInv}`)

  // নতুন পণ্য যোগ (ক্রয় পেজের মডাল) → লাইনে যায়
  await renderAt('/purchases', [['/purchases', Purchases]], { ...managerUser })
  await settle(80)
  await setField('input[placeholder^="পণ্যের নাম"]', 'ভুট্টা')
  await settle(40)
  await clickText('"ভুট্টা" নতুন পণ্য হিসেবে যোগ করুন')
  await settle(60)
  check('ক্রয় পেজ থেকেই নতুন পণ্য মডাল খোলে', text().includes('নতুন পণ্য যোগ'))
  await setElValue(fieldByLabel('পণ্যের নাম')!, 'ভুট্টা ভাঙা')
  await setElValue(fieldByLabel('ক্রয়মূল্য')!, '30')
  await setElValue(fieldByLabel('বিক্রয়মূল্য')!, '40')
  await submitForm(all('form').at(-1))   // মডালের ফর্ম (পেজের চালান-ফর্ম নয়)
  await settle(120)
  const corn = useProductStore.getState().products.find((p) => p.name === 'ভুট্টা ভাঙা')
  check('নতুন পণ্য তৈরি হয় এবং সরাসরি লাইনে যোগ হয়', !!corn && (bodyText('body').includes('ভুট্টা ভাঙা')), corn?.code || '')
  check('নতুন পণ্যের ডিফল্ট একক কেজি', corn?.unit === 'কেজি')
  check('নতুন পণ্যের শাখা সক্রিয় শাখা', corn?.branch_id === 'branch-1')
}
