import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { chromium } from "playwright";
import { checkMobilePrint } from "./mobile-print-smoke.mjs";
import { checkCustomerReceipts } from "./customer-receipts-smoke.mjs";
import { assertTypography, checkTypographyPages } from "./typography-smoke.mjs";

// Deliberately emulate Pages, not Vite's SPA rewrite or a running SSR server.
const root = resolve("dist/client");
const base = "/ShopLedGer/";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webmanifest": "application/manifest+json",
};
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  const file = resolve(root, pathname.slice(base.length) || "index.html");
  if (!pathname.startsWith(base) || !file.startsWith(root + sep)) {
    res.writeHead(404).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": mime[".html"] });
    res.end(await readFile(resolve(root, "404.html")));
  }
});

let browser;
try {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`${page.url()} ${error.message}`));
  page.on("response", (response) => {
    if (
      response.url().startsWith(origin) &&
      response.status() >= 400 &&
      !response.request().isNavigationRequest()
    ) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });
  // External fonts and weather must not determine whether the app can boot.
  await page.route("**/*", (route) =>
    route.request().url().startsWith(origin) ? route.continue() : route.abort(),
  );

  assert.equal((await page.goto(origin + base)).status(), 200);
  await page.getByRole("heading", { name: "লগইন করুন" }).waitFor();
  assert.equal(new URL(page.url()).pathname, base + "login");
  assert.equal(
    await page.locator('link[rel="manifest"]').getAttribute("href"),
    base + "manifest.webmanifest",
  );
  await page.waitForFunction(() => {
    const img = document.querySelector("img");
    return img?.complete && img.naturalWidth > 0;
  });
  // Check CSS really loaded, not just readable HTML.
  assert.equal(
    await page
      .locator("body > div")
      .first()
      .evaluate((el) => getComputedStyle(el).display),
    "flex",
  );
  await assertTypography(page, "login");
  const manifestUrl = origin + base + "manifest.webmanifest";
  const manifest = await (await fetch(manifestUrl)).json();
  for (const key of ["id", "start_url", "scope"]) {
    assert.equal(new URL(manifest[key], manifestUrl).pathname, base);
  }
  for (const icon of manifest.icons) {
    const url = new URL(icon.src, manifestUrl);
    assert.ok(url.pathname.startsWith(base));
    assert.equal((await fetch(url)).status, 200);
  }

  await page.getByRole("button", { name: /মালিক.*জসিম/ }).click();
  await page.locator("nav").waitFor();
  assert.equal(new URL(page.url()).pathname, base);
  const salesLink = page.locator(`nav a[href="${base}sales"]`);
  await salesLink.click();
  await page.waitForURL(origin + base + "sales");
  assert.equal((await page.reload()).status(), 404);
  await page.locator("nav").waitFor();
  assert.equal(new URL(page.url()).pathname, base + "sales");
  // Dynamic routes must also boot from the 404 shell after a direct visit.
  assert.equal((await page.goto(origin + base + "customers/c-1")).status(), 404);
  await page.locator("nav").waitFor();
  assert.equal(new URL(page.url()).pathname, base + "customers/c-1");
  await page.getByRole("heading", { name: "করিম মিয়া", exact: true }).waitFor();

  await page.emulateMedia({ media: "print" });
  assert.equal(
    await page.locator("nav").isVisible(),
    true,
    "Printing without a dialog must not blank the app",
  );
  await page.emulateMedia({ media: "screen" });

  await checkTypographyPages(page, origin + base);
  await checkCustomerReceipts(page, origin + base);
  await checkMobilePrint(page, origin + base);

  // A real PDF download must contain embedded Bengali text, all columns and
  // multiple pages when needed; it must not be HTML with a .pdf suffix.
  const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const readPdf = async (download) => {
    assert.equal(await download.failure(), null);
    assert.ok(download.suggestedFilename().endsWith(".pdf"), download.suggestedFilename());
    const bytes = new Uint8Array(await readFile(await download.path()));
    assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
    if (process.env.PDF_REVIEW_DIR) {
      await mkdir(process.env.PDF_REVIEW_DIR, { recursive: true });
      await writeFile(resolve(process.env.PDF_REVIEW_DIR, download.suggestedFilename()), bytes);
    }
    const task = getDocument({ data: bytes, useSystemFonts: false });
    const pdf = await task.promise;
    let text = "";
    const positions = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1 });
      const operators = await page.getOperatorList();
      assert.ok(
        operators.fnArray.some((op) =>
          [OPS.paintImageXObject, OPS.paintInlineImageXObject].includes(op),
        ),
        `Missing logo on PDF page ${i}`,
      );
      const content = await page.getTextContent();
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const x = item.transform[4];
        const y = item.transform[5];
        assert.ok(
          x >= 32 && x + item.width <= viewport.width - 32,
          `Text outside PDF horizontal margins: ${item.str}`,
        );
        assert.ok(y >= 20 && y <= viewport.height - 8, `Text outside PDF page: ${item.str}`);
        positions.push({ text: item.str, x, y, right: x + item.width, page: i });
      }
      text += content.items.map((item) => item.str ?? "").join(" ");
    }
    const result = { pages: pdf.numPages, text, positions };
    await task.destroy();
    return result;
  };
  const downloadDocument = async () => {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "PDF ডাউনলোড করুন" }).click();
    return readPdf(await pending);
  };
  await page.goto(origin + base + "reports");
  await page.getByRole("button", { name: /বিক্রয় রিপোর্ট/ }).click();
  const salesPdf = await downloadDocument();
  assert.ok(salesPdf.text.includes("৳১০,৪১০"), salesPdf.text);
  assert.ok(salesPdf.text.includes("৳৫,১১০"), salesPdf.text);
  assert.ok(salesPdf.text.includes("৳"), salesPdf.text);
  const totals = salesPdf.positions.filter((item) =>
    ["৳১০,৪১০", "৳৫,১১০", "৳৫,৪৩০"].includes(item.text),
  );
  assert.equal(totals.length, 3, "All sales totals must remain on one line");
  assert.ok(
    Math.max(...totals.map((item) => item.right)) - Math.min(...totals.map((item) => item.right)) <
      1,
    "Money column must be right aligned",
  );

  // In print media, only the portalled document is visible; no height clipping.
  await page.emulateMedia({ media: "print" });
  assert.equal(await page.locator("nav").isVisible(), false);
  assert.equal(await page.locator(".report-sheet").isVisible(), true);
  assert.equal(await page.getByRole("button", { name: "PDF ডাউনলোড করুন" }).isVisible(), false);
  assert.equal(
    await page.locator(".print-content").evaluate((el) => getComputedStyle(el).overflowY),
    "visible",
  );
  const printed = await page.pdf({ format: "A4" });
  assert.ok(printed.length > 1000);
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => {
    window.printCalls = 0;
    window.print = () => {
      window.printCalls++;
    };
  });
  await page.getByRole("button", { name: "প্রিন্ট", exact: true }).click();
  await page.waitForFunction(() => window.printCalls === 1);
  await page.getByRole("button", { name: "বন্ধ", exact: true }).click();

  for (const label of [
    "ক্রয় রিপোর্ট",
    "ক্রেতার বাকি",
    "আদায় রিপোর্ট",
    "খরচ রিপোর্ট",
    "দৈনিক লাভ",
    "মাসিক লাভ",
    "পণ্য রিপোর্ট",
    "লেনদেন",
  ]) {
    await page.getByRole("button", { name: new RegExp(`^${label}`) }).click();
    const report = await downloadDocument();
    assert.ok(report.pages >= 1, label);
    await page.getByRole("button", { name: "বন্ধ", exact: true }).click();
  }

  // Receipt downloads used to be .html and had no print action at all.
  await page.goto(origin + base + "sales");
  await page.getByRole("button", { name: /বিল-/ }).first().click();
  const receiptPdf = await downloadDocument();
  assert.ok(receiptPdf.text.includes("৳"), receiptPdf.text);
  assert.ok(receiptPdf.text.includes("১ / ১"), receiptPdf.text);
  await page.emulateMedia({ media: "print" });
  assert.equal(await page.locator("nav").isVisible(), false);
  assert.equal(await page.locator("#receipt-sheet").isVisible(), true);
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("button", { name: "বন্ধ", exact: true }).click();

  // Long, wrapping tables must retain the last row and paginate automatically.
  await page.evaluate(() => {
    const key = "karnaphuli-shopledger-v1";
    const data = JSON.parse(localStorage.getItem(key));
    const template = data.state.products[0];
    data.state.products = Array.from({ length: 140 }, (_, index) => ({
      ...template,
      id: index === 139 ? "FINAL-STOCK-ROW" : `stock-${index}`,
      name: "গবাদি পশুর খাদ্য — বিস্তারিত পণ্য বিবরণ ও দীর্ঘ নাম ".repeat(3),
    }));
    localStorage.setItem(key, JSON.stringify(data));
  });
  await page.goto(origin + base + "reports");
  await page.getByRole("button", { name: /স্টক রিপোর্ট/ }).click();
  const stockPdf = await downloadDocument();
  assert.ok(stockPdf.pages > 1);
  assert.ok(stockPdf.text.replace(/\s+/g, "").includes("FINAL-STOCK-ROW"), "Last row was lost");
  await page.getByRole("button", { name: "বন্ধ", exact: true }).click();
  // A single very tall description must continue, not disappear in an
  // unbreakable header/first-row block.
  await page.evaluate(() => {
    const key = "karnaphuli-shopledger-v1";
    const data = JSON.parse(localStorage.getItem(key));
    data.state.products = [
      { ...data.state.products[0], name: "দীর্ঘ পণ্যের বিবরণ ".repeat(400) + " TAIL-MARKER" },
    ];
    localStorage.setItem(key, JSON.stringify(data));
  });
  await page.reload();
  await page.getByRole("button", { name: /স্টক রিপোর্ট/ }).click();
  const tallPdf = await downloadDocument();
  assert.ok(tallPdf.pages > 1);
  assert.ok(
    tallPdf.text.replace(/\s+/g, "").includes("TAIL-MARKER"),
    "Tall row lost its final text",
  );
  await page.getByRole("button", { name: "বন্ধ", exact: true }).click();
  await page.getByRole("button", { name: /বিক্রয় রিপোর্ট/ }).click();
  await page.locator('input[type="date"]').fill("1900-01-01");
  const emptyPdf = await downloadDocument();
  assert.equal(emptyPdf.pages, 1);
  assert.ok(!emptyPdf.text.includes("৳"));

  // A failed PDF font load shows feedback and can be retried, not a dead button.
  await page.reload();
  await page.route("**/fonts/*.ttf", (route) =>
    route.request().resourceType() === "fetch" ? route.abort() : route.continue(),
  );
  await page.getByRole("button", { name: /বিক্রয় রিপোর্ট/ }).click();
  await page.getByRole("button", { name: "PDF ডাউনলোড করুন" }).click();
  await page.getByText("PDF তৈরি করা যায়নি। আবার চেষ্টা করুন।", { exact: true }).waitFor();
  await assertTypography(page, "error toast");
  await page.unroute("**/fonts/*.ttf");
  assert.equal((await downloadDocument()).pages, 1);

  // Logo requests use the same Pages base path and recover after failure.
  await page.reload();
  await page.route("**/brand/karnaphuli-mark.jpg", (route) =>
    route.request().resourceType() === "fetch" ? route.abort() : route.continue(),
  );
  await page.getByRole("button", { name: /বিক্রয় রিপোর্ট/ }).click();
  await page.getByRole("button", { name: "PDF ডাউনলোড করুন" }).click();
  await page.getByText("PDF তৈরি করা যায়নি। আবার চেষ্টা করুন।", { exact: true }).waitFor();
  await page.unroute("**/brand/karnaphuli-mark.jpg");
  assert.equal((await downloadDocument()).pages, 1);

  assert.deepEqual(errors, []);
  console.log(
    "Pages smoke passed: customer bill receipts, routing, mobile/desktop typography, branded/aligned PDF downloads, print visibility, long/empty reports and font/logo retry.",
  );
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
