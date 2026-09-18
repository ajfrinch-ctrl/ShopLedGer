import { useRef, useState } from 'react'
import { X, Share2, Printer, FileDown, Loader2 } from 'lucide-react'
import type { Sale } from '../types'
import { captureReport, downloadCanvasPdf } from '../lib/reportExport'
import { shareSheetPdf } from '../lib/reports/pdf'
import { orgPadOf, type OrgPad } from '../lib/orgPad'
import PadHeader from './org/PadHeader'
import PdfBusyOverlay from './report/PdfBusyOverlay'
import { useAuthStore } from '../stores/authStore'
import { canSeeProfit } from '../lib/roles'

interface Props {
  sale: Sale
  /** প্রতিষ্ঠানের নাম (পুরোনো কল-এর জন্য) — pad না দিলে এটিই ব্যবহৃত হয় */
  shopName?: string
  /** প্রতিষ্ঠানের প্যাড — লোগো, নাম, ঠিকানা, ফোন (রসিদের মাঝখানে দেখানো হয়) */
  pad?: OrgPad
  onClose: () => void
  /** ক্রেতার রসিদে লাভ লুকানো — true হলে লাভ কখনোই দেখাবে না */
  hideProfit?: boolean
}

/**
 * বিক্রি রসিদের প্রিভিউ পপ-আপ।
 * উপরে প্রতিষ্ঠানের প্যাড (লোগো, নাম, ঠিকানা, ফোন — মাঝখানে), নিচে রসিদের হিসাব;
 * এখান থেকেই PDF ডাউনলোড, শেয়ার বা প্রিন্ট।
 */
