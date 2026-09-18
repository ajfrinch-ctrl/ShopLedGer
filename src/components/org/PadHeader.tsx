import { padHasDetails, type OrgPad } from '../../lib/orgPad'

/**
 * প্রতিষ্ঠানের প্যাড-হেডার — লোগো, নাম, ঠিকানা ও ফোন **পেজের মাঝখানে** (কেন্দ্রে)।
 *
 * সব জায়গায় (A4 রিপোর্ট শিট, প্রিভিউ পপ-আপ, রসিদ, স্টেটমেন্ট) একই কম্পোনেন্ট
 * ব্যবহার হয়, তাই প্যাডের চেহারা কখনো আলাদা হয় না। inline style ব্যবহার করা
 * হয়েছে — html2canvas ক্যাপচারে কোনো স্টাইল হারায় না।
 */
export type PadSize = 'sheet' | 'screen' | 'receipt'

interface SizeSpec {
  logo: number
  name: number
  line: number
  gap: number
  rule: number
  marginBottom: number
}

const SIZES: Record<PadSize, SizeSpec> = {
  // A4 শিট (৭১৮px) — মূল স্কেল
  sheet: { logo: 76, name: 24, line: 12, gap: 6, rule: 2.5, marginBottom: 10 },
  // পপ-আপ/স্ক্রিন প্রিভিউ
  screen: { logo: 64, name: 20, line: 12, gap: 5, rule: 2, marginBottom: 8 },
  // রসিদ (ছোট কাগজ)
  receipt: { logo: 58, name: 18, line: 12, gap: 4, rule: 1.5, marginBottom: 8 },
}

const ink = '#111827'
const grayText = '#4b5563'
const grayMuted = '#6b7280'
const ruleColor = '#111827'

export default function PadHeader({
  pad,
  size = 'sheet',
  /** প্রতিষ্ঠান-প্যাডের নিচের ছোট লাইন — যেমন "শাখা: প্রধান শাখা" বা রিপোর্টের সময়কাল */
  subtitle,
  /** নিচে দাগ (rule) দেখাবে কি না */
  rule = true,
  /** দাগ ভাঙা (ড্যাশ) হবে কি না — রসিদে সুন্দর দেখায় */
  dashedRule = false,
  color,
}: {
  pad: OrgPad
  size?: PadSize
  subtitle?: string
  rule?: boolean
  dashedRule?: boolean
  /** নাম ও লাইনগুলোর রঙ (রসিদে কালোই থাকে) */
  color?: string
}) {
  const s = SIZES[size]
  const title = color || ink
  /* শাখার নাম subtitle-এ আগেই থাকলে আলাদা করে দেখানো হয় না (দুইবার না আসে) */
  const branchLine =
    pad.branchName && (!subtitle || !subtitle.includes(pad.branchName)) ? pad.branchName : undefined

  return (
    <div
      data-pad
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        width: '100%',
        ...(rule
          ? {
              borderBottom: `${s.rule}px ${dashedRule ? 'dashed' : 'solid'} ${ruleColor}`,
              paddingBottom: `${s.marginBottom}px`,
            }
          : {}),
      }}
    >
      {pad.logo && (
        <img
          src={pad.logo}
          alt={pad.name}
          data-pad-logo
          style={{
            maxHeight: `${s.logo}px`,
            maxWidth: `${s.logo * 1.6}px`,
            objectFit: 'contain',
            marginBottom: `${s.gap}px`,
          }}
        />
      )}

      <div
        data-pad-name
        style={{
          fontSize: `${s.name}px`,
          fontWeight: 700,
          color: title,
          lineHeight: 1.3,
          wordBreak: 'break-word',
        }}
      >
        {pad.name}
      </div>

      {branchLine && (
        <div style={{ fontSize: `${s.line}px`, color: grayText, marginTop: '2px' }}>{branchLine}</div>
      )}

      {pad.address && (
        <div
          data-pad-address
          style={{ fontSize: `${s.line}px`, color: grayText, marginTop: '3px', lineHeight: 1.45 }}
        >
          {pad.address}
        </div>
      )}

      {pad.phone && (
        <div data-pad-phone style={{ fontSize: `${s.line}px`, color: grayText, marginTop: '2px' }}>
          মোবাইল: {pad.phone}
        </div>
      )}

      {subtitle && (
        <div style={{ fontSize: `${s.line}px`, color: grayMuted, marginTop: '3px' }}>{subtitle}</div>
      )}
    </div>
  )
}

/** প্যাডে কিছুই না থাকলে ছোট সতর্কবার্তা — মালিককে প্যাড সেট করার কথা মনে করায় */
export function PadEmptyHint({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 ${className}`}>
      প্রতিষ্ঠানের নাম-ঠিকানা-লোগো এখনো সেট করা হয়নি। মালিক{' '}
      <span className="font-semibold">শাখা ও ব্যবস্থাপক → প্যাড</span> থেকে সেট করলে সব রিপোর্ট, রসিদ ও
      স্টেটমেন্টে প্যাডের মাঝখানে দেখা যাবে।
    </p>
  )
}

export { padHasDetails }
