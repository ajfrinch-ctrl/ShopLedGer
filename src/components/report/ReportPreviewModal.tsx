import { useRef, useState, type ReactNode, type RefObject } from 'react'
import { FileDown, ImageDown, Loader2, X } from 'lucide-react'
import { downloadSheetPdf, shareSheetImage } from '../../lib/reports/pdf'
import { useReportDialog } from './useReportDialog'
import PdfBusyOverlay from './PdfBusyOverlay'

/**
 * রিপোর্ট প্রিভিউ পপ-আপ।
 *
 * নিয়ম: রিপোর্ট **আগে জেনারেট হয়ে** এই পপ-আপে পুরোপুরি দেখা যাবে — তারপর দরকার
 * হলে ডাউনলোড বা শেয়ার। তাই অপ্রয়োজনে কোনো ফাইল ডাউনলোড হয় না।
 *
 * `captureRef` = যে এলিমেন্টটি ক্যাপচার হয়ে PDF হবে (সাধারণত লুকানো A4 প্যাড শিট
 * অথবা পপ-আপের ভিতরের সম্পূর্ণ রিপোর্ট বডি)।
 */
export default function ReportPreviewModal({
  title,
  filename,
  shareText,
  captureRef,
  onClose,
  children,
  hint,
  allowShare = true,
}: {
  title: string
  /** ফাইল-সেভ ও শেয়ারে ব্যবহৃত নাম */
  filename: string
  shareText?: string
  captureRef: RefObject<HTMLElement>
  onClose: () => void
  /** সম্পূর্ণ প্রিভিউ (কোনো সারি কাটা থাকে না) */
  children: ReactNode
  hint?: string
  /** Customer statements are download-only: no share/WhatsApp control is rendered. */
  allowShare?: boolean
}) {
  const [busy, setBusy] = useState<'pdf' | 'share' | null>(null)
  const [message, setMessage] = useState('')

  const dialogRef = useRef<HTMLDivElement>(null)
  useReportDialog(dialogRef, onClose, !!busy)

  /** PDF বানানোর আগে এক ফ্রেম অপেক্ষা — ঢাকনা যাতে আগে এঁকে ফেলে */
  const settle = () => new Promise((r) => setTimeout(r, 120))

  async function download() {
    if (!captureRef.current) return
    setBusy('pdf')
    setMessage('')
    try {
      await settle()
      await downloadSheetPdf(captureRef.current, { filename })
      setMessage('PDF ডাউনলোড হয়েছে — ফাইলটি ফোন/কম্পিউটারে সেভ হয়েছে।')
    } catch {
      setMessage('PDF তৈরি হয়নি, আবার চেষ্টা করুন।')
    } finally {
      setBusy(null)
    }
  }

  /** শেয়ার সবসময় ছবি হিসেবে — আগে ছবি তৈরি হয়, তারপর WhatsApp/অন্য অ্যাপে যায় */
  async function share() {
    if (!captureRef.current) return
    setBusy('share')
    setMessage('')
    try {
      await settle()
      const result = await shareSheetImage(captureRef.current, { filename, shareText })
      setMessage(
        result === 'shared'
          ? 'রিপোর্টের ছবি তৈরি হয়ে শেয়ার শিটে পাঠানো হয়েছে — WhatsApp বেছে নিন।'
          : result === 'cancelled'
            ? ''
            : 'রিপোর্টের ছবি ডাউনলোড হয়েছে ও WhatsApp খোলা হয়েছে — ছবিটি (একাধিক পেজ হলে সবগুলো) সংযুক্ত করুন।',
      )
    } catch {
      setMessage('ছবি তৈরি করা যায়নি, আবার চেষ্টা করুন।')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 bg-black/60 flex flex-col"
      data-report-modal
    >
      {/* হেডার */}
      <div className="bg-gradient-to-r from-teal-700 to-emerald-700 text-white px-4 py-3 flex items-center gap-3 shrink-0 shadow">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{title}</p>
          <p className="text-[11px] text-teal-100 truncate">
            {allowShare
              ? 'সম্পূর্ণ রিপোর্ট — প্যাড সহ। চাইলে তবেই ডাউনলোড; শেয়ার হলে ছবি হিসেবেই যায়।'
              : 'সম্পূর্ণ Statement — আগে প্রিভিউ, তারপর শুধু PDF Download।'}
          </p>
        </div>
        <button
          type="button"
          disabled={!!busy}
          onClick={onClose}
          aria-label="প্রিভিউ বন্ধ করুন"
          className="p-2 rounded-full bg-white/15 hover:bg-white/25 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <PdfBusyOverlay
        show={!!busy}
        label={busy === 'share' ? 'শেয়ারের জন্য ছবি তৈরি হচ্ছে…' : 'PDF তৈরি হচ্ছে…'}
      />

      {/* সম্পূর্ণ প্রিভিউ (স্ক্রল করা যায়) */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4" data-preview-scroll>
        <div className="max-w-3xl mx-auto">{children}</div>
      </div>

      {/* অ্যাকশন বার */}
      <div className="shrink-0 bg-white border-t border-gray-200 p-3 space-y-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className={`${allowShare ? 'grid grid-cols-2' : 'grid grid-cols-1'} gap-2 max-w-3xl mx-auto`}>
          <button
            type="button"
            disabled={!!busy}
            onClick={download}
            className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy === 'pdf' ? <Loader2 className="animate-spin" size={16} /> : <FileDown size={16} />}
            {allowShare ? 'PDF ডাউনলোড' : 'Download PDF'}
          </button>
          {allowShare && <button
            type="button"
            disabled={!!busy}
            onClick={share}
            className="btn-primary bg-green-600 hover:bg-green-700 border-green-600 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy === 'share' ? <Loader2 className="animate-spin" size={16} /> : <ImageDown size={16} />}
            ছবি শেয়ার / WhatsApp
          </button>}
        </div>

        <p className="text-[11px] text-gray-500 text-center max-w-3xl mx-auto" role="status">
          {message || hint || (allowShare
            ? 'শেয়ারে রিপোর্টের ছবি যায় (লম্বা রিপোর্ট হলে একাধিক A4 পেজের ছবি) — WhatsApp-এ সরাসরি পাঠানো যায়।'
            : 'Statement-এর PDF শুধু আপনার ডিভাইসে ডাউনলোড হবে।')}
        </p>
      </div>
    </div>
  )
}
