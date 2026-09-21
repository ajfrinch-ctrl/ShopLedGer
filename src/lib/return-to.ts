/**
 * গভীর-লিংক ফেরানো (return-to) —
 *
 * কেউ লগইন ছাড়া ভেতরের কোনো পাতা (যেমন `/sales`) খুললে `RequireAuth` ঠিকানাটা
 * এখানে সাময়িকভাবে রেখে লগইন পাতায় পাঠায়; লগইন — বা প্রথম-লগইনের
 * বাধ্যতামূলক পাসওয়ার্ড পরিবর্তন — শেষে ব্যবহারকারী ঠিক সেই পাতাতেই ফেরেন।
 * নইলে `/sales` খুলে সোজা হোমপাতায় পৌঁছে মনে হয় «লিংকটা কাজ করছে না»।
 *
 * localStorage বন্ধ/অনুপলব্ধ হলেও (প্রাইভেট মোড, SSR) অ্যাপ চলবে — তখন ডিফল্ট `/`।
 */

export const RETURN_TO_KEY = "shopledger.return-to";

/** খুব লম্বা/অদ্ভুত মান সেভ না করা। */
const MAX_PATH_LENGTH = 300;

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * কেবল অ্যাপের ভেতরের নিরাপদ path — বাইরের ঠিকানা (`//evil.com`, `https://…`)
 * বা লগইন পাতা/হোমপাতা সেভ করার দরকার নেই (ওগুলোতে ফেরানো মানে open redirect)।
 */
export function isSafeAppPath(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const path = value.trim();
  if (path.length === 0 || path.length > MAX_PATH_LENGTH) return false;
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes("\\") || path.includes("\u0000")) return false;
  const [pathname] = path.split(/[?#]/);
  return pathname !== "/" && pathname !== "/login";
}

/** পাতার বাংলা নাম — লগইন পাতার বার্তায় দেখানোর জন্য। */
const PAGE_LABELS: Record<string, string> = {
  "/sales": "বিক্রি",
  "/stock": "স্টক",
  "/collections": "বাকি আদায়",
  "/purchases": "ক্রয়",
  "/expenses": "খরচ",
  "/reports": "রিপোর্ট",
  "/profit-loss": "লাভ-ক্ষতি",
  "/customers": "ক্রেতা",
  "/orders": "অর্ডার",
  "/my-dues": "আমার বাকি",
  "/more": "আরও",
  "/profile": "প্রোফাইল",
};

export function routeLabel(path: string | null | undefined): string {
  if (typeof path !== "string" || path.length === 0) return "";
  const [pathname] = path.split(/[?#]/);
  if (PAGE_LABELS[pathname]) return PAGE_LABELS[pathname];
  // `/customers/c-1`-এর মতো ভেতরের পাতা — মূল অংশের নাম
  const parent = Object.keys(PAGE_LABELS)
    .sort((a, b) => b.length - a.length)
    .find((key) => pathname.startsWith(`${key}/`));
  return parent ? PAGE_LABELS[parent] : "";
}

function defaultStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    // স্টোরেজ ব্লকড (কিছু প্রাইভেট/এমবেডেড ব্রাউজার) — অ্যাপ তবু চলবে
    return null;
  }
}

/** লগইনের পরে ফেরার ঠিকানা মনে রাখো (নিরাপদ না হলে কিছুই সেভ হয় না)। */
export function rememberReturnTo(path: string, store: StorageLike | null = defaultStorage()): void {
  if (!isSafeAppPath(path) || !store) return;
  try {
    store.setItem(RETURN_TO_KEY, path);
  } catch {
    // কোটা ভরা/ব্লকড — ফেরানো ঠিকানা ছাড়াই লগইন চলবে
  }
}

/** সেভ করা ঠিকানা দেখো (মুছে ফেলা হয় না)। */
export function readReturnTo(store: StorageLike | null = defaultStorage()): string | null {
  if (!store) return null;
  try {
    const value = store.getItem(RETURN_TO_KEY);
    if (value === null) return null;
    if (!isSafeAppPath(value)) {
      store.removeItem(RETURN_TO_KEY);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

/** সেভ করা ঠিকানা নাও ও মুছে ফেলো — লগইনের পরে একবারই ব্যবহার। */
export function consumeReturnTo(store: StorageLike | null = defaultStorage()): string | null {
  const value = readReturnTo(store);
  if (!store) return value;
  try {
    store.removeItem(RETURN_TO_KEY);
  } catch {
    // মুছতে ব্যর্থ হলেও ফেরার পথ আটকাবে না
  }
  return value;
}
