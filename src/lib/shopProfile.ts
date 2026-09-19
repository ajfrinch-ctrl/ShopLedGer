/**
 * দোকানের ডিফল্ট পরিচিতি — **কর্ণফুলী সেলস সেন্টার**।
 *
 * অ্যাপ প্রথমবার চালু হওয়ার সময় ডিফল্ট শাখায় (`branch-1`) এই তথ্য সেট হয়,
 * ফলে রিপোর্ট, বিক্রয় রসিদ, লেনদেনের রসিদ ও ক্রেতার হিসাব বিবরণীর
 * প্যাডে (লেটারহেড) দোকানের নাম, ঠিকানা ও মোবাইল নম্বর সাথে সাথে দেখা যায়।
 *
 * মালিক চাইলে **শাখা ও ব্যবস্থাপক → প্যাড** থেকে যেকোনো সময় বদলাতে পারবেন;
 * নিজে সেট করা তথ্য পরে কোনো ডিফল্ট দিয়ে ওভাররাইট করা হয় না।
 */

export interface ShopProfile {
  /** প্রতিষ্ঠানের নাম — প্যাডের সবচেয়ে উপরে, পেজের মাঝখানে */
  organization: string
  /** ডিফল্ট শাখার নাম — প্রতিষ্ঠানের নামের নিচে ছোট করে */
  branchName: string
  /** দোকানের ঠিকানা */
  address: string
  /** যোগাযোগের মোবাইল নম্বর (একাধিক হতে পারে) */
  phones: string[]
}

export const DEFAULT_SHOP_PROFILE: ShopProfile = {
  organization: 'কর্ণফুলী সেলস সেন্টার',
  branchName: 'প্রধান শাখা',
  address: 'পল্লি বিদ্যুৎ অফিসের পাশে, বুড়া মসজিদ রোড, আমুচিয়া, বোয়ালখালী, চট্টগ্রাম',
  phones: ['01821989717', '01811808294'],
}

/**
 * মালিকের মোবাইল নম্বর — এই নম্বরগুলোর জন্যই **মালিক (owner)** আইডি তৈরি হয়।
 * দুজনেই অ্যাপের পূর্ণ নিয়ন্ত্রণ পাবেন: বিক্রি/ক্রয়/খরচ, স্টক, বাকি, রিপোর্ট,
 * লাভের হিসাব, শাখা ও ব্যবস্থাপক (কর্মী আইডি, প্যাড সেটিং) — সব কিছু।
 */
export const OWNER_PHONES: string[] = ['01811808294', '01821989717']

/** মালিকের আইডির প্রাথমিক পাসওয়ার্ড — ১ম লগইনেই বদলাতে হবে */
export const OWNER_DEFAULT_PASSWORD = '123456'

/** এই নম্বরটি মালিকের কি না (লেখার ধরন যেমনই হোক) */
export const isOwnerPhone = (phone?: string): boolean => {
  const first = phoneNumbers(phone)[0]
  return !!first && OWNER_PHONES.includes(first)
}

/**
 * দোকানের লোগো (`public/brand/`) — গরুর মাথা + খাদ্যের গামলায় দানা,
 * ব্র্যান্ড সবুজে গোল ব্যাজ (গবাদি পশুর খাদ্য ব্যবসার ব্র্যান্ড)।
 * প্যাড (রিপোর্ট/রসিদের লেটারহেড) এই লোগোই ব্যবহার করে।
 *
 * - `karnaphuli-mark.png` — কেবল মার্ক (প্যাডের জন্য; নাম-ঠিকানা প্যাডেই টেক্সট হিসেবে থাকে)
 * - `karnaphuli-mark-mono.png` — সাদা-কালো ছাপার জন্য এক রঙের মার্ক
 * - `karnaphuli-lockup.png` — মার্ক + বাংলা নাম + ইংরেজি (সাদা ব্যাকগ্রাউন্ডে ব্যবহারের জন্য)
 */
export const SHOP_LOGO_PATH = 'brand/karnaphuli-mark.png'

/** লোগোর URL — Vite `base` মানে (GitHub Pages-এও ঠিকঠাক চলে) */
export function shopLogoUrl(file: string = SHOP_LOGO_PATH): string {
  const base = ((import.meta.env?.BASE_URL as string | undefined) || '/').replace(/\/?$/, '/')
  return `${base}${file}`
}

/** প্যাড/শেয়ার টেক্সটে দেখানোর মতো এক লাইনের ফোন (একাধিক হলে কমা দিয়ে) */
export const shopPhoneLabel = (p: ShopProfile = DEFAULT_SHOP_PROFILE): string => p.phones.join(', ')

/**
 * এক ফিল্ডে লেখা একাধিক নম্বর আলাদা করে দেয় — কমা/সেমিকোলন/স্ল্যাশ দিয়ে লিখলেও চলে।
 * (স্পেস দিয়ে আলাদা করা হয় না, কারণ "019-1111 1111" একটিই নম্বর।)
 */
export const phoneNumbers = (phone?: string): string[] =>
  (phone || '')
    .split(/[,;؛،/|]+/)
    .map((p) => p.replace(/\D/g, '').replace(/^88/, ''))
    .filter((p) => p.length === 11 || p.length === 10)

/** WhatsApp/কলের জন্য প্রথম নম্বর, দেশের কোডসহ (যেমন `8801821989717`) */
export const primaryDialNumber = (phone?: string): string => {
  const first = phoneNumbers(phone)[0]
  return first ? `88${first}` : ''
}
