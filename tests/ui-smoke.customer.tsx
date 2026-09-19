/* UI স্মোক: কাস্টমার-মডিউল + রিপোর্ট সেন্টার/প্যাড — পেজগুলো রেন্ডার হয় কি না এবং
   প্রতিষ্ঠানের প্যাড (লোগো/নাম/ঠিকানা) মাঝখানে বসে + প্রিভিউ পপ-আপ খোলে কি না যাচাই
   চালানোর নিয়ম: npx esbuild tests/tmp-smoke-customer.tsx --bundle --platform=node --format=esm \
     --packages=external --outfile=./tmp-smoke.mjs \
     --define:import.meta.env='{"BASE_URL":"/","MODE":"test","DEV":false,"PROD":true,"VITE_SUPABASE_URL":"","VITE_SUPABASE_ANON_KEY":""}'
   এরপর: node --import ./tests/smoke-preload.mjs ./tmp-smoke.mjs
   (প্রিলোড ফাইল IndexedDB + DOM গ্লোবাল আগেই বসায়) */
const win = globalThis.window as unknown as { document: Document }
const React = (await import('react')).default
const { createRoot } = await import('react-dom/client')
const { act } = await import('react')
const { MemoryRouter, Routes, Route } = await import('react-router-dom')
const { db } = await import('../src/lib/db')
const { useAuthStore } = await import('../src/stores/authStore')
const { useSalesStore } = await import('../src/stores/salesStore')

// ── ডেটা সিড ──
await db.open()
await db.branches.put({ id: 'branch-1', name: 'প্রধান শাখা', organization: 'রহিম ফিড স্টোর', address: 'দোকান নং ১২, চকবাজার, চট্টগ্রাম', phone: '01800000000', logo: 'data:image/png;base64,iVBORw0KGgo=', is_active: true, created_at: '' })
await db.branches.put({ id: 'branch-2', name: 'দ্বিতীয় শাখা', organization: 'রহিম ফিড স্টোর', is_active: true, created_at: '' })
await db.customers.put({ id: 'c1', name: 'ক্রেতা করিম', phone: '01911111111', address: 'চট্টগ্রাম', branch_id: 'branch-1', created_at: '' })
await db.users.put({ id: 'u-owner', name: 'মালিক', phone: '01700000000', password_hash: '', role: 'owner', is_active: true, created_at: '', updated_at: '' })
await db.users.put({ id: 'u-new', name: 'নতুন ক্রেতা', phone: '01777777777', password_hash: '', role: 'customer', is_active: false, approval: 'pending', created_at: new Date().toISOString(), updated_at: '' })
await db.sales.put({
  id: 's1', date: '2026-09-10', items: [{ product_id: 'p1', product_name: 'সয়াবিন ১ কেজি', quantity: 2, unit: 'কেজি', sale_price: 1000, purchase_price: 800, total: 2000, profit: 400 }],
  total_amount: 2000, total_profit: 400, payment_type: 'বাকি', customer_id: 'c1', customer_name: 'ক্রেতা করিম',
  branch_id: 'branch-1', created_by: 'u-owner', created_at: '', payment_number: 1, is_returned: false,
} as never)
await db.ledgerEntries.put({ id: 'e1', party_id: 'c1', party_name: 'ক্রেতা করিম', party_type: 'customer', kind: 'payment', amount: 500, date: '2026-09-15', branch_id: 'branch-1', method: 'বিকাশ', reference: '', note: '', cancelled: false, created_at: '', created_by: 'u-owner' })
await db.customerMessages.put({ id: 'm1', customer_id: 'c1', customer_name: 'ক্রেতা করিম', phone: '01911111111', branch_id: 'branch-1', kind: 'payment', amount: 500, method: 'বিকাশ', note: '', created_at: new Date().toISOString(), seen: false })

// অ্যাপে বিক্রি জাস্ট্যান্ড-স্টোর থেকে আসে (localStorage-এ persist হয়) — স্মোকেও সেটাই করি
useSalesStore.setState({ sales: [await db.sales.get('s1')] as never })

const owner = { id: 'u-owner', name: 'মালিক', phone: '01700000000', role: 'owner' as const }
const customerUser = { id: 'u-cust', name: 'ক্রেতা করিম', phone: '01911111111', role: 'customer' as const, branch_id: 'branch-1' }

let pass = 0, fail = 0
const roots: Array<{ unmount: () => void }> = []

