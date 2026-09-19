import { dateKeyToday, isBackdated } from '../lib/profitLoss'
import { bnDate } from '../lib/reports/core'

/**
 * এন্ট্রি-ফর্মের তারিখ নির্বাচক — **পুরানো তারিখেও** বিক্রি/ক্রয়/স্টক এন্ট্রি দেওয়া যায়।
 *
 * - ডিফল্ট আজকের তারিখ, `max` = আজ (ভবিষ্যতের তারিখ বন্ধ)
 * - পুরানো তারিখ বাছাই করলে সাথে সাথে বাংলায় সতর্কবার্তা + "আজ" বাটন দেখায়,
 *   যাতে ভুল করে পরের এন্ট্রিগুলোও পুরানো তারিখে না চলে যায়
 */
export default function EntryDateField({
  value,
  onChange,
  label = 'তারিখ',
  /** সতর্কবার্তায় কীসের এন্ট্রি — যেমন "বিক্রি", "ক্রয়", "সমন্বয়" */
  what = 'এন্ট্রি',
  className = '',
}: {
  value: string
  onChange: (dateKey: string) => void
  label?: string
  what?: string
  className?: string
}) {
  const today = dateKeyToday()
  const old = isBackdated(value, today)

  return (
    <div className={className}>
      <label className="block">
        <span className="text-sm font-medium text-gray-700">
          {label}
          {old && <span className="ml-1.5 text-[11px] font-semibold text-amber-700">পুরানো তারিখ</span>}
        </span>
        <div className="flex gap-1.5 mt-1">
          <input
            type="date"
            value={value}
            max={today}
            onChange={(e) => onChange(e.target.value || today)}
            className={`input-field ${old ? 'border-amber-400 bg-amber-50' : ''}`}
            aria-label={`${label} (পুরানো তারিখও দেওয়া যাবে)`}
          />
          {old && (
            <button
              type="button"
              onClick={() => onChange(today)}
              className="shrink-0 px-2.5 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100"
              title="আজকের তারিখে ফেরত"
            >
              আজ
            </button>
          )}
        </div>
      </label>
      {old && (
        <p className="mt-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
          📅 এই {what} <strong>{bnDate(value)}</strong> তারিখে সেভ হবে — আজকের হিসাবে নয়।
        </p>
      )}
    </div>
  )
}
