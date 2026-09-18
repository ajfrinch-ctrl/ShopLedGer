/* UI স্মোক: কাস্টমার-মডিউলের পেজগুলো (রেজিস্টার/প্রোফাইল/ক্রেতা প্রোফাইল/বাকি/অর্ডার) রেন্ডার হয় কি না যাচাই
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
await db.branches.put({ id: 'branch-1', name: 'প্রধান শাখা', organization: 'রহিম ফিড স্টোর', is_active: true, created_at: '' })
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

useAuthStore.setState({ user: null, isAuthenticated: false })
console.log(`\nস্মোক: ${pass} পাস, ${fail} ব্যর্থ`)
process.exit(fail ? 1 : 0)
