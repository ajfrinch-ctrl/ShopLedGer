import { Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { Users, ClipboardList, ShoppingBag, Receipt, TrendingUp, Package, Wallet, Building2, ChevronRight, LogOut, BarChart3 } from 'lucide-react'

export default function More() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const items = [
    { to: '/customers', icon: Users, label: 'ক্রেতা', desc: 'তালিকা, বাকি ও কেনাকাটার ইতিহাস', color: 'bg-teal-50 text-teal-600' },
    { to: '/orders', icon: ClipboardList, label: 'ক্রেতার অর্ডার', desc: 'অর্ডার গ্রহণ ও ডেলিভারি → বিক্রি', color: 'bg-yellow-50 text-yellow-700' },
    { to: '/purchases', icon: ShoppingBag, label: 'ক্রয় এন্ট্রি', desc: 'সাপ্লাইয়ার চালান', color: 'bg-purple-50 text-purple-600' },
    { to: '/expenses', icon: Receipt, label: 'খরচ এন্ট্রি', desc: 'দোকানের খরচ ও মালিকের টাকা তোলা', color: 'bg-red-50 text-red-600' },
    { to: '/reports', icon: BarChart3, label: 'রিপোর্ট সেন্টার', desc: 'বিক্রি, বাকি আদায়, বাকি তালিকা • PDF/WhatsApp', color: 'bg-teal-50 text-teal-600' },
    { to: '/profit-loss', icon: TrendingUp, label: 'লাভ-ক্ষতি রিপোর্ট', desc: 'দৈনিক, মাসিক, কাস্টম • PDF', color: 'bg-green-50 text-green-600' },
    { to: '/stock', icon: Package, label: 'স্টক', desc: 'পণ্য, সমন্বয়, লো-স্টক', color: 'bg-blue-50 text-blue-600' },
    { to: '/collections?type=supplier', icon: Wallet, label: 'সাপ্লায়ারের বাকি', desc: 'পরিশোধ ও লেজার', color: 'bg-orange-50 text-orange-600' },
    ...(user?.role === 'owner'
      ? [{ to: '/branch-pads', icon: Building2, label: 'শাখা ও প্যাড', desc: 'শাখার নাম, ঠিকানা, রসিদের প্যাড', color: 'bg-gray-100 text-gray-600' }]
      : []),
  ]

  return (
    <div className="pb-24">
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-10">
        <h2 className="text-lg font-semibold text-gray-800">আরও</h2>
      </div>
      <div className="p-4 space-y-2">
        {items.map((it) => (
          <Link key={it.to} to={it.to} className="card flex items-center gap-3 active:scale-[0.99]">
            <div className={`p-2.5 rounded-xl ${it.color}`}>
              <it.icon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-gray-800">{it.label}</p>
              <p className="text-xs text-gray-500 truncate">{it.desc}</p>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </Link>
        ))}
        <button onClick={logout} className="card w-full flex items-center gap-3 text-left mt-4">
          <div className="p-2.5 rounded-xl bg-gray-100 text-gray-600">
            <LogOut size={20} />
          </div>
          <p className="font-medium text-sm text-gray-800">লগআউট</p>
        </button>
      </div>
    </div>
  )
}
