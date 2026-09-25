import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { money, bnQuantity } from "../src/lib/format.ts";
import { assertTypography } from "./typography-smoke.mjs";

/** Exercise real customer links, not only the already-working sales page. */
export async function checkCustomerReceipts(page, url) {
  const key = "karnaphuli-shopledger-v1";
  const overrideKey = "karnaphuli-shopledger-v1-password-overrides";
  const original = await page.evaluate((key) => localStorage.getItem(key), key);
  const originalOverrides = await page.evaluate((key) => localStorage.getItem(key), overrideKey);
  const data = JSON.parse(original);
  const customer = data.state.customers.find((c) => c.id === "c-1");
  const bill = data.state.sales.find((s) => s.customerId === customer.id);
  // Stored sale snapshots must win over edited catalog prices, even for fractions.
  bill.items = Array.from({ length: 14 }, (_, i) => ({
    ...bill.items[0],
    productId: `receipt-item-${i}`,
    productName: `পণ্য ${i + 1} — গবাদি পশুর খাদ্য ও বিস্তারিত বিবরণ`,
    quantity: 2.5,
    salePrice: 120,
    total: 300,
  }));
  bill.subtotal = 4200;
  bill.discount = 100;
  bill.total = 4100;
  bill.paid = 1500;
  bill.note = "দোকান থেকে পণ্য বুঝে পেয়েছি।";
  data.state.customers.push({ ...customer, id: "empty-customer", name: "নতুন ক্রেতা", username: "emptycustomer" });
  data.state.products.forEach((p) => {
    p.salePrice = 9999;
  });
  const assertReceipt = async (sale) => {
    const dialog = page.getByRole("dialog", { name: "বিক্রয় রসিদ" });
    await dialog.waitFor();
    const sheet = page.locator("#receipt-sheet");
    assert.ok((await sheet.innerText()).includes(sale.billNo));
    assert.ok((await sheet.innerText()).includes(sale.customerName));
    assert.equal(await sheet.locator("tbody tr").count(), sale.items.length);
    for (let index = 0; index < sale.items.length; index++) {
      const item = sale.items[index];
      const cells = await sheet.locator("tbody tr").nth(index).locator("td").allTextContents();
      assert.deepEqual(
        cells.map((s) => s.trim()),
        [
          item.productName,
          `${bnQuantity(item.quantity)} ${item.unit}`,
          money(item.salePrice),
          money(item.total),
        ],
      );
    }
    for (const [label, value] of [
      ["উপমোট", sale.subtotal],
      ["সর্বমোট", sale.total],
      ["জমা", sale.paid],
      ["বাকি", sale.total - sale.paid],
    ]) {
      // Summary rows have the label and amount as two sibling spans.
      const amount = await sheet.getByText(label, { exact: true }).locator("..").innerText();
      assert.ok(amount.includes(money(value)), `${label}: ${amount}`);
    }
    if (sale.note) assert.ok((await sheet.innerText()).includes(sale.note));
    assert.equal(await sheet.evaluate((el) => el.scrollWidth > el.clientWidth), false);
    assert.equal(await dialog.getByRole("button", { name: "PDF ডাউনলোড করুন" }).count(), 1);
    assert.equal(
      await dialog.getByRole("button", { name: "প্রিন্ট", exact: true }).count(),
      page.viewportSize().width < 768 ? 0 : 1,
    );
    await assertTypography(page, "full customer receipt");
    return dialog;
  };

  try {
    await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
      key,
      data,
    });
    for (const width of [360, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(url + "customers");
      await page.locator(`a[href$="/customers/${customer.id}"]`).click();
      await page.getByRole("heading", { name: customer.name, exact: true }).waitFor();
      assert.equal(await page.locator("nav").count(), 1, "No nested duplicate app shell");
      const open = page.getByRole("button", { name: `${bill.billNo} — রসিদ দেখুন`, exact: true });
      await open.click();
      await assertReceipt(bill);
      assert.ok((await page.locator("#receipt-sheet").innerText()).includes("২.৫"));
      if (width === 360) {
        const downloaded = page.waitForEvent("download");
        await page.getByRole("button", { name: "PDF ডাউনলোড করুন" }).click();
        const download = await downloaded;
        assert.equal(download.suggestedFilename(), `receipt-${bill.id}.pdf`);
        const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const task = getDocument({ data: new Uint8Array(await readFile(await download.path())) });
        try {
          const pdf = await task.promise;
          assert.ok(pdf.numPages > 1, "Long customer receipts paginate on A5");
          const first = await pdf.getPage(1);
          const viewport = first.getViewport({ scale: 1 });
          assert.ok(
            Math.abs(viewport.width - 595.28) < 0.1 && Math.abs(viewport.height - 419.53) < 0.1,
          );
          let text = "";
          for (let i = 1; i <= pdf.numPages; i++) {
            const content = await (await pdf.getPage(i)).getTextContent();
            text += content.items.map((item) => item.str ?? "").join(" ");
          }
          assert.ok(text.includes("২.৫"), "PDF retains fractional quantities");
          assert.ok(text.includes(money(120)), "PDF includes the saved unit price");
          assert.ok(text.includes(money(4100)), "PDF includes the discounted bill total");
          assert.ok(text.includes(money(2600)), "PDF includes this bill's due amount");
        } finally {
          await task.destroy();
        }
      }
      await page.keyboard.press("Escape");
      assert.equal(await page.getByRole("dialog").count(), 0);
      assert.equal(await open.evaluate((el) => el === document.activeElement), true);
      await open.press("Enter");
      await assertReceipt(bill);
      await page.getByRole("button", { name: "বন্ধ", exact: true }).click();
      // Direct navigation/reload must actually render the customer, not the list.
      await page.reload();
      await page.getByRole("heading", { name: customer.name, exact: true }).waitFor();
      const second = data.state.sales.find((s) => s.customerId === customer.id && s.id !== bill.id);
      await page
        .getByRole("button", { name: `${second.billNo} — রসিদ দেখুন`, exact: true })
        .click();
      await assertReceipt(second);
      await page.keyboard.press("Escape");
      assert.ok(
        (await page.locator("main button:disabled").count()) > 0,
        "Collections are not sale receipts",
      );
    }
    await page.goto(url + "customers/empty-customer");
    await page.getByRole("heading", { name: "নতুন ক্রেতা", exact: true }).waitFor();
    await page.getByText("এখনও কোনো লেনদেন নেই", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: /— রসিদ দেখুন$/ }).count(), 0);
    await page.goto(url + "customers/missing-customer");
    await page.getByText("ক্রেতা পাওয়া যায়নি।", { exact: false }).waitFor();

    // Log in as the seeded customer through the real form: no password yet,
    // so set one via reset first. Only that customer's bills list.
    data.state.user = null;
    await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
      key,
      data,
    });
    await page.goto(url + "login");
    await page.getByPlaceholder("আপনার ইউজারনেম").fill(customer.username);
    await page.getByPlaceholder("পাসওয়ার্ড লিখুন").fill("smoke-pass-c1");
    await page.getByRole("button", { name: "প্রবেশ করুন", exact: true }).click();
    await page.getByText("পাসওয়ার্ড সেট করা নেই", { exact: false }).waitFor();
    await page.getByRole("button", { name: "পাসওয়ার্ড ভুলে গেছেন?" }).click();
    await page.getByPlaceholder("কমপক্ষে 4 অক্ষর").fill("smoke-pass-c1");
    await page.getByPlaceholder("নতুন পাসওয়ার্ড আবার লিখুন").fill("smoke-pass-c1");
    await page.getByRole("button", { name: "নতুন পাসওয়ার্ড সেট করুন" }).click();
    await page.getByPlaceholder("পাসওয়ার্ড লিখুন").fill("smoke-pass-c1");
    await page.getByRole("button", { name: "প্রবেশ করুন", exact: true }).click();
    await page.locator("nav").waitFor();
    const ownerBills = data.state.sales.filter((s) => s.customerId === customer.id);
    for (const route of ["", "my-dues"]) {
      await page.goto(url + route);
      const bills = page.getByRole("button", { name: /— রসিদ দেখুন$/ });
      await bills.first().waitFor();
      assert.equal(await bills.count(), route ? ownerBills.length : Math.min(ownerBills.length, 5));
      await page.getByRole("button", { name: `${bill.billNo} — রসিদ দেখুন`, exact: true }).click();
      await assertReceipt(bill);
      await page.keyboard.press("Escape");
    }
    await page.goto(url + "customers/c-2");
    await page.getByText("ক্রেতা পাওয়া যায়নি।", { exact: false }).waitFor();
    assert.equal(await page.getByRole("button", { name: /— রসিদ দেখুন$/ }).count(), 0);
  } finally {
    await page.evaluate(
      ({ key, original, overrideKey, originalOverrides }) => {
        localStorage.setItem(key, original);
        if (originalOverrides === null) localStorage.removeItem(overrideKey);
        else localStorage.setItem(overrideKey, originalOverrides);
      },
      { key, original, overrideKey, originalOverrides },
    );
    await page.goto(url);
    await page.locator("nav").waitFor();
  }
}
