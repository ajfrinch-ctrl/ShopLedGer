/**
 * টপবার থিম — সময় ও আবহাওয়া অনুযায়ী রঙ, বাংলা ঘড়ি ও তারিখ।
 *
 * এই ফাইলে শুধু pure ফাংশন (React/DOM নেই) — `scripts/topbar-theme.test.mjs`
 * থেকে node:test দিয়ে সরাসরি যাচাই করা যায়।
 */

/** দোকানের সময়াঞ্চল — `format.ts`-এর `todayKey()`-এর সাথে সামঞ্জস্যপূর্ণ। */
export const SHOP_TZ = "Asia/Dhaka";

/** আকাশের অবস্থা → টপবারের রঙের মুড। `default` = অ্যাপের সাধারণ মিন্ট থিম। */
export type Sky =
  | "sunny"
  | "scorching"
  | "clear-night"
  | "partly-day"
  | "partly-night"
  | "cloudy-day"
  | "cloudy-night"
  | "fog"
  | "rain-day"
  | "rain-night"
  | "storm"
  | "snow"
  | "dawn"
  | "dusk";

export type SkyKey = Sky | "default";

export type WeatherIcon =
  | "sun"
  | "moon"
  | "cloud-sun"
  | "cloud-moon"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "storm"
  | "hot";

export interface SkyPalette {
  /** বাংলায় মুডের নাম (মেনুতে দেখানো হয়)। */
  label: string;
  /** টপবারের মূল রঙ (hex)। */
  bg: string;
  /** কোণার আলোর আভা (hex)। */
  glow: string;
  /** মূল লেখার রঙ। */
  fg: string;
  /** গৌণ লেখার রঙ। */
  muted: string;
  /** বর্ডার (rgba)। */
  line: string;
  /** চিপ/বোতামের পটভূমি (rgba)। */
  chip: string;
  /** ব্রাউজারের `theme-color` (hex)। */
  meta: string;
  /** গাঢ় পটভূমি কি না — হালকা লেখা ও ওভারলে বাছাইয়ে লাগে। */
  dark: boolean;
}

