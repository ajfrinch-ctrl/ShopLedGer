import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dailyDebtActivity, debtAccounts, type DebtData } from '../src/lib/dues'
import { ledgerRows, supplierId } from '../src/lib/ledger'
import { collectionRecords, computeCustomerDues } from '../src/lib/report'
import { buildCustomerStatement } from '../src/lib/customerAccount'
import type { LedgerEntry } from '../src/lib/db'

const entry = (changes: Partial<LedgerEntry>): LedgerEntry => ({ id: 'e1', party_id: 'c1', party_name: 'করিম', party_type: 'customer', kind: 'payment',
  amount: 40, date: '2026-09-18', branch_id: 'a', method: 'বিকাশ', reference: '', note: '', cancelled: false, created_by: 'owner', created_at: '', ...changes })
const data = (): DebtData => ({
  sales: [{ id: 's1', date: '2026-09-18', items: [], total_amount: 100, total_profit: 20, payment_type: 'বাকি', customer_id: 'c1', customer_name: 'করিম', branch_id: 'a', created_by: 'owner', created_at: '' }],
  purchases: [{ id: 'p1', date: '2026-09-18', product_id: 'p1', product_name: 'চাল', unit: 'কেজি', quantity: 5, total: 500, purchase_price: 100, supplier: 'ABC', payment_type: 'বাকি', branch_id: 'a', created_at: '' }],
  entries: [], collections: [], customers: [{ id: 'c1', name: 'করিম', branch_id: 'a', phone: '01700000000', created_at: '' }],
})

test('credit purchases create supplier debt, never customer collection or receivable', () => {
  const d = data()
  d.sales = []
  assert.deepEqual(dailyDebtActivity(d, '2026-09-18'), { creditSales: 0, creditPurchases: 500, collected: 0, paid: 0 })
  assert.equal(debtAccounts('supplier', d)[0].balance, 500)
  assert.equal(debtAccounts('customer', d)[0].balance, 0)
  assert.deepEqual(collectionRecords(d.entries, d.collections), [])
})

test('credit sale is receivable, only real customer receipts count as collection', () => {
  const d = data()
  assert.deepEqual(dailyDebtActivity(d, '2026-09-18'), { creditSales: 100, creditPurchases: 500, collected: 0, paid: 0 })
  d.entries = [entry({}), entry({ id: 'supplier-payment', party_type: 'supplier', party_id: supplierId('ABC'), party_name: 'ABC', amount: 200 }),
    entry({ id: 'opening', kind: 'opening', amount: 20 }), entry({ id: 'cancelled', cancelled: true, amount: 900 })]
  d.collections = [{ id: 'old', date: '2026-09-18', amount: 10, customer_id: 'c1', customer_name: 'করিম', branch_id: 'a', created_at: '' }]
  assert.deepEqual(dailyDebtActivity(d, '2026-09-18'), { creditSales: 100, creditPurchases: 500, collected: 50, paid: 200 })
  assert.equal(debtAccounts('customer', d)[0].balance, 70)
  assert.equal(debtAccounts('supplier', d)[0].balance, 300)
  assert.equal(collectionRecords(d.entries, d.collections).reduce((sum, x) => sum + x.amount, 0), 50)
})

test('customer due summary never includes supplier opening/payments, even if IDs collide', () => {
  const d = data()
  d.entries = [entry({ party_type: 'supplier', kind: 'opening', amount: 9999 }), entry({ id: 's-pay', party_type: 'supplier', amount: 1 })]
  const due = computeCustomerDues(d.customers, d.sales, d.entries, [])
  assert.deepEqual(due.map(c => [c.customerId, c.due]), [['c1', 100]])
})

test('cash and unspecified old purchases create no automatic debt', () => {
  const d = data()
  d.purchases = [{ ...d.purchases[0], payment_type: 'নগদ' }, { ...d.purchases[0], id: 'old', payment_type: undefined }]
  assert.equal(debtAccounts('supplier', d)[0].balance, 0)
  assert.equal(dailyDebtActivity(d, '2026-09-18').creditPurchases, 0)
  d.entries = [entry({ party_type: 'supplier', party_id: supplierId('ABC'), party_name: 'ABC', kind: 'opening', amount: 300 })]
  assert.equal(debtAccounts('supplier', d)[0].balance, 300)
})

