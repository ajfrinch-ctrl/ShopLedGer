import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { chromium } from "playwright";
import { checkMobilePrint } from "./mobile-print-smoke.mjs";
import { checkCustomerIdentity } from "./customer-identity-smoke.mjs";
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
  const fontRequests = [];
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
  // Neither the UI nor PDF generation may request a font over the network.
  // Other app assets remain available; all external services are blocked.
  await page.route("**/*", (route) => {
    const request = route.request();
    if (
      /^https?:/.test(request.url()) &&
      (request.resourceType() === "font" || /\.(?:ttf|otf|woff2?)(?:\?|$)/i.test(request.url()))
    ) {
      fontRequests.push(request.url());
      return route.abort();
    }
    return request.url().startsWith(origin) ? route.continue() : route.abort();
  });

  assert.equal((await page.goto(origin + base)).status(), 200);
  await page.getByRole("heading", { name: "লগইন করুন" }).waitFor();
  assert.equal(new URL(page.url()).pathname, base + "login");
  assert.equal(
    await page.locator('link[rel="manifest"]').getAttribute("href"),
    base + "manifest.webmanifest?v=2",
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
  // The logo header stays pinned while the login page scrolls.
  assert.equal(
    await page
      .getByTestId("login-logo-header")
      .evaluate((el) => getComputedStyle(el).position),
    "sticky",
    "login logo header must be fixed at the top",
  );
  await assertTypography(page, "login");
  const manifestUrl = origin + base + "manifest.webmanifest?v=2";
  const manifest = await (await fetch(manifestUrl)).json();
  for (const key of ["id", "start_url", "scope"]) {
    assert.equal(new URL(manifest[key], manifestUrl).pathname, base);
  }
  for (const icon of manifest.icons) {
    const url = new URL(icon.src, manifestUrl);
    assert.ok(url.pathname.startsWith(base));
    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/png");
  }
  // Decode the actual deployed assets. HTTP 200 alone also passed for the
  // old dark placeholder icons, which did not contain the shop logo.
  const iconAssets = [
    ...manifest.icons.map((icon) => ({
      url: new URL(icon.src, manifestUrl).href,
      size: Number(icon.sizes.split("x")[0]),
    })),
    {
      url: await page.locator('link[rel="apple-touch-icon"]').evaluate((el) => el.href),
      size: 180,
    },
    {
      url: await page.locator('link[rel="icon"][type="image/png"]').evaluate((el) => el.href),
      size: 192,
    },
  ];
  for (const asset of iconAssets) {
    const pixels = await page.evaluate(async ({ url }) => {
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let green = 0;
      let white = 0;
      let transparent = 0;
      for (let i = 0; i < data.length; i += 4) {
        const [r, g, b, a] = data.slice(i, i + 4);
        if (g > r + 30 && b > r + 20) green++;
        if (r > 230 && g > 230 && b > 230) white++;
        if (a !== 255) transparent++;
      }
      const total = canvas.width * canvas.height;
      return {
        width: canvas.width,
        height: canvas.height,
        green: green / total,
        white: white / total,
        transparent,
      };
    }, asset);
    assert.equal(pixels.width, asset.size, asset.url);
    assert.equal(pixels.height, asset.size, asset.url);
    assert.ok(pixels.green > 0.2, `Missing green shop logo: ${asset.url}`);
    assert.ok(pixels.white > 0.2, `Missing white shop logo: ${asset.url}`);
    assert.equal(pixels.transparent, 0, `Icon must be opaque: ${asset.url}`);
  }

  // Owner login: shop phone number + factory password → forced change on first login
  await page.getByPlaceholder("01XXXXXXXXX").fill("01821989717");
  await page.getByPlaceholder("পাসওয়ার্ড লিখুন").fill("123456");
  await page.getByRole("button", { name: "প্রবেশ করুন", exact: true }).click();
  await page.getByRole("heading", { name: "পাসওয়ার্ড পরিবর্তন করুন" }).waitFor();
  await page.getByPlaceholder("কমপক্ষে 4 অক্ষর").fill("smoke-pass-1");
  await page.getByPlaceholder("নতুন পাসওয়ার্ড আবার লিখুন").fill("smoke-pass-1");
  await page.getByRole("button", { name: "নতুন পাসওয়ার্ড সেট করুন" }).click();
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

  await checkCustomerIdentity(page, origin + base);
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
    const receipt = download.suggestedFilename().startsWith("receipt-");
    const sideMargin = receipt ? (8 * 72) / 25.4 : 42.52;
    const task = getDocument({ data: bytes, useSystemFonts: false });
    const pdf = await task.promise;
    let text = "";
    const positions = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1 });
      if (receipt) {
        assert.ok(
          Math.abs(viewport.width - 595.28) < 0.1 && Math.abs(viewport.height - 419.53) < 0.1,
          "Sales receipts must be A5 landscape",
        );
      } else {
        assert.ok(
          Math.abs(Math.min(viewport.width, viewport.height) - 595.28) < 0.1 &&
            Math.abs(Math.max(viewport.width, viewport.height) - 841.89) < 0.1,
          "Other reports must remain A4",
        );
      }
      const operators = await page.getOperatorList();
      // Image placement must be centered on every page, including the compact
      // continuation masthead. Follow PDF graphics transforms, not filenames.
      let transform = [1, 0, 0, 1, 0, 0];
      const savedTransforms = [];
      for (const [index, op] of operators.fnArray.entries()) {
        if (op === OPS.save) savedTransforms.push([...transform]);
        if (op === OPS.restore) transform = savedTransforms.pop() ?? [1, 0, 0, 1, 0, 0];
        if (op === OPS.transform) {
          const [a, b, c, d, e, f] = transform;
          const [g, h, j, k, l, m] = operators.argsArray[index];
          transform = [
            a * g + c * h,
            b * g + d * h,
            a * j + c * k,
            b * j + d * k,
            a * l + c * m + e,
            b * l + d * m + f,
          ];
        }
        if (op === OPS.paintImageXObject) {
          const centerX = transform[4] + (transform[0] + transform[2]) / 2;
          assert.ok(
            centerX >= sideMargin && centerX <= viewport.width - sideMargin,
            `Receipt logo must stay inside margins on page ${i}`,
          );
        }
      }
      for (const [index, op] of operators.fnArray.entries()) {
        if ([OPS.setFillRGBColor, OPS.setStrokeRGBColor].includes(op)) {
          const color = operators.argsArray[index][0];
          assert.ok(
            (receipt
              ? ["#000000", "#ffffff", "#15543b", "#dfeae2", "#eff5f0", "#e5e5e5", "#b33030"]
              : ["#000000", "#ffffff", "#203864", "#e8eff7"]
            ).includes(color),
            `Unexpected PDF ink color: ${color}`,
          );
        }
      }
      assert.equal(
        operators.fnArray.some((op) =>
          [OPS.paintImageXObject, OPS.paintInlineImageXObject].includes(op),
        ),
        receipt,
        `Only receipts retain a logo; A4 follows the logo-free reference (page ${i})`,
      );
      for (const [index, op] of operators.fnArray.entries()) {
        if (op !== OPS.paintImageXObject) continue;
        const id = operators.argsArray[index][0];
        const store = id.startsWith("g_") ? page.commonObjs : page.objs;
        const image = await new Promise((resolve) => store.get(id, resolve));
        assert.ok(image.width > 0 && image.height > 0, "Receipt logo must decode successfully");
      }

      const content = await page.getTextContent();
      const visibleText = content.items.filter((item) => "str" in item && item.str.trim());
      // Bengali extraction may reorder vowel marks, but the notice's em dash
      // and placement must survive on every page, including empty/long reports.
      const noticeAnchor = visibleText
        .filter((item) => item.str.includes("—"))
        .sort((a, b) => a.transform[5] - b.transform[5])[0];
      const footerNotice = visibleText.filter(
        (item) => noticeAnchor && Math.abs(item.transform[5] - noticeAnchor.transform[5]) < 0.5,
      );
      assert.ok(
        footerNotice.some((item) => item.str.includes("—")),
        `Automatic-statement footer missing on page ${i}`,
      );
      const footerLeft = Math.min(...footerNotice.map((item) => item.transform[4]));
      const footerRight = Math.max(...footerNotice.map((item) => item.transform[4] + item.width));
      assert.ok(
        Math.abs((footerLeft + footerRight) / 2 - viewport.width / 2) < 1,
        `Statement footer must be centered on page ${i}`,
      );
      const topBaseline = Math.max(...visibleText.map((item) => item.transform[5]));
      const companyLine = visibleText.filter(
        (item) => Math.abs(item.transform[5] - topBaseline) < 0.5,
      );
      const companyLeft = Math.min(...companyLine.map((item) => item.transform[4]));
      const companyRight = Math.max(...companyLine.map((item) => item.transform[4] + item.width));
      assert.ok(
        Math.abs(
          (companyLeft + companyRight) / 2 - viewport.width / 2 - (receipt && i === 1 ? 20 : 0),
        ) < 1,
        `Company name must be centered on page ${i}`,
      );
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const x = item.transform[4];
        const y = item.transform[5];
        assert.ok(
          x >= sideMargin - 1 && x + item.width <= viewport.width - sideMargin + 1,
          `Text outside PDF horizontal margins: ${item.str}`,
        );
        assert.ok(
          y >= (receipt ? 8 : 20) && y <= viewport.height - 8,
          `Text outside PDF page: ${item.str}`,
        );
        positions.push({ text: item.str, x, y, right: x + item.width, page: i });
      }
      text += content.items.map((item) => item.str ?? "").join(" ");
    }
    const result = { pages: pdf.numPages, text, positions };
    await task.destroy();
    return result;
  };
  const downloadDocument = async () => {
    assert.equal(
      await page
        .getByText("স্বয়ংক্রিয়ভাবে তৈরি স্টেটমেন্ট—স্বাক্ষরের প্রয়োজন নেই।", { exact: true })
        .isVisible(),
      true,
    );
    assert.equal(await page.getByText(/মালিকের স্বাক্ষর/).count(), 0);
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
  assert.equal(
    await page
      .getByText("স্বয়ংক্রিয়ভাবে তৈরি স্টেটমেন্ট—স্বাক্ষরের প্রয়োজন নেই।", { exact: true })
      .isVisible(),
    true,
  );
  assert.equal(
    await page.locator(".report-sheet").evaluate((el) => getComputedStyle(el).color),
    "rgb(0, 0, 0)",
  );
  assert.equal(
    await page.locator(".report-sheet img").evaluate((el) => getComputedStyle(el).filter),
    "grayscale(1)",
  );
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
  assert.equal(receiptPdf.pages, 1);
  await page.emulateMedia({ media: "print" });
  assert.equal(await page.locator("nav").isVisible(), false);
  assert.equal(await page.locator("#receipt-sheet").isVisible(), true);
  assert.equal(
    await page
      .getByText("স্বয়ংক্রিয়ভাবে তৈরি স্টেটমেন্ট—স্বাক্ষরের প্রয়োজন নেই।", { exact: true })
      .isVisible(),
    true,
  );
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

  // Even after a fresh document/engine load, bundled fonts need no request.
  await page.reload();
  await page.getByRole("button", { name: /বিক্রয় রিপোর্ট/ }).click();
  assert.equal((await downloadDocument()).pages, 1);
  assert.deepEqual(fontRequests, []);

  // Logo requests use the same Pages base path and recover after failure.
  await page.reload();
  await page.route("**/brand/karnaphuli-mark.jpg", (route) =>
    route.request().resourceType() === "fetch" ? route.abort() : route.continue(),
  );
  await page.getByRole("button", { name: /বিক্রয় রিপোর্ট/ }).click();
  assert.equal((await downloadDocument()).pages, 1, "A4 reports must not depend on a logo request");
  await page.getByRole("button", { name: "বন্ধ", exact: true }).click();
  await page.goto(origin + base + "sales");
  await page.getByRole("button", { name: /বিল-/ }).first().click();
  await page.getByRole("button", { name: "PDF ডাউনলোড করুন" }).click();
  await page.getByText("PDF তৈরি করা যায়নি। আবার চেষ্টা করুন।", { exact: true }).waitFor();
  await assertTypography(page, "error toast");
  await page.unroute("**/brand/karnaphuli-mark.jpg");
  assert.equal((await downloadDocument()).pages, 1);

  assert.deepEqual(fontRequests, [], "UI/PDF fonts must be embedded, not downloaded");
  assert.deepEqual(errors, []);
  console.log(
    "Pages smoke passed: customer bill receipts, routing, mobile/desktop typography, blue reference-style A4 reports/green A5 sales receipts, print visibility, long/empty reports, embedded Unicode fonts and logo retry.",
  );
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
