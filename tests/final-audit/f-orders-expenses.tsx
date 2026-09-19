/* অডিট পার্ট F — অর্ডার (ক্রেতার অর্ডার, দোকানের প্রক্রিয়া, ডেলিভারি→বিক্রি, বার্তা) ও খরচ এন্ট্রি */
import {React as _React, win, db, check, section, renderAt, settle, text, find, all, clickEl, clickText, setElValue, submitForm, fieldByLabel, buttonByText, buttonsByText as _buttonsByText, seedBase, ownerUser, managerUser, salesmanUser, customerUser, useSalesStore, useProductStore, usePurchaseStore, useStockAdjustmentStore, TODAY, YESTERDAY as _YESTERDAY} from './harness'

const { default: Orders } = await import('../../src/pages/Orders')
const { default: Expenses } = await import('../../src/pages/Expenses')
const { debtAccounts } = await import('../../src/lib/dues')
const { computeStock } = await import('../../src/lib/stock')

const routes: Array<[string, unknown]> = [['/orders', Orders]]
const expRoutes: Array<[string, unknown]> = [['/expenses', Expenses]]

const nfc = (s: string) => s.normalize('NFC')
const hasText = (needle: string) => nfc(text()).includes(nfc(needle))
const orderCard = (id: string) => all('div.card').find((c) => (c.textContent || '').includes(id)) || null

let confirmed = true
const stubDialogs = () => {
  const w = win as unknown as { confirm: (m: string) => boolean }
  w.confirm = () => confirmed
  ;(globalThis as unknown as { confirm: (m: string) => boolean }).confirm = w.confirm
}

const order = (id: string, status: string, extra: Record<string, unknown> = {}) => ({
  id, customer_id: 'c-karim', customer_name: 'ক্রেতা করিম',
  items: [{ product_id: 'p-rice', product_name: 'মিনিকেট চাল', quantity: 10, unit: 'কেজি', sale_price: 75, total: 750 }],
  total_amount: 750, status, branch_id: 'branch-1', created_at: `${TODAY}T08:00:00`, updated_at: `${TODAY}T08:00:00`,
  ...extra,
})

