// টপবার থিম/ঘড়ি/আবহাওয়া — pure লজিকের টেস্ট।
// Node 22.18+ TypeScript type-stripping দিয়ে সরাসরি `src/lib/*.ts` ইমপোর্ট করে
// (কোনো বিল্ড স্টেপ লাগে না; CI-এর Node 22-এ চলে)।
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BN_MONTHS,
  BN_WEEKDAYS,
  SKY_PALETTES,
  agoBn,
  dayPeriodBn,
  describeWeather,
  formatBnClock,
  hexToRgba,
  skyCssVars,
  skyFromHour,
  skyFromWeather,
  toBn,
  zonedParts,
} from "../src/lib/topbar-theme.ts";
import {
  WEATHER_CACHE_KEY,
  isWeatherFresh,
  isWeatherUsable,
  parseWeather,
  readWeatherCache,
  weatherUrl,
  writeWeatherCache,
} from "../src/lib/weather.ts";

// Open-Meteo-এর আসল উত্তর (২০২৬-০৯-২০ রাত ৯টা, বোয়ালখালী): মেঘলা, ২৭.৭°
const SAMPLE = {
  latitude: 22.390158,
  longitude: 91.95652,
  timezone: "Asia/Dhaka",
  current_units: { time: "iso8601", temperature_2m: "°C", is_day: "", weather_code: "wmo code" },
  current: {
    time: "2026-09-20T21:00",
    interval: 900,
    temperature_2m: 27.7,
    relative_humidity_2m: 91,
    apparent_temperature: 34.3,
    is_day: 0,
    weather_code: 3,
  },
};

test("skyFromWeather: WMO কোড + দিন/রাত → মুড", () => {
  assert.equal(skyFromWeather(0, true), "sunny");
  assert.equal(skyFromWeather(1, true, 30), "sunny");
  assert.equal(skyFromWeather(0, true, 36), "scorching");
  assert.equal(skyFromWeather(0, false, 40), "clear-night");
  assert.equal(skyFromWeather(2, true), "partly-day");
  assert.equal(skyFromWeather(2, false), "partly-night");
  assert.equal(skyFromWeather(3, true), "cloudy-day");
  assert.equal(skyFromWeather(3, false), "cloudy-night");
  assert.equal(skyFromWeather(45, true), "fog");
  assert.equal(skyFromWeather(48, false), "fog");
  for (const code of [51, 55, 57, 61, 63, 65, 67, 80, 81, 82]) {
    assert.equal(skyFromWeather(code, true), "rain-day", `code ${code} day`);
    assert.equal(skyFromWeather(code, false), "rain-night", `code ${code} night`);
  }
  for (const code of [71, 73, 75, 77, 85, 86]) assert.equal(skyFromWeather(code, true), "snow");
  for (const code of [95, 96, 99]) assert.equal(skyFromWeather(code, false), "storm");
  // অচেনা/ভাঙা কোড → নিরাপদ ডিফল্ট
  assert.equal(skyFromWeather(42, true), "partly-day");
  assert.equal(skyFromWeather(Number.NaN, false), "partly-night");
});

test("skyFromHour: আবহাওয়া না থাকলে দিনের সময় অনুযায়ী", () => {
  assert.equal(skyFromHour(5), "dawn");
  assert.equal(skyFromHour(6), "dawn");
  assert.equal(skyFromHour(7), "partly-day");
  assert.equal(skyFromHour(10), "partly-day");
  assert.equal(skyFromHour(11), "sunny");
  assert.equal(skyFromHour(16), "sunny");
  assert.equal(skyFromHour(17), "dusk");
  assert.equal(skyFromHour(18), "dusk");
  assert.equal(skyFromHour(19), "clear-night");
  assert.equal(skyFromHour(0), "clear-night");
  assert.equal(skyFromHour(4), "clear-night");
  assert.equal(skyFromHour(27), skyFromHour(3), "২৪ ঘণ্টায় ঘুরে আসে");
  assert.equal(skyFromHour(-1), "clear-night");
});

