/**
 * ইউজারনেম-ভিত্তিক লগইন পরিচয়।
 *
 * - অ্যাডমিন/কর্মচারীর ইউজারনেম সিস্টেম নিজে বানায়: ভূমিকার উপসর্গ + নামের
 *   প্রথম অংশ (`admin.karim`, `manager.rahim`, `sales.jamal`)।
 * - একই ভূমিকায় একই নাম থাকলে শেষে 2, 3, 4 … বসে (প্রথমটির নম্বর নেই)।
 * - ক্রেতা নিজের ইউজারনেম নিজে বেছে নেয়; তৈরি হওয়ার পর কারও ইউজারনেম
 *   বদলানো যায় না।
 * - ইউজারনেম পুরো অ্যাপে অনন্য (case-insensitive) — তবে ভূমিকার উপসর্গ
 *   আলাদা হলে (`admin.karim` বনাম `manager.karim`) ভিন্ন ইউজারনেম।
 *
 * Pure ফাংশন — Node টেস্টে সরাসরি ইমপোর্ট করা যায়।
 */

export const ADMIN_PREFIX = "admin.";
export const MANAGER_PREFIX = "manager.";
export const SALES_PREFIX = "sales.";

export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 30;

/** তুলনা/সংরক্ষণের একরকম রূপ — ফাঁকা বাদ, ছোট হাতের। */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * নামের প্রথম অংশের slug — শুধু অক্ষর/সংখ্যা থাকে (বাংলাসহ সব লিপি চলে),
 * ফাঁকা/যতিচিহ্ন বাদ যায়। কিছু না থাকলে "" ফেরত দেয়।
 */
export function firstNameSlug(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? "";
  const cleaned = first.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, "");
  return cleaned.slice(0, MAX_USERNAME_LENGTH);
}

export type UsernameTaken = (username: string) => boolean;

/**
 * ভূমিকার উপসর্গ + প্রথম নাম — সংঘর্ষ হলে শেষে 2, 3, 4 …।
 * প্রথম অ্যাকাউন্টে নম্বর বসে না।
 */
export function generatePrefixedUsername(
  prefix: string,
  fullName: string,
  isTaken: UsernameTaken,
): string {
  const slug = firstNameSlug(fullName) || "user";
  const base = `${prefix}${slug}`;
  if (!isTaken(base)) return base;
  let n = 2;
  while (isTaken(`${base}${n}`)) n += 1;
  return `${base}${n}`;
}

/** ক্রেতার নিজের বাছাই করা ইউজারনেম যাচাই — ফরম্যাট + সারা অ্যাপে অনন্যতা। */
export function validateCustomerUsername(
  username: string,
  isTaken: UsernameTaken,
): { ok: true; username: string } | { ok: false; message: string } {
  const clean = normalizeUsername(username);
  if (!clean) return { ok: false, message: "ইউজারনেম দিন" };
  if (clean.length < MIN_USERNAME_LENGTH) {
    return { ok: false, message: `ইউজারনেম কমপক্ষে ${MIN_USERNAME_LENGTH} অক্ষরের হতে হবে` };
  }
  if (clean.length > MAX_USERNAME_LENGTH) {
    return { ok: false, message: `ইউজারনেম সর্বোচ্চ ${MAX_USERNAME_LENGTH} অক্ষর হতে পারে` };
  }
  if (!/^[\p{L}\p{N}][\p{L}\p{M}\p{N}._-]*[\p{L}\p{M}\p{N}]$/u.test(clean)) {
    return { ok: false, message: "ইউজারনেমে অক্ষর, সংখ্যা, ডট, আন্ডারস্কোর বা হাইফেন দিন" };
  }
  if (isTaken(clean)) {
    return { ok: false, message: "এই ইউজারনেমটি ব্যবহৃত — অন্য একটি বেছে নিন" };
  }
  return { ok: true, username: clean };
}