export const SKY_PALETTES: Record<SkyKey, SkyPalette> = {
  default: {
    label: "সাধারণ (মিন্ট)",
    bg: "#f1faf6",
    glow: "#04795a",
    fg: "#14211c",
    muted: "#5b6b64",
    line: "rgba(4, 121, 90, 0.18)",
    chip: "rgba(4, 121, 90, 0.08)",
    meta: "#04795a",
    dark: false,
  },
  sunny: {
    label: "রৌদ্রোজ্জ্বল দিন",
    bg: "#fdf0c2",
    glow: "#f59e0b",
    fg: "#4a3005",
    muted: "#8a6a1f",
    line: "rgba(180, 120, 20, 0.25)",
    chip: "rgba(255, 255, 255, 0.55)",
    meta: "#f9dd8a",
    dark: false,
  },
  scorching: {
    label: "প্রখর রোদ",
    bg: "#fde2c4",
    glow: "#ea580c",
    fg: "#5a2a05",
    muted: "#9a5b1e",
    line: "rgba(200, 90, 20, 0.25)",
    chip: "rgba(255, 255, 255, 0.55)",
    meta: "#fbcf9a",
    dark: false,
  },
  "clear-night": {
    label: "পরিষ্কার রাত",
    bg: "#16213f",
    glow: "#fcd34d",
    fg: "#eef2ff",
    muted: "#aab6d8",
    line: "rgba(255, 255, 255, 0.14)",
    chip: "rgba(255, 255, 255, 0.10)",
    meta: "#16213f",
    dark: true,
  },
  "partly-day": {
    label: "আংশিক মেঘলা দিন",
    bg: "#dcefff",
    glow: "#38bdf8",
    fg: "#0f2f4d",
    muted: "#43678a",
    line: "rgba(30, 100, 160, 0.2)",
    chip: "rgba(255, 255, 255, 0.6)",
    meta: "#cfe7fb",
    dark: false,
  },
  "partly-night": {
    label: "আংশিক মেঘলা রাত",
    bg: "#232c4a",
    glow: "#a5b4fc",
    fg: "#e9ecfb",
    muted: "#aeb6d6",
    line: "rgba(255, 255, 255, 0.14)",
    chip: "rgba(255, 255, 255, 0.10)",
    meta: "#232c4a",
    dark: true,
  },
  "cloudy-day": {
    label: "মেঘলা দিন",
    bg: "#e4e9ef",
    glow: "#94a3b8",
    fg: "#1f2a37",
    muted: "#586576",
    line: "rgba(60, 80, 100, 0.18)",
    chip: "rgba(255, 255, 255, 0.6)",
    meta: "#dde3ea",
    dark: false,
  },
  "cloudy-night": {
    label: "মেঘলা রাত",
    bg: "#262c34",
    glow: "#64748b",
    fg: "#e6eaef",
    muted: "#a4adb9",
    line: "rgba(255, 255, 255, 0.14)",
    chip: "rgba(255, 255, 255, 0.10)",
    meta: "#262c34",
    dark: true,
  },
  fog: {
    label: "কুয়াশা",
    bg: "#eceff1",
    glow: "#b0bec5",
    fg: "#2f3e46",
    muted: "#66767f",
    line: "rgba(60, 80, 90, 0.18)",
    chip: "rgba(255, 255, 255, 0.6)",
    meta: "#e3e7ea",
    dark: false,
  },
  "rain-day": {
    label: "বৃষ্টির দিন",
    bg: "#d7e6f7",
    glow: "#3b82f6",
    fg: "#0d2a4f",
    muted: "#3e5f86",
    line: "rgba(30, 80, 160, 0.2)",
    chip: "rgba(255, 255, 255, 0.6)",
    meta: "#c9dcf3",
    dark: false,
  },
  "rain-night": {
    label: "বৃষ্টির রাত",
    bg: "#1b2a45",
    glow: "#60a5fa",
    fg: "#e3ecfb",
    muted: "#9fb3d3",
    line: "rgba(255, 255, 255, 0.14)",
    chip: "rgba(255, 255, 255, 0.10)",
    meta: "#1b2a45",
    dark: true,
  },
  storm: {
    label: "বজ্রঝড়",
    bg: "#2b2540",
    glow: "#fbbf24",
    fg: "#f3eefc",
    muted: "#bcb2d6",
    line: "rgba(255, 255, 255, 0.14)",
    chip: "rgba(255, 255, 255, 0.10)",
    meta: "#2b2540",
    dark: true,
  },
  snow: {
    label: "তুষারপাত",
    bg: "#eaf4ff",
    glow: "#93c5fd",
    fg: "#17355c",
    muted: "#4e6f95",
    line: "rgba(40, 90, 160, 0.18)",
    chip: "rgba(255, 255, 255, 0.6)",
    meta: "#e0eefc",
    dark: false,
  },
  dawn: {
    label: "ভোর",
    bg: "#fde4e1",
    glow: "#fb923c",
    fg: "#4c2a26",
    muted: "#8c5a52",
    line: "rgba(200, 100, 80, 0.2)",
    chip: "rgba(255, 255, 255, 0.55)",
    meta: "#fbd5cf",
    dark: false,
  },
  dusk: {
    label: "গোধূলি",
    bg: "#efd9e6",
    glow: "#f97316",
    fg: "#3f2440",
    muted: "#7d5a7a",
    line: "rgba(150, 80, 130, 0.2)",
    chip: "rgba(255, 255, 255, 0.55)",
    meta: "#ead0dd",
    dark: false,
  },
};

/** এই তাপমাত্রা (°C) বা তার বেশি হলে পরিষ্কার দিনকে «প্রখর রোদ» ধরা হয়। */
export const SCORCHING_C = 36;

/**
 * WMO আবহাওয়া কোড (Open-Meteo `weather_code`) → আকাশের মুড।
 * @see https://open-meteo.com/en/docs — "WMO Weather interpretation codes"
 */
export function skyFromWeather(code: number, isDay: boolean, tempC?: number | null): Sky {
  if (!Number.isFinite(code)) return isDay ? "partly-day" : "partly-night";
  if (code === 0 || code === 1) {
    if (!isDay) return "clear-night";
    return tempC != null && tempC >= SCORCHING_C ? "scorching" : "sunny";
  }
  if (code === 2) return isDay ? "partly-day" : "partly-night";
  if (code === 3) return isDay ? "cloudy-day" : "cloudy-night";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return isDay ? "rain-day" : "rain-night";
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return isDay ? "partly-day" : "partly-night";
}

/**
 * আবহাওয়ার তথ্য না থাকলে (অফলাইন/এপিআই ব্যর্থ) দিনের সময় অনুযায়ী মুড।
 * ঘণ্টা ০–২৩, দোকানের সময়াঞ্চলে।
 */
export function skyFromHour(hour: number): Sky {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 5 && h < 7) return "dawn";
  if (h >= 7 && h < 11) return "partly-day";
  if (h >= 11 && h < 17) return "sunny";
  if (h >= 17 && h < 19) return "dusk";
  return "clear-night";
}

