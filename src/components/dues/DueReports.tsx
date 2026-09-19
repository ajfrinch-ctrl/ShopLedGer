import { useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { debtAccounts, type DebtData } from '../../lib/dues'
import { cents, ledgerRows, ledgerScopeFor, ledgerToday, money, validLedgerDate, type PartyType } from '../../lib/ledger'
import { isManagerLevel } from '../../lib/roles'
import { bnDate } from '../../lib/reports/core'
import type { AuthUser } from '../../stores/authStore'

/** Read-only views of the existing audited account/row helpers. No writes or new accounting rules. */
export default function DueReports({ kind, data, user, onParty }: {
  kind: string; data: DebtData; user: AuthUser; onParty: (type: PartyType, id: string) => void
}) {
  const today = ledgerToday()
  const [from, setFrom] = useState(today.slice(0, 7) + '-01')
  const [through, setThrough] = useState(today)
  const [limit, setLimit] = useState(30)
  const payments = kind === 'payments'
  const manager = isManagerLevel(user.role)
  const valid = validLedgerDate(through) && through <= today && (!payments || (validLedgerDate(from) && from <= through))
  const allowed = kind === 'customer' || payments || (kind === 'supplier' && manager)
  const scope = useMemo(() => ({ ...ledgerScopeFor(user), through }), [user, through])
  const types: PartyType[] = payments ? (manager ? ['customer', 'supplier'] : ['customer']) : [kind === 'supplier' ? 'supplier' : 'customer']
  const groups = allowed && valid ? types.map(type => ({ type, accounts: debtAccounts(type, data, scope) })) : []
  const transactions = payments ? groups.flatMap(g => g.accounts.flatMap(a => ledgerRows(a.id, data.sales, data.purchases, data.entries, data.collections,
    { ...scope, partyType: g.type }).filter(r => r.credit !== 0 && r.date.slice(0, 10) >= from)
    .map(r => ({ ...r, party: a, type: g.type })))).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)) : []
  const accounts = groups[0]?.accounts.filter(a => a.balance !== 0) || []
  const collected = transactions.filter(r => r.type === 'customer').reduce((sum, r) => sum + cents(r.credit), 0) / 100
  const paid = transactions.filter(r => r.type === 'supplier').reduce((sum, r) => sum + cents(r.credit), 0) / 100
  if (!allowed) return <p role="alert">এই রিপোর্ট দেখার অনুমতি নেই অথবা রিপোর্টটি পাওয়া যায়নি।</p>
  return <section className="space-y-4" aria-label="খাতার রিপোর্ট">
    <h2 className="font-semibold">{payments ? manager ? 'আদায় ও পরিশোধ রিপোর্ট' : 'আদায় রিপোর্ট' : kind === 'supplier' ? 'সাপ্লায়ারের দেনা রিপোর্ট' : 'ক্রেতার পাওনা রিপোর্ট'}</h2>
    <div className="grid sm:grid-cols-2 gap-3">
      {payments && <label className="text-sm">শুরু<input className="input-field mt-1" type="date" value={from} max={through} onChange={e => { setFrom(e.target.value); setLimit(30) }} /></label>}
      <label className="text-sm">{payments ? 'শেষ' : 'এই তারিখ পর্যন্ত'}<input className="input-field mt-1" type="date" max={today} value={through} onChange={e => { setThrough(e.target.value); setLimit(30) }} /></label>
    </div>
    {!valid ? <p role="alert" className="text-red-700 text-sm">সঠিক তারিখসীমা দিন।</p> : <>
      <div className="bg-white border rounded-xl p-4 text-sm space-y-2" role="status">
        {payments ? <><p>মোট আদায়: <strong>{money(collected)}</strong></p>{manager && <p>মোট পরিশোধ: <strong>{money(paid)}</strong></p>}</> : <p>{kind === 'supplier' ? 'মোট দেনা' : 'মোট পাওনা'}: <strong>{money(accounts.reduce((sum, a) => sum + Math.max(0, cents(a.balance)), 0) / 100)}</strong></p>}
        <p className="text-xs text-gray-500">অনুমোদিত শাখার হিসাব · বাতিল লেনদেন বাদ · {bnDate(through)} পর্যন্ত</p>
      </div>
      <div className="divide-y" data-due-report-rows>
        {payments ? transactions.slice(0, limit).map(r => <div key={`${r.type}:${r.party.id}:${r.source}:${r.id}`} className="py-3 text-sm space-y-1">
          <div className="flex flex-wrap justify-between gap-2"><button className="text-teal-800 font-semibold text-left flex items-center gap-2 min-w-0" onClick={() => onParty(r.type, r.party.id)}>{r.party.name}<ArrowRight size={16} className="shrink-0" /></button><strong>{r.type === 'customer' ? 'আদায়' : 'পরিশোধ'}: {money(r.credit)}</strong></div>
          <p className="text-xs text-gray-500">{bnDate(r.date)} · {r.type === 'customer' ? 'ক্রেতা' : 'সাপ্লায়ার'}</p>
          <details className="text-xs text-gray-500"><summary className="cursor-pointer">আরও তথ্য</summary><p className="break-all">{r.id}</p></details>
        </div>) : accounts.slice(0, limit).map(a => <button key={a.id} className="w-full py-3 flex flex-wrap items-center justify-between gap-2 text-left text-sm" onClick={() => onParty(kind === 'supplier' ? 'supplier' : 'customer', a.id)}>
          <span className="min-w-0"><strong className="block">{a.name}</strong><small className="text-gray-500">{a.phone || 'মোবাইল নম্বর দেওয়া নেই'}</small></span><span>{a.balance < 0 ? 'আগের অগ্রিম: ' : ''}{money(Math.abs(a.balance))}</span>
        </button>)}
      </div>
      {!(payments ? transactions.length : accounts.length) && <p className="text-sm text-gray-500 py-5">এই সময়ের কোনো তথ্য নেই।</p>}
      {(payments ? transactions.length : accounts.length) > limit && <button className="btn-secondary w-full" onClick={() => setLimit(n => n + 30)}>আরও দেখুন</button>}
    </>}
  </section>
}
