// পাসওয়ার্ড রিসেট — pure লজিকের টেস্ট।
// Node 22.18+ TypeScript type-stripping দিয়ে সরাসরি `src/lib/*.ts` ইমপোর্ট করে
// (কোনো বিল্ড স্টেপ লাগে না; CI-এর Node 22-এ চলে)।
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_OVERRIDE_KEY,
  expectedPassword,
  findAccountByIdentity,
  isUsingDefaultPassword,
  performPasswordReset,
  readPasswordOverrides,
  writePasswordOverrides,
} from "../src/lib/password-reset.ts";

// shop.ts-এ import.meta.env থাকায় সেখান থেকে ইমপোর্ট না করে একই আকারের ফিক্সচার।
const ACCOUNTS = [
  { id: "u-owner-1", name: "মো. জসিম উদ্দিন", phone: "01821989717", password: "123456" },
  { id: "u-owner-2", name: "মো. ফরিদুল ইসলাম", phone: "01811808294", password: "123456" },
  { id: "u-sales-1", name: "রহিম উদ্দিন", phone: "01800000000", password: "123456" },
  { id: "u-cust-1", name: "করিম মিয়া", phone: "01900000000", password: "123456" },
];

test("findAccountByIdentity: ফোন/নাম দিয়ে খোঁজে, খোঁজে না পালে null", () => {
  assert.equal(findAccountByIdentity("01821989717", ACCOUNTS)?.id, "u-owner-1");
  // স্পেস/ড্যাশ সহ লেখা নম্বরও
  assert.equal(findAccountByIdentity(" 01821-989-717 ", ACCOUNTS)?.id, "u-owner-1");
  // ৮৮০ প্রিফিক্স
  assert.equal(findAccountByIdentity("8801800000000", ACCOUNTS)?.id, "u-sales-1");
  // নাম দিয়ে
  assert.equal(findAccountByIdentity("মো. ফরিদুল ইসলাম", ACCOUNTS)?.id, "u-owner-2");
  assert.equal(findAccountByIdentity("01777777777", ACCOUNTS), null);
  assert.equal(findAccountByIdentity("   ", ACCOUNTS), null);
});

test("performPasswordReset: সফল রিসেট — overrides-এ নতুন পাসওয়ার্ড", () => {
  const result = performPasswordReset({
    accounts: ACCOUNTS,
    identity: "01821989717",
    newPassword: "newpass",
    confirm: "newpass",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.accountId, "u-owner-1");
    assert.equal(result.overrides["u-owner-1"], "newpass");
  }
});

test("performPasswordReset: জানা নয় আইডি → এরর", () => {
  const result = performPasswordReset({
    accounts: ACCOUNTS,
    identity: "01777777777",
    newPassword: "abcd",
    confirm: "abcd",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /পাওয়া যায়নি/);
});

test("performPasswordReset: ছোট পাসওয়ার্ড বাদ", () => {
  const result = performPasswordReset({
    accounts: ACCOUNTS,
    identity: "01821989717",
    newPassword: "abc",
    confirm: "abc",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, new RegExp(String(MIN_PASSWORD_LENGTH)));
});

test("performPasswordReset: কনফার্ম মেললে না → এরর", () => {
  const result = performPasswordReset({
    accounts: ACCOUNTS,
    identity: "01821989717",
    newPassword: "abcd",
    confirm: "abce",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /মিলছে না/);
});

test("performPasswordReset: পুরনো পাসওয়ার্ডের মতো হলে বাদ", () => {
  const result = performPasswordReset({
    accounts: ACCOUNTS,
    identity: "01821989717",
    newPassword: "123456",
    confirm: "123456",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /পুরনোর মতো/);
});

test("performPasswordReset: অন্য অ্যাকাউন্টের রিসেট অটুট থাকে", () => {
  const existing = { "u-sales-1": "sales-pass" };
  const result = performPasswordReset({
    accounts: ACCOUNTS,
    identity: "01821989717",
    newPassword: "newpass",
    confirm: "newpass",
    overrides: existing,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.overrides["u-sales-1"], "sales-pass");
    assert.equal(result.overrides["u-owner-1"], "newpass");
  }
});

test("expectedPassword: রিসেট থাকলে সেট, নাহলে ডিফল্ট", () => {
  assert.equal(expectedPassword("u-owner-1", "123456"), "123456");
  assert.equal(expectedPassword("u-owner-1", "123456", { "u-owner-1": "newpass" }), "newpass");
  // খালি string override আনুমানিক হিসেবে গণ্য নয়
  assert.equal(expectedPassword("u-owner-1", "123456", { "u-owner-1": "" }), "123456");
});

test("isUsingDefaultPassword: ফ্যাক্টরি পাস হলে প্রথম-লগইন পরিবর্তন চালায়", () => {
  // override ছাড়া → ডিফল্টে আছে
  assert.equal(isUsingDefaultPassword("u-owner-1", "123456"), true);
  // অন্য অ্যাকাউন্টের override → এই অ্যাকাউন্ট এখনো ডিফল্টে
  assert.equal(isUsingDefaultPassword("u-owner-1", "123456", { "u-owner-2": "abc" }), true);
  // নিজের override → আর ডিফল্টে নেই
  assert.equal(isUsingDefaultPassword("u-owner-1", "123456", { "u-owner-1": "newpass" }), false);
  // override ডিফল্টের সমান লেখা হলেও (আসলে সম্ভব না) ডিফল্টেই আছে
  assert.equal(isUsingDefaultPassword("u-owner-1", "123456", { "u-owner-1": "123456" }), true);
});

test("localStorage round-trip: write → read, দুরূপ JSON-এ {}", () => {
  const storage = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => void storage.set(k, String(v)),
    },
  };
  try {
    assert.deepEqual(readPasswordOverrides(), {});
    writePasswordOverrides({ "u-owner-1": "newpass" });
    assert.equal(readPasswordOverrides()["u-owner-1"], "newpass");

    storage.set(PASSWORD_OVERRIDE_KEY, "{invalid json");
    assert.deepEqual(readPasswordOverrides(), {});
    storage.set(PASSWORD_OVERRIDE_KEY, "[1,2,3]");
    assert.deepEqual(readPasswordOverrides(), {});
    // number/খালি value ফেলে দেওয়া হয়
    storage.set(PASSWORD_OVERRIDE_KEY, JSON.stringify({ a: "x", b: 5, c: "" }));
    assert.deepEqual(readPasswordOverrides(), { a: "x" });
  } finally {
    delete globalThis.window;
  }
});
