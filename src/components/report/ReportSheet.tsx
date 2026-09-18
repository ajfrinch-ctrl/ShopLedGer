import type { RefObject } from 'react'
import type { ReportDocument } from '../../lib/reports/core'

/** A4 (৯৬ dpi) — ২১০ মিমি প্রস্থ, ১০ মিমি মার্জিন দুই পাশে → কনটেন্ট ১৯০ মিমি ≈ ৭১৮ পিক্সেল */
export const SHEET_WIDTH_PX = 718

const teal = '#0f766e'

/**
 * PDF/প্রিন্টের মূল A4 শিট — ঠিক যা ক্যাপচার হয়ে PDF-এ যাবে।
 * স্ক্রিনে দেখা যায় না (অফ-স্ক্রিন), শুধু ক্যাপচারের জন্য রেন্ডার হয়।
 */
export default function ReportSheet({
  doc,
  businessName,
  subtitle,
  sheetRef,
}: {
  doc: ReportDocument
  businessName: string
  subtitle?: string
  sheetRef: RefObject<HTMLDivElement>
}) {
  const isKeyValue = doc.columns.length === 2

  return (
    <div
      ref={sheetRef}
      style={{
        width: `${SHEET_WIDTH_PX}px`,
        background: '#ffffff',
        color: '#111827',
        padding: '0',
        fontFamily: "'Noto Sans Bengali', system-ui, sans-serif",
      }}
    >
      {/* হেডার: ব্যবসার নাম, রিপোর্টের নাম, নির্বাচিত সময় */}
      <div style={{ borderBottom: `2px solid ${teal}`, paddingBottom: '6px', marginBottom: '10px' }}>
        <div style={{ fontSize: '22px', fontWeight: 700, color: teal, lineHeight: 1.25 }}>{businessName}</div>
        <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '2px' }}>{doc.title}</div>
        <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '3px' }}>
          সময়: {doc.period}
          {subtitle ? ` • শাখা: ${subtitle}` : ''}
        </div>
        {doc.filterNote && (
          <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>ফিল্টার: {doc.filterNote}</div>
        )}
      </div>

      {/* সারসংক্ষেপ */}
      {doc.summary.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px 18px',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            padding: '7px 10px',
            marginBottom: '10px',
          }}
        >
          {doc.summary.map((s) => (
            <div key={s.label} style={{ minWidth: '118px' }}>
              <div style={{ fontSize: '10px', color: '#6b7280' }}>{s.label}</div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* টেবিল */}
      {doc.rows.length === 0 ? (
        <div
          style={{
            border: '1px dashed #d1d5db',
            borderRadius: '6px',
            padding: '22px',
            textAlign: 'center',
            fontSize: '11px',
            color: '#6b7280',
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
                    background: teal,
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '5px 6px',
                    textAlign: (c.align || (i === 0 ? 'left' : 'right')) as 'left' | 'right',
                    border: `1px solid ${teal}`,
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
              <tr key={ri} style={{ background: r.emphasis ? '#f0fdfa' : ri % 2 ? '#f9fafb' : '#ffffff' }}>
                {doc.columns.map((c, ci) => (
                  <td
                    key={ci}
                    style={{
                      fontSize: '10.5px',
                      fontWeight: r.emphasis ? 700 : 400,
                      color: ci === 0 ? '#374151' : '#4b5563',
                      padding: '5px 6px',
                      textAlign: (c.align || (ci === 0 ? 'left' : 'right')) as 'left' | 'right',
                      border: '1px solid #e5e7eb',
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
                      background: '#ecfdf5',
                      borderTop: `1.5px solid ${teal}`,
                      borderLeft: '1px solid #e5e7eb',
                      borderRight: '1px solid #e5e7eb',
                      borderBottom: '1px solid #e5e7eb',
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
        <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>
          সর্বমোট সারি = নির্বাচিত সময়ের যোগফল
        </div>
      )}

      {doc.notes?.map((n) => (
        <div key={n} style={{ fontSize: '10px', color: '#6b7280', marginTop: '3px' }}>
          • {n}
        </div>
      ))}
    </div>
  )
}
