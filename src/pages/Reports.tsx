import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  CalendarDays,
  CalendarRange,
  ChevronRight,
  ClipboardList,
  FileSearch,
  FileText,
  Package,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { useReportData } from '../lib/reports/useReportData'
import {
  REPORT_CATALOG,
  bnNum,
  reportDefinition,
  reportShareText,
  type ReportDocument,
  type ReportInput,
  type ReportKind,
} from '../lib/reports/core'
import { buildReport } from '../lib/reports/builders'
import { sheetFileName } from '../lib/reports/pdf'
import { PROFIT_KINDS, reportsForRole } from '../lib/reports/core'
import { isManagerLevel, roleLabel, staffBranchIds } from '../lib/roles'
import { orgPadOf, padHasDetails } from '../lib/orgPad'
import { PadEmptyHint } from '../components/org/PadHeader'
import ReportFilters, { defaultFilters, type Filters } from '../components/report/ReportFilters'
import ReportPreview from '../components/report/ReportPreview'
import ReportPreviewModal from '../components/report/ReportPreviewModal'
import ReportSheet from '../components/report/ReportSheet'
import QuickSummary from '../components/report/QuickSummary'

const CARD_ICONS: Record<ReportKind, typeof TrendingUp> = {
  sales: TrendingUp,
  purchase: ShoppingBag,
  stock: Boxes,
  customerDue: Users,
  collection: Wallet,
  expense: Receipt,
  dailyProfit: CalendarDays,
  monthlyProfit: CalendarRange,
  product: Package,
  transaction: ClipboardList,
}

const CARD_TONES: Record<ReportKind, string> = {
  sales: 'bg-blue-50 text-blue-600',
  purchase: 'bg-purple-50 text-purple-600',
  stock: 'bg-indigo-50 text-indigo-600',
  customerDue: 'bg-orange-50 text-orange-600',
  collection: 'bg-teal-50 text-teal-600',
  expense: 'bg-red-50 text-red-600',
  dailyProfit: 'bg-emerald-50 text-emerald-600',
  monthlyProfit: 'bg-cyan-50 text-cyan-700',
  product: 'bg-amber-50 text-amber-700',
  transaction: 'bg-gray-100 text-gray-600',
}

const isReportKind = (value?: string): value is ReportKind =>
  !!value && REPORT_CATALOG.some((r) => r.kind === value)

