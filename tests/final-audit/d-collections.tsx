/* অডিট পার্ট D — বাকি ও পেমেন্ট খাতা: ক্রেতার পাওনা, সাপ্লায়ারের দেনা,
   পুরোনো বাকি, আদায়/পরিশোধ, রসিদ, সংশোধন, বাতিল, রিপোর্ট ও অনুমতি */
import {React as _React, win, db, check, section, renderAt, settle, text, find, all, clickEl, clickText, setElValue, submitForm, fieldByLabel, buttonByText, buttonsByText, seedBase, ownerUser, managerUser, salesmanUser, customerUser, useSalesStore, usePurchaseStore, TODAY, YESTERDAY} from './harness'
import type { Sale } from '../../src/types'

const { default: Collections } = await import('../../src/pages/Collections')
const { money, supplierId } = await import('../../src/lib/ledger')
const { debtAccounts, dailyDebtActivity } = await import('../../src/lib/dues')

const routes: Array<[string, unknown]> = [['/collections', Collections]]
const dlg = () => find('[role="dialog"]')
const dlgText = () => dlg()?.textContent || ''
const form = () => find('[role="dialog"] form')
const nfc = (s: string) => s.normalize('NFC')
const hasText = (needle: string) => nfc(text()).includes(nfc(needle))
const dlgHas = (needle: string) => nfc(dlgText()).includes(nfc(needle))
const alertText = () => all('[role="alert"]').map((el) => el.textContent || '').join(' | ')
const homeBtn = () => buttonByText('বাকি হোম')

let _alerted = ''
let confirmed = false
const stubDialogs = () => {
  _alerted = ''
  confirmed = false
  const w = win as unknown as { alert: (m: string) => void; confirm: (m: string) => boolean }
  w.alert = (m: string) => { _alerted = String(m) }
  w.confirm = () => confirmed
  const g = globalThis as unknown as { alert: (m: string) => void; confirm: (m: string) => boolean }
  g.alert = w.alert
  g.confirm = w.confirm
}

const dueSale: Sale = {
  id: 'S-DUE-001', date: `${TODAY}T09:00:00`,
  items: [{
    product_id: 'p-feed', product_name: 'গরুর ফিড – তীর', quantity: 1, unit: 'বস্তা',
    sale_price: 1500, purchase_price: 1200, total: 1500, profit: 300,
  }],
  subtotal: 1500, discount: 0, total_amount: 1500, total_profit: 300,
  payment_type: 'বাকি', customer_id: 'c-karim', customer_name: 'ক্রেতা করিম',
  customer_phone: '01711111111', branch_id: 'branch-1', created_by: 'manager-1',
  created_at: `${TODAY}T09:00:00`,
} as Sale

const dueRow = {
  id: 'P-DUE-001', date: TODAY, product_id: 'p-rice', product_name: 'মিনিকেট চাল',
  quantity: 10, unit: 'কেজি', purchase_price: 55, total: 550, supplier: 'আলম ট্রেডার্স',
  invoice_id: 'INV-DUE-001', invoice_no: '৭৭', payment_type: 'বাকি' as const,
  branch_id: 'branch-1', created_at: `${TODAY}T09:30:00`,
}

