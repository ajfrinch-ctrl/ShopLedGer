import { useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  Clock3,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudOff,
  CloudRain,
  CloudSnow,
  CloudSun,
  Cloudy,
  LogOut,
  Menu,
  Moon,
  RefreshCw,
  Sun,
  Thermometer,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { SHOP } from "@/lib/shop";
import { isSystemAdmin, roleLabel } from "@/lib/store";
import {
  SKY_PALETTES,
  agoBn,
  describeWeather,
  formatBnClock,
  skyCssVars,
  skyFromHour,
  skyFromWeather,
  toBn,
  zonedParts,
  type SkyKey,
  type WeatherIcon,
} from "@/lib/topbar-theme";
import type { SessionUser } from "@/lib/types";
import { useUiPrefs } from "@/lib/ui-prefs";
import { useCurrentWeather } from "@/lib/use-weather";
import { isWeatherFresh, isWeatherUsable } from "@/lib/weather";
import { cn } from "@/lib/utils";

const ICONS: Record<WeatherIcon, LucideIcon> = {
  sun: Sun,
  moon: Moon,
  "cloud-sun": CloudSun,
  "cloud-moon": CloudMoon,
  cloudy: Cloudy,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
  hot: Thermometer,
};

/**
 * ফিক্সড টপবারের উচ্চতা `--topbar-h` CSS ভেরিয়েবলে লিখে দেয়, যাতে `<main>`
 * (এবং দরকার হলে অন্য যেকোনো লেআউট) ঠিক ততটুকু জায়গা ছেড়ে শুরু হয়।
 * ফন্ট লোড/ঘোরানো/সেফ-এরিয়া বদলালে ResizeObserver নিজে থেকে ঠিক করে নেয়।
 */
function useTopbarHeight() {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const apply = () => {
      root.style.setProperty("--topbar-h", `${Math.ceil(el.getBoundingClientRect().height)}px`);
    };
    apply();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    ro?.observe(el);
    window.addEventListener("resize", apply);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", apply);
      root.style.removeProperty("--topbar-h");
    };
  }, []);
  return ref;
}

