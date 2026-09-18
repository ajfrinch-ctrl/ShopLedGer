import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useAuthStore } from '../../stores/authStore'
import { useSalesStore } from '../../stores/salesStore'
import { usePurchaseStore } from '../../stores/purchaseStore'
import { useProductStore } from '../../stores/productStore'
import { useStockAdjustmentStore } from '../../stores/stockAdjustmentStore'
import { toDateKey } from '../profitLoss'
import { staffBranchIds } from '../roles'
import { nowMonth, reportOptions, type ReportData, type ReportScope, type ReportOptions } from './core'

/**
 * অ্যাপের সব স্টোর + IndexedDB টেবিল একসাথে এনে রিপোর্টের ডেটা তৈরি করে।
 * স্কোপ (শাখা) এখানেই বসানো হয়, তাই প্রতিটি রিপোর্ট ফাংশন আলাদা করে
 * শাখা ফিল্টার করতে ভুলে যেতে পারে না।
 */
export function useReportData(branchOverride?: string) {
  const user = useAuthStore((s) => s.user)
  const sales = useSalesStore((s) => s.sales)
  const purchases = usePurchaseStore((s) => s.purchases)
  const products = useProductStore((s) => s.products)
  const adjustments = useStockAdjustmentStore((s) => s.adjustments)

  const live = useLiveQuery(
    async () => ({
      entries: await db.ledgerEntries.toArray(),
      collections: await db.collections.toArray(),
      customers: await db.customers.toArray(),
      expenses: await db.expenses.toArray(),
      branches: await db.branches.toArray(),
      users: await db.users.toArray(),
    }),
    [],
  )

  const isOwner = user?.role === 'owner'
  const scope: ReportScope = useMemo(
    () =>
      isOwner
        ? { branchId: branchOverride || undefined }
        : { branchIds: staffBranchIds(user).length ? staffBranchIds(user) : ['__no_branch__'] },
    [isOwner, branchOverride, user],
  )

  const data: ReportData | null = useMemo(() => {
    if (!live) return null
    return { sales, purchases, products, adjustments, ...live }
  }, [live, sales, purchases, products, adjustments])

  const today = toDateKey(new Date())

  return {
    user,
    isOwner,
    scope,
    data,
    today,
    month: nowMonth(),
    options: useMemo<ReportOptions | null>(() => (data ? reportOptions(data, scope) : null), [data, scope]),
  }
}
