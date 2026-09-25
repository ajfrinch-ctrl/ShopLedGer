import assert from "node:assert/strict";

/** Print is desktop-only; downloading remains available on every device. */
export async function checkMobilePrint(page, url) {
  const browser = page.context().browser();
  const storageState = await page.context().storageState();
  for (const device of [
    { name: "phone portrait", width: 390, height: 844, touch: true },
    { name: "phone landscape", width: 844, height: 390, touch: true },
    { name: "tablet", width: 1024, height: 768, touch: true },
    { name: "small viewport", width: 767, height: 800, touch: false },
    { name: "desktop", width: 1280, height: 900, touch: false },
  ]) {
    const context = await browser.newContext({
      storageState,
      viewport: { width: device.width, height: device.height },
      isMobile: device.touch,
      hasTouch: device.touch,
    });
    try {
      await context.route("**/*", (route) =>
        route.request().url().startsWith(url) ? route.continue() : route.abort(),
      );
      const mobile = await context.newPage();
      const canPrint = !device.touch && device.width >= 768;
      const assertActions = async () => {
        assert.equal(
          await mobile.getByRole("button", { name: "প্রিন্ট", exact: true }).count(),
          canPrint ? 1 : 0,
          device.name,
        );
        assert.equal(
          await mobile
            .getByText("প্রিন্টের উইন্ডোতে Save as PDF-ও বেছে নিতে পারেন।", { exact: true })
            .isVisible(),
          canPrint,
          device.name,
        );
        assert.equal(
          await mobile.getByRole("button", { name: "PDF ডাউনলোড করুন" }).isVisible(),
          true,
          device.name,
        );
        if (!canPrint)
          assert.ok(!(await mobile.locator("body").innerText()).includes("প্রিন্ট"), device.name);
      };
      await mobile.goto(url + "reports");
      for (const label of [
        "বিক্রয় রিপোর্ট",
        "ক্রয় রিপোর্ট",
        "স্টক রিপোর্ট",
        "ক্রেতার বাকি",
        "আদায় রিপোর্ট",
        "খরচ রিপোর্ট",
        "দৈনিক লাভ",
        "মাসিক লাভ",
        "পণ্য রিপোর্ট",
        "লেনদেন",
      ]) {
        await mobile.getByRole("button", { name: new RegExp(`^${label}`) }).click();
        // রিপোর্ট প্রিভিউ "রিপোর্ট তৈরি করুন" চাপার পরেই দেখা যায়।
        const generate = mobile.getByRole("button", { name: "রিপোর্ট তৈরি করুন" });
        if (await generate.count()) await generate.click();
        await assertActions();
        await mobile.getByRole("button", { name: "বন্ধ", exact: true }).click();
      }
      await mobile.goto(url + "sales");
      await mobile.getByRole("button", { name: /বিল-/ }).first().click();
      await assertActions();
      // Hiding a print button must not leave a dead end in the receipt focus trap.
      await mobile.getByRole("button", { name: "বন্ধ", exact: true }).focus();
      await mobile.keyboard.press("Shift+Tab");
      assert.equal(
        await mobile.evaluate(() => document.activeElement?.textContent?.trim()),
        canPrint ? "প্রিন্ট" : "PDF ডাউনলোড করুন",
      );
      if (device.name === "phone portrait") {
        const downloading = mobile.waitForEvent("download");
        await mobile.getByRole("button", { name: "PDF ডাউনলোড করুন" }).click();
        const download = await downloading;
        assert.equal(await download.failure(), null);
        assert.ok(download.suggestedFilename().endsWith(".pdf"));
      }
      if (device.name === "desktop") {
        // Resizing updates visibility without reloading the dialog.
        await mobile.setViewportSize({ width: 390, height: 844 });
        assert.equal(await mobile.getByRole("button", { name: "প্রিন্ট", exact: true }).count(), 0);
        await mobile.setViewportSize({ width: 1280, height: 900 });
        await assertActions();
      }
    } finally {
      await context.close();
    }
  }
}
