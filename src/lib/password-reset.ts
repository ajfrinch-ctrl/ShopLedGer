import { normalizePhone } from "./format.ts";

/**
 * পাসওয়ার্ড রিসেট — অ্যাপটা লোকাল-ফার্স্ট, তাই নতুন পাসওয়ার্ড শুধু এই
 * ডিভাইসের localStorage-এ সেভ হয় (মূল ডাটা স্টোরের আলাদা কীতে, যাতে
 * ডেমো রিসেটে সেটি মুছে না যায়)।
 *
 * লজিকের ফাংশনগুলো pure — accounts প্যারামেটর হিসেবে আসে, তাই
 * Node-এর টেস্টে সরাসরি ইমপোর্ট করা যায় (shop.ts-এর import.meta.env এড়াতে)।
 */

export const PASSWORD_OVERRIDE_KEY = "karnaphuli-shopledger-v1-password-overrides";

/** অ্যাকাউন্ট আইডি → নতুন পাসওয়ার্ড */
export type PasswordOverrides = Record<string, string>;

/** রিসেটে যাচাইয়ের জন্য প্রয়োজনীয় অ্যাকাউন্টের ফিল্ড। */
export type ResettableAccount = {
  id: string;
  name: string;
  phone: string;
  password: string;
};

/** লগইন ফর্মে নতুন পাসওয়ার্ডের ন্যূনতম দৈর্ঘ্য (মূল লগইনের নিয়মের সঙ্গে এক)। */
export const MIN_PASSWORD_LENGTH = 4;

export function findAccountByIdentity(
  identity: string,
  accounts: readonly ResettableAccount[],
): ResettableAccount | null {
  const trimmed = identity.trim();
  if (!trimmed) return null;
  const normalized = normalizePhone(trimmed);
  return accounts.find((a) => normalizePhone(a.phone) === normalized || a.name === trimmed) ?? null;
}

/** লগইনে যাচাই করার পাসওয়ার্ড — রিসেট করা থাকলে সেট, নাহলে ডিফল্ট। */
export function expectedPassword(
  accountId: string,
  fallback: string,
  overrides: PasswordOverrides = {},
): string {
  const stored = overrides[accountId];
  return stored && stored.length > 0 ? stored : fallback;
}

/** অ্যাকাউন্টটা এখনো ফ্যাক্টরি পাসওয়ার্ডে আছে কি না (প্রথম-লগইন পরিবর্তন চেক)। */
export function isUsingDefaultPassword(
  accountId: string,
  defaultPassword: string,
  overrides: PasswordOverrides = {},
): boolean {
  return expectedPassword(accountId, defaultPassword, overrides) === defaultPassword;
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
    return { ok: false, message: "এই আইডি/নম্বরের কোনো অ্যাকাউন্ট পাওয়া যায়নি" };
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
  if (newPassword === expectedPassword(account.id, account.password, overrides)) {
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
