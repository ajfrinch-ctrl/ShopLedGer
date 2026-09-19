/* চূড়ান্ত অডিটের শেয়ার্ড হারনেস — সব পেজ রেন্ডার করে আসল DOM ইভেন্টে চালানো হয়
   (ui-smoke-এর মতো একই কৌশল: happy-dom + fake-indexeddb + esbuild বান্ডল)।
   ডামি ডেটা Diye প্রতিটি পেজ, প্রতিটি ফাংশন ও প্রতিটি হিসাব যাচাই করা হয়। */

export const win = globalThis.window as unknown as Window & typeof globalThis

export const React = (await import('react')).default
export const { createRoot } = await import('react-dom/client')
export const { act } = await import('react')
export const { MemoryRouter, Routes, Route, Navigate } = await import('react-router-dom')

export const { db } = await import('../../src/lib/db')
export const { useAuthStore, hashPassword } = await import('../../src/stores/authStore')
export const { useSalesStore } = await import('../../src/stores/salesStore')
export const { usePurchaseStore } = await import('../../src/stores/purchaseStore')
export const { useProductStore } = await import('../../src/stores/productStore')
export const { useCustomerStore } = await import('../../src/stores/customerStore')
export const { useStockAdjustmentStore } = await import('../../src/stores/stockAdjustmentStore')
export const { useUiStore } = await import('../../src/stores/uiStore')
export type { AuthUser } from '../../src/stores/authStore'

/* ── ফলাফল সংগ্রহ ── */
export const results: { section: string; name: string; ok: boolean; note: string }[] = []
export const failures: { section: string; name: string; note: string }[] = []
let current = 'সেটআপ'
let pass = 0
let fail = 0
export let lastText = ''

export function section(title: string) {
  current = title
  console.log(`\n── ${title} ──`)
}

export function text(): string {
  return win.document.body.textContent || ''
}

export function find<T extends Element = HTMLElement>(sel: string): T | null {
  return win.document.querySelector(sel) as T | null
}

export function all<T extends Element = HTMLElement>(sel: string): T[] {
  return Array.from(win.document.querySelectorAll(sel)) as T[]
}

export function bodyText(sel: string): string {
  return find(sel)?.textContent || ''
}

export function check(name: string, cond: boolean, note = '') {
  const ok = !!cond
  results.push({ section: current, name, ok, note })
  if (ok) {
    pass++
    console.log('  ✓', name)
  } else {
    fail++
    failures.push({ section: current, name, note })
    console.log('  ✗', name, note)
    console.log('    ← দেখা যাওয়া লেখা:', JSON.stringify(text().slice(0, 220)))
  }
}

export function counts() {
  return { pass, fail }
}

/* ── রেন্ডার ── */
export const roots: Array<{ unmount: () => void }> = []

export interface SeedUser {
  id: string
  name: string
  phone: string
  role: 'owner' | 'manager' | 'salesman' | 'staff' | 'customer'
  branch_id?: string
  branch_ids?: string[]
}

export async function unmountAll() {
  while (roots.length) {
    const r = roots.pop()!
    await act(async () => {
      r.unmount()
    })
  }
  win.document.body.innerHTML = ''
}

/** একটি রুট রেন্ডার করে (auth store-এ ভূমিকা বসিয়ে) */
export async function renderAt(
  path: string,
  routes: Array<[string, unknown]>,
  as: SeedUser | 'guest' | 'none' = 'none',
) {
  await unmountAll()
  ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
  if (as !== 'none') {
    useAuthStore.setState({
      user: as === 'guest' ? null : as,
      isAuthenticated: as !== 'guest',
      isLoading: false,
      error: null,
    } as never)
  }
  const host = win.document.createElement('div')
  win.document.body.appendChild(host)
  const root = createRoot(host as unknown as HTMLElement)
  roots.push(root as unknown as { unmount: () => void })
  await act(async () => {
    root.render(
      React.createElement(
        MemoryRouter,
        { initialEntries: [path] },
        React.createElement(
          Routes,
          null,
          ...routes.map(([p, C]) =>
            React.createElement(Route, { key: p, path: p, element: React.createElement(C as never) }),
          ),
        ),
      ),
    )
  })
  await settle(40)
  return text()
}

/** react state/ডেটা settle হওয়া পর্যন্ত অপেক্ষা */
export async function settle(ms = 60) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })
  lastText = text()
}

/* ── DOM ইন্টার‍্যাকশন ── */
const nfcText = (s: string | null) => (s || '').normalize('NFC')

export function buttonByText(match: string, nth = 0): HTMLElement | undefined {
  return all('button')
    .filter((b) => nfcText(b.textContent).includes(nfcText(match)))
    .filter((b) => !b.hasAttribute('disabled') || (b as HTMLButtonElement).disabled === false)[nth] as
    | HTMLElement
    | undefined
}

