import { useRef, useState } from 'react'
import type { DbBranch, LedgerEntry } from '../lib/db'
import { money } from '../lib/ledger'
import { captureReport, downloadCanvasPdf } from '../lib/reportExport'
import { shareSheetImage } from '../lib/reports/pdf'
import { orgPadOf } from '../lib/orgPad'
import PadHeader from './org/PadHeader'
import PdfBusyOverlay from './report/PdfBusyOverlay'
import { FileDown, ImageDown, Printer, X } from 'lucide-react'

import { useReportDialog } from './report/useReportDialog'
import { bnDate } from '../lib/reports/core'

/**
 * লেনদেনের রসিদ (টাকা আদায়/পরিশোধ) — প্রিভিউ পপ-আপ।
 * উপরে প্রতিষ্ঠানের প্যাড (লোগো, নাম, ঠিকানা, ফোন — মাঝখানে); নিচে লেনদেনের হিসাব
 * ও স্বাক্ষরের জায়গা। এখান থেকেই PDF ডাউনলোড, ছবি, শেয়ার বা প্রিন্ট।
 */
export default function LedgerReceipt({
  entry,
  branch,
  partyPhone,
  partyAddress,
  balance,
  onClose,
}: {
  entry: LedgerEntry
  branch?: DbBranch
  partyPhone?: string
  partyAddress?: string
  balance: number
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState<'pdf' | 'share' | 'image' | 'print' | null>(null)
  const [message, setMessage] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  useReportDialog(dialogRef, onClose, !!busy)

  const pad = orgPadOf(branch)
  const title =
    entry.party_type === 'customer' ? 'টাকা আদায়ের রসিদ' : 'টাকা পরিশোধের রসিদ'
  const partyLabel = entry.party_type === 'customer' ? 'ক্রেতা' : 'সাপ্লায়ার'
  const fileName = `receipt-${entry.id}.pdf`
  const formattedDate = bnDate(entry.date)
  const shareText = `🧾 *${pad.name}*\n${title}${entry.cancelled ? ' (বাতিল)' : ''}\n━━━━━━━━━━━━━━━━\nরসিদ নং: ${entry.id}\nতারিখ: ${formattedDate}\n${partyLabel}: ${entry.party_name}${partyPhone ? `\nমোবাইল: ${partyPhone}` : ''}${partyAddress ? `\nঠিকানা: ${partyAddress}` : ''}\nটাকা: ${money(entry.amount)}\nমাধ্যম: ${entry.method}\nলেনদেনের পর ${entry.party_type === 'customer' ? 'পাওনা' : 'দেনা'}: ${money(balance)}${pad.address ? `\n📍 ${pad.address}` : ''}${pad.phone ? `\n📞 ${pad.phone}` : ''}`

  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function exportReceipt(mode: 'pdf' | 'share' | 'image' | 'print') {
    if (!ref.current) return
    const popup = mode === 'print' ? window.open('', '_blank') : null
    setBusy(mode)
    setMessage('')
    try {
      // ঢাকনা আগে এঁকে ফেলার জন্য এক ফ্রেম
      await new Promise((r) => setTimeout(r, 120))
      if (mode === 'share') {
        // শেয়ার সবসময় ছবি হিসেবে — আগে রসিদের ছবি তৈরি হয়, তারপর WhatsApp-এ যায়
        const result = await shareSheetImage(ref.current, { filename: fileName, shareText })
        setMessage(
          result === 'shared'
            ? 'রসিদের ছবি তৈরি হয়ে শেয়ার শিটে পাঠানো হয়েছে — WhatsApp বেছে নিন।'
            : result === 'cancelled'
              ? ''
              : 'রসিদের ছবি ডাউনলোড হয়েছে ও WhatsApp খোলা হয়েছে — ছবিটি সংযুক্ত করুন।',
        )
        return
      }

      const canvas = await captureReport(ref.current)
      if (mode === 'pdf') {
        await downloadCanvasPdf(canvas, fileName)
        setMessage('রসিদের PDF ডাউনলোড হয়েছে।')
      } else if (mode === 'print') {
        if (!popup) throw new Error('প্রিন্টের জন্য পপআপ অনুমতি দিন')
        const img = popup.document.createElement('img')
        img.style.width = '100%'
        img.onload = () => {
          popup.focus()
          popup.print()
        }
        img.src = canvas.toDataURL('image/png')
        popup.document.body.appendChild(img)
      } else {
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('ছবি তৈরি হয়নি'))), 'image/png'),
        )
        download(blob, `receipt-${entry.id}.png`)
        setMessage('রসিদের ছবি ডাউনলোড হয়েছে।')
      }
    } catch (err) {
      popup?.close()
      setMessage(err instanceof Error ? err.message : 'রসিদ তৈরি হয়নি')
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
      aria-label="লেনদেনের রসিদ প্রিভিউ"
      className="fixed inset-0 z-50 bg-black/60 flex flex-col"
    >
      <div className="bg-gradient-to-r from-teal-700 to-emerald-700 text-white px-4 py-3 flex items-center gap-3 shrink-0">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">লেনদেনের রসিদ — প্রিভিউ</p>
          <p className="text-[11px] text-teal-100 truncate">
            প্যাড সহ পুরো রসিদ দেখুন, তারপর দরকার হলে ডাউনলোড/শেয়ার/প্রিন্ট
          </p>
        </div>
        <button
          type="button"
          disabled={!!busy}
          onClick={onClose}
          aria-label="রসিদ বন্ধ করুন"
          className="p-2 rounded-full bg-white/15 hover:bg-white/25 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <PdfBusyOverlay
        show={!!busy}
        label={busy === 'share' ? 'শেয়ারের জন্য ছবি তৈরি হচ্ছে…' : 'PDF তৈরি হচ্ছে…'}
      />

      <div className="flex-1 overflow-y-auto p-3">
        <div
          ref={ref}
          data-pdf-width="718"
          className="max-w-xl mx-auto bg-white rounded-xl p-6 text-gray-900 space-y-3"
          style={{ overflowWrap: 'anywhere' }}
        >
          {/* প্রতিষ্ঠানের প্যাড — মাঝখানে */}
          <PadHeader pad={pad} size="receipt" />

          <h3 className="text-center text-lg font-bold">
            {title}
            {entry.cancelled ? ' — বাতিল' : ''}
          </h3>

          <div className="border-t border-dashed pt-3 space-y-1.5 text-sm">
            <p>রসিদ নং: {entry.id}</p>
            <p>তারিখ: {formattedDate}</p>
            <div className="bg-gray-50/70 p-2 rounded-lg border border-gray-100 space-y-0.5 my-1">
              <p>
                <span className="text-gray-500">{partyLabel}:</span>{' '}
                <span className="font-semibold text-gray-800">{entry.party_name}</span>
              </p>
              {partyPhone && (
                <p className="text-xs text-gray-600">
                  <span className="text-gray-400">মোবাইল:</span> {partyPhone}
                </p>
              )}
              {partyAddress && (
                <p className="text-xs text-gray-600">
                  <span className="text-gray-400">ঠিকানা:</span> {partyAddress}
                </p>
              )}
            </div>
            <p className="text-xl font-bold">টাকা: {money(entry.amount)}</p>
            <p>মাধ্যম: {entry.method}</p>
            {entry.reference && <p>রেফারেন্স: {entry.reference}</p>}
            <p>লেনদেনের পর {entry.party_type === 'customer' ? 'পাওনা' : 'দেনা'}: {money(balance)}</p>
            {entry.note && <p>মন্তব্য: {entry.note}</p>}
          </div>

          <div className="flex justify-end pt-6">
            <div className="w-56 text-center border-t border-gray-800 pt-1 text-[11px] font-semibold">
              অনুমোদিত স্বাক্ষর
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 bg-white border-t border-gray-200 p-3 space-y-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-2 gap-2 max-w-xl mx-auto">
          <button
            disabled={!!busy}
            className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
            onClick={() => exportReceipt('pdf')}
          >
            <FileDown size={16} /> PDF ডাউনলোড
          </button>
          <button
            disabled={!!busy}
            className="btn-primary bg-green-600 hover:bg-green-700 border-green-600 flex items-center justify-center gap-2 disabled:opacity-50"
            onClick={() => exportReceipt('share')}
          >
            <ImageDown size={16} /> ছবি শেয়ার / WhatsApp
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 max-w-xl mx-auto">
          <button
            disabled={!!busy}
            className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-50"
            onClick={() => exportReceipt('image')}
          >
            <ImageDown size={16} /> ছবি ডাউনলোড
          </button>
          <button
            disabled={!!busy}
            className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-50"
            onClick={() => exportReceipt('print')}
          >
            <Printer size={16} /> প্রিন্ট
          </button>
        </div>
        <p role="status" className="text-[11px] text-gray-500 text-center">
          {busy ? 'রসিদ তৈরি হচ্ছে…' : message || 'দরকার হলে তবেই ডাউনলোড বা শেয়ার হবে।'}
        </p>
      </div>
    </div>
  )
}
