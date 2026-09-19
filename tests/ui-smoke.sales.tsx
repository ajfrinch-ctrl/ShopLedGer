/* UI স্মোক: পন্য বিক্রি ইন্টারফেস
   যাচাই করে — কার্ট/বিল শিট খোলে, সাবমিট বোতাম সবসময় পিন করা ফুটারে (নেভিগেশন বারের
   উপরে) থাকে, বাকি বিক্রিতে ক্রেতা ছাড়া সেভ আটকে ইনলাইন কারণ দেখায়, আর স্টক কম থাকলে
   window.confirm-এর বদলে ফুটারের ভিতরেই নিশ্চিতকরণ আসে।
   চালান: npm run test:ui-sales */
const win = globalThis.window as unknown as { document: Document }
const React = (await import('react')).default
const { createRoot } = await import('react-dom/client')
const { act } = await import('react')
const { MemoryRouter, Routes, Route } = await import('react-router-dom')
const { db } = await import('../src/lib/db')
const { useAuthStore } = await import('../src/stores/authStore')
const { useSalesStore } = await import('../src/stores/salesStore')
const { useProductStore } = await import('../src/stores/productStore')
const { usePurchaseStore } = await import('../src/stores/purchaseStore')
const { useStockAdjustmentStore } = await import('../src/stores/stockAdjustmentStore')

// window.confirm/alert আর ডাক পড়ার কথা না — পড়লেই ধরা পড়বে
let confirmCalls = 0
let alertCalls = 0
;(globalThis as Record<string, unknown>).confirm = () => { confirmCalls++; return true }
;(globalThis as Record<string, unknown>).alert = () => { alertCalls++ }

/* ── ডেটা সিড ── */
await db.open()
await db.branches.put({ id: 'branch-1', name: 'প্রধান শাখা', organization: 'কর্ণফুলী সেলস সেন্টার', address: 'চট্টগ্রাম', phone: '01800000000', is_active: true, created_at: '' } as never)
await db.customers.put({ id: 'c1', name: 'ক্রেতা করিম', phone: '01911111111', address: 'চট্টগ্রাম', branch_id: 'branch-1', created_at: '' } as never)
await db.users.put({ id: 'u-owner', name: 'মালিক', phone: '01700000000', password_hash: '', role: 'owner', is_active: true, created_at: '', updated_at: '' } as never)

const owner = { id: 'u-owner', name: 'মালিক', phone: '01700000000', role: 'owner' as const }

const inStock = {
  id: 'ps1', name: 'সয়াবিন মিল ৫০ কেজি', code: 'FEED-001', unit: 'বস্তা',
  opening_stock: 20, purchase_price: 1200, sale_price: 1500, branch_id: 'branch-1',
  created_at: '', updated_at: '',
}
const outOfStock = {
  id: 'ps2', name: 'ভুট্টা আটা', code: 'FEED-002', unit: 'কেজি',
  opening_stock: 0, purchase_price: 40, sale_price: 45, branch_id: 'branch-1',
  created_at: '', updated_at: '',
}

useProductStore.setState({ products: [inStock, outOfStock] as never, categories: [] as never })
usePurchaseStore.setState({ purchases: [] as never })
useStockAdjustmentStore.setState({ adjustments: [] as never })
useSalesStore.setState({ sales: [] as never })

let pass = 0
let fail = 0
const roots: Array<{ unmount: () => void }> = []
let lastText = ''

function check(name: string, cond: boolean, extra = '') {
  if (cond) { pass++; console.log('  ✓', name) } else {
    fail++
    console.log('  ✗', name, extra)
    console.log('    ← পাওয়া টেক্সট:', JSON.stringify(lastText.slice(0, 300)))
  }
}

