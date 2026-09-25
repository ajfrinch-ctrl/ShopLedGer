// পাসওয়ার্ড রিসেট — pure লজিকের টেস্ট।
// Node 22.18+ TypeScript type-stripping দিয়ে সরাসরি `src/lib/*.ts` ইমপোর্ট করে
// (কোনো বিল্ড স্টেপ লাগে না; CI-এর Node 22-এ চলে)।
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MIN_PASSWORD_LENGTH,
  MUST_CHANGE_KEY,
  PASSWORD_OVERRIDE_KEY,
  findAccountByIdentity,
  performPasswordReset,
  readMustChangeIds,
  readPasswordOverrides,
  storedPassword,
  writeMustChangeIds,
  writePasswordOverrides,
} from "../src/lib/password-reset.ts";

// shop.ts-এ import.meta.env থাকায় সেখান থেকে ইমপোর্ট না করে একই আকারের ফিক্সচার।
const ACCOUNTS = [
  { id: "AD-001", name: "Karim Uddin", username: "admin.karim", password: "karim-pass-1" },
  { id: "ST-001", name: "Rahim Mia", username: "sales.rahim", password: "rahim-pass-1" },
  { id: "C-001", name: "করিম মিয়া", username: "korimstore", password: null },
];

test("findAccountByIdentity: ইউজারনেমে খোঁজে (case-insensitive), ফোনে নয়", () => {
  assert.equal(findAccountByIdentity("admin.karim", ACCOUNTS)?.id, "AD-001");
  assert.equal(findAccountByIdentity("  ADMIN.KARIM ", ACCOUNTS)?.id, "AD-001");
  assert.equal(findAccountByIdentity("sales.rahim", ACCOUNTS)?.id, "ST-001");
  assert.equal(findAccountByIdentity("korimstore", ACCOUNTS)?.id, "C-001");
  assert.equal(findAccountByIdentity("01821989717", ACCOUNTS), null, "phone is not an identity");
  assert.equal(findAccountByIdentity("Karim Uddin", ACCOUNTS), null, "name is not an identity");
  assert.equal(findAccountByIdentity("01777777777", ACCOUNTS), null);
  assert.equal(findAccountByIdentity("   ", ACCOUNTS), null);
});

test("performPasswordReset: সফল রিসেট — overrides-এ নতুন পাসওয়ার্ড", () => {
  const result = performPasswordReset({
    accounts: ACCOUNTS,
    identity: "admin.karim",
    newPassword: "newpass",
    confirm: "newpass",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.accountId, "AD-001");
    assert.equal(result.overrides["AD-001"], "newpass");
  }
});

test("performPasswordReset: পাসওয়ার্ডহীন অ্যাকাউন্টেও প্রথম সেট হয়", () => {
  const result = performPasswordReset({
    accounts: ACCOUNTS,
    identity: "korimstore",
    newPassword: "first-pass",
    confirm: "first-pass",
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.overrides["C-001"], "first-pass");
});

test("performPasswordReset: জানা নয় ইউজারনেম → এরর", () => {
  const result = performPasswordReset({
    accounts: ACCOUNTS,
    identity: "nobody.here",
    newPassword: "abcd",
    confirm: "abcd",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /পাওয়া যায়নি/);
});

test("performPasswordReset: ছোট পাসওয়ার্ড বাদ", () => {
  const result = performPasswordReset({
    accounts: ACCOUNTS,
    identity: "admin.karim",
    newPassword: "abc",
    confirm: "abc",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, new RegExp(String(MIN_PASSWORD_LENGTH)));
});

test("performPasswordReset: কনফার্ম মেললে না → এরর", () => {
  const result = performPasswordReset({
    accounts: ACCOUNTS,
    identity: "admin.karim",
    newPassword: "abcd",
    confirm: "abce",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /মিলছে না/);
});

test("performPasswordReset: পুরনো পাসওয়ার্ডের মতো হলে বাদ", () => {
  const result = performPasswordReset({
    accounts: ACCOUNTS,
    identity: "admin.karim",
    newPassword: "karim-pass-1",
    confirm: "karim-pass-1",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /পুরনোর মতো/);
});

test("performPasswordReset: অন্য অ্যাকাউন্টের রিসেট অটুট থাকে", () => {
  const existing = { "ST-001": "sales-pass" };
  const result = performPasswordReset({
    accounts: ACCOUNTS,
    identity: "admin.karim",
    newPassword: "newpass",
    confirm: "newpass",
    overrides: existing,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.overrides["ST-001"], "sales-pass");
    assert.equal(result.overrides["AD-001"], "newpass");
  }
});

test("storedPassword: সেট না থাকলে null — কোনো ডিফল্ট নেই", () => {
  assert.equal(storedPassword("AD-001", {}), null);
  assert.equal(storedPassword("AD-001", { "AD-001": "newpass" }), "newpass");
  // খালি string override আনুমানিক হিসেবে গণ্য নয়
  assert.equal(storedPassword("AD-001", { "AD-001": "" }), null);
});

test("localStorage round-trip: write → read, দুরূপ JSON-এ {} / []", () => {
  const storage = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => void storage.set(k, String(v)),
    },
  };
  try {
    assert.deepEqual(readPasswordOverrides(), {});
    writePasswordOverrides({ "AD-001": "newpass" });
    assert.equal(readPasswordOverrides()["AD-001"], "newpass");

    storage.set(PASSWORD_OVERRIDE_KEY, "{invalid json}");
    assert.deepEqual(readPasswordOverrides(), {});
    storage.set(PASSWORD_OVERRIDE_KEY, "[1,2,3]");
    assert.deepEqual(readPasswordOverrides(), {});
    // number/খালি value ফেলে দেওয়া হয়
    storage.set(PASSWORD_OVERRIDE_KEY, JSON.stringify({ a: "x", b: 5, c: "" }));
    assert.deepEqual(readPasswordOverrides(), { a: "x" });

    assert.deepEqual(readMustChangeIds(), []);
    writeMustChangeIds(["AD-001", "ST-001"]);
    assert.deepEqual(readMustChangeIds(), ["AD-001", "ST-001"]);
    storage.set(MUST_CHANGE_KEY, "{invalid json}");
    assert.deepEqual(readMustChangeIds(), []);
    storage.set(MUST_CHANGE_KEY, JSON.stringify({ a: 1 }));
    assert.deepEqual(readMustChangeIds(), []);
    storage.set(MUST_CHANGE_KEY, JSON.stringify(["a", 5, "", null]));
    assert.deepEqual(readMustChangeIds(), ["a"]);
  } finally {
    delete globalThis.window;
  }
});
