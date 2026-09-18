import { create } from 'zustand'
import { db, type DbUser } from '../lib/db'
import type { UserRole } from '../types'

// Simple hash function for passwords (not for production — use bcrypt on server)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'shopledger-salt-2026')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export interface AuthUser {
  id: string
  name: string
  phone: string
  role: UserRole
  branch_id?: string
}

export interface RegisterInput {
  name: string
  phone: string
  password: string
  address?: string
}

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (phone: string, password: string) => Promise<boolean>
  /** ক্রেতা নিজে সাইন-আপ করলে অ্যাকাউন্ট তৈরি হয়, কিন্তু দোকানের অনুমোদন ছাড়া লগইন হয় না */
  register: (input: RegisterInput) => Promise<{ ok: boolean; error?: string }>
  /** নিজের নাম/ফোন/ঠিকানা হালনাগাদ */
  updateProfile: (patch: { name?: string; phone?: string; address?: string }) => Promise<{ ok: boolean; error?: string }>
  /** নিজের পাসওয়ার্ড পরিবর্তন (বর্তমান পাসওয়ার্ড মিলিয়ে দেখা হয়) */
  changePassword: (current: string, next: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  clearError: () => void
  initialize: () => Promise<void>
}

/** ফোন নম্বর একরকম করে লেখা (৮৮ বাদ, শুধু সংখ্যা) */
export const normalizePhone = (p: string) => (p || '').replace(/\D/g, '').replace(/^88/, '')

