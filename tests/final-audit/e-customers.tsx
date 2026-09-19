/* অডিট পার্ট E — ক্রেতা তালিকা (যোগ/সম্পাদন/অনুমোদন) ও ক্রেতার প্রোফাইল
   (বাকির হিসাব, কেনাকাটার ইতিহাস, রসিদ, হিসাব বিবরণী, তাগাদা, মুছে ফেলা) */
import {React as _React, win, db, check, section, renderAt, settle, text, find, all, clickEl, clickText, setElValue, submitForm, fieldByLabel, buttonByText, buttonsByText, seedBase, ownerUser, managerUser, customerUser, useSalesStore, useCustomerStore as _useCustomerStore, useUiStore, TODAY} from './harness'
import type { Sale } from '../../src/types'

const { default: Customers } = await import('../../src/pages/Customers')
const { default: CustomerProfile } = await import('../../src/pages/CustomerProfile')
const routes: Array<[string, unknown]> = [['/customers', Customers], ['/customers/:id', CustomerProfile]]

const nfc = (s: string) => s.normalize('NFC')
const hasText = (needle: string) => nfc(text()).includes(nfc(needle))
const customerRow = (name: string) =>
  all('button.card').find((b) => nfc(b.textContent || '').includes(nfc(name)) && (b.textContent || '').includes('কেনাকাটা')) || null

let alerted = ''
let confirmed = false
let openedUrl = ''
const stubDialogs = () => {
  alerted = ''
  const w = win as unknown as {
    alert: (m: string) => void; confirm: (m: string) => boolean; open: (u: string) => null
  }
  w.alert = (m: string) => { alerted = String(m) }
  w.confirm = () => confirmed
  w.open = (u: string) => { openedUrl = String(u); return null }
  const g = globalThis as unknown as typeof w
  g.alert = w.alert; g.confirm = w.confirm; g.open = w.open
}

const dueSale: Sale = {
  id: 'S-E-001', date: `${TODAY}T10:00:00`,
  items: [{
    product_id: 'p-rice', product_name: 'মিনিকেট চাল', quantity: 20, unit: 'কেজি',
    sale_price: 75, purchase_price: 60, total: 1500, profit: 300,
  }],
  subtotal: 1500, discount: 0, total_amount: 1500, total_profit: 300,
  payment_type: 'বাকি', customer_id: 'c-karim', customer_name: 'ক্রেতা করিম',
  customer_phone: '01711111111', branch_id: 'branch-1', created_by: 'manager-1',
  created_at: `${TODAY}T10:00:00`,
} as Sale

const pendingUser = (id: string, name: string, phone: string, extra: Record<string, unknown> = {}) => ({
  id, name, phone, password_hash: 'x', role: 'customer' as const, is_active: false,
  approval: 'pending', branch_id: 'branch-1', created_at: new Date().toISOString(), ...extra,
})

