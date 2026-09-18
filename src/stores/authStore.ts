import { create } from 'zustand'
import { db, type DbUser } from '../lib/db'
import type { UserRole } from '../types'

// Simple hash function for passwords (not for production — use bcrypt on server)
export async function hashPassword(password: string): Promise<string> {
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
  /** প্রথম লগইনে পাসওয়ার্ড পরিবর্তন বাধ্যতামূলক কি না */
  must_change_password?: boolean
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
  /** প্রথম লগইনে বাধ্যতামূলক পাসওয়ার্ড পরিবর্তন সম্পন্ন করা */
  completeFirstLoginPasswordChange: (nextPassword: string) => Promise<{ ok: boolean; error?: string }>
  /** মালিক কর্তৃক শাখা ব্যবস্থাপক বা কর্মীর পাসওয়ার্ড রিসেট (ডিফল্ট 123456) */
  resetStaffPassword: (userId: string, newPassword?: string) => Promise<{ ok: boolean; error?: string }>
  /** মালিক কর্তৃক নতুন শাখা ব্যবস্থাপক/স্টাফ যুক্ত করা */
  createStaffUser: (input: { name: string; phone: string; password?: string; branch_id: string }) => Promise<{ ok: boolean; error?: string; user?: DbUser }>
  /** শাখা ব্যবস্থাপক বা কর্মীর অ্যাকাউন্ট সক্রিয়/নিষ্ক্রিয় টগল */
  toggleStaffStatus: (userId: string) => Promise<{ ok: boolean; error?: string; is_active?: boolean }>
  /** ৫ বার ভুল পাসওয়ার্ড দিয়ে লক হওয়া কর্মী অ্যাকাউন্ট মালিক কর্তৃক ১ ক্লিকে আনলক করা */
  unlockStaffUser: (userId: string) => Promise<{ ok: boolean; error?: string }>
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
      const savedUserId = typeof localStorage !== 'undefined' ? localStorage.getItem('shopledger-session') : null
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
              must_change_password: dbUser.must_change_password,
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

      // ৫ বার ভুল পাসওয়ার্ড দেওয়ায় অ্যাকাউন্ট লক কি না যাচাই
      if (dbUser.failed_login_attempts && dbUser.failed_login_attempts >= 5) {
        set({ error: '৫ বার ভুল পাসওয়ার্ড দেওয়ায় অ্যাকাউন্টটি লক হয়ে গেছে। মালিক বা সিস্টেম অ্যাডমিনের সাথে যোগাযোগ করে আনলক করুন।' })
        return false
      }

      if (!dbUser.is_active) {
        set({ error: 'এই অ্যাকাউন্ট নিষ্ক্রিয় বা লক করা হয়েছে' })
        return false
      }

      const hash = await hashPassword(password)
      if (hash !== dbUser.password_hash) {
        const attempts = (dbUser.failed_login_attempts || 0) + 1
        if (attempts >= 5) {
          await db.users.update(dbUser.id, {
            failed_login_attempts: 5,
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          set({ error: '৫ বার ভুল পাসওয়ার্ড দেওয়ায় অ্যাকাউন্টটি লক হয়ে গেছে! মালিক বা সিস্টেম অ্যাডমিন এক ক্লিকে আনলক করতে পারবেন।' })
        } else {
          await db.users.update(dbUser.id, {
            failed_login_attempts: attempts,
            updated_at: new Date().toISOString(),
          })
          const remaining = 5 - attempts
          set({ error: `পাসওয়ার্ড ভুল (আর ${remaining} বার চেষ্টা করতে পারবেন)` })
        }
        return false
      }

      // সফল লগইন — ভুল কাউন্টার ০ করা
      if (dbUser.failed_login_attempts && dbUser.failed_login_attempts > 0) {
        await db.users.update(dbUser.id, {
          failed_login_attempts: 0,
          updated_at: new Date().toISOString(),
        })
      }

      const authUser: AuthUser = {
        id: dbUser.id,
        name: dbUser.name,
        phone: dbUser.phone,
        role: dbUser.role,
        branch_id: dbUser.branch_id,
        must_change_password: dbUser.must_change_password,
      }

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('shopledger-session', dbUser.id)
      }
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
      must_change_password: false,
      failed_login_attempts: 0,
      updated_at: new Date().toISOString(),
    })
    set({ user: { ...current, must_change_password: false }, error: null })
    return { ok: true }
  },

  completeFirstLoginPasswordChange: async (nextPassword: string) => {
    const current = get().user
    if (!current) return { ok: false, error: 'লগইন নেই' }
    const res = await completeFirstLoginPasswordChange(current.id, nextPassword)
    if (res.ok) {
      set({ user: { ...current, must_change_password: false }, error: null })
    }
    return res
  },

  resetStaffPassword: async (userId, newPassword) => resetStaffPassword(userId, newPassword),

  createStaffUser: async (input) => createStaffUser(input),

  toggleStaffStatus: async (userId) => toggleStaffStatus(userId),

  unlockStaffUser: async (userId) => unlockStaffUser(userId),

  logout: () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('shopledger-session')
    }
    set({ user: null, isAuthenticated: false, error: null })
  },

  clearError: () => {
    set({ error: null })
  },
}))

