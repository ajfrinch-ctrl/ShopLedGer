export function todayKey(d = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
}

export function shiftKey(days: number): string {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return todayKey(now);
}

export function money(n: number): string {
  const rounded = Math.round(n);
  const formatted = Math.abs(rounded).toLocaleString("bn-BD");
  return rounded < 0 ? `−৳${formatted}` : `৳${formatted}`;
}

/** বাংলাদেশি মোবাইল নম্বরকে ০১XXXXXXXXX আকারে একরকম রাখে। */
export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("880") && digits.length === 13) return `0${digits.slice(3)}`;
  if (digits.startsWith("1") && digits.length === 10) return `0${digits}`;
  return digits;
}

export function isBangladeshMobile(value: string): boolean {
  return /^01[3-9]\d{8}$/.test(normalizePhone(value));
}

/** wa.me-র জন্য ৮৮০১XXXXXXXXX নম্বর। */
export function whatsappNumber(value: string): string {
  const local = normalizePhone(value);
  return local.startsWith("0") ? `88${local.slice(1)}` : local;
}

export function bnNum(n: number): string {
  return Math.round(n).toLocaleString("bn-BD");
}

/** Quantities can be fractional; bnNum intentionally rounds summary counts. */
export function bnQuantity(n: number): string {
  return n.toLocaleString("bn-BD", { maximumFractionDigits: 6 });
}

export function bnDate(key: string): string {
  const d = new Date(`${key}T12:00:00`);
  return d.toLocaleDateString("bn-BD", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function bnDateShort(key: string): string {
  const d = new Date(`${key}T12:00:00`);
  return d.toLocaleDateString("bn-BD", {
    day: "numeric",
    month: "short",
  });
}

export function nid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function monthStartKey(key = todayKey()): string {
  return `${key.slice(0, 7)}-01`;
}
