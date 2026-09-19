/* চূড়ান্ত পূর্ণ অডিট — ডামি ডেটা দিয়ে প্রতিটি পেজ ও প্রতিটি ফাংশন যাচাই।
   চালান: npm run test:audit */
import { printSummary, failCount, seedBase } from './final-audit/harness'
import { runAuthAudit } from './final-audit/a-auth'
import { runStockPurchaseAudit } from './final-audit/b-stock-purchase'
import { runSalesAudit } from './final-audit/c-sales'
import { runCollectionsAudit } from './final-audit/d-collections'
import { runCustomerAudit } from './final-audit/e-customers'
import { runOrderExpenseAudit } from './final-audit/f-orders-expenses'
import { runReportAudit } from './final-audit/g-reports'
import { runProfitDashboardAudit } from './final-audit/h-profit-dashboard'
import { runSalesmenMyDuesAudit } from './final-audit/i-salesmen-mydue'
import { runBackupSyncAudit } from './final-audit/j-backup-sync'
import { runBranchPadsAudit } from './final-audit/k-branch-pads'

await seedBase()
await runAuthAudit()
await runStockPurchaseAudit()
await runSalesAudit()
await runCollectionsAudit()
await runCustomerAudit()
await runOrderExpenseAudit()
await runReportAudit()
await runProfitDashboardAudit()
await runSalesmenMyDuesAudit()
await runBackupSyncAudit()
await runBranchPadsAudit()

printSummary()
if (failCount() > 0) process.exitCode = 1
