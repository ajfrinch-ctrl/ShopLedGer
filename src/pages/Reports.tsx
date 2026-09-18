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
import { downloadSheetPdf, reportHtml, shareSheetPdf, sheetFileName } from '../lib/reports/pdf'
import ReportFilters, { defaultFilters, type Filters } from '../components/report/ReportFilters'
import ReportPreview, { type PreviewAction } from '../components/report/ReportPreview'
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
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<PreviewAction | null>(null)
  const [printPreview, setPrintPreview] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  // রিপোর্ট বদলালে ফিল্টার ডিফল্টে ফিরে আসে (প্রতিটি রিপোর্টের নিজের ফিল্টার)
  useEffect(() => {
    if (!kind) return
    setFilters(defaultFilters(reportDefinition(kind).filters, today, month))
    setMessage('')
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

  const branchName = (id?: string) => data?.branches.find((b) => b.id === id)?.name || 'অজানা শাখা'
  const activeBranchId = isOwner ? branchId : user?.branch_id
  const branch = data?.branches.find((b) => b.id === activeBranchId) || data?.branches[0]
  const businessName = branch?.organization?.trim() || 'ShopLedGer'
  const subtitle = isOwner ? (branchId ? branchName(branchId) : 'সব শাখা') : branchName(user?.branch_id)

  if (!user || user.role === 'customer') {
    return <p className="p-6">এই রিপোর্ট শুধু মালিক ও কর্মচারীর জন্য।</p>
  }

  const noBranchStaff = user.role === 'staff' && !user.branch_id


  /** ফিল্টার → রিপোর্ট তৈরি → প্রিভিউ → এই রিপোর্টের নিজস্ব A4 PDF */
  async function downloadPdf() {
    if (!doc || !sheetRef.current) return
    setBusy('pdf')
    setMessage('')
    try {
      await downloadSheetPdf(sheetRef.current, { filename: fileName, footerLeft: businessName })
      setMessage('PDF ডাউনলোড হয়েছে — ফাইলটি ফোন/কম্পিউটারে সেভ হয়েছে।')
    } catch {
      setMessage('PDF তৈরি হয়নি, আবার চেষ্টা করুন।')
    } finally {
      setBusy(null)
    }
  }

  function printReport() {
    if (!doc || !kind) return
    const html = reportHtml({ report: doc, businessName, subtitle, autoPrint: true })
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      setMessage('প্রিন্ট উইন্ডো খোলা হয়েছে।')
    } else {
      // পপ-আপ আটকে গেলে অ্যাপের ভিতরেই প্রিন্ট প্রিভিউ
      setPrintPreview(reportHtml({ report: doc, businessName, subtitle, autoPrint: false }))
      setMessage('পপ-আপ ব্লক করা আছে — অ্যাপের ভিতরে প্রিন্ট প্রিভিউ খোলা হয়েছে, সেখান থেকে প্রিন্ট দিন।')
    }
  }

  async function shareWhatsApp() {
    if (!doc || !sheetRef.current) return
    setBusy('whatsapp')
    setMessage('')
    try {
      const result = await shareSheetPdf(sheetRef.current, {
        filename: fileName,
        footerLeft: businessName,
        shareText: reportShareText(doc, businessName, subtitle),
      })
      setMessage(
        result === 'shared'
          ? 'PDF শেয়ার শিটে পাঠানো হয়েছে — WhatsApp বেছে নিন।'
          : result === 'cancelled'
            ? ''
            : 'PDF ডাউনলোড হয়েছে ও WhatsApp টেক্সট খোলা হয়েছে — ফাইলটি সংযুক্ত করুন।',
      )
    } catch {
      setMessage('শেয়ার করা যায়নি, আবার চেষ্টা করুন।')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="pb-28">
      <div className="bg-gradient-to-r from-teal-700 to-emerald-700 text-white px-4 pt-4 pb-6">
        <h1 className="text-lg font-bold">রিপোর্ট সেন্টার</h1>
        <p className="text-teal-100 text-xs mt-0.5">
          ফিল্টার → রিপোর্ট তৈরি → প্রিভিউ → আলাদা A4 PDF
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
            <FileText size={16} className="text-teal-600" /> বিস্তারিত রিপোর্ট ({bnNum(REPORT_CATALOG.length)}টি)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {REPORT_CATALOG.map((def) => {
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
                  <ReportPreview
                    doc={doc}
                    businessName={businessName}
                    subtitle={subtitle}
                    busy={busy}
                    onPdf={downloadPdf}
                    onPrint={printReport}
                    onWhatsApp={shareWhatsApp}
                  />
                )}
                {message && (
                  <p className="text-xs text-center text-gray-600 bg-gray-100 rounded-lg p-2" data-no-print>
                    {message}
                  </p>
                )}
              </>
            )}
          </section>
        )}

        {!kind && (
          <p className="text-xs text-center text-gray-500">
            উপরের কার্ডে চাপ দিন — প্রতিটি রিপোর্টের নিজস্ব ফিল্টার, প্রিভিউ ও আলাদা A4 PDF হবে।
            লাভ-ক্ষতির বিস্তারিত হিসাব?{' '}
            <Link to="/profit-loss" className="text-teal-700 underline">
              লাভ-ক্ষতি পেজ
            </Link>
          </p>
        )}
      </div>

      {/*
        PDF/প্রিন্টের আসল A4 শিট — ভিউপোর্টের ভিতরেই (top-left) থাকে, কিন্তু
        z-index:-1 হওয়ায় অ্যাপের অস্বচ্ছ ব্যাকগ্রাউন্ডের পেছনে পড়ে অদৃশ্য থাকে।
        (অফস্ক্রিন রাখলে html2canvas প্রায়ই ফাঁকা/কাটা ছবি দেয়)
      */}
      {doc && (
        <div
          aria-hidden
          data-sheet
          style={{ position: 'fixed', top: 0, left: 0, zIndex: -1, pointerEvents: 'none' }}
        >
          <ReportSheet doc={doc} businessName={businessName} subtitle={subtitle} sheetRef={sheetRef} />
        </div>
      )}

      {/* পপ-আপ আটকে গেলে অ্যাপের ভিতরের প্রিন্ট প্রিভিউ */}
      {printPreview && (
        <div className="fixed inset-0 z-50 bg-black/60 p-2 flex flex-col gap-2">
          <div className="flex justify-end">
            <button type="button" className="btn-secondary" onClick={() => setPrintPreview(null)}>
              বন্ধ করুন
            </button>
          </div>
          <iframe
            title="রিপোর্ট প্রিন্ট প্রিভিউ"
            srcDoc={printPreview}
            className="flex-1 w-full bg-white rounded-lg"
          />
        </div>
      )}
    </div>
  )
}