export async function runCustomerAudit() {
  await seedBase()
  stubDialogs()
  useSalesStore.setState({ sales: [dueSale] })

  /* ════════ ১) ক্রেতার তালিকা ════════ */
  section('Customers — ক্রেতার তালিকা, সারাংশ ও খোঁজা')
  await renderAt('/customers', routes, { ...ownerUser })
  await settle(180)
  check('তালিকা পেজের শিরোনাম ও নতুন ক্রেতা বোতাম', hasText('ক্রেতা') && !!buttonByText('নতুন ক্রেতা'))
  check('মোট ক্রেতার সংখ্যা দেখায় (২ জন)', hasText('মোট ক্রেতা') && hasText('২ জন'), text().slice(0, 200))
  check('মোট বাকি কার্ডে বাকিদার সংখ্যা ও টাকা দেখায়', hasText('মোট বাকি (১ জন)') && hasText('৳ ১,৫০০'), text().slice(0, 240))
  const karimRow = customerRow('ক্রেতা করিম')
  const karimText = karimRow?.textContent || ''
  check('ক্রেতার সারিতে আইডি/কেনাকাটার সংখ্যা/বাকি দেখায়', !!karimRow && nfc(karimText).includes(nfc('(c-karim)')) && nfc(karimText).includes(nfc('১টি কেনাকাটা')) && nfc(karimText).includes(nfc('৳ ১,৫০০')), karimText.slice(0, 160))
  const otherRow = customerRow('অন্য শাখার ক্রেতা')
  check('বাকি না থাকলে "বাকি নেই" দেখায়', !!otherRow && nfc(otherRow.textContent || '').includes(nfc('বাকি নেই')), (otherRow?.textContent || '').slice(0, 120))
  await setElValue(all('input[placeholder="নাম বা ফোন দিয়ে খুঁজুন..."]')[0], '01711111111')
  await settle(80)
  check('ফোন দিয়ে খোঁজা কাজ করে', !!customerRow('ক্রেতা করিম') && !customerRow('অন্য শাখার ক্রেতা'))
  await setElValue(all('input[placeholder="নাম বা ফোন দিয়ে খুঁজুন..."]')[0], 'যে-নাম-নেই')
  await settle(80)
  check('না পেলে খালি অবস্থার বার্তা', hasText('কোনো ক্রেতা পাওয়া যায়নি'))
  await setElValue(all('input[placeholder="নাম বা ফোন দিয়ে খুঁজুন..."]')[0], '')
  await settle(80)
  await clickEl(buttonByText('মোট বাকি'))
  await settle(80)
  check('"মোট বাকি" চাপলে শুধু বাকিদার দেখায়', !!customerRow('ক্রেতা করিম') && !customerRow('অন্য শাখার ক্রেতা'), text().slice(0, 200))
  await clickEl(buttonByText('মোট বাকি'))
  await settle(80)
  check('আবার চাপলে সব ক্রেতা ফিরে আসে', !!customerRow('অন্য শাখার ক্রেতা'))

  /* ════════ ২) নতুন ক্রেতা যোগ ও ডুপ্লিকেট আটকানো ════════ */
  section('Customers — নতুন ক্রেতা যোগ (ডুপ্লিকেট নিয়ম)')
  await clickText('নতুন ক্রেতা')
  await settle(100)
  check('নতুন ক্রেতার ফর্ম খোলে', hasText('নতুন ক্রেতা') && !!fieldByLabel('নাম'))
  const saveBtn = () => buttonByText('সংরক্ষণ')
  await submitForm(find('form'))
  await settle(120)
  check('নাম খালি থাকলে কোনো ক্রেতা তৈরি হয় না (required)', (await db.customers.toArray()).length === 2, String((await db.customers.toArray()).length))
  void saveBtn
  await setElValue(fieldByLabel('নাম')!, 'নতুন ক্রেতা সেলিম')
  await setElValue(fieldByLabel('মোবাইল নম্বর')!, '01733333333')
  await setElValue(fieldByLabel('ঠিকানা')!, 'নতুন বাজার')
  await submitForm(find('form'))
  await settle(180)
  const selim = (await db.customers.toArray()).find((c) => c.phone === '01733333333')
  check('নতুন ক্রেতা ডেটাবেসে যোগ হয় (C… আইডি, সক্রিয় শাখা)', !!selim && /^C\d{4}\d{3}$/.test(selim.id) && selim.branch_id === 'branch-1' && selim.address === 'নতুন বাজার', JSON.stringify({ id: selim?.id, b: selim?.branch_id }))
  check('নতুন ক্রেতা তালিকায় দেখা যায়', !!customerRow('নতুন ক্রেতা সেলিম'))
  await clickText('নতুন ক্রেতা')
  await settle(100)
  await setElValue(fieldByLabel('নাম')!, 'আরেক জন')
  await setElValue(fieldByLabel('মোবাইল নম্বর')!, '01711111111')
  await settle(60)
  check('একই নম্বর দিলে সতর্কবার্তা দেয়', hasText('এই নম্বরটি "ক্রেতা করিম"-এর'), text().slice(0, 200))
  const beforeDup = (await db.customers.toArray()).length
  await submitForm(find('form'))
  await settle(150)
  check('একই নম্বরে সংরক্ষণ আটকে যায়', (await db.customers.toArray()).length === beforeDup, String((await db.customers.toArray()).length))
  await setElValue(fieldByLabel('মোবাইল নম্বর')!, '01744444444')
  await setElValue(fieldByLabel('নাম')!, 'ক্রেতা করিম')
  await settle(60)
  confirmed = false
  await submitForm(find('form'))
  await settle(180)
  check('একই নাম হলে নিশ্চিতকরণ ছাড়া যোগ হয় না', !(await db.customers.toArray()).some((c) => c.phone === '01744444444'), `alerted=${alerted}`)
  confirmed = true
  await submitForm(find('form'))
  await settle(200)
  check('একই নামে নিশ্চিত করলে যোগ করা যায়', (await db.customers.toArray()).some((c) => c.phone === '01744444444'))

  /* ════════ ৩) অনুমোদনের অপেক্ষায় সাইন-আপ ════════ */
  section('Customers — সাইন-আপ অনুমোদন')
  await db.users.bulkPut([pendingUser('cu-1', 'পেন্ডিং ক্রেতা', '01799999999') as never, pendingUser('cu-2', 'বাতিলযোগ্য ক্রেতা', '01788888888') as never])
  await renderAt('/customers', routes, { ...managerUser })
  await settle(200)
  check('ব্যবস্থাপক অনুমোদনের তালিকা দেখেন', hasText('অনুমোদনের অপেক্ষায় (২)'))
  check('ব্যবস্থাপক অনুমোদন দিতে পারেন না', hasText('অনুমোদন দিতে পারবেন মালিক।') && !buttonByText('অনুমোদন'))
  await renderAt('/customers', routes, { ...ownerUser })
  await settle(200)
  check('মালিক "অনুমোদন" ও "বাতিল" বোতাম পান', !!buttonByText('অনুমোদন') && !!buttonByText('বাতিল'))
  await clickText('অনুমোদন')
  await settle(120)
  check('অনুমোদনের শিট খোলে', hasText('ক্রেতার সাইন-আপ অনুমোদন'), text().slice(0, 200))
  await clickText('অনুমোদন দিন')
  await settle(220)
  const approved = await db.users.get('cu-1')
  check('অনুমোদনে ইউজার সক্রিয় হয়', approved?.is_active === true && approved?.approval === 'approved' && approved?.branch_id === 'branch-1', JSON.stringify({ a: approved?.approval, b: approved?.branch_id }))
  const approvedCustomer = (await db.customers.toArray()).find((c) => c.phone === '01799999999')
  check('অনুমোদনে ক্রেতা তালিকায় নতুন খাতা তৈরি হয়', !!approvedCustomer && approvedCustomer.name === 'পেন্ডিং ক্রেতা')
  check('অনুমোদনের পর তালিকা হালনাগাদ (একজন কমে)', hasText('অনুমোদনের অপেক্ষায় (১)'), text().slice(0, 200))
  confirmed = true
  await clickEl(buttonByText('বাতিল'))
  await settle(200)
  const rejected = await db.users.get('cu-2')
  check('বাতিল করলে সাইন-আপ প্রত্যাখ্যাত হয়', rejected?.approval === 'rejected' && rejected?.is_active === false, JSON.stringify({ a: rejected?.approval }))
  check('প্রত্যাখ্যাত সাইন-আপ আর তালিকায় নেই', !hasText('বাতিলযোগ্য ক্রেতা'))
  /* একই ফোনে আগে থেকেই খাতা থাকলে অনুমোদনে ডুপ্লিকেট খাতা হয় না */
  await db.users.put(pendingUser('cu-3', 'ডুপ্লিকেট ফোন', '01711111111') as never)
  await renderAt('/customers', routes, { ...ownerUser })
  await settle(200)
  const beforeCount = (await db.customers.toArray()).length
  await clickText('অনুমোদন')
  await settle(100)
  await clickText('অনুমোদন দিন')
  await settle(220)
  check('একই ফোন থাকলে অনুমোদনে নতুন খাতা তৈরি হয় না', (await db.customers.toArray()).length === beforeCount, `${beforeCount} → ${(await db.customers.toArray()).length}`)

  /* ════════ ৪) ক্রেতার প্রোফাইল — বাকি ও কেনাকাটা ════════ */
  section('CustomerProfile — বাকির হিসাব ও কেনাকাটা')
  await renderAt('/customers', routes, { ...ownerUser })
  await settle(180)
  await clickEl(customerRow('ক্রেতা করিম'))
  await settle(200)
  check('প্রোফাইল পেজ খোলে (নাম+ফোন)', hasText('ক্রেতা করিম') && hasText('01711111111'), text().slice(0, 200))
  check('বর্তমান বাকি ও মোট কেনাকাটা দেখায়', hasText('বর্তমান বাকি') && hasText('মোট কেনাকাটা') && hasText('৳ ১,৫০০'), text().slice(0, 260))
  check('বিলের সংখ্যা দেখায় (১টি বিল)', hasText('১টি বিল'))
  check('বাকির হিসাবের টেবিলে বিক্রয় বিল ও সর্বমোট', hasText('বাকির হিসাব') && hasText('বিক্রয় বিল') && hasText('সর্বমোট'), text().slice(0, 300))
  check('টেবিলে বাকি ও ব্যালেন্স দুই জায়গায় পরিমাণ দেখায়', (text().match(/৳ ১,৫০০/g) || []).length >= 4, String((text().match(/৳ ১,৫০০/g) || []).length))
  check('কেনাকাটার ইতিহাসে পণ্য ও ধরন দেখায়', hasText('কেনাকাটার ইতিহাস (১)') && hasText('মিনিকেট চাল') && hasText('বাকি'), text().slice(0, 300))
  const ledgerLink = all<HTMLAnchorElement>('a[href^="/collections?type=customer"]')[0]
  check('"বাকি খাতা" লিংক ঠিক ক্রেতার খাতায় যায়', !!ledgerLink && ledgerLink.getAttribute('href') === '/collections?type=customer&party=c-karim', ledgerLink?.getAttribute('href') || '')
  const saleLink = all<HTMLAnchorElement>('a[href^="/sales?customer="]')[0]
  check('"নতুন বিক্রি" লিংকে ক্রেতা বসানো', saleLink?.getAttribute('href') === '/sales?customer=c-karim', saleLink?.getAttribute('href') || '')

  /* ════════ ৫) প্রোফাইল থেকে রসিদ ও হিসাব বিবরণী ════════ */
  section('CustomerProfile — রসিদ ও হিসাব বিবরণীর প্রিভিউ')
  await clickText('রসিদ দেখুন / শেয়ার')
  await settle(150)
  check('বিক্রির রসিদ খোলে', !!find('[data-pad]') && hasText('বিক্রি রিসিট'), text().slice(0, 160))
  check('রসিদে ক্রেতার নাম ও ফোন থাকে', hasText('ক্রেতা করিম') && hasText('01711111111'))
  check('রসিদে লাভ ফাঁস হয় না', !hasText('লাভ'))
  await clickEl(find('[aria-label="রসিদ বন্ধ করুন"]'))
  await settle(100)
  check('রসিদ বন্ধ হয়', !find('[role="dialog"][aria-label="বিক্রি রিসিট প্রিভিউ"]'))
  await clickText('হিসাব বিবরণী দেখুন')
  await settle(180)
  check('হিসাব বিবরণীর প্রিভিউ খোলে', !!find('[aria-label*="হিসাব বিবরণী প্রিভিউ"]'), text().slice(0, 200))
  check('প্রিভিউতে প্রতিষ্ঠান/ক্রেতা/বাকি দেখা যায়', hasText('কর্ণফুলী সেলস সেন্টার') && hasText('ক্রেতা করিম'), text().slice(0, 300))
  check('অদৃশ্য A4 শিটও রেন্ডার হয় (PDF সোর্স)', !!find('[data-sheet]'))
  await clickEl(find('[aria-label="প্রিভিউ বন্ধ করুন"]'))
  await settle(120)
  check('প্রিভিউ বন্ধ হয়', !find('[aria-label*="হিসাব বিবরণী প্রিভিউ"]'))

  /* ════════ ৬) তাগাদা, সম্পাদনা ও মুছে ফেলা ════════ */
  section('CustomerProfile — WhatsApp তাগাদা, সম্পাদনা, মুছে ফেলা')
  openedUrl = ''
  await clickText('WhatsApp-এ বাকি তাগাদা পাঠান')
  await settle(120)
  check('তাগাদার বার্তা পাঠানোর নিশ্চিতকরণ দেখায়', hasText('বাকি তাগাদার বার্তা WhatsApp-এ খোলা হয়েছে।'), text().slice(0, 200))
  check('WhatsApp লিংকে ক্রেতার নম্বর বসে', openedUrl.startsWith('https://wa.me/8801711111111?text='), openedUrl.slice(0, 40))
  const waText = decodeURIComponent(openedUrl.split('text=')[1] || '')
  check('তাগাদার বার্তায় বাকির পরিমাণ থাকে', nfc(waText).includes(nfc('৳ ১,৫০০')), waText.slice(0, 120))
  await clickText('সম্পাদনা')
  await settle(120)
  check('সম্পাদনার ফর্ম আগের তথ্য নিয়ে খোলে', hasText('ক্রেতা সম্পাদনা') && (fieldByLabel('নাম') as HTMLInputElement)?.value === 'ক্রেতা করিম', (fieldByLabel('নাম') as HTMLInputElement)?.value || '')
  await setElValue(fieldByLabel('ঠিকানা')!, 'নতুন ঠিকানা, চট্টগ্রাম')
  await submitForm(find('form'))
  await settle(200)
  check('সম্পাদনা ডেটাবেসে সংরক্ষিত হয়', (await db.customers.get('c-karim'))?.address === 'নতুন ঠিকানা, চট্টগ্রাম', String((await db.customers.get('c-karim'))?.address))
  check('বাকি থাকলে মুছে ফেলার বোতাম দেখায় না', !buttonByText('মুছুন'))
  await clickEl(find('[aria-label="ফিরে যান"]'))
  await settle(180)
  check('ফিরে গেলে ক্রেতার তালিকা খোলে', hasText('মোট ক্রেতা'), text().slice(0, 160))
  await clickEl(customerRow('নতুন ক্রেতা সেলিম'))
  await settle(200)
  check('কোনো বিক্রি না থাকলে প্রোফাইল খালি অবস্থা দেখায়', hasText('কোনো বাকি লেনদেন নেই।') && hasText('কোনো বিক্রি নেই।'), text().slice(0, 260))
  check('বাকি না থাকলে তাগাদা বোতাম নিষ্ক্রিয়', (buttonsByText('WhatsApp-এ বাকি তাগাদা পাঠান')[0] as HTMLButtonElement)?.disabled === true)
  check('বিক্রি/বাকি না থাকলে (মালিক) মুছে ফেলার বোতাম আসে', !!buttonByText('মুছুন'))
  confirmed = false
  await clickText('মুছুন')
  await settle(150)
  check('নিশ্চিতকরণ ছাড়া ক্রেতা মোছে না', !!(await db.customers.get(selim!.id)))
  confirmed = true
  await clickText('মুছুন')
  await settle(220)
  const tomb = await db.customers.get(selim!.id)
  check('নিশ্চিত করলে ক্রেতা soft-delete হয় (tombstone + deleted_at)', !!tomb && !!tomb.deleted_at, JSON.stringify({ d: tomb?.deleted_at || null }))
  check('soft-deleted ক্রেতা তালিকায় ফিরে আসে না', !customerRow('নতুন ক্রেতা সেলিম'))
  check('মুছে ফেলার পর তালিকায় ফেরে', hasText('মোট ক্রেতা'), text().slice(0, 160))

  /* ════════ ৭) শাখার সীমানা ও ভূমিকা ════════ */
  section('Customers — শাখার সীমানা ও ভূমিকার অনুমতি')
  await renderAt('/customers', routes, { ...managerUser })
  await settle(200)
  check('ব্যবস্থাপক শুধু নিজের শাখার ক্রেতা দেখে', !!customerRow('ক্রেতা করিম') && !customerRow('অন্য শাখার ক্রেতা'), text().slice(0, 200))
  await renderAt('/customers/c-other', routes, { ...managerUser })
  await settle(200)
  check('অন্য শাখার ক্রেতার পাতা ব্যবস্থাপককে দেখায় না', hasText('এই ক্রেতা পাওয়া যায়নি।'), text().slice(0, 200))
  await renderAt('/customers/c-other', routes, { ...ownerUser })
  await settle(220)
  check('মালিক অন্য শাখার ক্রেতার পাতা দেখতে পারেন', hasText('অন্য শাখার ক্রেতা') && !hasText('এই ক্রেতা পাওয়া যায়নি।'), text().slice(0, 200))
  await renderAt('/customers', routes, { ...customerUser })
  await settle(180)
  check('ক্রেতা অ্যাকাউন্ট ক্রেতা তালিকা দেখতে পারে না', hasText('এই পেজ শুধু মালিক ও কর্মচারীর জন্য।'), text().slice(0, 160))
  await renderAt('/customers/c-karim', routes, { ...customerUser })
  await settle(180)
  check('ক্রেতা অ্যাকাউন্ট অন্য ক্রেতার প্রোফাইল দেখতে পারে না', hasText('এই পেজ শুধু মালিক ও কর্মচারীর জন্য।'))
  useUiStore.setState({ staffBranchId: '' })
}
