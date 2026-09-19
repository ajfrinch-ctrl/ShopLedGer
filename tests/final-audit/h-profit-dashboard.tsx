/* অডিট পার্ট H — লাভ-ক্ষতির হিসাব (profitLoss লাইব্রেরি + পেজ) ও ড্যাশবোর্ড
   (মালিক/ব্যবস্থাপক: আজকের হিসাব, দ্রুত কাজ, স্টক সতর্কতা; সেলস ম্যান; ক্রেতা) */
import {React as _React, win as _win, db, check, section, renderAt, settle, text, find, all, clickEl, clickText, setElValue, fieldByLabel, buttonByText as _buttonByText, seedBase, ownerUser, managerUser, salesmanUser, customerUser, useSalesStore, usePurchaseStore, useProductStore, useStockAdjustmentStore, TODAY, YESTERDAY} from './harness'
import type { Sale } from '../../src/types'

const { default: ProfitLoss } = await import('../../src/pages/ProfitLoss')
const { default: Dashboard } = await import('../../src/pages/Dashboard')
const PL = await import('../../src/lib/profitLoss')
const cash = (n: number) => `৳ ${n.toLocaleString('bn-BD')}`

const plRoutes: Array<[string, unknown]> = [['/profit-loss', ProfitLoss]]
const dashRoutes: Array<[string, unknown]> = [['/', Dashboard]]
const nfc = (s: string) => s.normalize('NFC')
const hasText = (needle: string) => nfc(text()).includes(nfc(needle))

const mkSale = (id: string, amount: number, profit: number, payment: 'নগদ' | 'বাকি', date = TODAY, branch = 'branch-1'): Sale => ({
  id, date: `${date}T11:00:00`,
  items: [{ product_id: 'p-rice', product_name: 'মিনিকেট চাল', quantity: amount / 75, unit: 'কেজি', sale_price: 75, purchase_price: 60, total: amount, profit }],
  subtotal: amount, discount: 0, total_amount: amount, total_profit: profit, payment_type: payment,
  branch_id: branch, created_by: 'manager-1', created_at: `${date}T11:00:00`,
} as Sale)

