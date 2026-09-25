// ইউজারনেম তৈরি/যাচাই — pure লজিকের টেস্ট।
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ADMIN_PREFIX,
  firstNameSlug,
  generatePrefixedUsername,
  MANAGER_PREFIX,
  normalizeUsername,
  SALES_PREFIX,
  validateCustomerUsername,
} from "../src/lib/usernames.ts";

test("normalizeUsername: trim + lowercase", () => {
  assert.equal(normalizeUsername("  Admin.Karim "), "admin.karim");
  assert.equal(normalizeUsername("RAHIM123"), "rahim123");
});

test("firstNameSlug: শুধু নামের প্রথম অংশ, অক্ষর/সংখ্যা রেখে", () => {
  assert.equal(firstNameSlug("Karim Uddin"), "karim");
  assert.equal(firstNameSlug("  Rahim  Mia "), "rahim");
  assert.equal(firstNameSlug("মো. জসিম উদ্দিন"), "মো");
  assert.equal(firstNameSlug("রহিম উদ্দিন"), "রহিম");
  assert.equal(firstNameSlug("Jamal-123 Ahmed"), "jamal123");
  assert.equal(firstNameSlug("... !!!"), "");
});

test("generatePrefixedUsername: প্রথমটিতে নম্বর নেই, পরে 2, 3, 4 …", () => {
  const taken = new Set(["admin.karim", "admin.karim2"]);
  const isTaken = (u) => taken.has(u);
  assert.equal(generatePrefixedUsername(ADMIN_PREFIX, "Rahim Mia", isTaken), "admin.rahim");
  assert.equal(generatePrefixedUsername(ADMIN_PREFIX, "Karim Uddin", isTaken), "admin.karim3");
  assert.equal(generatePrefixedUsername(MANAGER_PREFIX, "Rahim Mia", isTaken), "manager.rahim");
  assert.equal(generatePrefixedUsername(SALES_PREFIX, "Jamal Ahmed", isTaken), "sales.jamal");
  // উপসর্গ আলাদা হলে ভিন্ন ইউজারনেম — সংঘর্ষ নয়
  assert.equal(generatePrefixedUsername(MANAGER_PREFIX, "Karim Uddin", isTaken), "manager.karim");
});

test("generatePrefixedUsername: ফাঁকা slug-এ user ফলব্যাক", () => {
  assert.equal(generatePrefixedUsername(SALES_PREFIX, "...", () => false), "sales.user");
});

test("validateCustomerUsername: ফরম্যাট ও অনন্যতা", () => {
  assert.deepEqual(validateCustomerUsername("rahim123", () => false), {
    ok: true,
    username: "rahim123",
  });
  assert.deepEqual(validateCustomerUsername(" Rahim.BD ", () => false), {
    ok: true,
    username: "rahim.bd",
  });
  assert.equal(validateCustomerUsername("", () => false).ok, false);
  assert.equal(validateCustomerUsername("ab", () => false).ok, false, "too short");
  assert.equal(validateCustomerUsername("a".repeat(31), () => false).ok, false, "too long");
  assert.equal(validateCustomerUsername(".rahim", () => false).ok, false, "leading dot");
  assert.equal(validateCustomerUsername("rahim.", () => false).ok, false, "trailing dot");
  assert.equal(validateCustomerUsername("ra him", () => false).ok, false, "space");
  const taken = validateCustomerUsername("myshop01", (u) => u === "myshop01");
  assert.equal(taken.ok, false);
  assert.match(taken.message, /ব্যবহৃত/);
});
