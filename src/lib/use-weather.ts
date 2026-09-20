import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchCurrentWeather,
  isWeatherFresh,
  readWeatherCache,
  writeWeatherCache,
  type CurrentWeather,
} from "./weather.ts";

export type WeatherStatus = "idle" | "loading" | "ok" | "error" | "offline";

/** ফ্রেশনেস চেক কত ঘন ঘন — ক্যাশ ৩০ মিনিটের পুরনো হলে তবেই নেটওয়ার্ক কল হয়। */
const CHECK_EVERY_MS = 5 * 60_000;

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * দোকানের অবস্থানের বর্তমান আবহাওয়া।
 * - প্রথমে localStorage ক্যাশ (তাৎক্ষণিক রঙ, নেটওয়ার্ক ছাড়াই)
 * - ৩০ মিনিট পরপর রিফ্রেশ; ট্যাবে ফিরলে বা অনলাইন হলে বাসি থাকলে আবার নামায়
 * - ব্যর্থ হলে পুরনো ক্যাশই থাকে (`status: "error"`), UI সময়-ভিত্তিক থিমে নামে
 */
export function useCurrentWeather(lat: number, lon: number) {
  const [weather, setWeather] = useState<CurrentWeather | null>(() => readWeatherCache(storage()));
  const [status, setStatus] = useState<WeatherStatus>("idle");
  const latest = useRef<CurrentWeather | null>(weather);
  const inflight = useRef<AbortController | null>(null);

  const load = useCallback(
    async (force = false) => {
      if (!force && isWeatherFresh(latest.current)) return;
      if (inflight.current) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setStatus("offline");
        return;
      }
      const ctrl = new AbortController();
      inflight.current = ctrl;
      setStatus("loading");
      try {
        const w = await fetchCurrentWeather(lat, lon, ctrl.signal);
        latest.current = w;
        writeWeatherCache(storage(), w);
        setWeather(w);
        setStatus("ok");
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) setStatus("error");
      } finally {
        if (inflight.current === ctrl) inflight.current = null;
      }
    },
    [lat, lon],
  );

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), CHECK_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    const onOnline = () => void load();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      inflight.current?.abort();
      inflight.current = null;
    };
  }, [load]);

  const refresh = useCallback(() => void load(true), [load]);

  return { weather, status, refresh };
}
