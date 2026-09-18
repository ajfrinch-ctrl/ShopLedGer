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
  updateStaffUser,
  deleteStaffUser,
  resetStaffPassword,
  toggleStaffStatus,
  unlockStaffUser,
  completeFirstLoginPasswordChange,
  normalizePhone,
  normalizeUsername,
  suggestStaffUsername,
  useAuthStore,
  type AuthUser,
} from "../src/stores/authStore";

const setActor = (user: AuthUser | null) => useAuthStore.setState({ user, isAuthenticated: !!user, isLoading: false, error: null });

const ownerActor: AuthUser = {
  id: "owner-actor",
  name: "মালিক",
  phone: "01700000000",
  role: "owner",
};

/** টেস্টে ব্যবহারের জন্য মালিককে ডিবিতে বসানো */
async function seedOwner() {
  await db.users.add({
    id: "owner-actor",
    name: "মালিক",
    phone: "01700000000",
    password_hash: "x",
    role: "owner",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  setActor(ownerActor);
}

test.beforeEach(async () => {
  await db.delete();
  await db.open();
  setActor(null);

  await db.branches.bulkAdd([
    {
      id: "branch-test-1",
      name: "আগ্রাবাদ শাখা",
      organization: "মেসার্স মডেল এন্টারপ্রাইজ",
      address: "চকবাজার, চট্টগ্রাম",
      phone: "01812345678",
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: "branch-test-2",
      name: "চকবাজার শাখা",
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ]);
});

test("createStaffUser: ইউজারনেম আইডি, ডিফল্ট পাস 123456, ১ম লগইনে বাধ্যতামূলক পরিবর্তন, একাধিক শাখা", async () => {
  const res = await createStaffUser({
    name: "ব্যবস্থাপক মামুন",
    username: "agrabad_manager",
    phone: "01711223344",
    role: "manager",
    branch_ids: ["branch-test-1", "branch-test-2"],
  });
  assert.equal(res.ok, true);
  assert.ok(res.user);
  assert.equal(res.user?.role, "manager");
  assert.equal(res.user?.username, "agrabad_manager");
  assert.deepEqual(res.user?.branch_ids, ["branch-test-1", "branch-test-2"]);
  assert.equal(res.user?.branch_id, "branch-test-1"); // প্রধান শাখা = প্রথমটি
  assert.equal(res.user?.is_active, true);
  assert.equal(res.user?.must_change_password, true);
  assert.equal(res.user?.failed_login_attempts, 0);

  // ইউজারনেম দিয়ে লগইন
  const loginByUsername = await useAuthStore.getState().login("agrabad_manager", "123456");
  assert.equal(loginByUsername, true);
  assert.equal(useAuthStore.getState().user?.username, "agrabad_manager");
  assert.equal(useAuthStore.getState().user?.must_change_password, true);

  // ফোন নম্বর দিয়েও লগইন চলবে
  useAuthStore.getState().logout();
  const loginByPhone = await useAuthStore.getState().login("01711223344", "123456");
  assert.equal(loginByPhone, true);
});

test("createStaffUser: ইউজারনেম ছাড়া সেলস ম্যান — শুধু ইউজারনেম দিয়ে ঢোকা যায়", async () => {
  const res = await createStaffUser({
    name: "সেলস ম্যান কামাল",
    username: "agrabad_salesman",
    role: "salesman",
    branch_ids: ["branch-test-1"],
  });
  assert.equal(res.ok, true);
  assert.equal(res.user?.phone, "");
  assert.equal(res.user?.role, "salesman");

  // ফোন নেই — ইউজারনেমেই লগইন
  const ok = await useAuthStore.getState().login("agrabad_salesman", "123456");
  assert.equal(ok, true);
});

test("createStaffUser: ইউজারনেমের বৈধতা ও ইউনিকনেস", async () => {
  // খারাপ ফরম্যাট
  const bad = await createStaffUser({ name: "কেউ", username: "Bad Name!", role: "salesman", branch_ids: ["branch-test-1"] });
  assert.equal(bad.ok, false);
  assert.ok(bad.error?.includes("ইউজারনেম"));

  // ডুপ্লিকেট
  await createStaffUser({ name: "এক", username: "same_id", role: "salesman", branch_ids: ["branch-test-1"] });
  const dup = await createStaffUser({ name: "দুই", username: "same_id", role: "manager", branch_ids: ["branch-test-1"] });
  assert.equal(dup.ok, false);
  assert.ok(dup.error?.includes("আগেই"));

  // শাখা ছাড়া যাবে না
  const noBranch = await createStaffUser({ name: "তিন", username: "nobranch_id", role: "salesman", branch_ids: [] });
  assert.equal(noBranch.ok, false);
});

test("suggestStaffUsername: ইউনিক প্রস্তাব দেয়", async () => {
  const first = await suggestStaffUsername("আগ্রাবাদ শাখা", "salesman");
  assert.equal(first, "agrabad_salesman");
  await createStaffUser({ name: "এক", username: first, role: "salesman", branch_ids: ["branch-test-1"] });
  const second = await suggestStaffUsername("আগ্রাবাদ শাখা", "salesman");
  assert.equal(second, "agrabad_salesman2");
});

test("অনুমতি: ব্যবস্থাপক শুধু নিজের শাখার সেলস ম্যান খুলতে পারে; মালিক সব পারে", async () => {
  await seedOwner();

  // মালিক ব্যবস্থাপক খুললেন (নিজের actor দিয়ে)
  const managerRes = await createStaffUser({
    name: "ব্যবস্থাপক রফিক",
    username: "agrabad_manager",
    role: "manager",
    branch_ids: ["branch-test-1"],
  });
  assert.equal(managerRes.ok, true);

  // actor = ব্যবস্থাপক (branch-test-1)
  const managerActor: AuthUser = {
    id: managerRes.user!.id,
    name: "ব্যবস্থাপক রফিক",
    phone: "",
    username: "agrabad_manager",
    role: "manager",
    branch_ids: ["branch-test-1"],
  };
  setActor(managerActor);

  // নিজের শাখায় সেলস ম্যান — অনুমতি আছে
  const ownSalesman = await createStaffUser({
    name: "নিজের সেলস ম্যান",
    username: "agrabad_salesman1",
    role: "salesman",
    branch_ids: ["branch-test-1"],
  });
  assert.equal(ownSalesman.ok, true);

  // অন্য শাখায় সেলস ম্যান — নিষিদ্ধ
  const otherSalesman = await createStaffUser({
    name: "অন্যের সেলস ম্যান",
    username: "chokbazar_salesman1",
    role: "salesman",
    branch_ids: ["branch-test-2"],
  });
  assert.equal(otherSalesman.ok, false);
  assert.ok(otherSalesman.error?.includes("নিজের শাখা"));

  // ব্যবস্থাপক আরেক ব্যবস্থাপক খুলতে পারে না
  const anotherManager = await createStaffUser({
    name: "আরেক ব্যবস্থাপক",
    username: "agrabad_manager2",
    role: "manager",
    branch_ids: ["branch-test-1"],
  });
  assert.equal(anotherManager.ok, false);

  // সেলস ম্যান কারো আইডি খুলতে পারে না
  await createStaffUser({ name: "সেলস এক", username: "agrabad_salesman2", role: "salesman", branch_ids: ["branch-test-1"] });
  const salesmanActor: AuthUser = { ...managerActor, id: "x", name: "সেলস এক", username: "agrabad_salesman2", role: "salesman" };
  setActor(salesmanActor);
  const salesmanCreates = await createStaffUser({
    name: "নিষিদ্ধ",
    username: "agrabad_salesman3",
    role: "salesman",
    branch_ids: ["branch-test-1"],
  });
  assert.equal(salesmanCreates.ok, false);
});

test("updateStaffUser ও deleteStaffUser: শুধু মালিকের অনুমতি", async () => {
  await seedOwner();
  const created = await createStaffUser({
    name: "পুরোনো নাম",
    username: "old_id",
    role: "salesman",
    branch_ids: ["branch-test-1"],
  });
  assert.equal(created.ok, true);

  // ব্যবস্থাপক actor হলে সম্পাদনা নিষিদ্ধ
  const managerActor: AuthUser = { id: "m1", name: "ম্যানেজার", phone: "", role: "manager", branch_ids: ["branch-test-1"] };
  setActor(managerActor);
  const forbidden = await updateStaffUser({ id: created.user!.id, name: "নতুন নাম" });
  assert.equal(forbidden.ok, false);

  // মালিক actor — সম্পাদনা চলে
  setActor(ownerActor);
  const upd = await updateStaffUser({
    id: created.user!.id,
    name: "নতুন নাম",
    username: "new_id",
    phone: "01911223344",
    branch_ids: ["branch-test-1", "branch-test-2"],
  });
  assert.equal(upd.ok, true);
  const after = await db.users.get(created.user!.id);
  assert.equal(after?.name, "নতুন নাম");
  assert.equal(after?.username, "new_id");
  assert.equal(after?.phone, "01911223344");
  assert.deepEqual(after?.branch_ids, ["branch-test-1", "branch-test-2"]);
  assert.equal(after?.branch_id, "branch-test-1");

  // ডুপ্লিকেট ইউজারনেম নামবে না
  await createStaffUser({ name: "আরেকজন", username: "taken_id", role: "salesman", branch_ids: ["branch-test-1"] });
  const dup = await updateStaffUser({ id: created.user!.id, username: "taken_id" });
  assert.equal(dup.ok, false);

  // ডিলিট — মালিক পারবেন
  const del = await deleteStaffUser(created.user!.id);
  assert.equal(del.ok, true);
  assert.equal(await db.users.get(created.user!.id), undefined);

  // মালিকের আইডি মুছা যায় না
  const delOwner = await deleteStaffUser("owner-actor");
  assert.equal(delOwner.ok, false);
});

test("completeFirstLoginPasswordChange: ১ম লগইনে পাসওয়ার্ড পরিবর্তন সম্পন্ন", async () => {
  const created = await createStaffUser({
    name: "ব্যবস্থাপক মামুন",
    username: "agrabad_manager",
    phone: "01711223344",
    role: "manager",
    branch_ids: ["branch-test-1"],
  });
  await useAuthStore.getState().login("agrabad_manager", "123456");
  const user = useAuthStore.getState().user;
  assert.equal(user?.must_change_password, true);
  assert.equal(user?.id, created.user!.id);

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
  const relogin = await useAuthStore.getState().login("agrabad_manager", "secure999");
  assert.equal(relogin, true);
  assert.equal(useAuthStore.getState().user?.must_change_password, false);
});

test("৫ বার ভুল পার্স দিলে লক, মালিকের ১ ক্লিকে আনলক", async () => {
  await seedOwner();
  const created = await createStaffUser({
    name: "সেলস রফিক",
    username: "agrabad_salesman",
    phone: "01811223344",
    password: "correctpassword",
    role: "salesman",
    branch_ids: ["branch-test-1"],
  });

  for (let i = 1; i <= 4; i++) {
    const ok = await useAuthStore.getState().login("agrabad_salesman", "wrongpass");
    assert.equal(ok, false);
    assert.ok(useAuthStore.getState().error?.includes("পাসওয়ার্ড ভুল"));
    assert.ok(useAuthStore.getState().error?.includes(`${5 - i} বার`));
  }

  const fifthAttempt = await useAuthStore.getState().login("agrabad_salesman", "wrongpass");
  assert.equal(fifthAttempt, false);
  assert.ok(useAuthStore.getState().error?.includes("লক"));

  const lockedUser = await db.users.get(created.user!.id);
  assert.equal(lockedUser?.is_active, false);
  assert.equal(lockedUser?.failed_login_attempts, 5);

  const correctWhileLocked = await useAuthStore.getState().login("01811223344", "correctpassword");
  assert.equal(correctWhileLocked, false);
  assert.ok(useAuthStore.getState().error?.includes("লক"));

  const unlockRes = await unlockStaffUser(lockedUser!.id);
  assert.equal(unlockRes.ok, true);

  const unlockedUser = await db.users.get(lockedUser!.id);
  assert.equal(unlockedUser?.is_active, true);
  assert.equal(unlockedUser?.failed_login_attempts, 0);

  const loginAfterUnlock = await useAuthStore.getState().login("01811223344", "correctpassword");
  assert.equal(loginAfterUnlock, true);
});

test("resetStaffPassword: রিসেটে আনলক + ১ম লগইনের শর্ত; ব্যবস্থাপক শুধু সেলস ম্যানের রিসেট করতে পারে", async () => {
  await seedOwner();
  const created = await createStaffUser({
    name: "সেলস সজীব",
    username: "agrabad_salesman",
    phone: "01611223344",
    password: "userpassword",
    role: "salesman",
    branch_ids: ["branch-test-1"],
  });

  for (let i = 0; i < 5; i++) {
    await useAuthStore.getState().login("agrabad_salesman", "badpass");
  }
  let u = await db.users.get(created.user!.id);
  assert.equal(u?.is_active, false);

  // মালিক ডিফল্ট রিসেট
  setActor(ownerActor);
  const resetRes = await resetStaffPassword(created.user!.id, "123456");
  assert.equal(resetRes.ok, true);

  u = await db.users.get(created.user!.id);
  assert.equal(u?.is_active, true);
  assert.equal(u?.failed_login_attempts, 0);
  assert.equal(u?.must_change_password, true);

  useAuthStore.getState().logout();
  const loginSuccess = await useAuthStore.getState().login("01611223344", "123456");
  assert.equal(loginSuccess, true);
  useAuthStore.getState().logout();

  // ব্যবস্থাপক অন্য ব্যবস্থাপকের পাসওয়ার্ড রিসেট করতে পারে না
  const manager = await createStaffUser({ name: "ম্যানেজার", username: "agrabad_manager", role: "manager", branch_ids: ["branch-test-1"] });
  const anotherManager = await createStaffUser({ name: "আরেক ম্যানেজার", username: "chokbazar_manager", role: "manager", branch_ids: ["branch-test-1"] });
  const managerActor: AuthUser = { id: manager.user!.id, name: "ম্যানেজার", phone: "", role: "manager", branch_ids: ["branch-test-1"] };
  setActor(managerActor);
  const forbiddenReset = await resetStaffPassword(anotherManager.user!.id, "123456");
  assert.equal(forbiddenReset.ok, false);

  // তবে সেলস ম্যানের রিসেট পারবে
  const okReset = await resetStaffPassword(created.user!.id, "newpass77");
  assert.equal(okReset.ok, true);
});

test("toggleStaffStatus: চালু/বন্ধ টগল; মালিক সবার, ব্যবস্থাপক শুধু নিজের শাখার সেলস ম্যানের", async () => {
  await seedOwner();
  const created = await createStaffUser({
    name: "সেলস আরিফ",
    username: "agrabad_salesman",
    role: "salesman",
    branch_ids: ["branch-test-1"],
  });
  assert.equal(created.ok, true);

  const toggleOff = await toggleStaffStatus(created.user!.id);
  assert.equal(toggleOff.ok, true);
  assert.equal(toggleOff.is_active, false);

  const userOff = await db.users.get(created.user!.id);
  assert.equal(userOff?.is_active, false);

  const toggleOn = await toggleStaffStatus(created.user!.id);
  assert.equal(toggleOn.ok, true);
  assert.equal(toggleOn.is_active, true);
});

test("normalizePhone ও normalizeUsername", () => {
  assert.equal(normalizePhone("+8801711223344"), "01711223344");
  assert.equal(normalizeUsername("  AgraBad_1 "), "agrabad_1");
});
