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
      clear: () => store.clear(),
    },
    configurable: true,
  });
}

import { db } from "../src/lib/db";
import {
  createStaffUser,
  resetStaffPassword,
  toggleStaffStatus,
  unlockStaffUser,
  completeFirstLoginPasswordChange,
  normalizePhone,
  useAuthStore,
} from "../src/stores/authStore";

test.beforeEach(async () => {
  await db.delete();
  await db.open();
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false, error: null });

  // Seed default branch
  await db.branches.add({
    id: "branch-test-1",
    name: "মডেল শাখা",
    organization: "মেসার্স মডেল এন্টারপ্রাইজ",
    address: "চকবাজার, চট্টগ্রাম",
    phone: "01812345678",
    is_active: true,
    created_at: new Date().toISOString(),
  });
});

test("createStaffUser: ডিফল্ট ১২৩৪৫৬ পাসওয়ার্ড এবং ১ম লগইনে পরিবর্তন বাধ্যতামূলক", async () => {
  const res = await createStaffUser({
    name: "ম্যানেজার মামুন",
    phone: "01711223344",
    branch_id: "branch-test-1",
  });
  assert.equal(res.ok, true);
  assert.ok(res.user);
  assert.equal(res.user?.role, "staff");
  assert.equal(res.user?.branch_id, "branch-test-1");
  assert.equal(res.user?.is_active, true);
  assert.equal(res.user?.must_change_password, true); // ১ম লগইনে চেঞ্জ বাধ্যতামূলক
  assert.equal(res.user?.failed_login_attempts, 0);

  // ডিফল্ট 123456 দিয়ে লগইন সম্ভব
  const loginSuccess = await useAuthStore.getState().login("01711223344", "123456");
  assert.equal(loginSuccess, true);
  assert.equal(useAuthStore.getState().user?.must_change_password, true);
});

test("completeFirstLoginPasswordChange: ১ম লগইনে পাসওয়ার্ড পরিবর্তন সম্পন্ন", async () => {
  await createStaffUser({
    name: "ম্যানেজার মামুন",
    phone: "01711223344",
    branch_id: "branch-test-1",
  });
  await useAuthStore.getState().login("01711223344", "123456");
  const user = useAuthStore.getState().user;
  assert.equal(user?.must_change_password, true);

  // ছোট পাসওয়ার্ড দিলে ব্যর্থ
  const failRes = await completeFirstLoginPasswordChange(user!.id, "123");
  assert.equal(failRes.ok, false);

  // সঠিক নতুন পাসওয়ার্ড
  const okRes = await completeFirstLoginPasswordChange(user!.id, "secure999");
  assert.equal(okRes.ok, true);

  const updatedDb = await db.users.get(user!.id);
  assert.equal(updatedDb?.must_change_password, false);

  // পরবর্তী লগইনে আর must_change_password থাকবে না
  useAuthStore.getState().logout();
  const relogin = await useAuthStore.getState().login("01711223344", "secure999");
  assert.equal(relogin, true);
  assert.equal(useAuthStore.getState().user?.must_change_password, false);
});

test("৫ বার ভুল পার্স/পাসওয়ার্ড দিলে অ্যাকাউন্ট স্বয়ংক্রিয়ভাবে লক হওয়া এবং মালিকের ১ ক্লিকে আনলক", async () => {
  await createStaffUser({
    name: "ম্যানেজার রফিক",
    phone: "01811223344",
    password: "correctpassword",
    branch_id: "branch-test-1",
  });

  // ১ থেকে ৪ বার ভুল পাসওয়ার্ড
  for (let i = 1; i <= 4; i++) {
    const ok = await useAuthStore.getState().login("01811223344", "wrongpass");
    assert.equal(ok, false);
    assert.ok(useAuthStore.getState().error?.includes("পাসওয়ার্ড ভুল"));
    assert.ok(useAuthStore.getState().error?.includes(`${5 - i} বার`));
  }

  // ৫ম বার ভুল পাসওয়ার্ড — অ্যাকাউন্ট পুরোপুরি লক হয়ে যাবে
  const fifthAttempt = await useAuthStore.getState().login("01811223344", "wrongpass");
  assert.equal(fifthAttempt, false);
  assert.ok(useAuthStore.getState().error?.includes("লক"));

  const lockedUser = await db.users.where("phone").equals("01811223344").first();
  assert.equal(lockedUser?.is_active, false);
  assert.equal(lockedUser?.failed_login_attempts, 5);

  // ৬ষ্ঠ বার সঠিক পাসওয়ার্ড দিলেও ঢুকতে পারবে না কারণ অ্যাকাউন্ট লক
  const correctWhileLocked = await useAuthStore.getState().login("01811223344", "correctpassword");
  assert.equal(correctWhileLocked, false);
  assert.ok(useAuthStore.getState().error?.includes("লক"));

  // মালিক বা সিস্টেম অ্যাডমিন ১ ক্লিকে আনলক করলেন
  const unlockRes = await unlockStaffUser(lockedUser!.id);
  assert.equal(unlockRes.ok, true);

  const unlockedUser = await db.users.get(lockedUser!.id);
  assert.equal(unlockedUser?.is_active, true);
  assert.equal(unlockedUser?.failed_login_attempts, 0);

  // আনলক হওয়ার পর সঠিক পাসওয়ার্ড দিয়ে সফল লগইন
  const loginAfterUnlock = await useAuthStore.getState().login("01811223344", "correctpassword");
  assert.equal(loginAfterUnlock, true);
});

