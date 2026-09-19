import { create } from 'zustand'
import { db, type DbBranch, type DbUser } from '../lib/db'
import {
  DEFAULT_SHOP_PROFILE,
  OWNER_DEFAULT_PASSWORD,
  OWNER_PHONES,
  shopPhoneLabel,
} from '../lib/shopProfile'
import { isManagerLevel, staffBranchIds } from '../lib/roles'
import type { UserRole } from '../types'
import { nextCustomerUserId, nextStaffId } from '../lib/idGenerator'

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
  /** লগইন ইউজারনেম (ব্যবস্থাপক/সেলস ম্যান) */
  username?: string
  branch_id?: string
  /** এই আইডি যেসব শাখা পরিচালনা করতে পারবে */
  branch_ids?: string[]
  /** প্রথম লগইনে পাসওয়ার্ড পরিবর্তন বাধ্যতামূলক কি না */
  must_change_password?: boolean
}

/** ইউজারনেমের নিয়ম: ছোট হাতের ইংরেজি অক্ষর/সংখ্যা/ডট/আন্ডারস্কোর/ড্যাশ, ৩–৩০ অক্ষর */
export const USERNAME_RE = /^[a-z0-9._-]{3,30}$/

export const normalizeUsername = (u: string) => (u || '').trim().toLowerCase().replace(/\s+/g, '')

/** বাংলা অক্ষর → ইংরেজি ধ্বনি (ইউজারনেম তৈরির জন্য) */
const BN_TO_EN: Record<string, string> = {
  '\u0985': 'a', '\u0986': 'a', '\u0987': 'i', '\u0988': 'i', '\u0989': 'u', '\u098A': 'u', '\u098B': 'ri',
  '\u098F': 'e', '\u0990': 'oi', '\u0993': 'o', '\u0994': 'ou',
  '\u0995': 'k', '\u0996': 'kh', '\u0997': 'g', '\u0998': 'gh', '\u0999': 'ng',
  '\u099A': 'ch', '\u099B': 'chh', '\u099C': 'j', '\u099D': 'jh', '\u099E': 'n',
  '\u099F': 't', '\u09A0': 'th', '\u09A1': 'd', '\u09A2': 'dh', '\u09A3': 'n',
  '\u09A4': 't', '\u09A5': 'th', '\u09A6': 'd', '\u09A7': 'dh', '\u09A8': 'n',
  '\u09AA': 'p', '\u09AB': 'ph', '\u09AC': 'b', '\u09AD': 'bh', '\u09AE': 'm',
  '\u09AF': 'j', '\u09B0': 'r', '\u09B2': 'l', '\u09B6': 'sh', '\u09B7': 'sh',
  '\u09B8': 's', '\u09B9': 'h', '\u09DC': 'r', '\u09DD': 'rh', '\u09DF': 'y',
  '\u09CE': 't', '\u0982': 'ng', '\u0983': 'h', '\u0981': '',
  '\u09BE': 'a', '\u09BF': 'i', '\u09C0': 'i', '\u09C1': 'u', '\u09C2': 'u', '\u09C3': 'ri',
  '\u09C7': 'e', '\u09C8': 'oi', '\u09CB': 'o', '\u09CC': 'ou', '\u09CD': '',
}

