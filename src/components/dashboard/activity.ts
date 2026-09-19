import type { AuthUser } from '../../stores/authStore'
import type { Sale, Purchase, Expense } from '../../types'
import type { DbCollection, LedgerEntry } from '../../lib/db'
import { canEntryPurchaseExpense, inUserBranch, isShopRole } from '../../lib/roles'

export interface ActivityData {
  sales: Sale[]
  purchases: Purchase[]
  expenses: Expense[]
  entries: LedgerEntry[]
  collections: DbCollection[]
}

export interface DashboardActivity {
  key: string
  date: string
  createdAt: string
  type: string
  party: string
  amount: number
  to: string
}

/** Presentation only: stored amounts, no balance/profit calculations or invoice regrouping.
 * Apply existing role/branch permissions BEFORE selecting the latest five records.
 */
export function recentDashboardActivity(data: ActivityData, user: AuthUser | null, through: string): DashboardActivity[] {
  if (!user || !isShopRole(user.role)) return []
  const manage = canEntryPurchaseExpense(user.role)
  const visible = (r: { branch_id: string; date: string }) => inUserBranch(user, r.branch_id) && r.date.slice(0, 10) <= through
  const partyLink = (type: string, id: string) => `/collections?type=${type}&party=${encodeURIComponent(id)}`
  const rows: DashboardActivity[] = [
    ...data.sales.filter(visible).map(s => ({
      key: `sale:${s.id}`, date: s.date, createdAt: s.created_at, type: 'বিক্রি',
      party: s.customer_name || s.items[0]?.product_name || 'নগদ বিক্রি', amount: s.total_amount, to: '/reports/sales',
    })),
    ...data.entries.filter(e => visible(e) && !e.cancelled && (e.party_type === 'customer' || manage)).map(e => ({
      key: `ledger:${e.id}`, date: e.date, createdAt: e.created_at,
      type: e.party_type === 'customer' ? (e.kind === 'payment' ? 'বাকি আদায়' : 'পুরোনো পাওনা') : (e.kind === 'payment' ? 'দেনা পরিশোধ' : 'পুরোনো দেনা'),
      party: e.party_name, amount: e.amount, to: partyLink(e.party_type, e.party_id),
    })),
    ...data.collections.filter(visible).map(c => ({
      key: `legacy:${c.id}`, date: c.date, createdAt: c.created_at, type: 'বাকি আদায়',
      party: c.customer_name, amount: c.amount, to: partyLink('customer', c.customer_id),
    })),
    ...(manage ? data.purchases.filter(visible).map(p => ({
      key: `purchase:${p.id}`, date: p.date, createdAt: p.created_at, type: 'ক্রয়',
      party: p.supplier || p.product_name, amount: p.total, to: '/reports/purchase',
    })) : []),
    ...(manage ? data.expenses.filter(visible).map(e => ({
      key: `expense:${e.id}`, date: e.date, createdAt: e.created_at,
      type: e.kind === 'owner' ? 'মালিকের টাকা তোলা' : 'খরচ',
      party: e.category, amount: e.amount, to: '/reports/expense',
    })) : []),
  ]
  return rows.sort((a, b) => b.date.slice(0, 10).localeCompare(a.date.slice(0, 10)) ||
    (b.createdAt || b.date).localeCompare(a.createdAt || a.date) || b.key.localeCompare(a.key)).slice(0, 5)
}