export function buttonsByText(match: string): HTMLElement[] {
  return all('button').filter((b) => nfcText(b.textContent).includes(nfcText(match))) as HTMLElement[]
}

/** টেক্সট মেলানো NFC-নিরপেক্ষভাবে (বাংলা 'য়' দুই রূপে লেখা থাকলেও ধরা পড়ে) */
export const hasTextNfc = (needle: string) => nfcText(text()).includes(nfcText(needle))
export const nfc = (s: string) => s.normalize('NFC')

export function linkByHref(href: string): HTMLAnchorElement | null {
  return all<HTMLAnchorElement>(`a[href="${href}"]`)[0] || null
}

export async function clickText(match: string, nth = 0): Promise<string> {
  const target = buttonByText(match, nth)
  if (!target) throw new Error(`বোতাম পাওয়া যায়নি: ${match}`)
  await act(async () => {
    target.click()
    await new Promise((r) => setTimeout(r, 40))
  })
  lastText = text()
  return lastText
}

export async function clickEl(el: Element | null | undefined): Promise<string> {
  if (!el) throw new Error('ক্লিক করার এলিমেন্ট নেই')
  await act(async () => {
    ;(el as HTMLElement).click()
    await new Promise((r) => setTimeout(r, 40))
  })
  lastText = text()
  return lastText
}

export function setNativeValue(el: Element, value: string) {
  const proto = el.tagName === 'SELECT' ? win.HTMLSelectElement.prototype : win.HTMLInputElement.prototype
  const desc = Object.getOwnPropertyDescriptor(proto, 'value')
  if (desc?.set) desc.set.call(el, value)
  else (el as HTMLInputElement).value = value
}

export async function setField(selector: string, value: string, nth = 0): Promise<void> {
  const el = all(selector)[nth]
  if (!el) throw new Error(`ফিল্ড পাওয়া যায়নি: ${selector} #${nth}`)
  await act(async () => {
    setNativeValue(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 20))
  })
}

export async function setElValue(el: Element, value: string): Promise<void> {
  await act(async () => {
    setNativeValue(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 20))
  })
}

export async function setChecked(el: Element, checked: boolean): Promise<void> {
  await act(async () => {
    const desc = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'checked')
    if (desc?.set) desc.set.call(el, checked)
    else (el as HTMLInputElement).checked = checked
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.dispatchEvent(new Event('click', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 20))
  })
}

/** ফর্ম submit (happy-dom-এর step validation এড়াতে noValidate দেওয়া হয়) */
export async function submitForm(form?: Element | null): Promise<void> {
  const el = (form || find('form')) as HTMLFormElement | null
  if (!el) throw new Error('ফর্ম পাওয়া যায়নি')
  el.noValidate = true
  await act(async () => {
    el.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await new Promise((r) => setTimeout(r, 60))
  })
  lastText = text()
}

/** লেবেলের লেখা দিয়ে ইনপুট খুঁজে বের করা */
export function fieldByLabel(label: string, within: ParentNode = win.document): HTMLInputElement | null {
  const labels = Array.from(within.querySelectorAll('label'))
  const hit = labels.find((l) => nfcText(l.textContent).includes(nfcText(label)))
  if (!hit) return null
  const inside = hit.querySelector('input, select, textarea')
  if (inside) return inside as HTMLInputElement
  // অনেক ফর্মে label-এর ভাই-এলিমেন্টে ইনপুট থাকে
  const near = hit.parentElement?.querySelector('input, select, textarea')
  if (near) return near as HTMLInputElement
  let sib = hit.nextElementSibling
  while (sib && sib !== hit) {
    const found = sib.querySelector?.('input, select, textarea') || (sib.matches?.('input, select, textarea') ? sib : null)
    if (found) return found as HTMLInputElement
    sib = sib.nextElementSibling
  }
  return null
}

export function dialog(): HTMLElement | null {
  return find('[role="dialog"]')
}

export function dialogText(): string {
  return dialog()?.textContent || ''
}

export async function pressEscape() {
  await act(async () => {
    win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await new Promise((r) => setTimeout(r, 30))
  })
  lastText = text()
}

/* ── ডেটা রিসেট ও ডামি সিড ── */
export const TODAY = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})()