test("resetStaffPassword: মালিক ডিফল্ট ১২৩৪৫৬ রিসেট করলে আনলক হয় ও ১ম লগইনে পরিবর্তনের শর্ত যুক্ত হয়", async () => {
  const created = await createStaffUser({
    name: "ম্যানেজার সজীব",
    phone: "01611223344",
    password: "userpassword",
    branch_id: "branch-test-1",
  });

  // অ্যাকাউন্ট ৫ বার ভুল দিয়ে লক করা হলো
  for (let i = 0; i < 5; i++) {
    await useAuthStore.getState().login("01611223344", "badpass");
  }
  let u = await db.users.get(created.user!.id);
  assert.equal(u?.is_active, false);

  // মালিক ডিফল্ট 123456 রিসেট করলেন
  const resetRes = await resetStaffPassword(created.user!.id, "123456");
  assert.equal(resetRes.ok, true);

  u = await db.users.get(created.user!.id);
  assert.equal(u?.is_active, true); // আনলক
  assert.equal(u?.failed_login_attempts, 0); // রিসেট
  assert.equal(u?.must_change_password, true); // প্রথম লগইনে চেঞ্জ করতে হবে

  // ১২৩৪৫৬ দিয়ে লগইন কাজ করবে
  const loginSuccess = await useAuthStore.getState().login("01611223344", "123456");
  assert.equal(loginSuccess, true);
});

test("toggleStaffStatus: কর্মী অ্যাকাউন্ট সক্রিয় বা নিষ্ক্রিয় টগল করা", async () => {
  const created = await createStaffUser({
    name: "ম্যানেজার আরিফ",
    phone: "01511223344",
    password: "password123",
    branch_id: "branch-test-1",
  });
  assert.equal(created.ok, true);

  // নিষ্ক্রিয় করা
  const toggleOff = await toggleStaffStatus(created.user!.id);
  assert.equal(toggleOff.ok, true);
  assert.equal(toggleOff.is_active, false);

  const userOff = await db.users.get(created.user!.id);
  assert.equal(userOff?.is_active, false);

  // পুনরায় সক্রিয় করা
  const toggleOn = await toggleStaffStatus(created.user!.id);
  assert.equal(toggleOn.ok, true);
  assert.equal(toggleOn.is_active, true);

  const userOn = await db.users.get(created.user!.id);
  assert.equal(userOn?.is_active, true);
});

test("হোয়াটসঅ্যাপে তথ্য পাঠানো ও নম্বর ফরম্যাটিং যাচাই", () => {
  const phone = "01711223344";
  const clean = normalizePhone(phone);
  assert.equal(clean, "01711223344");

  const branchName = "আগ্রাবাদ শাখা";
  const staffName = "করিম সাহেব";
  const pass = "123456";

  const text = `আসসালামু আলাইকুম ${staffName},\nShopLedGer-এ আপনার "${branchName}" শাখার অ্যাকাউন্ট প্রস্তুত:\n\n📱 মোবাইল: ${phone}\n🔑 প্রাথমিক পাসওয়ার্ড: ${pass}\n\n⚠️ প্রথমবার লগইন করার পর অবশ্যই আপনার নিজস্ব নতুন পাসওয়ার্ড সেট করে নিবেন।\nধন্যবাদ!`;
  const url = `https://wa.me/88${clean}?text=${encodeURIComponent(text)}`;

  assert.ok(url.includes("8801711223344"));
  assert.ok(url.includes(encodeURIComponent("123456")));
  assert.ok(url.includes(encodeURIComponent("আগ্রাবাদ শাখা")));
});