// Demo users with passwords
const DEMO_USERS: (DbUser & { plain_password: string })[] = [
  {
    id: 'owner-1',
    name: 'মালিক সাহেব',
    phone: '01700000000',
    password_hash: '', // will be set during init
    plain_password: '123456',
    role: 'owner',
    is_active: true,
    branch_id: 'branch-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'staff-1',
    name: 'কর্মচারী রহিম',
    phone: '01800000000',
    password_hash: '',
    plain_password: '123456',
    role: 'staff',
    is_active: true,
    branch_id: 'branch-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'customer-1',
    name: 'ক্রেতা করিম',
    phone: '01900000000',
    password_hash: '',
    plain_password: '123456',
    role: 'customer',
    is_active: true,
    branch_id: 'branch-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

// Seed demo data into Dexie
async function seedDemoData() {
  const userCount = await db.users.count()
  if (userCount > 0) return // already seeded

  for (const demo of DEMO_USERS) {
    const hash = await hashPassword(demo.plain_password)
  const demoWithHash = {
    id: demo.id,
    name: demo.name,
    phone: demo.phone,
    password_hash: hash,
    role: demo.role,
    is_active: demo.is_active,
    branch_id: demo.branch_id,
    created_at: demo.created_at,
    updated_at: demo.updated_at,
  }
  await db.users.add(demoWithHash)
  }

  // Seed a default branch
  await db.branches.add({
    id: 'branch-1',
    name: 'প্রধান শাখা',
    address: '',
    phone: '',
    is_active: true,
    created_at: new Date().toISOString(),
  })
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  initialize: async () => {
    try {
      await seedDemoData()

      // Check if there's a saved session
      const savedUserId = localStorage.getItem('shopledger-session')
      if (savedUserId) {
        const dbUser = await db.users.get(savedUserId)
        const approved = !dbUser?.approval || dbUser.approval === 'approved'
        if (dbUser && dbUser.is_active && approved) {
          set({
            user: {
              id: dbUser.id,
              name: dbUser.name,
              phone: dbUser.phone,
              role: dbUser.role,
              branch_id: dbUser.branch_id,
            },
            isAuthenticated: true,
            isLoading: false,
          })
          return
        }
      }
      set({ isLoading: false })
    } catch (err) {
      console.error('Auth init error:', err)
      set({ isLoading: false })
    }
  },

  login: async (phone: string, password: string) => {
    set({ error: null })

    try {
      const dbUser = await db.users.where('phone').equals(phone).first()

      if (!dbUser) {
        set({ error: 'এই নম্বরে কোনো অ্যাকাউন্ট নেই' })
        return false
      }

      if (dbUser.approval === 'pending') {
        set({ error: 'আপনার অ্যাকাউন্ট এখনো দোকানের অনুমোদনের অপেক্ষায় আছে' })
        return false
      }
      if (dbUser.approval === 'rejected') {
        set({ error: 'আপনার অ্যাকাউন্ট অনুমোদিত হয়নি' })
        return false
      }
      if (!dbUser.is_active) {
        set({ error: 'এই অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে' })
        return false
      }

      const hash = await hashPassword(password)
      if (hash !== dbUser.password_hash) {
        set({ error: 'পাসওয়ার্ড ভুল' })
        return false
      }

      const authUser: AuthUser = {
        id: dbUser.id,
        name: dbUser.name,
        phone: dbUser.phone,
        role: dbUser.role,
        branch_id: dbUser.branch_id,
      }

      localStorage.setItem('shopledger-session', dbUser.id)
      set({ user: authUser, isAuthenticated: true, error: null })
      return true
    } catch (err) {
      console.error('Login error:', err)
      set({ error: 'লগইনে সমস্যা হয়েছে, আবার চেষ্টা করুন' })
      return false
    }
  },

  register: async ({ name, phone, password, address }) => {
    const cleanPhone = normalizePhone(phone)
    if (!name.trim()) return { ok: false, error: 'নাম লিখুন' }
    if (cleanPhone.length !== 11) return { ok: false, error: '১১ সংখ্যার মোবাইল নম্বর দিন' }
    if (password.length < 6) return { ok: false, error: 'পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে' }

    const existing = await db.users.where('phone').equals(cleanPhone).first()
    if (existing) return { ok: false, error: 'এই নম্বরে আগেই অ্যাকাউন্ট আছে — লগইন করুন' }

    const now = new Date().toISOString()
    await db.users.add({
      id: `cust-user-${crypto.randomUUID()}`,
      name: name.trim(),
      phone: cleanPhone,
      password_hash: await hashPassword(password),
      role: 'customer',
      is_active: false,
      approval: 'pending',
      address: address?.trim() || undefined,
      created_at: now,
      updated_at: now,
    })
    return { ok: true }
  },

  updateProfile: async ({ name, phone, address }) => {
    const current = get().user
    if (!current) return { ok: false, error: 'লগইন নেই' }
    const cleanPhone = phone === undefined ? undefined : normalizePhone(phone)
    if (name !== undefined && !name.trim()) return { ok: false, error: 'নাম খালি রাখা যাবে না' }
    if (cleanPhone !== undefined && cleanPhone.length !== 11) return { ok: false, error: '১১ সংখ্যার মোবাইল নম্বর দিন' }

    if (cleanPhone && cleanPhone !== current.phone) {
      const taken = await db.users.where('phone').equals(cleanPhone).first()
      if (taken && taken.id !== current.id) return { ok: false, error: 'এই নম্বরে অন্য অ্যাকাউন্ট আছে' }
    }

    const patch: Partial<DbUser> = { updated_at: new Date().toISOString() }
    if (name !== undefined) patch.name = name.trim()
    if (cleanPhone !== undefined) patch.phone = cleanPhone
    if (address !== undefined) patch.address = address.trim() || undefined
    await db.users.update(current.id, patch)

    const nextUser: AuthUser = {
      ...current,
      name: patch.name ?? current.name,
      phone: patch.phone ?? current.phone,
    }
    set({ user: nextUser, error: null })
    return { ok: true }
  },

  changePassword: async (currentPassword, nextPassword) => {
    const current = get().user
    if (!current) return { ok: false, error: 'লগইন নেই' }
    if (nextPassword.length < 6) return { ok: false, error: 'নতুন পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে' }
    if (nextPassword === currentPassword) return { ok: false, error: 'নতুন পাসওয়ার্ড আগেরটার মতোই' }

    const dbUser = await db.users.get(current.id)
    if (!dbUser) return { ok: false, error: 'অ্যাকাউন্ট পাওয়া যায়নি' }
    const currentHash = await hashPassword(currentPassword)
    if (currentHash !== dbUser.password_hash) return { ok: false, error: 'বর্তমান পাসওয়ার্ড ভুল' }

    await db.users.update(current.id, {
      password_hash: await hashPassword(nextPassword),
      updated_at: new Date().toISOString(),
    })
    return { ok: true }
  },

  logout: () => {
    localStorage.removeItem('shopledger-session')
    set({ user: null, isAuthenticated: false, error: null })
  },

  clearError: () => {
    set({ error: null })
  },
}))
