import { create } from 'zustand'
import { useAuthStore, type AuthUser } from './authStore'
import { staffBranchIds } from '../lib/roles'

/**
 * UI-অবস্থা — একাধিক শাখার কর্মী (ব্যবস্থাপক/সেলস ম্যান) কোন শাখায় কাজ করছেন সেটি।
 * এক শাখার কর্মীর জন্য এটি সবসময় তার একমাত্র শাখা।
 */
interface UiState {
  staffBranchId: string
  setStaffBranchId: (branchId: string) => void
}

export const useUiStore = create<UiState>()((set) => ({
  staffBranchId: '',
  setStaffBranchId: (branchId) => set({ staffBranchId: branchId }),
}))

/** কর্মীর শাখা-তালিকা (রিয়েক্টিভ) */
export function useStaffBranchIds(): string[] {
  const user = useAuthStore((s) => s.user) as AuthUser | null
  return staffBranchIds(user)
}

/**
 * নতুন ডেটা (বিক্রি/ক্রয়/খরচ/ক্রেতা) কোন শাখায় যাবে —
 * একাধিক শাখার কর্মী হেডার থেকে শাখা বদলাতে পারেন।
 */
export function useActiveBranchId(): string {
  const user = useAuthStore((s) => s.user) as AuthUser | null
  const ids = staffBranchIds(user)
  const staffBranchId = useUiStore((s) => s.staffBranchId)
  if (!ids.length) return ''
  return ids.includes(staffBranchId) ? staffBranchId : ids[0]
}
