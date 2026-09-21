import { isBangladeshMobile, normalizePhone } from "./format.ts";
import type { Customer } from "./types.ts";

type CustomerInput = Omit<Customer, "id" | "createdAt">;
export type CustomerPatch = Partial<Pick<Customer, "name" | "address" | "whatsappPhone">>;

function whatsappPhone(value = ""): string {
  if (!value.trim()) return "";
  const phone = normalizePhone(value);
  if (!isBangladeshMobile(phone)) throw new Error("সঠিক ১১ সংখ্যার WhatsApp নম্বর দিন");
  return phone;
}

export function customerInput(input: CustomerInput, existing: readonly Customer[]): CustomerInput {
  const name = input.name.trim();
  const phone = normalizePhone(input.phone);
  if (!name) throw new Error("ক্রেতার নাম দিন");
  if (!isBangladeshMobile(phone)) throw new Error("সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন");
  if (existing.some((customer) => normalizePhone(customer.phone) === phone)) {
    throw new Error("এই মোবাইল নম্বরের ক্রেতা আগে থেকেই আছে");
  }
  return {
    name,
    phone,
    address: input.address.trim(),
    whatsappPhone: whatsappPhone(input.whatsappPhone),
  };
}

/** Whitelist mutable fields, even when called with an untyped/admin payload. */
export function customerPatch(current: Customer, input: CustomerPatch): CustomerPatch {
  const payload = input as Partial<Customer>;
  if (
    (payload.phone !== undefined &&
      normalizePhone(payload.phone) !== normalizePhone(current.phone)) ||
    (payload.id !== undefined && payload.id !== current.id) ||
    (payload.createdAt !== undefined && payload.createdAt !== current.createdAt)
  ) {
    throw new Error("ক্রেতার মূল মোবাইল নম্বর ও আইডি পরিবর্তন করা যাবে না");
  }
  const patch: CustomerPatch = {};
  if (input.name !== undefined) {
    if (!input.name.trim()) throw new Error("ক্রেতার নাম দিন");
    patch.name = input.name.trim();
  }
  if (input.address !== undefined) patch.address = input.address.trim();
  if (input.whatsappPhone !== undefined) patch.whatsappPhone = whatsappPhone(input.whatsappPhone);
  return patch;
}