/** শাখার নাম থেকে ইউজারনেমের অংশ তৈরি — বাংলা হলে ধ্বনিভিত্তিক ইংরেজিতে রূপান্তর (আগ্রাবাদ শাখা → agrabad) */
export const slugifyBranch = (name: string) => {
  const firstWord = (name || '').trim().split(/\s+/)[0] || ''
  return firstWord
    .split('')
    .map((ch) => BN_TO_EN[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 18)
}

/** নতুন কর্মীর জন্য ইউনিক ইউজারনেম প্রস্তাব করে, যেমন: agrabad_salesman2 */
export async function suggestStaffUsername(
  branchName: string,
  role: 'manager' | 'salesman',
): Promise<string> {
  const base = slugifyBranch(branchName) || 'branch'
  const suffix = role === 'manager' ? 'manager' : 'salesman'
  const all = await db.users.toArray()
  const taken = new Set(all.map((u) => u.username).filter(Boolean) as string[])
  const phones = new Set(all.map((u) => u.phone))
  let candidate = `${base}_${suffix}`
  if (!taken.has(candidate) && !phones.has(candidate)) return candidate
  for (let i = 2; i < 100; i++) {
    candidate = `${base}_${suffix}${i}`
    if (!taken.has(candidate) && !phones.has(candidate)) return candidate
  }
  return `${base}_${suffix}_${Date.now()}`
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
  /** মালিক/ব্যবস্থাপক কর্তৃক নতুন শাখা ব্যবস্থাপক/সেলস ম্যানের আইডি খোলা */
  createStaffUser: (input: CreateStaffInput) => Promise<{ ok: boolean; error?: string; user?: DbUser }>
  /** মালিক কর্তৃক কর্মীর নাম/ইউজারনেম/ফোন/শাখা সম্পাদনা */
  updateStaffUser: (input: UpdateStaffInput) => Promise<{ ok: boolean; error?: string }>
  /** মালিক কর্তৃক কর্মীর আইডি স্থায়ীভাবে মুছে ফেলা */
  deleteStaffUser: (userId: string) => Promise<{ ok: boolean; error?: string }>
  /** ব্যবস্থাপক/সেলস ম্যানের অ্যাকাউন্ট সক্রিয়/নিষ্ক্রিয় টগল */
  toggleStaffStatus: (userId: string) => Promise<{ ok: boolean; error?: string; is_active?: boolean }>
  /** ৫ বার ভুল পাসওয়ার্ড দিয়ে লক হওয়া অ্যাকাউন্ট ১ ক্লিকে আনলক */
  unlockStaffUser: (userId: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  clearError: () => void
  initialize: () => Promise<void>
}

/** নতুন কর্মী আইডির ইনপুট — ইউজারনেম দিয়ে লগইন, একাধিক শাখা দেওয়া যায় */
export interface CreateStaffInput {
  name: string
  username: string
  /** ঐচ্ছিক — দিলে ফোন নম্বর দিয়েও লগইন ও WhatsApp-এ যোগাযোগ করা যায় */
  phone?: string
  password?: string
  role: 'manager' | 'salesman'
  branch_ids: string[]
}

export interface UpdateStaffInput {
  id: string
  name?: string
  username?: string
  phone?: string
  branch_ids?: string[]
}

/** ফোন নম্বর একরকম করে লেখা (৮৮ বাদ, শুধু সংখ্যা) */
export const normalizePhone = (p: string) => (p || '').replace(/\D/g, '').replace(/^88/, '')

const nowIso = () => new Date().toISOString()
/** 1 → '১' (মালিকের নাম "মালিক ১/২" দেখানোর জন্য) */
const bnDigit = (n: number) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)])

/**
 * মালিকের আইডি — `OWNER_PHONES`-এর প্রতিটি নম্বরের জন্য একটি করে owner অ্যাকাউন্ট।
 * সব মালিকের ক্ষমতা সমান (পূর্ণ নিয়ন্ত্রণ); পাসওয়ার্ড প্রথম লগইনে বদলাতে হবে।
 */
export function ownerAccountDemos(): (DbUser & { plain_password: string })[] {
  return OWNER_PHONES.map((phone, i) => ({
    id: i === 0 ? 'owner-1' : `owner-${i + 1}`,
    name: OWNER_PHONES.length > 1 ? `মালিক ${bnDigit(i + 1)}` : 'মালিক',
    phone,
    password_hash: '', // init-এর সময় সেট হয়
    plain_password: OWNER_DEFAULT_PASSWORD,
    role: 'owner' as const,
    is_active: true,
    branch_id: 'branch-1',
    must_change_password: true, // ১ম লগইনে নিজের পাসওয়ার্ড বাধ্যতামূলক
    created_at: nowIso(),
    updated_at: nowIso(),
  }))
}