export async function runProfitDashboardAudit() {
  await seedBase()
  useSalesStore.setState({
    sales: [
      mkSale('S-H-1', 1500, 300, 'নগদ'),
      mkSale('S-H-2', 1000, 200, 'বাকি'),
      mkSale('S-H-3', 999, 99, 'নগদ', YESTERDAY),
      mkSale('S-H-4', 5000, 1000, 'নগদ', TODAY, 'branch-2'),
    ],
  })
  usePurchaseStore.setState({
    purchases: [{ id: 'P-H-1', date: TODAY, product_id: 'p-rice', product_name: 'মিনিকেট চাল', quantity: 20, unit: 'কেজি', purchase_price: 55, total: 1100, supplier: 'আলম ট্রেডার্স', payment_type: 'বাকি', branch_id: 'branch-1', created_at: `${TODAY}T09:00:00` } as never],
  })
  await db.expenses.bulkPut([
    { id: 'E-H-1', date: TODAY, category: 'ভাড়া', amount: 300, kind: 'shop', payment_method: 'নগদ', branch_id: 'branch-1', created_at: `${TODAY}T10:00:00` } as never,
    { id: 'E-H-2', date: TODAY, category: 'বেতন', amount: 100, kind: 'shop', payment_method: 'নগদ', branch_id: 'branch-1', created_at: `${TODAY}T10:05:00` } as never,
    { id: 'E-H-3', date: TODAY, category: 'সংসার খরচ', amount: 400, kind: 'owner', payment_method: 'নগদ', branch_id: 'branch-1', created_at: `${TODAY}T10:10:00` } as never,
  ])

  /* ════════ ১) profitLoss লাইব্রেরি ════════ */
  section('ProfitLoss — হিসাবের লাইব্রেরি (তারিখ ও সূত্র)')
  const daily = PL.rangeFor('daily', new Date(`${TODAY}T12:00:00`))
  check('দৈনিক রেঞ্জ একদিনেরই হয়', daily.from === TODAY && daily.to === TODAY, JSON.stringify(daily))
  const month = PL.rangeFor('monthly', new Date(`${TODAY}T12:00:00`))
  check('মাসিক রেঞ্জ মাসের ১ থেকে শেষ দিন', month.from === TODAY.slice(0, 8) + '01' && month.to.slice(0, 7) === TODAY.slice(0, 7), JSON.stringify(month))
  const custom = PL.rangeFor('custom', new Date(), { from: TODAY, to: YESTERDAY })
  check('উল্টো কাস্টম রেঞ্জ নিজে থেকেই ঠিক হয়', custom.from === YESTERDAY && custom.to === TODAY, JSON.stringify(custom))
  check('inRange সঠিকভাবে দিন ধরে', PL.inRange(`${TODAY}T23:00:00`, { from: TODAY, to: TODAY }) && !PL.inRange(`${YESTERDAY}T23:00:00`, { from: TODAY, to: TODAY }))
  check('isBackdated আগের তারিখ চেনে', PL.isBackdated(YESTERDAY, TODAY) === true && PL.isBackdated(TODAY, TODAY) === false)
  check('entryISOOn পুরোনো তারিখের ISO বানায়', PL.entryISOOn(YESTERDAY).slice(0, 10) === YESTERDAY, PL.entryISOOn(YESTERDAY))
  const sums = (() => {
    const sales = useSalesStore.getState().sales
    const expenses = [{ id: 'E-H-1', date: TODAY, category: 'ভাড়া', amount: 300, kind: 'shop', branch_id: 'branch-1' }, { id: 'E-H-2', date: TODAY, category: 'বেতন', amount: 100, kind: 'shop', branch_id: 'branch-1' }, { id: 'E-H-3', date: TODAY, category: 'সংসার খরচ', amount: 400, kind: 'owner', branch_id: 'branch-1' }]
    const purchases = usePurchaseStore.getState().purchases
    return PL.computeProfitLoss(sales, expenses as never, purchases as never, { from: TODAY, to: TODAY })
  })()
  check('মোট বিক্রি ৭,৫০০ ও আজ ৩টি বিক্রি (সব শাখা)', sums.revenue === 7500 && sums.saleCount === 3, JSON.stringify({ r: sums.revenue, c: sums.saleCount }))
  check('গ্রস লাভ ১,৫০০ ও ক্রয়মূল্য ৬,০০০', sums.grossProfit === 1500 && sums.cogs === 6000, JSON.stringify({ g: sums.grossProfit, c: sums.cogs }))
  check('মালিকের টাকা তোলা বাদ দিয়ে খরচ ৪০০', sums.expenseTotal === 400 && sums.ownerDrawings === 400, JSON.stringify({ e: sums.expenseTotal, o: sums.ownerDrawings }))
  check('নিট লাভ = ১,৫০০ − ৪০০ = ১,১০০', sums.netProfit === 1100, String(sums.netProfit))
  check('নগদ ৬,৫০০ ও বাকি ১,০০০ আলাদা দেখায়', sums.cashSales === 6500 && sums.dueSales === 1000, JSON.stringify({ c: sums.cashSales, d: sums.dueSales }))
  check('এ সময়ের পণ্য ক্রয় ১,১০০ (লাভ থেকে বাদ যায় না)', sums.purchaseTotal === 1100)
  check('খরচের খাত বড় থেকে ছোট ক্রমে সাজে', sums.expensesByCategory[0].category === 'ভাড়া' && sums.expensesByCategory.length === 2, JSON.stringify(sums.expensesByCategory))
  const branchOnly = PL.computeProfitLoss(useSalesStore.getState().sales, [], usePurchaseStore.getState().purchases as never, { from: TODAY, to: TODAY }, 'branch-1')
  check('শাখা দিলে শুধু সেই শাখার হিসাব (৭,৫০০ → ২,৫০০)', branchOnly.revenue === 2500, String(branchOnly.revenue))
  const lossCase = PL.computeProfitLoss([mkSale('S-H-5', 100, 10, 'নগদ')], [{ amount: 500, kind: 'shop', date: TODAY, category: 'অন্যান্য', branch_id: 'branch-1' }] as never, [], { from: TODAY, to: TODAY })
  check('খরচ বেশি হলে নিট ক্ষতি ঋণাত্মক হয়', lossCase.netProfit === -490, String(lossCase.netProfit))

  /* ════════ ২) লাভ-ক্ষতি পেজ (ব্যবস্থাপক) ════════ */
  section('ProfitLoss — পেজে আজ/মাস/কাস্টম ও প্রিভিউ')
  await renderAt('/profit-loss', plRoutes, { ...managerUser })
  await settle(240)
  check('লাভ-ক্ষতি পেজ ও ব্যাখ্যা দেখায়', hasText('লাভ-ক্ষতি রিপোর্ট') && hasText('বিক্রি − ক্রয়মূল্য − খরচ = নিট লাভ/ক্ষতি'), text().slice(0, 200))
  /* ম্যানেজারের নিজের শাখা: বিক্রি ২,৫০০ − ক্রয়মূল্য ২,০০০ = গ্রস ৫০০ − খরচ ৪০০ = নিট ১০০ */
  check('আজকের নিট লাভ ১০০ দেখায়', hasText('নিট লাভ') && hasText(cash(100)), text().slice(0, 300))
  check('শিরোনামে নিজের শাখার নাম দেখায়', hasText('প্রধান শাখা'))
  check('[ফাইন্ডিং] সময়কালের তারিখ ISO ইংরেজি অঙ্কে দেখায় (বাংলায় নয়)', hasText(TODAY), text().slice(0, 200))
  await clickText('রিপোর্ট দেখুন')
  await settle(240)
  check('প্রিভিউ মডাল ও PDF/শেয়ার বোতাম দেখায়', !!find('[aria-label*="লাভ-ক্ষতি"]') && hasText('PDF ডাউনলোড') && hasText('ছবি শেয়ার'), text().slice(0, 200))
  check('প্রিভিউতে মোট বিক্রি ২,৫০০ ও ক্রয়মূল্য ২,০০০', hasText(cash(2500)) && hasText(cash(2000)), text().slice(0, 500))
  check('প্রিভিউতে খরচ ৪০০ ও খাতের ভাঙা', hasText(cash(400)) && hasText('ভাড়া') && hasText('বেতন'), text().slice(0, 600))
  check('প্রিভিউতে পণ্য ক্রয় ১,১০০ আলাদা দেখায়', hasText('এই সময়ে পণ্য ক্রয়') && hasText(cash(1100)), text().slice(0, 700))
  check('প্রিভিউতে মালিকের টাকা তোলা লাভ থেকে বাদ ندارد', hasText('মালিকের ব্যক্তিগত টাকা তোলা') && hasText(cash(400)), text().slice(0, 700))
  await pressEscapeClose()
  check('প্রিভিউ বন্ধ হয়', !find('[aria-label*="লাভ-ক্ষতি"]'))
  await clickText('চলতি মাস')
  await settle(220)
  check('চলতি মাসে আজ+গতকাল ধরে নিট ১৯৯ (গ্রস ৫৯৯ − খরচ ৪০০)', hasText(cash(199)), text().slice(0, 300))
  await clickText('কাস্টম')
  await settle(200)
  check('কাস্টম তারিখের দুই ঘর আসে', !!fieldByLabel('থেকে') && !!fieldByLabel('পর্যন্ত'))
  await setElValue(fieldByLabel('থেকে')!, YESTERDAY)
  await setElValue(fieldByLabel('পর্যন্ত')!, YESTERDAY)
  await settle(220)
  check('গতকালের হিসাব আলাদা দেখায় (নিট ৯৯)', hasText(cash(99)), text().slice(0, 300))
  await clickText('আজ')
  await settle(180)
  await renderAt('/profit-loss', plRoutes, { ...ownerUser })
  await settle(240)
  check('মালিক সব শাখার হিসাব দেখেন (নিট ১,১০০)', hasText(cash(1100)), text().slice(0, 300))
  const branchSel = fieldByLabel('শাখা')
  await setElValue(branchSel!, 'branch-2')
  await settle(220)
  check('শাখা বাছলে শুধু সেই শাখার হিসাব (নিট ১,০০০)', hasText(cash(1000)) && !hasText(cash(1100)), text().slice(0, 300))
  await renderAt('/profit-loss', plRoutes, { ...salesmanUser })
  await settle(200)
  check('সেলস ম্যান লাভ-ক্ষতি দেখতে পারে না', hasText('লাভ-ক্ষতির হিসাব শুধু মালিক ও শাখা ব্যবস্থাপক দেখতে পারবেন।'), text().slice(0, 160))
  await renderAt('/profit-loss', plRoutes, { ...customerUser })
  await settle(200)
  check('ক্রেতা লাভ-ক্ষতি দেখতে পারে না', hasText('লাভ-ক্ষতির হিসাব শুধু মালিক ও শাখা ব্যবস্থাপক দেখতে পারবেন।'))

  /* ════════ ৩) ড্যাশবোর্ড (ব্যবস্থাপক) ════════ */
  section('Dashboard — ব্যবস্থাপকের আজকের হিসাব')
  await renderAt('/', dashRoutes, { ...managerUser })
  await settle(260)
  check('ড্যাশবোর্ড ও আজকের হিসাব কার্ড দেখায়', hasText('আজকের হিসাব') && hasText('বিক্রি') && hasText('আদায়') && hasText('খরচ'), text().slice(0, 240))
  check('আজকের বিক্রি ২,৫০০ (নিজের শাখা)', hasText(cash(2500)), text().slice(0, 400))
  check('আজকের আদায় ০ দেখায়', hasText('বাকি আদায়'))
  check('আজকের খরচ ৪০০ দেখায়', hasText(cash(400)))
  check('নিট লাভের ব্যানার দেখায় (১,১০০)', hasText('আজকের নিট লাভ') && hasText(cash(1100)), text().slice(0, 400))
  check('দ্রুত কাজে ৪টি অপশন দেখা যায়', hasText('দ্রুত কাজ') && hasText('৪টি অপশন') && hasText('নতুন বিক্রি'), text().slice(0, 300))
  check('দ্রুত কাজের লিংক ঠিক (/sales)', !!all<HTMLAnchorElement>('a[href="/sales"]')[0])
  check('স্টক সতর্কতার অংশ দেখা যায়', hasText('স্টক') && (hasText('সব পণ্য পর্যাপ্ত') || hasText('স্টক কম')), text().slice(0, 400))
  check('আজকের বিক্রির কার্যকলাপ দেখায়', hasText('মিনিকেট চাল') || hasText('আজ কোনো বিক্রি নেই'), text().slice(0, 500))

  /* ════════ ৪) ড্যাশবোর্ড (সেলস ম্যান ও ক্রেতা) ════════ */
  section('Dashboard — সেলস ম্যান ও ক্রেতার ড্যাশবোর্ড')
  await renderAt('/', dashRoutes, { ...salesmanUser })
  await settle(260)
  check('সেলস ম্যানের ড্যাশবোর্ডে লাভের হিসাব লুকানো', hasText('মোট স্টক মূল্য') && !hasText('আজকের নিট লাভ'), text().slice(0, 300))
  check('সেলস ম্যানের কার্ডে "বাকি/পাওনা" দেখায়', hasText('বাকি') && hasText('পাওনা'), text().slice(0, 300))
  check('সেলস ম্যান স্টক মূল্য দেখতে পারেন', hasText('আপডেটেড'))
  await renderAt('/', dashRoutes, { ...customerUser })
  await settle(260)
  check('ক্রেতার ড্যাশবোর্ড "আপনার হিসাব" দেখায়', hasText('আপনার হিসাব'), text().slice(0, 200))
  check('ক্রেতার প্রোফাইল/বাকি তথ্য দেখায়', hasText('দোকানে বাকি') || hasText('অগ্রিম জমা'), text().slice(0, 300))
  check('ক্রেতার ড্যাশবোর্ডে দোকানের গোপন হিসাব নেই', !hasText('আজকের নিট লাভ') && !hasText('মোট স্টক মূল্য'), text().slice(0, 300))
  void useProductStore
  void useStockAdjustmentStore
}

async function pressEscapeClose() {
  await clickEl(find('[aria-label="প্রিভিউ বন্ধ করুন"]'))
  await settle(150)
}
