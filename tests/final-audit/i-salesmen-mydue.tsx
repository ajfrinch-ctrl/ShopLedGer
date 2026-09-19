/* অডিট পার্ট I — সেলস ম্যান আইডি ব্যবস্থাপনা (ব্যবস্থাপক) ও ক্রেতার নিজের
   হিসাব বিবরণী / MyDues (শুধু নিজের ডেটা, ফিল্টার, প্রিভিউ → PDF) */
import {React as _React, win as _win, db, check, section, renderAt, settle, text, find, all, clickEl, clickText, setElValue, submitForm, fieldByLabel as _fieldByLabel, buttonByText, seedBase, ownerUser, managerUser, customerUser, useSalesStore, TODAY, YESTERDAY} from './harness'
import type { Sale } from '../../src/types'

const { default: Salesmen } = await import('../../src/pages/Salesmen')
const { default: MyDues } = await import('../../src/pages/MyDues')
const { hashPassword } = await import('../../src/stores/authStore')

const smRoutes: Array<[string, unknown]> = [['/salesmen', Salesmen]]
const dueRoutes: Array<[string, unknown]> = [['/my-dues', MyDues]]
const nfc = (s: string) => s.normalize('NFC')
const hasText = (needle: string) => nfc(text()).includes(nfc(needle))

const linkedUser = {
  id: 'customer-1', name: 'ক্রেতা করিম', phone: '01900000000', role: 'customer' as const, branch_id: 'branch-1',
}
const mySale = (id: string, amount: number, payment: 'নগদ' | 'বাকি', date = TODAY): Sale => ({
  id, date: `${date}T12:00:00`,
  items: [{ product_id: 'p-rice', product_name: 'মিনিকেট চাল', quantity: amount / 75, unit: 'কেজি', sale_price: 75, purchase_price: 60, total: amount, profit: amount / 5 }],
  subtotal: amount, discount: 0, total_amount: amount, total_profit: amount / 5, payment_type: payment,
  customer_id: 'c-me', customer_name: 'ক্রেতা করিম', branch_id: 'branch-1', created_by: 'manager-1', created_at: `${date}T12:00:00`,
} as Sale)

