import { useState } from 'react'
import type { ReportDocument } from '../../lib/reports/core'
import type { OrgPad } from '../../lib/orgPad'
import PadHeader from '../org/PadHeader'

/** প্রিভিউতে একবারে কত সারি আঁকা হয় — খুব বড় রিপোর্টে ব্রাউজার যাতে আটকে না যায় */
export const PREVIEW_ROW_LIMIT = 100

/**
 * প্রিভিউ = পপ-আপে দেখানো সম্পূর্ণ রিপোর্ট (প্যাড সহ)।
 * PM-এর নিয়ম: **আগে পুরো রিপোর্ট দেখুন, তারপর দরকার হলে ডাউনলোড/শেয়ার** —
 * তাই এখানে কোনো অ্যাকশন বোতাম নেই, সেগুলো পপ-আপের নিচের বারে।
 */
export default function ReportPreview({
  doc,
  businessName,
  subtitle,
  pad,
  limit = PREVIEW_ROW_LIMIT,
}: {
  doc: ReportDocument
  businessName: string
  subtitle?: string
  pad?: Partial<OrgPad>
  limit?: number
}) {
  const [page, setPage] = useState(0)
  const pageSize = Math.max(1, Math.floor(limit))
  const pages = Math.max(1, Math.ceil(doc.rows.length / pageSize))
  const currentPage = Math.min(page, pages - 1)
  const rows = doc.rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
  const isKeyValue = doc.columns.length === 2
  const orgPad: OrgPad = {
    name: pad?.name?.trim() || businessName,
    logo: pad?.logo,
    address: pad?.address,
    phone: pad?.phone,
    branchName: pad?.branchName,
  }

  return (
    <div className="card bg-white space-y-3" data-report-preview>
      {/* প্রতিষ্ঠানের প্যাড — লোগো, নাম, ঠিকানা মাঝখানে */}
      <PadHeader pad={orgPad} size="screen" subtitle={subtitle} />

      <div>
        <h2 className="font-bold text-gray-800 text-center">{doc.title}</h2>
        <p className="text-xs text-gray-500 text-center">
          সময়: {doc.period}
          {doc.filterNote ? ` • ফিল্টার: ${doc.filterNote}` : ''}
        </p>
      </div>

      {doc.summary?.length ? (
        <dl className="grid grid-cols-1 min-[380px]:grid-cols-3 gap-2" aria-label="Statement summary">
          {doc.summary.map((item) => (
            <div key={item.label} className="rounded-lg border border-gray-100 bg-gray-50 p-2 min-w-0">
              <dt className="text-[10px] text-gray-500">{item.label}</dt>
              <dd className="mt-0.5 text-xs font-bold text-gray-800 break-words">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {/* সারি প্রিভিউ */}
      {doc.rows.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">নির্বাচিত ফিল্টারে কোনো তথ্য পাওয়া যায়নি।</p>
      ) : isKeyValue ? (
        <div>
          {rows.map((r, i) => (
            <div
              key={i}
              className={`flex items-center justify-between border-b border-gray-100 py-1.5 text-xs ${
                r.emphasis ? 'font-bold text-gray-900' : 'text-gray-600'
              }`}
            >
              <span>{r.cells[0]}</span>
              <span>{r.cells[1]}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr>
                {doc.columns.map((c, i) => (
                  <th
                    key={c.label}
                    className={`border-b border-gray-200 py-1.5 px-1 font-semibold text-gray-500 ${
                      (c.align || (i === 0 ? 'left' : 'right')) === 'left' ? 'text-left' : 'text-right whitespace-nowrap'
                    }`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {doc.columns.map((c, ci) => (
                    <td
                      key={ci}
                      className={`border-b border-gray-100 py-1.5 px-1 ${
                        (c.align || (ci === 0 ? 'left' : 'right')) === 'left'
                          ? 'text-left text-gray-700'
                          : 'text-right whitespace-nowrap text-gray-600'
                      }`}
                    >
                      {r.cells[ci]}
                    </td>
                  ))}
                </tr>
              ))}
              {doc.totals && currentPage === pages - 1 && (
                <tr className="font-bold bg-gray-100">
                  {doc.totals.map((t, ti) => (
                    <td
                      key={ti}
                      className={`py-1.5 px-1 border-b border-gray-200 ${
                        (doc.columns[ti]?.align || (ti === 0 ? 'left' : 'right')) === 'left' ? 'text-left' : 'text-right'
                      }`}
                    >
                      {t}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && <nav aria-label="স্টেটমেন্টের পৃষ্ঠা" className="flex items-center justify-between gap-2 text-xs">
        <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="border rounded-lg p-2 disabled:opacity-40">আগের পৃষ্ঠা</button>
        <span role="status">পৃষ্ঠা {(currentPage + 1).toLocaleString('bn-BD')} / {pages.toLocaleString('bn-BD')}</span>
        <button type="button" disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)} className="border rounded-lg p-2 disabled:opacity-40">পরের পৃষ্ঠা</button>
      </nav>}
      {doc.rows.length > 0 && <p className="text-[11px] text-gray-500">মোট {doc.rows.length.toLocaleString('bn-BD')}টি সারি। ডাউনলোড / শেয়ারে সব সারি থাকবে।</p>}

      {doc.notes?.map((n) => (
        <p key={n} className="text-[11px] text-gray-500">
          • {n}
        </p>
      ))}
    </div>
  )
}
