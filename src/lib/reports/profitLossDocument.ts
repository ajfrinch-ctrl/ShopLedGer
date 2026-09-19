/**
 * লাভ-ক্ষতি বিবরণী → ReportDocument (native PDF-এর জন্য)।
 *
 * হিসাব এখানে নতুন করে করা হয় না — `computeProfitLoss` যা দেয় (`ProfitLossSummary`)
 * ঠিক সেটাই সাজানো হয়, তাই প্রিভিউ ও PDF-এর সংখ্যা কখনো আলাদা হয় না।
 */
import type { ProfitLossSummary } from '../profitLoss'
import { bnNum, type ReportDocument, type ReportKind } from './core'

const taka = (n: number) => `৳ ${bnNum(n, 2)}`

export interface ProfitLossDocumentMeta {
  /** শিরোনাম (আগের মতোই) */
  title: string
  /** সময়কাল — যেমন "০১/০৯/২০২৬ থেকে ৩০/০৯/২০২৬" */
  period: string
  /** শাখার নাম / সব শাখা */
  branchName: string
  /** রিপোর্টের ধরন (রোল অনুযায়ী শিরোনাম ঠিক রাখতে) */
  kind: ReportKind
  /** কে তৈরি করছেন */
  createdBy?: string
}

export interface ProfitLossPdf {
  document: ReportDocument
  details: { label: string; value: string; strong?: boolean }[]
}

/** প্রিভিউতে যা দেখা যায় হুবহু সেই লাইনগুলোই — শুধু PDF-এর কাঠামোয় */
export function profitLossDocument(pl: ProfitLossSummary, meta: ProfitLossDocumentMeta): ProfitLossPdf {
  const isLoss = pl.netProfit < 0
  const document: ReportDocument = {
    kind: meta.kind,
    title: meta.title,
    period: meta.period,
    summary: [
      { label: 'মোট বিক্রি', value: taka(pl.revenue) },
      { label: 'মোট খরচ', value: taka(pl.expenseTotal) },
      { label: isLoss ? 'নিট ক্ষতি' : 'নিট লাভ', value: taka(Math.abs(pl.netProfit)) },
    ],
    columns: [
      { label: 'বিবরণ', width: '68%' },
      { label: 'টাকা', align: 'right' },
    ],
    rows: [
      { cells: ['মোট বিক্রি', taka(pl.revenue)] },
      { cells: ['  নগদ বিক্রি', taka(pl.cashSales)] },
      { cells: ['  বাকিতে বিক্রি', taka(pl.dueSales)] },
      { cells: ['(−) বিক্রিত পণ্যের ক্রয়মূল্য', taka(pl.cogs)] },
      { cells: ['গ্রস লাভ', taka(pl.grossProfit)], emphasis: true },
      { cells: ['(−) মোট খরচ', taka(pl.expenseTotal)] },
      ...pl.expensesByCategory.map((item) => ({ cells: [`  ${item.category}`, taka(item.amount)] })),
    ],
    totals: [isLoss ? 'নিট ক্ষতি' : 'নিট লাভ', taka(Math.abs(pl.netProfit))],
    notes: [
      'নিট লাভ = মোট বিক্রি − বিক্রিত পণ্যের ক্রয়মূল্য − দোকানের খরচ।',
      'পণ্য ক্রয়, বাকি আদায় ও মালিকের টাকা তোলা সরাসরি লাভের হিসাবে ধরা হয় না।',
    ],
  }

  const details: { label: string; value: string; strong?: boolean }[] = [
    { label: 'শাখা', value: meta.branchName },
    { label: 'সময়কাল', value: meta.period },
    { label: 'বিল সংখ্যা', value: `${bnNum(pl.saleCount)}টি` },
    { label: 'এই সময়ে পণ্য ক্রয়', value: taka(pl.purchaseTotal) },
  ]
  if (pl.ownerDrawings > 0) details.push({ label: 'মালিকের টাকা তোলা', value: taka(pl.ownerDrawings) })
  if (meta.createdBy) details.push({ label: 'তৈরি করেছেন', value: meta.createdBy })
  details.push({ label: isLoss ? 'নিট ক্ষতি' : 'নিট লাভ', value: taka(Math.abs(pl.netProfit)), strong: true })

  return { document, details }
}
