import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";

if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => void store.clear(),
    },
    configurable: true,
  });
}

import { db } from "../src/lib/db";
import { ensureOwnerAccounts, ensureShopProfileDefaults, useAuthStore } from "../src/stores/authStore";
import { reminderWhatsAppLink } from "../src/lib/customerAccount";
import { canEditStaffIds, canSeeProfit, inUserBranch } from "../src/lib/roles";
import {
  DEFAULT_SHOP_PROFILE,
  OWNER_DEFAULT_PASSWORD,
  OWNER_PHONES,
  SHOP_LOGO_PATH,
  isOwnerPhone,
  phoneNumbers,
  primaryDialNumber,
  shopLogoUrl,
  shopPhoneLabel,
} from "../src/lib/shopProfile";

test.beforeEach(async () => {
  await db.delete();
  await db.open();
});

test("দোকানের ডিফল্ট তথ্য — নাম, ঠিকানা ও দুটো মোবাইল নম্বর", () => {
  assert.equal(DEFAULT_SHOP_PROFILE.organization, "কর্ণফুলী সেলস সেন্টার");
  assert.match(DEFAULT_SHOP_PROFILE.address, /বোয়ালখালী, চট্টগ্রাম$/);
  assert.deepEqual(DEFAULT_SHOP_PROFILE.phones, ["01821989717", "01811808294"]);
  assert.equal(shopPhoneLabel(), "01821989717, 01811808294");
});

test("নতুন ইনস্টলে ডিফল্ট শাখায় দোকানের তথ্য বসে (প্যাডে সাথে সাথে দেখা যায়)", async () => {
  await useAuthStore.getState().initialize();
  const branch = await db.branches.get("branch-1");
  assert.equal(branch?.organization, "কর্ণফুলী সেলস সেন্টার");
  assert.equal(branch?.name, "প্রধান শাখা");
  assert.match(branch?.address || "", /আমুচিয়া/);
  assert.equal(branch?.phone, "01821989717, 01811808294");
  // দোকানের লোগোও সাথে সাথে বসে — প্যাডে লেটারহেড হিসেবে দেখা যায়
  assert.equal(branch?.logo, shopLogoUrl());
  assert.match(branch?.logo || "", /brand\/karnaphuli-mark\.png$/);
  assert.equal(SHOP_LOGO_PATH, "brand/karnaphuli-mark.png");
});

test("পুরোনো ইনস্টলে শুধু খালি ফিল্ড পূরণ হয় — মালিকের সেট করা তথ্য অটুট থাকে", async () => {
  await db.branches.add({
    id: "branch-1",
    name: "আমুচিয়া শাখা",
    address: "",
    phone: "",
    is_active: true,
    created_at: new Date().toISOString(),
  });
  await db.branches.add({
    id: "branch-2",
    name: "নিজে সেট করা শাখা",
    organization: "আমার দোকান",
    address: "নিজের ঠিকানা",
    phone: "01711111111",
    is_active: true,
    created_at: new Date().toISOString(),
  });

  await ensureShopProfileDefaults();

  const main = await db.branches.get("branch-1");
  assert.equal(main?.organization, "কর্ণফুলী সেলস সেন্টার");
  assert.equal(main?.name, "আমুচিয়া শাখা"); // মালিকের দেওয়া নাম বদলায় না
  assert.match(main?.address || "", /বুড়া মসজিদ রোড/);
  assert.equal(main?.phone, "01821989717, 01811808294");
  assert.equal(main?.logo, shopLogoUrl()); // লোগো খালি থাকলে ডিফল্ট বসে

  const custom = await db.branches.get("branch-2");
  assert.equal(custom?.organization, "আমার দোকান");
  assert.equal(custom?.address, "নিজের ঠিকানা");
  assert.equal(custom?.phone, "01711111111");
});

test("একাধিক নম্বর আলাদা করা যায় — WhatsApp/কলে প্রথম নম্বর ব্যবহার হয়", () => {
  assert.deepEqual(phoneNumbers("01821989717, 01811808294"), ["01821989717", "01811808294"]);
  assert.deepEqual(phoneNumbers("019-1111 1111"), ["01911111111"]); // স্পেস = একই নম্বর
  assert.deepEqual(phoneNumbers(""), []);
  assert.equal(primaryDialNumber("01821989717, 01811808294"), "8801821989717");

  // দোকানের ফোনে দুটো নম্বর থাকলেও wa.me লিংক প্রথম নম্বরেই তৈরি হয়
  const link = reminderWhatsAppLink("পরীক্ষা", "01821989717, 01811808294");
  assert.equal(link.startsWith("https://wa.me/8801821989717?text="), true);
  assert.equal(reminderWhatsAppLink("হ্যালো", "01911111111").startsWith("https://wa.me/8801911111111?text="), true);
});

test("দুই মালিকের নম্বরেই মালিক (owner) আইডি — লগইন করে পূর্ণ ক্ষমতা", async () => {
  await useAuthStore.getState().initialize();

  assert.deepEqual(OWNER_PHONES, ["01811808294", "01821989717"]);

  for (const phone of OWNER_PHONES) {
    const user = await db.users.where("phone").equals(phone).first();
    assert.equal(user?.role, "owner", `${phone} মালিক-লেভেল নয়`);
    assert.equal(user?.is_active, true);
    assert.equal(user?.must_change_password, true); // ১ম লগইনে পাসওয়ার্ড বদল বাধ্যতামূলক
  }

  // দুই নম্বর দিয়েই লগইন হয় এবং দুজনেই মালিক
  for (const phone of OWNER_PHONES) {
    const ok = await useAuthStore.getState().login(phone, OWNER_DEFAULT_PASSWORD);
    assert.equal(ok, true, `${phone} দিয়ে লগইন হয়নি`);
    assert.equal(useAuthStore.getState().user?.role, "owner");
    await useAuthStore.getState().logout();
  }

  // মালিকের ক্ষমতা: সব শাখা + লাভ + কর্মী আইডি
  assert.equal(inUserBranch({ role: "owner" }, "branch-2"), true);
  assert.equal(canSeeProfit("owner"), true);
  assert.equal(canEditStaffIds("owner"), true);
  assert.equal(isOwnerPhone("+8801821989717"), true);
  assert.equal(isOwnerPhone("01900000000"), false);
});

test("পুরোনো ইনস্টলেও দুই মালিকের আইডি তৈরি হয় — আগের অ্যাকাউন্ট অটুট থাকে", async () => {
  await db.users.add({
    id: "owner-old",
    name: "পুরোনো মালিক",
    phone: "01700000000",
    password_hash: "x",
    role: "owner",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  await ensureOwnerAccounts();

  for (const phone of OWNER_PHONES) {
    const user = await db.users.where("phone").equals(phone).first();
    assert.equal(user?.role, "owner");
  }

  // আগের মালিক যেমন ছিল তেমনই
  const old = await db.users.get("owner-old");
  assert.equal(old?.phone, "01700000000");

  // আবার চালালে ডুপ্লিকেট তৈরি হয় না
  await ensureOwnerAccounts();
  assert.equal(await db.users.where("role").equals("owner").count(), 3);
});
