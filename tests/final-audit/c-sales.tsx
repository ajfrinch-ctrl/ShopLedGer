/* অডিট পার্ট C — বিক্রি পেজ: কার্ট, ছাড়, নগদ/বাকি, স্টক সতর্কতা, পুরোনো তারিখ, রসিদ, ইতিহাস, ডিলিট */
import {React, act as _act, win, db, check, section, renderAt, settle, text, find, all, bodyText, clickEl, clickText, setField, setElValue, submitForm as _submitForm, fieldByLabel as _fieldByLabel, buttonByText as _buttonByText, buttonsByText as _buttonsByText, seedBase, ownerUser as _ownerUser, managerUser, salesmanUser, useSalesStore, useCustomerStore as _useCustomerStore, useProductStore, usePurchaseStore as _usePurchaseStore, useStockAdjustmentStore as _useStockAdjustmentStore, dialogText as _dialogText, pressEscape, TODAY, YESTERDAY} from './harness'

const { default: Sales } = await import('../../src/pages/Sales')
const { default: SaleReceipt } = await import('../../src/components/SaleReceipt')
const { orgPadOf } = await import('../../src/lib/orgPad')
const { computeProfitLoss } = await import('../../src/lib/profitLoss')
const { useUiStore } = await import('../../src/stores/uiStore')

const salesRoutes: Array<[string, unknown]> = [['/sales', Sales]]
const cartProduct = async (name: string) => clickEl(all(`button[aria-label="${name} কার্টে যোগ করুন"]`)[0])
const openCart = async () => clickEl(all('button').find((b) => (b.getAttribute('aria-label') || '').startsWith('কার্ট দেখুন')))
const submitSale = async () => clickEl(find('[data-sale-submit]'))
const cartTotal = () => {
  const bar = all('button').find((b) => (b.getAttribute('aria-label') || '').startsWith('কার্ট দেখুন'))
  return (bar?.getAttribute('aria-label') || '').replace(/[^\d০-৯৳,]/g, '')
}
const bnDigits = (n: number) => n.toLocaleString('bn-BD')
const sheetText = () => find('[data-sale-sheet]')?.textContent || ''
const closeReceipt = async () => clickEl(find('[aria-label="রসিদ বন্ধ করুন"]'))
const _closeSheet = async () => clickEl(find('[aria-label="বিল বন্ধ করুন"]'))

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