async function renderAt(path: string) {
  while (roots.length) {
    const r = roots.pop()!
    await act(async () => { r.unmount() })
  }
  win.document.body.innerHTML = ''
  ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
  useAuthStore.setState({ user: owner, isAuthenticated: true, isLoading: false, error: null } as never)
  const host = win.document.createElement('div')
  win.document.body.appendChild(host)
  const root = createRoot(host as unknown as HTMLElement)
  roots.push(root as unknown as { unmount: () => void })
  const { default: Sales } = await import('../src/pages/Sales')
  await act(async () => {
    root.render(
      React.createElement(MemoryRouter, { initialEntries: [path] },
        React.createElement(Routes, null,
          React.createElement(Route, { path: '/sales', element: React.createElement(Sales) }))),
    )
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
  lastText = win.document.body.textContent || ''
  return lastText
}

/** ট্যাপ — টেক্সট / aria-label / সিলেক্টর দিয়ে; নির্দিষ্ট স্কোপের ভিতরেও খোঁজা যায় */
async function tap(target: { scope?: string; text?: string; label?: string; sel?: string }, nth = 0) {
  const root = target.scope ? win.document.querySelector(target.scope) : win.document
  if (!root) throw new Error(`স্কোপ পাওয়া যায়নি: ${target.scope}`)
  const all = Array.from(root.querySelectorAll(target.sel || 'button'))
  const hits = all.filter((el) => {
    if (target.sel) return true
    const text = el.textContent || ''
    const label = el.getAttribute('aria-label') || ''
    return target.text ? text.includes(target.text) : label.includes(target.label || '')
  })
  const el = hits[nth]
  if (!el) throw new Error(`বোতাম পাওয়া যায়নি: ${JSON.stringify(target)}`)
  await act(async () => {
    ;(el as unknown as { click: () => void }).click()
    await new Promise((r) => setTimeout(r, 40))
  })
  lastText = win.document.body.textContent || ''
  return el
}

const cls = (sel: string) => win.document.querySelector(sel)?.className || ''
const txt = (sel: string) => win.document.querySelector(sel)?.textContent || ''
const saleCount = () => useSalesStore.getState().sales.length

/* ── ১) পেজ রেন্ডার ── */
console.log('পন্য বিক্রি (/sales)')
let text = await renderAt('/sales')
check('শিরোনাম "পন্য বিক্রি" ও নির্দেশনা', text.includes('পন্য বিক্রি') && text.includes('কার্টে যোগ করুন'))
check('পণ্য কার্ড দুইটি', win.document.querySelectorAll('[data-product-card]').length === 2)
check('কার্ট খালি থাকলে ফ্লোটিং বার/সাবমিট নেই', !win.document.querySelector('[data-sale-bar]') && !win.document.querySelector('[data-sale-submit]'))
check('পুরোনো fixed-height র‍্যাপার নেই (ফুটার কাটা পড়ত)', !cls('[data-sale-page]').includes('100vh-128px'))

/* ── ২) কার্টে যোগ → ফ্লোটিং বার ── */
await tap({ label: 'কার্টে যোগ করুন' })
check('ফ্লোটিং বার নেভিগেশনের উপরে বসে', cls('[data-sale-bar]').includes('bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))]'))
check('বারে পণ্য সংখ্যা ও মোট (৳১,৫০০)', txt('[data-sale-bar]').includes('১,৫০০'))
check('কার্ট কার্ডে +/− স্টেপার', !!win.document.querySelector('[data-product-card] [aria-label*="বাড়ান"]'))

/* ── ৩) বিল শিট: সাবমিট পিন করা ফুটারে ── */
await tap({ sel: '[data-sale-bar] button' })
const sheet = win.document.querySelector('[data-sale-sheet]')
const sheetInner = sheet?.firstElementChild
const footer = win.document.querySelector('[data-sale-sheet-footer]')
const submit = win.document.querySelector('[data-sale-submit]')
check('বিল শিট খুলেছে', !!sheet)
check('শিট নেভিগেশন বারের উপরে', cls('[data-sale-sheet]').includes('bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))]'))
check('শিটের উচ্চতা ভিউপোর্ট-সীমিত (dvh)', (sheetInner?.className || '').includes('max-h-[min(64dvh,calc(100dvh-15.5rem))]'))
check('সাবমিট বোতাম পিন করা ফুটারের ভিতরে', !!submit && !!footer && footer.contains(submit))
check('ফুটার সংকুচিত হয় না (shrink-0)', (footer?.className || '').includes('shrink-0'))
check('স্ক্রল অংশ ফুটারের উপরে (সাবমিট স্ক্রলের বাইরে)', footer?.previousElementSibling?.className.includes('overflow-y-auto') === true && (footer.previousElementSibling?.className || '').includes('min-h-0'))
check('সাবমিট বোতামে মোট দাম', txt('[data-sale-submit]').includes('১,৫০০'))

/* ── ৪) শিটের ভিতরে পরিমাণ ও ছাড় ── */
await tap({ scope: '[data-sale-sheet]', label: 'বাড়ান' })
check('শিটের + দিয়ে পরিমাণ বাড়লে মোট ৳৩,০০০', txt('[data-sale-submit]').includes('৩,০০০'))
await tap({ scope: '[data-sale-sheet]', text: 'ছাড় ৳৫০' })
check('এক ট্যাপে ছাড় ৳৫০ → মোট ৳২,৯৫০', txt('[data-sale-submit]').includes('২,৯৫০'))

/* ── ৫) বাকি + ক্রেতা নেই → ইনলাইন বাধা ── */
await tap({ scope: '[data-sale-sheet]', text: '📋 বাকি' })
check('ক্রেতা ছাড়া সাবমিট বন্ধ', (win.document.querySelector('[data-sale-submit]') as unknown as { disabled: boolean })?.disabled === true)
check('বাধার কারণ ইনলাইন (alert নয়)', txt('[data-sale-sheet-footer]').includes('ক্রেতা') && txt('[data-sale-sheet]').includes('বাকি লিখতে ক্রেতার নাম দরকার'))
await tap({ scope: '[data-sale-sheet]', sel: '[data-sale-submit]' })
check('বন্ধ সাবমিটে কিছু সেভ হয় না', saleCount() === 0 && alertCalls === 0)
await tap({ scope: '[data-sale-sheet]', text: 'ক্রেতা বাছুন' })
check('"ক্রেতা বাছুন" শিট বন্ধ করে ক্রেতা খোঁজায় নিয়ে যায়', !win.document.querySelector('[data-sale-sheet]') && !!win.document.querySelector('[data-sale-bar]'))

/* ── ৬) নগদ বিক্রি সেভ ── */
await tap({ sel: '[data-sale-bar] button' })
await tap({ scope: '[data-sale-sheet]', text: '💵 নগদ' })
await tap({ scope: '[data-sale-sheet-footer]', sel: '[data-sale-submit]' })
const cashSale = useSalesStore.getState().sales[0] as never as { total_amount: number; discount?: number; payment_type: string; items: Array<{ quantity: number; unit: string }> }
check('নগদ বিক্রি সেভ হয়েছে (৳২,৯৫০, ছাড় ৫০)', cashSale?.total_amount === 2950 && cashSale?.discount === 50 && cashSale?.payment_type === 'নগদ')
check('পরিমাণ ও একক ঠিক আছে', cashSale?.items[0]?.quantity === 2 && cashSale?.items[0]?.unit === 'বস্তা')
check('সেভের পর কার্ট খালি ও রসিদ খুলেছে', !win.document.querySelector('[data-sale-bar]') && lastText.includes('বিক্রি সফলভাবে সেভ হয়েছে'))
check('window.confirm/alert ব্যবহার হয়নি', confirmCalls === 0 && alertCalls === 0)

/* ── ৭) বাকি বিক্রি: ক্রেতা ?customer= দিয়ে আগেই নির্বাচিত ── */
console.log('বাকি বিক্রি — ক্রেতা নির্বাচিত')
useSalesStore.setState({ sales: [] as never })
text = await renderAt('/sales?customer=c1')
check('ক্রেতা আগেই নির্বাচিত', text.includes('নির্বাচিত ক্রেতা') && text.includes('ক্রেতা করিম'))
await tap({ label: 'কার্টে যোগ করুন' })
await tap({ sel: '[data-sale-bar] button' })
await tap({ scope: '[data-sale-sheet]', text: '📋 বাকি' })
check('ক্রেতা থাকলে বাকি সেভ চালু', (win.document.querySelector('[data-sale-submit]') as unknown as { disabled: boolean })?.disabled === false)
check('কাকে বাকিতে যাচ্ছে তা স্পষ্ট', txt('[data-sale-sheet]').includes('ক্রেতা করিম') && txt('[data-sale-sheet]').includes('বাকিতে'))
await tap({ scope: '[data-sale-sheet-footer]', sel: '[data-sale-submit]' })
const dueSale = useSalesStore.getState().sales[0] as never as { customer_id?: string; payment_type: string; total_amount: number }
check('বাকি বিক্রি ক্রেতার নামে সেভ', dueSale?.customer_id === 'c1' && dueSale?.payment_type === 'বাকি' && dueSale?.total_amount === 1500)

/* ── ৮) স্টক কম → ফুটারেই ইনলাইন নিশ্চিতকরণ ── */
console.log('স্টক কম — ইনলাইন নিশ্চিতকরণ')
useSalesStore.setState({ sales: [] as never })
await renderAt('/sales')
await tap({ label: 'কার্টে যোগ করুন' }, 1) // দ্বিতীয় পণ্য (স্টক ০)
await tap({ sel: '[data-sale-bar] button' })
await tap({ scope: '[data-sale-sheet-footer]', sel: '[data-sale-submit]' })
check('প্রথম ট্যাপে সেভ হয় না, নিশ্চিতকরণ দেখায়', saleCount() === 0 && txt('[data-sale-sheet-footer]').includes('স্টক যথেষ্ট নেই'))
check('নিশ্চিতকরণ ফুটারের ভিতরেই (নেভিগেশনের উপরে)', !!win.document.querySelector('[data-sale-sheet-footer]')?.textContent?.includes('হ্যাঁ, সেভ করুন'))
await tap({ scope: '[data-sale-sheet-footer]', text: 'বাতিল' })
check('বাতিল করলে সেভ হয় না, শিট খোলা থাকে', saleCount() === 0 && !!win.document.querySelector('[data-sale-sheet]'))
await tap({ scope: '[data-sale-sheet-footer]', sel: '[data-sale-submit]' })
await tap({ scope: '[data-sale-sheet-footer]', text: 'হ্যাঁ, সেভ করুন' })
check('নিশ্চিত করলে সেভ হয়', saleCount() === 1)
check('পুরো ফ্লোতে window.confirm দরকার পড়েনি', confirmCalls === 0)

await act(async () => { await new Promise((r) => setTimeout(r, 40)) })
while (roots.length) {
  const r = roots.pop()!
  await act(async () => { r.unmount() })
}

useAuthStore.setState({ user: null, isAuthenticated: false } as never)
console.log(`\nস্মোক (বিক্রি): ${pass} পাস, ${fail} ব্যর্থ`)
process.exit(fail ? 1 : 0)
