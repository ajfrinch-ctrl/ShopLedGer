// gভীর-লিংক ফেরানো (return-to) — pure/storage লজিকের টেস্ট।
// Node 22.18+ TypeScript type-stripping দিয়ে সরাসরি `src/lib/return-to.ts` ইমপোর্ট।
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  consumeReturnTo,
  isSafeAppPath,
  readReturnTo,
  rememberReturnTo,
  RETURN_TO_KEY,
  routeLabel,
} from "../src/lib/return-to.ts";

/** localStorage-এর মতো ছোট ইন-মেমরি স্টোর (ব্লকড/ভরা স্টোরেজও নকল করা যায়)। */
function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      data.set(key, String(value));
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

test("isSafeAppPath: শুধু অ্যাপের ভেতরের পাতা — লগইন/হোম/বাইরের ঠিকানা বাদ", () => {
  assert.equal(isSafeAppPath("/sales"), true);
  assert.equal(isSafeAppPath("/customers/c-1"), true);
  assert.equal(isSafeAppPath("/reports?kind=daily"), true);
  // লগইনের পরে ফেরানোর মানে নেই
  assert.equal(isSafeAppPath("/"), false);
  assert.equal(isSafeAppPath("/login"), false);
  // open redirect / protocol smuggling বন্ধ
  assert.equal(isSafeAppPath("//evil.example.com"), false);
  assert.equal(isSafeAppPath("https://evil.example.com"), false);
  assert.equal(isSafeAppPath("javascript:alert(1)"), false);
  assert.equal(isSafeAppPath("/sales\\..\\login"), false);
  assert.equal(isSafeAppPath(""), false);
  assert.equal(isSafeAppPath("   "), false);
  assert.equal(isSafeAppPath(null), false);
  assert.equal(isSafeAppPath(42), false);
  assert.equal(isSafeAppPath(`/${"a".repeat(400)}`), false);
});

test("remember → read → consume: একবারই ব্যবহার, তারপর মুছে যায়", () => {
  const store = memoryStorage();
  rememberReturnTo("/sales", store);
  assert.equal(store.data.get(RETURN_TO_KEY), "/sales");
  assert.equal(readReturnTo(store), "/sales");
  // read করে মুছে যায় না (হিন্ট দেখানোর জন্য)
  assert.equal(readReturnTo(store), "/sales");
  assert.equal(consumeReturnTo(store), "/sales");
  assert.equal(consumeReturnTo(store), null);
  assert.equal(store.data.has(RETURN_TO_KEY), false);
});

test("unsafe path সেভ হয় না; আগের নিরাপদ মান নষ্ট হয় না", () => {
  const store = memoryStorage();
  rememberReturnTo("/sales", store);
  rememberReturnTo("/login", store);
  rememberReturnTo("//evil.example.com", store);
  assert.equal(readReturnTo(store), "/sales");
});

test("স্টোরেজে পুরনো/নষ্ট মান থাকলে মুছে ফেলে null", () => {
  const bad = memoryStorage({ [RETURN_TO_KEY]: "//evil.example.com" });
  assert.equal(readReturnTo(bad), null);
  assert.equal(bad.data.has(RETURN_TO_KEY), false);
  const junk = memoryStorage({ [RETURN_TO_KEY]: "not-a-path" });
  assert.equal(readReturnTo(junk), null);
});

test("স্টোরেজ না থাকলে (SSR/প্রাইভেট মোড) কিছুই ভাঙে না", () => {
  assert.doesNotThrow(() => rememberReturnTo("/sales", null));
  assert.equal(readReturnTo(null), null);
  assert.equal(consumeReturnTo(null), null);
});

test("স্টোরেজ throw করলেও অ্যাপ চলবে (কোটা ভরা/ব্লকড)", () => {
  const broken = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  };
  assert.doesNotThrow(() => rememberReturnTo("/sales", broken));
  assert.equal(readReturnTo(broken), null);
  assert.equal(consumeReturnTo(broken), null);
});

test("routeLabel: পাতার বাংলা নাম, অজানা হলে খালি", () => {
  assert.equal(routeLabel("/sales"), "বিক্রি");
  assert.equal(routeLabel("/collections?tab=due"), "বাকি আদায়");
  assert.equal(routeLabel("/customers/c-1"), "ক্রেতা");
  assert.equal(routeLabel("/reports"), "রিপোর্ট");
  assert.equal(routeLabel("/nope"), "");
  assert.equal(routeLabel(null), "");
});
