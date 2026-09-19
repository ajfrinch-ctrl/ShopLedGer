/* শর্টকাট-রাউট স্মোক: PWA শর্টকাটের প্রতিটি URL-এ পুরো অ্যাপ (লগইন-গার্ড + লেআউট + পেজ)
   রেন্ডার হয় কি না — ফাঁকা পেজ বা রাউটিং এরর থাকলে এখানে ধরা পড়ে।
   চালানোর নিয়ম: npm run test:ui-shortcuts */
const win = globalThis.window as unknown as { document: Document; happyDOM: { setURL: (u: string) => void } }
const React = (await import('react')).default
const { createRoot } = await import('react-dom/client')
const { act } = await import('react')
const { db } = await import('../src/lib/db')
const { APP_SHORTCUTS } = await import('../src/lib/pwaShortcuts')
const { default: App } = await import('../src/App')

// ডেমো মালিক হিসেবে সেশন — initialize() এখান থেকেই লগইন অবস্থা ফেরত পাবে
globalThis.localStorage.setItem('shopledger-session', 'owner-1')

await db.open()

let pass = 0
let fail = 0
let lastText = ''
function check(name: string, cond: boolean) {
  if (cond) {
    pass++
    console.log('  ✓', name)
  } else {
    fail++
    console.log('  ✗', name)
    console.log('    ← পাওয়া টেক্সট:', JSON.stringify(lastText.slice(0, 200)))
  }
}

/** শর্টকাট URL → পেজের শিরোনাম (যে টেক্সট থাকলে পেজটি রেন্ডার হয়েছে ধরা হয়) */
const EXPECT: Record<string, string[]> = {
  '/sales': ['পন্য বিক্রি'],
  '/customers': ['ক্রেতা'],
  '/expenses': ['খরচ এন্ট্রি'],
  '/stock': ['স্টক হিসাব'],
  '/reports': ['রিপোর্ট সেন্টার'],
}

const roots: Array<{ unmount: () => void }> = []
for (const shortcut of APP_SHORTCUTS) {
  const path = shortcut.path
  console.log(`${shortcut.name} → ${path}`)
  while (roots.length) {
    const r = roots.pop()!
    await act(async () => {
      r.unmount()
    })
  }
  win.document.body.innerHTML = ''
  ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
  win.happyDOM.setURL(`http://localhost${path}`)

  const host = win.document.createElement('div')
  win.document.body.appendChild(host)
  const root = createRoot(host as unknown as HTMLElement)
  roots.push(root as unknown as { unmount: () => void })
  await act(async () => {
    root.render(React.createElement(App))
  })
  // initialize()/লাইভ-কোয়েরি ফ্লাশ হতে সময় দিন
  await act(async () => {
    await new Promise((r) => setTimeout(r, 150))
  })
  lastText = win.document.body.textContent || ''

  check('লগইনে ফেরত যায়নি (সেশন ঠিক আছে)', (win as unknown as { location: Location }).location.pathname === path)
  check('লেআউট রেন্ডার হয়েছে (নিচের নেভ)', lastText.includes('আরও') && lastText.includes('ShopLedGer'))
  check('উদ্দিষ্ট পেজের কন্টেন্ট এসেছে', EXPECT[path].every((t) => lastText.includes(t)))
  check('পেজ ফাঁকা নয়', lastText.trim().length > 40)
}

while (roots.length) {
  const r = roots.pop()!
  await act(async () => {
    r.unmount()
  })
}

console.log(`\nশর্টকাট স্মোক: ${pass} পাস, ${fail} ফেল`)
if (fail > 0) process.exit(1)
