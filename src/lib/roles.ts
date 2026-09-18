import type { UserRole } from '../types'

/**
 * রোল-ভিত্তিক অনুমতির কেন্দ্রীয় তালিকা।
 *
 * রোল:
 *   owner    — মালিক (সব শাখা, সব ক্ষমতা)
 *   manager  — শাখা ব্যবস্থাপক (নিজের শাখা/শাখাগুলোর সব কাজ + সেলস ম্যান নিয়োগ + লাভ দেখা)
 *   salesman — সেলস ম্যান (বিক্রি, ক্রেতা, অর্ডার, বাকি আদায় + স্টক দেখা)
 *   staff    — পুরোনো রোল (ডেটাবেস খোলার সময় 'manager'-এ রূপান্তর হয়)
 *   customer — ক্রেতা (নিজের হিসাব)
 */

/** দোকানের পক্ষে কাজ করা রোল (মালিক + ব্যবস্থাপক + সেলস ম্যান + পুরোনো staff) */
export const SHOP_ROLES: UserRole[] = ['owner', 'manager', 'salesman', 'staff']

export const isShopRole = (role: UserRole | undefined): boolean =>
  !!role && SHOP_ROLES.includes(role)

/** ব্যবস্থাপক ও পুরোনো staff একই ক্ষমতার বলে গণ্য */
export const isManagerLevel = (role: UserRole | undefined): boolean =>
  role === 'owner' || role === 'manager' || role === 'staff'

export const roleLabel = (role: UserRole | undefined): string =>
  role === 'owner'
    ? 'মালিক'
    : role === 'manager'
      ? 'শাখা ব্যবস্থাপক'
      : role === 'salesman'
        ? 'সেলস ম্যান'
        : role === 'staff'
          ? 'কর্মচারী'
          : 'ক্রেতা'

/** ব্যবহারকারীর শাখা-তালিকা (নতুন branch_ids, না থাকলে পুরোনো branch_id) */
export const staffBranchIds = (user: { role: UserRole; branch_id?: string; branch_ids?: string[] } | null | undefined): string[] => {
  if (!user) return []
  if (user.role === 'owner') return []
  const ids = user.branch_ids?.filter(Boolean) ?? []
  if (ids.length) return ids
  return user.branch_id ? [user.branch_id] : []
}

/** ডেটা-ফিল্টার: মালিক সব শাখা দেখেন; ব্যবস্থাপক/সেলস ম্যান শুধু নিজের শাখাগুলো */
export const inUserBranch = (
  user: { role: UserRole; branch_id?: string; branch_ids?: string[] } | null | undefined,
  branchId: string | undefined,
): boolean => {
  if (!user) return false
  if (user.role === 'owner') return true
  return staffBranchIds(user).includes(branchId || '')
}

/* ── ক্ষমতার ম্যাট্রিক্স ── */

/** ক্রয় এন্ট্রি ও খরচ এন্ট্রি — মালিক ও ব্যবস্থাপক */
export const canEntryPurchaseExpense = (role: UserRole | undefined): boolean => isManagerLevel(role)

/** পণ্য যোগ/সম্পাদনা ও স্টক সমন্বয় — মালিক ও ব্যবস্থাপক (সেলস ম্যান শুধু দেখবে) */
export const canEditStock = (role: UserRole | undefined): boolean => isManagerLevel(role)

/** লাভের হিসাব (দৈনিক/মাসিক লাভ, লাভ-ক্ষতি পেজ, ড্যাশবোর্ডের লাভ কার্ড) — মালিক ও ব্যবস্থাপক */
export const canSeeProfit = (role: UserRole | undefined): boolean => isManagerLevel(role)

/** সেলস ম্যানের আইডি খোলা/বন্ধ — মালিক ও ব্যবস্থাপক */
export const canManageSalesmen = (role: UserRole | undefined): boolean => isManagerLevel(role)

/** কর্মীর আইডি সম্পাদনা/ডিলিট — শুধু মালিক */
export const canEditStaffIds = (role: UserRole | undefined): boolean => role === 'owner'
