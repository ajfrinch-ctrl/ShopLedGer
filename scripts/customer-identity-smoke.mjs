import assert from "node:assert/strict";
import { todayKey } from "../src/lib/format.ts";

/** Public UI: generated IDs, immutable mobile and independent WhatsApp routing. */
export async function checkCustomerIdentity(page, url) {
  const key = "karnaphuli-shopledger-v1";
  const original = await page.evaluate((key) => localStorage.getItem(key), key);
  const readState = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).state, key);
  try {
    await page.goto(url + "customers");
    await page.getByRole("button", { name: "নতুন ক্রেতা", exact: true }).click();
    await page.getByPlaceholder("নাম", { exact: true }).fill("ইউনিক নম্বর পরীক্ষা");
    await page.getByPlaceholder("মোবাইল", { exact: true }).fill("০১৭১২৩৪৫৬৭৮");
    await page.getByPlaceholder("ঠিকানা", { exact: true }).fill("ঢাকা");
    await page.getByRole("button", { name: "সংরক্ষণ", exact: true }).click();
    await page
      .getByRole("heading", { name: "নতুন ক্রেতা", exact: true })
      .waitFor({ state: "hidden" });
    const state = await readState();
    const customer = state.customers.find((row) => row.phone === "01712345678");
    assert.ok(customer);
    assert.match(customer.id, new RegExp(`^C-${todayKey().slice(2).replaceAll("-", "")}\\d{3,}$`));
    await page.getByPlaceholder("নাম, আইডি বা মোবাইল").fill(customer.id);
    await page.locator(`a[href$="/customers/${customer.id}"]`).click();
    await page.getByRole("button", { name: "ক্রেতার তথ্য সম্পাদনা", exact: true }).click();
    const primary = page.getByLabel("মূল মোবাইল (অপরিবর্তনীয়)", { exact: true });
    assert.equal(await primary.inputValue(), "01712345678");
    assert.equal(await primary.evaluate((input) => input.readOnly), true);
    await page.getByLabel("আলাদা WhatsApp নম্বর (ঐচ্ছিক)").fill("+8801812345678");
    await page.getByRole("button", { name: "সংরক্ষণ", exact: true }).click();
    await page
      .getByRole("heading", { name: "ক্রেতার তথ্য সম্পাদনা", exact: true })
      .waitFor({ state: "hidden" });
    await page.reload();
    await page.getByRole("heading", { name: customer.name, exact: true }).waitFor();
    assert.ok(
      (await page.locator('a[href^="https://wa.me/"]').getAttribute("href")).startsWith(
        "https://wa.me/8801812345678",
      ),
    );
    assert.equal(
      (await readState()).customers.find((row) => row.id === customer.id).phone,
      customer.phone,
    );
    await page.getByRole("button", { name: "ক্রেতার তথ্য সম্পাদনা", exact: true }).click();
    await page.getByLabel("আলাদা WhatsApp নম্বর (ঐচ্ছিক)").fill("");
    await page.getByRole("button", { name: "সংরক্ষণ", exact: true }).click();
    await page
      .getByRole("heading", { name: "ক্রেতার তথ্য সম্পাদনা", exact: true })
      .waitFor({ state: "hidden" });
    assert.ok(
      (await page.locator('a[href^="https://wa.me/"]').getAttribute("href")).startsWith(
        "https://wa.me/8801712345678",
      ),
    );

    // Deactivate the customer; a live customer session must die on rehydrate.
    await page.getByRole("button", { name: "ক্রেতার তথ্য সম্পাদনা", exact: true }).click();
    await page.getByLabel("ক্রেতা চালু আছে").uncheck();
    await page.getByRole("button", { name: "সংরক্ষণ", exact: true }).click();
    await page.getByText("অচালু", { exact: true }).waitFor();
    await page.evaluate(({ key, customerId, phone, name }) => {
      const data = JSON.parse(localStorage.getItem(key));
      data.state.user = {
        id: `customer-user-${customerId}`,
        name,
        phone,
        role: "customer",
        customerId,
      };
      localStorage.setItem(key, JSON.stringify(data));
    }, { key, customerId: customer.id, phone: customer.phone, name: customer.name });
    await page.reload();
    await page.getByRole("heading", { name: "লগইন করুন" }).waitFor();
    // Back to the owner session for the remaining checks.
    const ownerUser = JSON.parse(original).state.user;
    await page.evaluate(({ key, ownerUser }) => {
      const data = JSON.parse(localStorage.getItem(key));
      data.state.user = ownerUser;
      localStorage.setItem(key, JSON.stringify(data));
    }, { key, ownerUser });
    await page.goto(url + "customers");
    await page.getByRole("button", { name: "নতুন ক্রেতা", exact: true }).click();
    await page.getByPlaceholder("নাম", { exact: true }).fill("Duplicate");
    await page.getByPlaceholder("মোবাইল", { exact: true }).fill("+8801712345678");
    await page.getByRole("button", { name: "সংরক্ষণ", exact: true }).click();
    await page.getByText("এই মোবাইল নম্বরের ক্রেতা আগে থেকেই আছে", { exact: true }).waitFor();
    assert.equal((await readState()).customers.length, state.customers.length);
  } finally {
    await page.evaluate(({ key, original }) => localStorage.setItem(key, original), {
      key,
      original,
    });
    await page.goto(url);
    await page.locator("nav").waitFor();
  }
}
