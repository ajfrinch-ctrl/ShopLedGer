import { FileDown, Loader2, Share2 } from 'lucide-react'
import type { ReportDocument, Tone } from '../../lib/reports/core'
import type { ReportPad } from './ReportSheet'

export type PreviewAction = 'pdf' | 'whatsapp'

const TONES: Record<Tone, string> = {
  blue: 'bg-blue-50 border-blue-100 text-blue-700',
  green: 'bg-green-50 border-green-100 text-green-700',
  teal: 'bg-teal-50 border-teal-100 text-teal-700',
  orange: 'bg-orange-50 border-orange-100 text-orange-700',
  red: 'bg-red-50 border-red-100 text-red-700',
  gray: 'bg-gray-50 border-gray-200 text-gray-700',
  purple: 'bg-purple-50 border-purple-100 text-purple-700',
}

const PREVIEW_ROWS = 8

/**
 * প্রিভিউ = ঠিক যা PDF-এ যাবে তার সারসংক্ষেপ + প্রথম কয়েক সারি।
 * সম্পূর্ণ টেবিল PDF-এ যায় (অ্যাপের স্ক্রিনে ৫০০ সারি দেখানো অর্থহীন)।
 * মোবাইল থেকে ব্যবহার — প্রিন্ট নেই, শুধু PDF ডাউনলোড ও WhatsApp শেয়ার।
 */
export default function ReportPreview({
  doc,
  businessName,
  subtitle,
  pad,
  busy,
  onPdf,
  onWhatsApp,
}: {
  doc: ReportDocument
  businessName: string
  subtitle?: string
  pad?: ReportPad
  busy: PreviewAction | null
  onPdf: () => void
  onWhatsApp: () => void
}) {
  const rows = doc.rows.slice(0, PREVIEW_ROWS)
  const hidden = doc.rows.length - rows.length
  const isKeyValue = doc.columns.length === 2

  return (
    <div className="space-y-3" data-report-preview>
      <div className="card bg-white space-y-3">
        <div className="border-b pb-2">
          <h2 className="font-bold text-gray-800">{doc.title}</h2>
          <p className="text-xs text-gray-500">
            {businessName}
            {subtitle ? ` • ${subtitle}` : ''} • সময়: {doc.period}
          </p>
          {(pad?.address || pad?.phone) && (
            <p className="text-[11px] text-gray-400 mt-0.5">
              {pad?.address ? `${pad.address}${pad?.phone ? ' • ' : ''}` : ''}
              {pad?.phone ? `ফোন: ${pad.phone}` : ''}
            </p>
          )}
          {doc.filterNote && <p className="text-[11px] text-gray-400 mt-0.5">ফিল্টার: {doc.filterNote}</p>}
        </div>

        {/* সারসংক্ষেপ */}
        <div className="grid grid-cols-2 gap-2">
          {doc.summary.map((s) => (
            <div key={s.label} className={`rounded-xl border p-2.5 ${TONES[s.tone || 'gray']}`}>
              <p className="text-[11px] text-gray-500">{s.label}</p>
              <p className="text-sm font-bold break-words">{s.value}</p>
            </div>
          ))}
        </div>

        {/* সারি প্রিভিউ */}
        {doc.rows.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">নির্বাচিত ফিল্টারে কোনো তথ্য পাওয়া যায়নি।</p>
        ) : isKeyValue ? (
          <div>
            {doc.rows.map((r, i) => (
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
                {doc.totals && (
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

        <p className="text-[11px] text-gray-400">
          {doc.rows.length === 0
            ? ''
            : hidden > 0
              ? `প্রিভিউতে প্রথম ${rows.length.toLocaleString('bn-BD')}টি সারি (মোট ${doc.rows.length.toLocaleString('bn-BD')}টি) — সম্পূর্ণ তালিকা PDF-এ থাকবে।`
              : `সব ${doc.rows.length.toLocaleString('bn-BD')}টি সারি PDF-এ থাকবে।`}
        </p>

        {doc.notes?.map((n) => (
          <p key={n} className="text-[11px] text-gray-500">
            • {n}
          </p>
        ))}
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!!busy}
            onClick={onPdf}
            className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy === 'pdf' ? <Loader2 className="animate-spin" size={16} /> : <FileDown size={16} />}
            PDF ডাউনলোড
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={onWhatsApp}
            className="btn-primary bg-green-600 hover:bg-green-700 border-green-600 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy === 'whatsapp' ? <Loader2 className="animate-spin" size={16} /> : <Share2 size={16} />}
            WhatsApp
          </button>
        </div>
        <p className="text-[11px] text-gray-500 text-center">
          কালি বাঁচাতে PDF সম্পূর্ণ সাদাকালো — প্যাডে দোকানের লোগো, নাম, ঠিকানা ও ফোন; শেষে মালিকের স্বাক্ষরের জায়গা;
          ফুটারে তৈরির তারিখ ও পেজ নম্বর।
        </p>
      </div>
    </div>
  )
}