export default function Reports() {
  const params = useParams<{ kind?: string }>()
  const navigate = useNavigate()
  const kind: ReportKind | null = isReportKind(params.kind) ? params.kind : null

  const [branchId, setBranchId] = useState('')
  const { user, isOwner, scope, data, today, month, options } = useReportData(branchId || undefined)

  const [filters, setFilters] = useState<Filters>(() => defaultFilters({}, today, month))
  /** প্রিভিউ পপ-আপ খোলা আছে কি না — আগে পুরো রিপোর্ট দেখুন, তারপর ডাউনলোড/শেয়ার */
  const [preview, setPreview] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  // রিপোর্ট বদলালে ফিল্টার ডিফল্টে ফিরে আসে (প্রতিটি রিপোর্টের নিজের ফিল্টার)
  useEffect(() => {
    if (!kind) return
    setFilters(defaultFilters(reportDefinition(kind).filters, today, month))
    setPreview(false)
    const id = window.setTimeout(
      () => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      60,
    )
    return () => window.clearTimeout(id)
  }, [kind, today, month])

  const patch = (p: Partial<Filters>) => setFilters((f) => ({ ...f, ...p }))

  const doc: ReportDocument | null = useMemo(() => {
    if (!kind || !data) return null
    const input: ReportInput = { ...filters, scope }
    return buildReport(kind, input, data)
  }, [kind, data, filters, scope])

  /**
   * ফাইল-নামের তারিখ-কী (সবসময় ইংরেজি সংখ্যায়, বাংলা তারিখ নয়)।
   * মাসিক = মাস, দৈনিক = ওই তারিখ, বাকিগুলো = থেকে_পর্যন্ত।
   */
  const fileKey = useMemo(() => {
    if (kind === 'monthlyProfit') return filters.month || month
    if (kind === 'dailyProfit') return filters.to || filters.from || today
    return `${filters.from || 'start'}_${filters.to || today}`
  }, [kind, filters.month, filters.from, filters.to, month, today])

  const fileName = sheetFileName(`${kind || 'report'}-report`, fileKey)

  const myBranches = staffBranchIds(user)
  const branchName = (id?: string) => data?.branches.find((b) => b.id === id)?.name || 'অজানা শাখা'
  const activeBranchId = isOwner ? branchId : myBranches[0]
  const branch = data?.branches.find((b) => b.id === activeBranchId) || data?.branches[0]
  /** প্যাড — মালিক "শাখা ও ব্যবস্থাপক" থেকে যা সেট করেন (লোগো, নাম, ঠিকানা, ফোন) */
  const pad = { ...orgPadOf(branch), branchName: branchId ? branch?.name : undefined }
  const businessName = pad.name
  const subtitle = isOwner
    ? branchId
      ? branchName(branchId)
      : 'সব শাখা'
    : myBranches.length === 1
      ? branchName(myBranches[0])
      : myBranches.length > 1
        ? `${roleLabel(user?.role)} • ${bnNum(myBranches.length)}টি শাখা`
        : 'শাখা নেই'
  /** রোল অনুযায়ী রিপোর্টের তালিকা — সেলস ম্যান ক্রয়/খরচ/লেনদেন/লাভ দেখে না */
  const visibleCatalog = useMemo(() => reportsForRole(user?.role), [user?.role])

  if (!user || user.role === 'customer') {
    return <p className="p-6">এই রিপোর্ট শুধু মালিক ও কর্মচারীর জন্য।</p>
  }

  const noBranchStaff = user.role !== 'owner' && !myBranches.length

  /** লাভের রিপোর্ট ব্যবস্থাপক-স্তরের — সেলস ম্যান সরাসরি লিংকে গেলেও আটকানো */
  if (kind && !isManagerLevel(user.role) && PROFIT_KINDS.includes(kind)) {
    return (
      <div className="pb-28">
        <div className="bg-gradient-to-r from-teal-700 to-emerald-700 text-white px-4 pt-4 pb-6">
          <h1 className="text-lg font-bold">রিপোর্ট সেন্টার</h1>
        </div>
        <div className="px-4 -mt-3">
          <div className="card border-amber-200 bg-amber-50 text-sm text-amber-900">
            লাভের রিপোর্ট শুধু মালিক ও শাখা ব্যবস্থাপক দেখতে পারবেন। অন্য রিপোর্ট দেখতে{' '}
            <Link to="/reports" className="underline font-semibold">
              রিপোর্ট সেন্টারে
            </Link>{' '}
            ফিরে যান।
          </div>
        </div>
      </div>
    )
  }

  /** সেলস ম্যানের জন্য বন্ধ রিপোর্ট (ক্রয়/খরচ/লেনদেন) */
  if (kind && user.role === 'salesman' && !visibleCatalog.some((d) => d.kind === kind)) {
    return (
      <div className="pb-28">
        <div className="bg-gradient-to-r from-teal-700 to-emerald-700 text-white px-4 pt-4 pb-6">
          <h1 className="text-lg font-bold">রিপোর্ট সেন্টার</h1>
        </div>
        <div className="px-4 -mt-3">
          <div className="card border-amber-200 bg-amber-50 text-sm text-amber-900">
            এই রিপোর্টটি আপনার রোলের জন্য প্রযোজ্য নয়।{' '}
            <Link to="/reports" className="underline font-semibold">
              রিপোর্ট সেন্টারে
            </Link>{' '}
            ফিরে যান।
          </div>
        </div>
      </div>
    )
  }


  return (
    <div className="pb-28">
      <div className="bg-gradient-to-r from-teal-700 to-emerald-700 text-white px-4 pt-4 pb-6">
        <h1 className="text-lg font-bold">রিপোর্ট সেন্টার</h1>
        <p className="text-teal-100 text-xs mt-0.5">
          ফিল্টার → রিপোর্ট তৈরি → প্রিভিউ পপ-আপ → ডাউনলোড/শেয়ার
        </p>
      </div>

      <div className="px-4 -mt-3 space-y-4">
        {noBranchStaff && (
          <div className="card border-amber-200 bg-amber-50 flex items-start gap-2 text-xs text-amber-900">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <p>আপনার অ্যাকাউন্টে কোনো শাখা নির্ধারিত নেই, তাই রিপোর্ট ফাঁকা দেখাবে। মালিককে জানান।</p>
          </div>
        )}

        {/* পুরোনো দ্রুত সারসংক্ষেপ — চাপা অবস্থায় উপরে */}
        <details className="card">
          <summary className="cursor-pointer text-sm font-semibold text-teal-700 flex items-center gap-2">
            <BarChart3 size={16} /> দ্রুত সারসংক্ষেপ ও শেয়ার (আগের ৩টি ট্যাব)
          </summary>
          <div className="pt-3">
            <QuickSummary />
          </div>
        </details>

        {/* রিপোর্ট কার্ড মেনু */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <FileText size={16} className="text-teal-600" /> বিস্তারিত রিপোর্ট ({bnNum(visibleCatalog.length)}টি)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {visibleCatalog.map((def) => {
              const Icon = CARD_ICONS[def.kind]
              const active = kind === def.kind
              return (
                <button
                  key={def.kind}
                  type="button"
                  onClick={() => navigate(active ? '/reports' : `/reports/${def.kind}`)}
                  className={`card flex items-center gap-3 text-left active:scale-[0.99] transition-all ${
                    active ? 'border-teal-500 ring-1 ring-teal-500' : ''
                  }`}
                >
                  <div className={`p-2.5 rounded-xl shrink-0 ${CARD_TONES[def.kind]}`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-800">{def.label}</p>
                    <p className="text-[11px] text-gray-500 line-clamp-2">{def.desc}</p>
                  </div>
                  <ChevronRight size={16} className={`text-gray-300 ${active ? 'rotate-90 text-teal-500' : ''}`} />
                </button>
              )
            })}
          </div>
        </section>

        {/* নির্বাচিত রিপোর্ট: ফিল্টার → রিপোর্ট → প্রিভিউ → PDF */}
        {kind && (
          <section ref={panelRef} className="space-y-3 scroll-mt-4">
            <h2 className="text-sm font-semibold text-gray-700">
              {reportDefinition(kind).label}
            </h2>

            {!data || !options ? (
              <p className="text-sm text-gray-500">রিপোর্ট তৈরি হচ্ছে…</p>
            ) : (
              <>
                {!padHasDetails(pad) && <PadEmptyHint className="mb-2" />}
                <ReportFilters
                  spec={reportDefinition(kind).filters}
                  filters={filters}
                  setFilters={patch}
                  options={options}
                  isOwner={isOwner}
                  branchId={branchId}
                  setBranchId={setBranchId}
                  branches={data.branches}
                />
                {doc && (
                  <div className="card space-y-3">
                    <div className="flex items-start gap-2">
                      <FileSearch size={18} className="text-teal-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-800">{doc.title}</p>
                        <p className="text-[11px] text-gray-500 break-words">
                          {businessName}
                          {subtitle ? ` • ${subtitle}` : ''} • সময়: {doc.period}
                        </p>
                      </div>
                      <span className="text-[10px] px-2 py-1 rounded-full bg-teal-50 text-teal-700 whitespace-nowrap">
                        রিপোর্ট প্রস্তুত
                      </span>
                    </div>

                    {/* সারসংক্ষেপ — পপ-আপে পুরো রিপোর্টের আগাম আভাস */}
                    <div className="grid grid-cols-2 gap-2">
                      {doc.summary.slice(0, 4).map((s) => (
                        <div key={s.label} className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                          <p className="text-[11px] text-gray-500">{s.label}</p>
                          <p className="text-sm font-bold text-gray-800 break-words">{s.value}</p>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setPreview(true)}
                      className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                      <FileSearch size={16} /> রিপোর্ট দেখুন — প্রিভিউ, তারপর ডাউনলোড/শেয়ার
                    </button>

                    <p className="text-[11px] text-gray-500 text-center">
                      {bnNum(doc.rows.length)}টি সারি প্রস্তুত। পপ-আপে সম্পূর্ণ রিপোর্ট (প্যাডের লোগো, নাম,
                      ঠিকানা সহ) দেখে তারপর দরকার হলে ডাউনলোড বা শেয়ার করবেন — অকারণে ডাউনলোড হবে না।
                    </p>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {!kind && (
          <p className="text-xs text-center text-gray-500">
            উপরের কার্ডে চাপ দিন — প্রতিটি রিপোর্টের নিজস্ব ফিল্টার, প্রিভিউ পপ-আপ ও আলাদা A4 PDF হবে।
            {isOwner && (
              <>
                {' '}
                লাভ-ক্ষতির বিস্তারিত হিসাব?{' '}
                <Link to="/profit-loss" className="text-teal-700 underline">
                  লাভ-ক্ষতি পেজ
                </Link>
              </>
            )}
          </p>
        )}
      </div>

      {/*
        PDF-এর আসল A4 শিট — ভিউপোর্টের ভিতরেই (top-left) থাকে, কিন্তু
        z-index:-1 হওয়ায় অ্যাপের অস্বচ্ছ ব্যাকগ্রাউন্ডের পেছনে পড়ে অদৃশ্য থাকে।
        (অফস্ক্রিন রাখলে html2canvas প্রায়ই ফাঁকা/কাটা ছবি দেয়)
      */}
      {doc && (
        <div
          aria-hidden
          data-sheet
          style={{ position: 'fixed', top: 0, left: 0, zIndex: -1, pointerEvents: 'none' }}
        >
          <ReportSheet
            doc={doc}
            businessName={businessName}
            subtitle={subtitle}
            pad={pad}
            sheetRef={sheetRef}
          />
        </div>
      )}

      {/* রিপোর্ট প্রিভিউ পপ-আপ — এখান থেকেই ডাউনলোড বা শেয়ার */}
      {doc && preview && (
        <ReportPreviewModal
          title={`${reportDefinition(kind!).label} — প্রিভিউ`}
          filename={fileName}
          shareText={reportShareText(doc, businessName, subtitle)}
          captureRef={sheetRef}
          onClose={() => setPreview(false)}
          hint={`${bnNum(doc.rows.length)}টি সারি • A4 প্যাডে লোগো, প্রতিষ্ঠানের নাম, ঠিকানা, ফোন ও স্বাক্ষরের জায়গা আছে।`}
        >
          <ReportPreview doc={doc} businessName={businessName} subtitle={subtitle} pad={pad} />
        </ReportPreviewModal>
      )}
    </div>
  )
}