// Demo users with passwords
const DEMO_USERS: (DbUser & { plain_password: string })[] = [
  ...ownerAccountDemos(),
  {
    id: 'staff-1',
    name: 'শাখা ব্যবস্থাপক রহিম',
    phone: '01800000000',
    username: 'demo_manager',
    password_hash: '',
    plain_password: '123456',
    role: 'manager',
    is_active: true,
    branch_id: 'branch-1',
    branch_ids: ['branch-1'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'salesman-1',
    name: 'সেলস ম্যান কামাল',
    phone: '01811111111',
    username: 'demo_salesman',
    password_hash: '',
    plain_password: '123456',
    role: 'salesman',
    is_active: true,
    branch_id: 'branch-1',
    branch_ids: ['branch-1'],
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
    username: demo.username,
    password_hash: hash,
    role: demo.role,
    is_active: demo.is_active,
    branch_id: demo.branch_id,
    branch_ids: demo.branch_ids,
    must_change_password: demo.must_change_password,
    created_at: demo.created_at,
    updated_at: demo.updated_at,
  }
  await db.users.add(demoWithHash)
  }

  // Seed a default branch — দোকানের নাম/ঠিকানা/মোবাইল সাথে সাথে প্যাডে বসে যায়
  await db.branches.add({
    id: 'branch-1',
    name: DEFAULT_SHOP_PROFILE.branchName,
    organization: DEFAULT_SHOP_PROFILE.organization,
    address: DEFAULT_SHOP_PROFILE.address,
    phone: shopPhoneLabel(),
    is_active: true,
    created_at: new Date().toISOString(),
  })
}

/**
 * পুরোনো ডিভাইস/ইনস্টলে (যেখানে আগেই সিড হয়ে গেছে) মালিকের নম্বরগুলোর আইডি
 * না থাকলে তৈরি করে দেয় — যাতে দুই মালিকই নিজের নম্বর দিয়ে ঢুকতে পারেন।
 * আগে থেকে ওই নম্বরে কোনো অ্যাকাউন্ট থাকলে সেটা অটুট থাকে।
 */
export async function ensureOwnerAccounts(): Promise<void> {
  for (const [i, phone] of OWNER_PHONES.entries()) {
    const existing = await db.users.where('phone').equals(phone).first()
    if (existing) continue

    const preferredId = i === 0 ? 'owner-1' : `owner-${i + 1}`
    const idTaken = await db.users.get(preferredId)
    await db.users.add({
      id: idTaken ? `owner-${phone}` : preferredId,
      name: OWNER_PHONES.length > 1 ? `মালিক ${bnDigit(i + 1)}` : 'মালিক',
      phone,
      password_hash: await hashPassword(OWNER_DEFAULT_PASSWORD),
      role: 'owner',
      is_active: true,
      branch_id: 'branch-1',
      must_change_password: true, // ১ম লগইনে নিজের পাসওয়ার্ড বাধ্যতামূলক
      created_at: nowIso(),
      updated_at: nowIso(),
    })
  }
}

/**
 * পুরোনো ডিভাইস/ইনস্টলে ডিফল্ট শাখা আগেই তৈরি হয়ে থাকতে পারে (নাম-ঠিকানা-ফোন খালি)।
 * সেক্ষেত্রে **শুধু খালি ফিল্ডগুলোতেই** দোকানের ডিফল্ট তথ্য বসে —
 * মালিক নিজে কিছু সেট করে থাকলে সেটা যেমন আছে তেমনই থাকে।
 */