/** দোকানের সময়াঞ্চলে বর্তমান ঘণ্টা — প্রতি মিনিটে হালনাগাদ (সময়-ভিত্তিক থিমের জন্য)। */
function useZonedHour() {
  const [hour, setHour] = useState(() => zonedParts(new Date()).hour);
  useEffect(() => {
    const id = window.setInterval(() => setHour(zonedParts(new Date()).hour), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return hour;
}

/** ব্রাউজার/PWA-এর স্ট্যাটাস বারের রঙও টপবারের সাথে মেলানো। */
function useThemeColor(color: string) {
  useEffect(() => {
    const el = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!el) return;
    const prev = el.getAttribute("content");
    el.setAttribute("content", color);
    return () => {
      if (prev != null) el.setAttribute("content", prev);
    };
  }, [color]);
}

/** আজকের বার, তারিখ ও চলমান ঘড়ি (বাংলা অঙ্কে, প্রতি সেকেন্ডে টিক)। */
function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer = 0;
    const stop = () => window.clearTimeout(timer);
    const tick = () => {
      setNow(new Date());
      // পরের সেকেন্ডের শুরুতে টিক — ঘড়ি সেকেন্ডের সাথে মিলে চলে, drift জমে না
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    };
    const start = () => {
      stop();
      tick();
    };
    // ট্যাব আড়ালে থাকলে টিক বন্ধ (ব্যাটারি), ফিরলে সাথে সাথে সঠিক সময়
    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  const c = formatBnClock(now);
  return (
    <>
      <span className="flex min-w-0 items-center gap-1.5" data-testid="topbar-date">
        <CalendarDays size={13} className="shrink-0 opacity-80" aria-hidden />
        <span className="truncate">
          <span className="font-bold text-(--tb-fg) transition-colors duration-700">
            {c.weekday}
          </span>
          {", "}
          {c.date}
        </span>
      </span>
      <time
        dateTime={now.toISOString()}
        className="tabular flex shrink-0 items-center gap-1.5"
        data-testid="topbar-clock"
      >
        <Clock3 size={13} className="opacity-80" aria-hidden />
        <span>
          <span className="font-bold text-(--tb-fg) transition-colors duration-700">
            {c.period} {c.hm}
          </span>
          <span className="text-caption opacity-70">:{c.ss}</span>
        </span>
      </time>
    </>
  );
}

export function TopBar({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const isCustomer = user.role === "customer";
  const privateAdmin = isSystemAdmin(user.role);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const skyOn = useUiPrefs((s) => s.skyTheme);
  const setSkyOn = useUiPrefs((s) => s.setSkyTheme);
  const { weather, status, refresh } = useCurrentWeather(SHOP.location.lat, SHOP.location.lon);
  const hour = useZonedHour();
  const headerRef = useTopbarHeight();

  // পাতা বদলালে মেনু বন্ধ
  useEffect(() => setMenuOpen(false), [pathname]);

  // Escape চাপলে মেনু বন্ধ
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // রঙ বাছাই: আবহাওয়া (৩ ঘণ্টার মধ্যে নামানো) → নইলে দিনের সময় → বন্ধ থাকলে সাধারণ মিন্ট
  const live = weather && isWeatherUsable(weather) ? weather : null;
  // দিন/রাত: টাটকা তথ্যে এপিআই-এর `is_day`; বাসি (অফলাইন) হলে ঘড়ি দেখে (সকাল ৬টা–সন্ধ্যা ৬টা = দিন)
  const isDay = weather && isWeatherFresh(weather) ? weather.isDay : hour >= 6 && hour < 18;
  const sky: SkyKey = !skyOn
    ? "default"
    : live
      ? skyFromWeather(live.code, isDay, live.tempC)
      : skyFromHour(hour);
  const palette = SKY_PALETTES[sky];
  useThemeColor(palette.meta);

  const wx = weather ? describeWeather(weather.code, isDay, weather.tempC) : null;
  const WxIcon: LucideIcon = wx ? ICONS[wx.icon] : status === "loading" ? Thermometer : CloudOff;
  const temp = weather ? `${toBn(Math.round(weather.tempC))}°` : "";
  const weatherTitle = weather
    ? `${temp} ${wx?.long ?? ""} • ${SHOP.location.label}`
    : status === "loading"
      ? "আবহাওয়া আনা হচ্ছে…"
      : "আবহাওয়া পাওয়া যায়নি";

  return (
    <>
      <header
        ref={headerRef}
        data-sky={sky}
        style={skyCssVars(palette) as CSSProperties}
        className="fixed inset-x-0 top-0 z-20 border-b border-(--tb-line) bg-(--tb-bg) pt-[env(safe-area-inset-top)] text-(--tb-fg) backdrop-blur-xl transition-colors duration-700"
      >
        {/* সাজসজ্জা: উপরে হালকা ঝিলিক + কোণায় আলোর আভা (রোদ/চাঁদ/বিদ্যুৎ) */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-b from-(--tb-sheen) to-transparent transition-colors duration-700" />
          <div className="absolute -top-10 right-8 size-32 rounded-full bg-(--tb-glow) opacity-35 blur-2xl transition-colors duration-700" />
        </div>

        <div className="relative mx-auto max-w-md px-4">
          <div className="flex items-start justify-between gap-2 py-2.5">
            <div className="flex min-w-0 flex-1 items-start gap-3 pr-2">
              <img
                src={SHOP.logo}
                alt=""
                className="size-10 shrink-0 rounded-xl object-cover shadow-[0_4px_14px_rgba(0,0,0,0.18)]"
              />
              <div className="min-w-0 flex-1">
                <h1
                  className="text-heading leading-tight font-bold [overflow-wrap:anywhere]"
                  data-testid="topbar-shop-name"
                >
                  {SHOP.name}
                </h1>
                <p className="text-caption leading-tight font-normal text-(--tb-muted) transition-colors duration-700 [overflow-wrap:anywhere]">
                  {isCustomer
                    ? "ক্রেতা প্যানেল"
                    : privateAdmin
                      ? "সিস্টেম অ্যাডমিন"
                      : `${user.name} • ${roleLabel(user.role)}`}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                aria-label={weatherTitle}
                title={weatherTitle}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                data-testid="topbar-weather"
                className="tabular flex h-9 items-center gap-1 rounded-full border border-(--tb-line) bg-(--tb-chip) px-2.5 text-body font-bold transition-colors duration-700"
              >
                <WxIcon
                  size={16}
                  className={cn(status === "loading" && !weather && "animate-pulse")}
                  aria-hidden
                />
                {temp ? <span>{temp}</span> : null}
              </button>
              <button
                type="button"
                aria-label="মেনু"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                className="flex size-9 items-center justify-center rounded-full border border-(--tb-line) bg-(--tb-chip) transition-colors duration-700"
              >
                {menuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>

          {/* আজকের বার • তারিখ • সময় */}
          <div className="flex items-center justify-between gap-3 border-t border-(--tb-line) py-1.5 text-caption text-(--tb-muted) transition-colors duration-700">
            <LiveClock />
          </div>
        </div>

        {menuOpen && (
          <div className="absolute inset-x-0 top-full px-4 pt-2">
            <div className="mx-auto max-w-md rounded-lg border border-line bg-card p-2 text-fg shadow-card">
              <div className="mb-1 border-b border-line px-3 py-2">
                <p className="text-body font-bold">{user.name}</p>
                <p className="text-caption text-muted">
                  {privateAdmin ? "সিস্টেম অ্যাডমিন" : `${roleLabel(user.role)} • ${user.phone}`}
                </p>
              </div>

              <div className="border-b border-line px-3 py-2.5">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-mint-2 text-primary">
                    <WxIcon size={22} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-bold">
                      {weather
                        ? `${temp} ${wx?.long ?? ""}`
                        : status === "loading"
                          ? "আবহাওয়া আনা হচ্ছে…"
                          : status === "offline"
                            ? "অফলাইন — আবহাওয়া পাওয়া যায়নি"
                            : "আবহাওয়া পাওয়া যায়নি"}
                    </p>
                    {weather && (weather.feelsLikeC != null || weather.humidity != null) ? (
                      <p className="text-caption text-muted">
                        {weather.feelsLikeC != null
                          ? `অনুভূত ${toBn(Math.round(weather.feelsLikeC))}°`
                          : null}
                        {weather.feelsLikeC != null && weather.humidity != null ? " • " : null}
                        {weather.humidity != null ? `আর্দ্রতা ${toBn(weather.humidity)}%` : null}
                      </p>
                    ) : null}
                    <p className="text-caption text-muted">
                      {SHOP.location.label}
                      {weather ? ` • আপডেট ${agoBn(weather.fetchedAt)}` : ""}
                      {weather && status === "error" ? " (রিফ্রেশ ব্যর্থ)" : ""}
                      {weather && status === "offline" ? " (অফলাইন)" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="আবহাওয়া রিফ্রেশ"
                    onClick={refresh}
                    disabled={status === "loading"}
                    className="rounded-full border border-line p-2 text-muted disabled:opacity-50"
                  >
                    <RefreshCw
                      size={14}
                      className={cn(status === "loading" && "animate-spin")}
                      aria-hidden
                    />
                  </button>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={skyOn}
                  onClick={() => setSkyOn(!skyOn)}
                  data-testid="sky-theme-toggle"
                  className="mt-2.5 flex w-full items-center justify-between gap-3 rounded-sm bg-bg px-3 py-2 text-left"
                >
                  <span className="min-w-0">
                    <span className="block text-body font-normal">
                      আবহাওয়া অনুযায়ী টপবারের রঙ
                    </span>
                    <span className="block text-caption text-muted">
                      {skyOn
                        ? `এখন: ${palette.label}${live ? "" : " (সময় অনুযায়ী)"}`
                        : "বন্ধ — সাধারণ মিন্ট রঙ"}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                      skyOn ? "bg-primary" : "bg-line",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform",
                        skyOn && "translate-x-5",
                      )}
                    />
                  </span>
                </button>
                <p className="mt-1.5 px-1 text-caption text-muted">
                  আবহাওয়ার তথ্য: Open-Meteo.com
                </p>
              </div>

              <button
                type="button"
                onClick={onLogout}
                className="flex w-full items-center gap-2 rounded-sm px-3 py-2.5 text-body font-normal text-danger"
              >
                <LogOut size={16} /> লগআউট
              </button>
            </div>
          </div>
        )}
      </header>

      {/* মেনুর বাইরে চাপলে বন্ধ */}
      {menuOpen && (
        <button
          type="button"
          aria-label="মেনু বন্ধ করুন"
          tabIndex={-1}
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-10 cursor-default bg-transparent"
        />
      )}
    </>
  );
}