test("প্রতিটি মুডের প্যালেট সম্পূর্ণ ও বৈধ", () => {
  const hex = /^#[0-9a-f]{6}$/i;
  for (const [key, p] of Object.entries(SKY_PALETTES)) {
    assert.ok(p.label.length > 0, `${key}: label`);
    for (const k of ["bg", "glow", "fg", "meta"]) assert.match(p[k], hex, `${key}.${k}`);
    assert.match(p.muted, /^#[0-9a-f]{6}$/i, `${key}.muted`);
    assert.match(p.line, /^rgba\(/, `${key}.line`);
    assert.match(p.chip, /^rgba\(/, `${key}.chip`);
    assert.equal(typeof p.dark, "boolean", `${key}.dark`);
  }
  // বন্ধ থাকলে অ্যাপের আসল theme-color-ই থাকে
  assert.equal(SKY_PALETTES.default.meta, "#04795a");
});

test("skyCssVars/hexToRgba: inline CSS ভেরিয়েবল", () => {
  assert.equal(hexToRgba("#16213f", 0.92), "rgba(22, 33, 63, 0.92)");
  assert.equal(hexToRgba("ffffff", 1), "rgba(255, 255, 255, 1)");
  assert.equal(hexToRgba("not-a-color", 1), "not-a-color", "অচেনা ইনপুট অপরিবর্তিত");
  const vars = skyCssVars(SKY_PALETTES["clear-night"]);
  assert.equal(vars["--tb-bg"], "rgba(22, 33, 63, 0.92)");
  assert.equal(vars["--tb-bg-solid"], "#16213f");
  assert.equal(vars["--tb-fg"], "#eef2ff");
  assert.match(vars["--tb-sheen"], /0\.07\)$/, "গাঢ় প্যালেটে হালকা ঝিলিক");
  assert.match(skyCssVars(SKY_PALETTES.sunny)["--tb-sheen"], /0\.55\)$/);
});

test("describeWeather: বাংলা বর্ণনা ও আইকন", () => {
  assert.deepEqual(describeWeather(0, true), { long: "রৌদ্রোজ্জ্বল", short: "রোদ", icon: "sun" });
  assert.equal(describeWeather(0, true, 38).icon, "hot");
  assert.equal(describeWeather(0, false).icon, "moon");
  assert.equal(describeWeather(2, false).icon, "cloud-moon");
  assert.equal(describeWeather(2, true).icon, "cloud-sun");
  assert.equal(describeWeather(3, false).long, "মেঘলা আকাশ");
  assert.equal(describeWeather(95, true).long, "বজ্রঝড়");
  assert.equal(describeWeather(65, true).short, "ভারী বৃষ্টি");
  assert.equal(describeWeather(12345, true).icon, "cloud-sun", "অচেনা কোড → নিরাপদ ডিফল্ট");
});

test("toBn: ইংরেজি → বাংলা অঙ্ক, প্যাডিং অক্ষুণ্ণ", () => {
  assert.equal(toBn(2026), "২০২৬");
  assert.equal(toBn("09:05"), "০৯:০৫");
  assert.equal(toBn("abc"), "abc");
});

test("dayPeriodBn: দিনের ভাগ", () => {
  assert.equal(dayPeriodBn(4), "ভোর");
  assert.equal(dayPeriodBn(6), "সকাল");
  assert.equal(dayPeriodBn(11), "সকাল");
  assert.equal(dayPeriodBn(12), "দুপুর");
  assert.equal(dayPeriodBn(15), "বিকেল");
  assert.equal(dayPeriodBn(18), "সন্ধ্যা");
  assert.equal(dayPeriodBn(20), "রাত");
  assert.equal(dayPeriodBn(0), "রাত");
  assert.equal(dayPeriodBn(3), "রাত");
});

test("zonedParts/formatBnClock: ঢাকার সময়াঞ্চলে বার-তারিখ-সময় (ডিভাইসের TZ যা-ই হোক)", () => {
  // 2026-09-20T15:04:09Z == ঢাকায় রবিবার ২০ সেপ্টেম্বর রাত ৯:০৪:০৯
  const d = new Date("2026-09-20T15:04:09Z");
  const z = zonedParts(d, "Asia/Dhaka");
  assert.deepEqual(z, {
    year: 2026,
    month: 9,
    day: 20,
    weekday: 0,
    hour: 21,
    minute: 4,
    second: 9,
  });

  const c = formatBnClock(d, "Asia/Dhaka");
  assert.equal(c.weekday, "রবিবার");
  assert.equal(c.date, "২০ সেপ্টেম্বর");
  assert.equal(c.dateFull, "২০ সেপ্টেম্বর ২০২৬");
  assert.equal(c.period, "রাত");
  assert.equal(c.hm, "৯:০৪");
  assert.equal(c.ss, "০৯");
  assert.equal(c.hm24, "২১:০৪");
  assert.equal(c.hour, 21);

  // মধ্যরাত ও দুপুর ১২টা — ১২-ঘণ্টা ঘড়িতে «১২», কখনো «০» বা «২৪» নয়
  const midnight = formatBnClock(new Date("2026-09-20T18:00:00Z"), "Asia/Dhaka");
  assert.equal(midnight.hm, "১২:০০");
  assert.equal(midnight.period, "রাত");
  assert.equal(midnight.weekday, "সোমবার", "UTC-তে এখনো রবিবার হলেও ঢাকায় সোমবার শুরু");
  const noon = formatBnClock(new Date("2026-09-20T06:00:00Z"), "Asia/Dhaka");
  assert.equal(noon.hm, "১২:০০");
  assert.equal(noon.period, "দুপুর");
  assert.equal(noon.weekday, "রবিবার");

  // ডিভাইসের TZ নয়, দোকানের TZ — ঢাকার রাত ১১:৩০ = টোকিওর পরদিন ভোর
  const late = new Date("2026-09-20T17:30:00Z");
  assert.equal(formatBnClock(late, "Asia/Dhaka").hm24, "২৩:৩০");
  assert.equal(formatBnClock(late, "Asia/Tokyo").hm24, "০২:৩০");
  assert.equal(formatBnClock(late, "Asia/Tokyo").weekday, "সোমবার");
});

test("BN_WEEKDAYS/BN_MONTHS: রবিবার থেকে শুরু, ১২ মাস", () => {
  assert.equal(BN_WEEKDAYS.length, 7);
  assert.equal(BN_WEEKDAYS[0], "রবিবার");
  assert.equal(BN_WEEKDAYS[5], "শুক্রবার");
  assert.equal(BN_MONTHS.length, 12);
  assert.equal(BN_MONTHS[0], "জানুয়ারি");
  assert.equal(BN_MONTHS[11], "ডিসেম্বর");
});

test("agoBn: কতক্ষণ আগে", () => {
  const now = 10_000_000_000;
  assert.equal(agoBn(now, now), "এইমাত্র");
  assert.equal(agoBn(now - 20_000, now), "এইমাত্র");
  assert.equal(agoBn(now - 5 * 60_000, now), "৫ মিনিট আগে");
  assert.equal(agoBn(now - 2 * 3_600_000, now), "২ ঘণ্টা আগে");
  assert.equal(agoBn(now - 3 * 86_400_000, now), "৩ দিন আগে");
  assert.equal(agoBn(now + 60_000, now), "এইমাত্র", "ভবিষ্যৎ টাইমস্ট্যাম্পে ঋণাত্মক হয় না");
});

test("weatherUrl: Open-Meteo কোয়েরি", () => {
  const u = new URL(weatherUrl(22.38, 91.93));
  assert.equal(u.origin, "https://api.open-meteo.com");
  assert.equal(u.pathname, "/v1/forecast");
  assert.equal(u.searchParams.get("latitude"), "22.3800");
  assert.equal(u.searchParams.get("longitude"), "91.9300");
  assert.equal(u.searchParams.get("timezone"), "Asia/Dhaka");
  for (const f of [
    "temperature_2m",
    "is_day",
    "weather_code",
    "apparent_temperature",
    "relative_humidity_2m",
  ]) {
    assert.ok(u.searchParams.get("current").split(",").includes(f), f);
  }
});

test("parseWeather: আসল Open-Meteo উত্তর → CurrentWeather", () => {
  const w = parseWeather(SAMPLE, 1234);
  assert.deepEqual(w, {
    code: 3,
    isDay: false,
    tempC: 27.7,
    feelsLikeC: 34.3,
    humidity: 91,
    observedAt: "2026-09-20T21:00",
    fetchedAt: 1234,
  });
  assert.equal(skyFromWeather(w.code, w.isDay, w.tempC), "cloudy-night");
  assert.equal(describeWeather(w.code, w.isDay).short, "মেঘলা");

  // ঐচ্ছিক ফিল্ড না থাকলেও চলে
  const minimal = parseWeather({ current: { temperature_2m: 31, weather_code: 0, is_day: 1 } }, 1);
  assert.deepEqual(minimal, {
    code: 0,
    isDay: true,
    tempC: 31,
    feelsLikeC: null,
    humidity: null,
    observedAt: "",
    fetchedAt: 1,
  });

  // ভাঙা ডেটা → null (কখনো throw নয়)
  assert.equal(parseWeather(null), null);
  assert.equal(parseWeather("x"), null);
  assert.equal(parseWeather({}), null);
  assert.equal(parseWeather({ current: {} }), null);
  assert.equal(parseWeather({ current: { temperature_2m: "31", weather_code: 0 } }), null);
  assert.equal(parseWeather({ current: { temperature_2m: 31, weather_code: Number.NaN } }), null);
});

test("isWeatherFresh/isWeatherUsable: ৩০ মিনিট ফ্রেশ, ৩ ঘণ্টা ব্যবহারযোগ্য", () => {
  const now = 5_000_000_000;
  const w = parseWeather(SAMPLE, now);
  assert.equal(isWeatherFresh(w, now + 29 * 60_000), true);
  assert.equal(isWeatherFresh(w, now + 31 * 60_000), false);
  assert.equal(isWeatherUsable(w, now + 2 * 3_600_000), true);
  assert.equal(isWeatherUsable(w, now + 4 * 3_600_000), false);
  assert.equal(isWeatherFresh(null, now), false);
  assert.equal(isWeatherUsable(null, now), false);
});

test("weather cache: localStorage-এ লেখা/পড়া, ভাঙা এন্ট্রি উপেক্ষা", () => {
  const mem = new Map();
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => void mem.set(k, v),
  };
  assert.equal(readWeatherCache(storage), null);
  const w = parseWeather(SAMPLE, 99);
  writeWeatherCache(storage, w);
  assert.ok(mem.has(WEATHER_CACHE_KEY));
  assert.deepEqual(readWeatherCache(storage), w);

  mem.set(WEATHER_CACHE_KEY, "{not json");
  assert.equal(readWeatherCache(storage), null);
  mem.set(WEATHER_CACHE_KEY, JSON.stringify({ code: "3" }));
  assert.equal(readWeatherCache(storage), null);

  // storage নেই (SSR/প্রাইভেট মোড) → নিরাপদে null, setItem throw করলেও চুপচাপ
  assert.equal(readWeatherCache(null), null);
  assert.doesNotThrow(() => writeWeatherCache(null, w));
  assert.doesNotThrow(() =>
    writeWeatherCache(
      {
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceeded");
        },
      },
      w,
    ),
  );
});
