import { useState } from 'react'
import type { DbCustomer } from '../../lib/db'
import { X } from 'lucide-react'
import { normName } from '../../lib/customerAccount'

/** বটম-শিট / মডাল — ক্রেতা ফর্ম ও ছোট প্যানেলের জন্য */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-800">{title}</h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export interface CustomerFormData {
  name: string
  phone?: string
  address?: string
}

/** ক্রেতা যোগ/সম্পাদনার ফর্ম — ডুপ্লিকেট ফোন/নাম চেকসহ */
export default function CustomerForm({
  customer,
  existing,
  onClose,
  onSave,
}: {
  customer: DbCustomer | null
  existing: { id: string; name: string; phone?: string }[]
  onClose: () => void
  onSave: (data: CustomerFormData) => Promise<void>
}) {
  const [name, setName] = useState(customer?.name || '')
  const [phone, setPhone] = useState(customer?.phone || '')
  const [address, setAddress] = useState(customer?.address || '')
  const [busy, setBusy] = useState(false)

  const dupPhone = phone.trim() && existing.find((c) => c.id !== customer?.id && c.phone === phone.trim())
  const dupName = existing.find((c) => c.id !== customer?.id && normName(c.name) === normName(name))

  return (
    <Sheet title={customer ? 'ক্রেতা সম্পাদনা' : 'নতুন ক্রেতা'} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim() || dupPhone) return
          if (dupName && !customer && !confirm(`"${dupName.name}" নামে ক্রেতা আগে থেকেই আছে। তবুও নতুন যোগ করবেন?`)) return
          setBusy(true)
          try {
            await onSave({ name: name.trim(), phone: phone.trim() || undefined, address: address.trim() || undefined })
          } finally {
            setBusy(false)
          }
        }}
      >
        <label className="block text-xs text-gray-600">
          নাম <span className="text-red-500">*</span>
          <input required className="input-field" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label className="block text-xs text-gray-600">
          মোবাইল নম্বর
          <input
            type="tel"
            className="input-field"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01XXXXXXXXX"
          />
          {dupPhone && <span className="text-red-600">এই নম্বরটি "{dupPhone.name}"-এর</span>}
        </label>
        <label className="block text-xs text-gray-600">
          ঠিকানা
          <input className="input-field" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ঐচ্ছিক" />
        </label>
        <button className="btn-primary w-full" disabled={busy || !!dupPhone}>
          সংরক্ষণ
        </button>
      </form>
    </Sheet>
  )
}
