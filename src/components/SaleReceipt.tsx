import { useRef, useState } from 'react'
import { X, Share2, Printer, FileDown, Loader2 } from 'lucide-react'
import type { Sale } from '../types'
import { captureReport, downloadCanvasPdf } from '../lib/reportExport'
import { useAuthStore } from '../stores/authStore'
import { canSeeProfit } from '../lib/roles'

interface Props {
  sale: Sale
  shopName?: string
  onClose: () => void
  /** ক্রেতার রসিদে লাভ লুকানো — true হলে লাভ কখনোই দেখাবে না */
  hideProfit?: boolean
}

export default function SaleReceipt({ sale, shopName = 'ShopLedGer', onClose, hideProfit }: Props) {
  const receiptRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const user = useAuthStore((s) => s.user)

  // মালিক/ব্যবস্থাপক ছাড়া কেউ লাভ দেখবে না — ক্রেতা তো নয়ই
  const forcedHide = hideProfit ?? false
  const canSee = canSeeProfit(user?.role)
  const showProfit = !forcedHide && canSee

  /** রসিদের PDF — ক্রেতা/দোকান দুই দিক থেকেই ডাউনলোড করা যায়, কিন্তু লাভ ক্রেতার কাছে যাবে না */
  const handleDownloadPdf = async () => {
    if (!receiptRef.current) return
    setBusy(true)
    setMessage('')
    try {
      const canvas = await captureReport(receiptRef.current)
      await downloadCanvasPdf(canvas, `receipt-${sale.id}.pdf`)
      setMessage('রসিদের PDF ডাউনলোড হয়েছে।')
    } catch (e) {
      console.error('PDF error', e)
      setMessage(e instanceof Error ? e.message : 'PDF তৈরি হয়নি, আবার চেষ্টা করুন।')
    } finally {
      setBusy(false)
    }
  }

  const handleWhatsAppShare = async () => {
    const items = sale.items
      .map(
        (item, i) =>
          `${i + 1}. ${item.product_name} — ${item.quantity} ${item.unit} × ৳${item.sale_price} = ৳${item.total.toLocaleString('bn-BD')}`,
      )
      .join('\n')

    const text = `🧾 *${shopName}* — বিক্রি রিসিট\n━━━━━━━━━━━━━━━━\n🧾 রসিদ নং: ${sale.id}\n📅 ${new Date(sale.date).toLocaleDateString('bn-BD')}\n${sale.customer_name ? `👤 ${sale.customer_name}${sale.customer_id ? ` (${sale.customer_id})` : ''}\n` : ''}\n${items}\n━━━━━━━━━━━━━━━━\n💰 মোট: *৳${sale.total_amount.toLocaleString('bn-BD')}*\n💳 ${sale.payment_type}\n${sale.note ? `📝 ${sale.note}` : ''}\n\nShopLedGer থেকে পাঠানো হয়েছে`

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-lg font-bold text-gray-800">বিক্রি রিসিট</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Receipt Content */}
        <div
          ref={receiptRef}
          data-pdf-expand
          className="flex-1 overflow-y-auto px-5 pb-4 space-y-3 bg-white"
        >
          {/* Shop Name */}
          <div className="text-center border-b border-dashed border-gray-300 pb-3">
            <h4 className="text-xl font-bold text-teal-700">{shopName}</h4>
            <p className="text-xs text-gray-500 mt-0.5">{dateStr}</p>
            <p className="text-[11px] font-mono text-gray-600 mt-1">রসিদ নং: {sale.id}</p>
          </div>

          {/* Customer */}
          {sale.customer_name && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">ক্রেতা:</span>
              <span className="font-semibold text-gray-800">
                {sale.customer_name}
              </span>
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
              <div
                key={idx}
                className="grid grid-cols-12 gap-1 text-sm text-gray-700"
              >
                <div className="col-span-5 font-medium truncate">
                  {item.product_name}
                </div>
                <div className="col-span-2 text-right">
                  {item.quantity} {item.unit}
                </div>
                <div className="col-span-2 text-right">
                  ৳{item.sale_price}
                </div>
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
                <span className="font-semibold text-green-600">
                  ৳ {sale.total_profit.toLocaleString('bn-BD')}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">পেমেন্ট</span>
              <span
                className={`font-semibold px-2 py-0.5 rounded text-xs ${
                  sale.payment_type === 'নগদ'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-orange-100 text-orange-700'
                }`}
              >
                {sale.payment_type}
              </span>
            </div>
          </div>

          {sale.note && (
            <div className="text-xs text-gray-500 border-t border-dashed pt-2">
              📝 {sale.note}
            </div>
          )}

          {/* Footer */}
          <p className="text-center text-xs text-gray-400 pt-2">
            ShopLedGer — দোকান হিসাব ব্যবস্থা
          </p>
        </div>

        {/* Action Buttons */}
        <div className="px-5 pb-5 pt-2 space-y-2 border-t border-gray-100">
          <button
            onClick={handleDownloadPdf}
            disabled={busy}
            className="w-full bg-teal-700 hover:bg-teal-800 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? <Loader2 className="animate-spin" size={18} /> : <FileDown size={18} />}
            PDF ডাউনলোড
          </button>
          <div className="flex gap-3">
            <button
              onClick={handleWhatsAppShare}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
            >
              <Share2 size={18} />
              WhatsApp
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
            >
              <Printer size={18} />
              প্রিন্ট
            </button>
          </div>
          {message && <p className="text-xs text-center text-gray-600">{message}</p>}
        </div>
      </div>
    </div>
  )
}