export default function SaleReceipt({ sale, shopName, pad, onClose, hideProfit }: Props) {
  const receiptRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState<'pdf' | 'share' | null>(null)
  const [message, setMessage] = useState('')
  const user = useAuthStore((s) => s.user)

  const padInfo: OrgPad = pad ?? orgPadOf({ organization: shopName })
  const fileName = `receipt-${sale.id}.pdf`

  // মালিক/ব্যবস্থাপক ছাড়া কেউ লাভ দেখবে না — ক্রেতা তো নয়ই
  const forcedHide = hideProfit ?? false
  const canSee = canSeeProfit(user?.role)
  const showProfit = !forcedHide && canSee

  const items = sale.items
    .map(
      (item, i) =>
        `${i + 1}. ${item.product_name} — ${item.quantity} ${item.unit} × ৳${item.sale_price} = ৳${item.total.toLocaleString('bn-BD')}`,
    )
    .join('\n')

  const shareText = `🧾 *${padInfo.name}* — বিক্রি রিসিট\n━━━━━━━━━━━━━━━━\n🧾 রসিদ নং: ${sale.id}\n📅 ${new Date(sale.date).toLocaleDateString('bn-BD')}\n${sale.customer_name ? `👤 ${sale.customer_name}${sale.customer_id ? ` (${sale.customer_id})` : ''}\n` : ''}\n${items}\n━━━━━━━━━━━━━━━━\n💰 মোট: *৳${sale.total_amount.toLocaleString('bn-BD')}*\n💳 ${sale.payment_type}\n${sale.note ? `📝 ${sale.note}` : ''}\n${padInfo.address ? `📍 ${padInfo.address}\n` : ''}${padInfo.phone ? `📞 ${padInfo.phone}\n` : ''}\nShopLedGer থেকে পাঠানো হয়েছে`

  /** রসিদের PDF — ক্রেতা/দোকান দুই দিক থেকেই ডাউনলোড করা যায়, কিন্তু লাভ ক্রেতার কাছে যাবে না */
  const handleDownloadPdf = async () => {
    if (!receiptRef.current) return
    setBusy('pdf')
    setMessage('')
    try {
      await new Promise((r) => setTimeout(r, 120))
      const canvas = await captureReport(receiptRef.current)
      await downloadCanvasPdf(canvas, fileName)
      setMessage('রসিদের PDF ডাউনলোড হয়েছে।')
    } catch (e) {
      console.error('PDF error', e)
      setMessage(e instanceof Error ? e.message : 'PDF তৈরি হয়নি, আবার চেষ্টা করুন।')
    } finally {
      setBusy(null)
    }
  }

  /** PDF ফাইলটাই শেয়ার শিটে/WhatsApp-এ পাঠানোর চেষ্টা; না পারলে ডাউনলোড + wa.me */
  const handleShare = async () => {
    if (!receiptRef.current) return
    setBusy('share')
    setMessage('')
    try {
      await new Promise((r) => setTimeout(r, 120))
      const result = await shareSheetPdf(receiptRef.current, { filename: fileName, shareText })
      setMessage(
        result === 'shared'
          ? 'রসিদের PDF শেয়ার শিটে পাঠানো হয়েছে।'
          : result === 'cancelled'
            ? ''
            : 'রসিদের PDF ডাউনলোড হয়েছে ও WhatsApp খোলা হয়েছে — ফাইলটি সংযুক্ত করুন।',
      )
    } catch (e) {
      console.error('share error', e)
      setMessage('শেয়ার করা যায়নি, আবার চেষ্টা করুন।')
    } finally {
      setBusy(null)
    }
  }

  const handlePrint = () => {
    const content = receiptRef.current
    if (!content) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <html><head><title>রিসিট</title>
      <style>
        body { font-family: 'Noto Sans Bengali', sans-serif; padding: 16px; max-width: 320px; margin: auto; }
        .line { display: flex; justify-content: space-between; margin: 2px 0; font-size: 13px; }
        .bold { font-weight: 700; }
        .center { text-align: center; }
        .border { border-top: 1px dashed #999; margin: 8px 0; }
      </style></head><body>${content.innerHTML}</body></html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const dateStr = new Date(sale.date).toLocaleDateString('bn-BD', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="বিক্রি রিসিট প্রিভিউ"
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-lg font-bold text-gray-800">বিক্রি রিসিট</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="রসিদ বন্ধ করুন"
          >
            <X size={20} />
          </button>
        </div>

        <PdfBusyOverlay show={!!busy} label={busy === 'share' ? 'শেয়ারের জন্য PDF তৈরি হচ্ছে…' : 'PDF তৈরি হচ্ছে…'} />

        {/* Receipt Content */}
        <div
          ref={receiptRef}
          data-pdf-expand
          className="flex-1 overflow-y-auto px-5 pb-4 space-y-3 bg-white"
        >
          {/* প্রতিষ্ঠানের প্যাড — লোগো, নাম, ঠিকানা, ফোন মাঝখানে */}
          <PadHeader pad={padInfo} size="receipt" dashedRule />
          <div className="text-center">
            <p className="text-xs text-gray-500">{dateStr}</p>
            <p className="text-[11px] font-mono text-gray-600 mt-1">রসিদ নং: {sale.id}</p>
          </div>

          {/* Customer */}
          {sale.customer_name && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">ক্রেতা:</span>
              <span className="font-semibold text-gray-800">{sale.customer_name}</span>
              {sale.customer_id && <span className="text-[11px] font-mono text-gray-400">({sale.customer_id})</span>}
            </div>
          )}

          {/* Items Table */}
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-1 text-xs font-semibold text-gray-500 border-b pb-1">
              <div className="col-span-5">পণ্য</div>
              <div className="col-span-2 text-right">পরিমাণ</div>
              <div className="col-span-2 text-right">দর</div>
              <div className="col-span-3 text-right">মোট</div>
            </div>
            {sale.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-1 text-sm text-gray-700">
                <div className="col-span-5 font-medium truncate">{item.product_name}</div>
                <div className="col-span-2 text-right">
                  {item.quantity} {item.unit}
                </div>
                <div className="col-span-2 text-right">৳{item.sale_price}</div>
                <div className="col-span-3 text-right font-semibold">
                  ৳{item.total.toLocaleString('bn-BD')}
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-dashed border-gray-300 pt-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">মোট বিক্রি</span>
              <span className="font-bold text-gray-800 text-base">
                ৳ {sale.total_amount.toLocaleString('bn-BD')}
              </span>
            </div>
            {showProfit && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">লাভ</span>
                <span className="font-semibold text-green-600">৳ {sale.total_profit.toLocaleString('bn-BD')}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">পেমেন্ট</span>
              <span
                className={`font-semibold px-2 py-0.5 rounded text-xs ${
                  sale.payment_type === 'নগদ' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                }`}
              >
                {sale.payment_type}
              </span>
            </div>
          </div>

          {sale.note && (
            <div className="text-xs text-gray-500 border-t border-dashed pt-2">📝 {sale.note}</div>
          )}

          {/* Footer */}
          <p className="text-center text-xs text-gray-400 pt-2">
            {padInfo.name}
            {padInfo.phone ? ` • ${padInfo.phone}` : ''} — ধন্যবাদ
          </p>
        </div>

        {/* Action Buttons */}
        <div className="px-5 pb-5 pt-2 space-y-2 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={!!busy}
              className="bg-teal-700 hover:bg-teal-800 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-60"
            >
              {busy === 'pdf' ? <Loader2 className="animate-spin" size={18} /> : <FileDown size={18} />}
              PDF ডাউনলোড
            </button>
            <button
              onClick={handleShare}
              disabled={!!busy}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-60"
            >
              {busy === 'share' ? <Loader2 className="animate-spin" size={18} /> : <Share2 size={18} />}
              শেয়ার / WhatsApp
            </button>
          </div>
          <button
            onClick={handlePrint}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
          >
            <Printer size={18} />
            প্রিন্ট
          </button>
          {message && <p className="text-xs text-center text-gray-600">{message}</p>}
        </div>
      </div>
    </div>
  )
}