export async function runSalesAudit() {
  await seedBase()
  stubAlert()
  useUiStore.setState({ staffBranchId: '' })

  /* ════════ ১) পণ্য যোগ → কার্ট → নগদ বিক্রি ════════ */
  section('Sales — কার্ট, হিসাব ও নগদ বিক্রি')
  await renderAt('/sales', salesRoutes, { ...managerUser })
  await settle(120)
  check('সেলস পেজের শিরোনাম ও পণ্যের গ্রিড দেখা যায়', text().includes('পন্য বিক্রি') && all('[data-product-card]').length >= 2)
  check('প্রতিটি পণ্যের কার্ডে স্টক ও দাম দেখায় (বাংলা সংখ্যায়)', text().includes('স্টক ১০০ কেজি') && text().includes('৳৭৫') && text().includes('৳১,৪০০'))

  await setField('input[aria-label="পণ্য খুঁজুন"]', 'তীর')
  await settle(60)
  check('পণ্য খোঁজা কোম্পানির নাম দিয়েও চলে', all('[data-product-card]').length === 1 && text().includes('গরুর ফিড – তীর'), String(all('[data-product-card]').length))
  await setField('input[aria-label="পণ্য খুঁজুন"]', '')
  await settle(60)

  await cartProduct('মিনিকেট চাল')
  await settle(60)
  check('পণ্যে ট্যাপ করলে কার্টে যোগ হয় (১ কেজি × ৭৫)', cartTotal().includes('75') || cartTotal().includes(bnDigits(75)), cartTotal())
  check('কার্ট বার দেখা যায়', !!find('[data-sale-bar]'))
  await clickEl(all('button[aria-label="মিনিকেট চাল বাড়ান"]')[0])
  await settle(40)
  check('গ্রিড থেকেই + চাপলে পরিমাণ বাড়ে (২ কেজি = ১৫০)', cartTotal().includes('150') || cartTotal().includes(bnDigits(150)), cartTotal())
  await clickEl(all('button[aria-label="মিনিকেট চাল কমান"]')[0])
  await settle(40)
  check('− চাপলে পরিমাণ কমে', cartTotal().includes('75') || cartTotal().includes(bnDigits(75)), cartTotal())
  await clickEl(all('button[aria-label="মিনিকেট চাল কমান"]')[0])
  await settle(40)
  check('শূন্য হলে পণ্য কার্ট থেকে বাদ যায়', !find('[data-sale-bar]'))

  // দুই পণ্য + পরিমাণ/দাম সম্পাদনা (কার্ট শিটে)
  await cartProduct('মিনিকেট চাল')
  await cartProduct('গরুর ফিড – তীর')
  await settle(60)
  await openCart()
  await settle(60)
  check('কার্ট শিটে দুইটি পণ্য ও মোট দেখা যায়', sheetText().includes('মিনিকেট চাল') && sheetText().includes('গরুর ফিড – তীর') && sheetText().includes('সর্বমোট'))
  await setElValue(find('input[aria-label="মিনিকেট চাল পরিমাণ (কেজি)"]')!, '3')
  await setElValue(find('input[aria-label="মিনিকেট চাল বিক্রয় দাম"]')!, '70')
  await settle(60)
  check('কার্টে পরিমাণ/দাম সম্পাদনা করলে সারির মোট বদলায় (৩×৭০=২১০)', sheetText().includes('২১০'), sheetText().slice(0, 200))
  check('সাবমিট বোতামে সর্বমোট দেখায়', (find('[data-sale-submit]')?.textContent || '').includes('১,৬১০'), find('[data-sale-submit]')?.textContent || '')

  await submitSale()
  await settle(150)
  const sales1 = useSalesStore.getState().sales
  check('বিক্রি সংরক্ষিত (১টি)', sales1.length === 1, String(sales1.length))
  check('বিক্রির হিসাব ঠিক (৩×৭০ + ১×১৪০০ = ১৬১০)', sales1[0].total_amount === 1610, String(sales1[0].total_amount))
  check('লাভ = (৭০−৬০)×৩ + (১৪০০−১২০০)×১ = ২৩০', sales1[0].total_profit === 230, String(sales1[0].total_profit))
  check('নগদ বিক্রি হিসেবে লেখা', sales1[0].payment_type === 'নগদ')
  check('ক্রেতা ছাড়া নগদ বিক্রি চলে', !sales1[0].customer_id)
  check('সেল আইডি ফরম্যাট S…', /^S\d+$/.test(sales1[0].id), sales1[0].id)
  check('sync মেটাডেটা (uid) যোগ হয়', !!(sales1[0] as unknown as { uid?: string })?.uid)
  check('শাখা ও সৃষ্টিকর্তা লেখা হয়', sales1[0].branch_id === 'branch-1' && sales1[0].created_by === 'manager-1')
  check('সেভের পর সফল বার্তা ও কার্ট খালি', text().includes('বিক্রি সফলভাবে সেভ হয়েছে') && !find('[data-sale-bar]'))
  const riceStock = all('[data-product-card]').find((c) => (c.textContent || '').includes('মিনিকেট চাল'))?.textContent || ''
  check('স্টক কমেছে (১০০ − ৩ = ৯৭)', riceStock.includes('৯৭'), riceStock.slice(0, 80))

  /* ════════ ২) রসিদ ════════ */
  section('Sales — রসিদ (প্যাড, ছাড়, লাভ গোপন)')
  check('সেভের পরেই রসিদ খোলে', text().includes('বিক্রয় রসিদ') || !!find('[data-pad]'))
  const pad = orgPadOf(await db.branches.get('branch-1'))
  const receiptText = text()
  check('রসিদে প্রতিষ্ঠানের নাম (প্যাড)', receiptText.includes(pad.name))
  check('রসিদে ঠিকানা ও ফোন', receiptText.includes('আমুচিয়া') && receiptText.includes('01821989717'))
  check('রসিদে ক্রয়-মূল্য/লাভ ফাঁস হয় না', !receiptText.includes('লাভ'))
  check('রসিদে PDF ও ছবি শেয়ার বোতাম আছে', receiptText.includes('PDF ডাউনলোড') && receiptText.includes('ছবি শেয়ার'))
  /* অডিট-ফাইন্ডিং: LedgerReceipt/report ডায়ালগে Escape কাজ করে, কিন্তু বিক্রির
     রসিদে (SaleReceipt) কোনো keydown/focus-trap/scroll-lock নেই। */
  const overflowBefore = win.document.body.style.overflow
  await pressEscape()
  await settle(60)
  check('[ফাইন্ডিং] বিক্রির রসিদে Escape কাজ করে না (অন্য ডায়ালগে করে)', !!find('[data-pad]'))
  check('[ফাইন্ডিং] রসিদ খোলা থাকলেও পেছনের পেজ স্ক্রল-লক হয় না', win.document.body.style.overflow === overflowBefore)
  await closeReceipt()
  await settle(60)
  check('× চাপলে রসিদ বন্ধ হয়', !find('[data-pad]'))

  /* ════════ ৩) ছাড় (ডিসকাউন্ট) ════════ */
  section('Sales — ছাড়, পরিশোধ, লাভের হিসাব')
  await cartProduct('মিনিকেট চাল')
  await settle(40)
  await openCart()
  await settle(60)
  await clickText('ছাড় ৳১০০')
  await settle(60)
  check('এক ট্যাপে ৳১০০ ছাড় বসে (সাবটোটাল ৭৫-এ সীমিত → ৭৫ ছাড়)', sheetText().includes('-৳৭৫') && (find('input[placeholder="০"]') as HTMLInputElement)?.value === '100', sheetText().slice(0, 160))
  check('ছাড় সাবটোটালের বেশি হলে সর্বমোট ০-এর নিচে যায় না', (find('[data-sale-submit]')?.textContent || '').includes('০'))
  await setElValue(find('input[placeholder="০"]')!, '25')
  await settle(60)
  check('নিজে ছাড় লিখলে সেটাই ধরা হয়', (find('[data-sale-submit]')?.textContent || '').includes('৫০'), find('[data-sale-submit]')?.textContent || '')
  await clickText('১০% ছাড়')
  await settle(50)
  check('শতকরা ছাড় পূর্ণ টাকায় রাউন্ড হয় (৭৫-এর ১০% → ৮)', sheetText().includes('-৳৮'), sheetText().slice(0, 200))
  await submitSale()
  await settle(150)
  const discounted = useSalesStore.getState().sales[0]
  check('ছাড়সহ বিক্রি সংরক্ষিত (subtotal ৭৫, ছাড় ৮, মোট ৬৭)', discounted.subtotal === 75 && discounted.discount === 8 && discounted.total_amount === 67, JSON.stringify({ s: discounted.subtotal, d: discounted.discount, t: discounted.total_amount }))
  check('ছাড় বাদ দিয়ে লাভ (১৫ − ৮ = ৭)', discounted.total_profit === 7, String(discounted.total_profit))
  await closeReceipt()
  await settle(60)

  /* ════════ ৪) পরিশোধ মোড (কত টাকা নেওয়া হলো) ════════ */
  section('Sales — "পরিশোধ" দিয়ে বাকি হিসাব')
  await cartProduct('মিনিকেট চাল')
  await settle(40)
  await openCart()
  await settle(60)
  /* শিটের নম্বর-ইনপুট ক্রম: [পরিমাণ, দাম, ছাড়, পরিশোধ] */
  const sheetNums = () => all<HTMLInputElement>('input[type="number"]')
  await setElValue(sheetNums()[3], '50')
  await settle(60)
  check('৫০ টাকা নিলে ছাড় হয় ২৫, প্রদেয় ৫০', sheetText().includes('-৳২৫') && (find('[data-sale-submit]')?.textContent || '').includes('৫০'), sheetText().slice(0, 200))
  await submitSale()
  await settle(150)
  const partial = useSalesStore.getState().sales[0]
  check('আংশিক পরিশোধে মোট ৫০, ছাড় ২৫', partial.total_amount === 50 && partial.discount === 25 && partial.subtotal === 75, JSON.stringify({ t: partial.total_amount, d: partial.discount, s: partial.subtotal }))
  await closeReceipt()
  await settle(60)

  /* ════════ ৫) বাকি বিক্রি — ক্রেতা বাধ্যতামূলক ════════ */
  section('Sales — বাকি বিক্রি, ক্রেতা নির্বাচন ও নতুন ক্রেতা')
  await cartProduct('গরুর ফিড – তীর')
  await settle(40)
  await openCart()
  await settle(60)
  await clickText('📋 বাকি')
  await settle(60)
  check('বাকি নির্বাচনে ক্রেতা ছাড়া সেভ বন্ধ', (find('[data-sale-submit]') as HTMLButtonElement)?.disabled === true && (find('[data-sale-submit]')?.textContent || '').includes('আগে ক্রেতা নির্বাচন করুন'))
  check('ক্রেতা বাছার অনুরোধ দেখায়', sheetText().includes('বাকি লিখতে ক্রেতার নাম দরকার'))
  await clickText('ক্রেতা বাছুন')
  await settle(60)
  await setField('input[aria-label="ক্রেতা খুঁজুন"]', 'করিম')
  await settle(60)
  await clickText('ক্রেতা করিম')
  await settle(60)
  check('ক্রেতা নির্বাচিত (নাম+ফোন দেখায়)', text().includes('নির্বাচিত ক্রেতা') && text().includes('01711111111'))
  check('ক্রেতার সারাংশ (মোট কেনাকাটা/বাকি) দেখায়', text().includes('মোট কেনাকাটা') && text().includes('বর্তমান বাকি'))
  await openCart()
  await settle(60)
  check('বাকি নির্বাচনে ক্রেতার নামে বাকি যোগের বার্তা', sheetText().includes('এর বাকিতে') && sheetText().includes('যোগ হবে'))
  check('বাকি বিক্রিতে সাবমিট সক্রিয়', (find('[data-sale-submit]') as HTMLButtonElement)?.disabled === false)
  await submitSale()
  await settle(150)
  const dueSale = useSalesStore.getState().sales[0]
  check('বাকি বিক্রি সংরক্ষিত (ক্রেতা সহ)', dueSale.payment_type === 'বাকি' && dueSale.customer_id === 'c-karim' && dueSale.customer_name === 'ক্রেতা করিম', JSON.stringify({ p: dueSale.payment_type, c: dueSale.customer_id }))
  check('বাকি বিক্রির মোট ঠিক (১৪০০)', dueSale.total_amount === 1400)
  await closeReceipt()
  await settle(60)

  // নতুন ক্রেতা যোগ (সেলস পেজের মডাল)
  await cartProduct('গরুর ফিড – তীর')
  await settle(40)
  await openCart()
  await settle(60)
  await clickText('📋 বাকি')
  await settle(40)
  await clickEl(find('button[aria-label="নতুন ক্রেতা যোগ করুন"]'))
  await settle(60)
  check('নতুন ক্রেতার মডাল খোলে', text().includes('নতুন ক্রেতা'))
  await setElValue(all('input[placeholder="ক্রেতার নাম"]')[0], 'নতুন ক্রেতা জসিম')
  await setElValue(all('input[placeholder="01XXXXXXXXX"]')[0], '01812345678')
  await setElValue(all('input[placeholder="গ্রাম/রোড, এলাকা"]')[0], 'নতুন পাড়া')
  await clickText('সংরক্ষণ করুন')
  await settle(120)
  const newCust = (await db.customers.toArray()).find((c) => c.phone === '01812345678')
  check('নতুন ক্রেতা ডেটাবেসে তৈরি হয়', !!newCust && newCust.name === 'নতুন ক্রেতা জসিম', JSON.stringify(newCust || {}))
  check('নতুন ক্রেতা নিজে থেকেই নির্বাচিত হয়', text().includes('নির্বাচিত ক্রেতা') && text().includes('নতুন ক্রেতা জসিম'))
  await submitSale()
  await settle(150)
  check('নতুন ক্রেতার বাকি বিক্রি সেভ হয়', useSalesStore.getState().sales[0].customer_id === newCust?.id)
  await closeReceipt()
  await settle(60)

  /* ════════ ৬) স্টক কম হলে নিশ্চিতকরণ ════════ */
  section('Sales — স্টক কম থাকলে সতর্কতা ও ঋণাত্মক স্টক')
  await renderAt('/sales', salesRoutes, { ...managerUser })
  await settle(120)
  await cartProduct('গরুর ফিড – তীর')
  await settle(40)
  await openCart()
  await settle(60)
  await setElValue(find('input[aria-label="গরুর ফিড – তীর পরিমাণ (বস্তা)"]')!, '50')
  await settle(60)
  const beforeCount = useSalesStore.getState().sales.length
  await submitSale()
  await settle(100)
  check('প্রথম চাপে সেভ হয় না, নিশ্চিতকরণ দেখায়', useSalesStore.getState().sales.length === beforeCount && text().includes('স্টক যথেষ্ট নেই'))
  check('নিশ্চিতকরণে কোন পণ্য কত কম তা দেখায়', text().includes('গরুর ফিড') && text().includes('স্টক'))
  await clickText('বাতিল')
  await settle(60)
  check('বাতিল করলে সেভ হয় না', useSalesStore.getState().sales.length === beforeCount)
  await submitSale()
  await settle(60)
  await clickText('হ্যাঁ, সেভ করুন')
  await settle(150)
  check('নিশ্চিত করলে ঋণাত্মক স্টক নিয়েও সেভ হয়', useSalesStore.getState().sales.length === beforeCount + 1)
  check('স্টক ঋণাত্মক দেখায়', all('[data-product-card]').find((c) => (c.textContent || '').includes('গরুর ফিড'))?.textContent?.includes('-') === true)
  await closeReceipt()
  await settle(60)

  /* ════════ ৭) পুরোনো তারিখের বিক্রি ════════ */
  section('Sales — পুরোনো তারিখে এন্ট্রি')
  await renderAt('/sales', salesRoutes, { ...managerUser })
  await settle(120)
  await cartProduct('মিনিকেট চাল')
  await settle(40)
  await openCart()
  await settle(60)
  const dateField = all<HTMLInputElement>('input[type="date"]')[0]
  await setElValue(dateField, YESTERDAY)
  await settle(80)
  check('পুরোনো তারিখে সতর্কবার্তা ব্যানার দেখায়', text().includes('তারিখের বিক্রি এন্ট্রি চলছে') || text().includes('পুরানো তারিখ'))
  await submitSale()
  await settle(150)
  const backdated = useSalesStore.getState().sales[0]
  check('পুরোনো তারিখেই বিক্রি সেভ হয়', (backdated.date || '').slice(0, 10) === YESTERDAY, backdated.date)
  await closeReceipt()
  await settle(80)
  await clickText('আজকের বিক্রি')
  await settle(100)
  check('পুরোনো তারিখের বিক্রি আজকের তালিকায় আসে না', !bodyText('body').includes('পুরানো তারিখে দেওয়া বিক্রি এখানে থাকবে না') || !all('body *').some((e) => (e.textContent || '').includes('১টি')))
  check('তালিকার নোটে ব্যাখ্যা আছে', text().includes('পুরানো তারিখে দেওয়া বিক্রি এখানে থাকবে না'))

  /* ════════ ৮) আজকের বিক্রির তালিকা, রসিদ ও ডিলিট ════════ */
  section('Sales — আজকের বিক্রির তালিকা ও ডিলিট')
  await renderAt('/sales', salesRoutes, { ...managerUser })
  await settle(120)
  const today = useSalesStore.getState().sales.filter((s) => s.date.slice(0, 10) === TODAY)
  await clickText('আজকের বিক্রি')
  await settle(100)
  check('আজকের বিক্রির সংখ্যা দেখায়', text().includes(`আজকের বিক্রি (${today.length.toLocaleString('bn-BD')}টি)`) || all('h3').some((h) => (h.textContent || '').includes('আজকের বিক্রি')), text().slice(0, 120))
  check('বিক্রির কার্ডে ধরন ও মোট দেখায়', text().includes('বাকি') && text().includes('নগদ'))
  await clickEl(all('button[title="রসিদ দেখুন / শেয়ার করুন"]')[0])
  await settle(100)
  check('পুরোনো বিক্রির রসিদ আবার খোলা যায়', !!find('[data-pad]'))
  await closeReceipt()
  await settle(60)

  // পেন্সিল চেপে বিস্তারিত (লাভ) দেখা
  await clickEl(all('button').filter((b) => (b.getAttribute('class') || '').includes('hover:text-blue-600'))[0])
  await settle(60)
  check('বিস্তারিতে আইটেম ও লাভ দেখা যায় (ব্যবস্থাপক)', text().includes('লাভ'))

  // ডিলিট — আদায় থাকলে আটকায়
  const karimSale = useSalesStore.getState().sales.find((s) => s.payment_type === 'বাকি' && s.customer_id === 'c-karim')!
  await db.ledgerEntries.put({
    id: 'pay-guard', party_id: 'c-karim', party_name: 'ক্রেতা করিম', party_type: 'customer', kind: 'payment',
    amount: 100, date: TODAY, branch_id: 'branch-1', method: 'নগদ টাকা', reference: '', note: '', cancelled: false,
    created_by: 'manager-1', created_at: '',
  })
  await renderAt('/sales', salesRoutes, { ...managerUser })
  await settle(120)
  await clickText('আজকের বিক্রি')
  await settle(100)
  const karimCard = all('div').filter((d) => (d.getAttribute('class') || '').includes('bg-white rounded-xl p-3')).find((d) => (d.textContent || '').includes('ক্রেতা করিম'))
  await clickEl(karimCard?.querySelectorAll('button')[2] as HTMLElement)  // ট্র্যাশ
  await settle(60)
  await clickText('নিশ্চিত?')
  await settle(120)
  check('আদায় থাকা ক্রেতার বাকি বিক্রি ডিলিট আটকায়', useSalesStore.getState().sales.some((s) => s.id === karimSale.id))
  check('কারণসহ সতর্কবার্তা (alert)', alerted.normalize('NFC').includes('আদায়'.normalize('NFC')), alerted)
  await db.ledgerEntries.delete('pay-guard')

  // ডিলিট — আদায় না থাকলে চলে
  const other = useSalesStore.getState().sales.find((s) => s.id !== karimSale.id && s.date.slice(0, 10) === TODAY)!
  const before = useSalesStore.getState().sales.length
  await renderAt('/sales', salesRoutes, { ...managerUser })
  await settle(120)
  await clickText('আজকের বিক্রি')
  await settle(100)
  const cards = all('div').filter((d) => (d.getAttribute('class') || '').includes('bg-white rounded-xl p-3'))
  const otherCard = cards.find((d) => (d.textContent || '').includes(`৳ ${other.total_amount.toLocaleString('bn-BD')}`))
  await clickEl(otherCard?.querySelectorAll('button')[2] as HTMLElement)
  await settle(60)
  await clickText('নিশ্চিত?')
  await settle(120)
  check('আদায় না থাকলে বিক্রি ডিলিট হয়', useSalesStore.getState().sales.length === before - 1, String(useSalesStore.getState().sales.length))
  check('ডিলিট করা বিক্রি আর তালিকায় নেই', !useSalesStore.getState().sales.some((s) => s.id === other.id))

  /* ════════ ৯) সেলস ম্যানের অনুমতি (লাভ লুকানো) ════════ */
  section('Sales — সেলস ম্যানের জন্য লাভ গোপন')
  await renderAt('/sales', salesRoutes, { ...salesmanUser })
  await settle(120)
  await cartProduct('মিনিকেট চাল')
  await settle(40)
  await openCart()
  await settle(80)
  check('সেলস ম্যানের কার্ট শিটে লাভ দেখায় না', !sheetText().includes('লাভ ৳'))
  await submitSale()
  await settle(150)
  await closeReceipt()
  await settle(80)
  await clickText('আজকের বিক্রি')
  await settle(100)
  await clickEl(all('button').filter((b) => (b.getAttribute('class') || '').includes('hover:text-blue-600'))[0])
  await settle(60)
  check('সেলস ম্যানের ইতিহাস বিস্তারিতেও লাভ নেই', !all('body *').some((e) => (e.children.length === 0 && (e.textContent || '').trim() === 'লাভ')))

  /* ════════ ১০) শাখা ও হিসাবের সমন্বয় ════════ */
  section('Sales — শাখা ও লাভ-ক্ষতির সাথে মিল')
  const profit = computeProfitLoss(useSalesStore.getState().sales as never, [], [], { from: '2000-01-01', to: '2100-01-01' })
  const sumProfit = useSalesStore.getState().sales.reduce((s, x) => s + x.total_profit, 0)
  const sumTotal = useSalesStore.getState().sales.reduce((s, x) => s + x.total_amount, 0)
  check('লাভ-ক্ষতির হিসাব বিক্রির যোগফলের সাথে মেলে', profit.grossProfit === sumProfit && profit.revenue === sumTotal, JSON.stringify({ p: profit.grossProfit, s: sumProfit }))
  const riceNow = useProductStore.getState().products.find((p) => p.id === 'p-rice')!
  check('বিক্রি করলে পণ্যের দাম/ক্রয়মূল্য বদলায় না (৭৫/৬০)', riceNow.sale_price === 75 && riceNow.purchase_price === 60, JSON.stringify({ s: riceNow.sale_price, p: riceNow.purchase_price }))

  /* ════════ ১১) রসিদ কম্পোনেন্ট সরাসরি (দাম/ছাড়/লাভ) ════════ */
  section('SaleReceipt কম্পোনেন্ট — সর্বমোট হিসাব ও ছাড়')
  const saleWithDiscount = {
    id: 'S-TEST', date: `${TODAY}T10:00:00`, items: [
      { product_id: 'p-rice', product_name: 'মিনিকেট চাল', quantity: 2, unit: 'কেজি', sale_price: 100, purchase_price: 60, total: 200, profit: 80 },
    ], subtotal: 300, discount: 100, total_amount: 200, total_profit: 80, payment_type: 'নগদ' as const,
    branch_id: 'branch-1', created_by: 'manager-1', created_at: `${TODAY}T10:00:00`,
    customer_name: 'ক্রেতা করিম', customer_id: 'c-karim',
  }
  const ReceiptProbe = () =>
    React.createElement(SaleReceipt, { sale: saleWithDiscount as never, pad: pad as never, customerPhone: '01711111111', onClose: () => {} })
  await renderAt('/probe-receipt', [['/probe-receipt', ReceiptProbe]])
  const rt = text()
  check('রসিদে বিক্রিত দাম/ছাড়/সর্বমোট (৩০০ / ১০০ / ২০০) দেখায়', rt.includes('৩০০') && rt.includes('১০০') && rt.includes('২০০'), rt.slice(0, 260))
  check('রসিদে ক্রেতার ফোন দেখায়', rt.includes('01711111111'), rt.slice(0, 260))
  check('রসিদে লাভের কোনো লাইন নেই', !rt.includes('লাভ'), rt.slice(0, 260))

  /* ════════ ১২) কার্ট রিসেট ════════ */
  section('Sales — সেভের পর ফর্ম রিসেট')
  await renderAt('/sales', salesRoutes, { ...managerUser })
  await settle(120)
  await cartProduct('মিনিকেট চাল')
  await openCart()
  await settle(60)
  await clickText('📋 বাকি')
  await clickText('ক্রেতা বাছুন')
  await setField('input[aria-label="ক্রেতা খুঁজুন"]', 'করিম')
  await settle(60)
  await clickText('ক্রেতা করিম')
  await settle(60)
  await openCart()
  await settle(60)
  await submitSale()
  await settle(150)
  await closeReceipt()
  await settle(80)
  check('সেভের পর কার্ট খালি ও পেমেন্ট নগদে ফেরে', !find('[data-sale-bar]') && !text().includes('নির্বাচিত ক্রেতা'))
}
