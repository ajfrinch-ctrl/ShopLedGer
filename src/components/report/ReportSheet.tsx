import type { RefObject } from 'react'
import type { ReportDocument } from '../../lib/reports/core'
import PadHeader from '../org/PadHeader'

/** A4 (৯৬ dpi) — ২১০ মিমি প্রস্থ, ১০ মিমি মার্জিন দুই পাশে → কনটেন্ট ১৯০ মিমি ≈ ৭১৮ পিক্সেল */
export const SHEET_WIDTH_PX = 718

/** প্যাডের হেডারে দেখানো দোকানের নিজস্ব তথ্য (মালিক "শাখা ও ব্যবস্থাপক" থেকে সেট করেন) */
export interface ReportPad {
  /** প্রতিষ্ঠানের নাম — না দিলে businessName ব্যবহৃত হয় */
  name?: string
  logo?: string
  address?: string
  phone?: string
  /** শাখার নাম */
  branchName?: string
}

/* কালি বাঁচাতে সম্পূর্ণ সাদাকালো — শুধু কালো লেখা ও হালকা ধূসর ছায়া */
const ink = '#111827'
const grayText = '#4b5563'
const grayMuted = '#6b7280'
const borderStrong = '#111827'
const borderCell = '#9ca3af'
const borderLight = '#d1d5db'
const headBg = '#f3f4f6'
const zebraBg = '#f7f7f8'
const emphasisBg = '#f3f4f6'
const totalBg = '#e5e7eb'

/**
 * PDF-এর মূল A4 শিট — ঠিক যা ক্যাপচার হয়ে PDF-এ যাবে।
 * সাদাকালো (ইঙ্ক-সাশ্রয়ী) প্যাড: উপরে দোকানের লোগো-নাম-ঠিকানা-ফোন,
 * নিচে সম্পূর্ণ টেবিল ও মালিকের স্বাক্ষরের জায়গা।
 */
type SheetProps = {
  doc: ReportDocument
  businessName: string
  subtitle?: string
  pad?: ReportPad
  sheetRef: RefObject<HTMLDivElement>
}

/** Bounded capture blocks keep long statements readable without giant mobile canvases. */
export default function ReportSheet(props: SheetProps) {
  const { doc, sheetRef } = props
  const blockSize = 24
  const count = Math.max(1, Math.ceil(doc.rows.length / blockSize))
  return <div ref={sheetRef} style={{ width: `${SHEET_WIDTH_PX}px` }}>
    {Array.from({ length: count }, (_, index) => {
      const last = index === count - 1
      const block = { ...doc, rows: doc.rows.slice(index * blockSize, (index + 1) * blockSize),
        totals: last ? doc.totals : undefined, notes: last ? doc.notes : undefined }
      return <SheetBlock key={index} {...props} doc={block} last={last} />
    })}
  </div>
}

function SheetBlock({ doc, businessName, subtitle, pad, last }: Omit<SheetProps, 'sheetRef'> & { last: boolean }) {
  /** প্যাড: প্রতিষ্ঠানের নাম-ঠিকানা-লোগো পেজের মাঝখানে */
  const orgPad = {
    name: pad?.name?.trim() || businessName,
    logo: pad?.logo,
    address: pad?.address,
    phone: pad?.phone,
    branchName: pad?.branchName?.trim() || undefined,
  }

  return (
    <div
      data-report-page
      style={{
        width: `${SHEET_WIDTH_PX}px`,
        background: '#ffffff',
        color: ink,
        padding: '0',
        fontFamily: "'Noto Sans Bengali', system-ui, sans-serif",
      }}
    >
      {/* প্যাড হেডার: লোগো, প্রতিষ্ঠানের নাম, ঠিকানা ও ফোন — পেজের মাঝখানে */}
      <PadHeader pad={orgPad} size="sheet" subtitle={subtitle} />

      {/* রিপোর্টের নাম ও নির্বাচিত সময় */}
      <div style={{ paddingBottom: '6px', marginBottom: '10px', marginTop: '10px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: ink }}>{doc.title}</div>
        <div style={{ fontSize: '11px', color: grayMuted, marginTop: '3px' }}>সময়: {doc.period}</div>
        {doc.filterNote && (
          <div style={{ fontSize: '10px', color: grayMuted, marginTop: '2px' }}>ফিল্টার: {doc.filterNote}</div>
        )}
      </div>

      {/* টেবিল */}
      {doc.rows.length === 0 ? (
        <div
          style={{
            border: `1px dashed ${borderLight}`,
            borderRadius: '6px',
            padding: '22px',
            textAlign: 'center',
            fontSize: '11px',
            color: grayMuted,
          }}
        >
          নির্বাচিত ফিল্টারে কোনো তথ্য পাওয়া যায়নি।
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {doc.columns.map((c, i) => (
                <th
                  key={c.label}
                  style={{
                    background: headBg,
                    color: ink,
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '5px 6px',
                    textAlign: (c.align || (i === 0 ? 'left' : 'right')) as 'left' | 'right',
                    border: `1px solid ${borderCell}`,
                    width: c.width,
                    wordBreak: 'break-word',
                  }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {doc.rows.map((r, ri) => (
              <tr key={ri} style={{ background: r.emphasis ? emphasisBg : ri % 2 ? zebraBg : '#ffffff' }}>
                {doc.columns.map((c, ci) => (
                  <td
                    key={ci}
                    style={{
                      fontSize: '10.5px',
                      fontWeight: r.emphasis ? 700 : 400,
                      color: ci === 0 ? ink : grayText,
                      padding: '5px 6px',
                      textAlign: (c.align || (ci === 0 ? 'left' : 'right')) as 'left' | 'right',
                      border: `1px solid ${borderLight}`,
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {r.cells[ci]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {doc.totals && (
            <tfoot>
              <tr>
                {doc.totals.map((cell, i) => (
                  <td
                    key={i}
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      background: totalBg,
                      borderTop: `1.5px solid ${borderStrong}`,
                      borderLeft: `1px solid ${borderLight}`,
                      borderRight: `1px solid ${borderLight}`,
                      borderBottom: `1px solid ${borderLight}`,
                      padding: '5px 6px',
                      textAlign: (doc.columns[i]?.align || (i === 0 ? 'left' : 'right')) as 'left' | 'right',
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      )}

      {doc.notes?.map((n) => (
        <div key={n} style={{ fontSize: '10px', color: grayMuted, marginTop: '3px' }}>
          • {n}
        </div>
      ))}

      {/* মালিকের স্বাক্ষরের জায়গা */}
      {last && <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '34px' }}>
        <div style={{ width: '240px', textAlign: 'center' }}>
          <div style={{ borderTop: `1px solid ${ink}`, paddingTop: '5px', fontSize: '11px', fontWeight: 600, color: ink }}>
            মালিকের স্বাক্ষর
          </div>
          <div style={{ fontSize: '10px', color: grayMuted, marginTop: '6px' }}>তারিখ: ____ / ____ / ________</div>
        </div>
      </div>}
    </div>
  )
}
