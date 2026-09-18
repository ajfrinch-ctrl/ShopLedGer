import type { RefObject } from 'react'
import type { ReportDocument } from '../../lib/reports/core'

/** A4 (৯৬ dpi) — ২১০ মিমি প্রস্থ, ১০ মিমি মার্জিন দুই পাশে → কনটেন্ট ১৯০ মিমি ≈ ৭১৮ পিক্সেল */
export const SHEET_WIDTH_PX = 718

/** প্যাডের হেডারে দেখানো দোকানের নিজস্ব তথ্য (মালিক "শাখা ও ব্যবস্থাপক" থেকে সেট করেন) */
export interface ReportPad {
  logo?: string
  address?: string
  phone?: string
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
export default function ReportSheet({
  doc,
  businessName,
  subtitle,
  pad,
  sheetRef,
}: {
  doc: ReportDocument
  businessName: string
  subtitle?: string
  pad?: ReportPad
  sheetRef: RefObject<HTMLDivElement>
}) {
  const isKeyValue = doc.columns.length === 2

  return (
    <div
      ref={sheetRef}
      style={{
        width: `${SHEET_WIDTH_PX}px`,
        background: '#ffffff',
        color: ink,
        padding: '0',
        fontFamily: "'Noto Sans Bengali', system-ui, sans-serif",
      }}
    >
      {/* প্যাড হেডার: দোকানের লোগো, নাম, ঠিকানা ও ফোন */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          borderBottom: `2.5px solid ${borderStrong}`,
          paddingBottom: '8px',
        }}
      >
        {pad?.logo && (
          <img
            src={pad.logo}
            alt="লোগো"
            style={{ maxHeight: '64px', maxWidth: '96px', objectFit: 'contain' }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: ink, lineHeight: 1.25 }}>{businessName}</div>
          {pad?.address && <div style={{ fontSize: '11.5px', color: grayText, marginTop: '2px' }}>{pad.address}</div>}
          {pad?.phone && (
            <div style={{ fontSize: '11.5px', color: grayText, marginTop: '1px' }}>
              ফোন: {pad.phone}
              {subtitle ? ` • শাখা: ${subtitle}` : ''}
            </div>
          )}
          {!pad?.phone && subtitle && <div style={{ fontSize: '11.5px', color: grayText, marginTop: '2px' }}>শাখা: {subtitle}</div>}
        </div>
      </div>

      {/* রিপোর্টের নাম ও নির্বাচিত সময় */}
      <div style={{ paddingBottom: '6px', marginBottom: '10px', marginTop: '8px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: ink }}>{doc.title}</div>
        <div style={{ fontSize: '11px', color: grayMuted, marginTop: '3px' }}>সময়: {doc.period}</div>
        {doc.filterNote && (
          <div style={{ fontSize: '10px', color: grayMuted, marginTop: '2px' }}>ফিল্টার: {doc.filterNote}</div>
        )}
      </div>

      {/* সারসংক্ষেপ */}
      {doc.summary.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px 18px',
            border: `1px solid ${borderLight}`,
            borderRadius: '6px',
            padding: '7px 10px',
            marginBottom: '10px',
          }}
        >
          {doc.summary.map((s) => (
            <div key={s.label} style={{ minWidth: '118px' }}>
              <div style={{ fontSize: '10px', color: grayMuted }}>{s.label}</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: ink }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

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

      {!isKeyValue && doc.totals && (
        <div style={{ fontSize: '10px', color: grayMuted, marginTop: '4px' }}>
          সর্বমোট সারি = নির্বাচিত সময়ের যোগফল
        </div>
      )}

      {doc.notes?.map((n) => (
        <div key={n} style={{ fontSize: '10px', color: grayMuted, marginTop: '3px' }}>
          • {n}
        </div>
      ))}

      {/* মালিকের স্বাক্ষরের জায়গা */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '34px' }}>
        <div style={{ width: '240px', textAlign: 'center' }}>
          <div style={{ borderTop: `1px solid ${ink}`, paddingTop: '5px', fontSize: '11px', fontWeight: 600, color: ink }}>
            মালিকের স্বাক্ষর
          </div>
          <div style={{ fontSize: '10px', color: grayMuted, marginTop: '6px' }}>তারিখ: ____ / ____ / ________</div>
        </div>
      </div>
    </div>
  )
}
