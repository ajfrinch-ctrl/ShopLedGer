import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { AlertTriangle, Boxes, CalendarDays, CalendarRange, ChevronRight, ClipboardList, FileSearch, FileText, Package, Receipt, ShoppingBag, TrendingUp, Users, Wallet, X } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useReportData } from '../lib/reports/useReportData'
import { REPORT_CATALOG, bnNum, reportDefinition, reportShareText, reportsForRole, validateReportInput,
  type ReportDocument, type ReportKind } from '../lib/reports/core'
import { buildReport } from '../lib/reports/builders'
import { sheetFileName } from '../lib/reports/pdf'
import { roleLabel, staffBranchIds } from '../lib/roles'
import { orgPadOf, padHasDetails } from '../lib/orgPad'
import { PadEmptyHint } from '../components/org/PadHeader'
import ReportFilters, { defaultFilters, type Filters } from '../components/report/ReportFilters'
import ReportPreview from '../components/report/ReportPreview'
import ReportPreviewModal from '../components/report/ReportPreviewModal'
import ReportSheet from '../components/report/ReportSheet'
import { useReportDialog } from '../components/report/useReportDialog'

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
  !!value && REPORT_CATALOG.some(r => r.kind === value)

export default function Reports() {
  const params = useParams<{ kind?: string }>()
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const kind = isReportKind(params.kind) ? params.kind : null
  const visible = reportsForRole(user?.role)
  const allowed = kind && visible.some(d => d.kind === kind)
  if (!user || user.role === 'customer') return <p className="p-6">এই রিপোর্ট শুধু মালিক ও কর্মচারীর জন্য।</p>
  const close = () => navigate('/reports', { replace: true })
  return (
    <div className="pb-28">
      <div className="bg-gradient-to-r from-teal-700 to-emerald-700 text-white px-4 pt-4 pb-6">
        <h1 className="text-lg font-bold">রিপোর্ট সেন্টার</h1>
        <p className="text-teal-100 text-xs mt-1">বিষয় বাছুন → সময়সীমা দিন → স্টেটমেন্ট দেখুন</p>
      </div>
      <div className="px-4 -mt-3 space-y-4">
        {user.role !== 'owner' && !staffBranchIds(user).length && (
          <div className="card bg-amber-50 text-amber-900 text-xs flex gap-2"><AlertTriangle size={16} />আপনার অ্যাকাউন্টে শাখা নেই। মালিককে জানান।</div>
        )}
        {params.kind && (!kind || !allowed) && (
          <div className="card text-sm text-amber-900">{kind ? 'এই রিপোর্টটি আপনার রোলের জন্য প্রযোজ্য নয়।' : 'রিপোর্টটি পাওয়া যায়নি।'} <Link to="/reports" className="underline">ফিরে যান</Link></div>
        )}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-2"><FileText size={16} />বিষয়ভিত্তিক স্টেটমেন্ট ({bnNum(visible.length)}টি)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {visible.map(def => {
              const Icon = CARD_ICONS[def.kind]
              return <button key={def.kind} type="button" aria-haspopup="dialog" aria-expanded={kind === def.kind}
                onClick={() => navigate(`/reports/${def.kind}`)}
                className={`card flex items-center gap-3 text-left transition-colors hover:border-teal-400 focus-visible:ring-2 focus-visible:ring-teal-600 ${kind === def.kind ? 'border-teal-500' : ''}`}>
                <span className={`p-2.5 rounded-xl shrink-0 ${CARD_TONES[def.kind]}`}><Icon size={20} /></span>
                <span className="flex-1 min-w-0"><span className="block font-medium text-sm text-gray-800">{def.label}</span><span className="block text-[11px] text-gray-500">{def.desc}</span></span>
                <ChevronRight size={16} className="text-gray-400" />
              </button>
            })}
          </div>
        </section>
        <p className="text-xs text-center text-gray-500">কার্ডে ট্যাপ করলেই এখানেই সময়সীমা ও প্রাসঙ্গিক ফিল্টার খুলবে।</p>
      </div>
      {kind && allowed && <ReportSession key={kind} kind={kind} onClose={close} />}
    </div>
  )
}

