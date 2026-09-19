import { Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { isManagerLevel } from '../lib/roles'
import { Users, ClipboardList, ShoppingBag, Receipt, TrendingUp, Package, Wallet, Building2, ChevronRight, LogOut, BarChart3, UserCircle2, UserPlus, DatabaseBackup } from 'lucide-react'

export default function More() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const items = [
    { to: '/customers', icon: Users, label: 'ক্রেতা', desc: 'তালিকা, বাকি ও কেনাকাটার ইতিহাস', color: 'bg-teal-50 text-teal-600' },
    { to: '/orders', icon: ClipboardList, label: 'ক্রেতার অর্ডার', desc: 'অর্ডার গ্রহণ ও ডেলিভারি → বিক্রি', color: 'bg-yellow-50 text-yellow-700' },
    ...(isManagerLevel(user?.role)
      ? [
          { to: '/purchases', icon: ShoppingBag, label: 'ক্রয় এন্ট্রি', desc: 'সাপ্লাইয়ার চালান', color: 'bg-purple-50 text-purple-600' },
          { to: '/expenses', icon: Receipt, label: 'খরচ এন্ট্রি', desc: 'দোকানের খরচ ও মালিকের টাকা তোলা', color: 'bg-red-50 text-red-600' },
        ]
      : []),
    { to: '/reports', icon: BarChart3, label: 'রিপোর্ট সেন্টার', desc: 'বিস্তারিত রিপোর্ট • প্রতিটির আলাদা A4 PDF', color: 'bg-teal-50 text-teal-600' },
    ...(isManagerLevel(user?.role)
      ? [{ to: '/profit-loss', icon: TrendingUp, label: 'লাভ-ক্ষতি রিপোর্ট', desc: 'দৈনিক, মাসিক, কাস্টম • PDF (মালিক ও ব্যবস্থাপক)', color: 'bg-green-50 text-green-600' }]
      : []),
    { to: '/stock', icon: Package, label: 'স্টক', desc: 'পণ্য, সমন্বয়, লো-স্টক', color: 'bg-blue-50 text-blue-600' },
    ...(isManagerLevel(user?.role) ? [{ to: '/collections?type=supplier', icon: Wallet, label: 'সাপ্লায়ারকে দেনা', desc: 'পণ্য ক্রয়ের বাকি ও টাকা পরিশোধ', color: 'bg-orange-50 text-orange-600' }] : []),
    { to: '/profile', icon: UserCircle2, label: 'আমার প্রোফাইল', desc: 'নাম, মোবাইল ও পাসওয়ার্ড পরিবর্তন', color: 'bg-cyan-50 text-cyan-700' },
    ...(user?.role === 'manager'
      ? [{ to: '/salesmen', icon: UserPlus, label: 'সেলস ম্যান আইডি', desc: 'নিজের শাখার সেলস ম্যানের আইডি খোলা ও পাসওয়ার্ড', color: 'bg-indigo-50 text-indigo-700' }]
      : []),
    ...(user?.role === 'owner'
      ? [
          { to: '/branch-pads', icon: Building2, label: 'শাখা ও ব্যবস্থাপক', desc: 'শাখা, রসিদ প্যাড, ব্যবস্থাপক ও সেলস ম্যানের আইডি', color: 'bg-teal-50 text-teal-700' },
          { to: '/backup', icon: DatabaseBackup, label: 'ডেটা ব্যাকআপ ও রিস্টোর', desc: 'ব্যাকআপ ফাইল, প্রতিদিনের অটো ব্যাকআপ ও পুরো হিসাব ফেরানো', color: 'bg-rose-50 text-rose-600' },
        ]
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