export async function runOrderExpenseAudit() {
  await seedBase()
  stubDialogs()

  /* ════════ ১) ক্রেতার অর্ডার দেওয়া ════════ */
  section('Orders — ক্রেতার অর্ডার দেওয়া')
  await renderAt('/orders', routes, { ...customerUser })
  await settle(220)
  check('ক্রেতার অর্ডার পেজ খোলে (খোঁজার ঘরসহ)', hasText('অর্ডার দিন') && !!all('input[placeholder="পণ্য খুঁজুন..."]')[0], text().slice(0, 160))
  const linked = (await db.customers.toArray()).find((c) => nfc(c.phone || '').includes('01900000000'))
  check('লগইন করা ক্রেতার খাতা নিজে থেকে তৈরি/মিলে যায়', !!linked && linked.id !== 'c-karim', JSON.stringify({ id: linked?.id, name: linked?.name }))
  check('পণ্যের তালিকা দামসহ দেখায়', hasText('মিনিকেট চাল') && hasText('/ কেজি'), text().slice(0, 200))
  /* গরুর ফিড না দেখানোর নিয়ম নেই — সব পণ্যই অর্ডারযোগ্য */
  const qty0 = all<HTMLInputElement>('input[type="number"]')[0]
  await setElValue(qty0, '1')
  await settle(100)
  check('পরিমাণ দিলে কার্টের মোট ও "অর্ডার পাঠান" দেখায়', hasText('অর্ডার পাঠান') && hasText('১,৪০০'), text().slice(0, 220))
  await clickEl(Array.from((qty0.parentElement as HTMLElement).querySelectorAll('button')).pop() || null)
  await settle(100)
  check('+ চাপলে পরিমাণ বাড়ে (১ → ২)', (all<HTMLInputElement>('input[type="number"]')[0] as HTMLInputElement).value === '2', (all<HTMLInputElement>('input[type="number"]')[0] as HTMLInputElement).value)
  await setElValue(all<HTMLInputElement>('input[type="number"]')[0], '1')
  await settle(80)
  await setElValue(all('input[placeholder="মন্তব্য (যেমন কখন লাগবে)"]')[0], 'সকালে দরকার')
  await settle(60)
  await clickEl(buttonByText('অর্ডার পাঠান'))
  await settle(250)
  const placed = (await db.orders.toArray())[0]
  check('অর্ডার সেভ হয় (O… আইডি, pending)', !!placed && /^O\d{6}\d{3}$/.test(placed.id) && placed.status === 'pending', JSON.stringify({ id: placed?.id, s: placed?.status }))
  check('অর্ডারে পণ্য, পরিমাণ, দাম ও মন্তব্য থাকে', placed?.items?.[0]?.product_id === 'p-feed' && placed?.items?.[0]?.quantity === 1 && placed?.items?.[0]?.sale_price === 1400 && placed?.total_amount === 1400 && placed?.note === 'সকালে দরকার', JSON.stringify({ p: placed?.items?.[0]?.product_id, q: placed?.items?.[0]?.quantity, t: placed?.total_amount }))
  check('অর্ডার ক্রেতার খাতায় যায়', placed?.customer_id === linked?.id && placed?.branch_id === 'branch-1')
  check('সেভের পর টোস্ট বার্তা দেখায়', hasText('অর্ডার পাঠানো হয়েছে'), text().slice(0, 200))
  check('"আমার অর্ডার" তালিকায় অর্ডার দেখা যায়', hasText('আমার অর্ডার') && hasText('১,৪০০'), text().slice(0, 260))
  confirmed = true
  await clickText('বাতিল')
  await settle(200)
  check('ক্রেতা নিজের অর্ডার বাতিল করতে পারে', (await db.orders.get(placed!.id))?.status === 'cancelled')

  /* ════════ ২) দোকানের অর্ডার প্রক্রিয়া ════════ */
  section('Orders — দোকান থেকে অর্ডার প্রক্রিয়া')
  await db.orders.clear()
  await db.orders.bulkPut([
    order('O1', 'pending') as never,
    order('O2', 'accepted', { customer_name: 'দ্বিতীয় ক্রেতা' }) as never,
    order('O3', 'delivered', { customer_name: 'তৃতীয় ক্রেতা' }) as never,
    order('O4', 'cancelled', { customer_name: 'চতুর্থ ক্রেতা' }) as never,
  ])
  await renderAt('/orders', routes, { ...managerUser })
  await settle(220)
  check('দোকানের অর্ডার পেজ ও ট্যাব দেখায়', hasText('ক্রেতার অর্ডার') && hasText('চলমান') && hasText('সম্পন্ন/বাতিল') && hasText('বার্তা'))
  check('নতুন অর্ডারের সংখ্যা দেখায়', hasText('১টি নতুন'), text().slice(0, 160))
  check('চলমান ট্যাবে pending ও accepted অর্ডার', hasText('O1') && hasText('O2') && !hasText('O3') && !hasText('O4'), text().slice(0, 300))
  const card1 = orderCard('O1')
  check('অর্ডার কার্ডে ক্রেতা/স্ট্যাটাস/পণ্য/মোট দেখায়', !!card1 && nfc(card1.textContent || '').includes(nfc('ক্রেতা করিম')) && nfc(card1.textContent || '').includes(nfc('অপেক্ষমাণ')) && nfc(card1.textContent || '').includes(nfc('মিনিকেট চাল × ১০ কেজি')) && nfc(card1.textContent || '').includes(nfc('৭৫০')), (card1?.textContent || '').slice(0, 200))
  await clickText('সম্পন্ন/বাতিল')
  await settle(120)
  check('সম্পন্ন ট্যাবে delivered ও cancelled', hasText('O3') && hasText('O4') && !hasText('O1'))
  await clickText('চলমান')
  await settle(120)
  const btnInOrder = (id: string, needle: string) => {
    const card = orderCard(id) as HTMLElement | null
    return card ? Array.from(card.querySelectorAll('button')).find((b) => nfc(b.textContent || '').includes(nfc(needle))) || null : null
  }
  await clickEl(btnInOrder('O1', 'গ্রহণ'))
  await settle(250)
  check('"গ্রহণ" চাপলে অর্ডার গৃহীত হয়', (await db.orders.get('O1'))?.status === 'accepted', String((await db.orders.get('O1'))?.status))
  check('গৃহীত অর্ডারে "ডেলিভারি ও বিক্রি" বোতাম আসে', !!buttonByText('ডেলিভারি ও বিক্রি'))
  await clickEl(btnInOrder('O1', 'ডেলিভারি ও বিক্রি'))
  await settle(150)
  check('ডেলিভারি নিশ্চিতকরণ খোলে (নগদ/বাকি)', hasText('ডেলিভারি নিশ্চিত করুন') && hasText('💵 নগদ') && hasText('📋 বাকি'), text().slice(0, 200))
  check('ডেলিভারিতে বিক্রি ও স্টক কমার কথা লেখে', hasText('বিক্রি এন্ট্রি হবে ও স্টক কমবে'))
  const stockBefore = computeStock(useProductStore.getState().products, usePurchaseStore.getState().purchases, useSalesStore.getState().sales, useStockAdjustmentStore.getState().adjustments).find((s) => s.id === 'p-rice')!.currentStock
  await clickText('💵 নগদ')
  await settle(250)
  const sale = useSalesStore.getState().sales[0]
  check('ডেলিভারিতে নগদ বিক্রি তৈরি হয়', !!sale && sale.payment_type === 'নগদ' && sale.total_amount === 750, JSON.stringify({ id: sale?.id, p: sale?.payment_type }))
  check('ডেলিভারির বিক্রিতে আইটেম ও স্রষ্টা লেখা থাকে', sale?.items?.[0]?.product_name === 'মিনিকেট চাল' && sale?.created_by === managerUser.id, JSON.stringify({ i: sale?.items?.[0]?.product_name }))
  check('বিক্রিতে অর্ডার নম্বর ও ক্রেতা লেখা থাকে', (sale?.note || '').includes('অর্ডার O1') && sale?.customer_id === 'c-karim', sale?.note || '')
  check('স্টক কমে (১০ কেজি)', computeStock(useProductStore.getState().products, usePurchaseStore.getState().purchases, useSalesStore.getState().sales, useStockAdjustmentStore.getState().adjustments).find((s) => s.id === 'p-rice')!.currentStock === stockBefore - 10, String(stockBefore))
  const delivered = await db.orders.get('O1')
  check('অর্ডার ডেলিভারি হয়েছে হিসেবে হালনাগাদ', delivered?.status === 'delivered' && (delivered?.note || '').includes('বিক্রি: '), JSON.stringify({ s: delivered?.status, n: delivered?.note }))
  /* স্টক কম থাকলে সতর্কবার্তা */
  await db.orders.put(order('O5', 'pending', { items: [{ product_id: 'p-feed', product_name: 'গরুর ফিড – তীর', quantity: 999, unit: 'বস্তা', sale_price: 1400, total: 1400 * 999 }], total_amount: 1400 * 999 }) as never)
  await renderAt('/orders', routes, { ...managerUser })
  await settle(250)
  check('অর্ডার কার্ডে স্টকের ঘাটতি দেখায়', hasText('(স্টক'), text().slice(0, 300))
  await clickEl(btnInOrder('O5', 'ডেলিভারি'))
  await settle(180)
  check('স্টক কম থাকলে ডেলিভারিতে সতর্কবার্তা', hasText('স্টক যথেষ্ট নেই') && hasText('স্টক ঋণাত্মক হবে'), text().slice(0, 300))
  await clickText('📋 বাকি')
  await settle(250)
  const dueSale = useSalesStore.getState().sales[0]
  check('বাকি ডেলিভারিতে বাকি বিক্রি হয়', dueSale?.payment_type === 'বাকি' && dueSale?.total_amount === 1400 * 999, JSON.stringify({ p: dueSale?.payment_type }))
  const ledger = await import('../../src/lib/ledger')
  const ledgerData = { entries: [], collections: [], customers: await db.customers.toArray() }
  const accs = debtAccounts('customer', { ...ledgerData, sales: useSalesStore.getState().sales as never, purchases: [] } as never)
  const karim = accs.find((a) => a.id === 'c-karim')
  check('বাকি ডেলিভারি ক্রেতার খাতায় বাকি যোগ করে', !!(karim && karim.balance >= 1400 * 999 - 1), JSON.stringify({ b: karim?.balance }))
  void ledger

  /* ════════ ৩) ক্রেতার বার্তা ════════ */
  section('Orders — ক্রেতার বার্তা (payment/due-info)')
  /* শাখার সীমানা: অন্য শাখার অর্ডার ম্যানেজারের তালিকায় কি আসে? */
  await db.orders.put(order('O-B2', 'pending', { branch_id: 'branch-2', customer_name: 'অন্য শাখার ক্রেতা' }) as never)
  await renderAt('/orders', routes, { ...managerUser })
  await settle(220)
  check('[ফাইন্ডিং] অন্য শাখার অর্ডারও ব্যবস্থাপকের তালিকায় আসে (শাখা-ফিল্টার নেই)', hasText('O-B2'), text().slice(0, 200))
  await renderAt('/orders', routes, { ...ownerUser })
  await settle(200)
  check('মালিক সব শাখার অর্ডার দেখেন', hasText('O-B2'))
  await db.customerMessages.bulkPut([
    { id: 'MSG1', customer_id: 'c-karim', customer_name: 'ক্রেতা করিম', phone: '01711111111', kind: 'payment', amount: 500, method: 'বিকাশ', note: 'টাকা দিয়েছি', branch_id: 'branch-1', seen: false, created_at: `${TODAY}T09:00:00` } as never,
    { id: 'MSG2', customer_id: 'c-other', customer_name: 'অন্য শাখার ক্রেতা', kind: 'due-info', branch_id: 'branch-2', seen: false, created_at: `${TODAY}T09:05:00` } as never,
  ])
  await renderAt('/orders', routes, { ...managerUser })
  await settle(220)
  check('অদেখা বার্তার ব্যাজ/নতুন অর্ডারের সংখ্যা দেখায়', hasText('১'), text().slice(0, 160))
  await clickText('বার্তা')
  await settle(150)
  check('বার্তা ট্যাবে ক্রেতার নাম ও বার্তার ধরন দেখায়', hasText('ক্রেতা করিম') && hasText('টাকা দিয়েছি'), text().slice(0, 260))
  check('বার্তার টাকার পরিমাণ ও মাধ্যম দেখায়', hasText('৫০০') && hasText('বিকাশ'), text().slice(0, 300))
  check('নতুন বার্তা হিসেবে চিহ্নিত', hasText('নতুন বার্তা'))
  check('ব্যবস্থাপক অন্য শাখার বার্তা দেখে না', !hasText('অন্য শাখার ক্রেতা'), text().slice(0, 200))
  await clickText('দেখা হয়েছে')
  await settle(200)
  check('"দেখা হয়েছে" চাপলে বার্তা পড়া হিসেবে সেভ হয়', (await db.customerMessages.get('MSG1'))?.seen === true && !!(await db.customerMessages.get('MSG1'))?.seen_at)
  check('পড়ার পর লেবেল বদলায়', hasText('দেখা হয়েছে'))
  await renderAt('/orders', routes, { ...ownerUser })
  await settle(220)
  await clickText('বার্তা')
  await settle(150)
  check('মালিক সব শাখার বার্তা দেখেন', hasText('ক্রেতা করিম') && hasText('অন্য শাখার ক্রেতা'), text().slice(0, 260))
  check('বার্তা থাকলে খালি অবস্থার লেখা আসে না', !hasText('ক্রেতার কোনো বার্তা নেই'))

  /* ════════ ৪) খরচ এন্ট্রি ════════ */
  section('Expenses — দোকানের খরচ ও মালিকের টাকা তোলা')
  await renderAt('/expenses', expRoutes, { ...managerUser })
  await settle(200)
  check('খরচ পেজ ও খাতের চিপ দেখায়', hasText('খরচ এন্ট্রি') && hasText('ভাড়া') && hasText('বিদ্যুৎ') && hasText('অন্যান্য'), text().slice(0, 200))
  check('খালি অবস্থায় "কোনো খরচ নেই"', hasText('কোনো খরচ নেই'))
  await clickText('বিদ্যুৎ')
  await setElValue(fieldByLabel('টাকা')!, '1200')
  await setElValue(fieldByLabel('পেমেন্ট মাধ্যম')!, 'বিকাশ')
  await setElValue(fieldByLabel('মন্তব্য')!, 'সেপ্টেম্বরের বিল')
  await submitForm(find('form'))
  await settle(220)
  const exp = (await db.expenses.toArray())[0]
  check('দোকানের খরচ সেভ হয় (E… আইডি)', !!exp && /^E\d{6}\d{3}$/.test(exp.id), exp?.id || '')
  check('খরচের খাত/টাকা/মাধ্যম/মন্তব্য ঠিক', exp?.category === 'বিদ্যুৎ' && exp?.amount === 1200 && exp?.payment_method === 'বিকাশ' && exp?.note === 'সেপ্টেম্বরের বিল', JSON.stringify({ c: exp?.category, a: exp?.amount }))
  check('খরচের ধরন shop ও সক্রিয় শাখা', exp?.kind === 'shop' && exp?.branch_id === 'branch-1' && exp?.created_by === managerUser.id, JSON.stringify({ k: exp?.kind, b: exp?.branch_id }))
  check('সেভের টোস্ট বার্তা দেখায়', hasText('খরচ সেভ হয়েছে'), text().slice(0, 200))
  check('টাকা ঘর খালি হয় ও তালিকায় খরচ আসে', fieldByLabel('টাকা', find('form')!)?.value === '' && hasText('সেপ্টেম্বরের বিল'))
  check('মোট খরচ কার্ডে যোগফল দেখায়', hasText('দোকানের খরচ') && hasText('৳ ১,২০০'), text().slice(0, 240))
  /* টাকা ০ হলে সেভ হয় না */
  await setElValue(fieldByLabel('টাকা')!, '0')
  await submitForm(find('form'))
  await settle(180)
  check('শূন্য টাকার খরচ সেভ হয় না', (await db.expenses.count()) === 1, String(await db.expenses.count()))
  /* মালিকের টাকা তোলা */
  await clickText('মালিকের টাকা তোলা')
  await settle(120)
  const chipTexts = () => all('button').map((b) => nfc((b.textContent || '').trim()))
  check('মালিকের খাতের চিপগুলো বদলে যায়', chipTexts().includes('সংসার খরচ') && chipTexts().includes('ব্যক্তিগত') && !chipTexts().includes('বিদ্যুৎ'), chipTexts().filter((t) => ['সংসার খরচ', 'ব্যক্তিগত', 'বিদ্যুৎ', 'ভাড়া'].includes(t)).join(','))
  check('মালিকের খরচে "+ নতুন খাত" থাকে না', !buttonByText('+ নতুন খাত'))
  check('মালিকের খরচে আলাদা ব্যাখ্যা', hasText('মালিকের ব্যক্তিগত টাকা তোলা আলাদা হিসাবে থাকবে'), text().slice(0, 300))
  await setElValue(fieldByLabel('টাকা')!, '5000')
  await submitForm(find('form'))
  await settle(220)
  const ownerExp = (await db.expenses.toArray()).find((x) => x.kind === 'owner')
  check('মালিকের টাকা তোলা kind=owner হিসেবে সেভ হয়', ownerExp?.amount === 5000 && ownerExp?.category === 'সংসার খরচ', JSON.stringify({ a: ownerExp?.amount, c: ownerExp?.category }))
  check('মালিকের টোস্ট বার্তা আলাদা', hasText('মালিকের টাকা তোলা সেভ হয়েছে'))
  check('দুই কার্ডেই আলাদা যোগফল দেখায়', hasText('৳ ১,২০০') && hasText('৳ ৫,০০০'), text().slice(0, 260))

  /* ════════ ৫) খাত যোগ, ফিল্টার, মুছে ফেলা ও অনুমতি ════════ */
  section('Expenses — নতুন খাত, ফিল্টার, ডিলিট ও অনুমতি')
  await clickText('দোকানের খরচ')
  await settle(120)
  await clickText('+ নতুন খাত')
  await settle(100)
  await setElValue(all('input[placeholder="খাতের নাম"]')[0], 'দোকান মেরামত')
  await clickText('যোগ')
  await settle(120)
  check('নতুন খাত যোগ হয় ও নির্বাচিত হয়', hasText('দোকান মেরামত'))
  check('নতুন খাত localStorage-এ সংরক্ষিত', (globalThis.localStorage.getItem('shopledger-expense-categories') || '').includes('দোকান মেরামত'), String(globalThis.localStorage.getItem('shopledger-expense-categories')))
  await clickText('+ নতুন খাত')
  await settle(100)
  await setElValue(all('input[placeholder="খাতের নাম"]')[0], 'দোকান মেরামত')
  await clickText('যোগ')
  await settle(120)
  check('একই খাত দুইবার যোগ হয় না', (globalThis.localStorage.getItem('shopledger-expense-categories') || '').match(/দোকান মেরামত/g)?.length === 1, String(globalThis.localStorage.getItem('shopledger-expense-categories')))
  /* পুরোনো মাসের খরচ ফিল্টারে ধরা পড়ে */
  await db.expenses.add({ id: 'E-OLD', date: '2024-01-15', category: 'ভাড়া', amount: 300, kind: 'shop', payment_method: 'নগদ', branch_id: 'branch-1', created_at: '2024-01-15T09:00:00' } as never)
  await renderAt('/expenses', expRoutes, { ...managerUser })
  await settle(220)
  check('এ মাসের ফিল্টারে পুরোনো মাসের খরচ বাদ', !hasText('১৫/১/২০২৪'), text().slice(0, 300))
  await clickText('আজ')
  await settle(120)
  check('আজ ফিল্টারে আজকের খরচ দেখায়', hasText('১,২০০') && hasText('৫,০০০'), text().slice(0, 300))
  await clickText('সব')
  await settle(140)
  check('সব ফিল্টারে পুরোনো খরচও আসে', hasText('১৫/১/২০২৪'), text().slice(0, 400))
  /* মালিক সব খরচ মুছতে পারেন, কর্মী শুধু নিজের */
  const trash = all('button').filter((b) => (b.getAttribute('class') || '').includes('hover:text-red-600'))
  check('ম্যানেজার নিজের খরচে ডিলিট বোতাম পান', trash.length >= 2, String(trash.length))
  confirmed = false
  await clickEl(trash[0])
  await settle(150)
  check('নিশ্চিতকরণ ছাড়া খরচ মোছে না', (await db.expenses.count()) === 3, String(await db.expenses.count()))
  confirmed = true
  await clickEl(all('button').filter((b) => (b.getAttribute('class') || '').includes('hover:text-red-600'))[0])
  await settle(220)
  check('নিশ্চিত করলে খরচ মোছে', (await db.expenses.count()) === 2, String(await db.expenses.count()))
  await renderAt('/expenses', expRoutes, { ...salesmanUser })
  await settle(200)
  check('সেলস ম্যানও খরচ এন্ট্রি করতে পারে', hasText('খরচ এন্ট্রি') && !hasText('এই পেজ শুধু মালিক ও কর্মচারীর জন্য।'))
  check('সেলস ম্যান অন্যের খরচে ডিলিট বোতাম পান না', all('button').filter((b) => (b.getAttribute('class') || '').includes('hover:text-red-600')).length === 0, String(all('button').filter((b) => (b.getAttribute('class') || '').includes('hover:text-red-600')).length))
  await renderAt('/expenses', expRoutes, { ...customerUser })
  await settle(180)
  check('ক্রেতা খরচ পেজ দেখতে পারে না', hasText('এই পেজ শুধু মালিক ও কর্মচারীর জন্য।'), text().slice(0, 160))
}