/** A keyed session prevents another report's filters or preview leaking into a new selection. */
function ReportSession({ kind, onClose }: { kind: ReportKind; onClose: () => void }) {
  const opener = useRef(document.activeElement as HTMLElement | null)
  useEffect(() => () => { if (opener.current?.isConnected) opener.current.focus({ preventScroll: true }) }, [])
  const [branchId, setBranchId] = useState('')
  const { user, isOwner, scope, data, today, month, options } = useReportData(branchId || undefined)
  const spec = reportDefinition(kind).filters
  const [filters, setFilters] = useState<Filters>(() => defaultFilters(spec, today, month))
  const [snapshot, setSnapshot] = useState<ReportDocument | null>(null)
  const [buildError, setBuildError] = useState('')
  const sheetRef = useRef<HTMLDivElement>(null)
  const error = validateReportInput(spec, filters)
  const myBranches = staffBranchIds(user)
  const activeBranch = isOwner ? branchId : myBranches.length === 1 ? myBranches[0] : ''
  const branch = data?.branches.find(b => b.id === activeBranch)
    || data?.branches.find(b => isOwner || myBranches.includes(b.id))
  const pad = orgPadOf(branch)
  const subtitle = activeBranch ? branch?.name : isOwner ? 'সব শাখা' : `${roleLabel(user?.role)} • ${bnNum(myBranches.length)}টি শাখা`
  const fileKey = useMemo(() => kind === 'monthlyProfit' ? filters.month : spec.singleDate || spec.asOfDate
    ? filters.to : `${filters.from || 'start'}_${filters.to}`, [kind, spec, filters])
  const filename = sheetFileName(`${kind}-report`, fileKey)
  const generate = () => {
    if (!data || error) return
    try { setSnapshot(buildReport(kind, { ...filters, scope }, data)); setBuildError('') }
    catch { setBuildError('রিপোর্ট তৈরি করা যায়নি। ফিল্টার যাচাই করে আবার চেষ্টা করুন।') }
  }
  return <>
    {!snapshot && <FilterDialog title={reportDefinition(kind).label} onClose={onClose}>
      {!data || !options ? <p role="status" className="p-4 text-sm">তথ্য লোড হচ্ছে…</p> : <>
        <ReportFilters spec={spec} filters={filters} setFilters={patch => setFilters(f => ({ ...f, ...patch }))}
          options={options} isOwner={isOwner} branchId={branchId} branches={data.branches}
          setBranchId={id => { setBranchId(id); setFilters(f => ({ ...defaultFilters(spec, today, month), from: f.from, to: f.to, month: f.month })) }} />
        {!padHasDetails(pad) && <PadEmptyHint />}
        {(error || buildError) && <p role="alert" className="text-sm text-red-700">{error || buildError}</p>}
        <button type="button" disabled={!!error} onClick={generate} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
          <FileSearch size={16} />স্টেটমেন্ট দেখুন
        </button>
        <p className="text-[11px] text-center text-gray-500">প্রথমে প্রিভিউ দেখুন। ডাউনলোড বা শেয়ার হবে কেবল আপনার নির্দেশে।</p>
      </>}
    </FilterDialog>}
    {snapshot && <>
      <div aria-hidden data-sheet style={{ position: 'fixed', top: 0, left: 0, zIndex: -1, pointerEvents: 'none' }}>
        <ReportSheet doc={snapshot} businessName={pad.name} subtitle={subtitle} pad={pad} sheetRef={sheetRef} />
      </div>
      <ReportPreviewModal title={snapshot.title} filename={filename} document={snapshot}
        pad={pad} businessName={pad.name} subtitle={subtitle}
        shareText={reportShareText(snapshot, pad.name, subtitle)}
        captureRef={sheetRef} onClose={() => setSnapshot(null)} hint="প্রিভিউ বন্ধ করলে আগের সময়সীমা ও ফিল্টারে ফিরে যাবেন।">
        <ReportPreview doc={snapshot} businessName={pad.name} subtitle={subtitle} pad={pad} />
      </ReportPreviewModal>
    </>}
  </>
}

function FilterDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useReportDialog(ref, onClose)
  return createPortal(<div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-3" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="report-filter-title" data-report-filters
      className="bg-gray-50 rounded-2xl shadow-xl w-full max-w-xl max-h-[90dvh] flex flex-col outline-none">
      <div className="p-4 border-b flex items-center gap-3 shrink-0">
        <div className="flex-1"><h2 id="report-filter-title" className="font-bold text-teal-800">{title}</h2><p className="text-xs text-gray-500">সময়সীমা ও ফিল্টার নির্বাচন করুন</p></div>
        <button type="button" onClick={onClose} aria-label="ফিল্টার বন্ধ করুন" className="p-2 rounded-full hover:bg-gray-200"><X size={20} /></button>
      </div>
      <div className="p-4 space-y-3 overflow-y-auto overscroll-contain">{children}</div>
    </div>
  </div>, document.body)
}
