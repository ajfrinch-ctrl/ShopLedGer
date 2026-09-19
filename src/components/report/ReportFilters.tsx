import { toDateKey } from '../../lib/profitLoss'
import {
  PAYMENT_METHODS,
  TX_TYPES,
  type ReportFilterSpec,
  type ReportOptions,
} from '../../lib/reports/core'

export interface Filters {
  from: string
  to: string
  month: string
  productId: string
  customerId: string
  supplier: string
  category: string
  paymentType: '' | 'নগদ' | 'বাকি'
  method: string
  expenseKind: '' | 'shop' | 'owner'
  txType: string
  search: string
}

const shift = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toDateKey(d)
}

const monthStart = () => toDateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const lastMonthRange = () => {
  const now = new Date()
  return {
    from: toDateKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    to: toDateKey(new Date(now.getFullYear(), now.getMonth(), 0)),
  }
}

/** রিপোর্টের ধরন অনুযায়ী ডিফল্ট ফিল্টার তৈরি করে */
export function defaultFilters(spec: ReportFilterSpec, today: string, month: string): Filters {
  return {
    from: spec.dateRange === 'optional' || spec.asOfDate ? '' : today,
    to: spec.singleDate ? today : spec.month ? '' : today,
    month,
    productId: '',
    customerId: '',
    supplier: '',
    category: '',
    paymentType: '',
    method: '',
    expenseKind: '',
    txType: '',
    search: '',
  }
}

export default function ReportFilters({
  spec,
  filters,
  setFilters,
  options,
  isOwner,
  branchId,
  setBranchId,
  branches,
}: {
  spec: ReportFilterSpec
  filters: Filters
  setFilters: (patch: Partial<Filters>) => void
  options: ReportOptions
  isOwner: boolean
  branchId: string
  setBranchId: (v: string) => void
  branches: { id: string; name: string }[]
}) {
  const select = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    items: { value: string; label: string }[],
    allLabel: string,
  ) => (
    <label className="block text-xs text-gray-600" key={label}>
      {label}
      <select className="input-field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {items.map((i) => (
          <option key={i.value} value={i.value}>
            {i.label}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="card space-y-3" data-no-print>
      <p className="text-xs font-semibold text-gray-500">ফিল্টার নির্বাচন করুন</p>

      {(spec.singleDate || spec.asOfDate) && (
        <label className="block text-xs text-gray-600">
          {spec.asOfDate ? 'তারিখ পর্যন্ত' : 'তারিখ'}
          <input
            type="date"
            className="input-field"
            value={filters.to || filters.from}
            onChange={(e) => setFilters({ from: spec.asOfDate ? '' : e.target.value, to: e.target.value })}
          />
        </label>
      )}

      {spec.month && (
        <label className="block text-xs text-gray-600">
          মাস নির্বাচন করুন
          <input type="month" className="input-field" value={filters.month} onChange={(e) => setFilters({ month: e.target.value })} />
        </label>
      )}

      {spec.dateRange && !spec.singleDate && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-600">
              তারিখ থেকে {spec.dateRange === 'optional' && <span className="text-gray-400">(খালি = শুরু)</span>}
              <input type="date" className="input-field" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilters({ from: e.target.value })} />
            </label>
            <label className="text-xs text-gray-600">
              তারিখ পর্যন্ত
              <input type="date" className="input-field" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilters({ to: e.target.value })} />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              ['আজ', { from: toDateKey(new Date()), to: toDateKey(new Date()) }],
              ['গত ৭ দিন', { from: shift(-6), to: shift(0) }],
              ['গত ৩০ দিন', { from: shift(-29), to: shift(0) }],
              ['এই মাস', { from: monthStart(), to: shift(0) }],
              ['গত মাস', lastMonthRange()],
              ...(spec.dateRange === 'optional' ? [['শুরু থেকে', { from: '', to: shift(0) }]] : []),
            ].map(([label, r]) => (
              <button
                key={label as string}
                type="button"
                className="text-[11px] px-2.5 py-1.5 rounded-full border border-gray-200 bg-white text-gray-600 active:scale-95"
                onClick={() => setFilters(r as { from: string; to: string })}
              >
                {label as string}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        {spec.product &&
          select('পণ্য', filters.productId, (v) => setFilters({ productId: v }), options.products.map((p) => ({ value: p.id, label: p.name })), 'সব পণ্য')}
        {spec.customer &&
          select('ক্রেতা', filters.customerId, (v) => setFilters({ customerId: v }), options.customers.map((c) => ({ value: c.id, label: c.name })), 'সব ক্রেতা')}
        {spec.supplier &&
          select('সাপ্লায়ার', filters.supplier, (v) => setFilters({ supplier: v }), options.suppliers.map((s) => ({ value: s, label: s })), 'সব সাপ্লায়ার')}
        {spec.category &&
          select('ক্যাটাগরি', filters.category, (v) => setFilters({ category: v }), (spec.expenseKind ? options.expenseCategories : options.categories).map((c) => ({ value: c, label: c })), 'সব ক্যাটাগরি')}
        {spec.paymentType &&
          select(
            'নগদ / বাকি',
            filters.paymentType,
            (v) => setFilters({ paymentType: v as Filters['paymentType'] }),
            [
              { value: 'নগদ', label: 'নগদ' },
              { value: 'বাকি', label: 'বাকি' },
            ],
            'সব পেমেন্ট',
          )}
        {spec.method &&
          select('পেমেন্ট পদ্ধতি', filters.method, (v) => setFilters({ method: v }), (options.methods.length ? options.methods : [...PAYMENT_METHODS]).map((m) => ({ value: m, label: m })), 'সব পদ্ধতি')}
        {spec.expenseKind &&
          select(
            'খরচের ধরন',
            filters.expenseKind,
            (v) => setFilters({ expenseKind: v as Filters['expenseKind'] }),
            [
              { value: 'shop', label: 'দোকানের খরচ' },
              { value: 'owner', label: 'মালিকের টাকা তোলা' },
            ],
            'সব ধরন',
          )}
        {spec.txType &&
          select('লেনদেনের ধরন', filters.txType, (v) => setFilters({ txType: v }), TX_TYPES.map((t) => ({ value: t, label: t })), 'সব ধরন')}
        {isOwner && branches.length > 0 &&
          select('শাখা', branchId, setBranchId, branches.map((b) => ({ value: b.id, label: b.name })), 'সব শাখা')}
      </div>

      {spec.search && (
        <label className="block text-xs text-gray-600">
          সার্চ (পণ্য, ক্রেতা, সাপ্লায়ার…)
          <input
            type="text"
            className="input-field"
            placeholder="যেমন: সয়াবিন / করিম"
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
          />
        </label>
      )}
    </div>
  )
}
