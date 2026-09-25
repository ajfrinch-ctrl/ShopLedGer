import assert from "node:assert/strict";
import { test } from "node:test";
import { customerInput, customerPatch } from "../src/lib/customer-identity.ts";
import { isBangladeshMobile, normalizePhone, whatsappNumber } from "../src/lib/format.ts";

const customer = {
  id: "c-legacy",
  name: "করিম",
  username: "korimstore",
  phone: "01712345678",
  address: "ঢাকা",
  createdAt: "2026-09-12",
};

test("phone aliases normalize to one immutable transaction identity", () => {
  for (const phone of [
    "01712345678",
    "+8801712345678",
    "1712345678",
    "০১৭১২৩৪৫৬৭৮",
    "+৮৮০ ১৭১২-৩৪৫৬৭৮",
  ]) {
    assert.equal(normalizePhone(phone), customer.phone);
    assert.equal(isBangladeshMobile(phone), true);
    assert.throws(
      () => customerInput({ ...customer, username: "uniquename1", phone }, [customer]),
      /আগে থেকেই/,
    );
    assert.equal(whatsappNumber(phone), "8801712345678");
  }
});

test("new customers require a valid, non-duplicate mobile", () => {
  for (const phone of ["", "abc", "01212345678", "01712345"]) {
    assert.throws(() => customerInput({ ...customer, username: "uniquename2", phone }, []));
  }
  assert.equal(
    customerInput({ ...customer, phone: "+8801712345678" }, []).phone,
    customer.phone,
  );
});

test("new customers require a valid, non-duplicate username", () => {
  for (const username of ["", "ab", ".korim", "kori m"]) {
    assert.throws(() => customerInput({ ...customer, username, phone: "01812345678" }, []));
  }
  // একই তালিকায় ডুপ্লিকেট ইউজারনেম (case-insensitive)
  assert.throws(
    () => customerInput({ ...customer, username: "KorimStore", phone: "01812345678" }, [customer]),
    /ব্যবহৃত/,
  );
  const created = customerInput({ ...customer, username: " Rahim.BD ", phone: "01812345678" }, [
    customer,
  ]);
  assert.equal(created.username, "rahim.bd");
});

test("runtime/admin patches cannot change username, phone, ID or creation date", () => {
  for (const patch of [
    { username: "othername" },
    { phone: "01812345678" },
    { id: "new-id" },
    { createdAt: "2026-09-13" },
  ]) {
    assert.throws(() => customerPatch(customer, patch), /পরিবর্তন করা যাবে না/);
  }
  assert.deepEqual(customerPatch(customer, { phone: "+8801712345678", name: " করিম মিয়া " }), {
    name: "করিম মিয়া",
  });
  // একই ইউজারনেম (case ভিন্ন হলেও) পাঠালে সমস্যা নেই — বদলায় না
  assert.deepEqual(customerPatch(customer, { username: "KorimStore" }), {});
});

test("WhatsApp is independently editable and removable without changing the mobile", () => {
  const patch = customerPatch(customer, { whatsappPhone: "+8801812345678" });
  const updated = { ...customer, ...patch };
  assert.equal(updated.phone, customer.phone);
  assert.equal(updated.whatsappPhone, "01812345678");
  assert.equal(whatsappNumber(updated.whatsappPhone || updated.phone), "8801812345678");
  assert.deepEqual(customerPatch(updated, { whatsappPhone: "" }), { whatsappPhone: "" });
  assert.throws(() => customerPatch(updated, { whatsappPhone: "not a number" }));
});