/** প্রথম লগইনে নতুন পাসওয়ার্ড সেট করা */
export async function completeFirstLoginPasswordChange(
  userId: string,
  nextPassword: string
): Promise<{ ok: boolean; error?: string }> {
  if (nextPassword.length < 6) {
    return { ok: false, error: 'নতুন পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে' }
  }
  const dbUser = await db.users.get(userId)
  if (!dbUser) {
    return { ok: false, error: 'ব্যবহারকারী পাওয়া যায়নি' }
  }
  const newHash = await hashPassword(nextPassword)
  await db.users.update(userId, {
    password_hash: newHash,
    must_change_password: false,
    failed_login_attempts: 0,
    is_active: true,
    updated_at: new Date().toISOString(),
  })
  return { ok: true }
}

/** মালিক কর্তৃক শাখা ব্যবস্থাপক বা কর্মীর পাসওয়ার্ড রিসেট করা (ডিফল্ট: 123456) */
export async function resetStaffPassword(
  userId: string,
  newPassword = '123456'
): Promise<{ ok: boolean; error?: string }> {
  const pass = newPassword || '123456'
  if (pass.length < 6) {
    return { ok: false, error: 'নতুন পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে' }
  }
  const dbUser = await db.users.get(userId)
  if (!dbUser) {
    return { ok: false, error: 'ব্যবস্থাপক/কর্মী খুঁজে পাওয়া যায়নি' }
  }
  const newHash = await hashPassword(pass)
  await db.users.update(userId, {
    password_hash: newHash,
    is_active: true,
    must_change_password: true, // ১ম লগইনে পরিবর্তন করতে হবে
    failed_login_attempts: 0, // লক কাউন্ট আনলক
    updated_at: new Date().toISOString(),
  })
  return { ok: true }
}

/** মালিক কর্তৃক কোনো নির্দিষ্ট শাখার জন্য নতুন শাখা ব্যবস্থাপক/কর্মী যোগ করা */
export async function createStaffUser(input: {
  name: string
  phone: string
  password?: string
  branch_id: string
}): Promise<{ ok: boolean; error?: string; user?: DbUser }> {
  const cleanPhone = normalizePhone(input.phone)
  if (!input.name.trim()) return { ok: false, error: 'ব্যবস্থাপক/কর্মীর নাম লিখুন' }
  if (cleanPhone.length !== 11) return { ok: false, error: '১১ সংখ্যার মোবাইল নম্বর দিন' }
  const rawPassword = input.password || '123456'
  if (rawPassword.length < 6) return { ok: false, error: 'পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে' }
  if (!input.branch_id) return { ok: false, error: 'শাখা নির্বাচন করুন' }

  const existing = await db.users.where('phone').equals(cleanPhone).first()
  if (existing) {
    return { ok: false, error: 'এই মোবাইল নম্বরে আগেই একটি অ্যাকাউন্ট রয়েছে' }
  }

  const now = new Date().toISOString()
  const newUser: DbUser = {
    id: `staff-${crypto.randomUUID()}`,
    name: input.name.trim(),
    phone: cleanPhone,
    password_hash: await hashPassword(rawPassword),
    role: 'staff',
    branch_id: input.branch_id,
    is_active: true,
    approval: 'approved',
    must_change_password: true, // ১ম লগইনে পরিবর্তন আবশ্যক
    failed_login_attempts: 0,
    created_at: now,
    updated_at: now,
  }
  await db.users.add(newUser)
  return { ok: true, user: newUser }
}

/** শাখা ব্যবস্থাপক বা কর্মীর অ্যাকাউন্ট সক্রিয়/নিষ্ক্রিয় টগল */
export async function toggleStaffStatus(
  userId: string
): Promise<{ ok: boolean; error?: string; is_active?: boolean }> {
  const dbUser = await db.users.get(userId)
  if (!dbUser) return { ok: false, error: 'ব্যবহারকারী খুঁজে পাওয়া যায়নি' }
  const nextStatus = !dbUser.is_active
  await db.users.update(userId, {
    is_active: nextStatus,
    failed_login_attempts: nextStatus ? 0 : dbUser.failed_login_attempts || 0,
    updated_at: new Date().toISOString(),
  })
  return { ok: true, is_active: nextStatus }
}

/** ৫ বার ভুল পাসওয়ার্ড দিয়ে লক হওয়া কর্মী অ্যাকাউন্ট মালিক কর্তৃক ১ ক্লিকে আনলক করা */
export async function unlockStaffUser(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const dbUser = await db.users.get(userId)
  if (!dbUser) return { ok: false, error: 'ব্যবহারকারী খুঁজে পাওয়া যায়নি' }
  await db.users.update(userId, {
    is_active: true,
    failed_login_attempts: 0,
    updated_at: new Date().toISOString(),
  })
  return { ok: true }
}
