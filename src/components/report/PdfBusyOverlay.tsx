import { Loader2 } from 'lucide-react'

/**
 * PDF তৈরির সময় স্ক্রিন ঢেকে রাখে।
 *
 * কেন দরকার: PDF বানানোর আগে ক্যাপচার-এলিমেন্টটি কিছুক্ষণের জন্য A4 প্রস্থে (৭১৮px)
 * বসানো হয় — যাতে মোবাইলেও ঝকঝকে PDF আসে। ওই মুহূর্তে প্রিভিউতে যেন অদ্ভুত
 * লাফালাফি না দেখা যায়, তাই এই ঢাকনা দেওয়া হয়।
 */
export default function PdfBusyOverlay({
  show,
  label = 'PDF তৈরি হচ্ছে…',
}: {
  show: boolean
  label?: string
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
        সম্পূর্ণ রিপোর্ট ছবি হয়ে PDF-এ বসছে — বড় রিপোর্টে একটু সময় লাগতে পারে।
      </p>
    </div>
  )
}
