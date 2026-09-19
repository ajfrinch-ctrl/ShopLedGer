import { Loader2 } from 'lucide-react'

/**
 * ফাইল তৈরি হওয়ার সময় স্ক্রিন ঢেকে রাখে (native PDF বা শেয়ারের ছবি)।
 *
 * PDF এখন সরাসরি native টেক্সট হিসেবে আঁকা হয় — কোনো DOM capture বা ছবি বসানো
 * নেই, তাই ঢাকনাটি শুধু কাজ চলছে বোঝানোর জন্য।
 */
export default function ExportBusyOverlay({
  show,
  label = 'PDF তৈরি হচ্ছে…',
  hint,
}: {
  show: boolean
  label?: string
  hint?: string
}) {
  if (!show) return null
  return (
    <div
      className="fixed inset-0 z-[60] bg-white/95 flex flex-col items-center justify-center gap-3 px-6 text-center"
      data-no-print
      role="status"
    >
      <Loader2 className="animate-spin text-teal-700" size={34} />
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      <p className="text-[11px] text-gray-500">
        {hint || 'একই pass-এ সম্পূর্ণ রিপোর্ট আঁকা হচ্ছে — বড় রিপোর্টেও দ্রুত।'}
      </p>
    </div>
  )
}
