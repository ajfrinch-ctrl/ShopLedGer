import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

export async function assertTypography(page, label) {
  await page.evaluate(() => document.fonts.ready);
  const result = await page.evaluate(() => {
    const sizes = new Set(["12px", "14px", "16px", "18px"]);
    const failures = [];
    for (const element of document.body.querySelectorAll("*")) {
      if (!(element instanceof HTMLElement) || !element.getClientRects().length) continue;
      const isField = element.matches(
        "input:not([type=checkbox]):not([type=radio]), select, textarea",
      );
      const text = [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join("")
        .trim();
      if (!text && !isField) continue;
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (
        !style.fontFamily.startsWith('"Noto Sans Bengali"') ||
        !sizes.has(style.fontSize) ||
        (isField && style.fontSize !== "16px")
      ) {
        failures.push({
          element: element.tagName,
          text: text.slice(0, 60),
          font: style.fontFamily,
          size: style.fontSize,
        });
      }
    }
    return {
      failures,
      regular: document.fonts.check('400 14px "Noto Sans Bengali"', "বাংলা English ১২৩ 123 ৳"),
      bold: document.fonts.check('700 14px "Noto Sans Bengali"', "বাংলা English ১২৩ 123 ৳"),
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  assert.deepEqual(result.failures, [], label);
  assert.ok(result.regular && result.bold, `${label}: local fonts failed to load`);
  assert.equal(result.overflow, false, `${label}: horizontal page overflow`);
}

export async function checkTypographyPages(page, url) {
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "",
      "sales",
      "stock",
      "collections",
      "purchases",
      "expenses",
      "customers",
      "reports",
      "profit-loss",
      "orders",
      "profile",
      "more",
    ]) {
      await page.goto(url + route);
      await page.locator("nav").waitFor();
      await assertTypography(page, `${route || "dashboard"} at ${width}px`);
      if (process.env.TYPOGRAPHY_SCREENSHOTS && !route) {
        await mkdir(".cache", { recursive: true });
        await page.screenshot({ path: `.cache/typography-${width}.png`, fullPage: true });
      }
    }
    await page.goto(url + "reports");
    await page.getByRole("button", { name: /^বিক্রয় রিপোর্ট/ }).click();
    await assertTypography(page, `report dialog at ${width}px`);
    await page.getByRole("button", { name: "বন্ধ", exact: true }).click();
    await page.goto(url + "sales");
    await page.getByRole("button", { name: /বিল-/ }).first().click();
    await assertTypography(page, `receipt dialog at ${width}px`);
    await page.getByRole("button", { name: "বন্ধ", exact: true }).click();
    await page.getByRole("button", { name: "নতুন বিক্রি", exact: true }).click();
    await page.getByPlaceholder("পণ্য খুঁজুন").waitFor();
    await assertTypography(page, `sale form at ${width}px`);
  }
}