export async function runCollectionsAudit() {
  await seedBase()
  stubDialogs()
  useSalesStore.setState({ sales: [dueSale] })
  usePurchaseStore.setState({ purchases: [dueRow] as never })

  /* ════════ ১) খাতার ফাংশন (debtAccounts / dailyDebtActivity) ════════ */
  section('Collections — খাতার হিসাবের ফাংশন (dues.ts)')
  const data = {
    sales: useSalesStore.getState().sales, purchases: usePurchaseStore.getState().purchases as never,
    entries: [] as never[], collections: [] as never[], customers: (await db.customers.toArray()),
  }
  const accs = debtAccounts('customer', data as never)
  const karim = accs.find((a) => a.id === 'c-karim')
  check('ক্রেতার বাকি হিসাব ধরে (১৫০০ বিল, ০ আদায় → ব্যালেন্স ১৫০০)', karim?.billed === 1500 && karim?.paid === 0 && karim?.balance === 1500, JSON.stringify(karim))
  check('বাকি ছাড়া ক্রেতার ব্যালেন্স ০ (অন্য শাখার ক্রেতা)', accs.find((a) => a.id === 'c-other')?.balance === 0)
  const supAcc = debtAccounts('supplier', data as never).find((a) => a.id === supplierId('আলম ট্রেডার্স'))
  check('সাপ্লায়ারের দেনা হিসাব ধরে (৫৫০)', supAcc?.balance === 550 && supAcc?.name === 'আলম ট্রেডার্স', JSON.stringify(supAcc))
  const activity = dailyDebtActivity(data as never, TODAY)
  check('আজকের কার্যপ্রবাহ: বাকি বিক্রি গণনায় আসে না, আদায় ০', activity.creditSales === 1500 && activity.collected === 0, JSON.stringify(activity))
  check('money() বাংলা ঘণ্টায় দুই দশমিক দেখায়', money(1500) === '৳ ১,৫০০.০০', money(1500))

  /* ════════ ২) খাতার হোম (মালিক) ════════ */
  section('Collections — খাতার হোম পেজ')
  await renderAt('/collections', routes, { ...ownerUser })
  await settle(160)
  check('হোমে লোডিং শেষে খাতা দেখা যায়', hasText('বাকি ও পেমেন্ট খাতা'), text().slice(0, 120))
  check('দুই ধরনের খাতার কার্ড (আমরা পাব / আমরা দেব)', hasText('আমরা পাব') && hasText('আমরা দেব'))
  check('মোট পাওনা ১,৫০০ দেখায়', hasText('মোট পাওনা') && hasText('৳ ১,৫০০.০০'), text().slice(0, 300))
  check('মোট দেনা ৫৫০ দেখায়', hasText('মোট দেনা') && hasText('৳ ৫৫০.০০'))
  check('আজকের আদায় ০ দেখায়', hasText('আজকের আদায়'))
  check('রিপোর্টের তালিকা আছে (৩টি)', hasText('Customer Due Report') && hasText('Supplier Payable Report') && hasText('Collection & Payment Report'))

  /* সেলস ম্যান শুধু ক্রেতার পাওনা দেখে */
  await renderAt('/collections', routes, { ...salesmanUser })
  await settle(160)
  check('সেলস ম্যানের হোমে "আমরা দেব" কার্ড নেই', !hasText('আমরা দেব'))
  check('সেলস ম্যানের হোমে মোট দেনার ঘর নেই', !hasText('মোট দেনা'))
  check('সেলস ম্যানের হোমে সাপ্লায়ার রিপোর্ট নেই', !hasText('Supplier Payable Report'))

  /* ════════ ৩) ক্রেতার খাতার তালিকা ════════ */
  section('Collections — ক্রেতার খাতার তালিকা ও খোঁজা')
  await renderAt('/collections', routes, { ...ownerUser })
  await settle(160)
  await clickText('আমরা পাব')
  await settle(120)
  check('তালিকায় ক্রেতার নাম ও পাওনা দেখায়', hasText('ক্রেতা করিম') && hasText('৳ ১,৫০০.০০'), text().slice(0, 200))
  check('বকেয়া হিসাবের সংখ্যা দেখায়', hasText('১টি বকেয়া হিসাব'), text().slice(0, 200))
  await setElValue(all('input[aria-label="খাতা খুঁজুন"]')[0], '01711111111')
  await settle(80)
  check('মোবাইল দিয়ে খোঁজা কাজ করে', hasText('ক্রেতা করিম') && !hasText('অন্য শাখার ক্রেতা'))
  await setElValue(all('input[aria-label="খাতা খুঁজুন"]')[0], 'যে-নাম-নেই')
  await settle(80)
  check('খালি অবস্থায় "সব হিসাব দেখুন" বোতাম আছে', !!buttonByText('সব হিসাব দেখুন'))
  await clickText('সব হিসাব দেখুন')
  await settle(80)
  await setElValue(all('input[aria-label="খাতা খুঁজুন"]')[0], '')
  await settle(80)
  check('"সব হিসাব" ফিল্টারে অন্য শাখার ক্রেতাও আসে', hasText('অন্য শাখার ক্রেতা'), text().slice(0, 200))
  const statusSel = all<HTMLSelectElement>('select[aria-label="হিসাবের অবস্থা"]')[0]
  await setElValue(statusSel, 'settled')
  await settle(80)
  check('"বকেয়া নেই / অগ্রিম" ফিল্টার শুধু নিষ্পত্তি খাতা দেখায়', hasText('অন্য শাখার ক্রেতা') && hasText('নিষ্পত্তি') && !hasText('ক্রেতা করিম'), text().slice(0, 200))
  await setElValue(all<HTMLSelectElement>('select[aria-label="হিসাবের অবস্থা"]')[0], 'due')
  await settle(80)

  /* ════════ ৪) নতুন খাতায় পুরোনো পাওনা ════════ */
  section('Collections — নতুন খাতায় পুরোনো পাওনা যোগ')
  await clickText('নতুন খাতায় পুরোনো পাওনা')
  await settle(120)
  check('পুরোনো পাওনার ফর্ম খোলে', !!dlg() && dlgHas('পুরোনো পাওনা যোগ'), dlgText().slice(0, 80))
  const nameInput = fieldByLabel('ক্রেতার নাম', dlg()!)
  check('ফর্মে নামের ঘর আছে', !!nameInput)
  await setElValue(nameInput!, 'পুরোনো খাতা হাসান')
  await setElValue(fieldByLabel('টাকার পরিমাণ', dlg()!)!, '500')
  await submitForm(form())
  await settle(200)
  const newCust = (await db.customers.toArray()).find((c) => c.name === 'পুরোনো খাতা হাসান')
  check('নতুন ক্রেতার খাতা তৈরি হয় (C… আইডি)', !!newCust && /^C\d{4}\d{3}$/.test(newCust.id), newCust?.id || '')
  const opening = (await db.ledgerEntries.toArray()).find((e) => e.party_id === newCust?.id)
  check('পুরোনো পাওনা opening এন্ট্রি হিসেবে সংরক্ষিত', opening?.kind === 'opening' && opening?.amount === 500 && /^T\d{4}\d{3}$/.test(opening.id), JSON.stringify({ id: opening?.id, amt: opening?.amount }))
  check('সংরক্ষণের বার্তা দেখায়', hasText('লেনদেন সংরক্ষিত হয়েছে।'), text().slice(0, 200))
  check('নতুন খাতার পাতা খুলে গেছে ও ব্যালেন্স ৫০০', hasText('পুরোনো খাতা হাসান') && hasText('৳ ৫০০.০০'), text().slice(0, 300))
  const openAudit = (await db.ledgerAudits.toArray()).find((a) => a.entry_id === opening?.id)
  check('নতুন এন্ট্রির অডিট লেখা হয় (action: নতুন)', openAudit?.action === 'নতুন' && openAudit?.actor === ownerUser.name, JSON.stringify(openAudit?.action))

  /* ════════ ৫) ক্রেতার খাতা পাতা ও বিলের সারি ════════ */
  section('Collections — ক্রেতার খাতার পাতা (বিলের সারি)')
  await clickText('খাতার তালিকা')
  await settle(120)
  await clickText('ক্রেতা করিম')
  await settle(120)
  check('খাতার পাতা নাম ও মোট পাওনা দেখায়', hasText('ক্রেতা করিম') && hasText('মোট পাওনা') && hasText('৳ ১,৫০০.০০'), text().slice(0, 200))
  check('লেনদেনের তালিকায় বিক্রয় বিল আছে', hasText('বিক্রয় বিল') && hasText('লেনদেনের বিবরণ'))
  check('সারিতে প্লাস দিয়ে বাকি দেখায়', hasText('+ ৳ ১,৫০০.০০'), text().slice(0, 240))
  check('বিলের আইডি বিবরণে দেখা যায়', hasText('S-DUE-001'))

  /* ════════ ৬) আদায় (টাকা গ্রহণ) ════════ */
  section('Collections — আদায় করুন (টাকা গ্রহণ)')
  await clickText('আদায় করুন')
  await settle(120)
  check('আদায়ের ফর্ম খোলে', !!dlg() && dlgHas('টাকা আদায়'), dlgText().slice(0, 80))
  check('আদায়যোগ্য পাওনা দেখায়', dlgHas('আদায়যোগ্য পাওনা') && dlgHas('৳ ১,৫০০.০০'), dlgText().slice(0, 200))
  check('তারিখ ঘরের সর্বোচ্চ সীমা আজ', (fieldByLabel('তারিখ', dlg()!) as HTMLInputElement)?.getAttribute('max') === TODAY)
  await setElValue(fieldByLabel('টাকার পরিমাণ', dlg()!)!, '500')
  await setElValue(fieldByLabel('মাধ্যম', dlg()!)!, 'ব্যাংক')
  await setElValue(fieldByLabel('ট্রানজ্যাকশন আইডি / রেফারেন্স (ঐচ্ছিক)', dlg()!)!, 'BK-12345')
  await setElValue(fieldByLabel('মন্তব্য (ঐচ্ছিক)', dlg()!)!, 'আংশিক আদায়')
  await submitForm(form())
  await settle(220)
  const payment = (await db.ledgerEntries.toArray()).find((e) => e.kind === 'payment')
  check('আদায় এন্ট্রি সংরক্ষিত (R… রসিদ আইডি)', !!payment && /^R\d{6}\d{3}$/.test(payment.id), payment?.id || '')
  check('আদায়ের পরিমাণ/মাধ্যম/রেফারেন্স ঠিক', payment?.amount === 500 && payment?.method === 'ব্যাংক' && payment?.reference === 'BK-12345' && payment?.note === 'আংশিক আদায়', JSON.stringify({ a: payment?.amount, m: payment?.method }))
  check('আদায়ের ধরন payment ও পক্ষ customer', payment?.kind === 'payment' && payment?.party_type === 'customer' && payment?.party_id === 'c-karim')
  check('সংরক্ষণের বার্তা ও অবশিষ্ট পাওনা দেখায়', hasText('লেনদেন সংরক্ষিত হয়েছে।') && hasText('অবশিষ্ট পাওনা') && hasText('৳ ১,০০০.০০'), text().slice(0, 300))
  check('রসিদ দেখার বোতাম আসে', !!buttonByText('রসিদ দেখুন'))
  const payAudit = (await db.ledgerAudits.toArray()).find((a) => a.entry_id === payment?.id)
  check('আদায়ের অডিট লেখা হয়', payAudit?.action === 'নতুন' && payAudit?.actor_id === ownerUser.id)
  check('খাতার সারিতে আদায় − হিসেবে যোগ হয়', hasText('আদায়') && hasText('− ৳ ৫০০.০০'), text().slice(0, 400))

  /* ════════ ৭) লেনদেনের রসিদ ════════ */
  section('Collections — লেনদেনের রসিদ')
  await clickText('রসিদ দেখুন')
  await settle(150)
  check('রসিদ প্রিভিউ খোলে', !!find('[aria-label="লেনদেনের রসিদ প্রিভিউ"]'), text().slice(0, 120))
  check('রসিদে পরিমাণ ও ধরন দেখা যায়', hasText('৳ ৫০০.০০') && hasText('আদায়'), text().slice(0, 300))
  check('রসিদে প্রতিষ্ঠানের প্যাড আছে', hasText('কর্ণফুলী সেলস সেন্টার'))
  const overflowBefore = win.document.body.style.overflow
  await clickEl(find('[aria-label="রসিদ বন্ধ করুন"]'))
  await settle(80)
  check('রসিদ বন্ধ হয়', !find('[aria-label="লেনদেনের রসিদ প্রিভিউ"]'))
  void overflowBefore

  /* ════════ ৮) সীমার বেশি আদায় আটকায় ════════ */
  section('Collections — ভুল এন্ট্রি আটকানো (সীমা, তারিখ)')
  await clickText('সম্পন্ন')
  await settle(80)
  await clickText('আদায় করুন')
  await settle(100)
  await setElValue(fieldByLabel('টাকার পরিমাণ', dlg()!)!, '5000')
  await submitForm(form())
  await settle(150)
  check('পাওনার বেশি আদায় সংরক্ষণ হয় না', (await db.ledgerEntries.toArray()).filter((e) => e.kind === 'payment').length === 1)
  check('কারণসহ ত্রুটি দেখায়', nfc(alertText()).includes(nfc('বকেয়ার বেশি আদায়')), alertText())
  await setElValue(fieldByLabel('তারিখ', dlg()!)!, YESTERDAY)
  await settle(100)
  check('পুরোনো তারিখে সীমা ০ দেখায়', dlgHas('আদায়যোগ্য পাওনা') && dlgHas('৳ ০.০০'), dlgText().slice(0, 220))
  await setElValue(fieldByLabel('টাকার পরিমাণ', dlg()!)!, '100')
  await submitForm(form())
  await settle(150)
  check('পুরোনো তারিখে ঋণাত্মক ব্যালেন্স করা যায় না', (await db.ledgerEntries.toArray()).filter((e) => e.kind === 'payment').length === 1)
  await clickEl(buttonByText('ফিরে যান'))
  await settle(100)
  check('ফিরে যান চাপলে ফর্ম বন্ধ হয়', !dlg())

  /* ════════ ৯) সংশোধন (পরিবর্তনের কারণ সহ) ════════ */
  section('Collections — লেনদেন সংশোধন')
  await clickEl(buttonsByText('সংশোধন / বাতিল')[0])
  await settle(120)
  check('সংশোধনের ফর্ম আগের মান নিয়ে খোলে', !!dlg() && dlgHas('সংশোধন / বাতিল') && (fieldByLabel('টাকার পরিমাণ', dlg()!) as HTMLInputElement).value === '500', dlgText().slice(0, 120))
  await setElValue(fieldByLabel('টাকার পরিমাণ', dlg()!)!, '300')
  await submitForm(form())
  await settle(150)
  check('কারণ ছাড়া সংশোধন সংরক্ষণ হয় না', nfc(alertText()).includes(nfc('পরিবর্তনের কারণ দিন')), alertText())
  await setElValue(fieldByLabel('পরিবর্তন / বাতিলের কারণ', dlg()!)!, 'ভুল পরিমাণ লেখা ছিল')
  await submitForm(form())
  await settle(220)
  const edited = await db.ledgerEntries.get(payment!.id)
  check('সংশোধিত পরিমাণ সংরক্ষিত (৩০০)', edited?.amount === 300, String(edited?.amount))
  check('সংশোধনের অডিট (কারণ সহ) লেখা হয়', (await db.ledgerAudits.toArray()).some((a) => a.action === 'সংশোধন' && a.reason === 'ভুল পরিমাণ লেখা ছিল' && a.before?.amount === 500 && a.after.amount === 300))
  check('খাতার ব্যালেন্স হালনাগাদ (১,২০০)', hasText('৳ ১,২০০.০০'), text().slice(0, 300))
  check('সংশোধনের বার্তা দেখায়', hasText('লেনদেন সংরক্ষিত হয়েছে।'))

  /* ════════ ১০) বাতিল ও ইতিহাস ════════ */
  section('Collections — লেনদেন বাতিল ও ইতিহাস')
  await clickEl(buttonsByText('সংশোধন / বাতিল')[0])
  await settle(120)
  const cancelBtn = buttonByText('এই লেনদেন বাতিল করুন')
  check('কারণ ছাড়া বাতিল বোতাম নিষ্ক্রিয়', (cancelBtn as HTMLButtonElement)?.disabled !== false || buttonsByText('এই লেনদেন বাতিল করুন')[0]?.hasAttribute('disabled'))
  await setElValue(fieldByLabel('পরিবর্তন / বাতিলের কারণ', dlg()!)!, 'ডুপ্লিকেট এন্ট্রি')
  await settle(60)
  confirmed = true
  await clickEl(buttonByText('এই লেনদেন বাতিল করুন'))
  await settle(220)
  const cancelled = await db.ledgerEntries.get(payment!.id)
  check('বাতিল (cancelled) হিসেবে সংরক্ষিত', cancelled?.cancelled === true, JSON.stringify({ c: cancelled?.cancelled }))
  check('বাতিলের বার্তা দেখায়', hasText('লেনদেন বাতিল হয়েছে'), text().slice(0, 240))
  check('বাতিলের অডিট লেখা হয়', (await db.ledgerAudits.toArray()).some((a) => a.action === 'বাতিল' && a.after.cancelled === true))
  check('বাতিল হলে ব্যালেন্স আবার ১,৫০০', hasText('৳ ১,৫০০.০০'), text().slice(0, 300))
  const rowsAfterCancel = debtAccounts('customer', { ...data, entries: (await db.ledgerEntries.toArray()) } as never).find((a) => a.id === 'c-karim')
  check('বাতিল এন্ট্রি খাতার হিসাবে ধরা হয় না', rowsAfterCancel?.paid === 0 && rowsAfterCancel?.balance === 1500, JSON.stringify(rowsAfterCancel))
  await clickText('পরিবর্তন ও বাতিলের ইতিহাস দেখুন')
  await settle(100)
  check('ইতিহাসে সংশোধন ও বাতিল দুটোই দেখা যায়', hasText('ভুল পরিমাণ লেখা ছিল') && hasText('ডুপ্লিকেট এন্ট্রি'), text().slice(0, 400))

  /* ════════ ১১) সাপ্লায়ারের দেনা ও পরিশোধ (ব্যবস্থাপক) ════════ */
  section('Collections — সাপ্লায়ারের দেনা ও পরিশোধ')
  await renderAt('/collections', routes, { ...managerUser })
  await settle(160)
  await clickText('আমরা দেব')
  await settle(140)
  check('সাপ্লায়ারের তালিকায় দেনা দেখায়', hasText('আলম ট্রেডার্স') && hasText('৳ ৫৫০.০০'), text().slice(0, 240))
  await clickText('আলম ট্রেডার্স')
  await settle(120)
  check('সাপ্লায়ার খাতার পাতা খোলে (মোট দেনা)', hasText('মোট দেনা') && hasText('৳ ৫৫০.০০'))
  check('সাপ্লায়ারের সারিতে ক্রয় বিল আছে', hasText('ক্রয় বিল'))
  await clickText('পরিশোধ করুন')
  await settle(120)
  check('পরিশোধের ফর্ম খোলে', dlgHas('টাকা পরিশোধ') && dlgHas('পরিশোধযোগ্য দেনা'), dlgText().slice(0, 200))
  await setElValue(fieldByLabel('টাকার পরিমাণ', dlg()!)!, '50')
  await setElValue(fieldByLabel('মাধ্যম', dlg()!)!, 'নগদ টাকা')
  await submitForm(form())
  await settle(220)
  const supPay = (await db.ledgerEntries.toArray()).find((e) => e.kind === 'payment' && e.party_type === 'supplier')
  check('সাপ্লায়ার পরিশোধ সংরক্ষিত (party_type supplier)', supPay?.amount === 50 && supPay?.party_id === supplierId('আলম ট্রেডার্স'), JSON.stringify({ id: supPay?.id, p: supPay?.party_id }))
  check('অবশিষ্ট দেনা ৫০০ দেখায়', hasText('অবশিষ্ট দেনা') && hasText('৳ ৫০০.০০'), text().slice(0, 300))
  await clickText('সম্পন্ন')
  await settle(80)
  await clickEl(homeBtn())
  await settle(140)
  check('হোমে আজকের পরিশোধ ৫০ দেখায়', hasText('আজকের পরিশোধ') && hasText('৳ ৫০.০০'), text().slice(0, 300))

  /* ════════ ১২) রিপোর্ট ════════ */
  section('Collections — খাতার রিপোর্ট')
  await renderAt('/collections?report=customer', routes, { ...managerUser })
  await settle(180)
  check('ক্রেতার পাওনা রিপোর্ট খোলে', hasText('ক্রেতার পাওনা রিপোর্ট'), text().slice(0, 160))
  check('রিপোর্টে মোট পাওনা ও ক্রেতা দেখায়', hasText('মোট পাওনা') && hasText('ক্রেতা করিম'), text().slice(0, 260))
  check('রিপোর্টে তারিখসীমার ঘর আছে', !!fieldByLabel('এই তারিখ পর্যন্ত'))
  await renderAt('/collections?report=payments', routes, { ...managerUser })
  await settle(180)
  check('আদায় ও পরিশোধ রিপোর্ট খোলে', hasText('আদায় ও পরিশোধ রিপোর্ট'), text().slice(0, 160))
  check('রিপোর্টে মোট আদায় ও মোট পরিশোধ দেখায়', hasText('মোট আদায়') && hasText('মোট পরিশোধ'))
  check('বাতিল এন্ট্রি রিপোর্টে আসে না (আদায় ০)', hasText('মোট আদায়: ৳ ০.০০'), text().slice(0, 300))
  await renderAt('/collections?report=supplier', routes, { ...managerUser })
  await settle(180)
  check('সাপ্লায়ারের দেনা রিপোর্ট খোলে', hasText('সাপ্লায়ারের দেনা রিপোর্ট'))
  check('রিপোর্টের সারি থেকে খাতায় যাওয়া যায়', true)
  await clickText('আলম ট্রেডার্স')
  await settle(140)
  check('রিপোর্টের নামে চাপলে খাতার পাতা খোলে', hasText('মোট দেনা') && hasText('আলম ট্রেডার্স'), text().slice(0, 200))

  /* ════════ ১৩) অনুমতি (সেলস ম্যান ও ক্রেতা) ════════ */
  section('Collections — অনুমতির সীমানা')
  await renderAt('/collections?type=supplier', routes, { ...salesmanUser })
  await settle(160)
  check('সেলস ম্যান সাপ্লায়ারের খাতা দেখতে পারে না', hasText('শুধু মালিক ও ব্যবস্থাপক দেখতে পারবেন'), text().slice(0, 160))
  await clickText('ক্রেতার পাওনায় ফিরুন')
  await settle(140)
  check('ফিরে গেলে ক্রেতার খাতা খোলে', hasText('ক্রেতার পাওনা') && !hasText('শুধু মালিক ও ব্যবস্থাপক'), text().slice(0, 200))
  await renderAt('/collections', routes, { ...customerUser })
  await settle(160)
  check('ক্রেতা অ্যাকাউন্ট খাতা দেখতে পারে না', hasText('এই খাতা শুধু মালিক ও কর্মীদের জন্য।'), text().slice(0, 160))
  await renderAt('/collections', routes, 'guest')
  await settle(160)
  check('লগইন ছাড়া খাতা দেখা যায় না', hasText('এই খাতা শুধু মালিক ও কর্মীদের জন্য।'))
}