export async function runSalesmenMyDuesAudit() {
  await seedBase()
  await db.users.put({
    id: 'salesman-2', name: 'সেলস ম্যান দ্বিতীয়', phone: '01822222222', username: 'salesman2',
    password_hash: await hashPassword('123456'), role: 'salesman', branch_id: 'branch-2', branch_ids: ['branch-2'],
    is_active: true, created_at: '', updated_at: '',
  } as never)

  /* ════════ ১) সেলস ম্যান তালিকা ও অনুমতি ════════ */
  section('Salesmen — তালিকা ও ভূমিকার সীমানা')
  await renderAt('/salesmen', smRoutes, { ...managerUser })
  await settle(240)
  check('পেজের শিরোনাম ও নিজের শাখা দেখায়', hasText('সেলস ম্যান আইডি ব্যবস্থাপনা') && hasText('আপনার শাখা: প্রধান শাখা'), text().slice(0, 200))
  check('ব্যবস্থাপক শুধু নিজের শাখার সেলস ম্যান দেখেন (1টি আইডি)', hasText('1টি আইডি') && hasText('সেলস ম্যান কামাল') && !hasText('সেলস ম্যান দ্বিতীয়'), text().slice(0, 300))
  check('[ফাইন্ডিং] আইডি সংখ্যা ইংরেজি অঙ্কে দেখায় (1টি আইডি)', !hasText('১টি আইডি'), text().slice(0, 200))
  check('তালিকায় আইডি ও মোবাইল নম্বর দেখায়', hasText('salesman1') && hasText('01811111111'), text().slice(0, 300))
  await renderAt('/salesmen', smRoutes, { ...ownerUser })
  await settle(200)
  check('মালিক এই পেজ দেখতে পারেন না (শুধু ব্যবস্থাপকের)', hasText('এই পেজ শুধু শাখা ব্যবস্থাপকের জন্য।'), text().slice(0, 160))
  await renderAt('/salesmen', smRoutes, { ...customerUser })
  await settle(200)
  check('ক্রেতা সেলস ম্যান পেজ দেখতে পারে না', hasText('এই পেজ শুধু শাখা ব্যবস্থাপকের জন্য।'))

  /* ════════ ২) নতুন সেলস ম্যান আইডি খোলা ════════ */
  section('Salesmen — নতুন আইডি, ইউজারনেম ও ভূমিকার অনুমতি')
  await renderAt('/salesmen', smRoutes, { ...managerUser })
  await settle(240)
  await setElValue(all('input[placeholder="যেমন: কামাল হোসেন"]')[0], 'নতুন সেলস ম্যান রফিক')
  await setElValue(all('input[placeholder="017XXXXXXXX"]')[0], '01833333333')
  await setElValue(all('input[placeholder="ডিফল্ট: 123456"]')[0], '123456')
  const unameInput = all<HTMLInputElement>('input[placeholder="যেমন: aghrabad_salesman"]')[0]
  check('শাখার নাম থেকে ইউজারনেম নিজে থেকে বসে', (unameInput?.value || '').length > 0, unameInput?.value || '')
  await setElValue(unameInput, 'rafiq_sales')
  await submitForm(all('form')[0] || find('form'))
  await settle(260)
  const created = (await db.users.toArray()).find((u) => u.username === 'rafiq_sales')
  check('নতুন সেলস ম্যান তৈরি হয় (SL… আইডি)', !!created && /^SL\d{4}\d{3}$/.test(created.id), created?.id || '')
  check('নতুন সেলস ম্যানের ভূমিকা ও শাখা ঠিক', created?.role === 'salesman' && (created?.branch_ids || []).includes('branch-1'), JSON.stringify({ r: created?.role, b: created?.branch_ids }))
  check('শুরুর পাসওয়ার্ড 123456 ও ১ম লগইনে বদলাতে হবে', created?.must_change_password === true && created?.password_hash === await hashPassword('123456'))
  check('সফল বার্তায় আইডি ও পাসওয়ার্ড দেখায়', hasText('আইডি খোলা হয়েছে') && hasText('rafiq_sales') && hasText('123456'), text().slice(0, 400))
  check('WhatsApp পাঠানোর লিংক তৈরি হয়', !!all<HTMLAnchorElement>('a[href^="https://wa.me/88"]')[0], (all<HTMLAnchorElement>('a[href^="https://wa.me/"]')[0]?.getAttribute('href') || '').slice(0, 40))
  check('তালিকায় নতুন সেলস ম্যান যোগ হয় (2টি আইডি)', hasText('নতুন সেলস ম্যান রফিক') && hasText('2টি আইডি'), text().slice(0, 300))
  /* একই ইউজারনেম আবার দিলে আটকায় */
  await setElValue(all('input[placeholder="যেমন: কামাল হোসেন"]')[0], 'ডুপ্লিকেট রফিক')
  const uname2 = all<HTMLInputElement>('input[placeholder="যেমন: aghrabad_salesman"]')[0]
  await setElValue(uname2, 'rafiq_sales')
  await submitForm(all('form')[0] || find('form'))
  await settle(240)
  check('একই ইউজারনেমে দ্বিতীয় আইডি খোলা যায় না', (await db.users.toArray()).filter((u) => u.username === 'rafiq_sales').length === 1 && (hasText('ব্যবহার') || hasText('আছে')), text().slice(0, 300))

  /* ════════ ৩) পাসওয়ার্ড রিসেট, আনলক ও চালু-বন্ধ ════════ */
  section('Salesmen — পাসওয়ার্ড রিসেট, আনলক, চালু/বন্ধ')
  await clickText('রিসেট')
  await settle(160)
  check('রিসেট প্যানেল খোলে', hasText('এর রিসেট') && hasText('ডিফল্ট "123456" দিন'))
  await clickText('ডিফল্ট "123456" দিন')
  await settle(240)
  const afterReset = (await db.users.toArray()).find((u) => u.username === 'rafiq_sales')!
  check('ডিফল্ট পাসওয়ার্ড রিসেট হয় ও ১ম লগইনে বদলাতে হয়', afterReset.password_hash === await hashPassword('123456') && afterReset.must_change_password === true)
  check('রিসেটের সফল বার্তা দেখায়', hasText('পাসওয়ার্ড রিসেট হয়েছে'), text().slice(0, 400))
  await setElValue(all('input[placeholder="অথবা নিজের পাসওয়ার্ড"]')[0], 'rafiq123')
  await clickText('সেট করুন')
  await settle(240)
  check('নিজের পাসওয়ার্ড সেট করা যায়', (await db.users.toArray()).find((u) => u.username === 'rafiq_sales')!.password_hash === await hashPassword('rafiq123'))
  /* লক হওয়া আইডি আনলক */
  await db.users.update('salesman-1', { failed_login_attempts: 5 } as never)
  await renderAt('/salesmen', smRoutes, { ...managerUser })
  await settle(260)
  check('লক হওয়া আইডিতে "আনলক" বোতাম আসে', !!buttonByText('আনলক'), text().slice(0, 300))
  await clickText('আনলক')
  await settle(220)
  check('আনলক করলে ব্যর্থ প্রচেষ্টার গণনা শূন্য হয়', ((await db.users.get('salesman-1'))?.failed_login_attempts || 0) === 0 && hasText('আনলক হয়েছে'), String((await db.users.get('salesman-1'))?.failed_login_attempts))
  const lockBtn = all('button').find((b) => (b.getAttribute('title') || '') === 'নিষ্ক্রিয় করুন')!
  await clickEl(lockBtn)
  await settle(300)
  const offCount = (await db.users.toArray()).filter((u) => u.role === 'salesman' && u.is_active === false).length
  check('চালু আইডি নিষ্ক্রিয় করা যায় (একজন নিষ্ক্রিয়)', offCount === 1, String(offCount))
  await renderAt('/salesmen', smRoutes, { ...managerUser })
  await settle(260)
  check('নিষ্ক্রিয়/লক আইডিতে "লক" ব্যাজ ও আনলক বোতাম দেখায়', hasText('সেলস ম্যান লক') && !!buttonByText('আনলক'), text().slice(0, 300))
  check('[ফাইন্ডিং] নিষ্ক্রিয় আইডিকেও "লক" লেখা দেখায় (নিষ্ক্রিয় ≠ লক)', hasText('লক') && !hasText('নিষ্ক্রিয়'))
  const unlockStatus = all('button').find((b) => (b.getAttribute('title') || '') === 'সক্রিয় করুন')!
  await clickEl(unlockStatus)
  await settle(300)
  const offAfter = (await db.users.toArray()).filter((u) => u.role === 'salesman' && u.is_active === false).length
  check('নিষ্ক্রিয় আইডি আবার চালু করা যায়', offAfter === 0, String(offAfter))

  /* ════════ ৪) MyDues — ক্রেতার নিজের হিসাব ════════ */
  section('MyDues — ক্রেতার নিজের স্টেটমেন্ট')
  await db.customers.put({ id: 'c-me', name: 'ক্রেতা করিম', phone: '01900000000', branch_id: 'branch-1', created_at: '' } as never)
  await db.customers.put({ id: 'c-other2', name: 'অন্য ক্রেতা', phone: '01755555555', branch_id: 'branch-1', created_at: '' } as never)
  useSalesStore.setState({ sales: [mySale('S-I-1', 1500, 'বাকি'), mySale('S-I-2', 500, 'নগদ'), mySale('S-I-3', 900, 'নগদ', YESTERDAY), { ...mySale('S-I-4', 7000, 'বাকি'), customer_id: 'c-other2', customer_name: 'অন্য ক্রেতা' } as Sale] })
  await db.ledgerEntries.put({
    id: 'R-I-1', party_id: 'c-me', party_name: 'ক্রেতা করিম', party_type: 'customer', kind: 'payment', amount: 400,
    date: TODAY, branch_id: 'branch-1', method: 'বিকাশ', reference: '', note: '', cancelled: false, created_at: `${TODAY}T14:00:00`, created_by: 'manager-1',
  } as never)
  await renderAt('/my-dues', dueRoutes, { ...linkedUser })
  await settle(300)
  check('স্টেটমেন্ট পেজ ও শিরোনাম দেখা যায়', hasText('ক্রয় হিস্ট্রি / Statement') && hasText('Customer Information'), text().slice(0, 200))
  check('ক্রেতার নিজের নাম/নম্বর দেখায়', hasText('ক্রেতা করিম') && hasText('01900000000'), text().slice(0, 300))
  check('লেনদেন ও সারাংশের অংশ আছে', hasText('Date Filter') && hasText('Summary') && hasText('Purchase History') && hasText('Statement Generate'), text().slice(0, 300))
  check('মোট ক্রয় = বাকি ১,৫০০ + নগদ ৫০০ + গতকালের ৯০০ = ২,৯০০', hasText('২,৯০০'), text().slice(0, 500))
  check('মোট পরিশোধ ৪০০ ও মোট বাকি ১,১০০ দেখায়', hasText('মোট পরিশোধ') && hasText('৪০০') && hasText('মোট বাকি') && hasText('১,১০০'), text().slice(0, 600))
  check('নিজের লেনদেনের সংখ্যা দেখায় (৪টি সারি)', hasText('৪টি লেনদেন'), text().slice(0, 400))
  check('অন্য ক্রেতার কেনাকাটা দেখা যায় না', !hasText('৭,০০০') && !hasText('অন্য ক্রেতা'), text().slice(0, 600))
  check('প্রতিটি লেনদেনে পণ্যের বিবরণ ও রসিদ নম্বর', hasText('মিনিকেট চাল') && hasText('Receipt No.'), text().slice(0, 700))

  /* ════════ ৫) MyDues — ফিল্টার, প্রিভিউ ও ভুল তারিখ ════════ */
  section('MyDues — তারিখ ফিল্টার, প্রিভিউ ও নিরাপত্তা')
  await setElValue(all('input[aria-label="From Date"]')[0], TODAY)
  await setElValue(all('input[aria-label="To Date"]')[0], YESTERDAY)
  await clickText('দেখুন')
  await settle(200)
  check('শুরু > শেষ তারিখে ভুল ধরিয়ে দেয়', hasText('শুরুর তারিখ শেষ তারিখের পরে হতে পারে না।'), text().slice(0, 200))
  await setElValue(all('input[aria-label="From Date"]')[0], YESTERDAY)
  await setElValue(all('input[aria-label="To Date"]')[0], YESTERDAY)
  await clickText('দেখুন')
  await settle(220)
  check('গতকালের ফিল্টারে শুধু গতকালের লেনদেন (৯০০)', hasText('৯০০') && hasText('১টি লেনদেন'), text().slice(0, 400))
  check('ফিল্টারে আজকের সারি বাদ পড়ে (মোট বাকি আলাদা)', !hasText('১,১০০'), text().slice(0, 400))
  await clickText('All History')
  await settle(220)
  check('All History সব লেনদেন ফিরিয়ে আনে', hasText('৪টি লেনদেন') && hasText('১,১০০'), text().slice(0, 400))
  await clickText('Statement Generate')
  await settle(260)
  check('Statement প্রিভিউ খোলে', hasText('Statement Preview') && !!find('[data-sheet]'), text().slice(0, 200))
  check('প্রিভিউতে PDF ডাউনলোড বোতাম আছে', hasText('Download PDF'), text().slice(0, 200))
  check('[ফাইন্ডিং] ক্রেতার স্টেটমেন্টে শেয়ার বোতাম নেই (শুধু PDF)', !hasText('ছবি শেয়ার'), text().slice(0, 300))
  check('[ফাইন্ডিং] ক্রেতার পেজে ইংরেজি বোতাম/শিরোনাম (Download PDF, Purchase History)', hasText('Purchase History') && hasText('Statement Generate'))
  check('প্রিভিউতে নিজের হিসাব ছাড়া কিছু নেই', hasText('ক্রেতা করিম') && !hasText('অন্য ক্রেতা'))
  await clickEl(find('[aria-label="প্রিভিউ বন্ধ করুন"]'))
  await settle(180)
  check('প্রিভিউ বন্ধ হয়', !hasText('Statement Preview'))

  /* ════════ ৬) MyDues — কেউ না থাকলে ও ভূমিকা ════════ */
  section('MyDues — খালি হিসাব ও অনুমতির সীমানা')
  const emptyUser = { id: 'customer-empty', name: 'নতুন ক্রেতা', phone: '01766666666', role: 'customer' as const, branch_id: 'branch-1' }
  await renderAt('/my-dues', dueRoutes, { ...emptyUser })
  await settle(300)
  check('সেলস না থাকলে খালি বার্তা দেখায়', hasText('নির্বাচিত সময়ে কোনো লেনদেন নেই।'), text().slice(0, 300))
  check('নতুন ক্রেতার খাতা নিজে থেকেই তৈরি হয়', !!(await db.customers.toArray()).find((c) => c.phone === '01766666666'))
  check('শূন্য হিসাবেও সারাংশ ০ দেখায়', hasText('মোট বাকি') && hasText('০'), text().slice(0, 400))
  /* রাউট-গার্ড (/my-dues শুধু customer) App.tsx-এ আছে; পেজ নিজে ভূমিকা যাচাই করে না —
     তাই সরাসরি রেন্ডার করলে যে কেউ খুললে তার নামে ক্রেতা-খাতা তৈরি হয়ে যায়। */
  const beforeStaff = (await db.customers.toArray()).length
  await renderAt('/my-dues', dueRoutes, { ...managerUser })
  await settle(300)
  const phantom = (await db.customers.toArray()).find((c) => c.phone === '01800000000')
  check('[ফাইন্ডিং] স্টাফের নামে ক্রেতা-খাতা তৈরি হয় (রাউট-গার্ড ছাড়া পেজ নিজে আটকায় না)', !!phantom && (await db.customers.toArray()).length === beforeStaff + 1, JSON.stringify({ id: phantom?.id, name: phantom?.name }))
  void TODAY
}
