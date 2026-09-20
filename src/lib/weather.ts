/**
 * বর্তমান আবহাওয়া — Open-Meteo (বিনামূল্যে, API key লাগে না, CORS খোলা)।
 * তথ্য: https://open-meteo.com — CC BY 4.0 (অ্যাপে ক্রেডিট দেখানো হয়)।
 *
 * এখানে শুধু pure হেল্পার (fetch/parse/cache) — React হুক `use-weather.ts`-এ।
 */
import { SHOP_TZ } from "./topbar-theme.ts";

export interface CurrentWeather {
  /** WMO weather code (0 = পরিষ্কার … 99 = প্রবল বজ্রঝড়) */
  code: number;
  isDay: boolean;
  tempC: number;
  feelsLikeC: number | null;
  humidity: number | null;
  /** এপিআই-এর পর্যবেক্ষণ সময় (স্থানীয় ISO, যেমন 2026-09-20T21:00) */
  observedAt: string;
  /** কখন নামানো হয়েছে (epoch ms) */
  fetchedAt: number;
}

export const WEATHER_CACHE_KEY = "shopledger.weather.v1";
/** এর চেয়ে নতুন হলে আবার নামানো হয় না। */
export const WEATHER_FRESH_MS = 30 * 60_000;
/** এর চেয়ে পুরনো ক্যাশ রঙ বাছাইয়ে ব্যবহার হয় না (তখন সময়-ভিত্তিক থিম)। */
export const WEATHER_MAX_AGE_MS = 3 * 60 * 60_000;

export function weatherUrl(lat: number, lon: number, tz: string = SHOP_TZ): string {
  const q = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code",
    timezone: tz,
  });
  return `https://api.open-meteo.com/v1/forecast?${q.toString()}`;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Open-Meteo JSON → CurrentWeather; অচেনা/ভাঙা ডেটা হলে `null`। */
export function parseWeather(json: unknown, fetchedAt: number = Date.now()): CurrentWeather | null {
  if (!json || typeof json !== "object") return null;
  const cur = (json as { current?: unknown }).current;
  if (!cur || typeof cur !== "object") return null;
  const c = cur as Record<string, unknown>;
  const code = num(c.weather_code);
  const temp = num(c.temperature_2m);
  if (code == null || temp == null) return null;
  return {
    code,
    isDay: num(c.is_day) === 1,
    tempC: temp,
    feelsLikeC: num(c.apparent_temperature),
    humidity: num(c.relative_humidity_2m),
    observedAt: typeof c.time === "string" ? c.time : "",
    fetchedAt,
  };
}

export function isWeatherFresh(w: CurrentWeather | null, now: number = Date.now()): boolean {
  return !!w && now - w.fetchedAt < WEATHER_FRESH_MS;
}

export function isWeatherUsable(w: CurrentWeather | null, now: number = Date.now()): boolean {
  return !!w && now - w.fetchedAt < WEATHER_MAX_AGE_MS;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function readWeatherCache(storage: StorageLike | null | undefined): CurrentWeather | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const w = JSON.parse(raw) as Partial<CurrentWeather>;
    if (
      typeof w.code !== "number" ||
      typeof w.tempC !== "number" ||
      typeof w.fetchedAt !== "number"
    ) {
      return null;
    }
    return {
      code: w.code,
      isDay: !!w.isDay,
      tempC: w.tempC,
      feelsLikeC: typeof w.feelsLikeC === "number" ? w.feelsLikeC : null,
      humidity: typeof w.humidity === "number" ? w.humidity : null,
      observedAt: typeof w.observedAt === "string" ? w.observedAt : "",
      fetchedAt: w.fetchedAt,
    };
  } catch {
    return null;
  }
}

export function writeWeatherCache(
  storage: StorageLike | null | undefined,
  w: CurrentWeather,
): void {
  if (!storage) return;
  try {
    storage.setItem(WEATHER_CACHE_KEY, JSON.stringify(w));
  } catch {
    /* কোটা শেষ/প্রাইভেট মোড — ক্যাশ ছাড়াই চলবে */
  }
}

export async function fetchCurrentWeather(
  lat: number,
  lon: number,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<CurrentWeather> {
  const res = await fetchImpl(weatherUrl(lat, lon), {
    signal,
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`weather http ${res.status}`);
  const w = parseWeather(await res.json());
  if (!w) throw new Error("weather: unexpected payload");
  return w;
}
