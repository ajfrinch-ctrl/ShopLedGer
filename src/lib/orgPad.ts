import type { DbBranch } from './db'

/**
 * প্রতিষ্ঠানের প্যাড — লোগো, প্রতিষ্ঠানের নাম, ঠিকানা ও ফোন।
 *
 * মালিক "শাখা ও ব্যবস্থাপক" পেজের প্যাড ট্যাব থেকে এই তথ্য সেট করেন।
 * রিপোর্ট, রসিদ, স্টেটমেন্ট — সব জায়গায় এই একই প্যাড ব্যবহার হয়,
 * এবং নাম-ঠিকানা-লোগো সবসময় পেজের মাঝখানে (কেন্দ্রে) দেখানো হয়।
 */
export interface OrgPad {
  /** প্রতিষ্ঠানের নাম (শাখার organization) */
  name: string
  logo?: string
  address?: string
  phone?: string
  /** শাখার নাম — প্রতিষ্ঠানের নামের নিচে ছোট করে দেখানো হয় */
  branchName?: string
}

export const ORG_FALLBACK_NAME = 'কর্ণফুলী সেলস সেন্টার'

/** শাখার রেকর্ড থেকে প্যাড তৈরি (খালি ফিল্ড বাদ দেওয়া হয়) */
export function orgPadOf(
  branch?: Partial<DbBranch> | null,
  fallbackName = ORG_FALLBACK_NAME,
): OrgPad {
  const clean = (v?: string) => (v && v.trim() ? v.trim() : undefined)
  return {
    name: clean(branch?.organization) || clean(branch?.name) || fallbackName,
    logo: clean(branch?.logo),
    address: clean(branch?.address),
    phone: clean(branch?.phone),
    branchName: clean(branch?.name),
  }
}

/** প্যাডে দেখানোর মতো কিছু তথ্য আছে কি না */
export const padHasDetails = (pad?: OrgPad | null): boolean =>
  !!pad && !!(pad.logo || pad.address || pad.phone)

/** শেয়ার টেক্সট/ফাইলের জন্য প্যাডের এক-লাইন পরিচিতি */
export const padOneLine = (pad?: OrgPad | null): string => {
  if (!pad) return ''
  return [pad.name, pad.branchName, pad.address, pad.phone ? `ফোন: ${pad.phone}` : '']
    .filter(Boolean)
    .join(' • ')
}
