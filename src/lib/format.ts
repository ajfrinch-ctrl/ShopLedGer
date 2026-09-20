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

export function bnNum(n: number): string {
  return Math.round(n).toLocaleString("bn-BD");
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
