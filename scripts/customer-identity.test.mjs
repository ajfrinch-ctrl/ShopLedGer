import assert from "node:assert/strict";
import { test } from "node:test";
import { customerInput, customerPatch } from "../src/lib/customer-identity.ts";
import { isBangladeshMobile, normalizePhone, whatsappNumber } from "../src/lib/format.ts";

const customer = {
  id: "c-legacy",
  name: "করিম",
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
    assert.throws(() => customerInput({ ...customer, phone }, [customer]), /আগে থেকেই/);
    assert.equal(whatsappNumber(phone), "8801712345678");
  }
});

test("new customers require a valid, non-duplicate mobile", () => {
  for (const phone of ["", "abc", "01212345678", "01712345"]) {
    assert.throws(() => customerInput({ ...customer, phone }, []));
  }
  assert.equal(customerInput({ ...customer, phone: "+8801712345678" }, []).phone, customer.phone);
});

test("runtime/admin patches cannot change phone, ID or creation date", () => {
  for (const patch of [{ phone: "01812345678" }, { id: "new-id" }, { createdAt: "2026-09-13" }]) {
    assert.throws(() => customerPatch(customer, patch), /পরিবর্তন করা যাবে না/);
  }
  assert.deepEqual(customerPatch(customer, { phone: "+8801712345678", name: " করিম মিয়া " }), {
    name: "করিম মিয়া",
  });
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