async function renderAt(path: string, routes: Array<[string, React.ComponentType]>, as: 'owner' | 'customer' | 'guest' = 'owner') {
  // আগের রুট/রুট-ট্রি পুরোপুরি সরিয়ে ফেলি (MemoryRouter initialEntries শুধু প্রথম মাউন্টে কাজ করে)
  while (roots.length) {
    const r = roots.pop()!
    await act(async () => { r.unmount() })
  }
  win.document.body.innerHTML = ''
  ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
  useAuthStore.setState({
    user: as === 'owner' ? owner : as === 'customer' ? customerUser : null,
    isAuthenticated: as !== 'guest', isLoading: false, error: null,
  } as never)
  const host = win.document.createElement('div')
  win.document.body.appendChild(host)
  const root = createRoot(host as unknown as HTMLElement)
  roots.push(root as unknown as { unmount: () => void })
  await act(async () => {
    root.render(
      React.createElement(MemoryRouter, { initialEntries: [path] },
        React.createElement(Routes, null, ...routes.map(([p, C]) => React.createElement(Route, { key: p, path: p, element: React.createElement(C) })))),
    )
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
  lastText = win.document.body.textContent || ''
  return lastText
}

let lastText = ''
function check(name: string, cond: boolean, extra = '') {
  if (cond) { pass++; console.log('  ✓', name) } else {
    fail++
    console.log('  ✗', name, extra)
    console.log('    ← পাওয়া টেক্সট:', JSON.stringify(lastText.slice(0, 260)))
  }
}

const { default: Register } = await import('../src/pages/Register')
const { default: Profile } = await import('../src/pages/Profile')
const { default: CustomerProfile } = await import('../src/pages/CustomerProfile')
const { default: Customers } = await import('../src/pages/Customers')
const { default: MyDues } = await import('../src/pages/MyDues')
const { default: Orders } = await import('../src/pages/Orders')
const { default: Login } = await import('../src/pages/Login')

/** লেখা দিয়ে বোতাম খুঁজে চাপ দেয় (React ইভেন্টসহ) */
async function clickButton(match: string, nth = 0) {
  const buttons = Array.from(win.document.querySelectorAll('button'))
  const targets = buttons.filter((b) => (b.textContent || '').includes(match))
  const target = targets[nth]
  if (!target) throw new Error(`বোতাম পাওয়া যায়নি: ${match}`)
  await act(async () => {
    ;(target as unknown as { click: () => void }).click()
    await new Promise((r) => setTimeout(r, 40))
  })
  lastText = win.document.body.textContent || ''
  return lastText
}

/** সব প্যাড-হেডার কেন্দ্রে বসেছে কি না (logo/নাম/ঠিকানা মাঝখানে) */
function padsCentered() {
  const pads = Array.from(win.document.querySelectorAll<HTMLElement>('[data-pad]'))
  return (
    pads.length > 0 &&
    pads.every((el) => el.style.textAlign === 'center' && el.style.alignItems === 'center')
  )
}

// ১) সাইন-আপ
console.log('Register (/register)')
let txt = await renderAt('/register', [['/register', Register]])
check('শিরোনাম আছে', txt.includes('সাইন-আপ') || txt.includes('নিবন্ধন'))
check('নাম/মোবাইল/পাসওয়ার্ড ফিল্ড আছে', txt.includes('আপনার নাম') && txt.includes('মোবাইল নম্বর') && txt.includes('পাসওয়ার্ড'))

// ২) নিজের প্রোফাইল (ক্রেতা)
console.log('Profile (/profile) — ক্রেতা')
txt = await renderAt('/profile', [['/profile', Profile]], 'customer')
check('প্রোফাইল শিরোনাম', txt.includes('প্রোফাইল'))
check('বাকি কার্ড', txt.includes('বাকি') || txt.includes('হিসাব'))
check('পাসওয়ার্ড বদল অংশ', txt.includes('পাসওয়ার্ড'))

// ৩) দোকানের দিকের ক্রেতা প্রোফাইল
console.log('CustomerProfile (/customers/c1)')
txt = await renderAt('/customers/c1', [['/customers/:id', CustomerProfile]])
check('ক্রেতার নাম', txt.includes('ক্রেতা করিম'))
check('ফোন', txt.includes('01911111111'))
check('খাতা/হিসাব অংশ', txt.includes('খাতা') || txt.includes('বাকি'))
check('বাকি টাকা ১৫০০', txt.includes('১,৫০০'))
check('হিসাব বিবরণীর প্রিভিউ বোতাম', txt.includes('হিসাব বিবরণী দেখুন'))
check('লুকানো A4 শিটে প্রতিষ্ঠানের প্যাড', (win.document.querySelector('[data-sheet]')?.textContent || '').includes('রহিম ফিড স্টোর'))
check('প্যাড মাঝখানে বসেছে', padsCentered())
txt = await clickButton('হিসাব বিবরণী দেখুন')
check('হিসাব বিবরণী পপ-আপ (PDF ডাউনলোড + ছবি শেয়ার)', txt.includes('PDF ডাউনলোড') && txt.includes('ছবি শেয়ার'))
check('পপ-আপে প্যাডের নাম-ঠিকানা-ফোন', txt.includes('রহিম ফিড স্টোর') && txt.includes('চকবাজার') && txt.includes('01800000000'))
check('পপ-আপ বন্ধ করা যায়', (() => { const b = Array.from(win.document.querySelectorAll('button')).find((x) => (x.getAttribute('aria-label') || '') === 'প্রিভিউ বন্ধ করুন'); return !!b })())

// ৪) ক্রেতা তালিকা + অনুমোদন সেকশন
console.log('Customers (/customers) — মালিক')
txt = await renderAt('/customers', [['/customers', Customers]])
check('ক্রেতা তালিকা', txt.includes('ক্রেতা করিম'))
check('অনুমোদন-অপেক্ষমাণ সেকশন', txt.includes('নতুন ক্রেতা'))
check('অনুমোদন বোতাম', txt.includes('অনুমোদন'))

// ৫) আমার বাকি (ক্রেতা)
console.log('MyDues (/my-dues) — ক্রেতা')
txt = await renderAt('/my-dues', [['/my-dues', MyDues]], 'customer')
check('Customer information, date filter ও summary দেখাচ্ছে', txt.includes('Customer Information') && txt.includes('From Date') && txt.includes('To Date') && txt.includes('Summary'))
check('Purchase History-তে নিজের রসিদ ও পণ্যের বিবরণ আছে', txt.includes('Purchase History') && txt.includes('Receipt No.') && txt.includes('সয়াবিন ১ কেজি'))
check('Statement Generate আছে, customer share/message নেই', txt.includes('Statement Generate') && !txt.includes('WhatsApp') && !txt.includes('অ্যাপে পাঠান'))
txt = await clickButton('Statement Generate')
check('Customer statement preview শুধু Download PDF', txt.includes('Download PDF') && !txt.includes('ছবি শেয়ার') && !txt.includes('WhatsApp'))

// ৬) অর্ডার/বার্তা (দোকান)
console.log('Orders (/orders) — মালিক')
txt = await renderAt('/orders', [['/orders', Orders]])
check('বার্তা ট্যাব', txt.includes('বার্তা'))

// ৭) লগইন পেজে সাইন-আপ লিংক
console.log('Login (/login)')
txt = await renderAt('/login', [['/login', Login]], 'guest')
check('সাইন-আপ লিংক', txt.includes('সাইন-আপ'))
check('ক্রেতা-সাইনআপের ঘোষণা', txt.includes('নতুন') && txt.includes('সাইন-আপ'))

// ৮) রিপোর্ট সেন্টার — প্রিভিউ পপ-আপ (প্যাড সহ)
const { default: Reports } = await import('../src/pages/Reports')
console.log('Reports — কার্ডে ট্যাপ, একই জায়গায় ফিল্টার, তারপর স্টেটমেন্ট')
txt = await renderAt('/reports', [['/reports/:kind?', Reports]])
check('পুরোনো সামারি প্যানেল নেই', !txt.includes('দ্রুত সারসংক্ষেপ'))
check('প্রথমে কোনো ফিল্টার বা প্রিভিউ নেই', !win.document.querySelector('[role="dialog"]'))
const salesCard = [...win.document.querySelectorAll('button')].find(b => b.textContent?.includes('বিক্রি রিপোর্ট'))!
salesCard.focus()
txt = await clickButton('বিক্রি রিপোর্ট')
await act(async () => { await new Promise(r => setTimeout(r, 150)) })
check('কার্ডেই রেঞ্জ পপ-আপ', !!win.document.querySelector('[data-report-filters]'))
check('শুরুর এবং শেষের তারিখ', win.document.querySelectorAll('[data-report-filters] input[type="date"]').length === 2)
check('পেছনের পৃষ্ঠা স্ক্রল বন্ধ', win.document.body.style.overflow === 'hidden')
check('ফোকাস ডায়ালগের মধ্যে', win.document.activeElement?.getAttribute('role') === 'dialog')
check('প্রিভিউর আগে A4 শিট তৈরি নয়', !win.document.querySelector('[data-sheet]'))
await clickButton('এই মাস')
const chosenFrom = (win.document.querySelector('input[type="date"]') as HTMLInputElement).value
txt = await clickButton('স্টেটমেন্ট দেখুন')
check('প্রিভিউ পপ-আপ খুলেছে', txt.includes('PDF ডাউনলোড') && txt.includes('ছবি শেয়ার'))
check('ফিল্টার ও প্রিভিউ একসাথে নয়', win.document.querySelectorAll('[role="dialog"]').length === 1)
check('ক্যাপচারের জন্য লুকানো A4 শিট আছে', !!win.document.querySelector('[data-sheet]'))
const sheetText = win.document.querySelector('[data-sheet]')?.textContent || ''
check('শিটে প্রতিষ্ঠানের নাম', sheetText.includes('রহিম ফিড স্টোর'))
check('শিটে ঠিকানা', sheetText.includes('চকবাজার'))
check('শিটে ফোন', sheetText.includes('01800000000'))
check('শিটে লোগো', !!win.document.querySelector('[data-sheet] [data-pad-logo]'))
check('প্যাড মাঝখানে বসেছে', padsCentered())
check('পপ-আপের প্রিভিউতে প্যাডের নাম', (win.document.querySelector('[data-report-modal]')?.textContent || '').includes('রহিম ফিড স্টোর'))
await act(async () => { (win.document.querySelector('[aria-label="প্রিভিউ বন্ধ করুন"]') as HTMLButtonElement).click() })
check('প্রিভিউ বন্ধে ফিল্টারে ফেরা', !!win.document.querySelector('[data-report-filters]'))
check('নির্বাচিত রেঞ্জ অক্ষত', (win.document.querySelector('input[type="date"]') as HTMLInputElement).value === chosenFrom)
await act(async () => { win.document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
check('Escape-এ বন্ধ', !win.document.querySelector('[role="dialog"]'))
check('স্ক্রল লক মুক্ত', win.document.body.style.overflow !== 'hidden')
check('ফোকাস আগের কার্ডে ফেরে', win.document.activeElement === salesCard)
await clickButton('মাসিক লাভ রিপোর্ট')
await act(async () => { await new Promise(r => setTimeout(r, 150)) })
check('মাসিক রিপোর্টে শুধু মাস', !!win.document.querySelector('input[type="month"]') && !win.document.querySelector('input[type="date"]'))
await act(async () => { win.document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
await clickButton('দৈনিক লাভ রিপোর্ট')
await act(async () => { await new Promise(r => setTimeout(r, 150)) })
check('দৈনিক রিপোর্টে এক তারিখ', win.document.querySelectorAll('input[type="date"]').length === 1)

// বড় রিপোর্টের সব সারি প্রিভিউর পাতায় দেখা যায় এবং A4 ক্যাপচার ভাগ করা থাকে।
const { default: ReportPreview } = await import('../src/components/report/ReportPreview')
const { default: ReportSheet } = await import('../src/components/report/ReportSheet')
const longDoc = { kind: 'sales' as const, title: 'দীর্ঘ স্টেটমেন্ট', period: 'সেপ্টেম্বর', columns: [{ label: 'তারিখ' }, { label: 'পণ্য' }, { label: 'টাকা' }],
  rows: Array.from({ length: 601 }, (_, i) => ({ cells: ['১/৯/২০২৬', `সারি-${i + 1}`, '৳ ১'] })), totals: ['সর্বমোট', '', '৳ ৬০১'] }
function LongReport() {
  const ref = React.useRef<HTMLDivElement>(null)
  return <><ReportPreview doc={longDoc} businessName="দোকান" /><ReportSheet doc={longDoc} businessName="দোকান" sheetRef={ref} /></>
}
await renderAt('/long', [['/long', LongReport]])
check('প্রিভিউ প্রথম পাতায় সীমিত DOM', win.document.querySelectorAll('[data-report-preview] tbody tr').length === 100)
for (let i = 0; i < 6; i++) await clickButton('পরের পৃষ্ঠা')
check('শেষ সারিও প্রিভিউতে আছে', !!win.document.querySelector('[data-report-preview]')?.textContent?.includes('সারি-601'))
check('সব সারি A4 ব্লকে আছে', win.document.querySelectorAll('[data-report-page] tbody tr').length === 601)
check('বড় ক্যানভাসের বদলে ছোট ব্লক', win.document.querySelectorAll('[data-report-page]').length === 26)
check('মোট শুধু শেষ ব্লকে', win.document.querySelectorAll('[data-report-page] tfoot').length === 1)

// ৯) লাভ-ক্ষতি — প্রিভিউ পপ-আপ (প্যাড সহ)
const { default: ProfitLoss } = await import('../src/pages/ProfitLoss')
console.log('ProfitLoss (/profit-loss) — মালিক')
txt = await renderAt('/profit-loss', [['/profit-loss', ProfitLoss]])
check('লাভ-ক্ষতির প্রিভিউ বোতাম', txt.includes('রিপোর্ট দেখুন'))
check('প্যাডের নাম দেখা যাচ্ছে', txt.includes('রহিম ফিড স্টোর'))
txt = await clickButton('রিপোর্ট দেখুন')
check('লাভ-ক্ষতির পপ-আপ (PDF ডাউনলোড + ছবি শেয়ার)', txt.includes('PDF ডাউনলোড') && txt.includes('ছবি শেয়ার'))
check('পপ-আপের বডিতে লাভ-ক্ষতি বিবরণী', txt.includes('লাভ-ক্ষতি বিবরণী') && txt.includes('নিট'))
check('লাভ-ক্ষতির পপ-আপে প্যাড', padsCentered())

// ১০) বিক্রি রসিদ — প্যাড সহ প্রিভিউ
const { default: SaleReceipt } = await import('../src/components/SaleReceipt')
const seededSale = (await db.sales.get('s1'))!
await act(async () => {
  win.document.body.innerHTML = ''
  const host = win.document.createElement('div')
  win.document.body.appendChild(host)
  const root = createRoot(host as unknown as HTMLElement)
  roots.push(root as unknown as { unmount: () => void })
  root.render(
    React.createElement(SaleReceipt, {
      sale: seededSale as never,
      pad: { name: 'রহিম ফিড স্টোর', address: 'দোকান নং ১২, চকবাজার, চট্টগ্রাম', phone: '01800000000' },
      onClose: () => {},
    }),
  )
  await new Promise((r) => setTimeout(r, 30))
})
txt = win.document.body.textContent || ''
check('রসিদে প্রতিষ্ঠানের নাম', txt.includes('রহিম ফিড স্টোর'))
check('রসিদে ঠিকানা ও ফোন', txt.includes('চকবাজার') && txt.includes('01800000000'))
check('রসিদে PDF + ছবি শেয়ার', txt.includes('PDF ডাউনলোড') && txt.includes('ছবি শেয়ার / WhatsApp'))
check('রসিদের প্যাড মাঝখানে', padsCentered())
check('রসিদে কখনোই লাভ দেখাবে না', !txt.includes('লাভ'))

// ডিস্কাউন্ট সহ রসিদ টেস্ট
const discountedSale = {
  ...seededSale,
  subtotal: 2000,
  discount: 200,
  total_amount: 1800,
}
await act(async () => {
  win.document.body.innerHTML = ''
  const host = win.document.createElement('div')
  win.document.body.appendChild(host)
  const root = createRoot(host as unknown as HTMLElement)
  roots.push(root as unknown as { unmount: () => void })
  root.render(
    React.createElement(SaleReceipt, {
      sale: discountedSale as never,
      pad: { name: 'রহিম ফিড স্টোর' },
      onClose: () => {},
    }),
  )
  await new Promise((r) => setTimeout(r, 30))
})
txt = win.document.body.textContent || ''
check('ডিস্কাউন্ট রসিদে বিক্রিত দাম দেখাচ্ছে', txt.includes('বিক্রিত দাম'))
check('ডিস্কাউন্ট রসিদে মোট ডিস্কাউন্ট দেখাচ্ছে', txt.includes('মোট ডিস্কাউন্ট'))
check('ডিস্কাউন্ট রসিদে সর্বমোট প্রদেয় দেখাচ্ছে', txt.includes('সর্বমোট প্রদেয়'))
check('ডিস্কাউন্ট রসিদে লাভ দেখাচ্ছে না', !txt.includes('লাভ'))

// বাকি/পরিশোধ integration: বিল, আদায়, পরিশোধ, সংশোধন, প্যাড ও শাখা আলাদা।
console.log('Collections — পাওনা, দেনা, রসিদ ও অনুমতি')
const { default: Collections } = await import('../src/pages/Collections')
const { default: Dashboard } = await import('../src/pages/Dashboard')
const { usePurchaseStore } = await import('../src/stores/purchaseStore')
const { supplierId, ledgerToday } = await import('../src/lib/ledger')
const supplierKey = supplierId('ABC Trading')
await act(async () => { usePurchaseStore.setState({ purchases: [{ id: 'due-purchase', date: ledgerToday(), supplier: 'ABC Trading', payment_type: 'বাকি',
  product_id: 'p1', product_name: 'চাল', quantity: 10, unit: 'কেজি', purchase_price: 100, total: 1000, branch_id: 'branch-1', created_at: '' }] }) })
await db.customers.put({ id: 'secret-customer', name: 'অন্য শাখার ক্রেতা', branch_id: 'branch-2', created_at: '' })
await db.ledgerEntries.put({ id: 'secret-debt', party_id: 'secret-customer', party_name: 'অন্য শাখার ক্রেতা', party_type: 'customer', kind: 'opening', amount: 9000,
  date: ledgerToday(), branch_id: 'branch-2', method: '', reference: '', note: '', cancelled: false, created_by: 'u-owner', created_at: '' })

async function changeField(selector: string, value: string) {
  const input = win.document.querySelector(selector) as HTMLInputElement
  if (!input) throw new Error(`ইনপুট পাওয়া যায়নি: ${selector}`)
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}
async function settleLedger() {
  await act(async () => { await new Promise(r => setTimeout(r, 120)) })
  lastText = win.document.body.textContent || ''
}
await renderAt('/collections', [['/collections', Collections]])
await settleLedger()
check('হোমে শুধু দুইটি প্রধান খাতা', win.document.querySelectorAll('[aria-label="খাতার ধরন"] button').length === 2)
check('হোমে চারটি ছোট সারাংশ', win.document.querySelectorAll('[aria-label="খাতার সারাংশ"] dt').length === 4)
check('হোমে তালিকা বা payment form নেই', !win.document.querySelector('[aria-label="ক্রেতার খাতার তালিকা"]') && !win.document.querySelector('form'))
check('হোমে তিনটি রিপোর্ট', [...win.document.querySelectorAll('button')].filter(b => b.textContent?.includes('Report')).length === 3)
check('খাতার মূল স্ক্রিনে প্যাড বা প্যাডের লিংক নেই', !win.document.querySelector('[data-pad]') && !win.document.querySelector('a[href="/branch-pads"]'))
check('ক্রেতার পাওনায় সাপ্লায়ার নেই', !win.document.querySelector('[aria-label="ক্রেতার খাতার তালিকা"]')?.textContent?.includes('ABC Trading'))
await clickButton('আমরা দেব')
check('হোম থেকে URL অনুযায়ী সাপ্লায়ারের তালিকা', !!win.document.querySelector('[aria-label="সাপ্লায়ারের খাতার তালিকা"]')?.textContent?.includes('ABC Trading'))
check('সাপ্লায়ারের তালিকায় ক্রেতা নেই', !win.document.querySelector('[aria-label="সাপ্লায়ারের খাতার তালিকা"]')?.textContent?.includes('ক্রেতা করিম'))
await clickButton('ABC Trading')
check('বাকি ক্রয় শুধু ক্রয় বিল হিসেবে দেখায়', !!win.document.querySelector('[data-ledger-mobile]')?.textContent?.includes('ক্রয় বিল'))
check('সাপ্লায়ারের খাতায় পরিশোধ বাটন, আদায় বাটন নয়', !![...win.document.querySelectorAll('button')].find(b => b.textContent?.includes('পরিশোধ করুন')) && ![...win.document.querySelectorAll('button')].find(b => b.textContent?.includes('আদায় করুন')))
await clickButton('পরিশোধ করুন')
check('মালিকের branch selector থাকে', !![...win.document.querySelectorAll('[role="dialog"] label')].find(l => l.textContent?.includes('লেনদেনের শাখা')))
check('পরিশোধ ফর্ম modal-এ, প্যাড নয়', !!win.document.querySelector('[role="dialog"]') && !win.document.querySelector('[data-pad]'))
check('পরিশোধের সীমা বকেয়ার সমান', (win.document.querySelector('[role="dialog"] input[type="number"]') as HTMLInputElement).max === '1000')
await changeField('[role="dialog"] input[type="number"]', '200')
// happy-dom's decimal step validation differs from browsers; exercise the real submit handler.
;(win.document.querySelector('[role="dialog"] form') as HTMLFormElement).noValidate = true
await clickButton('সংরক্ষণ করুন')
await settleLedger()
const savedPayment = (await db.ledgerEntries.toArray()).find(e => e.party_id === supplierKey && e.kind === 'payment')
check('পরিশোধ supplier ledger-এ সংরক্ষিত', savedPayment?.party_type === 'supplier' && savedPayment.amount === 200)
check('সংরক্ষণের পর প্যাড/রসিদ নিজে খুলে না', !win.document.querySelector('[role="dialog"]') && !win.document.querySelector('[data-pad]'))
check('পরিশোধে দেনা কমেছে', win.document.querySelector('[data-ledger-mobile]')?.textContent?.includes('৮০০.০০') === true)
check('সফল সেভে অবশিষ্ট দেনা দেখায়', !!win.document.querySelector('[role="status"]')?.textContent?.includes('অবশিষ্ট দেনা') && !!win.document.querySelector('[role="status"]')?.textContent?.includes('৮০০.০০'))
await clickButton('রসিদ দেখুন')
check('নিজে রসিদ চাইলে তবেই প্যাড', !!win.document.querySelector('[data-pad]'))
check('সাপ্লায়ারের রসিদে পরিশোধ, আদায় নয়', !!win.document.querySelector('[role="dialog"]')?.textContent?.includes('টাকা পরিশোধের রসিদ') && !win.document.querySelector('[role="dialog"]')?.textContent?.includes('টাকা আদায়ের রসিদ'))
await act(async () => { win.document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
check('রসিদ বন্ধে খাতায় ফেরা', !win.document.querySelector('[role="dialog"]') && win.document.body.style.overflow !== 'hidden')
await clickButton('সম্পন্ন')
check('সম্পন্ন চাপলে success বন্ধ', !win.document.querySelector('[role="status"]'))
await act(async () => { for (const d of win.document.querySelectorAll('[data-ledger-mobile] details')) d.setAttribute('open', '') })
await clickButton('সংশোধন / বাতিল')
// মন্তব্য এবং কারণ — কারণটি শেষ text input।
const reasonInput = [...win.document.querySelectorAll('[role="dialog"] input')].find(i => i.parentElement?.textContent?.includes('পরিবর্তন / বাতিলের কারণ'))!
reasonInput.setAttribute('data-reason-test', '')
await changeField('[data-reason-test]', 'ভুল করে দুবার লেখা')
const priorConfirm = window.confirm
window.confirm = () => true
await clickButton('এই লেনদেন বাতিল করুন')
window.confirm = priorConfirm
await settleLedger()
check('বাতিলে দেনা ফিরে আসে, রেকর্ড মুছে যায় না', (await db.ledgerEntries.get(savedPayment!.id))?.cancelled === true && win.document.querySelector('[data-ledger-mobile]')?.textContent?.includes('১,০০০.০০') === true)
await clickButton('পরিশোধ করুন')
await changeField('[role="dialog"] input[type="number"]', '1001')
await act(async () => { win.document.querySelector('[role="dialog"] form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
await settleLedger()
check('অতিরিক্ত পরিশোধ সেভ-লজিকেও আটকায়', !!win.document.querySelector('[role="alert"]')?.textContent?.includes('বকেয়ার'))
await act(async () => { win.document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
await clickButton('বাকি হোম')
await clickButton('আমরা পাব')
await clickButton('ক্রেতা করিম')
check('ক্রেতার পাওনা supplier payment/cancellation-এ বদলায় না', win.document.querySelector('[data-ledger-mobile]')?.textContent?.includes('১,৫০০.০০') === true)
check('ক্রেতার খাতায় আদায় বাটন থাকে', !![...win.document.querySelectorAll('button')].find(b => b.textContent?.includes('আদায় করুন')))

await renderAt('/collections', [['/collections', Collections]])
await act(async () => { useAuthStore.setState({ user: { ...owner, id: 'manager-a', role: 'manager', branch_id: 'branch-1', branch_ids: ['branch-1'] } }) })
await settleLedger()
check('কর্মীর তালিকায় অন্য শাখার পাওনা/নাম নেই', !win.document.body.textContent?.includes('অন্য শাখার ক্রেতা'))
await clickButton('আমরা পাব')
await clickButton('ক্রেতা করিম')
await clickButton('আদায় করুন')
check('এক শাখার কর্মীর selector নেই, শাখা auto-select', ![...win.document.querySelectorAll('[role="dialog"] label')].some(l => l.textContent?.includes('লেনদেনের শাখা')) && !!win.document.querySelector('[role="dialog"]')?.textContent?.includes('প্রধান শাখা'))
await changeField('[role="dialog"] input[type="number"]', '100')
;(win.document.querySelector('[role="dialog"] form') as HTMLFormElement).noValidate = true
await clickButton('সংরক্ষণ করুন')
await settleLedger()
check('এক শাখার আদায় ঠিক শাখায় লেখা হয়', (await db.ledgerEntries.toArray()).some(e => e.party_id === 'c1' && e.amount === 100 && e.branch_id === 'branch-1'))
check('আদায়ে অবশিষ্ট পাওনা, দেনা নয়', !!win.document.querySelector('[role="status"]')?.textContent?.includes('অবশিষ্ট পাওনা') && !!win.document.querySelector('[role="status"]')?.textContent?.includes('১,৪০০.০০') && !win.document.querySelector('[role="status"]')?.textContent?.includes('দেনা'))
await clickButton('সম্পন্ন')
await act(async () => { useAuthStore.setState({ user: { ...owner, role: 'manager', branch_ids: ['branch-1', 'branch-2'] } }) })
await clickButton('আদায় করুন')
check('বহু শাখার কর্মীর selector থাকে', !![...win.document.querySelectorAll('[role="dialog"] label')].find(l => l.textContent?.includes('লেনদেনের শাখা')))
await act(async () => { win.document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
await renderAt('/collections?report=supplier', [['/collections', Collections]])
await settleLedger()
check('supplier report-এ বাতিল payment বাদ ও customer নেই', !!win.document.querySelector('[data-due-report-rows]')?.textContent?.includes('১,০০০.০০') && !win.document.querySelector('[data-due-report-rows]')?.textContent?.includes('ক্রেতা করিম'))
await renderAt('/collections?report=customer', [['/collections', Collections]])
await settleLedger()
check('customer report ledger-এর সাথে মেলে', !!win.document.querySelector('[data-due-report-rows]')?.textContent?.includes('১,৪০০.০০') && !win.document.querySelector('[data-due-report-rows]')?.textContent?.includes('ABC Trading'))
await renderAt('/collections?report=payments', [['/collections', Collections]])
await settleLedger()
check('payment report-এ প্রকৃত আদায় আছে, বাতিল পরিশোধ নেই', !!win.document.querySelector('[data-due-report-rows]')?.textContent?.includes('ক্রেতা করিম') && !win.document.querySelector('[data-due-report-rows]')?.textContent?.includes('ABC Trading'))
await renderAt('/collections?report=customer', [['/collections', Collections]])
await act(async () => { useAuthStore.setState({ user: { ...owner, role: 'manager', branch_ids: ['branch-1'] } }) })
await settleLedger()
check('রিপোর্টে অন্য শাখার নাম/পাওনা প্রকাশ হয় না', !win.document.body.textContent?.includes('অন্য শাখার ক্রেতা') && !win.document.body.textContent?.includes('৯,০০০.০০'))
await act(async () => { useAuthStore.setState({ user: { ...owner, role: 'manager', branch_ids: [], branch_id: '' } }) })
await settleLedger()
check('অনুমোদিত শাখা না থাকলে রিপোর্ট ফাঁকা', win.document.querySelector('[data-due-report-rows]')?.children.length === 0)
await renderAt('/collections?report=supplier', [['/collections', Collections]])
await act(async () => { useAuthStore.setState({ user: { ...owner, role: 'salesman', branch_id: 'branch-1' } }) })
await settleLedger()
check('salesman supplier report URL নিষিদ্ধ', !win.document.body.textContent?.includes('ABC Trading') && !!win.document.querySelector('[role="alert"]'))
await renderAt(`/collections?type=supplier&party=${encodeURIComponent(supplierKey)}`, [['/collections', Collections]])
await act(async () => { useAuthStore.setState({ user: { ...owner, id: 'salesman-a', role: 'salesman', branch_id: 'branch-1', branch_ids: ['branch-1'] } }) })
await settleLedger()
check('সেলস ম্যানের সরাসরি supplier URL-ও নিষিদ্ধ', win.document.body.textContent?.includes('শুধু মালিক ও ব্যবস্থাপক') === true && !win.document.body.textContent?.includes('ABC Trading'))

await renderAt('/', [['/', Dashboard]])
await settleLedger()
check('ড্যাশবোর্ডে শুধু প্রকৃত আদায়; বড় due-sale/payment card নেই', !win.document.body.textContent?.includes('আজকের বাকিতে বিক্রি') && !win.document.body.textContent?.includes('আজকের দেনা পরিশোধ') && !!win.document.body.textContent?.includes('বাকি আদায়'))
const collectionTitle = [...win.document.querySelectorAll('p')].find(p => p.textContent === 'বাকি আদায়')
check('বাকি পণ্য ক্রয় আজকের আদায়ে যোগ হয়নি', collectionTitle?.closest(".card")?.textContent?.includes('৳ ১০০') === true)

// Dashboard regression: isolated synthetic records, never production storage.
console.log('Dashboard — summary, role/branch scope, customer isolation')
const { useProductStore } = await import('../src/stores/productStore')
const { useStockAdjustmentStore } = await import('../src/stores/stockAdjustmentStore')
const { computeProfitLoss, toDateKey } = await import('../src/lib/profitLoss')
const { computeStock } = await import('../src/lib/stock')
const { money } = await import('../src/lib/ledger')
const dashToday = ledgerToday()
const sampleSale = { id: 'dash-sale', date: dashToday, items: [{ product_id: 'dp', product_name: 'চাল', quantity: 2, unit: 'কেজি', sale_price: 500, purchase_price: 350, total: 1000, profit: 300 }], total_amount: 1000, total_profit: 300, payment_type: 'বাকি' as const, customer_id: 'c1', customer_name: 'ক্রেতা করিম', branch_id: 'branch-1', created_by: owner.id, created_at: dashToday + 'T10:00:00' }
const samplePurchase = { id: 'dash-purchase', date: dashToday, product_id: 'dp', product_name: 'চাল', quantity: 10, unit: 'কেজি', total: 3500, purchase_price: 350, supplier: 'পরীক্ষার সাপ্লায়ার', payment_type: 'বাকি' as const, branch_id: 'branch-1', created_at: dashToday + 'T11:00:00' }
const sampleProduct = { id: 'dp', name: 'চাল', opening_stock: 5, purchase_price: 350, sale_price: 500, unit: 'কেজি', branch_id: 'branch-1', created_at: '', updated_at: '' }
const sampleExpenses = [
  { id: 'dash-shop-expense', date: dashToday, amount: 50, category: 'পরিবহন', kind: 'shop' as const, branch_id: 'branch-1', created_at: dashToday + 'T12:00:00' },
  { id: 'dash-personal', date: dashToday, amount: 900, category: 'ব্যক্তিগত', kind: 'owner' as const, branch_id: 'branch-1', created_at: dashToday + 'T13:00:00' },
  { id: 'dash-secret-expense', date: dashToday, amount: 800, category: 'গোপন খরচ', kind: 'shop' as const, branch_id: 'branch-2', created_at: dashToday + 'T15:00:00' },
]
// Snapshot absence of UI mutations after rendering/role changes.
await act(async () => {
await db.expenses.bulkPut(sampleExpenses)
await db.ledgerEntries.put({ id: 'dash-collection', party_id: 'c1', party_name: 'ক্রেতা করিম', party_type: 'customer', kind: 'payment', amount: 25, date: dashToday, branch_id: 'branch-1', method: 'নগদ টাকা', reference: '', note: '', cancelled: false, created_by: owner.id, created_at: dashToday + 'T14:00:00' })
await db.orders.bulkPut([
  { id: 'dash-order', customer_id: 'c1', customer_name: 'ক্রেতা করিম', items: [], total_amount: 50, status: 'pending', branch_id: 'branch-1', created_at: '', updated_at: '' },
  { id: 'dash-other-order', customer_id: 'secret-customer', customer_name: 'অন্য শাখার ক্রেতা', items: [], total_amount: 700, status: 'accepted', branch_id: 'branch-2', created_at: '', updated_at: '' },
])
await new Promise(r => setTimeout(r, 120))
})
await act(async () => {
  useSalesStore.setState({ sales: [sampleSale, { ...sampleSale, id: 'dash-secret-sale', branch_id: 'branch-2', customer_id: 'secret-customer', customer_name: 'গোপন ক্রেতা', total_amount: 9900, total_profit: 900, created_at: dashToday + 'T16:00:00' }] })
  usePurchaseStore.setState({ purchases: [samplePurchase] })
  useProductStore.setState({ products: [sampleProduct] })
  useStockAdjustmentStore.setState({ adjustments: [] })
})
const dashboardBefore = JSON.stringify({ entries: await db.ledgerEntries.toArray(), expenses: await db.expenses.toArray(), audits: await db.ledgerAudits.toArray() })
await renderAt('/', [['/', Dashboard]])
await settleLedger()
check('মালিকের চার summary ও চার action', win.document.querySelector('[data-today-summary]')?.children.length === 4 && win.document.querySelectorAll('[data-quick-actions] a').length === 4)
check('dashboard header-এ নাম ও তারিখ', !!win.document.querySelector('[data-dashboard] header')?.textContent?.includes(owner.name) && win.document.querySelector('[data-dashboard] header')?.children.length === 3)
check('দৈনিক auto report ও অতিরিক্ত quick action বাদ', !win.document.body.textContent?.includes('দৈনিক রিপোর্ট (অটো)') && !win.document.querySelector('[data-quick-actions] a[href="/reports"]') && !win.document.querySelector('[data-quick-actions] a[href="/customers"]'))
check('বর্তমান হিসাবের তিনটি clickable link', win.document.querySelectorAll('[data-current-summary] a').length === 3 && !!win.document.querySelector('[data-current-summary] a[href="/collections?type=customer"]') && !!win.document.querySelector('[data-current-summary] a[href="/collections?type=supplier"]') && !!win.document.querySelector('[data-current-summary] a[href="/stock"]'))
check('monthly compact, বড় card নয়', win.document.querySelector('[data-month-summary]')?.tagName === 'DL' && win.document.querySelectorAll('[data-month-summary] dt').length === 4 && !win.document.querySelector('[data-month-summary] .card'))
check('সর্বশেষ পাঁচটি, সব দেখুন authorized history', win.document.querySelectorAll('[data-recent-activity] li').length === 5 && !!win.document.querySelector('a[href="/reports/transaction"]'))
check('মালিক নিজের অনুমতিতে সব শাখার activity দেখেন', !!win.document.querySelector('[data-recent-activity]')?.textContent?.includes('গোপন ক্রেতা'))
await act(async () => { useAuthStore.setState({ user: { ...owner, role: 'manager', branch_ids: ['branch-1'] } }) })
await settleLedger()
const todayCard = (label: string) => [...win.document.querySelectorAll('[data-today-summary] .card')].find(c => [...c.querySelectorAll('p')].some(p => p.textContent === label))?.textContent || ''
const trusted = computeProfitLoss([sampleSale], sampleExpenses.filter(e => e.branch_id === 'branch-1'), [samplePurchase], { from: dashToday, to: dashToday })
check('বিক্রি trusted source-এর সমান ও অন্য শাখা বাদ', todayCard('মোট বিক্রি').includes(money(trusted.revenue)) && !win.document.body.textContent?.includes('গোপন ক্রেতা'))
check('দোকানের খরচ ব্যক্তিগত টাকা তোলা থেকে আলাদা', todayCard('মোট খরচ').includes(money(trusted.expenseTotal)) && trusted.expenseTotal === 50)
check('মোট লাভ স্পষ্ট নিট লাভ, ক্রয়/ব্যক্তিগত খরচ বাদ নয়', todayCard('মোট লাভ').includes(money(trusted.netProfit)) && trusted.netProfit === 250 && todayCard('মোট লাভ').includes('নিট লাভ'))
check('collection credit sale নয়', todayCard('বাকি আদায়').includes(money(125)))
const trustedStock = computeStock([sampleProduct], [samplePurchase], [sampleSale]).reduce((sum, r) => sum + r.stockValue, 0)
check('স্টক value আগের computeStock থেকে', !!win.document.querySelector('[data-current-summary] a[href="/stock"]')?.textContent?.includes(money(trustedStock)))
check('সাপ্লায়ার payable পরিশোধ নয়', !!win.document.querySelector('[data-current-summary] a[href="/collections?type=supplier"]')?.textContent?.includes(money(3500)))
check('মাসের বিক্রি/ক্রয়/খরচ/নিট লাভ trusted totals', [trusted.revenue, trusted.purchaseTotal, trusted.expenseTotal, trusted.netProfit].every((value, i) => win.document.querySelectorAll('[data-month-summary] dd')[i]?.textContent === money(value)))
check('ম্যানেজারের activity-এ অন্য শাখার নাম নেই', !win.document.querySelector('[data-recent-activity]')?.textContent?.includes('গোপন'))
const originalDashboardSales = useSalesStore.getState().sales
const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
await act(async () => { useSalesStore.setState({ sales: [...originalDashboardSales, { ...sampleSale, id: 'future-sale', date: toDateKey(tomorrow), total_amount: 50000 }] }) })
await settleLedger()
check('ভবিষ্যতের বিক্রি today/month summary বা activity-এ ঢোকে না', todayCard('মোট বিক্রি').includes(money(1000)) && win.document.querySelectorAll('[data-month-summary] dd')[0]?.textContent === money(1000) && !win.document.querySelector('[data-recent-activity]')?.textContent?.includes(money(50000)))
await act(async () => { useSalesStore.setState({ sales: originalDashboardSales.map(s => s.id === sampleSale.id ? { ...s, total_profit: -30 } : s) }) })
await settleLedger()
check('ক্ষতিতে minus অক্ষত ও নিট ক্ষতি লেখা', todayCard('মোট লাভ').includes(money(-80)) && todayCard('মোট লাভ').includes('নিট ক্ষতি'))
await act(async () => { useSalesStore.setState({ sales: originalDashboardSales }); useAuthStore.setState({ user: { ...owner, role: 'manager', branch_ids: ['branch-1', 'branch-2'] } }) })
await settleLedger()
check('multi-branch কর্মীর authorized দুই শাখা থাকে', todayCard('মোট বিক্রি').includes(money(10900)))
await act(async () => { useAuthStore.setState({ user: { ...owner, role: 'salesman', branch_id: 'branch-1' } }) })
await settleLedger()
check('salesman-কে খরচ/লাভ/ক্রয়/supplier totals দেয় না', win.document.querySelector('[data-today-summary]')?.children.length === 2 && win.document.querySelectorAll('[data-quick-actions] a').length === 2 && win.document.querySelectorAll('[data-month-summary] dt').length === 1 && !win.document.body.textContent?.includes('মোট লাভ') && !win.document.body.textContent?.includes('Supplier Payable'))
check('salesman activity-এ খরচ/ক্রয়/supplier leak নেই', !win.document.querySelector('[data-recent-activity]')?.textContent?.includes('সাপ্লায়ার') && !win.document.querySelector('[data-recent-activity]')?.textContent?.includes('ব্যক্তিগত') && !win.document.querySelector('a[href="/reports/transaction"]'))
await act(async () => { useAuthStore.setState({ user: { ...owner, role: 'manager', branch_ids: [], branch_id: '' } }) })
await settleLedger()
check('শাখা নেই = zero totals ও empty activity', todayCard('মোট বিক্রি').includes(money(0)) && win.document.querySelectorAll('[data-recent-activity] li').length === 0)
// Existing customer's phone link (no new identity or migration).
await renderAt('/', [['/', Dashboard]], 'customer')
await act(async () => { useAuthStore.setState({ user: { ...customerUser, phone: '01911111111' } }) })
await settleLedger()
check('Customer dashboard আলাদা', !!win.document.querySelector('[data-dashboard="customer"]') && !win.document.querySelector('[data-dashboard="shop"]'))
check('Customer শুধু নিজের ক্রয় দেখেন', !!win.document.body.textContent?.includes(money(1000)) && !win.document.body.textContent?.includes(money(9900)))
check('Customer dashboard-এ Statement entry আছে', !!win.document.querySelector('a[href="/my-dues"]') && !!win.document.body.textContent?.includes('ক্রয় হিস্ট্রি / Statement'))
check('Customer বাকি হিস্ট্রি accessible', !!win.document.querySelector('a[href="/my-dues"]'))
check('Customer-এ business/private sections বা links নেই', !['মোট বিক্রি', 'মোট লাভ', 'মোট খরচ', 'Supplier Payable', 'মোট স্টক মূল্য', 'গোপন ক্রেতা', 'বর্তমান হিসাব'].some(t => win.document.body.textContent?.includes(t)) && !win.document.querySelector('[data-recent-activity]'))
check('Dashboard viewing কোনো ledger/expense/audit write করে না', dashboardBefore === JSON.stringify({ entries: await db.ledgerEntries.toArray(), expenses: await db.expenses.toArray(), audits: await db.ledgerAudits.toArray() }))
const { default: More } = await import('../src/pages/More')
await renderAt('/more', [['/more', More]])
check('সরানো features More-এ আছে', ['/customers', '/orders', '/profit-loss', '/reports', '/stock'].every(path => !!win.document.querySelector(`a[href="${path}"]`)))

// ঝুলে থাকা state আপডেট শেষ করে রুটগুলো সরিয়ে ফেলি (act সতর্কবার্তা এড়াতে)
await act(async () => {
  await new Promise((r) => setTimeout(r, 40))
})
while (roots.length) {
  const r = roots.pop()!
  await act(async () => {
    r.unmount()
  })
}

useAuthStore.setState({ user: null, isAuthenticated: false })
console.log(`\nস্মোক: ${pass} পাস, ${fail} ব্যর্থ`)
process.exit(fail ? 1 : 0)