interface WeatherText {
  long: string;
  short: string;
  icon: WeatherIcon;
}

const WMO: Record<number, WeatherText> = {
  0: { long: "পরিষ্কার আকাশ", short: "পরিষ্কার", icon: "sun" },
  1: { long: "প্রায় পরিষ্কার আকাশ", short: "পরিষ্কার", icon: "sun" },
  2: { long: "আংশিক মেঘলা", short: "আংশিক মেঘ", icon: "cloud-sun" },
  3: { long: "মেঘলা আকাশ", short: "মেঘলা", icon: "cloudy" },
  45: { long: "কুয়াশা", short: "কুয়াশা", icon: "fog" },
  48: { long: "ঘন কুয়াশা", short: "কুয়াশা", icon: "fog" },
  51: { long: "হালকা গুঁড়ি গুঁড়ি বৃষ্টি", short: "গুঁড়ি বৃষ্টি", icon: "drizzle" },
  53: { long: "গুঁড়ি গুঁড়ি বৃষ্টি", short: "গুঁড়ি বৃষ্টি", icon: "drizzle" },
  55: { long: "ঘন গুঁড়ি গুঁড়ি বৃষ্টি", short: "গুঁড়ি বৃষ্টি", icon: "drizzle" },
  56: { long: "হিমশীতল গুঁড়ি বৃষ্টি", short: "গুঁড়ি বৃষ্টি", icon: "drizzle" },
  57: { long: "ঘন হিমশীতল গুঁড়ি বৃষ্টি", short: "গুঁড়ি বৃষ্টি", icon: "drizzle" },
  61: { long: "হালকা বৃষ্টি", short: "হালকা বৃষ্টি", icon: "rain" },
  63: { long: "মাঝারি বৃষ্টি", short: "বৃষ্টি", icon: "rain" },
  65: { long: "ভারী বৃষ্টি", short: "ভারী বৃষ্টি", icon: "rain" },
  66: { long: "হিমশীতল বৃষ্টি", short: "বৃষ্টি", icon: "rain" },
  67: { long: "ভারী হিমশীতল বৃষ্টি", short: "ভারী বৃষ্টি", icon: "rain" },
  71: { long: "হালকা তুষারপাত", short: "তুষার", icon: "snow" },
  73: { long: "তুষারপাত", short: "তুষার", icon: "snow" },
  75: { long: "ভারী তুষারপাত", short: "তুষার", icon: "snow" },
  77: { long: "তুষারকণা", short: "তুষার", icon: "snow" },
  80: { long: "হালকা বৃষ্টির ঝাপটা", short: "বৃষ্টি", icon: "rain" },
  81: { long: "বৃষ্টির ঝাপটা", short: "বৃষ্টি", icon: "rain" },
  82: { long: "প্রবল বৃষ্টির ঝাপটা", short: "ভারী বৃষ্টি", icon: "rain" },
  85: { long: "হালকা তুষার ঝাপটা", short: "তুষার", icon: "snow" },
  86: { long: "ভারী তুষার ঝাপটা", short: "তুষার", icon: "snow" },
  95: { long: "বজ্রঝড়", short: "বজ্রঝড়", icon: "storm" },
  96: { long: "শিলাবৃষ্টিসহ বজ্রঝড়", short: "বজ্রঝড়", icon: "storm" },
  99: { long: "প্রবল শিলাবৃষ্টিসহ বজ্রঝড়", short: "বজ্রঝড়", icon: "storm" },
};

/** আবহাওয়া কোডের বাংলা বর্ণনা ও আইকন-কি। */
export function describeWeather(code: number, isDay: boolean, tempC?: number | null): WeatherText {
  const base = WMO[code] ?? {
    long: "আবহাওয়া",
    short: "আবহাওয়া",
    icon: isDay ? "cloud-sun" : "cloud-moon",
  };
  if (code === 0 || code === 1) {
    if (!isDay) return { long: "পরিষ্কার রাতের আকাশ", short: "পরিষ্কার", icon: "moon" };
    if (tempC != null && tempC >= SCORCHING_C)
      return { long: "প্রখর রোদ", short: "প্রখর রোদ", icon: "hot" };
    return { long: "রৌদ্রোজ্জ্বল", short: "রোদ", icon: "sun" };
  }
  if (code === 2 && !isDay) return { ...base, icon: "cloud-moon" };
  return base;
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** ইংরেজি অঙ্ক → বাংলা অঙ্ক (লোকেল-নিরপেক্ষ, শূন্য-প্যাডিং অক্ষুণ্ণ থাকে)। */
export function toBn(value: number | string): string {
  return String(value).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

export const BN_WEEKDAYS = [
  "রবিবার",
  "সোমবার",
  "মঙ্গলবার",
  "বুধবার",
  "বৃহস্পতিবার",
  "শুক্রবার",
  "শনিবার",
] as const;

export const BN_MONTHS = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
] as const;

/** দিনের ভাগের বাংলা নাম (ঘণ্টা ০–২৩)। */
export function dayPeriodBn(hour: number): string {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 4 && h < 6) return "ভোর";
  if (h >= 6 && h < 12) return "সকাল";
  if (h >= 12 && h < 15) return "দুপুর";
  if (h >= 15 && h < 18) return "বিকেল";
  if (h >= 18 && h < 20) return "সন্ধ্যা";
  return "রাত";
}