export async function ensureShopProfileDefaults(): Promise<void> {
  const branches = await db.branches.toArray()
  if (branches.length === 0) return

  // প্রতিষ্ঠানের নাম সব শাখার জন্যই এক — যেখানে সেট করা হয়নি, সেখানে বসে
  for (const branch of branches) {
    if (!(branch.organization || '').trim()) {
      await db.branches.update(branch.id, { organization: DEFAULT_SHOP_PROFILE.organization })
    }
  }

  // ঠিকানা ও ফোন শাখা-ভিত্তিক — তাই শুধু ডিফল্ট/প্রথম শাখায়
  const main = branches.find((b) => b.id === 'branch-1') || branches[0]
  const patch: Partial<DbBranch> = {}
  if (!(main.address || '').trim()) patch.address = DEFAULT_SHOP_PROFILE.address
  if (!(main.phone || '').trim()) patch.phone = shopPhoneLabel()
  if (Object.keys(patch).length > 0) await db.branches.update(main.id, patch)
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  initialize: async () => {
    try {
      await seedDemoData()
      await ensureOwnerAccounts()
      await ensureShopProfileDefaults()

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
              username: dbUser.username,
              role: dbUser.role,
              branch_id: dbUser.branch_id,
              branch_ids: dbUser.branch_ids,
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
      // ইউজারনেম অথবা ফোন নম্বর — দুটোর যেকোনোটা দিয়ে লগইন
      const identity = (phone || '').trim()
      const byUsername = await db.users.where('username').equals(identity.toLowerCase()).first()
      const dbUser = byUsername || (await db.users.where('phone').equals(normalizePhone(identity)).first())

      if (!dbUser) {
        set({ error: 'এই ইউজারনেম/নম্বরে কোনো অ্যাকাউন্ট নেই' })
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
        username: dbUser.username,
        role: dbUser.role,
        branch_id: dbUser.branch_id,
        branch_ids: dbUser.branch_ids,
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
    // ইউনিক কাস্টমার ইউজার আইডি: CUYYMM001 (যেমন CU2609001)
    const uid = await nextCustomerUserId(new Date())
    await db.users.add({
      id: uid,
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

  updateStaffUser: async (input) => updateStaffUser(input),

  deleteStaffUser: async (userId) => deleteStaffUser(userId),

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
  const actor = useAuthStore.getState().user
  const dbUser = await db.users.get(userId)
  if (!dbUser) {
    return { ok: false, error: 'ব্যবস্থাপক/কর্মী খুঁজে পাওয়া যায়নি' }
  }
  if (dbUser.role === 'owner') return { ok: false, error: 'মালিকের পাসওয়ার্ড এখান থেকে বদলানো যায় না' }
  if (actor && !(actor.role === 'owner' || (isManagerLevel(actor.role) && dbUser.role === 'salesman'))) {
    return { ok: false, error: 'আপনি শুধু সেলস ম্যানের পাসওয়ার্ড রিসেট করতে পারবেন' }
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

/**
 * মালিক/ব্যবস্থাপক কর্তৃক নতুন ব্যবস্থাপক বা সেলস ম্যানের আইডি খোলা।
 * - ইউজারনেম দিয়ে লগইন (ফোন নম্বর ঐচ্ছিক)
 * - এক আইডিতে একাধিক শাখা দেওয়া যায়
 * - ব্যবস্থাপক শুধু সেলস ম্যানের আইডি খুলতে পারে, তাও নিজের শাখায়
 */
export async function createStaffUser(input: CreateStaffInput): Promise<{ ok: boolean; error?: string; user?: DbUser }> {
  if (!input.name.trim()) return { ok: false, error: 'কর্মীর নাম লিখুন' }

  const username = normalizeUsername(input.username)
  if (!USERNAME_RE.test(username)) {
    return { ok: false, error: 'ইউজারনেম ছোট হাতের ইংরেজি অক্ষর/সংখ্যা/ডট/ড্যাশ দিয়ে ৩–৩০ অক্ষরের হতে হবে (যেমন: aghrabad_salesman)' }
  }

  const cleanPhone = input.phone ? normalizePhone(input.phone) : ''
  if (input.phone && cleanPhone.length !== 11) return { ok: false, error: '১১ সংখ্যার মোবাইল নম্বর দিন (অথবা ফাঁকা রাখুন)' }

  const rawPassword = input.password || '123456'
  if (rawPassword.length < 6) return { ok: false, error: 'পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে' }

  const role = input.role
  const branchIds = (input.branch_ids || []).filter(Boolean)
  if (!branchIds.length) return { ok: false, error: 'অন্তত একটি শাখা নির্বাচন করুন' }

  // অনুমতি: ব্যবস্থাপক শুধু নিজের শাখায় সেলস ম্যান খুলতে পারে
  const actor = useAuthStore.getState().user
  if (actor && !actorMustCoverTarget(actor, role, branchIds)) {
    return { ok: false, error: 'আপনি শুধু নিজের শাখার সেলস ম্যানের আইডি খুলতে পারবেন' }
  }

  const all = await db.users.toArray()
  if (all.some((u) => u.username === username)) {
    return { ok: false, error: 'এই ইউজারনেম আগেই আছে — অন্যটা দিন' }
  }
  if (all.some((u) => u.phone === username)) {
    return { ok: false, error: 'এই ইউজারনেম অন্য অ্যাকাউন্টের ফোন নম্বর — অন্যটা দিন' }
  }
  if (cleanPhone && all.some((u) => u.phone === cleanPhone)) {
    return { ok: false, error: 'এই মোবাইল নম্বরে আগেই একটি অ্যাকাউন্ট রয়েছে' }
  }

  const now = new Date().toISOString()
  // ইউনিক স্টাফ আইডি: MYYMM001 / SLYYMM001
  const staffId = await nextStaffId(role, new Date())
  const newUser: DbUser = {
    id: staffId,
    name: input.name.trim(),
    phone: cleanPhone,
    username,
    password_hash: await hashPassword(rawPassword),
    role,
    branch_id: branchIds[0],
    branch_ids: branchIds,
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

/** ব্যবস্থাপক-অভিনেতার টার্গেটে হাত রাখার অনুমতি আছে কি না */
function actorMustCoverTarget(
  actor: AuthUser,
  targetRole: 'manager' | 'salesman',
  targetBranchIds: string[],
): boolean {
  if (actor.role === 'owner') return true
  if (isManagerLevel(actor.role)) {
    return targetRole === 'salesman' && targetBranchIds.some((b) => staffBranchIds(actor).includes(b))
  }
  return false
}

/** মালিক কর্তৃক কর্মীর তথ্য সম্পাদনা (নাম, ইউজারনেম, ফোন, শাখা-তালিকা) */
export async function updateStaffUser(input: UpdateStaffInput): Promise<{ ok: boolean; error?: string }> {
  const actor = useAuthStore.getState().user
  if (actor?.role !== 'owner') return { ok: false, error: 'আইডি সম্পাদনার অনুমতি শুধু মালিকের' }

  const target = await db.users.get(input.id)
  if (!target) return { ok: false, error: 'ব্যবহারকারী খুঁজে পাওয়া যায়নি' }
  if (target.role === 'owner') return { ok: false, error: 'মালিকের আইডি সম্পাদনা করা যায় না' }

  const patch: Partial<DbUser> = { updated_at: new Date().toISOString() }

  if (input.name !== undefined) {
    if (!input.name.trim()) return { ok: false, error: 'নাম খালি রাখা যাবে না' }
    patch.name = input.name.trim()
  }

  if (input.username !== undefined) {
    const username = normalizeUsername(input.username)
    if (!USERNAME_RE.test(username)) return { ok: false, error: 'ইউজারনেম ছোট হাতের ইংরেজি অক্ষর/সংখ্যা/ডট/ড্যাশ দিয়ে ৩–৩০ অক্ষরের হতে হবে' }
    const all = await db.users.toArray()
    if (all.some((u) => u.id !== input.id && u.username === username)) return { ok: false, error: 'এই ইউজারনেম আগেই আছে — অন্যটা দিন' }
    if (all.some((u) => u.id !== input.id && u.phone === username)) return { ok: false, error: 'এই ইউজারনেম অন্য অ্যাকাউন্টের ফোন নম্বর — অন্যটা দিন' }
    patch.username = username
  }

  if (input.phone !== undefined) {
    const cleanPhone = normalizePhone(input.phone)
    if (cleanPhone && cleanPhone.length !== 11) return { ok: false, error: '১১ সংখ্যার মোবাইল নম্বর দিন (অথবা ফাঁকা রাখুন)' }
    if (cleanPhone) {
      const all = await db.users.toArray()
      if (all.some((u) => u.id !== input.id && u.phone === cleanPhone)) return { ok: false, error: 'এই মোবাইল নম্বরে অন্য অ্যাকাউন্ট আছে' }
    }
    patch.phone = cleanPhone
  }

  if (input.branch_ids !== undefined) {
    const branchIds = input.branch_ids.filter(Boolean)
    if (!branchIds.length) return { ok: false, error: 'অন্তত একটি শাখা নির্বাচন করুন' }
    patch.branch_ids = branchIds
    patch.branch_id = branchIds[0]
  }

  await db.users.update(input.id, patch)
  return { ok: true }
}

/** মালিক কর্তৃক কর্মীর আইডি স্থায়ীভাবে মুছে ফেলা */
export async function deleteStaffUser(userId: string): Promise<{ ok: boolean; error?: string }> {
  const actor = useAuthStore.getState().user
  if (actor?.role !== 'owner') return { ok: false, error: 'আইডি মুছে ফেলার অনুমতি শুধু মালিকের' }

  const target = await db.users.get(userId)
  if (!target) return { ok: false, error: 'ব্যবহারকারী খুঁজে পাওয়া যায়নি' }
  if (target.role === 'owner') return { ok: false, error: 'মালিকের আইডি মুছে ফেলা যায় না' }

  await db.users.delete(userId)
  return { ok: true }
}

/** ব্যবস্থাপক/সেলস ম্যানের অ্যাকাউন্ট সক্রিয়/নিষ্ক্রিয় টগল (ব্যবস্থাপক শুধু নিজের শাখার সেলস ম্যানের) */
export async function toggleStaffStatus(
  userId: string,
): Promise<{ ok: boolean; error?: string; is_active?: boolean }> {
  const actor = useAuthStore.getState().user
  const dbUser = await db.users.get(userId)
  if (!dbUser) return { ok: false, error: 'ব্যবহারকারী খুঁজে পাওয়া যায়নি' }
  if (dbUser.role === 'owner') return { ok: false, error: 'মালিকের অ্যাকাউন্ট বদলানো যায় না' }

  const permitted =
    actor &&
    (actor.role === 'owner' ||
      (isManagerLevel(actor.role) && dbUser.role === 'salesman' && actorMustCoverTarget(actor, 'salesman', dbUser.branch_ids || (dbUser.branch_id ? [dbUser.branch_id] : []))))
  if (!permitted) return { ok: false, error: 'আপনি শুধু নিজের শাখার সেলস ম্যানের অ্যাকাউন্ট বদলাতে পারবেন' }

  const nextStatus = !dbUser.is_active
  await db.users.update(userId, {
    is_active: nextStatus,
    failed_login_attempts: nextStatus ? 0 : dbUser.failed_login_attempts || 0,
    updated_at: new Date().toISOString(),
  })
  return { ok: true, is_active: nextStatus }
}

/** ৫ বার ভুল পাসওয়ার্ডে লক হওয়া অ্যাকাউন্ট ১ ক্লিকে আনলক (ব্যবস্থাপক শুধু নিজের শাখার সেলস ম্যানের) */
export async function unlockStaffUser(userId: string): Promise<{ ok: boolean; error?: string }> {
  const actor = useAuthStore.getState().user
  const dbUser = await db.users.get(userId)
  if (!dbUser) return { ok: false, error: 'ব্যবহারকারী খুঁজে পাওয়া যায়নি' }
  if (dbUser.role === 'owner') return { ok: false, error: 'মালিকের অ্যাকাউন্ট বদলানো যায় না' }

  const permitted =
    actor &&
    (actor.role === 'owner' ||
      (isManagerLevel(actor.role) && dbUser.role === 'salesman' && actorMustCoverTarget(actor, 'salesman', dbUser.branch_ids || (dbUser.branch_id ? [dbUser.branch_id] : []))))
  if (!permitted) return { ok: false, error: 'আপনি শুধু নিজের শাখার সেলস ম্যানের অ্যাকাউন্ট আনলক করতে পারবেন' }

  await db.users.update(userId, {
    is_active: true,
    failed_login_attempts: 0,
    updated_at: new Date().toISOString(),
  })
  return { ok: true }
}
