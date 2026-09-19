import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, ChevronRight, History, Plus, Search, Wallet, X } from 'lucide-react'
import { db, type LedgerEntry } from '../lib/db'
import { nextReceiptId, nextTransactionId, nextCustomerId } from '../lib/idGenerator'
import { inLedgerScope, ledgerRows, ledgerScopeFor, ledgerToday, money, paymentCapacity, saveLedgerEntry, supplierId, type LedgerRow, type PartyType } from '../lib/ledger'
import { debtAccounts } from '../lib/dues'
import { useAuthStore } from '../stores/authStore'
import { inUserBranch, isManagerLevel } from '../lib/roles'
import { useActiveBranchId } from '../stores/uiStore'
import { useSalesStore } from '../stores/salesStore'
import { usePurchaseStore } from '../stores/purchaseStore'
import LedgerReceipt from '../components/LedgerReceipt'
import { bnDate, bnNum } from '../lib/reports/core'
import { useReportDialog } from '../components/report/useReportDialog'

export default function Collections() {
  const user = useAuthStore(s => s.user)
  const activeBranch = useActiveBranchId()
  const sales = useSalesStore(s => s.sales)
  const purchases = usePurchaseStore(s => s.purchases)
  const data = useLiveQuery(async () => ({
    entries: await db.ledgerEntries.toArray(), customers: await db.customers.toArray(),
    branches: await db.branches.toArray(), audits: await db.ledgerAudits.toArray(), collections: await db.collections.toArray(),
  }))
  const [params, setParams] = useSearchParams()
  const type: PartyType = params.get('type') === 'supplier' ? 'supplier' : 'customer'
  const party = params.get('party') || ''
  const customer = type === 'customer'
  const permitted = !!user && user.role !== 'customer' && (customer || isManagerLevel(user.role))
  const today = ledgerToday()
  const scope = useMemo(() => ({ ...ledgerScopeFor(user), through: today }), [user, today])
  const accounts = useMemo(() => data && permitted ? debtAccounts(type, { ...data, sales, purchases }, scope) : [], [data, permitted, type, sales, purchases, scope])
  const account = accounts.find(a => a.id === party)
  const rows = useMemo(() => data && account ? ledgerRows(party, sales, purchases, data.entries, data.collections, { ...scope, partyType: type }) : [], [data, account, party, sales, purchases, scope, type])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('due')
  const [form, setForm] = useState<LedgerEntry | null>(null)
  const [original, setOriginal] = useState<LedgerEntry | null>(null)
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  const selection = `${user?.id}:${type}:${party}`
  const selectionRef = useRef(selection)
  selectionRef.current = selection
  const [receiptId, setReceiptId] = useState('')
  const [newParty, setNewParty] = useState(false)
  const [history, setHistory] = useState(false)
  const [rowPage, setRowPage] = useState(0)
  const [listLimit, setListLimit] = useState(30)
  useEffect(() => {
    setForm(null); setOriginal(null); setReceiptId(''); setError(''); setHistory(false); setRowPage(0)
    setSearch(''); setListLimit(30)
  }, [type, party])
  const receipt = data?.entries.find(e => e.id === receiptId && e.party_id === party && e.party_type === type && !e.cancelled && inLedgerScope(e, scope))
  const formRows = data && form ? ledgerRows(form.party_id, sales, purchases, data.entries.filter(e => e.id !== original?.id), data.collections,
    { ...scope, partyType: type }) : []
  const available = form ? paymentCapacity(formRows, form.date) : 0
  const branchName = (id: string) => data?.branches.find(b => b.id === id)?.name || id
  const changeAccount = (nextType: PartyType, id = '') => { setMessage(''); setParams({ type: nextType, ...(id ? { party: id } : {}) }) }

  async function create(kind: 'opening' | 'payment', isNew = false) {
    if (saving.current || !data || !user) return
    saving.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const id = kind === 'payment' ? await nextReceiptId(new Date()) : await nextTransactionId(new Date())
      const customerId = isNew && customer ? await nextCustomerId(new Date()) : party
      if (selectionRef.current !== selection) return
      const branches = data.branches.filter(b => b.is_active && inUserBranch(user, b.id))
      const preferredBranch = activeBranch || (!isNew ? rows[rows.length - 1]?.branch_id || data.customers.find(c => c.id === party)?.branch_id : '')
      setOriginal(null); setReason(''); setNewParty(isNew)
      setForm({ id, party_id: isNew ? customerId : party, party_name: isNew ? '' : account?.name || '', party_type: type,
        kind, amount: 0, date: today, branch_id: branches.find(b => b.id === preferredBranch)?.id || branches[0]?.id || '',
        method: kind === 'payment' ? 'নগদ টাকা' : '', reference: '', note: '', cancelled: false, created_at: new Date().toISOString(), created_by: user.id })
    } catch { setError('ফর্ম খোলা যায়নি। আবার চেষ্টা করুন।') }
    finally { saving.current = false; setBusy(false) }
  }
  async function save(cancel = false) {
    if (!form || !user || saving.current) return
    saving.current = true; setBusy(true); setError('')
    const entry = cancel && original ? { ...original, cancelled: true } : { ...form,
      party_id: newParty && !customer ? supplierId(form.party_name) : form.party_id }
    try {
      await saveLedgerEntry(entry, user, useSalesStore.getState().sales, usePurchaseStore.getState().purchases, reason, original, newParty && customer)
      if (selectionRef.current !== selection) return
      setForm(null)
      if (party !== entry.party_id) changeAccount(type, entry.party_id)
      setMessage(cancel ? 'লেনদেন বাতিল হয়েছে। ইতিহাস সংরক্ষিত আছে।' : 'লেনদেন সংরক্ষিত হয়েছে। রসিদ দেখতে খাতার “রসিদ” বাটন চাপুন।')
      // Deliberately do not open a branch pad/receipt automatically after saving.
    } catch (e) { setError(e instanceof Error ? e.message : 'সংরক্ষণ হয়নি। আবার চেষ্টা করুন।') }
    finally { saving.current = false; setBusy(false) }
  }
  if (!user || user.role === 'customer') return <p className="p-6">এই খাতা শুধু মালিক ও কর্মীদের জন্য।</p>
  if (!permitted) return <div className="p-6 space-y-3"><p>সাপ্লায়ারের দেনা ও পরিশোধ শুধু মালিক ও ব্যবস্থাপক দেখতে পারবেন।</p><button className="btn-primary" onClick={() => changeAccount('customer')}>ক্রেতার পাওনায় ফিরুন</button></div>
  if (!data) return <p className="p-6" role="status">খাতা লোড হচ্ছে…</p>
  const canWrite = data.branches.some(b => b.is_active && inUserBranch(user, b.id))
  const totalDue = accounts.reduce((sum, a) => sum + Math.max(0, Math.round(a.balance * 100)), 0) / 100
  const term = search.normalize('NFC').trim().toLowerCase()
  const filtered = accounts.filter(a => (status === 'all' || (status === 'due' ? a.balance > 0 : a.balance <= 0)) &&
    (!term || [a.name, a.phone, a.id].some(v => v?.normalize('NFC').toLowerCase().includes(term))))
  const currentPage = Math.min(rowPage, Math.max(0, Math.ceil(rows.length / 50) - 1))
  const visibleRows = rows.slice(currentPage * 50, (currentPage + 1) * 50)
  const audits = data.audits.filter(a => a.after.party_id === party && a.after.party_type === type && inLedgerScope(a.after, scope)).sort((a, b) => b.at.localeCompare(a.at))
  const actionButtons = (row: LedgerRow) => {
    const entry = row.source === 'ledger' ? data.entries.find(e => e.id === row.id && e.party_type === type && e.party_id === party) : undefined
    if (!entry) return null
    return <div className="flex flex-wrap gap-3 text-xs">
      {entry.kind === 'payment' && <button type="button" className="text-teal-700 font-semibold py-1" onClick={() => setReceiptId(entry.id)}>রসিদ</button>}
      {!entry.cancelled && inUserBranch(user, entry.branch_id) && <button type="button" className="text-gray-600 underline py-1" onClick={() => {
        setForm({ ...entry }); setOriginal({ ...entry }); setNewParty(false); setReason(''); setError('')
      }}>সংশোধন / বাতিল</button>}
    </div>
  }
  return <div className="max-w-5xl mx-auto pb-28">
    <header className="px-4 pt-5 pb-6 bg-gradient-to-r from-teal-800 to-emerald-700 text-white">
      <h1 className="text-xl font-bold">বাকি ও পরিশোধের খাতা</h1>
      <p className="text-xs text-teal-100 mt-1">{user.role === 'owner' ? 'সব শাখা' : 'আপনার অনুমোদিত শাখা'} • পাওনা ও দেনার পৃথক হিসাব</p>
    </header>
    <div className="px-4 -mt-3 space-y-4">
      <div className={`grid ${isManagerLevel(user.role) ? 'grid-cols-2' : 'grid-cols-1'} gap-2`} aria-label="খাতার ধরন">
        <button type="button" aria-pressed={customer} onClick={() => changeAccount('customer')} className={`card text-left !p-3 ${customer ? 'border-teal-600 ring-1 ring-teal-600' : ''}`}>
          <span className="flex items-center gap-2 font-semibold text-sm"><ArrowDownLeft size={18} className="text-teal-700" />ক্রেতার পাওনা</span>
          <span className="text-xs text-gray-500">আমরা টাকা পাব · আদায়</span>
        </button>
        {isManagerLevel(user.role) && <button type="button" aria-pressed={!customer} onClick={() => changeAccount('supplier')} className={`card text-left !p-3 ${!customer ? 'border-orange-500 ring-1 ring-orange-500' : ''}`}>
          <span className="flex items-center gap-2 font-semibold text-sm"><ArrowUpRight size={18} className="text-orange-600" />সাপ্লায়ারকে দেনা</span>
          <span className="text-xs text-gray-500">আমরা টাকা দেব · পরিশোধ</span>
        </button>}
      </div>
      <p className="text-xs text-gray-600">{customer ? 'বাকিতে বিক্রি করলে পাওনা বাড়ে। টাকা হাতে পেলে “আদায়” লিখুন।' : 'বাকিতে পণ্য কিনলে দেনা বাড়ে—এটি আদায় নয়। সাপ্লায়ারকে টাকা দিলে “পরিশোধ” লিখুন।'}</p>
      {!canWrite && <p role="status" className="card bg-amber-50 text-sm text-amber-800">নতুন লেনদেনের জন্য সক্রিয় ও অনুমোদিত শাখা নেই। মালিককে জানান।</p>}
      {message && <p role="status" className="card bg-teal-50 text-sm text-teal-800">{message}</p>}
      {error && !form && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!party ? <>
        <div className="card flex justify-between items-center gap-3">
          <div><p className="text-xs text-gray-500">{customer ? 'ক্রেতাদের কাছে মোট পাওনা' : 'সাপ্লায়ারদের মোট দেনা'}</p><p className={`text-2xl font-bold mt-1 ${customer ? 'text-teal-700' : 'text-orange-700'}`}>{money(totalDue)}</p>
            <p className="text-xs text-gray-500">{bnNum(accounts.filter(a => a.balance > 0).length)}টি বকেয়া হিসাব • {bnDate(today)} পর্যন্ত</p></div>
          <Wallet size={28} className={customer ? 'text-teal-600' : 'text-orange-500'} />
        </div>
        <div className="card space-y-3">
          <div className="flex gap-2 items-center"><Search size={18} className="text-gray-400 shrink-0" /><input className="input-field" aria-label="খাতা খুঁজুন" placeholder="নাম, মোবাইল বা আইডি দিয়ে খুঁজুন" value={search} onChange={e => { setSearch(e.target.value); setListLimit(30) }} /></div>
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <select aria-label="হিসাবের অবস্থা" className="input-field !w-auto text-xs" value={status} onChange={e => { setStatus(e.target.value); setListLimit(30) }}>
              <option value="due">বকেয়া আছে</option><option value="all">সব হিসাব</option><option value="settled">বকেয়া নেই / অগ্রিম</option>
            </select>
            <button type="button" disabled={!canWrite || busy} className="text-teal-700 font-semibold text-xs flex items-center gap-1 disabled:opacity-40" onClick={() => void create('opening', true)}><Plus size={16} />নতুন খাতায় পুরোনো {customer ? 'পাওনা' : 'দেনা'}</button>
          </div>
        </div>
        <div className="space-y-2" aria-label={customer ? 'ক্রেতার খাতার তালিকা' : 'সাপ্লায়ারের খাতার তালিকা'}>
          {filtered.slice(0, listLimit).map(a => <button type="button" key={a.id} onClick={() => changeAccount(type, a.id)} className="card w-full text-left flex items-center gap-3 hover:border-teal-400">
            <div className="flex-1 min-w-0"><p className="font-semibold text-sm truncate">{a.name}</p><p className="text-xs text-gray-500 break-all">{a.phone || a.id}</p></div>
            <div className="text-right"><p className={`font-bold text-sm ${a.balance > 0 ? customer ? 'text-teal-700' : 'text-orange-700' : 'text-gray-600'}`}>{money(Math.abs(a.balance))}</p><p className="text-[11px] text-gray-500">{a.balance < 0 ? 'অগ্রিম জমা' : a.balance === 0 ? 'নিষ্পত্তি' : customer ? 'পাওনা' : 'দেনা'}</p></div><ChevronRight size={16} className="text-gray-400" />
          </button>)}
          {!filtered.length && <div className="card text-center text-sm text-gray-500 py-8"><p>এই ফিল্টারে কোনো হিসাব নেই।</p>{status !== 'all' && <button className="text-teal-700 underline mt-2" onClick={() => setStatus('all')}>সব হিসাব দেখুন</button>}</div>}
          {filtered.length > listLimit && <button className="btn-secondary w-full" onClick={() => setListLimit(n => n + 30)}>আরও খাতা দেখুন</button>}
        </div>
      </> : !account ? <div className="card space-y-3"><p>এই খাতা পাওয়া যায়নি অথবা আপনার অনুমোদিত শাখায় নেই।</p><button className="btn-secondary" onClick={() => changeAccount(type)}>তালিকায় ফিরুন</button></div> : <>
        <button className="text-sm text-teal-700 flex items-center gap-1" onClick={() => changeAccount(type)}><ArrowLeft size={16} />খাতার তালিকা</button>
        <div className="card space-y-4">
          <div><h2 className="font-bold text-lg">{account.name}</h2><p className="text-xs text-gray-500">{account.phone || account.id}</p></div>
          <div className={`rounded-xl p-4 ${customer ? 'bg-teal-50' : 'bg-orange-50'}`}><p className="text-xs text-gray-600">{account.balance < 0 ? 'আগের রেকর্ডে অগ্রিম জমা' : customer ? 'বর্তমান পাওনা — আমরা পাব' : 'বর্তমান দেনা — আমরা দেব'}</p><p className="text-2xl font-bold mt-1">{money(Math.abs(account.balance))}</p><p className="text-xs text-gray-500 mt-1">{bnDate(today)} পর্যন্ত হিসাব</p></div>
          <div className="grid grid-cols-2 gap-2">
            <button disabled={!canWrite || account.balance <= 0 || busy} className="btn-primary disabled:opacity-40" onClick={() => void create('payment')}>{customer ? 'টাকা আদায় করুন' : 'টাকা পরিশোধ করুন'}</button>
            <button disabled={!canWrite || busy} className="btn-secondary text-sm disabled:opacity-40" onClick={() => void create('opening')}>পুরোনো {customer ? 'পাওনা' : 'দেনা'} যোগ</button>
          </div>
          <p className="text-[11px] text-gray-500">পণ্য কেনা/বেচার বাকি বিল থেকে নিজে যোগ হয়। একই বিলের টাকা আবার “পুরোনো বাকি” হিসেবে লিখবেন না।</p>
        </div>
        <section className="card !p-0 overflow-hidden">
          <h3 className="font-semibold text-sm p-4 border-b">লেনদেনের বিবরণ <span className="text-gray-400 font-normal">({bnNum(rows.length)}টি)</span></h3>
          <div className="sm:hidden divide-y" data-ledger-mobile>
            {visibleRows.map(r => <article key={`${r.source}:${r.id}`} className="p-4 space-y-2">
              <div className="flex justify-between gap-2"><div><p className="text-sm font-medium">{r.label}</p><p className="text-[11px] text-gray-500">{bnDate(r.date)} · {branchName(r.branch_id)}</p></div><p className={`text-sm font-semibold ${r.credit ? 'text-teal-700' : 'text-orange-700'}`}>{r.credit ? '−' : '+'} {money(r.credit || r.debit)}</p></div>
              <div className="flex justify-between gap-2 text-xs"><span className="text-gray-400 break-all">{r.id}</span><span className="shrink-0">অবশিষ্ট: {money(r.balance)}</span></div>{actionButtons(r)}
            </article>)}
          </div>
          <div className="hidden sm:block overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-gray-50 text-xs text-gray-500"><tr>{['তারিখ / বিবরণ', 'শাখা', customer ? 'পাওনা (+)' : 'দেনা (+)', customer ? 'আদায় (−)' : 'পরিশোধ (−)', 'অবশিষ্ট', 'করণীয়'].map(h => <th key={h} className="p-3 whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>{visibleRows.map(r => <tr key={`${r.source}:${r.id}`} className="border-t"><td className="p-3"><p>{bnDate(r.date)} · {r.label}</p><p className="text-[10px] text-gray-400 break-all">{r.id}</p></td><td className="p-3 text-xs">{branchName(r.branch_id)}</td><td className="p-3 whitespace-nowrap">{r.debit ? money(r.debit) : '—'}</td><td className="p-3 whitespace-nowrap text-teal-700">{r.credit ? money(r.credit) : '—'}</td><td className="p-3 font-semibold whitespace-nowrap">{money(r.balance)}</td><td className="p-3">{actionButtons(r)}</td></tr>)}</tbody></table></div>
          {!rows.length && <p className="p-6 text-sm text-gray-500 text-center">এখনও বাকি বা পরিশোধের লেনদেন নেই।</p>}
          {rows.length > 50 && <nav aria-label="খাতার পৃষ্ঠা" className="p-3 flex justify-between items-center border-t text-xs"><button disabled={currentPage === 0} onClick={() => setRowPage(currentPage - 1)} className="btn-secondary disabled:opacity-40">আগের</button><span>{bnNum(currentPage + 1)} / {bnNum(Math.ceil(rows.length / 50))}</span><button disabled={(currentPage + 1) * 50 >= rows.length} onClick={() => setRowPage(currentPage + 1)} className="btn-secondary disabled:opacity-40">পরের</button></nav>}
        </section>
        <button className="text-sm text-gray-600 flex items-center gap-2" onClick={() => setHistory(v => !v)} aria-expanded={history}><History size={16} />পরিবর্তন ও বাতিলের ইতিহাস {history ? 'লুকান' : 'দেখুন'}</button>
        {history && <div className="card space-y-3">{!audits.length && <p className="text-sm text-gray-500">কোনো পরিবর্তনের ইতিহাস নেই।</p>}{audits.map(a => <details key={a.id} className="text-xs border-b pb-2"><summary className="cursor-pointer"><strong>{a.action}</strong> · {a.actor} · {new Date(a.at).toLocaleString('bn-BD')}</summary><p className="my-2">কারণ: {a.reason || 'নতুন এন্ট্রি'}</p>{[a.before, a.after].map((e, i) => <p key={i} className="p-2 bg-gray-50 my-1 break-words">{i ? 'পরে' : 'আগে'}: {e ? `${bnDate(e.date)} · ${money(e.amount)} · ${branchName(e.branch_id)} · ${e.method || '—'} · রেফারেন্স: ${e.reference || '—'} · মন্তব্য: ${e.note || '—'} · ${e.cancelled ? 'বাতিল' : 'সক্রিয়'}` : '—'}</p>)}</details>)}</div>}
      </>}
      {!customer && <details className="text-xs text-gray-500"><summary className="cursor-pointer">পুরোনো ক্রয়ের বাকি সম্পর্কে</summary><p className="mt-2">যেসব পুরোনো ক্রয়ে পেমেন্টের ধরন লেখা নেই, সেগুলো স্বয়ংক্রিয় দেনা নয়। যাচাই করে কেবল অনুলিখিত পুরোনো দেনা যোগ করুন। একই সাপ্লায়ারের জন্য একই নাম ব্যবহার করুন।</p></details>}
      <p className="text-[11px] text-gray-400">তথ্য এই ব্রাউজারেই সংরক্ষিত থাকে; স্বয়ংক্রিয় ডিভাইস সিঙ্ক নেই। নতুন অগ্রিম গ্রহণ/প্রদান এই খাতায় করা হয় না।</p>
    </div>
    {form && <LedgerDialog title={`${original ? 'সংশোধন / বাতিল' : form.kind === 'opening' ? `পুরোনো ${customer ? 'পাওনা' : 'দেনা'} যোগ` : customer ? 'টাকা আদায়' : 'টাকা পরিশোধ'}`} busy={busy} onClose={() => setForm(null)}>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); void save() }}>
        <fieldset disabled={busy} className="space-y-4">
        {newParty ? <label className="block text-sm">{customer ? 'ক্রেতার নাম' : 'সাপ্লায়ারের নাম'}<input required className="input-field mt-1" value={form.party_name} onChange={e => setForm({ ...form, party_name: e.target.value })} /></label> : <p className="font-semibold">{form.party_name}</p>}
        {newParty && !customer && <p className="text-xs text-gray-500">একই নামে সাপ্লায়ারের খাতা থাকলে পুরোনো দেনা সেই খাতায় যোগ হবে।</p>}
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">তারিখ<input required type="date" max={today} className="input-field mt-1" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label>
          <label className="text-sm">লেনদেনের শাখা<select required disabled={!!original} className="input-field mt-1" value={form.branch_id} onChange={e => setForm({ ...form, branch_id: e.target.value })}><option value="">নির্বাচন করুন</option>{data.branches.filter(b => inUserBranch(user, b.id) && (b.is_active || b.id === original?.branch_id)).map(b => <option key={b.id} value={b.id}>{b.name}{b.is_active ? '' : ' (নিষ্ক্রিয়)'}</option>)}</select></label>
        </div>
        {form.kind === 'payment' && <p className="rounded-lg p-3 bg-teal-50 text-sm">নির্বাচিত তারিখে {customer ? 'আদায়যোগ্য পাওনা' : 'পরিশোধযোগ্য দেনা'}: <strong>{money(available)}</strong><span className="block text-xs mt-1">পরের তারিখে লেখা আদায়/পরিশোধের টাকা সংরক্ষিত রেখেই এই সীমা।</span></p>}
        <label className="block text-sm">টাকার পরিমাণ<input required type="number" inputMode="decimal" min="0.01" step="0.01" max={form.kind === 'payment' ? Math.max(0, available) : undefined} className="input-field mt-1" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} /></label>
        {form.kind === 'payment' && <><label className="block text-sm">মাধ্যম<select className="input-field mt-1" value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}>{[...new Set(['নগদ টাকা', 'ব্যাংক', 'বিকাশ', 'নগদ (মোবাইল ব্যাংকিং)', 'রকেট', 'চেক', form.method])].filter(Boolean).map(m => <option key={m}>{m}</option>)}</select></label>
          <label className="block text-sm">ট্রানজ্যাকশন আইডি / রেফারেন্স (ঐচ্ছিক)<input className="input-field mt-1" value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></label></>}
        <label className="block text-sm">মন্তব্য (ঐচ্ছিক)<input className="input-field mt-1" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></label>
        {original && <label className="block text-sm">পরিবর্তন / বাতিলের কারণ<input required className="input-field mt-1" value={reason} onChange={e => setReason(e.target.value)} /></label>}
        {error && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg p-3">{error}</p>}
        <div className="flex gap-2 flex-wrap"><button disabled={busy} className="btn-primary flex-1 disabled:opacity-40">{busy ? 'সংরক্ষণ হচ্ছে…' : 'সংরক্ষণ করুন'}</button><button type="button" disabled={busy} className="btn-secondary" onClick={() => setForm(null)}>ফিরে যান</button></div>
        {original && <button type="button" disabled={busy || !reason.trim()} className="text-red-700 underline text-sm disabled:opacity-40" onClick={() => { if (window.confirm('লেনদেন বাতিল করবেন? ইতিহাস সংরক্ষিত থাকবে।')) void save(true) }}>এই লেনদেন বাতিল করুন</button>}
        <p className="text-xs text-gray-500">{form.kind === 'opening' ? 'শুধু আগের অনুলিখিত বাকি লিখুন—বিল থেকে যোগ হওয়া বাকি আবার লিখবেন না।' : 'আসলেই টাকা গ্রহণ/প্রদান হলে সংরক্ষণ করুন। সংরক্ষণের পর চাইলে রসিদ খুলতে পারবেন।'}</p>
        </fieldset>
      </form>
    </LedgerDialog>}
    {receipt && <LedgerReceipt entry={receipt} branch={data.branches.find(b => b.id === receipt.branch_id)}
      partyPhone={customer ? account?.phone : undefined} partyAddress={customer ? data.customers.find(c => c.id === party)?.address : undefined}
      balance={rows.find(r => r.source === 'ledger' && r.id === receipt.id)?.balance || 0} onClose={() => setReceiptId('')} />}
  </div>
}

function LedgerDialog({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useReportDialog(ref, onClose, busy)
  return createPortal(<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[90dvh] flex flex-col outline-none">
      <div className="flex gap-3 items-center justify-between px-4 py-3 border-b"><h2 className="font-bold text-teal-800">{title}</h2><button type="button" disabled={busy} aria-label="ফর্ম বন্ধ করুন" className="p-2 hover:bg-gray-100 rounded-full" onClick={onClose}><X size={20} /></button></div>
      <div className="p-4 overflow-y-auto overscroll-contain">{children}</div>
    </div>
  </div>, document.body)
}
