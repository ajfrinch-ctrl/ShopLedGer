import { useEffect, useState, type ReactNode, type RefObject } from 'react'
import { FileDown, Loader2, Share2, X } from 'lucide-react'
import { downloadSheetPdf, shareSheetPdf } from '../../lib/reports/pdf'
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
  extraAction,
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
  extraAction?: { label: string; onClick: () => void }
}) {
  const [busy, setBusy] = useState<'pdf' | 'share' | null>(null)
  const [message, setMessage] = useState('')

  // Escape চাপলে বন্ধ + পেছনের পেজ স্ক্রল হবে না
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

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

  async function share() {
    if (!captureRef.current) return
    setBusy('share')
    setMessage('')
    try {
      await settle()
      const result = await shareSheetPdf(captureRef.current, { filename, shareText })
      setMessage(
        result === 'shared'
          ? 'PDF শেয়ার শিটে পাঠানো হয়েছে — WhatsApp বেছে নিন।'
          : result === 'cancelled'
            ? ''
            : 'PDF ডাউনলোড হয়েছে ও WhatsApp খোলা হয়েছে — ফাইলটি সংযুক্ত করুন।',
      )
    } catch {
      setMessage('শেয়ার করা যায়নি, আবার চেষ্টা করুন।')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — প্রিভিউ`}
      className="fixed inset-0 z-50 bg-black/60 flex flex-col"
      data-report-modal
    >
      {/* হেডার */}
      <div className="bg-gradient-to-r from-teal-700 to-emerald-700 text-white px-4 py-3 flex items-center gap-3 shrink-0 shadow">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{title}</p>
          <p className="text-[11px] text-teal-100 truncate">
            সম্পূর্ণ রিপোর্ট — প্যাড সহ। ডাউনলোড বা শেয়ার করুন, নচেৎ কিছুই ডাউনলোড হবে না।
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="প্রিভিউ বন্ধ করুন"
          className="p-2 rounded-full bg-white/15 hover:bg-white/25 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <PdfBusyOverlay show={!!busy} label={busy === 'share' ? 'শেয়ারের জন্য PDF তৈরি হচ্ছে…' : 'PDF তৈরি হচ্ছে…'} />

      {/* সম্পূর্ণ প্রিভিউ (স্ক্রল করা যায়) */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4" data-preview-scroll>
        <div className="max-w-3xl mx-auto">{children}</div>
      </div>

      {/* অ্যাকশন বার */}
      <div className="shrink-0 bg-white border-t border-gray-200 p-3 space-y-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-2 gap-2 max-w-3xl mx-auto">
          <button
            type="button"
            disabled={!!busy}
            onClick={download}
            className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy === 'pdf' ? <Loader2 className="animate-spin" size={16} /> : <FileDown size={16} />}
            PDF ডাউনলোড
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={share}
            className="btn-primary bg-green-600 hover:bg-green-700 border-green-600 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy === 'share' ? <Loader2 className="animate-spin" size={16} /> : <Share2 size={16} />}
            শেয়ার / WhatsApp
          </button>
        </div>

        {extraAction && (
          <button
            type="button"
            disabled={!!busy}
            onClick={extraAction.onClick}
            className="block mx-auto text-xs text-teal-700 underline disabled:opacity-50"
          >
            {extraAction.label}
          </button>
        )}

        <p className="text-[11px] text-gray-500 text-center max-w-3xl mx-auto" role="status">
          {message ||
            hint ||
            'প্রিভিউতে যা দেখছেন, PDF-এও ঠিক তা-ই থাকবে — শুধু A4 প্যাড (লোগো, নাম, ঠিকানা, ফোন, স্বাক্ষর) সহ।'}
        </p>
      </div>
    </div>
  )
}
