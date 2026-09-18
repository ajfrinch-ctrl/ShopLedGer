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
check('হিসাব বিবরণী পপ-আপ (ডাউনলোড + শেয়ার)', txt.includes('PDF ডাউনলোড') && txt.includes('শেয়ার'))
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
check('বাকি দেখাচ্ছে', txt.includes('১,৫০০') || txt.includes('বাকি'))
check('বার্তা বোতাম', txt.includes('বার্তা') || txt.includes('মেসেজ'))

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
console.log('Reports (/reports/sales) — মালিক')
txt = await renderAt('/reports/sales', [['/reports/:kind?', Reports]])
check('রিপোর্ট প্রস্তুত কার্ড', txt.includes('রিপোর্ট প্রস্তুত'))
check('প্রিভিউ বোতাম', txt.includes('রিপোর্ট দেখুন'))
check('ক্যাপচারের জন্য লুকানো A4 শিট আছে', !!win.document.querySelector('[data-sheet]'))
const sheetText = win.document.querySelector('[data-sheet]')?.textContent || ''
check('শিটে প্রতিষ্ঠানের নাম', sheetText.includes('রহিম ফিড স্টোর'))
check('শিটে ঠিকানা', sheetText.includes('চকবাজার'))
check('শিটে ফোন', sheetText.includes('01800000000'))
check('শিটে লোগো', !!win.document.querySelector('[data-sheet] [data-pad-logo]'))
check('প্যাড মাঝখানে বসেছে', padsCentered())
txt = await clickButton('রিপোর্ট দেখুন')
check('প্রিভিউ পপ-আপ খুলেছে', txt.includes('PDF ডাউনলোড') && txt.includes('শেয়ার'))
check('পপ-আপের প্রিভিউতে প্যাডের নাম', (win.document.querySelector('[data-report-modal]')?.textContent || '').includes('রহিম ফিড স্টোর'))

// ৯) লাভ-ক্ষতি — প্রিভিউ পপ-আপ (প্যাড সহ)
const { default: ProfitLoss } = await import('../src/pages/ProfitLoss')
console.log('ProfitLoss (/profit-loss) — মালিক')
txt = await renderAt('/profit-loss', [['/profit-loss', ProfitLoss]])
check('লাভ-ক্ষতির প্রিভিউ বোতাম', txt.includes('রিপোর্ট দেখুন'))
check('প্যাডের নাম দেখা যাচ্ছে', txt.includes('রহিম ফিড স্টোর'))
txt = await clickButton('রিপোর্ট দেখুন')
check('লাভ-ক্ষতির পপ-আপ (ডাউনলোড + শেয়ার)', txt.includes('PDF ডাউনলোড') && txt.includes('শেয়ার'))
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
check('রসিদে PDF + শেয়ার', txt.includes('PDF ডাউনলোড') && txt.includes('শেয়ার'))
check('রসিদের প্যাড মাঝখানে', padsCentered())

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
