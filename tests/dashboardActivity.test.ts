import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recentDashboardActivity, type ActivityData } from '../src/components/dashboard/activity'
import type { AuthUser } from '../src/stores/authStore'

const owner: AuthUser = { id: 'o', name: 'Owner', phone: '', role: 'owner' }
const today = '2026-09-19'
const data = (): ActivityData => ({
  sales: [{ id: 'same', date: today, items: [], customer_id: 'c', customer_name: 'Customer', total_amount: 200, total_profit: 40, payment_type: 'বাকি', branch_id: 'a', created_by: 'o', created_at: `${today}T09:00:00` }],
  purchases: [{ id: 'same', date: today, product_id: 'p', product_name: 'Rice', supplier: 'Supplier', quantity: 1, unit: 'kg', total: 80, purchase_price: 80, branch_id: 'a', created_at: `${today}T10:00:00` }],
  expenses: [{ id: 'same', date: today, kind: 'shop', category: 'Transport', amount: 10, branch_id: 'a', created_at: `${today}T11:00:00` }],
  entries: [{ id: 'same', date: today, party_id: 'c', party_name: 'Customer', party_type: 'customer', kind: 'payment', amount: 20, branch_id: 'a', method: 'cash', reference: '', note: '', cancelled: false, created_by: 'o', created_at: `${today}T12:00:00` }],
  collections: [{ id: 'same', date: today, customer_id: 'c', customer_name: 'Customer', amount: 5, branch_id: 'a', created_at: `${today}T13:00:00` }],
})

test('dashboard activity uses stored amounts and unique source keys, newest first', () => {
  const d = data()
  const before = JSON.stringify(d)
  const rows = recentDashboardActivity(d, owner, today)
  assert.deepEqual(rows.map(r => r.key), ['legacy:same', 'ledger:same', 'expense:same', 'purchase:same', 'sale:same'])
  assert.deepEqual(rows.map(r => r.amount), [5, 20, 10, 80, 200])
  assert.equal(JSON.stringify(d), before, 'read-only: no source sorting/mutation')
  assert.equal(rows.at(-1)?.party, 'Customer')
})

test('dashboard activity filters branch, future and cancelled rows BEFORE limiting to five', () => {
  const d = data()
  for (let n = 0; n < 8; n++) d.entries.push({ ...d.entries[0], id: `private-${n}`, branch_id: 'b', party_name: 'Private', created_at: `${today}T23:00:00` })
  d.entries.push({ ...d.entries[0], id: 'cancel', cancelled: true }, { ...d.entries[0], id: 'future', date: '2026-09-20' })
  const manager: AuthUser = { ...owner, role: 'manager', branch_ids: ['a'] }
  const rows = recentDashboardActivity(d, manager, today)
  assert.equal(rows.length, 5)
  assert.ok(rows.every(r => !r.key.includes('private') && !r.key.includes('cancel') && !r.key.includes('future')))
  assert.equal(recentDashboardActivity(d, { ...manager, branch_ids: [], branch_id: '' }, today).length, 0)
})

test('salesman activity does not leak purchases, expenses or supplier records', () => {
  const d = data()
  d.entries.push({ ...d.entries[0], id: 'supplier', party_type: 'supplier', party_name: 'Secret supplier' })
  const rows = recentDashboardActivity(d, { ...owner, role: 'salesman', branch_id: 'a' }, today)
  assert.deepEqual(rows.map(r => r.type), ['বাকি আদায়', 'বাকি আদায়', 'বিক্রি'])
  assert.ok(rows.every(r => !r.to.includes('transaction') && !r.to.includes('supplier')))
  assert.equal(recentDashboardActivity(d, { ...owner, role: 'customer' }, today).length, 0)
  assert.equal(recentDashboardActivity(d, null, today).length, 0)
})

test('owner drawings and supplier payments retain distinct labels, not sales/expense totals', () => {
  const d = data()
  d.expenses[0].kind = 'owner'
  d.entries[0] = { ...d.entries[0], party_type: 'supplier', party_id: 'supplier:ABC & Co', party_name: 'ABC & Co' }
  const rows = recentDashboardActivity(d, owner, today)
  assert.equal(rows.find(r => r.key === 'expense:same')?.type, 'মালিকের টাকা তোলা')
  assert.equal(rows.find(r => r.key === 'ledger:same')?.type, 'দেনা পরিশোধ')
  assert.match(rows.find(r => r.key === 'ledger:same')!.to, /party=supplier%3AABC%20%26%20Co/)
})

test('authorized multi-branch scope and deterministic latest five; backdated entry stays on its ledger day', () => {
  const d = data()
  d.sales.push({ ...d.sales[0], id: 'b-sale', branch_id: 'b', created_at: `${today}T23:00:00` })
  d.entries.push({ ...d.entries[0], id: 'backdated', date: '2026-09-01', created_at: `${today}T23:59:59` })
  const rows = recentDashboardActivity(d, { ...owner, role: 'manager', branch_ids: ['a', 'b'] }, today)
  assert.equal(rows.length, 5)
  assert.equal(rows[0].key, 'sale:b-sale')
  assert.ok(!rows.some(r => r.key === 'ledger:backdated'))
  assert.deepEqual(recentDashboardActivity({ ...d, sales: [...d.sales].reverse(), entries: [...d.entries].reverse() }, owner, today), rows)
})

test('cash sale uses product fallback and stored discounted total, opening balances are not collections', () => {
  const d = data()
  d.sales[0] = { ...d.sales[0], customer_name: '', payment_type: 'নগদ', subtotal: 250, discount: 50,
    items: [{ product_id: 'p', product_name: 'Rice', quantity: 1, unit: 'kg', sale_price: 250, purchase_price: 160, total: 250, profit: 90 }] }
  d.entries[0].kind = 'opening'
  const rows = recentDashboardActivity(d, owner, today)
  assert.equal(rows.find(r => r.key === 'sale:same')?.amount, 200)
  assert.equal(rows.find(r => r.key === 'sale:same')?.party, 'Rice')
  assert.equal(rows.find(r => r.key === 'ledger:same')?.type, 'পুরোনো পাওনা')
})