export const YESTERDAY = (() => {
  const d = new Date(Date.now() - 86400000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})()

export async function wipeAll() {
  await db.open()
  for (const t of db.tables) {
    try {
      await t.clear()
    } catch {
      /* ignore */
    }
  }
}

export const OWNER_ID = 'owner-1'
export const MANAGER_ID = 'manager-1'
export const SALESMAN_ID = 'salesman-1'
export const CUSTOMER_ID = 'customer-1'

export const ownerUser: SeedUser = { id: OWNER_ID, name: 'মালিক ১', phone: '01811808294', role: 'owner' }
export const managerUser: SeedUser = {
  id: MANAGER_ID,
  name: 'ব্যবস্থাপক রহিম',
  phone: '01800000000',
  role: 'manager',
  branch_id: 'branch-1',
  branch_ids: ['branch-1'],
}
export const salesmanUser: SeedUser = {
  id: SALESMAN_ID,
  name: 'সেলস ম্যান কামাল',
  phone: '01811111111',
  role: 'salesman',
  branch_id: 'branch-1',
  branch_ids: ['branch-1'],
}
export const customerUser: SeedUser = {
  id: CUSTOMER_ID,
  name: 'ক্রেতা করিম',
  phone: '01900000000',
  role: 'customer',
  branch_id: 'branch-1',
}

const dbUser = (u: SeedUser, extra: Record<string, unknown> = {}) => ({
  id: u.id,
  name: u.name,
  phone: u.phone,
  password_hash: '',
  role: u.role,
  branch_id: u.branch_id,
  branch_ids: u.branch_ids,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...extra,
})

/** প্রথম ধাপ: শাখা, ইউজার, পণ্য, ক্রেতা — বিশুদ্ধ ডামি ডেটা */
export async function seedBase() {
  await wipeAll()
  await db.branches.bulkPut([
    {
      id: 'branch-1',
      name: 'প্রধান শাখা',
      organization: 'কর্ণফুলী সেলস সেন্টার',
      address: 'বুড়া মসজিদ রোড, আমুচিয়া, বোয়ালখালী, চট্টগ্রাম',
      phone: '01821989717',
      logo: 'brand/karnaphuli-mark.png',
      is_active: true,
      created_at: '',
    },
    { id: 'branch-2', name: 'দ্বিতীয় শাখা', organization: 'কর্ণফুলী সেলস সেন্টার', is_active: true, created_at: '' },
  ])
  await db.users.bulkPut([
    dbUser(ownerUser, { password_hash: await hashPassword('123456'), must_change_password: true }),
    dbUser(managerUser, { password_hash: await hashPassword('123456'), username: 'manager1' }),
    dbUser(salesmanUser, { password_hash: await hashPassword('123456'), username: 'salesman1' }),
    dbUser(customerUser, { username: 'customer1' }),
  ])
  await db.products.bulkPut([
    {
      id: 'p-rice', code: 'RICE-001', category: 'চাল', name: 'মিনিকেট চাল', unit: 'কেজি',
      opening_stock: 100, purchase_price: 60, sale_price: 75, min_stock: 20, branch_id: 'branch-1',
      created_at: '', updated_at: '',
    },
    {
      id: 'p-feed', code: 'FEED-001', category: 'ফিড', company: 'তীর', name: 'গরুর ফিড', unit: 'বস্তা',
      units_per_bag: 50, opening_stock: 10, purchase_price: 1200, sale_price: 1400, min_stock: 5, branch_id: 'branch-1',
      created_at: '', updated_at: '',
    },
    {
      id: 'p-other', code: 'GEN-001', name: 'অন্য শাখার পণ্য', unit: 'পিস', opening_stock: 50,
      purchase_price: 10, sale_price: 15, branch_id: 'branch-2', created_at: '', updated_at: '',
    },
  ])
  await db.customers.bulkPut([
    { id: 'c-karim', name: 'ক্রেতা করিম', phone: '01711111111', address: 'চরপাড়া', branch_id: 'branch-1', created_at: '' },
    { id: 'c-other', name: 'অন্য শাখার ক্রেতা', phone: '01722222222', branch_id: 'branch-2', created_at: '' },
  ])
  useProductStore.setState({
    products: (await db.products.toArray()) as never,
    categories: useProductStore.getState().categories,
  })
  useSalesStore.setState({ sales: [] })
  usePurchaseStore.setState({ purchases: [] })
  useStockAdjustmentStore.setState({ adjustments: [] })
  useCustomerStore.setState({ customers: (await db.customers.toArray()) as never, isLoading: false })
  useUiStore.setState({ staffBranchId: '' })
}

/* ── সারাংশ ছাপা ── */
export function printSummary() {
  console.log('\n════════════════════════════════════════')
  console.log(`মোট চেক: ${pass + fail} • পাস: ${pass} • ব্যর্থ: ${fail}`)
  if (failures.length) {
    console.log('\nব্যর্থ চেকসমূহ:')
    for (const f of failures) console.log(`  ✗ [${f.section}] ${f.name}${f.note ? ` — ${f.note}` : ''}`)
  }
  console.log('════════════════════════════════════════')
}

export function failCount() {
  return fail
}