test('account list, ledger and report reconcile for each type and branch', () => {
  const d = data()
  d.entries = [entry({}), entry({ id: 'other', branch_id: 'b', kind: 'opening', amount: 999 }),
    entry({ id: 'supplier', party_type: 'supplier', party_id: supplierId('ABC'), party_name: 'ABC', amount: 30 })]
  for (const type of ['customer', 'supplier'] as const) {
    for (const scope of [{}, { branchIds: ['a'] }, { branchIds: [] }]) {
      for (const account of debtAccounts(type, d, scope)) {
        const rows = ledgerRows(account.id, d.sales, d.purchases, d.entries, d.collections, { ...scope, partyType: type })
        assert.equal(account.balance, rows.at(-1)?.balance || 0)
      }
    }
  }
  const doc = buildCustomerStatement(d.customers[0], d.sales, d.entries, d.collections, { branchId: 'a' })
  assert.equal(doc.totals?.[4], '৳ ৬০')
  assert.ok(!JSON.stringify(doc).includes('৯৯৯'))
})

test('future, cancelled and unassigned-branch data stays outside current balances', () => {
  const d = data()
  d.entries = [entry({ id: 'future', kind: 'opening', amount: 999, date: '2999-01-01' }), entry({ cancelled: true })]
  assert.equal(debtAccounts('customer', d, { through: '2026-09-18' })[0].balance, 100)
  assert.deepEqual(debtAccounts('supplier', d, { branchIds: [] }), [])
  assert.deepEqual(dailyDebtActivity(d, '2026-09-18', { branchIds: [] }), { creditSales: 0, creditPurchases: 0, collected: 0, paid: 0 })
})

test('legacy-only customers and credit balances remain discoverable without netting parties', () => {
  const d = data()
  d.collections = [{ id: 'legacy', customer_id: 'old', customer_name: 'পুরোনো ক্রেতা', amount: 50, date: '2026-09-18', branch_id: 'a', created_at: '' }]
  const accounts = debtAccounts('customer', d)
  assert.equal(accounts.find(a => a.id === 'old')?.balance, -50)
  assert.equal(accounts.reduce((s, a) => s + Math.max(0, a.balance), 0), 100)
})

test('fractional amounts and normalized supplier names agree with the ledger', () => {
  const d = data()
  d.purchases = [{ ...d.purchases[0], supplier: ' ABC  Store ', total: .3 }, { ...d.purchases[0], id: 'p2', supplier: 'abc store', total: .1 }]
  d.entries = [entry({ party_type: 'supplier', party_id: supplierId('ABC Store'), party_name: 'ABC Store', amount: .4 })]
  assert.equal(debtAccounts('supplier', d).length, 1)
  assert.equal(debtAccounts('supplier', d)[0].balance, 0)
})

test('report and ledger use the same same-day order and per-transaction paisa rounding', async () => {
  const { buildReport } = await import('../src/lib/reports/builders')
  const d = data()
  d.entries = [entry({})]
  const reportData = { ...d, products: [], adjustments: [], expenses: [], branches: [], users: [] }
  const input = { from: '2026-09-01', to: '2026-09-30', month: '2026-09', customerId: 'c1', scope: {} }
  const statement = buildReport('customerDue', input, reportData)
  assert.deepEqual(statement.rows.map(r => r.cells[4]), ['৳ ০', '৳ ১০০', '৳ ৬০'])
  reportData.entries = []
  reportData.sales = [{ ...d.sales[0], total_amount: .005 }, { ...d.sales[0], id: 's2', total_amount: .005 }]
  const account = debtAccounts('customer', reportData)[0]
  const summary = buildReport('customerDue', { ...input, customerId: '' }, reportData)
  assert.equal(account.balance, .02)
  assert.equal(summary.totals?.[6], '৳ ০.০২')
  assert.equal(buildReport('customerDue', input, reportData).totals?.[4], summary.totals?.[6])
})
