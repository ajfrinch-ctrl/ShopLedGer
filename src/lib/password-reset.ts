import { normalizeUsername } from "./usernames.ts";

/**
 * পাসওয়ার্ড সংরক্ষণ/রিসেট — অ্যাপটা লোকাল-ফার্স্ট, তাই পাসওয়ার্ড শুধু এই
 * ডিভাইসের localStorage-এ সেভ হয় (মূল ডাটা স্টোরের আলাদা কীতে, যাতে
 * ডেমো রিসেটে সেটি মুছে না যায়)।
 *
 * - অ্যাকাউন্ট চেনা হয় ইউজারনেম দিয়ে (ফোন নম্বর দিয়ে নয়)।
 * - কোনো ডিফল্ট/ফ্যাক্টরি পাসওয়ার্ড নেই — প্রতিটি পাসওয়ার্ড ব্যবহারকারী
 *   বা মালিক সেট করে।
 * - মালিক অন্যের জন্য যে পাসওয়ার্ড সেট করে, সেই অ্যাকাউন্টে প্রথম লগইনে
 *   নিজের পাসওয়ার্ড সেট করা বাধ্যতামূলক (must-change তালিকা, আলাদা কীতে)।
 *
 * লজিকের ফাংশনগুলো pure — accounts প্যারামেটর হিসেবে আসে, তাই
 * Node-এর টেস্টে সরাসরি ইমপোর্ট করা যায় (shop.ts-এর import.meta.env এড়াতে)।
 */

export const PASSWORD_OVERRIDE_KEY = "karnaphuli-shopledger-v1-password-overrides";

/** প্রথম লগইনে পাসওয়ার্ড পরিবর্তন বাধ্যতামূলক — অ্যাকাউন্ট আইডির তালিকা। */
export const MUST_CHANGE_KEY = "karnaphuli-shopledger-v1-must-change";

/** অ্যাকাউন্ট আইডি → পাসওয়ার্ড */
export type PasswordOverrides = Record<string, string>;

/** রিসেটে যাচাইয়ের জন্য প্রয়োজনীয় অ্যাকাউন্টের ফিল্ড। */
export type ResettableAccount = {
  id: string;
  name: string;
  username: string;
  /** সংরক্ষিত পাসওয়ার্ড — সেট না থাকলে null। */
  password: string | null;
};

/** লগইন ফর্মে নতুন পাসওয়ার্ডের ন্যূনতম দৈর্ঘ্য (মূল লগইনের নিয়মের সঙ্গে এক)। */
export const MIN_PASSWORD_LENGTH = 4;

export function findAccountByIdentity(
  identity: string,
  accounts: readonly ResettableAccount[],
): ResettableAccount | null {
  const clean = normalizeUsername(identity);
  if (!clean) return null;
  return accounts.find((a) => normalizeUsername(a.username) === clean) ?? null;
}

/** সংরক্ষিত পাসওয়ার্ড — সেট না থাকলে null (কোনো ডিফল্ট নেই)। */
export function storedPassword(
  accountId: string,
  overrides: PasswordOverrides = {},
): string | null {
  const stored = overrides[accountId];
  return stored && stored.length > 0 ? stored : null;
}

export type ResetResult =
  { ok: true; accountId: string; overrides: PasswordOverrides } | { ok: false; message: string };

export function performPasswordReset(input: {
  accounts: readonly ResettableAccount[];
  identity: string;
  newPassword: string;
  confirm: string;
  overrides?: PasswordOverrides;
}): ResetResult {
  const { accounts, identity, newPassword, confirm, overrides = {} } = input;
  const account = findAccountByIdentity(identity, accounts);
  if (!account) {
    return { ok: false, message: "এই ইউজারনেমের কোনো অ্যাকাউন্ট পাওয়া যায়নি" };
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      message: `নতুন পাসওয়ার্ড কমপক্ষে ${MIN_PASSWORD_LENGTH} অক্ষরের হতে হবে`,
    };
  }
  if (newPassword !== confirm) {
    return { ok: false, message: "দুটি পাসওয়ার্ড মিলছে না" };
  }
  const current = account.password ?? storedPassword(account.id, overrides);
  if (current && newPassword === current) {
    return { ok: false, message: "নতুন পাসওয়ার্ডটা পুরনোর মতো হতে পারে না" };
  }
  return {
    ok: true,
    accountId: account.id,
    overrides: { ...overrides, [account.id]: newPassword },
  };
}

export function readPasswordOverrides(): PasswordOverrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PASSWORD_OVERRIDE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: PasswordOverrides = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.length > 0) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function writePasswordOverrides(overrides: PasswordOverrides): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PASSWORD_OVERRIDE_KEY, JSON.stringify(overrides));
  } catch {
    // স্টোরেজ না থাকলে (private mode) রিসেট শুধু এই সেশনের জন্য কাজ করবে।
  }
}

/** প্রথম-লগইনে পরিবর্তন বাধ্যতামূলক — এমন অ্যাকাউন্ট আইডির তালিকা পড়া। */
export function readMustChangeIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MUST_CHANGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

export function writeMustChangeIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUST_CHANGE_KEY, JSON.stringify(ids));
  } catch {
    // স্টোরেজ না থাকলে এই সেশনে ফ্ল্যাগ মনে রাখা যাবে না।
  }
}
