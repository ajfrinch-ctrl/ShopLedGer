import assert from "node:assert/strict";

/** `src/lib/return-to.ts`-এর কী — টেস্টে সরাসরি যাচাই করা হয়। */
export const RETURN_TO_KEY = "shopledger.return-to";

/**
 * গভীর-লিংক (deep link) রিগ্রেশন টেস্ট —
 *
 * লগইন ছাড়া `/sales` খুললে লগইন পাতায় পাঠানো উচিত, ফেরার ঠিকানা মনে রাখা
 * উচিত, আর লগইন + প্রথম-লগইনের বাধ্যতামূলক পাসওয়ার্ড পরিবর্তন শেষে
 * ব্যবহারকারীর ঠিক সেই পাতাতেই ফেরা উচিত। নইলে `/sales` লিংকটা «কাজ করছে না»
 * মনে হয় (একবার হোমপাতায় গিয়ে ঠেকে যায়)।
 *
 * নিজের আলাদা context ব্যবহার করে — মূল smoke ফ্লোর সেশন/পাসওয়ার্ড বদলায় না।
 */
export async function checkDeepLink(page, url) {
  const browser = page.context().browser();
  const basePath = new URL(url).pathname;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await context.route("**/*", (route) =>
      route.request().url().startsWith(url) ? route.continue() : route.abort(),
    );
    const deep = await context.newPage();
    // কেবল আসল JS এরর — Pages-এর SPA শেলের 404/ব্লকড বাইরের রিকোয়েস্ট স্বাভাবিক
    const errors = [];
    deep.on("pageerror", (error) => errors.push(String(error.message)));

    // Pages-এ ভেতরের path 404 শেল থেকেই বুট হয় (spa fallback), ঠিকানা অটুট থাকে
    assert.equal((await deep.goto(`${url}sales`)).status(), 404);
    await deep.getByRole("heading", { name: "লগইন করুন" }).waitFor();
    assert.equal(new URL(deep.url()).pathname, `${basePath}login`);

    // ১. ফেরার ঠিকানা সেভ হয়েছে ও লগইন পাতায় জানানো হচ্ছে
    assert.equal(
      await deep.evaluate((key) => localStorage.getItem(key), RETURN_TO_KEY),
      "/sales",
      "লগইনের পরে ফেরার জন্য `/sales` সেভ থাকতে হবে",
    );
    await deep.getByText("আগে লগইন করুন", { exact: false }).waitFor();
    await deep.getByText("প্রথমবার ঢুকছেন?", { exact: false }).waitFor();

    // ২. মালিক লগইন → প্রথম-লগইনের বাধ্যতামূলক পাসওয়ার্ড পরিবর্তন
    await deep.getByPlaceholder("01XXXXXXXXX").fill("01821989717");
    await deep.getByPlaceholder("পাসওয়ার্ড লিখুন").fill("123456");
    await deep.getByRole("button", { name: "প্রবেশ করুন", exact: true }).click();
    await deep.getByRole("heading", { name: "পাসওয়ার্ড পরিবর্তন করুন" }).waitFor();
    assert.equal(
      await deep.evaluate((key) => localStorage.getItem(key), RETURN_TO_KEY),
      "/sales",
      "পাসওয়ার্ড পরিবর্তনের ধাপে ফেরার ঠিকানা হারানো যাবে না",
    );
    await deep.getByPlaceholder("কমপক্ষে 4 অক্ষর").fill("deep-link-pass-1");
    await deep.getByPlaceholder("নতুন পাসওয়ার্ড আবার লিখুন").fill("deep-link-pass-1");
    await deep.getByRole("button", { name: "নতুন পাসওয়ার্ড সেট করুন" }).click();

    // ৩. হোমপাতায় নয় — যে পাতা খুলেছিলেন সেখানেই
    await deep.waitForURL(`${url}sales`);
    assert.equal(new URL(deep.url()).pathname, `${basePath}sales`);
    await deep.getByRole("button", { name: "নতুন বিক্রি" }).waitFor();
    assert.equal(
      await deep.evaluate((key) => localStorage.getItem(key), RETURN_TO_KEY),
      null,
      "একবার ফেরার পর ঠিকানা মুছে যাওয়া উচিত",
    );
    // রিলোডেও সেশন ও পাতা টিকবে
    await deep.reload();
    await deep.getByRole("button", { name: "নতুন বিক্রি" }).waitFor();
    assert.equal(new URL(deep.url()).pathname, `${basePath}sales`);

    assert.deepEqual(errors, [], "deep-link ফ্লোতে কোনো JS এরর চলবে না");
  } finally {
    await context.close();
  }
}