export interface ZonedParts {
  year: number;
  /** ১–১২ */
  month: number;
  day: number;
  /** ০ = রবিবার … ৬ = শনিবার */
  weekday: number;
  /** ০–২৩ */
  hour: number;
  minute: number;
  second: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function zonedFormatter(tz: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      weekday: "short",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatterCache.set(tz, fmt);
  }
  return fmt;
}

/** নির্দিষ্ট সময়াঞ্চলে তারিখ-সময়ের অংশগুলো (প্রতি সেকেন্ডে ডাকার মতো সস্তা)। */
export function zonedParts(date: Date, tz: string = SHOP_TZ): ZonedParts {
  const map: Record<string, string> = {};
  for (const p of zonedFormatter(tz).formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    weekday: WEEKDAY_INDEX[map.weekday] ?? date.getDay(),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

export interface BnClock {
  /** যেমন «শনিবার» */
  weekday: string;
  /** যেমন «২০ সেপ্টেম্বর» */
  date: string;
  /** যেমন «২০ সেপ্টেম্বর ২০২৬» */
  dateFull: string;
  /** যেমন «রাত» */
  period: string;
  /** ১২-ঘণ্টা ঘড়ি, যেমন «৯:০৫» */
  hm: string;
  /** দুই অঙ্কের সেকেন্ড, যেমন «০৭» */
  ss: string;
  /** ২৪-ঘণ্টা, যেমন «২১:০৫» */
  hm24: string;
  hour: number;
}

/** বাংলা ঘড়ি ও তারিখের লেখা — টপবারের স্ট্রিপে দেখানো হয়। */
export function formatBnClock(date: Date, tz: string = SHOP_TZ): BnClock {
  const z = zonedParts(date, tz);
  const h12 = z.hour % 12 === 0 ? 12 : z.hour % 12;
  const mm = String(z.minute).padStart(2, "0");
  const dateLabel = `${toBn(z.day)} ${BN_MONTHS[z.month - 1]}`;
  return {
    weekday: BN_WEEKDAYS[z.weekday],
    date: dateLabel,
    dateFull: `${dateLabel} ${toBn(z.year)}`,
    period: dayPeriodBn(z.hour),
    hm: toBn(`${h12}:${mm}`),
    ss: toBn(String(z.second).padStart(2, "0")),
    hm24: toBn(`${String(z.hour).padStart(2, "0")}:${mm}`),
    hour: z.hour,
  };
}

/** «এইমাত্র» / «৫ মিনিট আগে» / «২ ঘণ্টা আগে» */
export function agoBn(fromMs: number, nowMs: number = Date.now()): string {
  const mins = Math.max(0, Math.round((nowMs - fromMs) / 60_000));
  if (mins < 1) return "এইমাত্র";
  if (mins < 60) return `${toBn(mins)} মিনিট আগে`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${toBn(hours)} ঘণ্টা আগে`;
  return `${toBn(Math.floor(hours / 24))} দিন আগে`;
}

/** `#rrggbb` → `rgba(r, g, b, a)` — পুরনো WebView-এও চলে (color-mix লাগে না)। */
export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** প্যালেট → টপবারের CSS ভেরিয়েবল (inline style-এ বসে)। */
export function skyCssVars(p: SkyPalette): Record<`--tb-${string}`, string> {
  return {
    "--tb-bg": hexToRgba(p.bg, 0.92),
    "--tb-bg-solid": p.bg,
    "--tb-glow": p.glow,
    "--tb-fg": p.fg,
    "--tb-muted": p.muted,
    "--tb-line": p.line,
    "--tb-chip": p.chip,
    "--tb-sheen": p.dark ? "rgba(255, 255, 255, 0.07)" : "rgba(255, 255, 255, 0.55)",
  };
}
